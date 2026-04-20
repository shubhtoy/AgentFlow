export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, sendResult } from '@/lib/service-context'

export async function GET(req: NextRequest) {
  const s = getServices()
  const repo = req.nextUrl.searchParams.get('repo') || undefined
  return sendResult(await s.git.getStatus(repo))
}
