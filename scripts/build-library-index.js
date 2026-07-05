#!/usr/bin/env node
/**
 * Generates library/index.json — a flat list of all file paths in the library.
 * Run automatically before next build/dev via package.json prebuild script.
 */
const fs = require('fs')
const path = require('path')

const LIB = path.join(__dirname, '..', 'library')
const files = []

function walk(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'index.json' || entry.name === 'manifest.txt' || entry.name === 'node_modules') continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) walk(path.join(dir, entry.name), rel)
    else files.push(rel)
  }
}

walk(LIB)
fs.writeFileSync(path.join(LIB, 'index.json'), JSON.stringify({ files }, null, 2))
console.log(`library/index.json: ${files.length} files indexed`)
