import type { WorkspaceAdapter, WorkspaceFile } from './types'
import { createLocalAdapter } from './local-adapter'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

export interface GitAdapterOptions {
  repoUrl: string
  branch?: string
  /** Where to clone. Defaults to a temp dir. */
  cloneDir?: string
}

/**
 * Git adapter — clones a repo and provides read/write access.
 * Wraps a local adapter pointed at the cloned directory.
 * Push/pull sync the changes back to the remote.
 */
export function createGitAdapter(options: GitAdapterOptions): WorkspaceAdapter & {
  pull(): Promise<void>
  push(message?: string): Promise<void>
  getCloneDir(): string
} {
  const branch = options.branch || 'main'
  const cloneDir = options.cloneDir || path.join(os.tmpdir(), `af-git-${Date.now()}`)

  // Clone if not already cloned
  if (!fs.existsSync(path.join(cloneDir, '.git'))) {
    fs.mkdirSync(cloneDir, { recursive: true })
    execSync(`git clone --depth 1 --branch ${branch} ${options.repoUrl} .`, {
      cwd: cloneDir,
      stdio: 'pipe',
      timeout: 30000,
    })
  }

  // Find .agentflow dir in the clone
  let workspaceRoot = cloneDir
  const agentflowDir = path.join(cloneDir, '.agentflow')
  if (fs.existsSync(agentflowDir)) {
    workspaceRoot = agentflowDir
  }

  const local = createLocalAdapter(workspaceRoot)

  return {
    ...local,
    type: 'git' as const,

    getCloneDir() {
      return cloneDir
    },

    async pull() {
      execSync(`git pull origin ${branch}`, {
        cwd: cloneDir,
        stdio: 'pipe',
        timeout: 15000,
      })
    },

    async push(message = 'Update from AgentFlow') {
      execSync('git add -A', { cwd: cloneDir, stdio: 'pipe' })
      try {
        execSync(`git commit -m "${message}"`, { cwd: cloneDir, stdio: 'pipe' })
      } catch {
        // Nothing to commit
        return
      }
      execSync(`git push origin ${branch}`, {
        cwd: cloneDir,
        stdio: 'pipe',
        timeout: 15000,
      })
    },
  }
}
