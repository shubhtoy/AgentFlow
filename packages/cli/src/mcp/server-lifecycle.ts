/**
 * MCP Server Lifecycle.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { resolveEnvTokens } from './config-manager'

export const DEFAULT_TIMEOUT = 30000

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

export function defaultDeps(): McpDeps {
  return {
    createClient: info => new Client(info),
    createStdioTransport: params => new StdioClientTransport(params),
    createHTTPTransport: url => new StreamableHTTPClientTransport(url),
    resolveEnv: resolveEnvTokens,
  }
}

interface ServerEntry {
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, unknown>
}

export async function discoverTools(
  serverEntry: ServerEntry,
  opts: { timeout?: number; _deps?: Partial<McpDeps> } = {},
): Promise<Record<string, unknown>[]> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT
  const deps = { ...defaultDeps(), ...opts._deps }
  const resolvedEnv = deps.resolveEnv(serverEntry.env)

  let client: Client | undefined

  try {
    let transport: StdioClientTransport | StreamableHTTPClientTransport
    if (serverEntry.command) {
      transport = deps.createStdioTransport({
        command: serverEntry.command,
        args: serverEntry.args || [],
        env: { ...process.env, ...resolvedEnv } as Record<string, string>,
      })
    } else if (serverEntry.url) {
      transport = deps.createHTTPTransport(new URL(serverEntry.url))
    } else {
      throw new Error('Server entry must have either "command" (stdio) or "url" (HTTP/SSE)')
    }

    client = deps.createClient({ name: 'agentflow-discovery', version: '1.0.0' })

    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timed out after ${timeout}ms`)), timeout),
      ),
    ])

    const result = await client.listTools()
    return (result as { tools?: Record<string, unknown>[] }).tools || []
  } finally {
    try {
      if (client) await client.close()
    } catch {
      /* ignore */
    }
  }
}
