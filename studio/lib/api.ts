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

function parseClientSide(files: { path: string; content: string }[]): WorkflowGraph {
  if (!files.length) return { workflows: {}, instructions: {}, capabilities: {}, runbooks: {}, memory: {}, rootDir: '.' } as any
  const { parseFromFiles } = require('@agentflow/core/parser-browser')
  const fileMap: Record<string, string> = {}
  for (const f of files) fileMap[f.path] = f.content
  const result = parseFromFiles(fileMap)
  result._rawFiles = fileMap
  return result
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
    console.log('[getData] parsed: runbooks=' + Object.keys(result.runbooks || {}).length,
      'instructions=' + Object.keys(result.instructions || {}).length,
      'capabilities=' + Object.keys(result.capabilities || {}).length,
      'workflows=' + Object.keys(result.workflows || {}).length)
    console.log('[getData] runbook names:', Object.keys(result.runbooks || {}))
    console.log('[getData] runbook files:', files.filter(f => f.path.startsWith('runbooks/')).map(f => f.path))
    // Auto-heal: if condition runbooks are missing, fetch from library and write them
    const missingRunbooks: string[] = []
    for (const wf of Object.values(result.workflows || {})) {
      for (const edge of (wf as any).edges || []) {
        if (edge.condition) {
          const [cat, name] = edge.condition.split('/')
          if (cat === 'runbooks' && !(result as any).runbooks?.[name]) {
            missingRunbooks.push(name)
          }
        }
      }
    }
    if (missingRunbooks.length > 0) {
      console.warn(`[getData] Auto-healing ${missingRunbooks.length} missing condition runbooks...`)
      try {
        const res = await fetch('/api/library/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'runbook', names: missingRunbooks }),
        }).catch(() => null)
        // Fallback: try importing each individually
        for (const name of missingRunbooks) {
          try {
            const r = await fetch('/api/library/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'runbook', name }),
            })
            if (r.ok) {
              const { files: libFiles } = await r.json()
              for (const f of libFiles) await w.write(f.path, f.content)
            }
          } catch {}
        }
        // Re-parse with healed files
        files = await w.readAll()
        const healed = parseClientSide(files)
        console.log(`[getData] Healed: runbooks now=${Object.keys(healed.runbooks || {}).length}`)
        return healed
      } catch (e) {
        console.error('[getData] Auto-heal failed:', e)
      }
    }
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
    const { validate } = require('@agentflow/core/validator')
    return validate(await api.getData(), options)
  },

  // Library — static project-level catalog (not workspace data)
  getLibrary: async (): Promise<{ version: string; entries: LibraryEntry[] }> => {
    try { return await request('/library') }
    catch { return { version: '0.0.0', entries: [] } }
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

  // Export — still needs server (fs/path deps in exporters)
  exportWorkflow: async (options: { workflow: string }): Promise<ExportBundle> =>
    request('/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }),

  exportStructured: async (options: ExportOptions): Promise<Blob> => {
    const files = await (await ensureWs()).readAll()
    const res = await fetch(BASE + '/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...options, files })
    })
    if (!res.ok) throw new Error('Export failed')
    return res.blob()
  },

  exportPreview: async (options: ExportOptions): Promise<Record<string, string>> =>
    request('/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...options, preview: true, files: await (await ensureWs()).readAll() })
    }),

  exportDownload: async (options: ExportOptions): Promise<Blob> => {
    const res = await fetch(BASE + '/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...options, files: await (await ensureWs()).readAll() })
    })
    if (!res.ok) throw new Error('Export failed')
    return res.blob()
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
    for (const cat of ['instructions', 'capabilities', 'runbooks', 'memory'] as const) {
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
export interface ScanResult { repoDir: string; agentflowPaths: string[]; resources: { instructions: ScannedResource[]; capabilities: ScannedResource[]; runbooks: ScannedResource[]; memory: ScannedResource[]; hooks: ScannedResource[] }; workflows: ScannedWorkflow[]; stats: { totalFiles: number; totalWorkflows: number; totalResources: number; scanDurationMs: number }; warnings: { path: string; message: string; severity: 'info' | 'warning' }[] }
export interface ScannedResource { name: string; path: string; resourceType: string; hasFrontmatter: boolean; frontmatterFields: string[] }
export interface ScannedWorkflow { name: string; path: string; nodeCount: number; hasDescriptor: boolean; entryPoints: string[] }
export interface SyncConflict { path: string; localContent: string; remoteContent: string; resolution: 'pending' | 'local_wins' | 'remote_wins' | 'merged' | null }
export interface SyncResult { success: boolean; direction: 'push' | 'pull' | 'bidirectional'; filesAdded: string[]; filesModified: string[]; filesDeleted: string[]; conflicts: SyncConflict[]; timestamp: string }
export interface RepoMapping { name: string; url: string; branch: string; localPath: string; repoType: 'public' | 'private' | 'custom'; role: 'primary' | 'agentic' | 'shared'; agentflowPath: string }
export type SyncDirection = 'bidirectional' | 'push_only' | 'pull_only'
export interface GitAuthMethod { type: 'ssh' | 'ssh-agent' | 'credential-helper' | 'gh-cli' | 'env-token'; label: string; ready: boolean; scope?: 'global' | 'local' | 'env' }
export interface GitAuthInfo { methods: GitAuthMethod[]; recommended: 'ssh' | 'https' | 'none'; sshExample: string; httpsExample: string; ghCliInstalled?: boolean }
export interface AuthSetupResult { success: boolean; interactive?: boolean; command?: string; message: string; user_code?: string; verification_uri?: string; expires_in?: number; interval?: number; status?: 'pending' | 'slow_down' | 'authorized'; scope?: string; token_type?: string }

export const gitApi = {
  getStatus: (): Promise<GitRepoStatus> => request('/git/status'),
  initRepo: (params: { url: string; name: string; role: string; branch: string; repoType: string }): Promise<{ success: boolean; scanResult: ScanResult; mapping: RepoMapping }> =>
    request('/git/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }),
  sync: (params: { repoName?: string; direction?: SyncDirection; dryRun?: boolean }): Promise<SyncResult> =>
    request('/git/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }),
  scan: (params?: { dir?: string; depth?: number }): Promise<ScanResult> =>
    request(`/git/scan${params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}` : ''}`),
  getConflicts: (): Promise<SyncConflict[]> => request<{ conflicts: SyncConflict[] }>('/git/conflicts').then(r => r.conflicts),
  resolve: (params: { path: string; strategy: string }): Promise<{ success: boolean }> =>
    request('/git/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }),
  getConfig: (): Promise<{ repos: RepoMapping[] }> => request('/git/config'),
  updateConfig: (config: Record<string, unknown>): Promise<{ success: boolean }> =>
    request('/git/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }),
  getAuthInfo: (): Promise<GitAuthInfo> => request('/git/auth-info'),
  authSetup: (params: { action: string; dir?: string; helper?: string }): Promise<AuthSetupResult> =>
    request('/git/auth-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }),
}
