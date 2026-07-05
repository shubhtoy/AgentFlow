#!/usr/bin/env node
/**
 * Generates studio/public/dashboard.html — a living, static snapshot of project state.
 *
 * Not a project-management tool: a quick-glance overview (test/lint/build health, recent
 * commits, epic/task progress) so you can see where things stand without digging through
 * the board or running commands yourself. Deploys automatically with the existing studio
 * Vercel pipeline (it's a static file in public/, no new infra).
 *
 * Run manually (`npm run dashboard`) or wire into CI/pre-push. Requires `gh` auth for the
 * board section — falls back gracefully (omits that section) if `gh` isn't available, so it
 * never blocks on a missing credential. All data is a snapshot as of generation time, not
 * fetched live by the deployed page (keeps the page a static file, no exposed credentials,
 * no runtime dependency on GitHub auth from a visitor's browser).
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'studio', 'public', 'dashboard.html')

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim()
  } catch (err) {
    // Some commands (tsc --build, npm run lint) legitimately exit non-zero while still
    // producing useful stdout we want to parse (e.g. error counts) — return it if present,
    // rather than discarding real output just because the exit code was non-zero.
    if (err.stdout) return String(err.stdout).trim()
    console.warn(`[dashboard] command failed, section will be omitted/degraded: ${cmd}\n  ${err.message.split('\n')[0]}`)
    return null
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// ── Git ────────────────────────────────────────────────────────────────

function getGitInfo() {
  const branch = sh('git rev-parse --abbrev-ref HEAD') || 'unknown'
  const sha = sh('git rev-parse --short HEAD') || 'unknown'
  const log = sh("git log -12 --pretty=format:'%h|||%s|||%ar|||%an'") || ''
  const commits = log
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, subject, when, author] = line.split('|||')
      return { hash, subject, when, author }
    })
  const dirty = sh('git status --porcelain') || ''
  return { branch, sha, commits, clean: dirty.length === 0 }
}

// ── Tests ──────────────────────────────────────────────────────────────

function getTestInfo() {
  const raw = sh('npx vitest run 2>&1', { maxBuffer: 1024 * 1024 * 20 })
  if (!raw) return null
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '')
  const filesMatch = clean.match(/Test Files\s+(.+)/)
  const testsMatch = clean.match(/\n\s*Tests\s+(.+)/)
  return {
    files: filesMatch ? filesMatch[1].trim() : 'unknown',
    tests: testsMatch ? testsMatch[1].trim() : 'unknown',
    raw: clean.includes('failed') && !clean.includes('0 failed'),
  }
}

// ── Lint / typecheck ───────────────────────────────────────────────────

function getLintInfo() {
  const out = sh('npm run lint 2>&1')
  const ok = out !== null && !/error/i.test(out)
  return { ok, summary: ok ? '0 errors, 0 warnings' : 'errors present — see `npm run lint`' }
}

function getTypecheckInfo() {
  const out = sh('npx tsc --build 2>&1') || ''
  const errorCount = (out.match(/error TS/g) || []).length
  return { errorCount, ok: errorCount === 0 }
}

// ── GitHub project board (optional — requires gh auth) ─────────────────

function getBoardInfo() {
  const raw = sh('gh project item-list 4 --owner shubhtoy --format json --limit 100')
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    const items = data.items || []
    const byStatus = {}
    const epics = []
    for (const it of items) {
      const status = it.status || '(none)'
      byStatus[status] = (byStatus[status] || 0) + 1
      const isEpic = /^Setup:|^Stabilization/.test(it.content?.title || '')
      if (isEpic) {
        epics.push({
          number: it.content?.number,
          title: it.content?.title,
          status: it.status || '(none)',
          priority: it.priority || '',
          points: it.storyPoints ?? it['story Points'] ?? null,
        })
      }
    }
    epics.sort((a, b) => (a.number || 0) - (b.number || 0))
    return { total: items.length, byStatus, epics }
  } catch {
    return null
  }
}

// ── Docs snapshot ──────────────────────────────────────────────────────

function getDocsInfo() {
  const files = ['docs/DECISIONS.md', 'docs/USER-CORRECTIONS.md', 'docs/FEATURE-MAP.md', 'docs/CODING-STANDARDS.md']
  return files.map(f => {
    const full = path.join(ROOT, f)
    if (!fs.existsSync(full)) return { file: f, exists: false }
    const content = fs.readFileSync(full, 'utf-8')
    const lines = content.split('\n').length
    const entries = (content.match(/^## /gm) || []).length
    return { file: f, exists: true, lines, entries }
  })
}

// ── Render ─────────────────────────────────────────────────────────────

function statusBadge(ok) {
  return ok
    ? '<span class="badge badge-ok">green</span>'
    : '<span class="badge badge-bad">red</span>'
}

function render(data) {
  const { git, tests, lint, typecheck, board, docs } = data
  const generatedAt = new Date().toISOString()

  const commitRows = git.commits
    .map(
      c => `<tr><td class="mono">${esc(c.hash)}</td><td>${esc(c.subject)}</td><td class="muted">${esc(c.when)}</td></tr>`,
    )
    .join('\n')

  const boardSection = board
    ? `
    <section class="card">
      <h2>Project board</h2>
      <p class="muted">${board.total} tracked items — ${Object.entries(board.byStatus)
        .map(([k, v]) => `${esc(k)}: ${v}`)
        .join(' · ')}</p>
      <table>
        <thead><tr><th>#</th><th>Epic</th><th>Status</th><th>Priority</th><th>Points</th></tr></thead>
        <tbody>
          ${board.epics
            .map(
              e => `<tr>
            <td class="mono">#${e.number}</td>
            <td>${esc(e.title)}</td>
            <td>${epicStatusBadge(e.status)}</td>
            <td>${esc(e.priority)}</td>
            <td>${e.points ?? '—'}</td>
          </tr>`,
            )
            .join('\n')}
        </tbody>
      </table>
    </section>`
    : `
    <section class="card">
      <h2>Project board</h2>
      <p class="muted">Not available in this build environment (needs <code>gh</code> auth) — regenerate locally with <code>npm run dashboard</code> to refresh this section.</p>
    </section>`

  const docsRows = docs
    .map(d =>
      d.exists
        ? `<tr><td class="mono">${esc(d.file)}</td><td>${d.lines} lines</td><td>${d.entries} entries</td></tr>`
        : `<tr><td class="mono">${esc(d.file)}</td><td colspan="2" class="muted">missing</td></tr>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AgentFlow — Dashboard</title>
<meta name="robots" content="noindex" />
<style>
  :root {
    --bg: #0b0d12; --panel: #12151c; --border: #232735; --text: #e6e8ee; --muted: #8b93a7;
    --ok: #2ecc71; --bad: #ff5c5c; --accent: #7aa2f7;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 24px; background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
  .stat .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat .value { font-size: 20px; margin-top: 6px; font-weight: 600; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .card h2 { margin: 0 0 12px; font-size: 15px; color: var(--accent); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--border); }
  td { padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .mono { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12px; }
  .muted { color: var(--muted); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-ok { background: rgba(46,204,113,0.15); color: var(--ok); }
  .badge-bad { background: rgba(255,92,92,0.15); color: var(--bad); }
  .badge-todo { background: rgba(139,147,167,0.15); color: var(--muted); }
  .badge-progress { background: rgba(122,162,247,0.15); color: var(--accent); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<main>
  <h1>AgentFlow — Dashboard</h1>
  <p class="meta">Generated ${esc(generatedAt)} · branch <span class="mono">${esc(git.branch)}</span> @ <span class="mono">${esc(git.sha)}</span>${git.clean ? '' : ' <span class="badge badge-bad">uncommitted changes</span>'}</p>

  <div class="grid">
    <div class="stat">
      <div class="label">Tests</div>
      <div class="value">${statusBadge(tests && !tests.raw)} ${tests ? esc(tests.tests) : 'n/a'}</div>
    </div>
    <div class="stat">
      <div class="label">Lint</div>
      <div class="value">${statusBadge(lint.ok)} ${esc(lint.summary)}</div>
    </div>
    <div class="stat">
      <div class="label">Typecheck</div>
      <div class="value">${statusBadge(typecheck.ok)} ${typecheck.errorCount} errors</div>
    </div>
    <div class="stat">
      <div class="label">Board</div>
      <div class="value">${board ? `${board.byStatus.Done || 0}/${board.total} done` : 'n/a'}</div>
    </div>
  </div>

  ${boardSection}

  <section class="card">
    <h2>Recent commits</h2>
    <table>
      <thead><tr><th>SHA</th><th>Subject</th><th>When</th></tr></thead>
      <tbody>${commitRows}</tbody>
    </table>
  </section>

  <section class="card">
    <h2>Durable docs</h2>
    <table>
      <thead><tr><th>File</th><th>Size</th><th>Entries</th></tr></thead>
      <tbody>${docsRows}</tbody>
    </table>
  </section>

  <p class="muted" style="font-size:12px">
    Regenerate: <code>npm run dashboard</code>. Source: <code>scripts/generate-dashboard.js</code>.
    Board/repo: <a href="https://github.com/shubhtoy/AgentFlowTest">github.com/shubhtoy/AgentFlowTest</a> ·
    <a href="https://github.com/users/shubhtoy/projects/4">Project board</a>
  </p>
</main>
</body>
</html>
`
}

function epicStatusBadge(status) {
  if (status === 'Done') return '<span class="badge badge-ok">Done</span>'
  if (status === 'In Progress') return '<span class="badge badge-progress">In Progress</span>'
  return '<span class="badge badge-todo">Todo</span>'
}

function main() {
  const git = getGitInfo()
  const tests = getTestInfo()
  const lint = getLintInfo()
  const typecheck = getTypecheckInfo()
  const board = getBoardInfo()
  const docs = getDocsInfo()

  const html = render({ git, tests, lint, typecheck, board, docs })
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, html)
  console.log(`Dashboard written to ${path.relative(ROOT, OUT)}`)
  if (!board) console.log('  (board section omitted — gh not authenticated in this environment)')
}

main()
