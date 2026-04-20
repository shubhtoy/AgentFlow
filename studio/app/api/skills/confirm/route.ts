export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { skills } = await req.json() as {
    skills: { dir: string; category: string; content: string }[]
  }
  if (!skills?.length) return NextResponse.json({ error: 'No skills' }, { status: 400 })

  // Return files for the client to write (works with any workspace adapter)
  const files = skills.map(s => ({
    path: `${s.category}/${s.dir}.md`,
    content: s.content,
    name: s.dir,
    category: s.category,
  }))

  return NextResponse.json({ success: true, installed: files })
}
