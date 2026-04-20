import type { WorkspaceAdapter, WorkspaceFile } from './types'

/**
 * OPFS adapter — uses Origin Private File System.
 * Works in ALL modern browsers (Chrome, Firefox, Safari).
 * Files persist in browser storage, no permissions needed.
 */

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory()
}

async function getOrCreateDir(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true })
}

async function ensureDir(root: FileSystemDirectoryHandle, dirPath: string): Promise<FileSystemDirectoryHandle> {
  let current = root
  for (const part of dirPath.split('/').filter(Boolean)) {
    current = await getOrCreateDir(current, part)
  }
  return current
}

async function getFileHandle(root: FileSystemDirectoryHandle, filePath: string, create = false): Promise<FileSystemFileHandle> {
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length === 0) throw new Error('Empty path')
  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create })
  }
  return dir.getFileHandle(parts[parts.length - 1], { create })
}

async function listAll(dir: FileSystemDirectoryHandle, prefix = ''): Promise<string[]> {
  const paths: string[] = []
  // @ts-expect-error — entries() not in all TS libs
  for await (const [name, handle] of dir.entries()) {
    const fullPath = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      paths.push(...await listAll(handle, fullPath))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

async function removeRecursive(dir: FileSystemDirectoryHandle, name: string) {
  await dir.removeEntry(name, { recursive: true })
}

export function createOPFSAdapter(): WorkspaceAdapter {
  // All files stored under a "workspace" directory in OPFS
  const getWorkspaceRoot = async () => {
    const root = await getRoot()
    return getOrCreateDir(root, 'agentflow-workspace')
  }

  return {
    type: 'browser',

    async read(path) {
      const root = await getWorkspaceRoot()
      const fh = await getFileHandle(root, path)
      const file = await fh.getFile()
      return file.text()
    },

    async write(path, content) {
      const root = await getWorkspaceRoot()
      const clean = path.split('/').filter(Boolean).join('/')
      if (!clean) return
      const parts = clean.split('/')
      if (parts.length > 1) {
        await ensureDir(root, parts.slice(0, -1).join('/'))
      }
      const fh = await getFileHandle(root, clean, true)
      // Retry up to 3 times — OPFS can transiently fail under rapid sequential writes
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const writable = await fh.createWritable()
          await writable.write(content)
          await writable.close()
          return
        } catch (e) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 50 * (attempt + 1)))
            continue
          }
          console.error(`[OPFS] write failed after 3 attempts: ${clean}`, e)
          throw e
        }
      }
    },

    async remove(path) {
      const root = await getWorkspaceRoot()
      const parts = path.split('/')
      if (parts.length === 1) {
        await removeRecursive(root, parts[0])
      } else {
        let dir = root
        for (let i = 0; i < parts.length - 1; i++) {
          dir = await dir.getDirectoryHandle(parts[i])
        }
        await removeRecursive(dir, parts[parts.length - 1])
      }
    },

    async move(from, to) {
      const content = await this.read(from)
      await this.write(to, content)
      await this.remove(from)
    },

    async list() {
      const root = await getWorkspaceRoot()
      return listAll(root)
    },

    async exists(path) {
      try {
        const root = await getWorkspaceRoot()
        await getFileHandle(root, path)
        return true
      } catch {
        return false
      }
    },

    async readAll() {
      const paths = await this.list()
      const files: WorkspaceFile[] = []
      for (const p of paths) {
        try {
          files.push({ path: p, content: await this.read(p) })
        } catch {}
      }
      return files
    },

    async mkdir(p: string) {
      const root = await getWorkspaceRoot()
      await ensureDir(root, p)
    },
  }
}

/** Clear all files from OPFS workspace */
export async function clearOPFSWorkspace(): Promise<void> {
  const root = await getRoot()
  try {
    await root.removeEntry('agentflow-workspace', { recursive: true })
  } catch {}
}

/** Initialize OPFS workspace with default files if empty */
export async function ensureDefaultOPFSWorkspace(): Promise<void> {
  const adapter = createOPFSAdapter()
  const files = await adapter.list()
  if (files.length > 0) return
  const { DEFAULT_AGENTS_MD } = await import('./index')
  await adapter.write('AGENTS.md', DEFAULT_AGENTS_MD)
}
