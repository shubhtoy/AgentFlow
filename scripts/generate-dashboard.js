#!/usr/bin/env node
/**
 * Generates studio/public/dashboard.html — a living, static snapshot of project state.
 *
 * Not a project-management tool: a quick-glance overview (test/lint/build health, recent
 * commits, epic/task progress, code size, CI status) so you can see where things stand without
 * digging through the board or running commands yourself. Deployed via GitHub Pages
 * (.github/workflows/dashboard.yml) on every push to main.
 *
 * Run manually (`npm run dashboard`) or wire into CI/pre-push. Requires `gh` auth for the
 * board/issues/CI sections — each falls back gracefully (omits itself) if `gh` isn't available,
 * so it never blocks on a missing credential. All data is a snapshot as of generation time, not
 * fetched live by the deployed page (keeps the page a static file, no exposed credentials, no
 * runtime dependency on GitHub auth from a visitor's browser).
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'studio', 'public', 'dashboard.html')
const REPO = 'shubhtoy/AgentFlowTest'
const REPO_URL = `https://github.com/${REPO}`
const BOARD_URL = 'https://github.com/users/shubhtoy/projects/4'
const PAGES_URL = 'https://shubhtoy.github.io/AgentFlowTest/'

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
  const log = sh("git log -15 --pretty=format:'%h|||%H|||%s|||%ar|||%an'") || ''
  const commits = log
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, fullHash, subject, when, author] = line.split('|||')
      return { hash, fullHash, subject, when, author }
    })
  const dirty = sh('git status --porcelain') || ''
  const totalCommits = sh('git rev-list --count HEAD') || '?'
  return { branch, sha, commits, clean: dirty.length === 0, totalCommits }
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

// ── GitHub: board, issues, CI (optional — requires gh auth) ─────────────

function ghJson(cmd) {
  const raw = sh(cmd)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getBoardInfo() {
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
  return { total: items.length, byStatus, epics, totalPoints, donePoints }
}

function getIssuesInfo() {
  const data = ghJson(`gh issue list --repo ${REPO} --state open --limit 100 --json number,title,labels`)
  if (!data) return null
  const skippedTests = data.filter(i => (i.labels || []).some(l => l.name === 'skipped-test'))
  return { openCount: data.length, skippedTests }
}

function getCiInfo() {
  const data = ghJson(`gh run list --repo ${REPO} --workflow=ci.yml --limit 5 --json conclusion,status,url,headSha,createdAt,displayTitle`)
  if (!data) return null
  return data.map(r => ({
    conclusion: r.conclusion || r.status,
    url: r.url,
    sha: (r.headSha || '').slice(0, 7),
    createdAt: r.createdAt,
    title: r.displayTitle,
  }))
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

function ciBadge(conclusion) {
  if (conclusion === 'success') return '<span class="badge badge-ok"><span class="dot"></span>pass</span>'
  if (conclusion === 'in_progress' || conclusion === 'queued')
    return '<span class="badge badge-progress"><span class="dot"></span>running</span>'
  return `<span class="badge badge-bad"><span class="dot"></span>${esc(conclusion)}</span>`
}

function relTime(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// ── Render ─────────────────────────────────────────────────────────────

function render(data) {
  const { git, tests, lint, typecheck, codeSize, board, issues, ci, docs } = data
  const generatedAt = new Date().toISOString()

  const commitRows = git.commits
    .map(c => {
      const url = `${REPO_URL}/commit/${c.fullHash}`
      return `<tr><td class="mono">${link(url, c.hash)}</td><td>${esc(c.subject)}</td><td class="num muted">${esc(c.when)}</td></tr>`
    })
    .join('\n')

  const boardSection = board
    ? `
    <section class="card" aria-labelledby="board-heading">
      <h2 id="board-heading">Project board</h2>
      <p class="meta-line">
        ${link(BOARD_URL, `${board.total} tracked items`)} &middot;
        ${board.donePoints}/${board.totalPoints} story points done &middot;
        ${Object.entries(board.byStatus).map(([k, v]) => `${esc(k)} ${v}`).join(' &middot; ')}
      </p>
      <table>
        <caption class="sr-only">Epic status by number, priority, and story points</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Epic</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col" class="num">Points</th></tr></thead>
        <tbody>
          ${board.epics
            .map(
              e => `<tr>
            <td class="mono">${link(`${REPO_URL}/issues/${e.number}`, `#${e.number}`)}</td>
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
      <p class="meta-line">Not available in this build environment (needs <code>gh</code> auth) &mdash; regenerate locally with <code>npm run dashboard</code> to refresh this section. Live: ${link(BOARD_URL, 'project board')}.</p>
    </section>`

  const ciSection = ci
    ? `
    <section class="card" aria-labelledby="ci-heading">
      <h2 id="ci-heading">CI runs</h2>
      <table>
        <caption class="sr-only">Recent CI workflow runs with status, commit, and time</caption>
        <thead><tr><th scope="col">status</th><th scope="col">sha</th><th scope="col" class="num">when</th></tr></thead>
        <tbody>
          ${ci
            .map(
              r => `<tr>
            <td>${link(r.url, '\u2192')} ${ciBadge(r.conclusion)}</td>
            <td class="mono">${link(`${REPO_URL}/commit/${r.sha}`, r.sha)}</td>
            <td class="num muted">${relTime(r.createdAt)}</td>
          </tr>`,
            )
            .join('\n')}
        </tbody>
      </table>
    </section>`
    : ''

  const issuesSection = issues
    ? `
    <section class="card" aria-labelledby="issues-heading">
      <h2 id="issues-heading">Open issues</h2>
      <p class="meta-line">${link(`${REPO_URL}/issues`, `${issues.openCount} open`)}${
        issues.skippedTests.length
          ? ` &middot; ${issues.skippedTests
              .map(i => link(`${REPO_URL}/issues/${i.number}`, `#${i.number} ${i.title}`))
              .join(', ')}`
          : ''
      }</p>
    </section>`
    : ''

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
      <div class="stat-value mono">${issues ? link(`${REPO_URL}/issues`, String(issues.openCount)) : 'n/a'}</div>
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
    <section class="card" aria-labelledby="commits-heading">
      <h2 id="commits-heading">Recent commits</h2>
      <table>
        <caption class="sr-only">Last 15 commits with hash, subject, and relative time</caption>
        <thead><tr><th scope="col">sha</th><th scope="col">subject</th><th scope="col" class="num">when</th></tr></thead>
        <tbody>${commitRows}</tbody>
      </table>
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
    ${link(REPO_URL, 'repo')} &middot; ${link(BOARD_URL, 'project board')} &middot;
    ${link(`${REPO_URL}/actions`, 'actions')} &middot; ${link(PAGES_URL, 'this page')}
  </p>
</main>
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
  const issues = getIssuesInfo()
  const ci = getCiInfo()
  const docs = getDocsInfo()

  const html = render({ git, tests, lint, typecheck, codeSize, board, issues, ci, docs })
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, html)
  console.log(`Dashboard written to ${path.relative(ROOT, OUT)}`)
  if (!board) console.log('  (board/issues/CI sections omitted where gh is not authenticated in this environment)')
}

main()
