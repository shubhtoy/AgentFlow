export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

const { HookDefinitionSchema } = require('@agentflow/services/hook-registry')

export async function GET(_req: NextRequest) {
  const s = getServices()
  return json({ hooks: s.hookRegistry.list() })
}

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const parsed = HookDefinitionSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: parsed.error.message }, 400)
  }
  try {
    const hook = s.hookRegistry.addHook(parsed.data)
    return json(hook, 201)
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
