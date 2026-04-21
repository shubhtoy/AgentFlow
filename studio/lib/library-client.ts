/**
 * Client-side library import — fetches files from /library/ static assets.
 * No server needed.
 */

const BASE = '/library'

async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/${path}`)
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

/** Extract resource refs like {{capabilities/read-code}} from content */
function extractRefs(content: string): { category: string; name: string }[] {
  const refs: { category: string; name: string }[] = []
  const seen = new Set<string>()
  const re = /\{\{([^}]+)\}\}/g
  let m
  while ((m = re.exec(content)) !== null) {
    let inner = m[1].trim()
    // Strip edge prefixes
    if (inner.startsWith('->')) inner = inner.slice(2).trim()
    else if (inner.startsWith('<<')) continue // output refs, skip
    // Handle conditions: "nodes/target | runbooks/condition"
    const parts = inner.includes('|') ? inner.split('|') : [inner]
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed.includes('/')) continue
      const [category, name] = trimmed.split('/', 2)
      if (category === 'nodes' || category === 'output') continue
      const cleanName = name.split('|')[0].trim()
      const key = `${category}/${cleanName}`
      if (!seen.has(key)) { seen.add(key); refs.push({ category, name: cleanName }) }
    }
  }
  return refs
}

/** Import a workflow — fetches all workflow files + referenced resources */
export async function importWorkflow(name: string): Promise<{ files: { path: string; content: string }[] }> {
  const manifest = await fetchText(`workflows/${name}/manifest.txt`)
  if (!manifest) return { files: [] }

  const filePaths = manifest.trim().split('\n').filter(Boolean)
  const files: { path: string; content: string }[] = []
  const allRefs = new Set<string>()

  // Fetch all workflow files
  await Promise.all(filePaths.map(async (fp) => {
    const content = await fetchText(`workflows/${name}/${fp}`)
    if (content) {
      files.push({ path: `${name}/${fp}`, content })
      for (const ref of extractRefs(content)) allRefs.add(`${ref.category}/${ref.name}`)
    }
  }))

  // Fetch referenced resources
  await Promise.all(Array.from(allRefs).map(async (refKey) => {
    const [category, refName] = refKey.split('/', 2)
    if (category === 'workflows') {
      // Sub-workflow — fetch its manifest too
      const subManifest = await fetchText(`workflows/${refName}/manifest.txt`)
      if (subManifest) {
        await Promise.all(subManifest.trim().split('\n').filter(Boolean).map(async (fp) => {
          const content = await fetchText(`workflows/${refName}/${fp}`)
          if (content && !files.some(f => f.path === `${refName}/${fp}`)) {
            files.push({ path: `${refName}/${fp}`, content })
          }
        }))
      }
      return
    }
    const path = `${category}/${refName}.md`
    if (files.some(f => f.path === path)) return
    const content = await fetchText(path) || await fetchText(`${category}/${refName}.json`)
    if (content) {
      const ext = content.trimStart().startsWith('{') ? '.json' : '.md'
      files.push({ path: `${category}/${refName}${ext}`, content })
    }
  }))

  return { files }
}

/** Import a single resource */
export async function importResource(type: string, name: string): Promise<{ files: { path: string; content: string }[] }> {
  const dir = type.endsWith('s') ? type : type + 's'
  const content = await fetchText(`${dir}/${name}.md`) || await fetchText(`${dir}/${name}.json`)
  if (!content) return { files: [] }
  const ext = content.trimStart().startsWith('{') ? '.json' : '.md'
  return { files: [{ path: `${dir}/${name}${ext}`, content }] }
}
