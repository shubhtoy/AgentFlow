/**
 * ToolProvider.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { ParsedGraph, ParsedNode } from '@agentflow/core/parser-core'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { loadMcpConfig, resolveEnvTokens } from './config-manager'

interface ToolEntry {
  name: string
  schema: Record<string, unknown>
  execute: (args: Record<string, unknown>, ctx?: { workingDir: string }) => unknown
  toolType: string
}

interface McpDeps {
  createClient: (info: { name: string; version: string }) => Client
  createStdioTransport: (params: {
    command: string
    args: string[]
    env: Record<string, string>
  }) => StdioClientTransport
  createHTTPTransport: (url: URL) => StreamableHTTPClientTransport
  resolveEnv: typeof resolveEnvTokens
}

export function defaultMcpDeps(): McpDeps {
  return {
    createClient: info => new Client(info),
    createStdioTransport: params => new StdioClientTransport(params),
    createHTTPTransport: url => new StreamableHTTPClientTransport(url),
    resolveEnv: resolveEnvTokens,
  }
}

export const BuiltinToolRegistry: Record<
  string,
  (args: Record<string, unknown>, ctx: { workingDir: string }) => unknown
> = {
  readCode(args, ctx) {
    const filePath = path.resolve(ctx.workingDir, args.path as string)
    if (!fs.existsSync(filePath)) return { error: `File not found: ${args.path}` }
    if (fs.statSync(filePath).isDirectory()) {
      return {
        type: 'directory',
        path: args.path,
        entries: fs.readdirSync(filePath, { withFileTypes: true }).map(e => ({ name: e.name, isDir: e.isDirectory() })),
      }
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    if (args.symbol) {
      const matches = content
        .split('\n')
        .map((line, i) => ({ line: i + 1, text: line }))
        .filter(l => l.text.includes(args.symbol as string))
      return { path: args.path, symbol: args.symbol, matches: matches.slice(0, 30) }
    }
    const lines = content.split('\n')
    const truncated = lines.length > 500
    return {
      path: args.path,
      content: truncated ? lines.slice(0, 500).join('\n') + '\n...(truncated)' : content,
      lines: lines.length,
      truncated,
    }
  },
  fsWrite(args, ctx) {
    const filePath = path.resolve(ctx.workingDir, args.path as string)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, args.content as string, 'utf-8')
    return { success: true, path: args.path, bytesWritten: Buffer.byteLength(args.content as string) }
  },
  getDiagnostics(args, ctx) {
    const paths = (args.paths || [args.path]) as string[]
    return {
      results: paths.map(p => {
        const fp = path.resolve(ctx.workingDir, p)
        if (!fs.existsSync(fp)) return { path: p, error: 'File not found' }
        if (p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.cjs')) {
          try {
            execSync(`node --check "${fp}"`, { stdio: 'pipe', timeout: 10000 })
            return { path: p, ok: true, diagnostics: [] }
          } catch (err: unknown) {
            return {
              path: p,
              ok: false,
              diagnostics: [(err as { stderr?: Buffer }).stderr?.toString() || (err as Error).message],
            }
          }
        }
        return { path: p, ok: true, diagnostics: [], note: 'No checker available for this file type' }
      }),
    }
  },
  webSearch(args) {
    return { note: 'Web search not available in orchestrator runtime', query: args.query }
  },
}

export const ScriptToolExecutor = {
  execute(command: string, args: Record<string, unknown>, ctx: { workingDir: string }) {
    const cmd = (args.command as string) || command
    try {
      const output = execSync(cmd, { cwd: ctx.workingDir, stdio: 'pipe', timeout: 60000, encoding: 'utf-8' })
      return { success: true, command: cmd, output: output.slice(0, 10000) }
    } catch (err: unknown) {
      return {
        success: false,
        command: cmd,
        exitCode: (err as { status?: number }).status,
        output: ((err as { stdout?: string }).stdout || '').slice(0, 5000),
        error: ((err as { stderr?: string }).stderr || '').slice(0, 5000),
      }
    }
  },
}

export class McpToolManager {
  servers = new Map<string, { client: Client; tools: Record<string, unknown>[] }>()
  private _deps: McpDeps

  constructor(opts: { _deps?: Partial<McpDeps> } = {}) {
    this._deps = { ...defaultMcpDeps(), ...opts._deps }
  }

  async initialize(mcpConfig: { servers: Record<string, Record<string, unknown>> } | undefined) {
    for (const [name, serverEntry] of Object.entries(mcpConfig?.servers || {})) {
      try {
        const { client, tools } = await this._connectServer(name, serverEntry)
        this.servers.set(name, { client, tools })
      } catch (err: unknown) {
        if (serverEntry.required) {
          const installCmd = serverEntry.command
            ? `${serverEntry.command} ${((serverEntry.args || []) as string[]).join(' ')}`
            : (serverEntry.url as string) || 'unknown'
          throw new Error(
            `Required MCP server "${name}" failed to start: ${(err as Error).message}\nInstall: ${installCmd}`,
          )
        }
        console.warn(`Optional MCP server "${name}" unavailable: ${(err as Error).message}`)
      }
    }
  }

  private async _connectServer(name: string, serverEntry: Record<string, unknown>) {
    const deps = this._deps
    const resolvedEnv = deps.resolveEnv(serverEntry.env as Record<string, unknown>)
    let transport: StdioClientTransport | StreamableHTTPClientTransport
    if (serverEntry.command) {
      transport = deps.createStdioTransport({
        command: serverEntry.command as string,
        args: (serverEntry.args || []) as string[],
        env: { ...process.env, ...resolvedEnv } as Record<string, string>,
      })
    } else if (serverEntry.url) {
      transport = deps.createHTTPTransport(new URL(serverEntry.url as string))
    } else {
      throw new Error('Server entry must have either "command" (stdio) or "url" (HTTP/SSE)')
    }
    const client = deps.createClient({ name: `agentflow-${name}`, version: '1.0.0' })
    await client.connect(transport)
    const result = await client.listTools()
    return { client, tools: (result as { tools?: Record<string, unknown>[] }).tools || [] }
  }

  getTools(serverName: string) {
    return this.servers.get(serverName)?.tools || []
  }

  async execute(server: string, tool: string, args: Record<string, unknown>) {
    const entry = this.servers.get(server)
    if (!entry) return { error: `MCP server "${server}" is not connected.` }
    try {
      return await entry.client.callTool({ name: tool, arguments: args })
    } catch (err: unknown) {
      return { error: `MCP tool "${tool}" on server "${server}" failed: ${(err as Error).message}`, isError: true }
    }
  }

  async shutdown() {
    for (const [, entry] of this.servers) {
      try {
        if (entry.client?.close) await entry.client.close()
      } catch {
        /* ignore */
      }
    }
    this.servers.clear()
  }
}

