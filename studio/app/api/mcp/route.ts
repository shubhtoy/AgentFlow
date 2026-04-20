export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

const path = require('path')

// ── GET: action via ?action= query param ──

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'config'
  const s = getServices()

  if (action === 'config') {
    const { loadMcpConfig } = require('@agentflow/cli/mcp/config-manager')
    const result = loadMcpConfig(s.rootDir)
    const servers = Object.entries(result.servers || {}).map(([name, cfg]: [string, any]) => {
      const toolNames = Array.isArray(cfg.discoveredTools) ? cfg.discoveredTools : []
      const tools = toolNames.map((t: any) => typeof t === 'object' && t.name ? { name: t.name, description: t.description || '' } : { name: String(t), description: '' })
      return {
        name, command: cfg.command || '', args: cfg.args || [],
        env: cfg.env || {}, disabled: cfg.disabled || false,
        autoApprove: cfg.autoApprove || [],
        status: cfg.disabled ? 'stopped' : (cfg.command || cfg.url) ? 'ready' : 'misconfigured',
        toolCount: tools.length, tools,
        registryName: cfg.registryName || '', description: cfg.description || '',
        version: cfg.version || '', url: cfg.url || '',
      }
    })
    return json({ servers, configPath: path.join(s.rootDir, '.agentflow', 'mcp.json') })
  }

  if (action === 'search') {
    const { searchRegistry } = require('@agentflow/core/mcp/registry-client')
    const q = req.nextUrl.searchParams.get('q') || ''
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10)
    const cursor = req.nextUrl.searchParams.get('cursor') || undefined
    const updatedSince = req.nextUrl.searchParams.get('updated_since') || undefined
    try {
      const result = await searchRegistry(q, { limit, cursor, updatedSince })
      return json({ servers: result.entries, nextCursor: result.nextCursor, count: result.count })
    } catch (err: any) { return json({ error: err.message }, 502) }
  }

  if (action === 'tools') {
    const { loadMcpConfig } = require('@agentflow/cli/mcp/config-manager')
    const { parseRoot } = require('@agentflow/cli/parser')
    const result = loadMcpConfig(s.rootDir)
    const tools: any[] = []
    const seen = new Set<string>()
    for (const [serverName, cfg] of Object.entries(result.servers || {}) as any) {
      if (cfg.disabled) continue
      for (const t of (cfg.discoveredTools || [])) {
        const name = typeof t === 'object' ? t.name : String(t)
        if (!seen.has(name)) { seen.add(name); tools.push({ name, description: typeof t === 'object' ? t.description || '' : '', server: serverName, source: 'mcp' }) }
      }
    }
    try {
      const graph = parseRoot(s.rootDir)
      for (const [name, tool] of Object.entries(graph.tools || {}) as any) {
        const fm = tool.frontmatter || tool.primaryFile?.frontmatter || {}
        if (fm.type === 'mcp' && !seen.has(name)) { seen.add(name); tools.push({ name, description: fm.description || tool.title || '', server: fm.mcp || fm.server || 'unknown', source: 'mcp' }) }
      }
    } catch {}
    return json({ tools })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
}

