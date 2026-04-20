export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, sendResult } from '@/lib/service-context'

export async function GET(req: NextRequest) {
  const s = getServices()
  const strict = req.nextUrl.searchParams.get('strict') === 'true'
  return sendResult(s.validation.validate({ strict }))
}
