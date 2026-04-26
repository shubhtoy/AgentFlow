export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServices } from '@/lib/service-context'
import { safePath } from '@/lib/safe-path'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
import { parseFrontmatter as parseFM } from '@agentflow/core/parser-core'

function classifySkill(content: string): string {
  const lower = content.toLowerCase()
  if (['mcp', 'tool', 'api key', 'server must', 'cli', 'npx ', 'endpoint'].filter(s => lower.includes(s)).length >= 3) return 'capabilities'
  if (['step 1', 'step 2', 'follow these steps', 'approval', 'human review'].filter(s => lower.includes(s)).length >= 2) return 'instructions'
  return 'instructions'
}

/** GET /api/skills?q=... — search skills.sh */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json({ skills: [] })
  const res = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) return NextResponse.json({ skills: [] })
  return NextResponse.json(await res.json())
}

/** POST /api/skills — action: "preview" | "rollback" */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = body.action || 'preview'

  if (action === 'rollback') {
    const { dirs } = body as { dirs: string[] }
    if (!dirs?.length) return NextResponse.json({ ok: true })
    const { rootDir } = getServices()
    const projectRoot = path.dirname(rootDir)
    const agentsDir = path.join(projectRoot, '.agents', 'skills')
    for (const dir of dirs) {
      const target = safePath(dir, agentsDir)
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
    }
    return NextResponse.json({ ok: true })
  }

  // Default: preview
  const { source, skillId } = body
  if (!source) return NextResponse.json({ error: 'source required' }, { status: 400 })

  const tmpDir = path.join(os.tmpdir(), `af-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    execSync(`npx skills add ${source} --yes`, { cwd: tmpDir, timeout: 60000, stdio: 'pipe' })
    const agentsDir = path.join(tmpDir, '.agents', 'skills')
    const skills: any[] = []
    if (fs.existsSync(agentsDir)) {
      for (const dir of fs.readdirSync(agentsDir)) {
        const skillMd = path.join(agentsDir, dir, 'SKILL.md')
        if (!fs.existsSync(skillMd)) continue
        const content = fs.readFileSync(skillMd, 'utf8')
        const fm = parseFM(content).data || {}
        skills.push({ name: fm.name || dir, category: classifySkill(content), description: fm.description || '', content, dir })
      }
    }
    if (skills.length === 0) return NextResponse.json({ error: 'No skills found' }, { status: 404 })
    let filtered = skills
    if (skillId) {
      const match = skills.find(s => s.dir === skillId || s.name.toLowerCase().replace(/\s+/g, '-') === skillId.toLowerCase())
      if (match) filtered = [match]
    }
    return NextResponse.json({ skills: filtered, source })
  } catch (err: any) {
    return NextResponse.json({ error: `Install failed: ${err.stderr?.toString().slice(0, 200) || err.message?.slice(0, 200)}` }, { status: 500 })
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
