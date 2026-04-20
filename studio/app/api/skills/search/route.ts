export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json({ skills: [] })

  const res = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) return NextResponse.json({ skills: [] })

  const data = await res.json()
  return NextResponse.json(data)
}
