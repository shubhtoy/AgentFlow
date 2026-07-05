/**
 * AgentFlow CLI Parser.
 *
 * Imports ALL shared logic from @agentflow/core/parser-core.
 * Only keeps fs-walking: parseNode, parseWorkflow, parseRoot.
 */

import fsSync from 'fs'
import fs from 'fs/promises'
import path from 'path'
import {
  parseFrontmatter,
  parseMarkdownContent,
  classifyResource,
  identifyPrimaryFile,
  resolveEdgeTarget,
  extractRefs,
  parseFromFiles,
  resolveRef,
  buildTreeFromPaths,
  NODE_TYPE_ALIASES,
  WORKSPACE_EXTENSIONS,
  ARTIFACT_DIRS,
  REF_PATTERNS,
  RESERVED_DIRS,
  RESOURCE_TYPE_MAP,
} from '@agentflow/core/parser-core'
import type {
  ParsedFile,
  ParsedNode,
  ParsedWorkflow,
  ParsedGraph,
  SkillEntry,
  Edge,
  Ref,
} from '@agentflow/core/parser-core'
import { DIR_TO_CATEGORY, RESOURCE_TYPE_TO_CATEGORY } from '@agentflow/core/taxonomy'
import type { CategoryName } from '@agentflow/core/taxonomy'
import { loadMcpConfig } from './mcp/config-manager'

async function readFile(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8')
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

async function subdirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries.filter(e => e.isDirectory()).map(e => e.name)
}

// ── parseNode ──────────────────────────────────────────────────────────

export async function parseNode(dirPath: string, workflowRoot: string): Promise<ParsedNode> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const mdFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)
    .sort()
  if (!mdFiles.length) throw new Error(`No .md files in node directory: ${dirPath}`)

  const artifacts: { name: string; filename: string; relativePath: string }[] = []
  if (entries.some(e => e.isDirectory() && e.name === 'output')) {
    try {
      for (const f of await fs.readdir(path.join(dirPath, 'output'))) {
        if (WORKSPACE_EXTENSIONS.some(ext => f.endsWith(ext)) || f.endsWith('.txt'))
          artifacts.push({
            name: path.basename(f, path.extname(f)),
            filename: f,
            relativePath: path.relative(workflowRoot, path.join(dirPath, 'output', f)).replace(/\\/g, '/'),
          })
      }
    } catch {
      /* skip */
    }
  }

  const relDir = path.relative(workflowRoot, dirPath)
  const parsedFiles: ParsedFile[] = []
  for (const name of mdFiles) {
    const raw = await readFile(path.join(dirPath, name))
    if (!raw) continue
    const relPath = path.relative(workflowRoot, path.join(dirPath, name))
    const p = parseMarkdownContent(raw, relPath, 'full')
    p.filePath = path.join(dirPath, name)
    p.resourceType = classifyResource(p, relDir)
    parsedFiles.push(p)
  }
  if (!parsedFiles.length) throw new Error(`No parseable .md files in: ${dirPath}`)

  const primaryFile = identifyPrimaryFile(parsedFiles)
  const fm = primaryFile.frontmatter || {}
  const allRefs: Ref[] = []
  for (const f of parsedFiles) allRefs.push(...f.refs)

  return {
    id: relDir || path.basename(dirPath),
    name: (fm.name as string) || primaryFile.title,
    description: (fm.description as string) || '',
    nodeType: fm.type && NODE_TYPE_ALIASES.has(fm.type as string) ? (fm.type as string) : 'step',
    isRouter: false,
    entry: fm.entry === true,
    entryInferred: false,
    primaryFile,
    contextFiles: parsedFiles.filter(f => f !== primaryFile),
    allRefs,
    frontmatter: fm,
    contextBudget: fm.context,
    outputDeclarations: fm.outputs as unknown[] | undefined,
  }
}

// ── parseWorkflow ──────────────────────────────────────────────────────

