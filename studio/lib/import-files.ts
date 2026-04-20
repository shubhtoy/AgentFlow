import type { WorkspaceAdapter } from './workspace/types'

/** Max file size: 10MB */
const MAX_SIZE = 10 * 1024 * 1024

export interface ImportEntry {
  path: string
  content: string
}

export interface ImportPreview {
  entries: ImportEntry[]
  conflicts: string[]       // paths that already exist
  skipped: string[]          // files skipped (wrong type / too large)
}

/** Extract importable entries from dropped files */
export async function extractEntries(files: File[]): Promise<{ entries: ImportEntry[]; skipped: string[] }> {
  const entries: ImportEntry[] = []
  const skipped: string[] = []

  for (const file of files) {
    if (file.size > MAX_SIZE) { skipped.push(`${file.name} (too large)`); continue }

    if (file.name.endsWith('.zip')) {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue
        const normalized = stripCommonRoot(zipPath, Object.keys(zip.files))
        entries.push({ path: normalized, content: await zipEntry.async('string') })
      }
    } else {
      const rel = (file as any).webkitRelativePath || file.name
      const parts = rel.split('/')
      const path = parts.length > 1 ? parts.slice(1).join('/') : parts[0]
      entries.push({ path, content: await file.text() })
    }
  }
  return { entries, skipped }
}

/** Check which entries conflict with existing workspace files */
export async function detectConflicts(
  entries: ImportEntry[],
  ws: WorkspaceAdapter,
): Promise<ImportPreview> {
  const existing = new Set(await ws.list())
  const conflicts = entries.filter(e => existing.has(e.path)).map(e => e.path)
  return { entries, conflicts, skipped: [] }
}

/** Write entries to workspace */
export async function applyImport(entries: ImportEntry[], ws: WorkspaceAdapter): Promise<number> {
  for (const e of entries) await ws.write(e.path, e.content)
  return entries.length
}

/** If all zip entries share a common root folder, strip it */
function stripCommonRoot(path: string, allPaths: string[]): string {
  const nonDirs = allPaths.filter(p => !p.endsWith('/'))
  if (nonDirs.length === 0) return path
  const first = nonDirs[0].split('/')[0]
  const allShare = nonDirs.every(p => p.startsWith(first + '/'))
  if (!allShare) return path
  return path.startsWith(first + '/') ? path.slice(first.length + 1) : path
}
