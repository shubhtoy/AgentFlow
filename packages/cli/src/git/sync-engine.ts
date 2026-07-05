/**
 * SyncEngine.
 */

import fs from 'fs'
import path from 'path'
import { RESERVED_DIRS } from '@agentflow/core/taxonomy'
import { minimatch } from 'minimatch'
import type { GitSyncConfig } from './config-manager'
import * as gitManager from './git-manager'
import { scan } from './repo-scanner'

export const SYNCLOCK_FILENAME = '.synclock'
export { RESERVED_DIRS }

interface SyncRules {
  include?: string[]
  exclude?: string[]
  resourceTypes?: string[]
}

interface BoundGit {
  repoDir: string
  pull: (branch: string) => Promise<{ hasConflicts: boolean; conflictFiles: string[]; output: string }>
  push: (branch: string) => Promise<{ success: boolean; output: string }>
  status: () => Promise<{ modifiedFiles: string[]; untrackedFiles: string[]; behind: number }>
  stage: (filePath: string) => Promise<void>
  commit: (message: string) => Promise<string>
  stagedFileCount: () => Promise<number>
  checkoutOurs: (filePath: string) => Promise<void>
  checkoutTheirs: (filePath: string) => Promise<void>
  showRemote: (filePath: string, branch: string) => Promise<string>
}

export function inferResourceTypeFromPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/')
  for (const dir of RESERVED_DIRS) {
    if (new RegExp(`(?:^|/)${dir}/`).test(normalized)) return dir
  }
  return null
}

export function matchesSyncRules(filePath: string, syncRules?: SyncRules): boolean {
  if (!syncRules) return true
  const normalized = filePath.replace(/\\/g, '/')
  const exclude = syncRules.exclude || []
  const include = syncRules.include || []
  const resourceTypes = syncRules.resourceTypes || []

  for (const pattern of exclude) {
    if (minimatch(normalized, pattern, { dot: true })) return false
  }
  let matchesInclude = include.length === 0
  for (const pattern of include) {
    if (minimatch(normalized, pattern, { dot: true })) {
      matchesInclude = true
      break
    }
  }
  if (!matchesInclude) return false
  if (resourceTypes.length > 0) {
    const rt = inferResourceTypeFromPath(normalized)
    if (rt !== null && !resourceTypes.includes(rt)) return false
  }
  return true
}

export function acquireLock(agentflowDir: string): string {
  const lockPath = path.join(agentflowDir, SYNCLOCK_FILENAME)
  if (fs.existsSync(lockPath)) {
    try {
      const stat = fs.statSync(lockPath)
      if (Date.now() - stat.mtimeMs > 5 * 60 * 1000) fs.unlinkSync(lockPath)
      else throw new Error('Sync already in progress')
    } catch (err: unknown) {
      if ((err as Error).message === 'Sync already in progress') throw err
    }
  }
  if (!fs.existsSync(agentflowDir)) fs.mkdirSync(agentflowDir, { recursive: true })
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString() }), 'utf-8')
  return lockPath
}

export function releaseLock(lockPath: string): void {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath)
  } catch {
    /* ignore */
  }
}

export function findMapping(repos: { name: string }[], repoName: string) {
  if (!repos || !Array.isArray(repos)) return null
  return repos.find(r => r.name === repoName) || null
}

async function resolveConflictByStrategy(
  gm: BoundGit,
  conflictPath: string,
  _conflict: unknown,
  strategy: string,
): Promise<string> {
  switch (strategy) {
    case 'local_wins':
      await gm.checkoutOurs(conflictPath)
      return 'local_wins'
    case 'remote_wins':
      await gm.checkoutTheirs(conflictPath)
      return 'remote_wins'
    case 'timestamp': {
      try {
        const localStat = fs.statSync(path.resolve(gm.repoDir, conflictPath))
        if (localStat.mtimeMs > 0) {
          await gm.checkoutOurs(conflictPath)
          return 'local_wins'
        }
      } catch {
        /* fallthrough */
      }
      await gm.checkoutTheirs(conflictPath)
      return 'remote_wins'
    }
    default:
      return 'pending'
  }
}

export { resolveConflictByStrategy }

export async function sync(
  config: GitSyncConfig,
  repoName: string,
  direction: string,
  options: { dryRun?: boolean } = {},
) {
  const { dryRun = false } = options
  const mapping = findMapping(config.repos, repoName) as GitSyncConfig['repos'][0] | null
  if (!mapping) throw new Error(`No repo mapping found for: ${repoName}`)

  const agentflowDir = path.join(
    mapping.localPath,
    (mapping as { agentflowPath?: string }).agentflowPath || '.agentflow',
  )
  let lockPath: string | null = null
  if (!dryRun) lockPath = acquireLock(agentflowDir)

  try {
    const gm = gitManager.attach(mapping.localPath) as unknown as BoundGit
    const conflicts: {
      path: string
      localContent: string | null
      remoteContent: string | null
      resolution: string | null
    }[] = []

    if (direction === 'pull_only' || direction === 'bidirectional') {
      const repoStatus = await gm.status()
      if (repoStatus.behind > 0 && !dryRun) {
        const pullResult = await gm.pull(mapping.branch)
        if (pullResult.hasConflicts) {
          for (const cp of pullResult.conflictFiles) {
            if (!matchesSyncRules(cp, config.syncRules)) continue
            const conflict = {
              path: cp,
              localContent: null as string | null,
              remoteContent: null as string | null,
              resolution: null as string | null,
            }
            try {
              conflict.localContent = fs.readFileSync(path.join(mapping.localPath, cp), 'utf-8')
            } catch {
              /* skip */
            }
            try {
              conflict.remoteContent = await gm.showRemote(cp, mapping.branch)
            } catch {
              /* skip */
            }
            conflict.resolution = await resolveConflictByStrategy(gm, cp, conflict, config.conflictStrategy)
            conflicts.push(conflict)
          }
        }
      }
    }

    if ((direction === 'push_only' || direction === 'bidirectional') && !dryRun) {
      const statusResult = await gm.status()
      const localChanges = [...statusResult.modifiedFiles, ...statusResult.untrackedFiles]
      for (const fp of localChanges) {
        if (!matchesSyncRules(fp, config.syncRules)) continue
        await gm.stage(fp)
      }
      const stagedCount = await gm.stagedFileCount()
      if (stagedCount > 0) {
        await gm.commit(`agentflow sync: ${stagedCount} file(s) updated`)
        await gm.push(mapping.branch)
      }
    }

    if (config.autoScan && !dryRun) {
      try {
        scan(mapping.localPath, config.scanDepth || 5)
      } catch {
        /* skip */
      }
    }

    return {
      success: true,
      direction,
      filesAdded: [],
      filesModified: [],
      filesDeleted: [],
      conflicts,
      timestamp: new Date().toISOString(),
      dryRun,
    }
  } finally {
    if (lockPath) releaseLock(lockPath)
  }
}

export async function resolveConflict(gm: BoundGit, conflictPath: string, strategy: string): Promise<string> {
  switch (strategy) {
    case 'local_wins':
      await gm.checkoutOurs(conflictPath)
      return 'local_wins'
    case 'remote_wins':
      await gm.checkoutTheirs(conflictPath)
      return 'remote_wins'
    default:
      return 'pending'
  }
}
