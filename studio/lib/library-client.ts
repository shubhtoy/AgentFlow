/**
 * Client-side library import — fetches files from /library/ static assets.
 * Replaces /api/library/import server route.
 */

const LIBRARY_BASE = '/library'

/** Fetch a single library file */
async function fetchLibraryFile(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${LIBRARY_BASE}/${path}`)
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

/** Extract {{category/name}} refs from markdown content */
function extractRefs(content: string): { category: string; name: string }[] {
  const refs: { category: string; name: string }[] = []
  const seen = new Set<string>()
  const re = /\{\{([^}]+)\}\}/g
  let m
  while ((m = re.exec(content)) !== null) {
    let inner = m[1].trim()
    if (inner.startsWith('->')) inner = inner.slice(2).trim()
    else if (inner.startsWith('<<')) inner = inner.slice(2).trim()
    const parts = inner.includes('|') ? inner.split('|') : [inner]
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed.includes('/')) continue
      const [category, name] = trimmed.split('/', 2)
      const cleanName = name.split('|')[0].trim()
      const key = `${category}/${cleanName}`
      if (!seen.has(key)) { seen.add(key); refs.push({ category, name: cleanName }) }
    }
  }
  return refs
}

/** Import a workflow from the library — returns all files + referenced resources */
export async function importWorkflow(name: string): Promise<{ files: { path: string; content: string }[] }> {
  // Fetch registry to get workflow file list
  const registry = await fetch(`${LIBRARY_BASE}/registry.json`).then(r => r.json()).catch(() => ({ entries: [] }))
  const entry = registry.entries?.find((e: any) => e.type === 'workflow' && e.name === name)

  const files: { path: string; content: string }[] = []
  const allRefs = new Set<string>()

  // Fetch workflow descriptor
  const descriptor = await fetchLibraryFile(`workflows/${name}/AGENTS.md`)
  if (descriptor) {
    files.push({ path: `${name}/AGENTS.md`, content: descriptor })
    for (const ref of extractRefs(descriptor)) allRefs.add(`${ref.category}/${ref.name}`)
  }

  // Fetch workflow node files from registry entry
  if (entry?.nodes) {
    for (const node of entry.nodes) {
      const nodePath = `workflows/${name}/${node}/SKILL.md`
      const content = await fetchLibraryFile(nodePath)
      if (content) {
        files.push({ path: `${name}/${node}/SKILL.md`, content })
        for (const ref of extractRefs(content)) allRefs.add(`${ref.category}/${ref.name}`)
      }
    }
  }

  // Resolve referenced resources
  for (const refKey of allRefs) {
    const [category, refName] = refKey.split('/', 2)
    if (category === 'nodes' || category === 'output') continue
    const content = await fetchLibraryFile(`${category}/${refName}.md`)
    if (content) {
      const relPath = `${category}/${refName}.md`
      if (!files.some(f => f.path === relPath)) {
        files.push({ path: relPath, content })
      }
    }
  }

  return { files }
}

/** Import a single resource from the library */
export async function importResource(type: string, name: string): Promise<{ files: { path: string; content: string }[] }> {
  const dir = type === 'hook' ? 'hooks' : type.endsWith('s') ? type : type + 's'
  const content = await fetchLibraryFile(`${dir}/${name}.md`) || await fetchLibraryFile(`${dir}/${name}.json`)
  if (!content) return { files: [] }
  const ext = content.startsWith('{') ? '.json' : '.md'
  return { files: [{ path: `${dir}/${name}${ext}`, content }] }
}
