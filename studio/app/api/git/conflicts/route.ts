export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, sendResult } from '@/lib/service-context'

export async function GET(_req: NextRequest) {
  const s = getServices()
  return sendResult(s.git.getConflicts())
}
