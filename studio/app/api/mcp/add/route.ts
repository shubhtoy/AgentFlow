export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

export async function POST(req: NextRequest) {
  const s = getServices()
  const { addServer } = require('@agentflow/mcp/config-manager')
  const { searchRegistry } = require('@agentflow/mcp/registry-client')
  const { name, registryName, env, required } = await jsonBody(req)
  if (!name) return json({ error: 'name is required' }, 400)
  try {
    let registryEntry = null
    if (registryName) {
      const result = await searchRegistry(registryName, { limit: 20 })
      const exact = result.entries.filter((e: any) => e.name === registryName)
      const partial = exact.length > 0 ? exact : result.entries.filter((e: any) =>
        e.name.endsWith('/' + registryName) || e.name.includes(registryName)
      )
      const candidates = partial.length > 0 ? partial : result.entries
      registryEntry = candidates.find((e: any) => e.isLatest) || candidates[0] || null
    }
    const source = registryEntry || { name, packages: [], remotes: [] }
    const entry = addServer(s.rootDir, name, source, { env, required })
    return json({ ok: true, entry })
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
