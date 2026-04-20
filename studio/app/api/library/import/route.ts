export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')

/** Extract {{category/name}} refs from markdown content, including conditions from edge refs */
function extractRefs(content: string): { category: string; name: string }[] {
  const refs: { category: string; name: string }[] = []
  const seen = new Set<string>()

  function addRef(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed.includes('/')) return
    const [category, name] = trimmed.split('/', 2)
    const cleanName = name.split('|')[0].trim() // strip condition part
    const key = `${category}/${cleanName}`
    if (!seen.has(key)) { seen.add(key); refs.push({ category, name: cleanName }) }
  }

  // Match all {{...}} tokens
  const re = /\{\{([^}]+)\}\}/g
  let m
  while ((m = re.exec(content)) !== null) {
    let inner = m[1].trim()
    // Strip edge prefixes
    if (inner.startsWith('->')) inner = inner.slice(2).trim()
    else if (inner.startsWith('<<')) inner = inner.slice(2).trim()

    // Check for condition: "nodes/target | runbooks/condition"
    if (inner.includes('|')) {
      const parts = inner.split('|')
      for (const part of parts) addRef(part)
    } else {
      addRef(inner)
    }
  }
  return refs
}

/** Try to find a library resource file */
function findLibraryFile(libraryDir: string, category: string, name: string): string | null {
  const candidates = [
    path.join(libraryDir, category, `${name}.md`),
    // singular form (e.g. "instruction" -> "instructions")
    path.join(libraryDir, category + 's', `${name}.md`),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  return null
}

export async function POST(req: NextRequest) {
  const { type, name } = await req.json()
  if (!type || !name) return NextResponse.json({ error: 'type and name required' }, { status: 400 })

  const libraryDir = path.join(process.cwd(), '..', 'library')

  // For workflows — return workflow files + all referenced resources
  if (type === 'workflow') {
    const wfDir = path.join(libraryDir, 'workflows', name)
    if (!fs.existsSync(wfDir)) {
      return NextResponse.json({ error: `Workflow "${name}" not found in library` }, { status: 404 })
    }

    const files: { path: string; content: string }[] = []
    const allRefs = new Set<string>()

    // Collect workflow files and extract refs
    const allFiles = glob.sync('**/*.{md,json}', { cwd: wfDir })
    for (const f of allFiles) {
      const content = fs.readFileSync(path.join(wfDir, f), 'utf8')
      files.push({ path: `${name}/${f}`, content })
      for (const ref of extractRefs(content)) {
        allRefs.add(`${ref.category}/${ref.name}`)
      }
    }

    // Resolve referenced resources from library
    for (const refKey of allRefs) {
      const [category, refName] = refKey.split('/', 2)

      // Handle workflows/ refs — import the entire workflow directory
      if (category === 'workflows') {
        const refWfDir = path.join(libraryDir, 'workflows', refName)
        if (fs.existsSync(refWfDir) && fs.statSync(refWfDir).isDirectory()) {
          const wfFiles = glob.sync('**/*.{md,json}', { cwd: refWfDir })
          for (const wf of wfFiles) {
            const wfPath = `${refName}/${wf}`
            if (!files.some(f => f.path === wfPath)) {
              files.push({ path: wfPath, content: fs.readFileSync(path.join(refWfDir, wf), 'utf8') })
            }
          }
        }
        continue
      }

      const libFile = findLibraryFile(libraryDir, category, refName)
      if (libFile) {
        const relPath = `${category}/${refName}.md`
        if (!files.some(f => f.path === relPath)) {
          files.push({ path: relPath, content: fs.readFileSync(libFile, 'utf8') })
        }
      }
    }

    return NextResponse.json({ files })
  }

  // For single resources
  const candidates = [
    path.join(libraryDir, type + 's', name + '.md'),
    path.join(libraryDir, type, name + '.md'),
    path.join(libraryDir, type + 's', name + '.json'),
    path.join(libraryDir, type, name + '.json'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      const ext = path.extname(p)
      const targetDir = type === 'hook' ? 'hooks' : type + 's'
      return NextResponse.json({
        files: [{ path: `${targetDir}/${name}${ext}`, content: fs.readFileSync(p, 'utf8') }],
      })
    }
  }

  return NextResponse.json({ error: `"${name}" not found in library` }, { status: 404 })
}
