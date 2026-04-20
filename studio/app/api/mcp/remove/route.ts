export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

export async function POST(req: NextRequest) {
  const s = getServices()
  const { removeServer } = require('@agentflow/cli/mcp/config-manager')
  const { name } = await jsonBody(req)
  if (!name) return json({ error: 'name is required' }, 400)
  await removeServer(s.rootDir, name)
  return json({ ok: true })
}
