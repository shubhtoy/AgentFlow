#!/usr/bin/env node
/**
 * Nudges towards pruning/consolidating the durable-memory docs before they bloat.
 *
 * Read-only: never edits anything (matches "never silently bulk-rewrite" in
 * docs/CODING-STANDARDS.md's "Learning from corrections" section). Prints a report an
 * agent or human should act on manually — merge/edit entries in place, don't just append.
 *
 * Checks, per tracked file:
 *   1. Line-count threshold — flags a file worth consolidating, not appending to further.
 *   2. Entry count — many small entries under one H2 is a sign some should merge.
 *   3. Near-duplicate headings — catches "wrote a new entry instead of editing the old one".
 *   4. Stale entries — flags entries dated far enough back to double-check they're still true.
 *
 * Run: node scripts/docs-prune-check.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

// Files this check applies to: the durable-memory docs, not every markdown file in the repo.
const TRACKED_FILES = ['docs/DECISIONS.md', 'docs/USER-CORRECTIONS.md']

const LINE_THRESHOLD = 150 // above this, prefer consolidating over appending
const ENTRY_THRESHOLD = 12 // above this many H2 entries, some are likely mergeable
const STALE_DAYS = 180 // entries older than this are worth a "still true?" glance
const TITLE_SIMILARITY_THRESHOLD = 0.6 // word-overlap ratio to flag as a likely near-duplicate

function parseEntries(content) {
  // Split on H2 headings ("## Title (YYYY-MM-DD)" or "## Title"), keep the heading + body.
  const lines = content.split('\n')
  const entries = []
  let current = null
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      if (current) entries.push(current)
      current = { heading: match[1].trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) entries.push(current)
  return entries
}

function extractDate(heading) {
  const m = heading.match(/\((\d{4}-\d{2}-\d{2})\)/)
  return m ? new Date(m[1]) : null
}

function titleWords(heading) {
  return new Set(
    heading
      .toLowerCase()
      .replace(/\(\d{4}-\d{2}-\d{2}\)/, '')
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 3),
  )
}

function jaccard(a, b) {
  const intersection = [...a].filter(w => b.has(w)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

function checkFile(relPath) {
  const abs = path.join(ROOT, relPath)
  if (!fs.existsSync(abs)) return { relPath, missing: true }

  const content = fs.readFileSync(abs, 'utf-8')
  const lineCount = content.split('\n').length
  const entries = parseEntries(content)
  const now = new Date()

  const findings = []

  if (lineCount > LINE_THRESHOLD) {
    findings.push(
      `File is ${lineCount} lines (threshold ${LINE_THRESHOLD}). Look for entries to merge ` +
        `before adding another — consolidate overlapping principles rather than appending.`,
    )
  }

  if (entries.length > ENTRY_THRESHOLD) {
    findings.push(
      `${entries.length} entries (threshold ${ENTRY_THRESHOLD}). That many standalone entries ` +
        `usually means some are special cases of the same underlying principle — merge them.`,
    )
  }

  // Near-duplicate heading detection (naive word-overlap, no deps).
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const sim = jaccard(titleWords(entries[i].heading), titleWords(entries[j].heading))
      if (sim >= TITLE_SIMILARITY_THRESHOLD) {
        findings.push(
          `Possible near-duplicate entries — "${entries[i].heading}" and ` +
            `"${entries[j].heading}" (title overlap ${(sim * 100).toFixed(0)}%). Read both; ` +
            `if one supersedes or sharpens the other, merge into a single entry.`,
        )
      }
    }
  }

  // Stale entries.
  for (const entry of entries) {
    const date = extractDate(entry.heading)
    if (date && (now - date) / (1000 * 60 * 60 * 24) > STALE_DAYS) {
      findings.push(
        `"${entry.heading}" is over ${STALE_DAYS} days old — worth a glance to confirm it's ` +
          `still accurate, not just left to accumulate.`,
      )
    }
  }

  return { relPath, lineCount, entryCount: entries.length, findings }
}

function main() {
  console.log('Docs prune check — read-only, edits nothing. See docs/CODING-STANDARDS.md ("Learning from corrections").\n')

  let anyFindings = false
  for (const relPath of TRACKED_FILES) {
    const result = checkFile(relPath)
    if (result.missing) {
      console.log(`  ${relPath}: not found (skipped)\n`)
      continue
    }
    console.log(`${relPath} — ${result.lineCount} lines, ${result.entryCount} entries`)
    if (result.findings.length === 0) {
      console.log('  OK — no consolidation needed right now.\n')
    } else {
      anyFindings = true
      for (const f of result.findings) console.log(`  - ${f}`)
      console.log('')
    }
  }

  if (anyFindings) {
    console.log(
      'Action: review the flagged entries and edit them in place (merge/sharpen/delete).\n' +
        'Do not run a bulk auto-rewrite — same file, same commit as the review, human-reviewable diff.',
    )
    // Informational nudge, not a hard gate — this must never block a push. Callers that want
    // a hard gate (e.g. a dedicated CI step) can check stdout for "Nothing flagged." instead.
  } else {
    console.log('Nothing flagged.')
  }
}

main()
