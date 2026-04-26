/**
 * Library Manager.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { TAXONOMY_REGISTRY, CANONICAL_CATEGORIES } from '@agentflow/core/taxonomy'
import type { CategoryName } from '@agentflow/core/taxonomy'

interface LibraryEntry {
  name: string
  type: string
  path: string
  description: string
  tags: string[]
}

interface LibraryRegistry {
  version: string
  entries: LibraryEntry[]
  _libraryDir?: string
}

const DIR_TYPE_MAP: Record<string, string> = {
  workflows: 'workflow',
  ...Object.fromEntries(
    CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].dir, k]),
  ),
}

export function search(registry: LibraryRegistry, query: string): LibraryEntry[] {
  if (!registry?.entries) return []
  if (!query) return registry.entries
  const q = query.toLowerCase()
  return registry.entries.filter(entry => {
    const name = (entry.name || '').toLowerCase()
    const desc = (entry.description || '').toLowerCase()
    const tags = (entry.tags || []).map(t => t.toLowerCase())
    return name.includes(q) || desc.includes(q) || tags.some(t => t.includes(q))
  })
}

export function add(
  registry: LibraryRegistry,
  type: string,
  name: string,
  targetRoot: string,
): void {
  if (!registry?.entries) throw new Error('Library registry is invalid or empty')

  const entry = registry.entries.find(e => e.type === type && e.name === name)
  if (!entry) {
    const available = registry.entries.filter(e => e.type === type).map(e => e.name)
    const hint = available.length ? ` Available ${type}s: ${available.join(', ')}` : ` No ${type}s found in library.`
    throw new Error(`Resource "${name}" of type "${type}" not found in library.${hint}`)
  }

  const libraryDir = registry._libraryDir || path.resolve('library')
  const srcPath = path.resolve(libraryDir, entry.path)

  if (type === 'workflow') {
    fs.cpSync(srcPath, path.join(targetRoot, path.basename(entry.path)), { recursive: true })
  } else {
    const typeToDir = Object.fromEntries(
      CANONICAL_CATEGORIES.map(k => [k, TAXONOMY_REGISTRY[k].dir]),
    )
    const dirName = typeToDir[type as CategoryName] || type + 's'
    const destDir = path.join(targetRoot, dirName)
    fs.mkdirSync(destDir, { recursive: true })
    fs.cpSync(srcPath, path.join(destDir, path.basename(srcPath)))
  }
}

function extractFirstParagraph(content: string): string {
  const lines = content.split('\n')
  let collecting = false
  const parts: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!collecting && trimmed.startsWith('#')) continue
    if (!collecting && trimmed === '') continue
    collecting = true
    if (collecting && (trimmed === '' || trimmed.startsWith('#'))) break
    parts.push(trimmed)
  }
  return parts.join(' ')
}

function buildFileEntry(filePath: string, type: string, dirName: string): LibraryEntry {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data: fm, content } = matter(raw)
  return {
    name: (fm.name as string) || path.basename(filePath, '.md'),
    type,
    path: path.join(dirName, path.basename(filePath)),
    description: (fm.description as string) || extractFirstParagraph(content),
    tags: Array.isArray(fm.tags) ? fm.tags : [],
  }
}

function buildWorkflowEntry(wfDir: string, dirBasename: string, parentDirName: string): LibraryEntry {
  let name = dirBasename
  let description = ''
  let tags: string[] = []

  const candidates = fs.readdirSync(wfDir).filter(f => f.endsWith('.md'))
  const agentsMd = candidates.find(f => f.toLowerCase() === 'agents.md')
  const mdFile = agentsMd || candidates[0]

  if (mdFile) {
    const raw = fs.readFileSync(path.join(wfDir, mdFile), 'utf-8')
    const { data: fm, content } = matter(raw)
    if (fm.name) name = fm.name as string
    description = (fm.description as string) || extractFirstParagraph(content)
    if (Array.isArray(fm.tags)) tags = fm.tags
  }

  return { name, type: 'workflow', path: path.join(parentDirName, dirBasename), description, tags }
}

export function index(libraryDir: string): LibraryRegistry {
  const entries: LibraryEntry[] = []
  const absLib = path.resolve(libraryDir)

  for (const [dirName, type] of Object.entries(DIR_TYPE_MAP)) {
    const typeDir = path.join(absLib, dirName)
    if (!fs.existsSync(typeDir)) continue

    if (type === 'workflow') {
      const items = fs.readdirSync(typeDir, { withFileTypes: true })
      for (const item of items) {
        if (!item.isDirectory()) continue
        entries.push(buildWorkflowEntry(path.join(typeDir, item.name), item.name, dirName))
      }
    } else {
      const items = fs.readdirSync(typeDir, { withFileTypes: true })
      for (const item of items) {
        if (!item.isFile() || !item.name.endsWith('.md')) continue
        entries.push(buildFileEntry(path.join(typeDir, item.name), type, dirName))
      }
    }
  }

  const registry: LibraryRegistry = { version: '1.0.0', entries }
  registry._libraryDir = absLib
  return registry
}

export { DIR_TYPE_MAP }
