/**
 * GitService.
 */

import fs from 'fs'
import path from 'path'
import { ok, fail, ErrorCode } from '@agentflow/core/services/types'

interface ServiceContext {
  rootDir: string
  logger: { error: (obj: unknown, msg: string) => void }
  brandConfig?: unknown
}

interface InitParams {
  url: string
  name?: string
  role?: string
  branch?: string
  repoType?: string
}

interface SyncParams {
  repoName: string
  direction?: string
  dryRun?: boolean
}

export function createGitService(ctx: ServiceContext) {
  const { rootDir, logger } = ctx

  const getGitManager = () => require('../git/git-manager')
  const getRepoScanner = () => require('../git/repo-scanner')
  const getSyncEngine = () => require('../git/sync-engine')
  const getConfigManager = () => require('../git/config-manager')

  let lastSyncTimestamp: string | null = null
  let pendingConflicts: { path: string; resolution: string }[] = []

  return {
    async getStatus(repoName?: string) {
      try {
        const configManager = getConfigManager()
        const gitManager = getGitManager()
        const config = configManager.loadOrCreate(path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME))
        const repos = config.repos || []
        if (repos.length === 0) return ok({ repos: [], lastSyncTimestamp })

        const statuses: Record<string, unknown>[] = []
        const targetRepos = repoName ? repos.filter((r: { name: string }) => r.name === repoName) : repos

        for (const mapping of targetRepos) {
          try {
            const repoStatus = await gitManager.status(mapping.localPath)
            statuses.push({ name: mapping.name, ...repoStatus })
          } catch (err: unknown) {
            statuses.push({ name: mapping.name, error: (err as Error).message })
          }
        }

        return ok({ repos: statuses, lastSyncTimestamp })
      } catch (err: unknown) {
        logger.error({ err }, 'GitService.getStatus failed')
        return fail(ErrorCode.GIT_SYNC_ERROR, (err as Error).message)
      }
    },

    async init(params: InitParams) {
      try {
        const configManager = getConfigManager()
        const gitManager = getGitManager()
        const repoScanner = getRepoScanner()
        const { url: repoUrl, name, role, branch, repoType } = params
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME)
        const config = configManager.loadOrCreate(configPath)

        const repoName =
          name ||
          repoUrl
            .replace(/\.git$/, '')
            .split('/')
            .pop()
        if (config.repos.some((r: { name: string }) => r.name === repoName)) {
          return fail(ErrorCode.INVALID_INPUT, `Repo name "${repoName}" already exists`, 400)
        }

        const targetBranch = branch || 'main'
        let targetDir: string
        if (role === 'agentic') {
          targetDir = path.join(path.dirname(rootDir), '.agentflow-repos', repoName!)
        } else if (role === 'shared') {
          targetDir = path.join(path.dirname(rootDir), '.agentflow-shared', repoName!)
        } else {
          targetDir = path.dirname(rootDir)
        }

        if (fs.existsSync(path.join(targetDir, '.git'))) {
          const gm = gitManager.attach(targetDir)
          try {
            await gm.addRemote('agentflow', repoUrl)
          } catch {
            /* remote may exist */
          }
        } else {
          await gitManager.clone(repoUrl, targetDir, targetBranch)
        }

        const scanResult = repoScanner.scan(targetDir, config.scanDepth || 5)
        const mapping = {
          name: repoName,
          url: repoUrl,
          branch: targetBranch,
          localPath: targetDir,
          repoType: repoType || 'public',
          role: role || 'primary',
          agentflowPath: scanResult.agentflowPaths?.[0] || '.agentflow',
        }

        config.repos.push(mapping)
        configManager.save(config, configPath)
        return ok({ scanResult, mapping })
      } catch (err: unknown) {
        logger.error({ err }, 'GitService.init failed')
        return fail(ErrorCode.GIT_SYNC_ERROR, (err as Error).message)
      }
    },

    async sync(params: SyncParams) {
      try {
        const configManager = getConfigManager()
        const syncEngine = getSyncEngine()
        const { repoName, direction, dryRun: isDryRun } = params
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME)
        const config = configManager.loadOrCreate(configPath)

        const syncDirection = direction || config.syncRules.syncDirection || 'bidirectional'
        const result = await syncEngine.sync(config, repoName, syncDirection, { dryRun: !!isDryRun })

        lastSyncTimestamp = result.timestamp
        if (result.conflicts?.length > 0) {
          pendingConflicts = result.conflicts.filter((c: { resolution: string }) => c.resolution === 'pending')
        }

        return ok(result)
      } catch (err: unknown) {
        logger.error({ err }, 'GitService.sync failed')
        return fail(ErrorCode.GIT_SYNC_ERROR, (err as Error).message)
      }
    },

    scan(dir?: string, depth?: number) {
      try {
        const repoScanner = getRepoScanner()
        return ok(repoScanner.scan(dir || rootDir, depth || 5))
      } catch (err: unknown) {
        logger.error({ err }, 'GitService.scan failed')
        return fail(ErrorCode.GIT_SYNC_ERROR, (err as Error).message)
      }
    },

    getConflicts() {
      return ok({ conflicts: pendingConflicts })
    },

    async resolve(conflictPath: string, strategy: string) {
      try {
        const configManager = getConfigManager()
        const gitManager = getGitManager()
        const syncEngine = getSyncEngine()
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME)
        const config = configManager.loadOrCreate(configPath)

        for (const mapping of config.repos) {
          try {
            const gm = gitManager.attach(mapping.localPath)
            const resolution = await syncEngine.resolveConflict(gm, conflictPath, strategy)
            pendingConflicts = pendingConflicts.filter(c => c.path !== conflictPath)
            return ok({ path: conflictPath, resolution })
          } catch {
            continue
          }
        }

        return fail(ErrorCode.FILE_NOT_FOUND, `Could not resolve conflict for path: ${conflictPath}`, 404)
      } catch (err: unknown) {
        logger.error({ err }, 'GitService.resolve failed')
        return fail(ErrorCode.GIT_SYNC_ERROR, (err as Error).message)
      }
    },

    getConfig() {
      try {
        const configManager = getConfigManager()
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME)
        return ok(configManager.loadOrCreate(configPath))
      } catch (err: unknown) {
        logger.error({ err }, 'GitService.getConfig failed')
        return fail(ErrorCode.GIT_SYNC_ERROR, (err as Error).message)
      }
    },

    updateConfig(updates: Record<string, unknown>) {
      try {
        const configManager = getConfigManager()
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME)
        const existing = configManager.loadOrCreate(configPath)
        const updated = { ...existing, ...updates }
        if (updates.syncRules) {
          updated.syncRules = { ...existing.syncRules, ...(updates.syncRules as Record<string, unknown>) }
        }
        configManager.save(updated, configPath)
        return ok(updated)
      } catch (err: unknown) {
        logger.error({ err }, 'GitService.updateConfig failed')
        return fail(ErrorCode.GIT_SYNC_ERROR, (err as Error).message)
      }
    },
  }
}
