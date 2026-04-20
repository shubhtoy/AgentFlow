export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, json } from '@/lib/service-context'

export async function GET(_req: NextRequest) {
  return json(getServices().brandConfig)
}
