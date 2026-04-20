export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, sendResult } from '@/lib/service-context'

export async function GET(_req: NextRequest) {
  const s = getServices()
  return sendResult(s.git.getConfig())
}

export async function PUT(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  return sendResult(s.git.updateConfig(body))
}
