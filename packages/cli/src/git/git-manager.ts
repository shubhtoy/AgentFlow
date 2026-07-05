/**
 * GitManager.
 */

import fs from 'fs'
import path from 'path'
import simpleGit from 'simple-git'
import type { SimpleGit } from 'simple-git'

export function sanitiseOutput(text: string): string {
  if (!text) return ''
  return text.replace(/:\/\/[^@/\s]+:[^@/\s]+@/g, '://***:***@')
}

function git(cwd?: string): SimpleGit {
  return simpleGit(cwd ? { baseDir: cwd } : undefined)
}

async function safe<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (err: unknown) {
    const msg = sanitiseOutput((err as Error).message || String(err))
    const wrapped = new Error(msg) as Error & { exitCode: number; stderr: string }
    wrapped.exitCode = (err as { exitCode?: number }).exitCode ?? 1
    wrapped.stderr = sanitiseOutput((err as { stderr?: string }).stderr || '')
    throw wrapped
  }
}

export function parseStatusOutput(output: string) {
  const modified: string[] = []
  const untracked: string[] = []
  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const code = line.substring(0, 2)
    const filePath = line.substring(3).trim()
    if (code === '??') untracked.push(filePath)
    else modified.push(filePath)
  }
  return { modified, untracked }
}

export function parseRevListCount(output: string) {
  const parts = output.trim().split(/\s+/)
  return { ahead: parseInt(parts[0], 10) || 0, behind: parseInt(parts[1], 10) || 0 }
}

export function parsePullConflicts(stdout: string) {
  const hasConflicts = /CONFLICT/.test(stdout) || /Automatic merge failed/.test(stdout)
  const conflictFiles: string[] = []
  if (hasConflicts) {
    const regex = /CONFLICT \([^)]+\): (?:Merge conflict in |.+ -> )(.+)/g
    let match
    while ((match = regex.exec(stdout)) !== null) conflictFiles.push(match[1].trim())
  }
  return { hasConflicts, conflictFiles }
}

export async function clone(repoUrl: string, targetDir: string, branch?: string) {
  const opts = branch ? ['-b', branch] : []
  await safe(exports._git().clone(repoUrl, targetDir, opts))
  return createBoundInstance(targetDir)
}

export function attach(repoDir: string) {
  if (!fs.existsSync(path.join(repoDir, '.git'))) {
    throw new Error(`Not a git repository: "${repoDir}" (no .git directory found)`)
  }
  return createBoundInstance(repoDir)
}

export async function pull(repoDir: string, branch: string) {
  try {
    const result = await safe(exports._git(repoDir).pull('origin', branch))
    return {
      hasConflicts: false,
      conflictFiles: [] as string[],
      output: (result as { summary?: string }).summary || '',
    }
  } catch (err: unknown) {
    const conflicts = parsePullConflicts((err as Error).message)
    if (conflicts.hasConflicts) return { ...conflicts, output: (err as Error).message }
    throw err
  }
}

export async function push(repoDir: string, branch: string) {
  await safe(exports._git(repoDir).push('origin', branch))
  return { success: true, output: '' }
}

export async function status(repoDir: string) {
  const gitDir = path.join(repoDir, '.git')
  if (!fs.existsSync(gitDir)) {
    return {
      isRepo: false,
      isClean: false,
      branch: '',
      ahead: 0,
      behind: 0,
      modifiedFiles: [] as string[],
      untrackedFiles: [] as string[],
      hasRemote: false,
      remoteUrl: null as string | null,
    }
  }

  const g = exports._git(repoDir)
  let branch = ''
  let modifiedFiles: string[] = []
  let untrackedFiles: string[] = []
  let hasRemote = false
  let remoteUrl: string | null = null
  let ahead = 0
  let behind = 0

  try {
    const st = await safe(g.status())
    branch = st.current || ''
    modifiedFiles = [
      ...st.modified,
      ...st.created,
      ...st.deleted,
      ...st.renamed.map((r: { to: string }) => r.to),
      ...st.conflicted,
    ]
    untrackedFiles = st.not_added || []
    ahead = st.ahead || 0
    behind = st.behind || 0
  } catch {
    /* empty repo or detached HEAD */
  }

  try {
    const remotes = await safe(g.getRemotes(true))
    if (remotes.length > 0) {
      hasRemote = true
      remoteUrl = sanitiseOutput(remotes[0].refs?.fetch || remotes[0].refs?.push || '')
    }
  } catch {
    /* no remotes */
  }

  return {
    isRepo: true,
    isClean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
    branch,
    ahead,
    behind,
    modifiedFiles,
    untrackedFiles,
    hasRemote,
    remoteUrl,
  }
}

export async function stage(repoDir: string, filePath: string) {
  await safe(exports._git(repoDir).add(filePath))
}

export async function commit(repoDir: string, message: string) {
  const result = await safe(exports._git(repoDir).commit(message))
  return (result as { summary?: string }).summary || ''
}

export async function stagedFileCount(repoDir: string): Promise<number> {
  try {
    const result = await safe(exports._git(repoDir).diff(['--cached', '--name-only']))
    return (result as string).trim().split('\n').filter(Boolean).length
  } catch {
    return 0
  }
}

export async function addRemote(repoDir: string, name: string, url: string) {
  await safe(exports._git(repoDir).addRemote(name, url))
}

export async function showRemote(repoDir: string, filePath: string, branch: string) {
  return safe(exports._git(repoDir).show([`origin/${branch}:${filePath}`]))
}

export async function checkoutOurs(repoDir: string, filePath: string) {
  await safe(exports._git(repoDir).checkout(['--ours', filePath]))
}

export async function checkoutTheirs(repoDir: string, filePath: string) {
  await safe(exports._git(repoDir).checkout(['--theirs', filePath]))
}

export function createBoundInstance(repoDir: string) {
  return {
    repoDir,
    pull: (branch: string) => pull(repoDir, branch),
    push: (branch: string) => push(repoDir, branch),
    status: () => status(repoDir),
    stage: (filePath: string) => stage(repoDir, filePath),
    commit: (message: string) => commit(repoDir, message),
    stagedFileCount: () => stagedFileCount(repoDir),
    addRemote: (name: string, url: string) => addRemote(repoDir, name, url),
    showRemote: (filePath: string, branch: string) => showRemote(repoDir, filePath, branch),
    checkoutOurs: (filePath: string) => checkoutOurs(repoDir, filePath),
    checkoutTheirs: (filePath: string) => checkoutTheirs(repoDir, filePath),
  }
}

// Expose git factory for mocking in tests
const exports = { _git: git }
export { exports as _git_exports }
export const _git = git
