/**
 * AgentFlow Parser — Core utilities (browser-safe, zero Node.js deps).
 *
 * Skills with directory structure. Router inferred from edges.
 * AGENTS.md refs resolved for L0/L1 assembly.
 */

import yaml from 'js-yaml'
import {
  RESERVED_DIRS,
  RESOURCE_TYPE_MAP,
  RESOURCE_TYPE_TO_CATEGORY,
  DIR_TO_CATEGORY,
} from './taxonomy'
import type { CategoryName } from './taxonomy'
import { resolveSchemaKey } from './schemas/frontmatter-schemas'

// ── Types ──────────────────────────────────────────────────────────────

export interface Ref {
  raw: string
  semanticType: string
  category: string | null
  name: string | null
  condition?: string | null
  offset?: number
  line?: number
}

export interface ParsedFile {
  filePath: string
  relativePath: string
  frontmatter: Record<string, unknown>
  title: string
  content: string
  rawContent: string
  refs: Ref[]
  resourceType: string | null
}

export interface ParsedNode {
  id: string
  name: string
  description: string
  nodeType: string
  isRouter: boolean
  entry: boolean
  entryInferred: boolean
  primaryFile: ParsedFile
  contextFiles: ParsedFile[]
  allRefs: Ref[]
  frontmatter: Record<string, unknown>
  contextBudget?: unknown
  outputDeclarations?: unknown[]
}

export interface Edge {
  from: string
  to: string
  sourceRef: Ref
  condition?: string
}

export interface ParsedWorkflow {
  id: string
  dir: string
  name: string
  description: string
  descriptorFile: ParsedFile | null
  nodes: Record<string, ParsedNode>
  edges: Edge[]
  entryPoints: string[]
}

export interface SkillEntry {
  name: string
  description: string
  primaryFile: ParsedFile
  references: string[]
  scripts: string[]
  assets: string[]
}

export interface ResolvedRef {
  ref: Ref
  target: ParsedFile | ParsedNode | null
  resolvedBy: string
  matches?: ParsedFile[]
}

export interface ParsedGraph {
  rootDir: string
  descriptorFile: ParsedFile | undefined
  identity: unknown
  instructions: Record<string, ParsedFile>
  capabilities: Record<string, ParsedFile & { scope?: string, toolType?: string, command?: string, mcp?: string, package?: string, parameters?: unknown, builtinMapping?: string }>
  skills: Record<string, SkillEntry>
  memory: Record<string, ParsedFile>
  hooks: Record<string, unknown>
  customFiles: Record<string, ParsedFile>
  workflows: Record<string, ParsedWorkflow>
  allFiles: ParsedFile[]
  mcpServers: Record<string, unknown>
  mcpErrors: unknown[]
  resolvedIdentityRefs?: { workspace: Ref[], workflows: Record<string, Ref[]> }
}

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

interface RefPattern {
  name: string
  re: RegExp
  type: string
}

// ── Constants ──────────────────────────────────────────────────────────

export const WORKSPACE_EXTENSIONS = ['.md', '.json', '.yaml', '.yml']

export const NODE_TYPE_ALIASES = new Set(['step', 'sub-workflow'])

export const ARTIFACT_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'output', '.next',
  '__pycache__', '.venv', 'venv', '.cache', 'coverage',
])

export const REF_PATTERNS: RefPattern[] = [
  { name: 'conditional_edge', re: /\{\{->\s*([^|}]+?)\s*\|\s*([^}]+?)\s*\}\}/g, type: 'conditional_edge' },
  { name: 'edge',             re: /\{\{->\s*([^}]+?)\s*\}\}/g,                   type: 'edge' },
  { name: 'data_flow',        re: /\{\{<<\s*([^}]+?)\s*\}\}/g,                   type: 'data_flow' },
  { name: 'mention',          re: /\{\{([^}<>|]+?)\}\}/g,                         type: 'mention' },
]

export { RESERVED_DIRS, RESOURCE_TYPE_MAP }

// ── Ref parsing ────────────────────────────────────────────────────────

