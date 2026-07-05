/**
 * Path validation.
 */

import fs from 'fs'
import path from 'path'

interface PathValidation {
  valid: boolean
  resolved: string
  error?: string
}

export function validatePath(filePath: string, rootDir: string): PathValidation {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, resolved: '', error: 'filePath is required' }
  }
  if (!rootDir || typeof rootDir !== 'string') {
    return { valid: false, resolved: '', error: 'rootDir is required' }
  }
  if (filePath.includes('\0')) {
    return { valid: false, resolved: '', error: 'Path contains null bytes' }
  }

  let realRoot: string
  try {
    realRoot = fs.realpathSync(rootDir)
  } catch {
    realRoot = path.resolve(rootDir)
  }

  const resolved = path.resolve(realRoot, filePath)
  const normalizedRoot = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep

  if (resolved !== realRoot && !resolved.startsWith(normalizedRoot)) {
    return { valid: false, resolved, error: 'Path traversal detected' }
  }

  try {
    const real = fs.realpathSync(resolved)
    if (real !== realRoot && !real.startsWith(normalizedRoot)) {
      return { valid: false, resolved, error: 'Symlink escapes root directory' }
    }
    return { valid: true, resolved: real }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { valid: true, resolved }
    }
    return { valid: false, resolved, error: `Path resolution failed: ${(err as Error).message}` }
  }
}
