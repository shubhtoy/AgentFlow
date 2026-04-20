export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { parseClientFiles } from '@/lib/parse-client-files'

export async function POST(req: NextRequest) {
  const { files } = await req.json() as { files: { path: string; content: string }[] }
  if (!files?.length) return NextResponse.json({ error: 'No files' }, { status: 400 })

  const result = parseClientFiles(files)
  result.rootDir = '.'
  return NextResponse.json(result)
}
