export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

export async function GET(_req: NextRequest) {
  const s = getServices()
  return json({ docs: s.instructionManager.list() })
}

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const { name, content, inclusion, description, tags } = body
  if (!name || typeof name !== 'string') {
    return json({ error: 'name is required' }, 400)
  }
  if (!content || typeof content !== 'string') {
    return json({ error: 'content is required' }, 400)
  }
  try {
    s.instructionManager.add(name, content, { inclusion, description, tags })
    return json({ ok: true, name }, 201)
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
}
