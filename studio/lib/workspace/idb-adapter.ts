import type { WorkspaceAdapter, WorkspaceFile } from './types'

/**
 * IndexedDB-backed workspace adapter.
 * Works in ALL browsers. No permission needed. Persistent.
 */

const DB_NAME = 'agentflow-workspace'
const DB_VERSION = 1
const STORE = 'files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'path' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB()
  return db.transaction(STORE, mode).objectStore(STORE)
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
}

export function createIDBAdapter(): WorkspaceAdapter {
  return {
    type: 'browser',

    async read(path) {
      const store = await tx('readonly')
      const result = await req(store.get(path))
      if (!result) throw new Error(`File not found: ${path}`)
      return (result as any).content
    },

    async write(path, content) {
      const store = await tx('readwrite')
      await req(store.put({ path, content, updatedAt: Date.now() }))
    },

    async remove(path) {
      const store = await tx('readwrite')
      // Delete exact path and any children (for directories)
      const all = await req(store.getAll()) as any[]
      const db = await openDB()
      const t = db.transaction(STORE, 'readwrite')
      const s = t.objectStore(STORE)
      for (const item of all) {
        if (item.path === path || item.path.startsWith(path + '/')) {
          s.delete(item.path)
        }
      }
      return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error) })
    },

    async move(from, to) {
      const content = await this.read(from)
      await this.write(to, content)
      await this.remove(from)
    },

    async list() {
      const store = await tx('readonly')
      const all = await req(store.getAllKeys()) as string[]
      return all.sort()
    },

    async exists(path) {
      try {
        const store = await tx('readonly')
        const result = await req(store.get(path))
        return !!result
      } catch { return false }
    },

    async readAll() {
      const store = await tx('readonly')
      const all = await req(store.getAll()) as any[]
      return all.map(item => ({ path: item.path, content: item.content }))
    },

    async mkdir() {},
  }
}

export async function clearIDBWorkspace(): Promise<void> {
  const db = await openDB()
  const t = db.transaction(STORE, 'readwrite')
  t.objectStore(STORE).clear()
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error) })
}

export async function ensureDefaultIDBWorkspace(): Promise<void> {
  const adapter = createIDBAdapter()
  const files = await adapter.list()
  if (files.length > 0) return
  const { DEFAULT_AGENTS_MD } = await import('./index')
  await adapter.write('AGENTS.md', DEFAULT_AGENTS_MD)
}
