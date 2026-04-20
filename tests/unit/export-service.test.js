import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { createExportService } = require('../../src/services/export-service')

describe('ExportService', () => {
  let tmpDir, rootDir, svc

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-')))
    rootDir = path.join(tmpDir, '.agentflow')
    fs.mkdirSync(rootDir, { recursive: true })
    // Create minimal workspace files
    fs.writeFileSync(path.join(rootDir, 'AGENTS.md'), '---\ntype: agents\nname: test\n---\n# Test')
    fs.mkdirSync(path.join(rootDir, 'capabilities'), { recursive: true })
    fs.writeFileSync(path.join(rootDir, 'capabilities', 'read-code.md'), '---\nname: read-code\n---\n# Read Code')
    fs.mkdirSync(path.join(rootDir, 'test-wf'), { recursive: true })
    fs.writeFileSync(path.join(rootDir, 'test-wf', 'SKILL.md'), '---\nname: step1\n---\n# Step 1')

    svc = createExportService({ rootDir, logger: { error: () => {} } })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('json format', () => {
    it('exports workspace as JSON bundle', async () => {
      const result = await svc.exportWorkspace({ format: 'json' })
      expect(result.success).toBe(true)
      const bundle = JSON.parse(result.data.data)
      expect(bundle.version).toBe('1.0.0')
      expect(bundle.exportedAt).toBeDefined()
      expect(bundle.files).toBeDefined()
      expect(bundle.files['AGENTS.md']).toContain('# Test')
      expect(bundle.files['capabilities/read-code.md']).toContain('# Read Code')
    })

    it('includes contentType in result', async () => {
      const result = await svc.exportWorkspace({ format: 'json' })
      expect(result.data.contentType).toBe('application/json')
    })
  })

  describe('zip format', () => {
    it('exports workspace as ZIP buffer', async () => {
      const result = await svc.exportWorkspace({ format: 'zip' })
      expect(result.success).toBe(true)
      expect(Buffer.isBuffer(result.data.data)).toBe(true)
      expect(result.data.contentType).toBe('application/zip')
    })
  })

  describe('dir format', () => {
    it('exports workspace to a directory', async () => {
      const outputPath = path.join(tmpDir, 'export-output')
      const result = await svc.exportWorkspace({ format: 'dir', outputPath })
      expect(result.success).toBe(true)
      expect(result.data.path).toBe(outputPath)
      expect(result.data.fileCount).toBeGreaterThan(0)
      expect(fs.existsSync(path.join(outputPath, 'AGENTS.md'))).toBe(true)
    })

    it('fails without outputPath', async () => {
      const result = await svc.exportWorkspace({ format: 'dir' })
      expect(result.success).toBe(false)
      expect(result.error.message).toContain('outputPath')
    })
  })

  describe('share format', () => {
    it('exports compact shareable JSON', async () => {
      const result = await svc.exportWorkspace({ format: 'share' })
      expect(result.success).toBe(true)
      const compact = JSON.parse(result.data.data)
      expect(compact.v).toBe(1)
      expect(compact.f).toBeDefined()
      expect(compact.m).toBeDefined()
      expect(compact.m.c).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('fails on unknown format', async () => {
      const result = await svc.exportWorkspace({ format: 'xml' })
      expect(result.success).toBe(false)
      expect(result.error.message).toContain('Unknown format')
    })

    it('fails on empty workspace', async () => {
      const emptyDir = path.join(tmpDir, 'empty')
      fs.mkdirSync(emptyDir, { recursive: true })
      const emptySvc = createExportService({ rootDir: emptyDir, logger: { error: () => {} } })
      const result = await emptySvc.exportWorkspace({ format: 'json' })
      expect(result.success).toBe(false)
    })

    it('defaults to json format', async () => {
      const result = await svc.exportWorkspace()
      expect(result.success).toBe(true)
      const bundle = JSON.parse(result.data.data)
      expect(bundle.version).toBe('1.0.0')
    })
  })
})
