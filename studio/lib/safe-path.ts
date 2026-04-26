import path from 'path'
import fs from 'fs'

/**
 * Resolve requestedPath against allowedRoot and reject traversal attempts.
 * Throws on null bytes or paths that escape allowedRoot.
 */
export function safePath(requestedPath: string, allowedRoot: string): string {
  if (requestedPath.includes('\0')) throw new Error('Path contains null bytes')

  let realRoot: string
  try { realRoot = fs.realpathSync(allowedRoot) } catch { realRoot = path.resolve(allowedRoot) }

  const resolved = path.resolve(realRoot, requestedPath)
  const normalizedRoot = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep

  if (resolved !== realRoot && !resolved.startsWith(normalizedRoot)) {
    throw new Error('Path traversal detected')
  }

  return resolved
}
