'use strict';

const fs = require('fs');
const { ErrorCode, fail } = require('../errors');
const { validatePath } = require('./validate-path');

/**
 * Write file atomically: write to tmp, then rename.
 * @param {string} filePath — absolute path
 * @param {string} content
 */
function atomicWrite(filePath, content) {
  const tmpPath = filePath + '.tmp.' + Date.now();
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    throw fail(ErrorCode.FS_WRITE_ERROR, `Failed to write: ${err.message}`);
  }
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    throw fail(ErrorCode.FS_WRITE_ERROR, `Failed to rename: ${err.message}`);
  }
}

/**
 * Delete a file/directory after validating the path is within rootDir.
 * @param {string} filePath — relative or absolute path
 * @param {string} rootDir — absolute root boundary
 */
function safeDelete(filePath, rootDir) {
  const check = validatePath(filePath, rootDir);
  if (!check.valid) {
    throw fail(ErrorCode.PATH_TRAVERSAL, check.error);
  }
  fs.rmSync(check.resolved, { recursive: true, force: true });
}

module.exports = { atomicWrite, safeDelete };
