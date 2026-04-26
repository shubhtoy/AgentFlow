/**
 * File I/O utilities.
 */

import fs from 'fs'
import { ErrorCode, fail } from '@agentflow/core/errors'
import { validatePath } from './validate-path'

export function atomicWrite(filePath: string, content: string): void {
  const tmpPath = filePath + '.tmp.' + Date.now()
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8')
  } catch (err: unknown) {
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    throw fail(ErrorCode.FS_WRITE_ERROR, `Failed to write: ${(err as Error).message}`)
  }
  try {
    fs.renameSync(tmpPath, filePath)
  } catch (err: unknown) {
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    throw fail(ErrorCode.FS_WRITE_ERROR, `Failed to rename: ${(err as Error).message}`)
  }
}

export function safeDelete(filePath: string, rootDir: string): void {
  const check = validatePath(filePath, rootDir)
  if (!check.valid) throw fail(ErrorCode.PATH_TRAVERSAL, check.error!)
  fs.rmSync(check.resolved, { recursive: true, force: true })
}
