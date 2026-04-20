export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { json } from '@/lib/service-context'

export async function GET(req: NextRequest) {
  const { searchRegistry } = require('@agentflow/core/mcp/registry-client')
  const q = req.nextUrl.searchParams.get('q') || req.nextUrl.searchParams.get('search') || ''
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10)
  const cursor = req.nextUrl.searchParams.get('cursor') || undefined
  const updatedSince = req.nextUrl.searchParams.get('updated_since') || undefined
  try {
    const result = await searchRegistry(q, { limit, cursor, updatedSince })
    return json({ servers: result.entries, nextCursor: result.nextCursor, count: result.count })
  } catch (err: any) {
    return json({ error: err.message }, 502)
  }
}
