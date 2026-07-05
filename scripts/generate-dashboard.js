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
    ? '<span class="badge badge-ok"><span class="dot"></span>green</span>'
    : '<span class="badge badge-bad"><span class="dot"></span>red</span>'
}

function render(data) {
  const { git, tests, lint, typecheck, board, docs } = data
  const generatedAt = new Date().toISOString()

  const commitRows = git.commits
    .map(
      c =>
        `<tr><td class="mono">${esc(c.hash)}</td><td>${esc(c.subject)}</td><td class="num muted">${esc(c.when)}</td></tr>`,
    )
    .join('\n')

  const boardSection = board
    ? `
    <section class="card" aria-labelledby="board-heading">
      <h2 id="board-heading">Project board</h2>
      <p class="meta-line">${board.total} tracked items &middot; ${Object.entries(board.byStatus)
        .map(([k, v]) => `${esc(k)} ${v}`)
        .join(' &middot; ')}</p>
      <table>
        <caption class="sr-only">Epic status by number, priority, and story points</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Epic</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col" class="num">Points</th></tr></thead>
        <tbody>
          ${board.epics
            .map(
              e => `<tr>
            <td class="mono">#${e.number}</td>
            <td>${esc(e.title)}</td>
            <td>${epicStatusBadge(e.status)}</td>
            <td>${esc(e.priority)}</td>
            <td class="num mono">${e.points ?? '\u2014'}</td>
          </tr>`,
            )
            .join('\n')}
        </tbody>
      </table>
    </section>`
    : `
    <section class="card" aria-labelledby="board-heading">
      <h2 id="board-heading">Project board</h2>
      <p class="meta-line">Not available in this build environment (needs <code>gh</code> auth) &mdash; regenerate locally with <code>npm run dashboard</code> to refresh this section.</p>
    </section>`

  const docsRows = docs
    .map(d =>
      d.exists
        ? `<tr><td class="mono">${esc(d.file)}</td><td class="num">${d.lines}</td><td class="num">${d.entries}</td></tr>`
        : `<tr><td class="mono">${esc(d.file)}</td><td colspan="2" class="muted">missing</td></tr>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AgentFlow &mdash; Dashboard</title>
<meta name="robots" content="noindex" />
<meta name="color-scheme" content="dark" />
<style>
  :root {
    /* Neutral spectrum (7 shades, near-black to near-white) */
    --n-950: #0a0b0d;
    --n-900: #12141a;
    --n-800: #1a1d26;
    --n-700: #262a37;
    --n-500: #5a6178;
    --n-300: #9aa1b5;
    --n-100: #e4e6ec;
    /* Primary + accents (3 hues max) */
    --primary: #6ee7c1;
    --danger: #ff6b6b;
    --warn: #f5c76b;
    --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    /* Spacing scale (8px base) */
    --sp-1: 4px; --sp-2: 8px; --sp-3: 16px; --sp-4: 24px; --sp-5: 32px; --sp-6: 48px;
  }
  * { box-sizing: border-box; }
  html { color-scheme: dark; }
  body {
    margin: 0;
    padding: var(--sp-6) var(--sp-4);
    background: var(--n-950);
    color: var(--n-100);
    font-family: var(--font-sans);
    font-size: 1rem;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 1000px; margin: 0 auto; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap;
  }

  h1 {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 var(--sp-1);
    color: var(--n-100);
  }
  .subtitle {
    color: var(--n-300);
    font-size: 0.875rem;
    font-family: var(--font-mono);
    margin: 0 0 var(--sp-5);
  }
  .subtitle .mono { color: var(--n-100); }

  h2 {
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 var(--sp-3);
    color: var(--n-100);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-5);
  }
  .stat {
    background: var(--n-900);
    border: 1px solid var(--n-700);
    border-radius: 6px;
    padding: var(--sp-3);
  }
  .stat-label {
    font-family: var(--font-mono);
    color: var(--n-300);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--sp-2);
  }
  .stat-value {
    font-family: var(--font-mono);
    font-size: 1.0625rem;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }

  .card {
    background: var(--n-900);
    border: 1px solid var(--n-700);
    border-radius: 6px;
    padding: var(--sp-4);
    margin-bottom: var(--sp-4);
  }
  .meta-line {
    color: var(--n-300);
    font-size: 0.8125rem;
    margin: 0 0 var(--sp-3);
  }

  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  caption { text-align: left; }
  th {
    text-align: left;
    color: var(--n-300);
    font-weight: 500;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: var(--sp-2) var(--sp-2) var(--sp-2) 0;
    border-bottom: 1px solid var(--n-700);
  }
  td {
    padding: var(--sp-2) var(--sp-2) var(--sp-2) 0;
    border-bottom: 1px solid var(--n-800);
    vertical-align: top;
    color: var(--n-100);
  }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; }
  th.num { text-align: right; }

  .mono { font-family: var(--font-mono); }
  .muted { color: var(--n-300); }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .dot {
    width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0;
  }
  .badge-ok .dot { background: var(--primary); }
  .badge-ok { color: var(--primary); }
  .badge-bad .dot { background: var(--danger); }
  .badge-bad { color: var(--danger); }
  .badge-uncommitted {
    font-family: var(--font-mono); font-size: 0.75rem; color: var(--warn);
    border: 1px solid var(--warn); border-radius: 4px; padding: 1px 6px;
  }
  .badge-todo { color: var(--n-300); }
  .badge-progress { color: var(--primary); }

  a { color: var(--primary); text-decoration: none; border-bottom: 1px solid transparent; }
  a:hover, a:focus-visible { border-bottom-color: var(--primary); }
  a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

  .footer {
    color: var(--n-300);
    font-size: 0.75rem;
    font-family: var(--font-mono);
    margin-top: var(--sp-5);
    line-height: 1.7;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
</style>
</head>
<body>
<main>
  <h1>AgentFlow</h1>
  <p class="subtitle">
    generated <span class="mono">${esc(generatedAt)}</span> &middot;
    <span class="mono">${esc(git.branch)}</span>@<span class="mono">${esc(git.sha)}</span>${git.clean ? '' : ' <span class="badge-uncommitted">uncommitted</span>'}
  </p>

  <div class="stat-grid" role="group" aria-label="Build health summary">
    <div class="stat">
      <div class="stat-label">Tests</div>
      <div class="stat-value">${statusBadge(tests && !tests.raw)}<span class="mono muted">${tests ? esc(tests.tests) : 'n/a'}</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">Lint</div>
      <div class="stat-value">${statusBadge(lint.ok)}<span class="mono muted">${esc(lint.summary)}</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">Typecheck</div>
      <div class="stat-value">${statusBadge(typecheck.ok)}<span class="mono muted">${typecheck.errorCount} errors</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">Board</div>
      <div class="stat-value mono">${board ? `${board.byStatus.Done || 0}/${board.total} done` : 'n/a'}</div>
    </div>
  </div>

  ${boardSection}

  <section class="card" aria-labelledby="commits-heading">
    <h2 id="commits-heading">Recent commits</h2>
    <table>
      <caption class="sr-only">Last 12 commits with hash, subject, and relative time</caption>
      <thead><tr><th scope="col">sha</th><th scope="col">subject</th><th scope="col" class="num">when</th></tr></thead>
      <tbody>${commitRows}</tbody>
    </table>
  </section>

  <section class="card" aria-labelledby="docs-heading">
    <h2 id="docs-heading">Durable docs</h2>
    <table>
      <caption class="sr-only">Durable-memory doc files with line count and entry count</caption>
      <thead><tr><th scope="col">file</th><th scope="col" class="num">lines</th><th scope="col" class="num">entries</th></tr></thead>
      <tbody>${docsRows}</tbody>
    </table>
  </section>

  <p class="footer">
    regenerate: <code>npm run dashboard</code> &middot; source: <code>scripts/generate-dashboard.js</code><br />
    <a href="https://github.com/shubhtoy/AgentFlowTest">github.com/shubhtoy/AgentFlowTest</a> &middot;
    <a href="https://github.com/users/shubhtoy/projects/4">project board</a>
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
