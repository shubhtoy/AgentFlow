export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

/** GET /api/library — serve library registry entries for the Assets panel */
export async function GET() {
  try {
    const registryPath = path.join(process.cwd(), 'public', 'library', 'registry.json')
    if (!fs.existsSync(registryPath)) {
      return NextResponse.json({ entries: [] })
    }
    const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
    const entries = (raw.entries ?? []).map((e: any) => ({ ...e, builtin: true }))
    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ entries: [] })
  }
}
