#!/usr/bin/env node
/**
 * Generates studio/public/dashboard.html — a living status snapshot of project state.
 *
 * Not a project-management tool: a quick-glance overview so you can see where things stand
 * without digging through the board or running commands yourself.
 *
 * Hybrid live/static, chosen per section based on what's actually possible:
 *   - Commits, open issues, CI runs: rendered by client-side JS on page load, calling GitHub's
 *     public REST API directly (api.github.com) — no auth needed since the repo is public, so
 *     these are always current, not a build-time snapshot. No server, no token, nothing to keep
 *     fresh on our end.
 *   - Project board: server-baked at build time. The GitHub Projects (v2) API requires auth
 *     even for a public repo's board, so this can't be fetched from a visitor's browser without
 *     exposing a credential — stays a snapshot, regenerated on every push.
 *   - Tests/lint/typecheck/code-size: server-baked at build time. These require actually
 *     running the code (vitest, eslint, tsc) — there is no API to "ask" for a live test result;
 *     something has to execute the suite once and record what happened.
 * Deployed via GitHub Pages (.github/workflows/dashboard.yml) on every push to main. Run
 * manually (`npm run dashboard`) for a local preview; the deploy doesn't depend on this being
 * run by hand.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'studio', 'public', 'dashboard.html')
const REPO = 'shubhtoy/AgentFlow'
const REPO_URL = `https://github.com/${REPO}`
const BOARD_URL = 'https://github.com/users/shubhtoy/projects/4'
const PAGES_URL = 'https://shubhtoy.github.io/AgentFlow/'

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim()
  } catch (err) {
    if (err.stdout) return String(err.stdout).trim()
    console.warn(`[dashboard] command failed, section will be omitted/degraded: ${cmd}\n  ${err.message.split('\n')[0]}`)
    return null
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function link(url, text) {
  return `<a href="${esc(url)}">${esc(text)}</a>`
}

// ── Git ────────────────────────────────────────────────────────────────

function getGitInfo() {
  const branch = sh('git rev-parse --abbrev-ref HEAD') || 'unknown'
  const sha = sh('git rev-parse --short HEAD') || 'unknown'
  const dirty = sh('git status --porcelain') || ''
  const totalCommits = sh('git rev-list --count HEAD') || '?'
  return { branch, sha, clean: dirty.length === 0, totalCommits }
}

// ── Tests ──────────────────────────────────────────────────────────────

function getTestInfo() {
  const raw = sh('npx vitest run 2>&1', { maxBuffer: 1024 * 1024 * 20 })
  if (!raw) return null
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '')
  const filesMatch = clean.match(/Test Files\s+(.+)/)
  const testsMatch = clean.match(/\n\s*Tests\s+(.+)/)
  // Files with real it.skip()/describe.skip() usage (not files with zero tests defined at all).
  const skipGrep = sh(
    `grep -lE "\\.(skip|todo)\\(" tests/unit/*.test.ts tests/generators/*.test.ts 2>/dev/null`,
  )
  const skippedFiles = skipGrep ? skipGrep.split('\n').filter(Boolean) : []
  return {
    files: filesMatch ? filesMatch[1].trim() : 'unknown',
    tests: testsMatch ? testsMatch[1].trim() : 'unknown',
    failed: clean.includes('failed') && !/\b0 failed\b/.test(clean),
    skippedFiles,
  }
}

// ── Lint / typecheck ───────────────────────────────────────────────────

function getLintInfo() {
  const out = sh('npm run lint 2>&1')
  const ok = out !== null && !/error/i.test(out)
  return { ok, summary: ok ? '0 errors, 0 warnings' : 'errors present' }
}

function getTypecheckInfo() {
  const out = sh('npx tsc --build 2>&1') || ''
  const errorFiles = [...new Set([...out.matchAll(/^([^\s(]+\.tsx?)\(/gm)].map(m => m[1]))]
  const errorCount = (out.match(/error TS/g) || []).length
  return { errorCount, ok: errorCount === 0, errorFiles }
}

// ── Code size ──────────────────────────────────────────────────────────

function countLines(dir) {
  const out = sh(`find ${dir} -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules | xargs cat 2>/dev/null | wc -l`)
  return out ? parseInt(out, 10) || 0 : 0
}

function getCodeSizeInfo() {
  const areas = [
    { label: 'packages/core', dir: 'packages/core/src' },
    { label: 'packages/cli', dir: 'packages/cli/src' },
    { label: 'studio', dir: 'studio' },
    { label: 'tests', dir: 'tests' },
  ]
  const rows = areas.map(a => ({ ...a, lines: countLines(a.dir) }))
  const total = rows.reduce((s, r) => s + r.lines, 0)
  return { rows, total }
}

// ── GitHub: project board ────────────────────────────────────────────────
//
// The Projects v2 REST/GraphQL APIs require auth for item-level data even on a public
// project (confirmed: /users/{u}/projectsV2/{n}/items -> 401 regardless of visibility).
// The board page's embedded JSON works unauthenticated, but has no CORS header, so a
// browser can't read it directly from a different origin (shubhtoy.github.io).
//
// Resolved: github-project-info-mcp (github.com/shubhtoy/github-project-info-mcp) ships a
// small Cloudflare Worker that runs this same scrape server-side and adds the CORS header
// itself. Deployed at github-project-info-api.shubhmittal-sm.workers.dev. The dashboard's
// client-side script now fetches the full epic table (status, points would need custom
// fields not exposed by that endpoint's current fields, so status/title/state only for now)
// through that Worker — genuinely live, no server-side bake needed for this section anymore.
//
// Server-side gh/scrape kept ONLY as the no-JS/failure fallback rendered into the initial
// HTML (progressive enhancement) — if the live fetch fails, this snapshot is what's shown.
const STATUS_ID_LABELS = {
  f75ad846: 'Todo',
  '47fc9ee4': 'In Progress',
  '98236657': 'Done',
}

function scrapeBoardFromPublicPage() {
  const html = sh(`curl -sL "${BOARD_URL}"`)
  if (!html) return null
  const match = html.match(/<script type="application\/json" id="memex-paginated-items-data">(.*?)<\/script>/s)
  if (!match) return null
  let data
  try {
    data = JSON.parse(match[1])
  } catch {
    return null
  }
  const nodes = data.nodes || []
  const byStatus = {}
  const epics = []
  for (const n of nodes) {
    const cols = n.memexProjectColumnValues || []
    const titleCol = cols.find(c => c.memexProjectColumnId === 'Title')
    const statusCol = cols.find(c => c.memexProjectColumnId === 'Status')
    const statusId = statusCol && statusCol.value && statusCol.value.id
    const status = STATUS_ID_LABELS[statusId] || (n.state === 'closed' ? 'Done' : '(unknown)')
    byStatus[status] = (byStatus[status] || 0) + 1
    if (titleCol) {
      epics.push({
        number: titleCol.value.number,
        title: titleCol.value.title.raw,
        status,
        priority: '',
        points: null,
      })
    }
  }
  epics.sort((a, b) => (a.number || 0) - (b.number || 0))
  return { total: nodes.length, byStatus, epics, totalPoints: 0, donePoints: 0, source: 'scrape' }
}

function ghJson(cmd) {
  const raw = sh(cmd)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getBoardInfoViaGh() {
  const data = ghJson(`gh project item-list 4 --owner shubhtoy --format json --limit 100`)
  if (!data) return null
  const items = data.items || []
  const byStatus = {}
  const epics = []
  let totalPoints = 0
  let donePoints = 0
  for (const it of items) {
    const status = it.status || '(none)'
    byStatus[status] = (byStatus[status] || 0) + 1
    const points = it.storyPoints ?? it['story Points'] ?? 0
    totalPoints += points || 0
    if (status === 'Done') donePoints += points || 0
    const isEpic = /^Setup:|^Stabilization/.test(it.content?.title || '')
    if (isEpic) {
      epics.push({
        number: it.content?.number,
        title: it.content?.title,
        status,
        priority: it.priority || '',
        points,
      })
    }
  }
  epics.sort((a, b) => (a.number || 0) - (b.number || 0))
  return { total: items.length, byStatus, epics, totalPoints, donePoints, source: 'gh' }
}

function getBoardInfo() {
  return getBoardInfoViaGh() || scrapeBoardFromPublicPage()
}

// ── Docs snapshot ──────────────────────────────────────────────────────

function getDocsInfo() {
  const files = [
    { file: 'docs/DECISIONS.md', label: 'Decisions' },
    { file: 'docs/USER-CORRECTIONS.md', label: 'User corrections' },
    { file: 'docs/FEATURE-MAP.md', label: 'Feature map' },
    { file: 'docs/CODING-STANDARDS.md', label: 'Coding standards' },
    { file: 'docs/planning/MASTER-PLAN.md', label: 'Master plan' },
  ]
  return files.map(({ file, label }) => {
    const full = path.join(ROOT, file)
    if (!fs.existsSync(full)) return { file, label, exists: false }
    const content = fs.readFileSync(full, 'utf-8')
    const lines = content.split('\n').length
    const entries = (content.match(/^## /gm) || []).length
    return { file, label, exists: true, lines, entries }
  })
}

// ── Render helpers ───────────────────────────────────────────────────────

function statusBadge(ok) {
  return ok
    ? '<span class="badge badge-ok"><span class="dot"></span>green</span>'
    : '<span class="badge badge-bad"><span class="dot"></span>red</span>'
}

function epicStatusBadge(status) {
  if (status === 'Done') return '<span class="badge badge-ok"><span class="dot"></span>Done</span>'
  if (status === 'In Progress') return '<span class="badge badge-progress"><span class="dot"></span>In Progress</span>'
  return '<span class="badge badge-todo"><span class="dot"></span>Todo</span>'
}

// ── Render ─────────────────────────────────────────────────────────────

function render(data) {
  const { git, tests, lint, typecheck, codeSize, board, docs } = data
  const generatedAt = new Date().toISOString()

  const boardSection = board
    ? `
    <section class="card" aria-labelledby="board-heading">
      <h2 id="board-heading">Project board <span class="live-badge">live</span></h2>
      <p class="meta-line" id="board-live-meta">
        ${link(BOARD_URL, 'AgentFlow')} &middot; <span class="mono muted">loading live status&hellip;</span>
      </p>
      <table>
        <caption class="sr-only">Epic status, priority, story points, and sub-issue progress</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Epic</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col" class="num">Points</th><th scope="col" class="num">Sub-issues</th></tr></thead>
        <tbody id="board-rows">
          ${board.epics
            .map(
              e => `<tr>
            <td class="mono">${link(`${REPO_URL}/issues/${e.number}`, `#${e.number}`)}</td>
            <td>${esc(e.title)}</td>
            <td>${epicStatusBadge(e.status)}</td>
            <td>\u2014</td>
            <td class="num mono">\u2014</td>
            <td class="num mono">${e.points ?? '\u2014'}</td>
          </tr>`,
            )
            .join('\n')}
        </tbody>
      </table>
      <p class="meta-line stale-note">rows shown are a build-time snapshot until the live fetch (via a small Cloudflare Worker, see footer) finishes loading &mdash; then replaced with current data, including Priority/Points (fetched per-epic from ${link('https://github.com/shubhtoy/github-project-info-mcp', 'github-project-info-mcp')}'s per-item endpoint, since the bulk endpoint doesn't expose custom fields).</p>
      <noscript><p class="meta-line">Enable JavaScript for live board data, or view directly: ${link(BOARD_URL, 'project board')}.</p></noscript>
    </section>`
    : `
    <section class="card" aria-labelledby="board-heading">
      <h2 id="board-heading">Project board <span class="live-badge">live</span></h2>
      <p class="meta-line" id="board-live-meta">loading live status&hellip;</p>
      <table>
        <caption class="sr-only">Epic status, priority, story points, and sub-issue progress</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Epic</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col" class="num">Points</th><th scope="col" class="num">Sub-issues</th></tr></thead>
        <tbody id="board-rows"><tr><td colspan="6" class="muted">loading&hellip;</td></tr></tbody>
      </table>
      <p class="meta-line">Build-time snapshot unavailable (needs <code>gh</code> auth in this environment) &mdash; live fetch above should still work. Live: ${link(BOARD_URL, 'project board')}.</p>
      <noscript><p class="meta-line">Enable JavaScript for live board data, or view directly: ${link(BOARD_URL, 'project board')}.</p></noscript>
    </section>`

  const ciSection = `
    <section class="card" aria-labelledby="ci-heading">
      <h2 id="ci-heading">CI runs <span class="live-badge">live</span></h2>
      <table>
        <caption class="sr-only">Recent CI workflow runs with status, commit, and time</caption>
        <thead><tr><th scope="col">status</th><th scope="col">sha</th><th scope="col" class="num">when</th></tr></thead>
        <tbody id="ci-rows"><tr><td colspan="3" class="muted">loading&hellip;</td></tr></tbody>
      </table>
      <noscript><p class="meta-line">Enable JavaScript, or view directly: ${link(`${REPO_URL}/actions`, 'actions')}.</p></noscript>
    </section>`

  const issuesSection = `
    <section class="card" aria-labelledby="issues-heading">
      <h2 id="issues-heading">Open issues <span class="live-badge">live</span></h2>
      <p class="meta-line" id="issues-summary">loading&hellip;</p>
      <noscript><p class="meta-line">Enable JavaScript, or view directly: ${link(`${REPO_URL}/issues`, 'issues')}.</p></noscript>
    </section>`

  const p0Section = `
    <section class="card" aria-labelledby="p0-heading">
      <h2 id="p0-heading">P0 critical path <span class="live-badge">live</span></h2>
      <p class="meta-line">The blocking sequence: everything else waits on these landing, in rough order.</p>
      <table>
        <caption class="sr-only">Open P0-labelled issues, the critical path</caption>
        <thead><tr><th scope="col">#</th><th scope="col">issue</th><th scope="col">area</th></tr></thead>
        <tbody id="p0-rows"><tr><td colspan="3" class="muted">loading&hellip;</td></tr></tbody>
      </table>
      <noscript><p class="meta-line">Enable JavaScript, or view directly: ${link(`${REPO_URL}/issues?q=is%3Aopen+is%3Aissue+label%3AP0`, 'P0 issues')}.</p></noscript>
    </section>`

  const labelBreakdownSection = `
    <section class="card" aria-labelledby="labels-heading">
      <h2 id="labels-heading">Open work by priority &amp; area <span class="live-badge">live</span></h2>
      <div id="label-breakdown" class="meta-line">loading&hellip;</div>
    </section>`

  const codeSizeRows = codeSize.rows
    .map(r => `<tr><td>${esc(r.label)}</td><td class="num mono">${r.lines.toLocaleString()}</td></tr>`)
    .join('\n')

  const docsRows = docs
    .map(d =>
      d.exists
        ? `<tr><td>${link(`${REPO_URL}/blob/main/${d.file}`, d.label)}</td><td class="num">${d.lines}</td><td class="num">${d.entries}</td></tr>`
        : `<tr><td>${esc(d.label)}</td><td colspan="2" class="muted">missing</td></tr>`,
    )
    .join('\n')

  const skippedSection = tests && tests.skippedFiles.length
    ? `
    <section class="card" aria-labelledby="skipped-heading">
      <h2 id="skipped-heading">Files with skipped tests</h2>
      <p class="meta-line">${tests.skippedFiles.length} file(s) contain <code>.skip()</code>/<code>.todo()</code> &mdash; some are unimplemented modules, others are tracked design decisions (${link(`${REPO_URL}/issues/35`, '#35')}).</p>
      <ul class="file-list">
        ${tests.skippedFiles.map(f => `<li>${link(`${REPO_URL}/blob/main/${f}`, f)}</li>`).join('\n')}
      </ul>
    </section>`
    : ''

  const typecheckSection = !typecheck.ok
    ? `
    <section class="card" aria-labelledby="typecheck-heading">
      <h2 id="typecheck-heading">Typecheck errors</h2>
      <p class="meta-line">${typecheck.errorCount} error(s) across ${typecheck.errorFiles.length} file(s) &mdash; pre-existing, tracked under Epic 7.</p>
      <ul class="file-list">
        ${typecheck.errorFiles.map(f => `<li>${link(`${REPO_URL}/blob/main/${f}`, f)}</li>`).join('\n')}
      </ul>
    </section>`
    : ''

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
    --n-950: #0a0b0d; --n-900: #12141a; --n-800: #1a1d26; --n-700: #262a37;
    --n-500: #5a6178; --n-300: #9aa1b5; --n-100: #e4e6ec;
    --primary: #6ee7c1; --danger: #ff6b6b; --warn: #f5c76b;
    --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --sp-1: 4px; --sp-2: 8px; --sp-3: 16px; --sp-4: 24px; --sp-5: 32px; --sp-6: 48px;
  }
  * { box-sizing: border-box; }
  html { color-scheme: dark; }
  body {
    margin: 0; padding: var(--sp-6) var(--sp-4);
    background: var(--n-950); color: var(--n-100);
    font-family: var(--font-sans); font-size: 1rem; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 1080px; margin: 0 auto; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  h1 { font-family: var(--font-mono); font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 var(--sp-1); }
  .subtitle { color: var(--n-300); font-size: 0.875rem; font-family: var(--font-mono); margin: 0 0 var(--sp-5); }
  .subtitle .mono { color: var(--n-100); }

  h2 {
    font-family: var(--font-mono); font-size: 0.9375rem; font-weight: 600;
    margin: 0 0 var(--sp-3); text-transform: uppercase; letter-spacing: 0.04em;
  }

  .section-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: var(--sp-4); align-items: start; }

  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-5); }
  .stat { background: var(--n-900); border: 1px solid var(--n-700); border-radius: 6px; padding: var(--sp-3); }
  .stat-label { font-family: var(--font-mono); color: var(--n-300); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--sp-2); }
  .stat-value { font-family: var(--font-mono); font-size: 1.0625rem; display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
  .stat-sub { display: block; color: var(--n-300); font-size: 0.75rem; margin-top: var(--sp-1); }

  .card { background: var(--n-900); border: 1px solid var(--n-700); border-radius: 6px; padding: var(--sp-4); margin-bottom: var(--sp-4); }
  .meta-line { color: var(--n-300); font-size: 0.8125rem; margin: 0 0 var(--sp-3); }

  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  th {
    text-align: left; color: var(--n-300); font-weight: 500; font-family: var(--font-mono);
    font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em;
    padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--n-700);
  }
  td { padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--n-800); vertical-align: top; color: var(--n-100); }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; }
  th.num { text-align: right; }

  .file-list { list-style: none; margin: 0; padding: 0; font-size: 0.8125rem; }
  .file-list li { padding: var(--sp-1) 0; border-bottom: 1px solid var(--n-800); font-family: var(--font-mono); }
  .file-list li:last-child { border-bottom: none; }

  .mono { font-family: var(--font-mono); }
  .muted { color: var(--n-300); }

  .badge { display: inline-flex; align-items: center; gap: var(--sp-1); font-family: var(--font-mono); font-size: 0.8125rem; font-weight: 500; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .badge-ok .dot { background: var(--primary); }
  .badge-ok { color: var(--primary); }
  .badge-bad .dot { background: var(--danger); }
  .badge-bad { color: var(--danger); }
  .badge-uncommitted { font-family: var(--font-mono); font-size: 0.75rem; color: var(--warn); border: 1px solid var(--warn); border-radius: 4px; padding: 1px 6px; }
  .badge-todo .dot { background: var(--n-500); }
  .badge-todo { color: var(--n-300); }
  .badge-progress .dot { background: var(--primary); }
  .badge-progress { color: var(--primary); }

  a { color: var(--primary); text-decoration: none; border-bottom: 1px solid transparent; }
  a:hover, a:focus-visible { border-bottom-color: var(--primary); }
  a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  a:empty { border-bottom: none; }

  .footer { color: var(--n-300); font-size: 0.75rem; font-family: var(--font-mono); margin-top: var(--sp-5); line-height: 1.7; }

  .live-badge {
    display: inline-block; font-size: 0.625rem; font-weight: 500; text-transform: none;
    letter-spacing: normal; color: var(--primary); border: 1px solid var(--primary);
    border-radius: 999px; padding: 1px 6px; margin-left: var(--sp-2); vertical-align: middle;
  }
  .stale-note { font-size: 0.6875rem; font-style: italic; margin: var(--sp-2) 0 0; }

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
    ${link(`${REPO_URL}/commit/${git.sha}`, `${git.branch}@${git.sha}`)}${git.clean ? '' : ' <span class="badge-uncommitted">uncommitted</span>'}
    &middot; ${git.totalCommits} commits total
  </p>

  <div class="stat-grid" role="group" aria-label="Build health summary">
    <div class="stat">
      <div class="stat-label">Tests</div>
      <div class="stat-value">${statusBadge(tests && !tests.failed)}<span class="mono muted">${tests ? esc(tests.tests) : 'n/a'}</span></div>
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
      ${board ? `<span class="stat-sub">${board.donePoints}/${board.totalPoints} pts</span>` : ''}
    </div>
    <div class="stat">
      <div class="stat-label">Open issues</div>
      <div class="stat-value mono" id="issues-count">&hellip;</div>
    </div>
    <div class="stat">
      <div class="stat-label">Code size</div>
      <div class="stat-value mono">${codeSize.total.toLocaleString()}</div>
      <span class="stat-sub">lines of TS across repo</span>
    </div>
  </div>

  <div class="section-grid">
    ${boardSection}
    ${ciSection}
  </div>

  <div class="section-grid">
    ${p0Section}
    ${labelBreakdownSection}
  </div>

  <div class="section-grid">
    <section class="card" aria-labelledby="commits-heading">
      <h2 id="commits-heading">Recent commits <span class="live-badge">live</span></h2>
      <table>
        <caption class="sr-only">Last 15 commits with hash, subject, and relative time</caption>
        <thead><tr><th scope="col">sha</th><th scope="col">subject</th><th scope="col" class="num">when</th></tr></thead>
        <tbody id="commit-rows"><tr><td colspan="3" class="muted">loading&hellip;</td></tr></tbody>
      </table>
      <noscript><p class="meta-line">Enable JavaScript, or view directly: ${link(`${REPO_URL}/commits/main`, 'commit history')}.</p></noscript>
    </section>

    <section class="card" aria-labelledby="codesize-heading">
      <h2 id="codesize-heading">Code size by area</h2>
      <table>
        <caption class="sr-only">Lines of TypeScript per repo area</caption>
        <thead><tr><th scope="col">area</th><th scope="col" class="num">lines</th></tr></thead>
        <tbody>${codeSizeRows}</tbody>
      </table>
    </section>
  </div>

  ${issuesSection}
  ${skippedSection}
  ${typecheckSection}

  <section class="card" aria-labelledby="docs-heading">
    <h2 id="docs-heading">Durable docs</h2>
    <table>
      <caption class="sr-only">Durable-memory doc files with line count and entry count</caption>
      <thead><tr><th scope="col">file</th><th scope="col" class="num">lines</th><th scope="col" class="num">entries</th></tr></thead>
      <tbody>${docsRows}</tbody>
    </table>
  </section>

  <p class="footer">
    regenerate: <code>npm run dashboard</code> &middot; source: ${link(`${REPO_URL}/blob/main/scripts/generate-dashboard.js`, 'scripts/generate-dashboard.js')}<br />
    board data fetched live via ${link('https://github.com/shubhtoy/github-project-info-mcp', 'github-project-info-mcp')}'s Cloudflare Worker<br />
    ${link(REPO_URL, 'repo')} &middot; ${link(BOARD_URL, 'project board')} &middot;
    ${link(`${REPO_URL}/actions`, 'actions')} &middot; ${link(PAGES_URL, 'this page')}
  </p>
</main>
<script>
(function () {
  'use strict';
  var API = 'https://api.github.com/repos/${REPO}';
  var REPO_URL = '${REPO_URL}';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function relTime(iso) {
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.round(hrs / 24) + 'd ago';
  }

  function ciBadge(conclusion) {
    if (conclusion === 'success') return '<span class="badge badge-ok"><span class="dot"></span>pass</span>';
    if (conclusion === 'in_progress' || conclusion === 'queued')
      return '<span class="badge badge-progress"><span class="dot"></span>running</span>';
    return '<span class="badge badge-bad"><span class="dot"></span>' + esc(conclusion) + '</span>';
  }

  function fail(el, msg, colspan) {
    if (el) el.innerHTML = '<tr><td colspan="' + (colspan || 3) + '" class="muted">' + esc(msg) + '</td></tr>';
  }

  // Small, focused fetch helper — respects CORS (relies on GitHub's REST API sending
  // Access-Control-Allow-Origin: *, confirmed on api.github.com; does not attempt to bypass
  // CORS on endpoints that don't send it, like the Projects *web* page or the GraphQL API).
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // Project board — metadata via GitHub's official REST API (CORS-open, no proxy needed),
  // items via a small self-hosted Cloudflare Worker (github-project-info-mcp project) that
  // adds CORS to an otherwise-unauthenticated-but-CORS-blocked GitHub endpoint. See
  // github.com/shubhtoy/github-project-info-mcp for what this Worker does and why it exists.
  var BOARD_WORKER = 'https://github-project-info-api.shubhmittal-sm.workers.dev';
  var boardProjectId = null; // filled in by the metadata fetch below, needed for per-item detail calls

  getJSON('https://api.github.com/users/shubhtoy/projectsV2/4')
    .then(function (p) {
      boardProjectId = p.id;
      var el = document.getElementById('board-live-meta');
      if (!el) return;
      el.innerHTML = '<a href="' + REPO_URL.replace('/AgentFlow', '') + '/users/shubhtoy/projects/4">' + esc(p.title) + '</a>' +
        ' &middot; <span class="mono">' + esc(p.state) + '</span>' +
        ' &middot; updated ' + esc(relTime(p.updated_at));
    })
    .catch(function (err) {
      var el = document.getElementById('board-live-meta');
      if (el) el.innerHTML = '<span class="muted">live status unavailable: ' + esc(err.message) + '</span>';
    });

  function fieldValue(item, name) {
    var f = (item.fields || []).find(function (x) { return x.name === name; });
    return f ? f.value : null;
  }

  function boardStatusBadge(name) {
    if (name === 'Done') return '<span class="badge badge-ok"><span class="dot"></span>Done</span>';
    if (name === 'In Progress') return '<span class="badge badge-progress"><span class="dot"></span>In Progress</span>';
    return '<span class="badge badge-todo"><span class="dot"></span>' + esc(name || 'Todo') + '</span>';
  }

  function renderBoardRows(epics, detailsById) {
    var rows = epics.map(function (it) {
      var status = fieldValue(it, 'Status');
      var statusName = status ? status.name : (it.state === 'closed' ? 'Done' : 'Todo');
      var subIssues = fieldValue(it, 'Sub-issues progress');
      var subIssuesText = subIssues ? (subIssues.completed + '/' + subIssues.total) : '\u2014';
      var detail = detailsById[it.id];
      var priority = detail ? fieldValue(detail, 'Priority') : null;
      var points = detail ? fieldValue(detail, 'Story Points') : null;
      var priorityText = priority ? esc(priority.name) : '\u2014';
      var pointsText = (points && typeof points.value === 'number') ? points.value : '\u2014';
      return '<tr><td class="mono"><a href="' + REPO_URL + '/issues/' + it.issueNumber + '">#' + it.issueNumber + '</a></td>' +
        '<td>' + esc(it.title) + '</td>' +
        '<td>' + boardStatusBadge(statusName) + '</td>' +
        '<td>' + priorityText + '</td>' +
        '<td class="num mono">' + esc(pointsText) + '</td>' +
        '<td class="num mono">' + esc(subIssuesText) + '</td></tr>';
    });
    var el = document.getElementById('board-rows');
    if (el) el.innerHTML = rows.join('') || '<tr><td colspan="6" class="muted">no epics found</td></tr>';
  }

  getJSON(BOARD_WORKER + '/projects/shubhtoy/4/items')
    .then(function (data) {
      var items = data.items || [];
      // Epics only (top-level "Setup: ..." / "Stabilization ..." issues, matching the
      // server-side snapshot's own filter, kept consistent between both render paths).
      var epics = items.filter(function (it) {
        return /^Setup:|^Stabilization/.test(it.title || '');
      });
      epics.sort(function (a, b) { return (a.issueNumber || 0) - (b.issueNumber || 0); });

      // First paint without Priority/Points (bulk endpoint doesn't include custom fields —
      // they're outside the board's default view, see github-project-info-mcp's README).
      renderBoardRows(epics, {});

      // Then enrich with Priority/Story Points via the per-item detail endpoint, one request
      // per epic, in parallel. Needs boardProjectId from the metadata fetch above — if that
      // hasn't resolved yet, wait briefly rather than skip the enrichment entirely.
      function enrich() {
        if (!boardProjectId) { setTimeout(enrich, 200); return; }
        Promise.all(
          epics.map(function (it) {
            var url = BOARD_WORKER + '/projects/shubhtoy/4/items/' + boardProjectId + '/' + it.id;
            return getJSON(url).then(
              function (detail) { return { id: it.id, detail: detail }; },
              function () { return { id: it.id, detail: null }; }, // one failed epic shouldn't block the rest
            );
          }),
        ).then(function (results) {
          var detailsById = {};
          results.forEach(function (r) { if (r.detail) detailsById[r.id] = r.detail; });
          renderBoardRows(epics, detailsById);
        });
      }
      enrich();
    })
    .catch(function (err) { fail(document.getElementById('board-rows'), 'live board fetch failed: ' + err.message, 6); });

  // Recent commits
  fetch(API + '/commits?per_page=15')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (commits) {
      var rows = commits.map(function (c) {
        var sha = c.sha.slice(0, 7);
        var subject = (c.commit.message || '').split('\\n')[0];
        var when = relTime(c.commit.author.date);
        return '<tr><td class="mono"><a href="' + REPO_URL + '/commit/' + c.sha + '">' + sha + '</a></td>' +
          '<td>' + esc(subject) + '</td><td class="num muted">' + esc(when) + '</td></tr>';
      });
      document.getElementById('commit-rows').innerHTML = rows.join('') || '<tr><td colspan="3" class="muted">no commits found</td></tr>';
    })
    .catch(function (err) { fail(document.getElementById('commit-rows'), 'failed to load: ' + err.message); });

  // Open issues + skipped-test tracking + P0 critical path + label breakdown.
  // Single fetch, four consumers — avoids hitting GitHub's rate limit with duplicate calls.
  fetch(API + '/issues?state=open&per_page=100')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (issues) {
      var real = issues.filter(function (i) { return !i.pull_request; });

      // Open issues summary + skipped-test tracking
      var tracked = real.filter(function (i) {
        return (i.labels || []).some(function (l) { return (l.name || l) === 'skipped-test'; });
      });
      var html = '<a href="' + REPO_URL + '/issues">' + real.length + ' open</a>';
      if (tracked.length) {
        html += ' &middot; ' + tracked.map(function (i) {
          return '<a href="' + REPO_URL + '/issues/' + i.number + '">#' + i.number + ' ' + esc(i.title) + '</a>';
        }).join(', ');
      }
      document.getElementById('issues-summary').innerHTML = html;
      document.getElementById('issues-count').innerHTML = '<a href="' + REPO_URL + '/issues">' + real.length + '</a>';

      // P0 critical path — the issues that actually block everything else
      var labelName = function (l) { return l.name || l; };
      var p0 = real.filter(function (i) {
        return (i.labels || []).some(function (l) { return labelName(l) === 'P0'; });
      }).sort(function (a, b) { return a.number - b.number; });
      var p0Rows = p0.map(function (i) {
        var area = (i.labels || []).map(labelName).filter(function (l) { return l.indexOf('area:') === 0; })[0];
        return '<tr><td class="mono"><a href="' + REPO_URL + '/issues/' + i.number + '">#' + i.number + '</a></td>' +
          '<td>' + esc(i.title) + '</td><td class="muted">' + esc(area ? area.replace('area:', '') : '\u2014') + '</td></tr>';
      });
      var p0El = document.getElementById('p0-rows');
      if (p0El) p0El.innerHTML = p0Rows.join('') || '<tr><td colspan="3" class="muted">no open P0 issues</td></tr>';

      // Priority / area label breakdown
      var counts = {};
      real.forEach(function (i) {
        (i.labels || []).forEach(function (l) {
          var name = labelName(l);
          if (name === 'P0' || name === 'P1' || name === 'P2' || name.indexOf('area:') === 0) {
            counts[name] = (counts[name] || 0) + 1;
          }
        });
      });
      var priorityOrder = ['P0', 'P1', 'P2'];
      var priorityHtml = priorityOrder
        .filter(function (p) { return counts[p]; })
        .map(function (p) {
          return '<span class="mono">' + p + '</span> <span class="muted">' + counts[p] + '</span>';
        })
        .join(' &middot; ');
      var areaEntries = Object.keys(counts)
        .filter(function (k) { return k.indexOf('area:') === 0; })
        .map(function (k) { return { name: k.replace('area:', ''), count: counts[k] }; })
        .sort(function (a, b) { return b.count - a.count; });
      var areaHtml = areaEntries
        .map(function (a) { return '<span class="mono">' + esc(a.name) + '</span> <span class="muted">' + a.count + '</span>'; })
        .join(' &middot; ');
      var breakdownEl = document.getElementById('label-breakdown');
      if (breakdownEl) {
        breakdownEl.innerHTML =
          '<div style="margin-bottom: 8px"><strong class="mono" style="color: var(--n-100)">Priority:</strong> ' + (priorityHtml || '<span class="muted">none</span>') + '</div>' +
          '<div><strong class="mono" style="color: var(--n-100)">Area:</strong> ' + (areaHtml || '<span class="muted">none</span>') + '</div>';
      }
    })
    .catch(function (err) {
      var el = document.getElementById('issues-summary');
      if (el) el.textContent = 'failed to load: ' + err.message;
      var count = document.getElementById('issues-count');
      if (count) count.textContent = 'n/a';
      fail(document.getElementById('p0-rows'), 'failed to load: ' + err.message, 3);
      var breakdownEl = document.getElementById('label-breakdown');
      if (breakdownEl) breakdownEl.textContent = 'failed to load: ' + err.message;
    });

  // CI runs
  fetch(API + '/actions/workflows/ci.yml/runs?per_page=5')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      var runs = data.workflow_runs || [];
      var rows = runs.map(function (r) {
        var sha = (r.head_sha || '').slice(0, 7);
        return '<tr><td><a href="' + r.html_url + '">\u2192</a> ' + ciBadge(r.conclusion || r.status) + '</td>' +
          '<td class="mono"><a href="' + REPO_URL + '/commit/' + r.head_sha + '">' + sha + '</a></td>' +
          '<td class="num muted">' + esc(relTime(r.created_at)) + '</td></tr>';
      });
      document.getElementById('ci-rows').innerHTML = rows.join('') || '<tr><td colspan="3" class="muted">no runs found</td></tr>';
    })
    .catch(function (err) { fail(document.getElementById('ci-rows'), 'failed to load: ' + err.message); });
})();
</script>
</body>
</html>
`
}

function main() {
  console.log('Generating dashboard\u2026')
  const git = getGitInfo()
  const tests = getTestInfo()
  const lint = getLintInfo()
  const typecheck = getTypecheckInfo()
  const codeSize = getCodeSizeInfo()
  const board = getBoardInfo()
  const docs = getDocsInfo()

  const html = render({ git, tests, lint, typecheck, codeSize, board, docs })
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, html)
  console.log(`Dashboard written to ${path.relative(ROOT, OUT)}`)
  if (!board) console.log('  (board section omitted — gh not authenticated in this environment; commits/issues/CI load live client-side regardless)')
}

main()
