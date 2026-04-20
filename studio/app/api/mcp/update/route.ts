export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

/**
 * POST /api/mcp/update — Update a server's config fields.
 * Body: { name, env?, disabled?, url?, command?, args? }
 */
export async function POST(req: NextRequest) {
  const s = getServices()
  const { loadMcpConfig, saveMcpConfig } = require('@agentflow/mcp/config-manager')
  const { name, env, disabled, url, command, args } = await jsonBody(req)
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
