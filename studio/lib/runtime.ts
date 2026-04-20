/**
 * runtime.ts — Single source of truth for the AgentFlow platform runtime.
 *
 * Replaces: service-context.ts ROOT_DIR, agent.ts getAgentflowRoot(),
 *           system-prompt.ts getWorkspaceRoot(), server-tools.ts getAgentflowRoot(),
 *           key-store.ts mode detection.
 *
 * Two modes, same code path:
 *   local  → real disk, .env.local keys, shell allowed
 *   online → sandboxed per-session dir, session keys, shell blocked
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { DEFAULT_AGENTS_MD } from './workspace'

// ─── Mode ────────────────────────────────────────────────────────────────

export type Mode = 'local' | 'online'

let _mode: Mode | null = null

export function getMode(): Mode {
  if (_mode) return _mode
  if (process.env.AF_MODE === 'online') return (_mode = 'online')
  if (process.env.AF_MODE === 'local') return (_mode = 'local')
  if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER) return (_mode = 'online')
  return (_mode = 'local')
}

// ─── Workspace Resolution (the ONE place) ────────────────────────────────

const SESSION_DIR = path.join(os.tmpdir(), 'af-sessions')
const SESSION_TTL = 24 * 60 * 60 * 1000

/** Walk up from cwd looking for .agentflow/ */
function detectLocalRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.agentflow')
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return ensureSessionDir('default')
}

function ensureSessionDir(sessionId: string): string {
  const wsRoot = path.join(SESSION_DIR, sessionId, '.agentflow')
  if (!fs.existsSync(wsRoot)) {
    fs.mkdirSync(path.join(wsRoot, 'memory'), { recursive: true })
    fs.writeFileSync(path.join(wsRoot, 'AGENTS.md'), DEFAULT_AGENTS_MD)
    fs.writeFileSync(path.join(wsRoot, 'memory', 'user.md'), '---\nname: user\neditable: true\n---\n')
  }
  return wsRoot
}

export function getWorkspaceRoot(sessionId?: string): string {
  if (getMode() === 'local') {
    return process.env.AGENTFLOW_ROOT || detectLocalRoot()
  }
  return ensureSessionDir(sessionId || 'default')
}

/** Parent of .agentflow/ — the project root */
export function getProjectRoot(sessionId?: string): string {
  return path.dirname(getWorkspaceRoot(sessionId))
}

// ─── Keys (unified — replaces key-store.ts) ──────────────────────────────

const KEYS_FILE = path.join(process.cwd(), '.copilot-keys.json')

interface SessionEntry { keys: Record<string, string>; ts: number }

function readKeyStore(): Record<string, SessionEntry> {
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8')) } catch { return {} }
}

function writeKeyStore(store: Record<string, SessionEntry>) {
  const now = Date.now()
  for (const [id, e] of Object.entries(store)) {
    if (now - e.ts > SESSION_TTL) delete store[id]
  }
  fs.writeFileSync(KEYS_FILE, JSON.stringify(store))
}

export function getSessionKeys(sessionId: string): Record<string, string> {
  const store = readKeyStore()
  const entry = store[sessionId]
  if (!entry) return {}
  entry.ts = Date.now()
  writeKeyStore(store)
  return entry.keys
}

export function setSessionKeys(sessionId: string, keys: Record<string, string>) {
  const store = readKeyStore()
  store[sessionId] = { keys, ts: Date.now() }
  writeKeyStore(store)
}

export function resolveKey(envKey: string, sessionId?: string): string | undefined {
  if (getMode() === 'online' && sessionId) {
    const k = getSessionKeys(sessionId)[envKey]
    if (k) return k
  }
  return process.env[envKey] || undefined
}

// ─── Session Context (everything the agent/services need) ────────────────

export interface Ctx {
  sessionId: string
  mode: Mode
  workspaceRoot: string
  projectRoot: string
  shellEnabled: boolean
}

export function ctx(sessionId = 'default'): Ctx {
  const mode = getMode()
  const workspaceRoot = getWorkspaceRoot(sessionId)
  return {
    sessionId,
    mode,
    workspaceRoot,
    projectRoot: path.dirname(workspaceRoot),
    shellEnabled: mode === 'local',
  }
}

// ─── Extract session ID from request ─────────────────────────────────────

export function sessionFromRequest(req: Request): string {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/af-session=([^;]+)/)
  return match?.[1] || 'default'
}

// ─── Cleanup stale online sessions ───────────────────────────────────────

export function cleanupStaleSessions() {
  if (getMode() !== 'online' || !fs.existsSync(SESSION_DIR)) return
  const now = Date.now()
  for (const dir of fs.readdirSync(SESSION_DIR)) {
    const p = path.join(SESSION_DIR, dir)
    try {
      const stat = fs.statSync(p)
      if (now - stat.mtimeMs > SESSION_TTL) fs.rmSync(p, { recursive: true, force: true })
    } catch {}
  }
}
