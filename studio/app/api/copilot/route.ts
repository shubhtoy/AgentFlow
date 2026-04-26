export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getServerMode, getSessionKeys, setSessionKeys } from '@/lib/copilot/key-store'
import { getAllModels, getProviders, getSelectedModel, setSelectedModel, filterModels, getAvailableProviders } from '@/lib/copilot/model-registry'

const ENV_PATH = path.join(process.cwd(), '.env.local')

const KNOWN_KEYS = [
  'OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY',
  'GROQ_API_KEY', 'MISTRAL_API_KEY', 'DEEPSEEK_API_KEY', 'XAI_API_KEY', 'TAVILY_API_KEY',
]

function readEnvFile(): Record<string, string> {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8')
    const vars: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      vars[key] = val
    }
    return vars
  } catch { return {} }
}

function writeEnvFile(updates: Record<string, string>) {
  let lines: string[] = []
  try { lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n') } catch {}
  const written = new Set<string>()
  const result = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const eq = trimmed.indexOf('=')
    if (eq === -1) return line
    const key = trimmed.slice(0, eq).trim()
    if (key in updates) { written.add(key); return updates[key] ? `${key}=${updates[key]}` : null }
    return line
  }).filter((l): l is string => l !== null)
  for (const [key, val] of Object.entries(updates)) { if (!written.has(key) && val) result.push(`${key}=${val}`) }
  fs.writeFileSync(ENV_PATH, result.join('\n') + '\n')
  for (const [key, val] of Object.entries(updates)) { if (val) process.env[key] = val; else delete process.env[key] }
}

function getSessionId(req: NextRequest): string {
  return req.cookies.get('af-session')?.value || 'default'
}

/** GET /api/copilot?action=keys|models (default: models) */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'models'

  if (action === 'keys') {
    const noEnv = getServerMode() === 'multi-user'
    const sessionId = getSessionId(req)
    const status: Record<string, { set: boolean; masked: string }> = {}
    if (noEnv) {
      const sessionKeys = getSessionKeys(sessionId)
      for (const key of KNOWN_KEYS) { const val = sessionKeys[key] || ''; status[key] = { set: !!val, masked: val ? val.slice(0, 4) + '...' + val.slice(-4) : '' } }
    } else {
      const env = readEnvFile()
      for (const key of KNOWN_KEYS) { const val = env[key] || process.env[key] || ''; status[key] = { set: !!val, masked: val ? val.slice(0, 4) + '...' + val.slice(-4) : '' } }
    }
    return NextResponse.json({ keys: status, mode: noEnv ? 'multi-user' : 'default' })
  }

  // Default: models
  const sp = req.nextUrl.searchParams
  const sessionId = req.cookies.get('af-session')?.value
  const f = {
    provider: sp.get('provider') || undefined,
    free: sp.has('free') ? sp.get('free') === 'true' : undefined,
    tag: sp.get('tag') || undefined,
    search: sp.get('q') || undefined,
    supportsTool: sp.has('tools') ? sp.get('tools') === 'true' : undefined,
  }
  const hasFilter = Object.values(f).some(v => v !== undefined)
  return NextResponse.json({
    current: getSelectedModel(),
    models: hasFilter ? filterModels(f) : getAllModels(),
    providers: getProviders(),
    availableProviders: getAvailableProviders(sessionId),
  })
}

/** POST /api/copilot — action: "keys" | "model" */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = body.action || 'model'

  if (action === 'keys') {
    const noEnv = getServerMode() === 'multi-user'
    const updates: Record<string, string> = {}
    for (const key of KNOWN_KEYS) { if (key in body) updates[key] = body[key] || '' }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No valid keys' }, { status: 400 })
    if (noEnv) {
      const sessionId = getSessionId(req)
      const existing = getSessionKeys(sessionId)
      const merged = { ...existing }
      for (const [k, v] of Object.entries(updates)) { if (v) merged[k] = v; else delete merged[k] }
      setSessionKeys(sessionId, merged)
    } else { writeEnvFile(updates) }
    const res = NextResponse.json({ ok: true, updated: Object.keys(updates) })
    if (!req.cookies.get('af-session')) res.cookies.set('af-session', crypto.randomUUID(), { httpOnly: true, sameSite: 'lax', maxAge: 86400 * 30 })
    return res
  }

  // Default: model
  const { model } = body
  if (!model || typeof model !== 'string') return NextResponse.json({ error: 'model string required' }, { status: 400 })
  setSelectedModel(model)
  return NextResponse.json({ ok: true, model })
}
