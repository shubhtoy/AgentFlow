'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Validate that a file path is safely contained within rootDir.
 * Checks: null bytes, path traversal after resolution, symlink escape.
 * @param {string} filePath
 * @param {string} rootDir — absolute path
 * @returns {{ valid: boolean, resolved: string, error?: string }}
 */
function validatePath(filePath, rootDir) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, resolved: '', error: 'filePath is required' };
  }
  if (!rootDir || typeof rootDir !== 'string') {
    return { valid: false, resolved: '', error: 'rootDir is required' };
  }

  // Null byte check
  if (filePath.includes('\0')) {
    return { valid: false, resolved: '', error: 'Path contains null bytes' };
  }

  // Resolve rootDir through realpath if it exists (handles /tmp → /private/tmp on macOS)
  let realRoot;
  try {
    realRoot = fs.realpathSync(rootDir);
  } catch (_) {
    realRoot = path.resolve(rootDir);
  }

  // Resolve to absolute
  const resolved = path.resolve(realRoot, filePath);

  // Must start with rootDir (after resolve, before symlink check)
  const normalizedRoot = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (resolved !== realRoot && !resolved.startsWith(normalizedRoot)) {
    return { valid: false, resolved, error: 'Path traversal detected' };
  }

  // Symlink resolution — only if the file exists
  try {
    const real = fs.realpathSync(resolved);
    if (real !== realRoot && !real.startsWith(normalizedRoot)) {
      return { valid: false, resolved, error: 'Symlink escapes root directory' };
    }
    return { valid: true, resolved: real };
  } catch (err) {
    // File doesn't exist yet — that's fine, use the resolved path
    if (err.code === 'ENOENT') {
      return { valid: true, resolved };
    }
    return { valid: false, resolved, error: `Path resolution failed: ${err.message}` };
  }
}

module.exports = { validatePath };
