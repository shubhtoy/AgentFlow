#!/usr/bin/env node
/**
 * docs-affinity check (Epic 7, #54).
 *
 * Enforces the standing rule (docs/CODING-STANDARDS.md → "Branch & PR workflow"):
 * every PR updates the docs that moved with the code. Deterministically maps each
 * changed source file to its NEAREST ANCESTOR AGENTS.md and blocks the push if that
 * area's AGENTS.md was not updated in the same push.
 *
 * Deterministic: for each changed source file, walk up the directory tree to the
 * first AGENTS.md found. The repo's per-area docs (packages/core, packages/cli,
 * studio, and each library workflow) each own one. The root AGENTS.md is the entry
 * point, not a per-change doc, so files whose nearest AGENTS.md is the root are not
 * flagged.
 *
 * Escape hatch for genuine no-doc-change pushes (typo fixes, pure refactors):
 *   SKIP_DOCS_CHECK=1 git push        or       add [skip-docs] to the commit message
 *
 * Zero dependencies. Runs from .husky/pre-push.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

if (process.env.SKIP_DOCS_CHECK === '1') {
  console.log('docs-affinity: skipped (SKIP_DOCS_CHECK=1)')
  process.exit(0)
}

// Commit-message escape hatch.
try {
  if (/\[skip-docs\]/i.test(sh('git log -1 --pretty=%B'))) {
    console.log('docs-affinity: skipped ([skip-docs] in commit message)')
    process.exit(0)
  }
} catch {
  /* no commits yet — nothing to check */
}

// Determine the range being pushed: prefer origin/main..HEAD, fall back to last commit.
function changedFiles() {
  let base = null
  try {
    sh('git rev-parse --verify --quiet origin/main')
    base = 'origin/main'
  } catch {
    /* origin/main not known locally */
  }
  const range = base ? `${base}...HEAD` : 'HEAD~1..HEAD'
  try {
    return sh(`git diff --name-only ${range}`).split('\n').filter(Boolean)
  } catch {
    return []
  }
}

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
function isSource(f) {
  if (!CODE.test(f)) return false
  if (!/^(packages\/|studio\/|library\/)/.test(f)) return false
  if (f.startsWith('studio/content/')) return false // fumadocs content, not code
  if (f.startsWith('studio/public/')) return false // generated / static
  if (f.startsWith('tests/')) return false
  if (f.includes('/node_modules/') || f.includes('/.source/') || f.includes('/dist/')) return false
  return true
}

function nearestAgentsMd(file) {
  let dir = path.dirname(file)
  for (;;) {
    const candidate = path.join(dir, 'AGENTS.md')
    if (fs.existsSync(candidate)) return candidate.split(path.sep).join('/')
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const files = changedFiles()
const changed = new Set(files)
const ROOT = 'AGENTS.md'
const missing = new Map() // agentsMdPath -> [source files]

for (const f of files) {
  if (!isSource(f)) continue
  const owner = nearestAgentsMd(f)
  if (!owner || owner === ROOT) continue // root is the entry point, not per-change
  if (!changed.has(owner)) {
    if (!missing.has(owner)) missing.set(owner, [])
    missing.get(owner).push(f)
  }
}

if (missing.size === 0) {
  console.log('docs-affinity: OK — affected AGENTS.md files updated (or no code areas touched).')
  process.exit(0)
}

console.error('\n\u2717 docs-affinity: code changed under areas whose AGENTS.md was NOT updated.\n')
for (const [owner, srcs] of missing) {
  console.error(`  ${owner}   \u2190 update this (nearest AGENTS.md for):`)
  for (const f of srcs.slice(0, 8)) console.error(`      ${f}`)
  if (srcs.length > 8) console.error(`      \u2026 +${srcs.length - 8} more`)
}
console.error('\nPer docs/CODING-STANDARDS.md: every PR updates the docs that moved with the code.')
console.error('Update the AGENTS.md file(s) above (and docs/FEATURE-MAP.md if a capability changed).')
console.error('If this change genuinely needs no doc update, bypass with:')
console.error('  SKIP_DOCS_CHECK=1 git push      (or add [skip-docs] to the commit message)\n')
process.exit(1)
