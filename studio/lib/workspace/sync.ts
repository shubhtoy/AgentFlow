import type { WorkspaceAdapter, WorkspaceFile } from './types'

/**
 * Sync engine — diffs two workspace adapters and applies changes.
 * Works for any pair: IDB ↔ folder, IDB ↔ git, OPFS ↔ folder, etc.
 */

export type ChangeType = 'added' | 'removed' | 'modified' | 'conflict'
export type Side = 'local' | 'remote'

export interface FileChange {
  path: string
  type: ChangeType
  side: Side            // which side has the newer version
  localContent?: string
  remoteContent?: string
}

export interface SyncResult {
  pushed: string[]      // written to remote
  pulled: string[]      // written to local
  conflicts: FileChange[]
  unchanged: number
}

export interface SyncState {
  hashes: Record<string, string>  // path → hash at last sync
  syncedAt: number
}

// Simple fast hash — good enough for text file comparison
function hash(content: string): string {
  let h = 0
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h + content.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

/** Diff two adapters against a previous sync state */
export async function diff(
  local: WorkspaceAdapter,
  remote: WorkspaceAdapter,
  prev: SyncState | null,
): Promise<FileChange[]> {
  const [localFiles, remoteFiles] = await Promise.all([local.readAll(), remote.readAll()])
  const localMap = new Map(localFiles.map(f => [f.path, f.content]))
  const remoteMap = new Map(remoteFiles.map(f => [f.path, f.content]))
  const allPaths = new Set([...localMap.keys(), ...remoteMap.keys()])
  const prevHashes = prev?.hashes ?? {}
  const changes: FileChange[] = []

  for (const path of allPaths) {
    const lc = localMap.get(path)
    const rc = remoteMap.get(path)
    const lh = lc != null ? hash(lc) : null
    const rh = rc != null ? hash(rc) : null
    const ph = prevHashes[path] ?? null

    if (lh === rh) continue // identical

    if (lc != null && rc == null) {
      // Exists locally only
      changes.push({ path, type: ph ? 'removed' : 'added', side: ph ? 'remote' : 'local', localContent: lc })
    } else if (lc == null && rc != null) {
      // Exists remotely only
      changes.push({ path, type: ph ? 'removed' : 'added', side: ph ? 'local' : 'remote', remoteContent: rc })
    } else if (lc != null && rc != null) {
      // Both exist, different content
      const localChanged = lh !== ph
      const remoteChanged = rh !== ph
      if (localChanged && remoteChanged) {
        changes.push({ path, type: 'conflict', side: 'local', localContent: lc, remoteContent: rc })
      } else {
        changes.push({ path, type: 'modified', side: localChanged ? 'local' : 'remote', localContent: lc, remoteContent: rc })
      }
    }
  }
  return changes
}

/** Apply changes — auto-resolves non-conflicts, returns conflicts for user */
export async function apply(
  local: WorkspaceAdapter,
  remote: WorkspaceAdapter,
  changes: FileChange[],
): Promise<SyncResult> {
  const result: SyncResult = { pushed: [], pulled: [], conflicts: [], unchanged: 0 }

  for (const c of changes) {
    if (c.type === 'conflict') {
      result.conflicts.push(c)
      continue
    }

    if (c.type === 'added' || c.type === 'modified') {
      if (c.side === 'local' && c.localContent != null) {
        await remote.write(c.path, c.localContent)
        result.pushed.push(c.path)
      } else if (c.side === 'remote' && c.remoteContent != null) {
        await local.write(c.path, c.remoteContent)
        result.pulled.push(c.path)
      }
    } else if (c.type === 'removed') {
      if (c.side === 'remote') {
        await local.remove(c.path).catch(() => {})
        result.pulled.push(c.path)
      } else if (c.side === 'local') {
        await remote.remove(c.path).catch(() => {})
        result.pushed.push(c.path)
      }
    }
  }
  return result
}

/** Build sync state snapshot from an adapter */
export async function snapshot(adapter: WorkspaceAdapter): Promise<SyncState> {
  const files = await adapter.readAll()
  const hashes: Record<string, string> = {}
  for (const f of files) hashes[f.path] = hash(f.content)
  return { hashes, syncedAt: Date.now() }
}

/** Full sync: diff → apply → snapshot */
export async function sync(
  local: WorkspaceAdapter,
  remote: WorkspaceAdapter,
  prev: SyncState | null,
): Promise<{ result: SyncResult; state: SyncState }> {
  const changes = await diff(local, remote, prev)
  const result = await apply(local, remote, changes)
  const state = await snapshot(local)
  return { result, state }
}
