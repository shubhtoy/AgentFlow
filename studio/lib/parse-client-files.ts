/**
 * Parse workspace files sent from the browser.
 *
 * Writes files to a temp dir, runs parseRoot, cleans up.
 * Used by any API route that needs to parse browser workspace files.
 */
import os from 'os'
import fs from 'fs'
import path from 'path'
import { parseRoot } from '@agentflow/cli/parser'

export function parseClientFiles(files: { path: string; content: string }[]) {
  const tmpDir = path.join(os.tmpdir(), `af-parse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    for (const f of files) {
      const full = path.join(tmpDir, f.path)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, f.content, 'utf8')
    }
    return parseRoot(tmpDir)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