export function lineFromOffset(content: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++
  }
  return line
}

export function parseRef(token: string, type: string, groups?: string[]): Ref {
  const trimmed = token.trim()
  const ref: Ref = { raw: trimmed, semanticType: type, category: null, name: null, condition: null }

  if (type === 'conditional_edge' && groups) {
    const target = (groups[0] || '').trim()
    const cond = (groups[1] || '').trim()
    if (target.includes('/')) {
      const [c, n] = target.split('/', 2)
      ref.category = c
      ref.name = n
    } else {
      ref.category = 'nodes'
      ref.name = target
    }
    ref.condition = cond
    ref.semanticType = 'edge'
  } else if (type === 'data_flow') {
    ref.category = 'output'
    ref.name = trimmed
  } else {
    if (trimmed.includes('/')) {
      const [c, ...rest] = trimmed.split('/')
      ref.category = c
      ref.name = rest.join('/')
    } else {
      ref.name = trimmed
    }
  }
  return ref
}

export function extractRefs(content: string): Ref[] {
  if (!content) return []
  const refs: Ref[] = []
  const seen = new Set<string>()
  for (const pattern of REF_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(content)) !== null) {
      const key = `${pattern.type}:${match[0]}:${match.index}`
      if (seen.has(key)) continue
      seen.add(key)
      const groups = match.slice(1)
      const ref = parseRef(match[1] || match[0], pattern.type, groups)
      ref.offset = match.index
      ref.line = lineFromOffset(content, match.index)
      ref.raw = match[0].replace(/^\{\{|\}\}$/g, '').trim()
      refs.push(ref)
    }
  }
  refs.sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0))
  return refs
}

// ── Frontmatter ────────────────────────────────────────────────────────

export function parseFrontmatter(content: string): { data: Record<string, unknown>, content: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { data: {}, content }
  let data: Record<string, unknown> = {}
  try { data = (yaml.load(match[1]) as Record<string, unknown>) || {} } catch { /* invalid YAML */ }
  const body = content.slice(match[0].length).replace(/^\r?\n/, '')
  return { data, content: body }
}

// ── Classification ─────────────────────────────────────────────────────

export function classifyResource(file: ParsedFile, dirPath: string): string {
  const fm = file.frontmatter || {}
  // Classification chain: 1. frontmatter.type → resolveSchemaKey
  if (fm.type) {
    const key = resolveSchemaKey(fm.type as string)
    if (key) return fm.type as string
  }
  // 2. topDir in DIR_TO_CATEGORY
  if (!dirPath) return 'untyped'
  const topDir = dirPath.split('/')[0]
  if (DIR_TO_CATEGORY[topDir]) return topDir.replace(/s$/, '')
  // 3. filename is AGENTS.md
  const filename = (file.relativePath || '').split('/').pop()
  if (filename === 'AGENTS.md') return 'agents'
  // 4. otherwise
  return 'untyped'
}

export function identifyPrimaryFile(files: ParsedFile[]): ParsedFile {
  if (files.length === 0) throw new Error('identifyPrimaryFile called with empty files array')
  if (files.length === 1) return files[0]
  // SKILL.md first
  const skill = files.find(f => {
    const name = (f.relativePath || f.filePath || '').split('/').pop()
    return name === 'SKILL.md'
  })
  if (skill) return skill
  // main.md second
  const main = files.find(f => {
    const name = (f.relativePath || f.filePath || '').split('/').pop()
    return name === 'main.md'
  })
  if (main) return main
  // alphabetical
  return files.sort((a, b) =>
    (a.relativePath || a.filePath || '').localeCompare(b.relativePath || b.filePath || ''),
  )[0]
}

// ── Edge resolution ────────────────────────────────────────────────────

export function resolveEdgeTarget(ref: Ref, nodeIds: Set<string>): string | null {
  if (ref.category === 'nodes' && ref.name && nodeIds.has(ref.name)) return ref.name
  if (ref.name && nodeIds.has(ref.name)) return ref.name
  const bySlash = (ref.raw || '').split('/').pop()
  if (bySlash && nodeIds.has(bySlash)) return bySlash
  return null
}

