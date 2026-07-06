/**
 * MCP Config Manager.
 */

import fs from 'fs'
import path from 'path'

export const MCP_CONFIG_FILENAME = 'mcp.json'
export const AGENTFLOW_DIR = '.agentflow'

interface McpServerEntry {
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  required?: boolean
  description?: string
  registryName?: string
  version?: string
  discoveredTools?: string[]
  disabled?: boolean
}

interface McpConfig {
  servers: Record<string, McpServerEntry>
  errors: string[]
}

export function mcpConfigPath(rootDir: string): string {
  return path.join(rootDir, AGENTFLOW_DIR, MCP_CONFIG_FILENAME)
}

export function loadMcpConfig(rootDir: string): McpConfig {
  const configPath = mcpConfigPath(rootDir)
  if (!fs.existsSync(configPath)) return { servers: {}, errors: [] }

  let raw: string
  try {
    raw = fs.readFileSync(configPath, 'utf-8')
  } catch (err: unknown) {
    return { servers: {}, errors: [`Failed to read ${configPath}: ${(err as Error).message}`] }
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch (err: unknown) {
    return { servers: {}, errors: [`Failed to parse mcp.json: ${(err as Error).message}`] }
  }

  const servers =
    parsed && typeof parsed === 'object' && parsed.mcpServers
      ? (parsed.mcpServers as Record<string, McpServerEntry>)
      : {}

  return { servers, errors: [] }
}

export function saveMcpConfig(rootDir: string, servers: Record<string, McpServerEntry>): void {
  const configPath = mcpConfigPath(rootDir)
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: servers }, null, 2), 'utf-8')
}

export function addServer(
  rootDir: string,
  name: string,
  registryEntry: Record<string, unknown>,
  opts: { required?: boolean; env?: Record<string, string> } = {},
): McpServerEntry {
  const { servers } = loadMcpConfig(rootDir)
  const server = (registryEntry.server || registryEntry) as Record<string, unknown>
  const entry: McpServerEntry = {}

  const pkg = ((server.packages || []) as Record<string, unknown>[]).find(
    p =>
      (p.transport as Record<string, unknown>)?.type === 'stdio' ||
      p.registryType === 'npm' ||
      p.registryType === 'pypi',
  )
  const remote = ((server.remotes || []) as Record<string, unknown>[])[0]

  if (pkg) {
    if (pkg.registryType === 'npm') {
      entry.command = 'npx'
      entry.args = ['-y', pkg.identifier as string]
    } else if (pkg.registryType === 'pypi') {
      entry.command = 'uvx'
      entry.args = [pkg.identifier as string]
    }
  } else if (remote) {
    entry.url = remote.url as string
  }

  entry.env = {}
  for (const ev of (server.environmentVariables || []) as { name: string; format?: string }[]) {
    if (ev.name && ev.format !== 'header') entry.env[ev.name] = `\${env:${ev.name}}`
  }
  if (opts.env) Object.assign(entry.env, opts.env)
  if (opts.required) entry.required = true
  if (server.description) entry.description = server.description as string
  if (server.name) entry.registryName = server.name as string
  if (server.version) entry.version = server.version as string
  entry.discoveredTools = []

  servers[name] = entry
  saveMcpConfig(rootDir, servers)
  return entry
}

export function removeServer(rootDir: string, name: string, opts: { removeTools?: boolean } = {}): void {
  const { servers } = loadMcpConfig(rootDir)
  const entry = servers[name]
  if (!entry) return

  if (opts.removeTools && Array.isArray(entry.discoveredTools)) {
    const toolsDir = path.join(rootDir, AGENTFLOW_DIR, 'capabilities')
    for (const toolName of entry.discoveredTools) {
      try {
        fs.unlinkSync(path.join(toolsDir, `${toolName}.md`))
      } catch {
        /* ignore */
      }
    }
  }

  delete servers[name]
  saveMcpConfig(rootDir, servers)
}

export function resolveEnvTokens(env: Record<string, unknown> | undefined): Record<string, string> {
  if (!env || typeof env !== 'object') return {}
  const resolved: Record<string, string> = {}
  const tokenPattern = /^\$\{env:([^}]+)\}$/

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') {
      resolved[key] = String(value)
      continue
    }
    const match = value.match(tokenPattern)
    resolved[key] = match ? (process.env[match[1]] ?? '') : value
  }
  return resolved
}
