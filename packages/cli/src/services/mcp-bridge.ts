/**
 * MCP Bridge.
 */

import fs from 'fs'
import path from 'path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

interface ServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  enabled?: boolean
  disabled?: boolean
}

interface ToolDef {
  server: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

interface ServiceContext {
  rootDir: string
  logger: {
    info: (msg: string) => void
    warn: (obj: unknown, msg: string) => void
    error: (obj: unknown, msg: string) => void
  }
}

const DEFAULT_SERVERS: Record<string, ServerConfig> = {
  filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '{rootDir}'], enabled: true },
  git: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-git', '--repository', '{rootDir}'], enabled: true },
  memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], enabled: true },
  fetch: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'], enabled: true },
  sequentialthinking: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequentialthinking'],
    enabled: true,
  },
}

export function createMCPBridge(ctx: ServiceContext) {
  const { rootDir, logger } = ctx
  const connections = new Map<string, { client: Client; transport: StdioClientTransport }>()
  const toolCache = new Map<string, ToolDef[]>()
  let initialized = false

  function loadServerConfig(): Record<string, ServerConfig> {
    const configPath = path.join(rootDir, 'protocols.json')
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        return (raw.mcp && raw.mcp.servers) || raw.servers || DEFAULT_SERVERS
      } catch (err) {
        logger.warn({ err }, 'Failed to parse protocols.json, using defaults')
      }
    }
    return DEFAULT_SERVERS
  }

  function resolveTemplate(value: string): string {
    return value.replace(/\{rootDir\}/g, rootDir)
  }

  return {
    async initialize() {
      if (initialized) return
      const servers = loadServerConfig()

      for (const [name, cfg] of Object.entries(servers)) {
        if (cfg.enabled === false || cfg.disabled) continue
        try {
          const args = (cfg.args || []).map(resolveTemplate)
          const env: Record<string, string> = {}
          if (cfg.env) {
            for (const [k, v] of Object.entries(cfg.env)) env[k] = resolveTemplate(v)
          }

          const transport = new StdioClientTransport({
            command: cfg.command || 'npx',
            args,
            env: { ...process.env, ...env } as Record<string, string>,
          })

          const client = new Client({ name: `agentflow-${name}`, version: '1.0.0' })
          await client.connect(transport)
          connections.set(name, { client, transport })
          logger.info(`MCP server "${name}" connected`)
        } catch (err) {
          logger.error({ err }, `Failed to spawn MCP server "${name}"`)
        }
      }
      initialized = true
    },

    async getToolDefinitions(): Promise<ToolDef[]> {
      const allTools: ToolDef[] = []
      for (const [serverName, { client }] of connections) {
        if (toolCache.has(serverName)) {
          allTools.push(...toolCache.get(serverName)!)
          continue
        }
        try {
          const result = await client.listTools()
          const tools: ToolDef[] = (
            (result as { tools?: { name: string; description?: string; inputSchema?: Record<string, unknown> }[] })
              .tools || []
          ).map(t => ({
            server: serverName,
            name: t.name,
            description: t.description || '',
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
          }))
          toolCache.set(serverName, tools)
          allTools.push(...tools)
        } catch (err) {
          logger.error({ err }, `Failed to list tools from "${serverName}"`)
        }
      }
      return allTools
    },

    async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
      const conn = connections.get(serverName)
      if (!conn) throw new Error(`MCP server "${serverName}" not connected`)
      const result = await conn.client.callTool({ name: toolName, arguments: args })
      const textParts = ((result as { content?: { type: string; text: string }[] }).content || [])
        .filter(c => c.type === 'text')
        .map(c => c.text)
      return textParts.join('\n') || JSON.stringify((result as { content?: unknown }).content)
    },

    async findToolServer(toolName: string): Promise<string | null> {
      const allTools = await this.getToolDefinitions()
      const match = allTools.find(t => t.name === toolName)
      return match ? match.server : null
    },

    async shutdown() {
      for (const [name, { client, transport }] of connections) {
        try {
          await client.close()
        } catch {
          /* ignore */
        }
        try {
          if ((transport as { close?: () => Promise<void> }).close)
            await (transport as { close: () => Promise<void> }).close()
        } catch {
          /* ignore */
        }
        logger.info(`MCP server "${name}" shut down`)
      }
      connections.clear()
      toolCache.clear()
      initialized = false
    },

    isInitialized() {
      return initialized
    },
  }
}

export { DEFAULT_SERVERS }
