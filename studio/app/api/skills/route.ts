export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const exec = promisify(execFile)

/** GET /api/skills?q=... — search skills.sh */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json({ skills: [] })
  try {
    const res = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) return NextResponse.json({ skills: [] })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ skills: [] })
  }
}

/** Recursively read all files under a directory, returning relative paths + content */
function readDirRecursive(dir: string, prefix = ''): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...readDirRecursive(full, rel))
    } else {
      try {
        results.push({ path: rel, content: fs.readFileSync(full, 'utf8') })
      } catch { /* skip binary/unreadable files */ }
    }
  }
  return results
}

/** POST /api/skills — download skill via npx skills, return all files */
export async function POST(req: NextRequest) {
  const { source, skill } = await req.json()
  if (!source) return NextResponse.json({ error: 'source required' }, { status: 400 })

  const tmpDir = path.join(os.tmpdir(), `af-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    // Build args: npx skills add <source> --agent universal --yes [--skill <name>]
    const args = ['skills', 'add', source, '--agent', 'universal', '--yes', '--copy']
    if (skill) args.push('--skill', skill)

    await exec('npx', args, { cwd: tmpDir, timeout: 60_000 })

    // Skills land in .agents/skills/ for the "universal" agent
    const skillsDir = path.join(tmpDir, '.agents', 'skills')
    if (!fs.existsSync(skillsDir)) {
      return NextResponse.json({ error: 'No skills found after install' }, { status: 404 })
    }

    // Read each skill directory
    const skills: { name: string; dir: string; files: { path: string; content: string }[] }[] = []
    for (const dir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const files = readDirRecursive(path.join(skillsDir, dir.name))
      if (files.length === 0) continue
      // Extract name from SKILL.md frontmatter if available
      const skillMd = files.find(f => f.path === 'SKILL.md')
      let name = dir.name
      if (skillMd) {
        const match = skillMd.content.match(/^---[\s\S]*?name:\s*(.+)/m)
        if (match) name = match[1].trim()
      }
      skills.push({ name, dir: dir.name, files })
    }

    if (skills.length === 0) {
      return NextResponse.json({ error: 'No skills found' }, { status: 404 })
    }

    return NextResponse.json({ skills, source })
  } catch (err: any) {
    const msg = err.stderr?.toString().slice(0, 300) || err.message?.slice(0, 300) || 'Unknown error'
    return NextResponse.json({ error: `Install failed: ${msg}` }, { status: 500 })
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
