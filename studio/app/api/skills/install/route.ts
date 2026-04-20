export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServices } from '@/lib/service-context'

const fs = require('fs')
const path = require('path')

export async function POST(req: NextRequest) {
  const { skills } = await req.json() as {
    skills: { dir: string; category: string }[]
  }
  if (!skills?.length) return NextResponse.json({ error: 'No skills' }, { status: 400 })

  const { rootDir } = getServices()
  const projectRoot = path.dirname(rootDir)
  const agentsDir = path.join(projectRoot, '.agents', 'skills')
  const installed: { name: string; category: string; path: string }[] = []

  for (const skill of skills) {
    const skillMd = path.join(agentsDir, skill.dir, 'SKILL.md')
    if (!fs.existsSync(skillMd)) continue
    const content = fs.readFileSync(skillMd, 'utf8')
    const destDir = path.join(rootDir, skill.category)
    fs.mkdirSync(destDir, { recursive: true })
    fs.writeFileSync(path.join(destDir, `${skill.dir}.md`), content, 'utf8')
    installed.push({ name: skill.dir, category: skill.category, path: `${skill.category}/${skill.dir}.md` })
  }

  return NextResponse.json({ success: true, installed })
}
