/**
 * Client-side MCP discover for HTTP/SSE servers.
 * Uses @modelcontextprotocol/sdk StreamableHTTPClientTransport (browser-compatible).
 * Falls back to server route for stdio servers.
 */

export async function discoverMcpTools(
  serverConfig: { name: string; url?: string; command?: string; env?: Record<string, string>; args?: string[] },
): Promise<{ ok: true; source: string; toolCount: number; tools: { name: string; description: string }[] } | { ok: false; error: string }> {
  // stdio → must use server
  if (!serverConfig.url) {
    const res = await fetch('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "discover", name: serverConfig.name }),
    })
    return res.json()
  }

  // HTTP/SSE → client-side
  try {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    const isSSE = serverConfig.url.includes('/sse')

    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(serverConfig.env || {})) {
      if (!v || typeof v !== 'string' || v.startsWith('${env:')) continue
      const kl = k.toLowerCase()
      if (kl.includes('token') || kl.includes('key') || kl.includes('secret') || kl.includes('auth')) {
        headers['Authorization'] = headers['Authorization'] || `Bearer ${v}`
      }
      if (kl.includes('api_key') || kl.includes('apikey')) {
        headers['X-API-Key'] = v
      }
    }
    const requestInit: RequestInit = Object.keys(headers).length > 0 ? { headers } : {}

    let transport: any
    if (isSSE) {
      const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js')
      transport = new SSEClientTransport(new URL(serverConfig.url), { requestInit })
    } else {
      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
      transport = new StreamableHTTPClientTransport(new URL(serverConfig.url), { requestInit })
    }

    const client = new Client({ name: 'agentflow-discover', version: '1.0.0' })

    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out after 15s')), 15000)),
    ])

    const toolsResult: any = await Promise.race([
      client.listTools(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('listTools timed out after 15s')), 15000)),
    ])

    const tools = (toolsResult.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || '',
    }))

    try { await client.close() } catch {}

    return { ok: true, source: 'live', toolCount: tools.length, tools }
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) }
  }
}
