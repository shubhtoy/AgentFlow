export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, sendResult } from '@/lib/service-context'

export async function GET(req: NextRequest) {
  const s = getServices()
  const dir = req.nextUrl.searchParams.get('dir') || undefined
  const depthParam = req.nextUrl.searchParams.get('depth')
  const depth = depthParam ? parseInt(depthParam, 10) || undefined : undefined
  return sendResult(s.git.scan(dir, depth))
}
