'use strict';

const fs = require('fs');
const path = require('path');
const { ok, fail, ErrorCode } = require('@agentflow/core/services/types');

/**
 * Create an ImportService for multi-source workspace import.
 * @param {{ rootDir: string, logger: object }} ctx
 */
function createImportService(ctx) {
  const { rootDir, logger } = ctx;

  /**
   * Validate a file map before writing.
   * @param {Record<string, string>} fileMap
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  function validateFileMap(fileMap) {
    const errors = [];
    const warnings = [];

    if (!fileMap || Object.keys(fileMap).length === 0) {
      errors.push('No files in import');
      return { valid: false, errors, warnings };
    }

    for (const p of Object.keys(fileMap)) {
      if (p.includes('..')) {
        errors.push(`Path traversal detected: ${p}`);
      }
      if (path.isAbsolute(p)) {
        errors.push(`Absolute path not allowed: ${p}`);
      }
    }

    // Check for AGENTS.md
    const hasAgents = Object.keys(fileMap).some(p => p === 'AGENTS.md' || p.endsWith('/AGENTS.md'));
    if (!hasAgents) {
      warnings.push('No AGENTS.md found — this may not be a complete workspace');
    }

    // Check frontmatter validity on .md files
    for (const [p, content] of Object.entries(fileMap)) {
      if (!p.endsWith('.md')) continue;
      if (content.startsWith('---')) {
        const endIdx = content.indexOf('---', 3);
        if (endIdx === -1) {
          warnings.push(`Invalid frontmatter in ${p} — no closing ---`);
        }
      }
    }

    // Check for large files
    for (const [p, content] of Object.entries(fileMap)) {
      if (content.length > 10240) {
        warnings.push(`Large file: ${p} (${Math.round(content.length / 1024)}KB)`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Write a file map to disk.
   * @param {Record<string, string>} fileMap
   * @param {string} targetRoot
   * @param {{ overwrite?: boolean }} options
   */
  function writeFileMap(fileMap, targetRoot, options = {}) {
    const written = [];
    const skipped = [];

    for (const [relPath, content] of Object.entries(fileMap)) {
      const fullPath = path.join(targetRoot, relPath);
      if (fs.existsSync(fullPath) && !options.overwrite) {
        skipped.push(relPath);
        continue;
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      written.push(relPath);
    }

    return { written, skipped };
  }

  /**
   * Parse a shareable or JSON bundle format into a file map.
   */
  function parseImportJson(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    // ShareableFormat: { v, n, f, m }
    if (data.v && data.f) return data.f;
    // JsonExportBundle: { version, files }
    if (data.files) return data.files;
    return null;
  }

  /**
   * Strip .agentflow/ prefix from ZIP paths if present.
   */
  function stripPrefix(filePath) {
    const prefixes = ['.agentflow/', 'agentflow/'];
    for (const prefix of prefixes) {
      if (filePath.startsWith(prefix)) return filePath.slice(prefix.length);
    }
    return filePath;
  }

  return {
    /**
     * Import from a ZIP buffer.
     */
    async importFromZip(buffer, targetRoot, options = {}) {
      try {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const fileMap = {};

        for (const [zipPath, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const content = await entry.async('string');
          const relPath = stripPrefix(zipPath);
          if (relPath) fileMap[relPath] = content;
        }

        const validation = validateFileMap(fileMap);
        if (!validation.valid) {
          return fail(ErrorCode.INVALID_INPUT, validation.errors.join('; '), 400);
        }

        if (options.dryRun) {
          return ok({ filesWritten: Object.keys(fileMap), skipped: [], warnings: validation.warnings, dryRun: true });
        }

        const { written, skipped } = writeFileMap(fileMap, targetRoot || rootDir, options);
        return ok({ filesWritten: written, skipped, warnings: validation.warnings });
      } catch (err) {
        logger.error({ err }, 'ImportService.importFromZip failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },

    /**
     * Import from a URL (fetches shareable JSON).
     */
    async importFromUrl(url, targetRoot, options = {}) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          return fail(ErrorCode.UNKNOWN, `Failed to fetch URL: ${resp.status}`, 400);
        }
        const json = await resp.text();
        const fileMap = parseImportJson(json);
        if (!fileMap) {
          return fail(ErrorCode.INVALID_INPUT, 'Unrecognized import format', 400);
        }

        const validation = validateFileMap(fileMap);
        if (!validation.valid) {
          return fail(ErrorCode.INVALID_INPUT, validation.errors.join('; '), 400);
        }

        if (options.dryRun) {
          return ok({ filesWritten: Object.keys(fileMap), skipped: [], warnings: validation.warnings, dryRun: true });
        }

        const { written, skipped } = writeFileMap(fileMap, targetRoot || rootDir, options);
        return ok({ filesWritten: written, skipped, warnings: validation.warnings });
      } catch (err) {
        logger.error({ err }, 'ImportService.importFromUrl failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },

    /**
     * Import from clipboard (shareable JSON string).
     */
    importFromClipboard(jsonString, targetRoot, options = {}) {
      try {
        const fileMap = parseImportJson(jsonString);
        if (!fileMap) {
          return fail(ErrorCode.INVALID_INPUT, 'Unrecognized import format', 400);
        }

        const validation = validateFileMap(fileMap);
        if (!validation.valid) {
          return fail(ErrorCode.INVALID_INPUT, validation.errors.join('; '), 400);
        }

        if (options.dryRun) {
          return ok({ filesWritten: Object.keys(fileMap), skipped: [], warnings: validation.warnings, dryRun: true });
        }

        const { written, skipped } = writeFileMap(fileMap, targetRoot || rootDir, options);
        return ok({ filesWritten: written, skipped, warnings: validation.warnings });
      } catch (err) {
        logger.error({ err }, 'ImportService.importFromClipboard failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },

    /**
     * Import from library (copy item to workspace).
     */
    importFromLibrary(type, name, targetRoot) {
      try {
        const libraryDir = path.join(__dirname, '..', '..', 'library');
        const registryPath = path.join(libraryDir, 'registry.json');
        if (!fs.existsSync(registryPath)) {
          return fail(ErrorCode.FILE_NOT_FOUND, 'Library registry not found', 404);
        }

        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        const entry = registry.entries.find(e => e.type === type && e.name === name);
        if (!entry) {
          const available = registry.entries.filter(e => e.type === type).map(e => e.name);
          return fail(ErrorCode.FILE_NOT_FOUND, `"${name}" not found. Available ${type}s: ${available.join(', ')}`, 404);
        }

        const sourcePath = path.join(libraryDir, entry.path);
        const target = targetRoot || rootDir;

        if (fs.statSync(sourcePath).isDirectory()) {
          // Workflow — copy entire directory
          const destDir = path.join(target, path.basename(entry.path));
          copyDirRecursive(sourcePath, destDir);
          return ok({ filesWritten: [path.basename(entry.path)], skipped: [], warnings: [] });
        } else {
          // Single file — copy to appropriate category dir
          const categoryDir = path.join(target, `${type}s`);
          fs.mkdirSync(categoryDir, { recursive: true });
          const destPath = path.join(categoryDir, path.basename(entry.path));
          fs.copyFileSync(sourcePath, destPath);
          return ok({ filesWritten: [`${type}s/${path.basename(entry.path)}`], skipped: [], warnings: [] });
        }
      } catch (err) {
        logger.error({ err }, 'ImportService.importFromLibrary failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },

    /** Expose for testing */
    validateFileMap,
  };
}

/**
 * Recursively copy a directory.
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = { createImportService };