export async function parseWorkflow(
  workflowDir: string,
  mode: 'full' | 'metadata-only' = 'full',
): Promise<ParsedWorkflow> {
  const entries = await fs.readdir(workflowDir, { withFileTypes: true })
  const reservedSet = new Set(RESERVED_DIRS)

  // Find descriptor
  let descriptorFile: ParsedFile | null = null
  for (const name of entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)
    .sort()) {
    const raw = await readFile(path.join(workflowDir, name))
    if (!raw) continue
    const p = parseMarkdownContent(raw, path.relative(workflowDir, path.join(workflowDir, name)), mode)
    p.filePath = path.join(workflowDir, name)
    p.resourceType = classifyResource(p, '')
    if (p.frontmatter?.type === 'agents' || name === 'AGENTS.md') {
      descriptorFile = p
      break
    }
  }

  // Parse node directories
  const nodeDirs: string[] = []
  for (const e of entries) {
    if (!e.isDirectory() || reservedSet.has(e.name) || ARTIFACT_DIRS.has(e.name)) continue
    try {
      if ((await fs.readdir(path.join(workflowDir, e.name))).some(f => f.endsWith('.md'))) nodeDirs.push(e.name)
    } catch {
      continue
    }
  }
  nodeDirs.sort()

  const nodes: Record<string, ParsedNode> = {}
  for (const d of nodeDirs) {
    const node = await parseNode(path.join(workflowDir, d), workflowDir)
    nodes[node.id] = node
    if (node.nodeType === 'sub-workflow')
      (node as ParsedNode & { subWorkflow?: ParsedWorkflow }).subWorkflow = await parseWorkflow(
        path.join(workflowDir, d),
        mode,
      )
  }

  // Edges + router inference
  const edges: Edge[] = []
  const nodeIds = new Set(Object.keys(nodes))
  for (const nid of nodeIds) {
    for (const ref of nodes[nid].allRefs) {
      if (ref.semanticType !== 'edge') continue
      const tid = resolveEdgeTarget(ref, nodeIds)
      if (tid) {
        const e: Edge = { from: nid, to: tid, sourceRef: ref }
        if (ref.condition) e.condition = ref.condition
        edges.push(e)
      }
    }
  }
  for (const e of edges) {
    if (e.condition && nodes[e.from]) nodes[e.from].isRouter = true
  }

  // Entry points
  let entryPoints = Object.keys(nodes).filter(id => nodes[id].entry)
  if (!entryPoints.length && descriptorFile) {
    for (const ref of descriptorFile.refs || []) {
      const t = resolveEdgeTarget(ref, nodeIds)
      if (t && !entryPoints.includes(t)) entryPoints.push(t)
    }
  }
  if (!entryPoints.length) {
    const targets = new Set(edges.map(e => e.to))
    for (const nid of nodeIds) {
      if (!targets.has(nid)) {
        entryPoints.push(nid)
        nodes[nid].entryInferred = true
      }
    }
  }

  const fm = descriptorFile?.frontmatter || {}
  return {
    id: path.basename(workflowDir),
    name: (fm.name as string) || descriptorFile?.title || path.basename(workflowDir),
    description: (fm.description as string) || '',
    dir: workflowDir,
    descriptorFile,
    nodes,
    edges,
    entryPoints,
  }
}

// ── parseRoot ──────────────────────────────────────────────────────────

