import type { WorkspaceAdapter, WorkspaceFile } from './types'
import { WORKSPACE_EXTENSIONS } from '@agentflow/parser-core'

/**
 * Browser adapter using File System Access API.
 * User picks a local folder, browser gets direct read/write access.
 * No server filesystem needed.
 */

let _dirHandle: FileSystemDirectoryHandle | null = null

/** Prompt user to pick a directory */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  // @ts-expect-error — showDirectoryPicker is not in all TS libs
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  _dirHandle = handle
  return handle
}

/** Get the current directory handle */
export function getDirectoryHandle(): FileSystemDirectoryHandle | null {
  return _dirHandle
}

/** Set handle (e.g. restored from IndexedDB) */
export function setDirectoryHandle(handle: FileSystemDirectoryHandle) {
  _dirHandle = handle
}

async function getFileHandle(dir: FileSystemDirectoryHandle, path: string, create = false): Promise<FileSystemFileHandle> {
  const parts = path.split('/')
  let current = dir
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create })
  }
  return current.getFileHandle(parts[parts.length - 1], { create })
}

async function listRecursive(dir: FileSystemDirectoryHandle, prefix = ''): Promise<string[]> {
  const paths: string[] = []
  for await (const [name, handle] of (dir as any).entries()) {
    const fullPath = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      if (name.startsWith('.')) continue
      paths.push(...await listRecursive(handle, fullPath))
    } else if (WORKSPACE_EXTENSIONS.some((ext: string) => name.endsWith(ext))) {
      paths.push(fullPath)
    }
  }
  return paths
}

export function createBrowserAdapter(dirHandle: FileSystemDirectoryHandle): WorkspaceAdapter {
  return {
    type: 'browser',

    async read(path) {
      const fh = await getFileHandle(dirHandle, path)
      const file = await fh.getFile()
      return file.text()
    },

    async write(path, content) {
      const fh = await getFileHandle(dirHandle, path, true)
      const writable = await fh.createWritable()
      await writable.write(content)
      await writable.close()
    },

    async remove(path) {
      const parts = path.split('/')
      let dir = dirHandle
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i])
      }
      await dir.removeEntry(parts[parts.length - 1], { recursive: true })
    },

    async move(from, to) {
      const content = await this.read(from)
      await this.write(to, content)
      await this.remove(from)
    },

    async list() {
      return listRecursive(dirHandle)
    },

    async exists(path) {
      try {
        await getFileHandle(dirHandle, path)
        return true
      } catch {
        return false
      }
    },

    async mkdir(path) {
      const parts = path.split('/')
      let current = dirHandle
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: true })
      }
    },

    async readAll() {
      const paths = await this.list()
      const files: WorkspaceFile[] = []
      for (const p of paths) {
        try {
          const content = await this.read(p)
          files.push({ path: p, content })
        } catch {}
      }
      return files
    },
  }
}


/** Build a tree from flat file paths (for getTree) */
export function buildTreeFromPaths(paths: string[]) {
  const root: any = { name: '.', path: '.', type: 'directory', children: [] }
  const dirs: Record<string, any> = { '.': root }

  for (const p of paths.sort()) {
    const parts = p.split('/')
    let current = root
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/')
      if (!dirs[dirPath]) {
        const dir = { name: parts[i], path: dirPath, type: 'directory', children: [] }
        dirs[dirPath] = dir
        current.children.push(dir)
      }
      current = dirs[dirPath]
    }
    current.children.push({ name: parts[parts.length - 1], path: p, type: 'file' })
  }
  return root
}
