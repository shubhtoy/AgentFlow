export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

export async function POST(req: NextRequest) {
  const s = getServices()
  const { loadMcpConfig, saveMcpConfig } = require('@agentflow/mcp/config-manager')
  const { name, disabled } = await jsonBody(req)
  if (!name) return json({ error: 'name is required' }, 400)
  const result = loadMcpConfig(s.rootDir)
  if (result.servers[name]) {
    result.servers[name].disabled = disabled
    saveMcpConfig(s.rootDir, result.servers)
  }
  return json({ ok: true })
}