// ── Markdown content parsing ───────────────────────────────────────────

export function parseMarkdownContent(
  rawContent: string,
  relativePath: string,
  mode: 'full' | 'metadata-only' = 'full',
): ParsedFile {
  let frontmatter: Record<string, unknown> = {}
  let body = rawContent
  try {
    const p = parseFrontmatter(rawContent)
    frontmatter = p.data || {}
    body = p.content
  } catch {
    frontmatter = {}
    body = rawContent
  }

  const basename = relativePath.split('/').pop() || relativePath
  let title = basename.replace(/\.md$/, '')
  const h = body.match(/^#\s+(.+)$/m)
  if (h) title = h[1].trim()

  const result: ParsedFile = {
    filePath: relativePath,
    relativePath: relativePath.replace(/\\/g, '/'),
    frontmatter, title, content: '', rawContent, refs: [],
    resourceType: null,
  }
  if (mode === 'metadata-only') return result
  result.content = body
  result.refs = extractRefs(body)
  return result
}

// ── parseFromFiles (browser-safe graph builder) ────────────────────────

export function parseFromFiles(
  fileMap: Record<string, string>,
  mode: 'full' | 'metadata-only' = 'full',
): ParsedGraph {
  const mdPaths = Object.keys(fileMap).filter(p => p.endsWith('.md')).sort()
  const jsonPaths = Object.keys(fileMap).filter(p => p.endsWith('.json')).sort()

  // 1. Parse all files
  const allFiles: ParsedFile[] = []
  for (const relPath of mdPaths) {
    const parsed = parseMarkdownContent(fileMap[relPath], relPath, mode)
    const dirPart = relPath.includes('/') ? relPath.split('/').slice(0, -1).join('/') : ''
    parsed.resourceType = classifyResource(parsed, dirPart)
    allFiles.push(parsed)
  }

  // 2. Categorize
  const instructions: Record<string, ParsedFile> = {}
  const capabilities: Record<string, ParsedFile & { scope?: string, toolType?: string, command?: string, mcp?: string, package?: string, parameters?: unknown, builtinMapping?: string }> = {}
  const memory: Record<string, ParsedFile> = {}
  const skills: Record<string, SkillEntry> = {}
  let descriptorFile: ParsedFile | undefined
  const reservedSet = new Set(RESERVED_DIRS)

  for (const file of allFiles) {
    const relDir = file.relativePath.includes('/')
      ? file.relativePath.split('/').slice(0, -1).join('/') : ''
    const isRootLevel = !relDir

    if (isRootLevel && !descriptorFile &&
      ((file.frontmatter && file.frontmatter.type === 'agents') ||
        file.relativePath.split('/').pop() === 'AGENTS.md')) {
      descriptorFile = file
    }

    const firstSegment = relDir ? file.relativePath.split('/')[0] : ''
    const categoryFromDir = firstSegment ? DIR_TO_CATEGORY[firstSegment] : undefined
    const parts = file.relativePath.split('/')
    const secondSegment = parts.length >= 3 ? parts[1] : ''
    const categoryFromWfDir = (!categoryFromDir && secondSegment) ? DIR_TO_CATEGORY[secondSegment] : undefined
    const categoryFromType = file.resourceType ? RESOURCE_TYPE_TO_CATEGORY[file.resourceType] : undefined
    const categoryName: CategoryName | undefined = categoryFromType || categoryFromDir || categoryFromWfDir
    if (!categoryName) continue

    const key = (file.frontmatter && file.frontmatter.name)
      ? file.frontmatter.name as string
      : (file.relativePath.split('/').pop() || '').replace(/\.md$/, '')

    if (categoryName === 'instructions') {
      instructions[key] = file
    } else if (categoryName === 'capabilities') {
      const fm = file.frontmatter || {}
      capabilities[key] = {
        ...file,
        toolType: (fm.type as string) || 'builtin',
        command: fm.command as string | undefined,
        mcp: fm.mcp as string | undefined,
        package: fm.package as string | undefined,
        parameters: fm.parameters,
        builtinMapping: fm.builtin_mapping as string | undefined,
      }
    } else if (categoryName === 'memory') {
      memory[key] = file
    }
  }

  // 2b. Skills — directory-style detection
  const skillsDirFiles = allFiles.filter(f => {
    const parts = f.relativePath.split('/')
    return parts[0] === 'skills' && parts.length >= 3
  })
  const skillDirs = new Set<string>()
  for (const f of skillsDirFiles) {
    skillDirs.add(f.relativePath.split('/')[1])
  }
  for (const skillId of skillDirs) {
    const prefix = `skills/${skillId}/`
    const filesInSkill = skillsDirFiles.filter(f => f.relativePath.startsWith(prefix))
    const primaryFile = filesInSkill.find(f =>
      f.relativePath.split('/').pop() === 'SKILL.md',
    )
    if (!primaryFile) continue
    const fm = primaryFile.frontmatter || {}
    const references: string[] = []
    const scripts: string[] = []
    const assets: string[] = []
    // Also gather non-md files from fileMap
    const allSkillPaths = Object.keys(fileMap).filter(p => p.startsWith(prefix))
    for (const p of allSkillPaths) {
      const rel = p.slice(prefix.length)
      if (rel.startsWith('references/')) references.push(rel)
      else if (rel.startsWith('scripts/')) scripts.push(rel)
      else if (rel.startsWith('assets/')) assets.push(rel)
    }
    skills[skillId] = {
      name: (fm.name as string) || skillId,
      description: (fm.description as string) || '',
      primaryFile,
      references,
      scripts,
      assets,
    }
  }

  // 3. Workflows (by path grouping)
  const workflows: Record<string, ParsedWorkflow> = {}
  const topDirs = new Set<string>()
  for (const p of mdPaths) {
    const seg = p.split('/')[0]
    if (p.split('/').length >= 2 && !reservedSet.has(seg) &&
        !ARTIFACT_DIRS.has(seg) && !seg.startsWith('.')) {
      topDirs.add(seg)
    }
  }

  for (const wfId of topDirs) {
    const wfFiles = mdPaths.filter(p => p.startsWith(wfId + '/'))
    const hasDescriptor = wfFiles.some(p =>
      p === wfId + '/AGENTS.md' ||
      (fileMap[p] && /type:\s*agents/.test(
        (fileMap[p].match(/^---\n([\s\S]*?)\n---/) || [])[1] || '')))
    const hasNodeDirs = wfFiles.some(p => p.split('/').length >= 3)
    if (!hasDescriptor && !hasNodeDirs) continue

    let wfDescriptor: ParsedFile | undefined
    const nodes: Record<string, ParsedNode> = {}
    const nodeDirSet = new Set<string>()

    for (const p of wfFiles) {
      const rel = p.slice(wfId.length + 1)
      const relParts = rel.split('/')
      if (relParts.length === 1) {
        const parsed = allFiles.find(f => f.relativePath === p)
        if (parsed && (rel === 'AGENTS.md' ||
          (parsed.frontmatter && parsed.frontmatter.type === 'agents'))) {
          wfDescriptor = parsed
        }
      } else if (relParts.length >= 2) {
        nodeDirSet.add(relParts[0])
      }
    }

    for (const nodeId of nodeDirSet) {
      if (reservedSet.has(nodeId)) continue
      const nodePrefix = wfId + '/' + nodeId + '/'
      const parsedNodeFiles = wfFiles
        .filter(p => p.startsWith(nodePrefix))
        .map(p => allFiles.find(f => f.relativePath === p))
        .filter((f): f is ParsedFile => Boolean(f))
      if (!parsedNodeFiles.length) continue

      let primaryFile: ParsedFile
      try { primaryFile = identifyPrimaryFile(parsedNodeFiles) }
      catch { primaryFile = parsedNodeFiles[0] }
      const contextFiles = parsedNodeFiles.filter(f => f !== primaryFile)
      const fm = primaryFile.frontmatter || {}
      const nodeRefs: Ref[] = []
      for (const f of parsedNodeFiles) nodeRefs.push(...(f.refs || []))

      nodes[nodeId] = {
        id: nodeId,
        name: (fm.name as string) || nodeId,
        description: (fm.description as string) || '',
        nodeType: fm.type && NODE_TYPE_ALIASES.has(fm.type as string) ? fm.type as string : 'step',
        isRouter: false,
        entry: fm.entry === true,
        entryInferred: false,
        primaryFile, contextFiles,
        allRefs: nodeRefs,
        frontmatter: fm,
        contextBudget: fm.context && (fm.context as Record<string, unknown>).max_tokens
          ? (fm.context as Record<string, unknown>).max_tokens : undefined,
        outputDeclarations: (fm.outputs as unknown[]) || undefined,
      }
    }

    // Edges
    const edges: Edge[] = []
    const nodeIds = new Set(Object.keys(nodes))
    for (const nid of nodeIds) {
      for (const ref of nodes[nid].allRefs) {
        if (ref.semanticType !== 'edge') continue
        const targetId = resolveEdgeTarget(ref, nodeIds)
        if (targetId) {
          const e: Edge = { from: nid, to: targetId, sourceRef: ref }
          if (ref.condition) e.condition = ref.condition
          edges.push(e)
        }
      }
    }

    // Router inference: nodes with conditional outgoing edges
    const routerNodeIds = new Set<string>()
    for (const e of edges) {
      if (e.condition) routerNodeIds.add(e.from)
    }
    for (const rid of routerNodeIds) {
      if (nodes[rid]) nodes[rid].isRouter = true
    }

    // Entry points
    let entryPoints = Object.keys(nodes).filter(id => nodes[id].entry === true)
    if (!entryPoints.length && wfDescriptor) {
      for (const ref of (wfDescriptor.refs || [])) {
        const t = resolveEdgeTarget(ref, nodeIds)
        if (t && !entryPoints.includes(t)) entryPoints.push(t)
      }
    }
    if (!entryPoints.length) {
      const targets = new Set(edges.map(e => e.to))
      const roots = [...nodeIds].filter(id => !targets.has(id))
      if (roots.length === 1) {
        entryPoints = roots
        nodes[roots[0]].entry = true
        nodes[roots[0]].entryInferred = true
      }
    }

    const wfFm = wfDescriptor ? (wfDescriptor.frontmatter || {}) : {}
    workflows[wfId] = {
      id: wfId, dir: wfId,
      name: (wfFm.name as string) || wfId,
      description: (wfFm.description as string) || '',
      descriptorFile: wfDescriptor || null,
      nodes, edges, entryPoints,
    }
  }

  // 4. Custom files
  const categorizedPaths = new Set<string>()
  for (const k of Object.keys(instructions)) categorizedPaths.add(instructions[k].relativePath)
  for (const k of Object.keys(capabilities)) categorizedPaths.add(capabilities[k].relativePath)
  for (const k of Object.keys(memory)) categorizedPaths.add(memory[k].relativePath)
  for (const s of Object.values(skills)) categorizedPaths.add(s.primaryFile.relativePath)
  if (descriptorFile) categorizedPaths.add(descriptorFile.relativePath)
  for (const wf of Object.values(workflows)) {
    if (wf.descriptorFile) categorizedPaths.add(wf.descriptorFile.relativePath)
    for (const node of Object.values(wf.nodes || {})) {
      if (node.primaryFile) categorizedPaths.add(node.primaryFile.relativePath)
      for (const cf of node.contextFiles || []) categorizedPaths.add(cf.relativePath)
    }
  }
  const customFiles: Record<string, ParsedFile> = {}
  for (const file of allFiles) {
    if (!categorizedPaths.has(file.relativePath)) {
      const key = file.relativePath.endsWith('.md')
        ? file.relativePath.slice(0, -3) : file.relativePath
      if (!file.resourceType || file.resourceType === 'untyped') file.resourceType = 'untyped'
      customFiles[key] = file
    }
  }

  // 5. Hooks (JSON)
  const hooks: Record<string, unknown> = {}
  for (const p of jsonPaths) {
    const segments = p.split('/')
    const isRootHook = segments[0] === 'hooks'
    const isWfHook = segments.length >= 3 && segments[1] === 'hooks'
    if (!isRootHook && !isWfHook) continue
    try {
      hooks[segments[segments.length - 1].replace(/\.json$/, '')] = JSON.parse(fileMap[p])
    } catch { /* skip */ }
  }

  // 6. Identity
  let identity: unknown
  if (descriptorFile?.frontmatter?.identity) {
    identity = descriptorFile.frontmatter.identity
  }

  // 7. AGENTS.md ref resolution for L0/L1 assembly
  const resolvedIdentityRefs: { workspace: Ref[], workflows: Record<string, Ref[]> } = {
    workspace: [],
    workflows: {},
  }
  if (descriptorFile) {
    resolvedIdentityRefs.workspace = (descriptorFile.refs || []).filter(
      r => r.semanticType === 'mention',
    )
  }
  for (const [wfId, wf] of Object.entries(workflows)) {
    if (wf.descriptorFile) {
      resolvedIdentityRefs.workflows[wfId] = (wf.descriptorFile.refs || []).filter(
        r => r.semanticType === 'mention',
      )
    }
  }

  return {
    rootDir: '.', descriptorFile, identity,
    instructions, capabilities, skills, memory,
    hooks, customFiles, workflows, allFiles,
    mcpServers: {}, mcpErrors: [],
    resolvedIdentityRefs,
  }
}

// ── Tree builder ───────────────────────────────────────────────────────

export function buildTreeFromPaths(paths: string[]): TreeNode {
  const root: TreeNode = { name: '.', path: '.', type: 'directory', children: [] }
  const dirs: Record<string, TreeNode> = { '.': root }
  for (const p of paths.sort()) {
    const parts = p.split('/')
    let current = root
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/')
      if (!dirs[dirPath]) {
        const dir: TreeNode = { name: parts[i], path: dirPath, type: 'directory', children: [] }
        dirs[dirPath] = dir
        current.children!.push(dir)
      }
      current = dirs[dirPath]
    }
    current.children!.push({ name: parts[parts.length - 1], path: p, type: 'file' })
  }
  return root
}

