import type { WorkflowGraph, TreeNode, ExportBundle, ValidationResult, LibraryEntry, ExportOptions } from './types'
import { requireWorkspace, DEFAULT_AGENTS_MD } from './workspace'

// ── Types ──

export interface TokenFileStats {
  file?: string; tokens: number; chars: number; lines: number
  category?: string; name?: string; key?: string
}
export interface TokenNodeBreakdown {
  nodeId: string; total: number
  primary?: TokenFileStats | null; context?: TokenFileStats[]; refs?: TokenFileStats[]
}
export interface TokenResult {
  scope: string; workflowId?: string | null; nodeId?: string | null; total: number; error?: string
  descriptors?: TokenFileStats[]; nodes?: TokenNodeBreakdown[]
  workflows?: { workflowId: string; nodes: TokenNodeBreakdown[] }[]
  shared?: { total: number; categories: Record<string, TokenFileStats[]> } | null
  path?: string[] | null; filePath?: string; tokens?: number; chars?: number; lines?: number
}

// ── Workspace helper ──

export interface PlatformInfo {
  name: string; displayName: string; version: string
  capabilities: string[]; tier: string
}

const ensureWs = requireWorkspace

// ── Server fallback (git, export — things that need Node) ──

const BASE = '/api'
async function request<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, opts)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Parser ──

async function parseClientSide(files: { path: string; content: string }[]): Promise<WorkflowGraph> {
  if (!files.length) return { workflows: {}, instructions: {}, capabilities: {}, skills: {}, memory: {}, rootDir: '.' } as any
  const { parseFromFiles } = await import('@agentflow/core/parser-browser')
  const fileMap: Record<string, string> = {}
  for (const f of files) fileMap[f.path] = f.content
  const result = parseFromFiles(fileMap)
  ;(result as any)._rawFiles = fileMap
  return result as unknown as WorkflowGraph
}

// ── API ──

