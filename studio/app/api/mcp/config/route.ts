export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, json } from '@/lib/service-context'

const path = require('path')

export async function GET(_req: NextRequest) {
  const s = getServices()
  const { loadMcpConfig } = require('@agentflow/mcp/config-manager')
  const result = loadMcpConfig(s.rootDir)
  const servers = Object.entries(result.servers || {}).map(([name, cfg]: [string, any]) => {
    const toolNames = Array.isArray(cfg.discoveredTools) ? cfg.discoveredTools : []
    const tools = toolNames.map((t: any) => {
      if (typeof t === 'object' && t.name) return { name: t.name, description: t.description || '' }
      return { name: String(t), description: '' }
    })
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
