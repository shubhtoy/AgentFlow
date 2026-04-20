import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { createInstructionManager } = require('../../packages/cli/src/services/instruction-manager')

describe('InstructionManager', () => {
  let tmpDir, rootDir, mgr

  const logger = { error: () => {}, warn: () => {} }

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'instruction-test-')))
    rootDir = tmpDir
    mgr = createInstructionManager({ rootDir, logger })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function writeInstructionFile(name, frontmatter, body) {
    const dir = path.join(rootDir, 'instructions')
    fs.mkdirSync(dir, { recursive: true })
    const lines = ['---']
    for (const [k, v] of Object.entries(frontmatter)) {
      if (Array.isArray(v)) {
        lines.push(`${k}: [${v.join(', ')}]`)
      } else {
        lines.push(`${k}: ${v}`)
      }
    }
    lines.push('---')
    lines.push(body)
    fs.writeFileSync(path.join(dir, `${name}.md`), lines.join('\n'), 'utf8')
  }

  describe('loadAll()', () => {
    it('loads nothing when instructions dir does not exist', () => {
      mgr.loadAll()
      expect(mgr.list()).toEqual([])
    })

    it('loads .md files and parses frontmatter', () => {
      writeInstructionFile('code-style', { inclusion: 'auto', description: 'Style guide' }, '# Code Style\nUse single quotes.')
      writeInstructionFile('security', { inclusion: 'manual', description: 'Security rules', tags: ['sec'] }, '# Security')

      mgr.loadAll()
      const docs = mgr.list()
      expect(docs).toHaveLength(2)

      const codeStyle = docs.find(d => d.name === 'code-style')
      expect(codeStyle.inclusion).toBe('auto')
      expect(codeStyle.description).toBe('Style guide')

      const security = docs.find(d => d.name === 'security')
      expect(security.inclusion).toBe('manual')
      expect(security.tags).toEqual(['sec'])
    })

    it('defaults inclusion to manual when missing', () => {
      writeInstructionFile('bare', {}, '# Bare doc')
      mgr.loadAll()
      expect(mgr.list()[0].inclusion).toBe('manual')
    })
  })

  describe('getInstructionContext()', () => {
    beforeEach(() => {
      writeInstructionFile('auto-doc', { inclusion: 'auto' }, 'Auto content')
      writeInstructionFile('manual-doc', { inclusion: 'manual' }, 'Manual content')
      writeInstructionFile('another-auto', { inclusion: 'auto' }, 'Another auto')
      mgr.loadAll()
    })

    it('returns only auto-included docs when requestedNames is null', () => {
      const ctx = mgr.getInstructionContext(null)
      expect(ctx).toContain('<instruction name="auto-doc">')
      expect(ctx).toContain('Auto content')
      expect(ctx).toContain('<instruction name="another-auto">')
      expect(ctx).not.toContain('manual-doc')
    })

    it('returns auto + explicitly requested docs', () => {
      const ctx = mgr.getInstructionContext(['manual-doc'])
      expect(ctx).toContain('<instruction name="auto-doc">')
      expect(ctx).toContain('<instruction name="manual-doc">')
      expect(ctx).toContain('<instruction name="another-auto">')
    })

    it('returns empty string when no docs match', () => {
      const emptyMgr = createInstructionManager({ rootDir: path.join(tmpDir, 'empty'), logger })
      emptyMgr.loadAll()
      expect(emptyMgr.getInstructionContext(null)).toBe('')
    })
  })

  describe('add()', () => {
    it('creates a new instruction file with frontmatter', () => {
      mgr.add('new-doc', '# New Doc\nContent here.', {
        inclusion: 'auto',
        description: 'A new doc',
        tags: ['test'],
      })

      const filePath = path.join(rootDir, 'instructions', 'new-doc.md')
      expect(fs.existsSync(filePath)).toBe(true)
      const raw = fs.readFileSync(filePath, 'utf8')
      expect(raw).toContain('inclusion: auto')
      expect(raw).toContain('description: A new doc')

      const docs = mgr.list()
      expect(docs).toHaveLength(1)
      expect(docs[0].name).toBe('new-doc')
      expect(docs[0].inclusion).toBe('auto')
    })

    it('creates instructions dir if it does not exist', () => {
      const dir = path.join(rootDir, 'instructions')
      expect(fs.existsSync(dir)).toBe(false)
      mgr.add('first', 'content')
      expect(fs.existsSync(dir)).toBe(true)
    })
  })

  describe('remove()', () => {
    it('deletes the file and removes from cache', () => {
      writeInstructionFile('to-delete', { inclusion: 'manual' }, '# Delete me')
      mgr.loadAll()
      expect(mgr.list()).toHaveLength(1)

      mgr.remove('to-delete')
      expect(mgr.list()).toHaveLength(0)
      expect(fs.existsSync(path.join(rootDir, 'instructions', 'to-delete.md'))).toBe(false)
    })

    it('handles removing non-existent doc gracefully', () => {
      mgr.loadAll()
      expect(() => mgr.remove('nonexistent')).not.toThrow()
    })
  })
})
