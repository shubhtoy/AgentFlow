export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { json } from '@/lib/service-context'
import { getMode } from '@/lib/runtime'

export async function GET(_req: NextRequest) {
  const mode = getMode()
  return json({ noEnv: mode === 'online', mode: mode === 'online' ? 'multi-user' : 'default' })
}