export const api = {
  // Core CRUD — all workspace-direct
  getData: async (): Promise<WorkflowGraph> => {
    const w = await ensureWs()
    let files = await w.readAll()
    if (files.length === 0) { await w.write('AGENTS.md', DEFAULT_AGENTS_MD); files = await w.readAll() }
    // Debug: log file categories
    const cats: Record<string, number> = {}
    for (const f of files) { const c = f.path.split('/')[0]; cats[c] = (cats[c] || 0) + 1 }
    console.log('[getData]', files.length, 'files:', JSON.stringify(cats))
    const result = parseClientSide(files)
    return result
  },

  save: async (edits: { path: string; content: string }[]): Promise<WorkflowGraph> => {
    const w = await ensureWs()
    for (const e of edits) await w.write(e.path, e.content)
    return api.getData()
  },

  create: async (path: string, content: string): Promise<WorkflowGraph> => {
    await (await ensureWs()).write(path, content)
    return api.getData()
  },

  del: async (path: string): Promise<WorkflowGraph> => {
    await (await ensureWs()).remove(path)
    return api.getData()
  },

  move: async (from: string, to: string): Promise<WorkflowGraph> => {
    await (await ensureWs()).move(from, to)
    return api.getData()
  },

  getTree: async (): Promise<TreeNode> => {
    const { buildTreeFromPaths } = await import('./workspace/browser-adapter')
    return buildTreeFromPaths(await (await ensureWs()).list())
  },

  // Validation — client-side
  validate: async (options?: { strict?: boolean }): Promise<ValidationResult> => {
    const { validate } = await import('@agentflow/core/validator')
    return validate(await api.getData() as any, options)
  },

  // Library — static project-level catalog (not workspace data)
  getLibrary: async (): Promise<{ version: string; entries: LibraryEntry[] }> => {
    // Library is served as static assets — use library-client.ts for imports
    return { version: '0.0.0', entries: [] }
  },

  // Hooks — workspace JSON files
  getHooks: async (): Promise<{ hooks: any[] }> => {
    const w = await ensureWs()
    const paths = await w.list()
    const hooks = []
    for (const p of paths.filter(p => p.startsWith('hooks/') && p.endsWith('.json'))) {
      try { hooks.push(JSON.parse(await w.read(p))) } catch { /* skip */ }
    }
    return { hooks }
  },

  getEventTypes: async (): Promise<{ eventTypes: string[] }> => ({
    eventTypes: [
      'fileEdited', 'fileCreated', 'fileDeleted', 'preToolUse', 'postToolUse',
      'workflowStarted', 'workflowCompleted', 'workflowFailed',
      'nodeEntered', 'nodeCompleted', 'memoryUpdated', 'protocolToggled',
    ]
  }),

  saveHook: async (hook: any): Promise<void> => {
    await (await ensureWs()).write(`hooks/${hook.name}.json`, JSON.stringify(hook, null, 2))
  },

  updateHook: async (name: string, changes: any): Promise<void> => {
    const w = await ensureWs()
    const existing = JSON.parse(await w.read(`hooks/${name}.json`))
    await w.write(`hooks/${name}.json`, JSON.stringify({ ...existing, ...changes, name }, null, 2))
  },

  deleteHook: async (name: string): Promise<void> => {
    await (await ensureWs()).remove(`hooks/${name}.json`)
  },

  // Brand — workspace config
  getBrand: async (): Promise<{ name?: string; theme?: any } | null> => {
    try { return JSON.parse(await (await ensureWs()).read('agentflow.config.json')) }
    catch { return null }
  },

  // Transport platforms — static
  getPlatforms: async (): Promise<{ platforms: PlatformInfo[] }> => ({
    platforms: [
      { name: 'kiro',          displayName: 'Kiro',                          version: '2.1.0', capabilities: ['export', 'import'], tier: 'ide' },
      { name: 'cursor',        displayName: 'Cursor',                        version: '2.1.0', capabilities: ['export', 'import'], tier: 'ide' },
      { name: 'claude-code',   displayName: 'Claude Code',                   version: '2.1.0', capabilities: ['export', 'import'], tier: 'ide' },
      { name: 'vscode-copilot',displayName: 'VS Code (Copilot)',             version: '2.1.0', capabilities: ['export', 'import'], tier: 'ide' },
      { name: 'windsurf',      displayName: 'Windsurf',                      version: '2.1.0', capabilities: ['export', 'import'], tier: 'ide' },
      { name: 'openclaw',      displayName: 'OpenClaw',                      version: '2.1.0', capabilities: ['export', 'import'], tier: 'ide' },
      { name: 'agent-spec',    displayName: 'Agent Spec (Oracle Open Agent Spec)', version: '2.1.0', capabilities: ['export'], tier: 'runtime' },
    ]
  }),

  // Export — fully client-side via shared engine
  exportWorkflow: async (options: { workflow: string }): Promise<ExportBundle> => {
    const data = await api.getData()
    const { parseFromFiles } = await import('@agentflow/core/parser-browser')
    const { toAgentSpec } = await import('@agentflow/cli/export')
    const fileMap = Object.fromEntries(
      (data.allFiles || []).map((f: any) => [f.relativePath, f.rawContent || ''])
    )
    const graph = parseFromFiles(fileMap)
    const spec = toAgentSpec(graph)
    return { files: { 'agent-spec.json': JSON.stringify(spec, null, 2) } } as any
  },


  exportPreview: async (options: ExportOptions): Promise<Record<string, string>> => {
    const data = await api.getData()

    // Raw: exact source files, {{refs}} untouched
    if (options.format === 'raw') {
      const out: Record<string, string> = {}
      for (const f of (data.allFiles || []) as any[]) {
        if (f.relativePath && f.rawContent) out[f.relativePath] = f.rawContent
      }
      return out
    }

    // Parsed: same .md structure, {{ref}} templates resolved to relative paths.
    // Uses the same core resolveRefsToPaths the CLI's walkable export uses —
    // correctly handles edge/data-flow refs (not just `category/name` mentions)
    // and computes real relative paths between files instead of a bare category/name string.
    if (options.format === 'parsed') {
      const { parseFromFiles } = await import('@agentflow/core/parser-browser')
      const { resolveRefsToPaths } = await import('@agentflow/core/ref-paths')
      const fileMap = Object.fromEntries(
        (data.allFiles || []).map((f: any) => [f.relativePath, f.rawContent || ''])
      )
      const graph = parseFromFiles(fileMap)
      const { files } = resolveRefsToPaths(graph)

      // resolveRefsToPaths rewrites the frontmatter-stripped body only — reconstruct
      // each file's original frontmatter block on top of the resolved body so the
      // preview keeps the same .md structure as the source (matches "Raw" format's shape).
      const out: Record<string, string> = {}
      for (const f of (data.allFiles || []) as any[]) {
        if (!f.relativePath) continue
        const body = files[f.relativePath] ?? f.content ?? ''
        const fm = f.frontmatter && Object.keys(f.frontmatter).length ? f.frontmatter : null
        if (!fm) {
          out[f.relativePath] = body
          continue
        }
        const fmLines = ['---', ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`), '---', '']
        out[f.relativePath] = fmLines.join('\n') + body
      }
      return out
    }

    // Platform: shared export engine — fully client-side, no API route
    const { parseFromFiles } = await import('@agentflow/core/parser-browser')
    const { exportForPlatform, toAgentSpec } = await import('@agentflow/cli/export')
    const fileMap = Object.fromEntries(
      (data.allFiles || []).map((f: any) => [f.relativePath, f.rawContent || ''])
    )
    const graph = parseFromFiles(fileMap)
    const platform = options.platform || 'agent-spec'
    if (platform === 'agent-spec') {
      return { 'agent-spec.json': JSON.stringify(toAgentSpec(graph), null, 2) }
    }
    return exportForPlatform(graph, platform)
  },

  exportDownload: async (options: ExportOptions): Promise<Blob> => {
    const files = await api.exportPreview(options)
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const [fp, content] of Object.entries(files)) zip.file(fp, content)
    return zip.generateAsync({ type: 'blob' })
  },

  // Token calculator — client-side from parsed data
  calculateTokens: async (options: {
    scope?: 'file' | 'node' | 'path-to-node' | 'workflow' | 'full'
    workflowId?: string; nodeId?: string; filePath?: string
    includeShared?: boolean; includeRefs?: boolean
  }): Promise<TokenResult> => {
    const { countTokens } = await import('./token-counter')
    const data = await api.getData()
    const scope = options.scope || 'full'

    if (scope === 'file' && options.filePath) {
      const file = data.allFiles?.find((f: any) => f.relativePath === options.filePath)
      const content = file?.rawContent || ''
      const tokens = countTokens(content)
      return { scope, filePath: options.filePath, total: tokens, tokens, chars: content.length, lines: content.split('\n').length }
    }

    if (scope === 'workflow' && options.workflowId) {
      const wf = data.workflows?.[options.workflowId]
      if (!wf) return { scope, workflowId: options.workflowId, total: 0, error: 'Workflow not found' }
      const nodes: any[] = []
      for (const [nid, node] of Object.entries<any>(wf.nodes || {})) {
        const primary = node.primaryFile ? countTokens(node.primaryFile.rawContent || '') : 0
        const ctx = (node.contextFiles || []).map((f: any) => ({ file: f.relativePath, tokens: countTokens(f.rawContent || ''), chars: (f.rawContent || '').length, lines: (f.rawContent || '').split('\n').length }))
        nodes.push({ nodeId: nid, total: primary + ctx.reduce((s: number, c: any) => s + c.tokens, 0), primary: node.primaryFile ? { file: node.primaryFile.relativePath, tokens: primary } : null, context: ctx })
      }
      return { scope, workflowId: options.workflowId, total: nodes.reduce((s, n) => s + n.total, 0), workflows: [{ workflowId: options.workflowId, nodes }] }
    }

    // Full scope
    let total = 0
    const categories: Record<string, any[]> = {}
    for (const cat of ['instructions', 'capabilities', 'skills', 'memory'] as const) {
      categories[cat] = []
      for (const [key, res] of Object.entries<any>(data[cat] || {})) {
        const t = countTokens(res.rawContent || '')
        total += t
        categories[cat].push({ file: res.relativePath, tokens: t, chars: (res.rawContent || '').length, lines: (res.rawContent || '').split('\n').length, key })
      }
    }
    const wfNodes: any[] = []
    for (const [wfId, wf] of Object.entries<any>(data.workflows || {})) {
      const nodes: any[] = []
      for (const [nid, node] of Object.entries<any>(wf.nodes || {})) {
        const primary = node.primaryFile ? countTokens(node.primaryFile.rawContent || '') : 0
        const ctx = (node.contextFiles || []).map((f: any) => ({ file: f.relativePath, tokens: countTokens(f.rawContent || '') }))
        const nodeTotal = primary + ctx.reduce((s: number, c: any) => s + c.tokens, 0)
        total += nodeTotal
        nodes.push({ nodeId: nid, total: nodeTotal, primary: node.primaryFile ? { file: node.primaryFile.relativePath, tokens: primary } : null, context: ctx })
      }
      wfNodes.push({ workflowId: wfId, nodes })
    }
    return { scope, total, shared: { total: Object.values(categories).flat().reduce((s, c) => s + c.tokens, 0), categories }, workflows: wfNodes }
  },
}

// ── Git API (always server — needs shell) ──

export interface GitRepoStatus { isRepo: boolean; isClean: boolean; branch: string; ahead: number; behind: number; modifiedFiles: string[]; untrackedFiles: string[]; hasRemote: boolean; remoteUrl: string | null }
export interface RepoMapping { name: string; url: string; branch: string; localPath: string; repoType: 'public' | 'private' | 'custom'; role: 'primary' | 'agentic' | 'shared'; agentflowPath: string }
