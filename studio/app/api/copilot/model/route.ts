export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllModels, getProviders, getSelectedModel, setSelectedModel, filterModels, getAvailableProviders,
} from '@/lib/copilot/model-registry'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const sessionId = req.cookies.get('af-session')?.value
  const f = {
    provider: sp.get('provider') || undefined,
    free: sp.has('free') ? sp.get('free') === 'true' : undefined,
    tag: sp.get('tag') || undefined,
    search: sp.get('q') || undefined,
    supportsTool: sp.has('tools') ? sp.get('tools') === 'true' : undefined,
  }
  const hasFilter = Object.values(f).some(v => v !== undefined)
  const models = hasFilter ? filterModels(f) : getAllModels()

  return NextResponse.json({
    current: getSelectedModel(),
    models,
    providers: getProviders(),
    availableProviders: getAvailableProviders(sessionId),
  })
}

export async function POST(req: NextRequest) {
  const { model } = await req.json()
  if (!model || typeof model !== 'string') {
    return NextResponse.json({ error: 'model string required' }, { status: 400 })
  }
  setSelectedModel(model)
  return NextResponse.json({ ok: true, model })
}