// ── POST: action via body.action ──

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const { action, name } = body

  if (!action) return json({ error: 'action is required' }, 400)

  if (action === 'add') {
    const { addServer } = require('@agentflow/cli/mcp/config-manager')
    const { searchRegistry } = require('@agentflow/core/mcp/registry-client')
    const { registryName, env, required } = body
    if (!name) return json({ error: 'name is required' }, 400)
    try {
      let registryEntry = null
      if (registryName) {
        const result = await searchRegistry(registryName, { limit: 20 })
        const exact = result.entries.filter((e: any) => e.name === registryName)
        const partial = exact.length > 0 ? exact : result.entries.filter((e: any) => e.name.endsWith('/' + registryName) || e.name.includes(registryName))
        const candidates = partial.length > 0 ? partial : result.entries
        registryEntry = candidates.find((e: any) => e.isLatest) || candidates[0] || null
      }
      const entry = addServer(s.rootDir, name, registryEntry || { name, packages: [], remotes: [] }, { env, required })
      return json({ ok: true, entry })
    } catch (err: any) { return json({ error: err.message }, 500) }
  }

  if (action === 'remove') {
    const { removeServer } = require('@agentflow/cli/mcp/config-manager')
    if (!name) return json({ error: 'name is required' }, 400)
    await removeServer(s.rootDir, name)
    return json({ ok: true })
  }

  if (action === 'toggle') {
    const { loadMcpConfig, saveMcpConfig } = require('@agentflow/cli/mcp/config-manager')
    const { disabled } = body
    if (!name) return json({ error: 'name is required' }, 400)
    const result = loadMcpConfig(s.rootDir)
    if (result.servers[name]) { result.servers[name].disabled = disabled; saveMcpConfig(s.rootDir, result.servers) }
    return json({ ok: true })
  }

  if (action === 'update') {
    const { loadMcpConfig, saveMcpConfig } = require('@agentflow/cli/mcp/config-manager')
    const { env, disabled, url, command, args } = body
    if (!name) return json({ error: 'name is required' }, 400)
    const { servers } = loadMcpConfig(s.rootDir)
    const cfg = servers[name]
    if (!cfg) return json({ error: `Server "${name}" not found` }, 404)
    if (env !== undefined) cfg.env = env
    if (disabled !== undefined) cfg.disabled = disabled
    if (url !== undefined) cfg.url = url
    if (command !== undefined) cfg.command = command
    if (args !== undefined) cfg.args = args
    servers[name] = cfg
    saveMcpConfig(s.rootDir, servers)
    return json({ ok: true })
  }

  if (action === 'discover') {
    const { loadMcpConfig, saveMcpConfig, resolveEnvTokens } = require('@agentflow/cli/mcp/config-manager')
    if (!name) return json({ error: 'name is required' }, 400)
    const { servers } = loadMcpConfig(s.rootDir)
    const cfg = servers[name]
    if (!cfg) return json({ error: `Server "${name}" not found` }, 404)
    const resolvedEnv = resolveEnvTokens(cfg.env || {})
    for (const [k, v] of Object.entries(resolvedEnv)) {
      if (!v && cfg.env?.[k]?.startsWith('${env:')) return json({ error: `Missing environment variable: ${k}` }, 400)
    }
    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
      let transport: any
      if (cfg.url) {
        const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
        const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js')
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(resolvedEnv)) { if (v && typeof v === 'string') { const kl = k.toLowerCase(); if (kl.includes('token') || kl.includes('key') || kl.includes('secret') || kl.includes('auth')) headers['Authorization'] = headers['Authorization'] || `Bearer ${v}`; if (kl.includes('api_key') || kl.includes('apikey')) headers['X-API-Key'] = v } }
        const requestInit: RequestInit = Object.keys(headers).length > 0 ? { headers } : {}
        transport = cfg.url.includes('/sse') ? new SSEClientTransport(new URL(cfg.url), { requestInit }) : new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit })
      } else if (cfg.command) {
        const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
        transport = new StdioClientTransport({ command: cfg.command, args: cfg.args || [], env: { ...process.env, ...resolvedEnv } as Record<string, string>, stderr: 'pipe' })
      } else { return json({ error: 'Server has no url or command configured.' }, 400) }
      const client = new Client({ name: 'agentflow-discover', version: '1.0.0' })
      await Promise.race([client.connect(transport), new Promise((_, rej) => setTimeout(() => rej(new Error('Connection timed out')), 15000))])
      const toolsResult = await Promise.race([client.listTools(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('listTools timed out')), 15000))])
      const tools = (toolsResult.tools || []).map((t: any) => ({ name: t.name, description: t.description || '' }))
      cfg.discoveredTools = tools; servers[name] = cfg; saveMcpConfig(s.rootDir, servers)
      try { await client.close() } catch {}
      return json({ ok: true, source: cfg.url ? 'live' : 'stdio', toolCount: tools.length, tools })
    } catch (err: any) {
      const msg = err.message || String(err)
      if (!cfg.url && msg.includes('ENOENT')) return json({ error: `Command "${cfg.command}" not found.` }, 500)
      return json({ error: msg }, 500)
    }
  }

  if (action === 'test') {
    const { loadMcpConfig, resolveEnvTokens } = require('@agentflow/cli/mcp/config-manager')
    if (!name) return json({ error: 'name is required' }, 400)
    const { servers } = loadMcpConfig(s.rootDir)
    const cfg = servers[name]
    if (!cfg) return json({ error: `Server "${name}" not found` }, 404)
    const resolvedEnv = resolveEnvTokens(cfg.env || {})
    const start = Date.now()
    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
      let transport: any
      if (cfg.url) {
        const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
        const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js')
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(resolvedEnv)) { if (v && typeof v === 'string') { const kl = k.toLowerCase(); if (kl.includes('token') || kl.includes('key') || kl.includes('secret') || kl.includes('auth')) headers['Authorization'] = headers['Authorization'] || `Bearer ${v}`; if (kl.includes('api_key') || kl.includes('apikey')) headers['X-API-Key'] = v } }
        const requestInit: RequestInit = Object.keys(headers).length > 0 ? { headers } : {}
        transport = cfg.url.includes('/sse') ? new SSEClientTransport(new URL(cfg.url), { requestInit }) : new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit })
      } else if (cfg.command) {
        const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
        transport = new StdioClientTransport({ command: cfg.command, args: cfg.args || [], env: { ...process.env, ...resolvedEnv } as Record<string, string>, stderr: 'pipe' })
      } else { return json({ ok: false, status: 'error', error: 'No url or command configured.' }, 400) }
      const client = new Client({ name: 'agentflow-test', version: '1.0.0' })
      await Promise.race([client.connect(transport), new Promise((_, rej) => setTimeout(() => rej(new Error('Connection timed out')), 10000))])
      const toolsResult = await Promise.race([client.listTools(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('listTools timed out')), 10000))])
      const latency = Date.now() - start
      const tools = (toolsResult.tools || []).map((t: any) => ({ name: t.name, description: t.description || '' }))
      try { await client.close() } catch {}
      return json({ ok: true, status: 'connected', transport: cfg.url ? 'http' : 'stdio', latencyMs: latency, toolCount: tools.length, tools })
    } catch (err: any) {
      const msg = err.message || String(err)
      return json({ ok: false, status: 'error', latencyMs: Date.now() - start, error: !cfg.url && msg.includes('ENOENT') ? `Command "${cfg.command}" not found.` : msg })
    }
  }

  return json({ error: `Unknown action: ${action}` }, 400)
}
