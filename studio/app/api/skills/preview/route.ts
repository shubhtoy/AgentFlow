export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

function classifySkill(content: string): string {
  const lower = content.toLowerCase()
  if (['mcp', 'tool', 'api key', 'server must', 'cli', 'npx ', 'endpoint'].filter(s => lower.includes(s)).length >= 3) return 'capabilities'
  if (['step 1', 'step 2', 'follow these steps', 'approval', 'human review'].filter(s => lower.includes(s)).length >= 2) return 'runbooks'
  return 'instructions'
}

const { parseFrontmatter: parseFM } = require('@agentflow/parser-core')

function parseFrontmatter(content: string) {
  return parseFM(content).data || {}
}

export async function POST(req: NextRequest) {
  const { source, skillId } = await req.json()
  if (!source) return NextResponse.json({ error: 'source required' }, { status: 400 })

  // Isolated temp dir per request
  const tmpDir = path.join(os.tmpdir(), `af-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    execSync(`npx skills add ${source} --yes`, {
      cwd: tmpDir,
      timeout: 60000,
      stdio: 'pipe',
    })

    // Read installed skills from temp dir
    const agentsDir = path.join(tmpDir, '.agents', 'skills')
    const skills: any[] = []

    if (fs.existsSync(agentsDir)) {
      for (const dir of fs.readdirSync(agentsDir)) {
        const skillMd = path.join(agentsDir, dir, 'SKILL.md')
        if (!fs.existsSync(skillMd)) continue
        const content = fs.readFileSync(skillMd, 'utf8')
        const fm = parseFrontmatter(content)
        skills.push({
          name: fm.name || dir,
          category: classifySkill(content),
          description: fm.description || '',
          content,
          dir,
        })
      }
    }

    if (skills.length === 0) {
      return NextResponse.json({ error: 'No skills found' }, { status: 404 })
    }

    // Filter to requested skill if specified
    let filtered = skills
    if (skillId) {
      const match = skills.find(s =>
        s.dir === skillId || s.name.toLowerCase().replace(/\s+/g, '-') === skillId.toLowerCase()
      )
      if (match) filtered = [match]
    }

    return NextResponse.json({ skills: filtered, source })
  } catch (err: any) {
    return NextResponse.json({ error: `Install failed: ${err.stderr?.toString().slice(0, 200) || err.message?.slice(0, 200)}` }, { status: 500 })
  } finally {
    // Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
