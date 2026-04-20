export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, json } from '@/lib/service-context'

export async function GET(_req: NextRequest) {
  const s = getServices()
  const { loadMcpConfig } = require('@agentflow/cli/mcp/config-manager')
  const { parseRoot } = require('@agentflow/cli/parser')
  const result = loadMcpConfig(s.rootDir)
  const tools: any[] = []
  const seen = new Set<string>()

  for (const [serverName, cfg] of Object.entries(result.servers || {}) as any) {
    if (cfg.disabled) continue
    for (const t of (cfg.discoveredTools || [])) {
      const name = typeof t === 'object' ? t.name : String(t)
      if (!seen.has(name)) {
        seen.add(name)
        tools.push({ name, description: typeof t === 'object' ? t.description || '' : '', server: serverName, source: 'mcp' })
      }
    }
  }

  const graph = parseRoot(s.rootDir)
  for (const [name, tool] of Object.entries(graph.tools || {}) as any) {
    const fm = tool.frontmatter || tool.primaryFile?.frontmatter || {}
    if (fm.type === 'mcp' && !seen.has(name)) {
      seen.add(name)
      tools.push({ name, description: fm.description || tool.title || '', server: fm.mcp || fm.server || 'unknown', source: 'mcp' })
    }
  }
  return json({ tools })
}
