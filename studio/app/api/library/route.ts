export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const fs = require('fs')
const path = require('path')

export async function GET(_req: NextRequest) {
  // Try multiple paths
  const candidates = [
    path.join(process.cwd(), '..', 'library', 'registry.json'),
    path.join(process.cwd(), 'library', 'registry.json'),
    path.resolve('library', 'registry.json'),
  ]

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const registry = JSON.parse(fs.readFileSync(p, 'utf8'))
      return NextResponse.json(registry)
    }
  }

  return NextResponse.json({ version: '0.0.0', entries: [] })
}
