import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

import { createImportService } from '../../packages/cli/src/services/import-service';

describe('ImportService', () => {
  let tmpDir, rootDir, svc

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'import-test-')))
    rootDir = path.join(tmpDir, '.agentflow')
    fs.mkdirSync(rootDir, { recursive: true })
    svc = createImportService({ rootDir, logger: { error: () => {} } })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('validateFileMap', () => {
    it('rejects empty file map', () => {
      const result = svc.validateFileMap({})
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('No files in import')
    })

    it('rejects path traversal', () => {
      const result = svc.validateFileMap({ '../../../etc/passwd': 'bad' })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Path traversal')
    })

    it('rejects absolute paths', () => {
      const result = svc.validateFileMap({ '/etc/passwd': 'bad' })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Absolute path')
    })

    it('warns on missing AGENTS.md', () => {
      const result = svc.validateFileMap({ 'tools/test.md': '# Test' })
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('AGENTS.md'))).toBe(true)
    })

    it('warns on invalid frontmatter', () => {
      const result = svc.validateFileMap({ 'AGENTS.md': '---\nname: test\n' })
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('frontmatter'))).toBe(true)
    })

    it('warns on large files', () => {
      const result = svc.validateFileMap({ 'AGENTS.md': 'x'.repeat(20000) })
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('Large file'))).toBe(true)
    })

    it('passes valid file map', () => {
      const result = svc.validateFileMap({
        'AGENTS.md': '---\ntype: agents\nname: test\n---\n# Test',
        'tools/read.md': '---\nname: read\n---\n# Read',
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('importFromClipboard', () => {
    it('imports shareable format', () => {
      const shareable = JSON.stringify({
        v: 1, n: 'test',
        f: { 'AGENTS.md': '---\ntype: agents\n---\n# Test', 'tools/t.md': '# Tool' },
        m: { t: new Date().toISOString(), c: 2 },
      })
      const result = svc.importFromClipboard(shareable, rootDir)
      expect(result.success).toBe(true)
      expect(result.data.filesWritten).toContain('AGENTS.md')
      expect(fs.existsSync(path.join(rootDir, 'AGENTS.md'))).toBe(true)
    })

    it('imports JSON export bundle format', () => {
      const bundle = JSON.stringify({
        version: '1.0.0',
        files: { 'AGENTS.md': '---\ntype: agents\n---\n# Test' },
      })
      const result = svc.importFromClipboard(bundle, rootDir)
      expect(result.success).toBe(true)
      expect(result.data.filesWritten).toContain('AGENTS.md')
    })

    it('rejects unrecognized format', () => {
      const result = svc.importFromClipboard('{"random": "data"}', rootDir)
      expect(result.success).toBe(false)
      expect(result.error.message).toContain('Unrecognized')
    })

    it('supports dry run', () => {
      const shareable = JSON.stringify({
        v: 1, n: 'test',
        f: { 'AGENTS.md': '# Test' },
        m: { t: new Date().toISOString(), c: 1 },
      })
      const result = svc.importFromClipboard(shareable, rootDir, { dryRun: true })
      expect(result.success).toBe(true)
      expect(result.data.dryRun).toBe(true)
      // File should NOT be written in dry run
      expect(fs.existsSync(path.join(rootDir, 'AGENTS.md'))).toBe(false)
    })

    it('skips existing files without overwrite', () => {
      fs.writeFileSync(path.join(rootDir, 'AGENTS.md'), 'original')
      const shareable = JSON.stringify({
        v: 1, n: 'test',
        f: { 'AGENTS.md': 'new content' },
        m: { t: new Date().toISOString(), c: 1 },
      })
      const result = svc.importFromClipboard(shareable, rootDir, { overwrite: false })
      expect(result.success).toBe(true)
      expect(result.data.skipped).toContain('AGENTS.md')
      expect(fs.readFileSync(path.join(rootDir, 'AGENTS.md'), 'utf8')).toBe('original')
    })

    it('overwrites existing files with overwrite flag', () => {
      fs.writeFileSync(path.join(rootDir, 'AGENTS.md'), 'original')
      const shareable = JSON.stringify({
        v: 1, n: 'test',
        f: { 'AGENTS.md': 'new content' },
        m: { t: new Date().toISOString(), c: 1 },
      })
      const result = svc.importFromClipboard(shareable, rootDir, { overwrite: true })
      expect(result.success).toBe(true)
      expect(result.data.filesWritten).toContain('AGENTS.md')
      expect(fs.readFileSync(path.join(rootDir, 'AGENTS.md'), 'utf8')).toBe('new content')
    })
  })

  describe('importFromLibrary', () => {
    it('imports a single-file library item (skill)', () => {
      const result = svc.importFromLibrary('skill', 'code-review', rootDir)
      expect(result.success).toBe(true)
      expect(result.data.filesWritten.length).toBeGreaterThan(0)
    })

    it('imports a workflow directory', () => {
      const result = svc.importFromLibrary('workflow', 'build-feature', rootDir)
      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(rootDir, 'build-feature', 'AGENTS.md'))).toBe(true)
    })

    it('fails on non-existent item', () => {
      const result = svc.importFromLibrary('tool', 'does-not-exist', rootDir)
      expect(result.success).toBe(false)
      expect(result.error.message).toContain('not found')
    })
  })
})