export function buildToolEntry(key: string, toolDef: Record<string, unknown>, mcpManager: McpToolManager): ToolEntry {
  const fm = (toolDef.frontmatter || {}) as Record<string, unknown>
  const name = (fm.name as string) || key
  const description = (fm.description as string) || (toolDef.title as string) || (toolDef.content as string) || name
  const toolType = (fm.type as string) || (toolDef.toolType as string) || 'builtin'

  const properties: Record<string, unknown> = {}
  const required: string[] = []
  if (fm.parameters) {
    for (const [pName, pDef] of Object.entries(fm.parameters as Record<string, Record<string, unknown>>)) {
      properties[pName] = {
        type: pDef.type === 'array' ? 'array' : 'string',
        description: (pDef.description as string) || pName,
      }
      if (pDef.type === 'array') (properties[pName] as Record<string, unknown>).items = { type: 'string' }
      if (pDef.required) required.push(pName)
    }
  }

  const schema = {
    name: name.replace(/[^a-zA-Z0-9_-]/g, '_'),
    description: typeof description === 'string' ? description.slice(0, 1024) : name,
    input_schema: { type: 'object', properties, required },
  }

  let execute: ToolEntry['execute']
  if (toolType === 'builtin') {
    const mapping = (fm.builtin_mapping as string) || (fm.builtinMapping as string) || name
    const builtinFn = BuiltinToolRegistry[mapping] || BuiltinToolRegistry[name]
    execute = builtinFn
      ? (args, ctx) => builtinFn(args, ctx!)
      : () => ({ error: `No executor for builtin: ${mapping}` })
  } else if (toolType === 'script') {
    execute = (args, ctx) => ScriptToolExecutor.execute(fm.command as string, args, ctx!)
  } else if (toolType === 'mcp') {
    execute = args => mcpManager.execute((fm.mcp as string) || '', name, args)
  } else {
    execute = () => ({ error: `Unknown tool type: ${toolType}` })
  }

  return { name: schema.name, schema, execute, toolType }
}

export class ToolProvider {
  async initialize(_graph: ParsedGraph) {}
  getToolsForNode(_node: ParsedNode, _graph: ParsedGraph): ToolEntry[] {
    return []
  }
  async shutdown() {}
}

export class NodeToolProvider extends ToolProvider {
  mcpManager: McpToolManager
  rootDir: string | null = null

  constructor(opts: { _deps?: Partial<McpDeps> } = {}) {
    super()
    this.mcpManager = new McpToolManager(opts)
  }

  async initialize(graph: ParsedGraph) {
    this.rootDir = graph.rootDir || null
    if (this.rootDir) {
      const mcpConfig = loadMcpConfig(this.rootDir)
      if (Object.keys(mcpConfig.servers).length > 0)
        await this.mcpManager.initialize(mcpConfig as unknown as { servers: Record<string, Record<string, unknown>> })
    }
  }

  getToolsForNode(node: ParsedNode, graph: ParsedGraph): ToolEntry[] {
    const toolMap: Record<string, ToolEntry> = {}
    for (const ref of node.allRefs || []) {
      if (ref.semanticType !== 'mention') continue
      if (ref.category !== 'capabilities' && ref.category !== 'tools') continue
      const toolDef = (graph.capabilities || {})[ref.name || '']
      if (!toolDef) continue
      const entry = buildToolEntry(ref.name || '', toolDef as unknown as Record<string, unknown>, this.mcpManager)
      toolMap[entry.name] = entry
    }
    return Object.values(toolMap)
  }

  async shutdown() {
    await this.mcpManager.shutdown()
  }
}
