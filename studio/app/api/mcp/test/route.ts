export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

/**
 * POST /api/mcp/test — Live-test an MCP server connection.
 *
 * Uses @modelcontextprotocol/sdk Client to perform a real MCP handshake,
 * list tools, and report latency. Supports HTTP/SSE and stdio transports.
 *
 * Body: { name: string }
 */
export async function POST(req: NextRequest) {
  const s = getServices()
  const { loadMcpConfig, resolveEnvTokens } = require('@agentflow/mcp/config-manager')
  const { name } = await jsonBody(req)
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
      const isSSE = cfg.url.includes('/sse')

      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(resolvedEnv)) {
        if (!v || typeof v !== 'string') continue
        const kl = k.toLowerCase()
        if (kl.includes('token') || kl.includes('key') || kl.includes('secret') || kl.includes('auth')) {
          headers['Authorization'] = headers['Authorization'] || `Bearer ${v}`
        }
        if (kl.includes('api_key') || kl.includes('apikey')) {
          headers['X-API-Key'] = v
        }
      }
      const requestInit: RequestInit = Object.keys(headers).length > 0 ? { headers } : {}

      transport = isSSE
        ? new SSEClientTransport(new URL(cfg.url), { requestInit })
        : new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit })
    } else if (cfg.command) {
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
      transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args || [],
        env: { ...process.env, ...resolvedEnv } as Record<string, string>,
        stderr: 'pipe',
      })
    } else {
      return json({ ok: false, status: 'error', error: 'Server has no url or command configured.' }, 400)
    }

    const client = new Client({ name: 'agentflow-test', version: '1.0.0' })

    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out after 10s')), 10000)),
    ])

    const toolsResult = await Promise.race([
      client.listTools(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('listTools timed out after 10s')), 10000)),
    ])

    const latency = Date.now() - start
    const tools = (toolsResult.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || '',
    }))

    try { await client.close() } catch {}

    return json({
      ok: true,
      status: 'connected',
      transport: cfg.url ? 'http' : 'stdio',
      latencyMs: latency,
      toolCount: tools.length,
      tools,
    })
  } catch (err: any) {
    const msg = err.message || String(err)
    return json({
      ok: false,
      status: 'error',
      latencyMs: Date.now() - start,
      error: !cfg.url && msg.includes('ENOENT')
        ? `Command "${cfg.command}" not found. Make sure it's installed and in your PATH.`
        : msg,
    })
  }
}
