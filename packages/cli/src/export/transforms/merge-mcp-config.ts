export interface McpCapability {
  name: string
  mcp: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export function mergeMcpConfig(capabilities: McpCapability[], format: string): Record<string, string> {
  if (!capabilities.length) return {}

  const servers: Record<string, unknown> = {}
  for (const cap of capabilities) {
    const entry: Record<string, unknown> = {}
    if (cap.command) entry.command = cap.command
    if (cap.args) entry.args = cap.args
    if (cap.env && Object.keys(cap.env).length) entry.env = cap.env
    if (!cap.command && cap.mcp) entry.command = cap.mcp
    servers[cap.name] = entry
  }

  if (format === 'claude-settings') {
    return { content: JSON.stringify({ mcpServers: servers }, null, 2) }
  }

  return { content: JSON.stringify({ mcpServers: servers }, null, 2) }
}