export async function parseRoot(rootDir: string, mode: 'full' | 'metadata-only' = 'full'): Promise<ParsedGraph> {
  const { glob } = await import('glob')
  const mdPaths = (await glob('**/*.md', { cwd: rootDir, nodir: true })).sort()
  const reservedSet = new Set(RESERVED_DIRS)

  // Parse all files
  const allFiles: ParsedFile[] = []
  for (const relPath of mdPaths) {
    const raw = await readFile(path.join(rootDir, relPath))
    if (!raw) continue
    const p = parseMarkdownContent(raw, relPath.replace(/\\/g, '/'), mode)
    p.filePath = path.join(rootDir, relPath)
    const dirPart = path.dirname(relPath).replace(/\\/g, '/')
    p.resourceType = classifyResource(p, dirPart === '.' ? '' : dirPart)
    allFiles.push(p)
  }

  // Categorize
  const instructions: Record<string, ParsedFile> = {}
  const capabilities: Record<string, ParsedFile> = {}
  const memory: Record<string, ParsedFile> = {}
  let descriptorFile: ParsedFile | undefined

  for (const file of allFiles) {
    const relDir = path.dirname(file.relativePath)
    const isRoot = relDir === '.' || relDir === ''
    if (
      isRoot &&
      !descriptorFile &&
      (file.frontmatter?.type === 'agents' || path.basename(file.filePath) === 'AGENTS.md')
    )
      descriptorFile = file

    const seg = relDir === '.' || relDir === '' ? '' : file.relativePath.split('/')[0]
    const cat: CategoryName | undefined =
      (file.resourceType ? RESOURCE_TYPE_TO_CATEGORY[file.resourceType] : undefined) ||
      (seg ? DIR_TO_CATEGORY[seg] : undefined)
    if (!cat) continue
    const key = (file.frontmatter?.name as string) || path.basename(file.filePath, '.md')
    if (cat === 'instructions') instructions[key] = file
    else if (cat === 'capabilities') {
      const fm = file.frontmatter || {}
      capabilities[key] = {
        ...file,
        toolType: (fm.type as string) || 'builtin',
        command: fm.command,
        mcp: fm.mcp,
        package: fm.package,
        parameters: fm.parameters,
        builtinMapping: fm.builtin_mapping,
      } as ParsedFile & Record<string, unknown>
    } else if (cat === 'memory') memory[key] = file
  }

  // Skills
  const skills: Record<string, SkillEntry> = {}
  try {
    for (const skillId of await subdirs(path.join(rootDir, 'skills'))) {
      const raw = await readFile(path.join(rootDir, 'skills', skillId, 'SKILL.md'))
      if (!raw) continue
      const pf = parseMarkdownContent(raw, `skills/${skillId}/SKILL.md`, mode)
      pf.filePath = path.join(rootDir, 'skills', skillId, 'SKILL.md')
      const fm = pf.frontmatter || {}
      const refs: string[] = [],
        scripts: string[] = [],
        assets: string[] = []
      for (const sub of ['references', 'scripts', 'assets']) {
        try {
          for (const f of await fs.readdir(path.join(rootDir, 'skills', skillId, sub)))
            (sub === 'references' ? refs : sub === 'scripts' ? scripts : assets).push(`${sub}/${f}`)
        } catch {
          /* skip */
        }
      }
      skills[skillId] = {
        name: (fm.name as string) || skillId,
        description: (fm.description as string) || '',
        primaryFile: pf,
        references: refs,
        scripts,
        assets,
      }
    }
  } catch {
    /* skills/ doesn't exist */
  }

  // Workflows
  const workflows: Record<string, ParsedWorkflow> = {}
  try {
    for (const entry of fsSync.readdirSync(rootDir, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        reservedSet.has(entry.name) ||
        ARTIFACT_DIRS.has(entry.name) ||
        entry.name.startsWith('.')
      )
        continue
      const dp = path.join(rootDir, entry.name)
      let isWf = false
      try {
        const subs = fsSync.readdirSync(dp, { withFileTypes: true })
        for (const s of subs) {
          if (s.isFile() && s.name === 'AGENTS.md') {
            isWf = true
            break
          }
          if (s.isFile() && s.name.endsWith('.md')) {
            try {
              const c = fsSync.readFileSync(path.join(dp, s.name), 'utf8')
              if (/^---\n[\s\S]*?type:\s*agents/.test(c)) {
                isWf = true
                break
              }
            } catch {
              /* skip */
            }
          }
        }
        if (!isWf)
          for (const s of subs) {
            if (!s.isDirectory() || reservedSet.has(s.name)) continue
            try {
              if (fsSync.readdirSync(path.join(dp, s.name)).some(f => f.endsWith('.md'))) {
                isWf = true
                break
              }
            } catch {
              /* skip */
            }
          }
      } catch {
        continue
      }
      if (isWf) workflows[entry.name] = await parseWorkflow(dp, mode)
    }
  } catch {
    /* skip */
  }

  // Custom files
  const catPaths = new Set<string>()
  for (const m of [instructions, capabilities, memory]) for (const v of Object.values(m)) catPaths.add(v.relativePath)
  for (const s of Object.values(skills)) catPaths.add(s.primaryFile.relativePath)
  if (descriptorFile) catPaths.add(descriptorFile.relativePath)
  for (const wf of Object.values(workflows)) {
    const wr = path.relative(rootDir, wf.dir).replace(/\\/g, '/')
    if (wf.descriptorFile)
      catPaths.add(wr ? `${wr}/${wf.descriptorFile.relativePath.replace(/\\/g, '/')}` : wf.descriptorFile.relativePath)
    for (const n of Object.values(wf.nodes || {})) {
      if (n.primaryFile)
        catPaths.add(wr ? `${wr}/${n.primaryFile.relativePath.replace(/\\/g, '/')}` : n.primaryFile.relativePath)
      for (const cf of n.contextFiles || [])
        catPaths.add(wr ? `${wr}/${cf.relativePath.replace(/\\/g, '/')}` : cf.relativePath)
    }
  }
  const customFiles: Record<string, ParsedFile> = {}
  for (const f of allFiles) {
    if (!catPaths.has(f.relativePath)) {
      const k = f.relativePath.endsWith('.md') ? f.relativePath.slice(0, -3) : f.relativePath
      if (!f.resourceType || f.resourceType === 'untyped') f.resourceType = 'untyped'
      customFiles[k] = f
    }
  }

  // Hooks
  const hooks: Record<string, unknown> = {}
  try {
    for (const e of await fs.readdir(path.join(rootDir, 'hooks'), { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.json')) continue
      try {
        hooks[path.basename(e.name, '.json')] = JSON.parse(
          await fs.readFile(path.join(rootDir, 'hooks', e.name), 'utf-8'),
        )
      } catch {
        /* skip */
      }
    }
  } catch {
    /* hooks/ doesn't exist */
  }

  const mcpConfig = loadMcpConfig(rootDir)

  return {
    rootDir,
    descriptorFile,
    identity: descriptorFile?.frontmatter?.identity,
    instructions,
    capabilities,
    skills,
    memory,
    hooks,
    customFiles,
    workflows,
    allFiles,
    mcpServers: mcpConfig.servers,
    mcpErrors: mcpConfig.errors,
  }
}

// ── Re-exports ─────────────────────────────────────────────────────────

/**
 * Read a markdown file from disk and parse it via `parseMarkdownContent`.
 * Returns null if the file cannot be read (missing, permission error, etc.).
 * Single source of truth for fs+parse glue — reused by repo-scanner and
 * workflow-service instead of each keeping a private copy.
 */
export function parseMarkdownFile(filePath: string, mode: 'full' | 'metadata-only' = 'full'): ParsedFile | null {
  try {
    const raw = fsSync.readFileSync(filePath, 'utf-8')
    return parseMarkdownContent(raw, filePath, mode)
  } catch {
    return null
  }
}

export {
  parseFrontmatter,
  parseMarkdownContent,
  classifyResource,
  identifyPrimaryFile,
  resolveEdgeTarget,
  extractRefs,
  parseFromFiles,
  resolveRef,
  buildTreeFromPaths,
  NODE_TYPE_ALIASES,
  WORKSPACE_EXTENSIONS,
  ARTIFACT_DIRS,
  REF_PATTERNS,
  RESERVED_DIRS,
  RESOURCE_TYPE_MAP,
}

export type { ParsedFile, ParsedNode, ParsedWorkflow, ParsedGraph, SkillEntry, Edge, Ref }

export { toRelativePath, rewriteRefsToPaths, resolveRefsToPaths } from '@agentflow/core/ref-paths'
export type { RefResolution, RewriteResult, GraphRewriteResult } from '@agentflow/core/ref-paths'