// ── Ref resolution ─────────────────────────────────────────────────────

export function resolveRef(ref: Ref, graph: ParsedGraph): ResolvedRef | null {
  if (!ref || !graph) return null

  if (ref.semanticType === 'data_flow') {
    let nodeName = ref.name || ''
    if (nodeName.startsWith('output.')) nodeName = nodeName.slice(7)
    for (const wfKey of Object.keys(graph.workflows || {})) {
      const nodes = graph.workflows[wfKey].nodes || {}
      for (const nodeKey of Object.keys(nodes)) {
        const node = nodes[nodeKey]
        if (node.id === nodeName || node.name === nodeName) {
          return { ref, target: node as unknown as ParsedFile, resolvedBy: 'path' }
        }
      }
    }
    return null
  }

  const namePart = ref.name || ''
  const categoryPart = ref.category || ''
  let refPath = namePart ? categoryPart + '/' + namePart : categoryPart
  if (!refPath.endsWith('.md')) refPath += '.md'
  const normalizedRefPath = refPath.replace(/\\/g, '/')
  const allFiles = graph.allFiles || []
  const pathMatch = allFiles.find(f => (f.relativePath || '').replace(/\\/g, '/') === normalizedRefPath)
  if (pathMatch) return { ref, target: pathMatch, resolvedBy: 'path' }

  const searchName = ref.name || ref.category
  const nameMatches = allFiles.filter(f => (f.frontmatter || {}).name === searchName)
  if (nameMatches.length === 1) return { ref, target: nameMatches[0], resolvedBy: 'name' }
  if (nameMatches.length > 1) return { ref, target: null, resolvedBy: 'ambiguous', matches: nameMatches }
  return null
}
