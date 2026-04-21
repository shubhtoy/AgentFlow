/**
 * Client-side git operations using isomorphic-git + lightning-fs.
 * Runs entirely in the browser. Uses IndexedDB as filesystem backend.
 */

import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import LightningFS from '@isomorphic-git/lightning-fs'

const fs = new LightningFS('agentflow-git')
const dir = '/repo'
const CORS_PROXY = 'https://cors.isomorphic-git.org'

/** Clone a repo and return all files */
export async function cloneAndList(url: string, opts?: { branch?: string; token?: string; onProgress?: (msg: string) => void }): Promise<{ files: { path: string; content: string }[] }> {
  // Normalize URL
  let gitUrl = url.trim()
  if (!gitUrl.endsWith('.git') && gitUrl.includes('github.com')) gitUrl += '.git'
  if (gitUrl.startsWith('git@')) gitUrl = gitUrl.replace('git@', 'https://').replace(':', '/')
  if (!gitUrl.startsWith('http')) gitUrl = 'https://' + gitUrl
  // Clean previous clone
  try { await fs.promises.rmdir(dir, { recursive: true } as any) } catch {}
  await fs.promises.mkdir(dir)

  await git.clone({
    fs,
    http,
    dir,
    url: gitUrl,
    corsProxy: CORS_PROXY,
    ref: opts?.branch || 'main',
    singleBranch: true,
    depth: 1,
    onAuth: opts?.token ? () => ({ username: opts.token!, password: 'x-oauth-basic' }) : undefined,
    onProgress: opts?.onProgress ? (e) => opts.onProgress!(`${e.phase}: ${e.loaded}/${e.total || '?'}`) : undefined,
  })

  // Read all files recursively
  const files: { path: string; content: string }[] = []
  async function walk(currentDir: string, prefix: string) {
    const entries = await fs.promises.readdir(currentDir)
    for (const entry of entries) {
      if (entry === '.git') continue
      const fullPath = `${currentDir}/${entry}`
      const stat = await fs.promises.stat(fullPath)
      if (stat.isDirectory()) {
        await walk(fullPath, `${prefix}${entry}/`)
      } else {
        try {
          const content = await fs.promises.readFile(fullPath, { encoding: 'utf8' }) as string
          files.push({ path: `${prefix}${entry}`, content })
        } catch {} // skip binary files
      }
    }
  }
  await walk(dir, '')
  return { files }
}

/** Get status of the cloned repo */
export async function getStatus(): Promise<{ branch: string; files: number }> {
  try {
    const branch = await git.currentBranch({ fs, dir }) || 'main'
    const entries = await fs.promises.readdir(dir)
    return { branch, files: entries.filter(e => e !== '.git').length }
  } catch {
    return { branch: 'main', files: 0 }
  }
}

/** Commit and push */
export async function commitAndPush(message: string, token?: string): Promise<void> {
  await git.add({ fs, dir, filepath: '.' })
  await git.commit({ fs, dir, message, author: { name: 'AgentFlow', email: 'agentflow@local' } })
  await git.push({ corsProxy: CORS_PROXY,
    fs, http, dir,
    onAuth: token ? () => ({ username: token, password: 'x-oauth-basic' }) : undefined,
  })
}
