/**
 * Client-side git operations using isomorphic-git.
 * Runs entirely in the browser — no server needed.
 * Uses the File System Access API (browser-adapter) as the filesystem backend.
 */

import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'

export interface GitStatus {
  isRepo: boolean
  branch: string
  modifiedFiles: string[]
  untrackedFiles: string[]
  hasRemote: boolean
  remoteUrl: string | null
}

export interface GitCloneOptions {
  url: string
  dir: FileSystemDirectoryHandle
  branch?: string
  token?: string
  onProgress?: (phase: string, loaded: number, total: number) => void
}

/** Create an FS adapter for isomorphic-git from a FileSystemDirectoryHandle */
function createFsFromHandle(dirHandle: FileSystemDirectoryHandle) {
  // isomorphic-git needs a node-fs-like interface
  // We use the File System Access API to implement it
  return {
    promises: {
      async readFile(path: string): Promise<Uint8Array> {
        const parts = path.split('/').filter(Boolean)
        let handle: FileSystemDirectoryHandle = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          handle = await handle.getDirectoryHandle(parts[i])
        }
        const fileHandle = await handle.getFileHandle(parts[parts.length - 1])
        const file = await fileHandle.getFile()
        return new Uint8Array(await file.arrayBuffer())
      },
      async writeFile(path: string, data: Uint8Array | string): Promise<void> {
        const parts = path.split('/').filter(Boolean)
        let handle: FileSystemDirectoryHandle = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          handle = await handle.getDirectoryHandle(parts[i], { create: true })
        }
        const fileHandle = await handle.getFileHandle(parts[parts.length - 1], { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(typeof data === 'string' ? new TextEncoder().encode(data) : data)
        await writable.close()
      },
      async unlink(path: string): Promise<void> {
        const parts = path.split('/').filter(Boolean)
        let handle: FileSystemDirectoryHandle = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          handle = await handle.getDirectoryHandle(parts[i])
        }
        await handle.removeEntry(parts[parts.length - 1])
      },
      async readdir(path: string): Promise<string[]> {
        const parts = path.split('/').filter(Boolean)
        let handle: FileSystemDirectoryHandle = dirHandle
        for (const part of parts) {
          handle = await handle.getDirectoryHandle(part)
        }
        const entries: string[] = []
        for await (const [name] of (handle as any).entries()) {
          entries.push(name)
        }
        return entries
      },
      async mkdir(path: string): Promise<void> {
        const parts = path.split('/').filter(Boolean)
        let handle: FileSystemDirectoryHandle = dirHandle
        for (const part of parts) {
          handle = await handle.getDirectoryHandle(part, { create: true })
        }
      },
      async rmdir(path: string): Promise<void> {
        const parts = path.split('/').filter(Boolean)
        let handle: FileSystemDirectoryHandle = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          handle = await handle.getDirectoryHandle(parts[i])
        }
        await handle.removeEntry(parts[parts.length - 1], { recursive: true })
      },
      async stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }> {
        const parts = path.split('/').filter(Boolean)
        let handle: FileSystemDirectoryHandle = dirHandle
        try {
          for (let i = 0; i < parts.length - 1; i++) {
            handle = await handle.getDirectoryHandle(parts[i])
          }
          const last = parts[parts.length - 1]
          try {
            await handle.getDirectoryHandle(last)
            return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false }
          } catch {
            await handle.getFileHandle(last)
            return { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false }
          }
        } catch {
          throw new Error(`ENOENT: ${path}`)
        }
      },
      async lstat(path: string) { return this.stat(path) },
    },
  }
}

/** Clone a repository into a directory handle */
export async function clone(opts: GitCloneOptions): Promise<void> {
  const fs = createFsFromHandle(opts.dir)
  await git.clone({
    fs,
    http,
    dir: '/',
    url: opts.url,
    ref: opts.branch || 'main',
    singleBranch: true,
    depth: 1,
    onAuth: opts.token ? () => ({ username: opts.token!, password: 'x-oauth-basic' }) : undefined,
    onProgress: opts.onProgress ? (e) => opts.onProgress!(e.phase, e.loaded, e.total) : undefined,
  })
}

/** Get git status for a directory handle */
export async function status(dirHandle: FileSystemDirectoryHandle): Promise<GitStatus> {
  const fs = createFsFromHandle(dirHandle)
  try {
    const branch = await git.currentBranch({ fs, dir: '/' }) || 'main'
    const matrix = await git.statusMatrix({ fs, dir: '/' })
    const modified = matrix.filter(([, h, w]) => h !== w).map(([f]) => f)
    const untracked = matrix.filter(([, h]) => h === 0).map(([f]) => f)
    let remoteUrl: string | null = null
    try {
      const remotes = await git.listRemotes({ fs, dir: '/' })
      remoteUrl = remotes.find(r => r.remote === 'origin')?.url || null
    } catch {}
    return { isRepo: true, branch, modifiedFiles: modified, untrackedFiles: untracked, hasRemote: !!remoteUrl, remoteUrl }
  } catch {
    return { isRepo: false, branch: '', modifiedFiles: [], untrackedFiles: [], hasRemote: false, remoteUrl: null }
  }
}

/** Commit all changes */
export async function commitAll(dirHandle: FileSystemDirectoryHandle, message: string, author: { name: string; email: string }): Promise<string> {
  const fs = createFsFromHandle(dirHandle)
  await git.add({ fs, dir: '/', filepath: '.' })
  return git.commit({ fs, dir: '/', message, author })
}

/** Push to remote */
export async function push(dirHandle: FileSystemDirectoryHandle, token?: string): Promise<void> {
  const fs = createFsFromHandle(dirHandle)
  await git.push({
    fs,
    http,
    dir: '/',
    onAuth: token ? () => ({ username: token, password: 'x-oauth-basic' }) : undefined,
  })
}

/** Pull from remote */
export async function pull(dirHandle: FileSystemDirectoryHandle, token?: string): Promise<void> {
  const fs = createFsFromHandle(dirHandle)
  await git.pull({
    fs,
    http,
    dir: '/',
    singleBranch: true,
    author: { name: 'AgentFlow', email: 'agentflow@local' },
    onAuth: token ? () => ({ username: token, password: 'x-oauth-basic' }) : undefined,
  })
}
