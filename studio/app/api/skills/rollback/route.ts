export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServices } from '@/lib/service-context'

const fs = require('fs')
const path = require('path')

export async function POST(req: NextRequest) {
  const { dirs } = await req.json() as { dirs: string[] }
  if (!dirs?.length) return NextResponse.json({ ok: true })

  const { rootDir } = getServices()
  const projectRoot = path.dirname(rootDir)
  const agentsDir = path.join(projectRoot, '.agents', 'skills')

  for (const dir of dirs) {
    const target = path.join(agentsDir, dir)
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
  }

  return NextResponse.json({ ok: true })
}
