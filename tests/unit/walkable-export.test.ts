import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseFromFiles } from '../../packages/core/src/parser-core'
import { parseRoot } from '../../packages/cli/src/parser'
import { emitWalkableDirectory, sanitizeSkillName } from '../../packages/cli/src/export/walkable-export'

// Same validated rig used by ref-paths.test.ts / l0-contract.test.ts, with one
// change: the terminal node is named "ship" instead of "build". "build" collides
// with parser-core's ARTIFACT_DIRS exclusion list (meant to skip compiled-output
// directories like build/ dist/ during workspace scans) — a real, pre-existing
// parser limitation unrelated to what this suite tests. Filed separately; not
// this emitter's bug to work around beyond avoiding it in the fixture.
const FILE_MAP: Record<string, string> = {
  'AGENTS.md': '---\ntype: agents\n---\n# Workspace\nStyle: {{instructions/web-style}}\n',
  'instructions/web-style.md': '---\nname: web-style\n---\n# Web style guide\n',
  'wf/AGENTS.md': '---\ntype: agents\n---\n# WF\nBegin at {{-> research}}\n',
  'wf/research/SKILL.md': '---\nname: research\nentry: true\n---\n# Research\nWhen done, go to {{-> plan}}\n',
  'wf/plan/SKILL.md':
    '---\nname: plan\n---\n# Plan\nFollow {{instructions/web-style}}. Use {{<< output.research}}. Next {{-> review}}\n',
  'wf/review/SKILL.md':
    '---\nname: review\n---\n# Review\nApprove {{-> ship | approved}} or revise {{-> plan | changes}}\n',
  'wf/ship/SKILL.md': '---\nname: ship\n---\n# Ship\nRead {{<< output.research}} then produce output\n',
}

function graph() {
  return parseFromFiles(FILE_MAP)
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-walkable-export-'))
}

describe('sanitizeSkillName', () => {
  it('lowercases and hyphenates', () => {
    expect(sanitizeSkillName('Research Step')).toBe('research-step')
  })

  it('collapses consecutive separators into a single hyphen', () => {
    expect(sanitizeSkillName('a__b---c')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeSkillName('-leading-and-trailing-')).toBe('leading-and-trailing')
  })

  it('falls back to "node" for an empty/unsanitizable id', () => {
    expect(sanitizeSkillName('')).toBe('node')
    expect(sanitizeSkillName('---')).toBe('node')
  })

  it('bounds length to 64 characters', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeSkillName(long).length).toBeLessThanOrEqual(64)
  })
})

describe('emitWalkableDirectory', () => {
  let outDir: string

  beforeEach(() => {
    outDir = makeTmpDir()
  })

  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  it('writes a root AGENTS.md (L0 contract)', () => {
    emitWalkableDirectory(graph(), outDir, { workflowId: 'wf' })
    const content = fs.readFileSync(path.join(outDir, 'AGENTS.md'), 'utf-8')
    expect(content).toContain('wf/research/SKILL.md')
  })

  it('writes one SKILL.md per node with an output/ scaffold', () => {
    emitWalkableDirectory(graph(), outDir, { workflowId: 'wf' })
    for (const node of ['research', 'plan', 'review', 'ship']) {
      expect(fs.existsSync(path.join(outDir, 'wf', node, 'SKILL.md'))).toBe(true)
      expect(fs.existsSync(path.join(outDir, 'wf', node, 'output'))).toBe(true)
    }
  })

  it('resolves every {{...}} ref to a plain relative path — no template syntax survives', () => {
    emitWalkableDirectory(graph(), outDir, { workflowId: 'wf' })
    const written = fs.readdirSync(path.join(outDir, 'wf'), { recursive: true }) as string[]
    for (const rel of written) {
      const full = path.join(outDir, 'wf', rel)
      if (fs.statSync(full).isDirectory()) continue
      const content = fs.readFileSync(full, 'utf-8')
      expect(content).not.toMatch(/\{\{.*?\}\}/)
    }
  })

  it('reports no unresolved refs for the validated rig', () => {
    const result = emitWalkableDirectory(graph(), outDir, { workflowId: 'wf' })
    expect(result.unresolved).toHaveLength(0)
  })

  it('lists every written file in filesWritten', () => {
    const result = emitWalkableDirectory(graph(), outDir, { workflowId: 'wf' })
    expect(result.filesWritten).toContain('AGENTS.md')
    expect(result.filesWritten).toContain('wf/research/SKILL.md')
  })

  it('sanitizes a node SKILL.md name: to match its (sanitized) directory', () => {
    const g = parseFromFiles({
      'AGENTS.md': '---\ntype: agents\n---\n# WS\n',
      'wf/AGENTS.md': '---\ntype: agents\n---\n# WF\nBegin at {{-> Research Step}}\n',
      'wf/Research Step/SKILL.md': '---\nname: Research Step\nentry: true\n---\n# Research\n',
    })
    emitWalkableDirectory(g, outDir, { workflowId: 'wf' })
    // Directory name comes from the original relativePath (parser-owned); the
    // frontmatter name: is what we sanitize to be spec-valid.
    const skillPath = fs.readdirSync(path.join(outDir, 'wf'), { recursive: true }).find(f => (f as string).endsWith('SKILL.md'))
    expect(skillPath).toBeDefined()
    const content = fs.readFileSync(path.join(outDir, 'wf', skillPath as string), 'utf-8')
    expect(content).toMatch(/^name: [a-z0-9-]+$/m)
  })

  it('throws for an unknown workflow id', () => {
    expect(() => emitWalkableDirectory(graph(), outDir, { workflowId: 'nope' })).toThrow(/unknown workflow/i)
  })

  it('refuses to write outside outDir (path traversal guard)', () => {
    const malicious = parseFromFiles({
      'AGENTS.md': '---\ntype: agents\n---\n# WS\n',
      'wf/AGENTS.md': '---\ntype: agents\n---\n# WF\nBegin at {{-> evil}}\n',
      'wf/evil/SKILL.md': '---\nname: evil\nentry: true\n---\n# Evil\n',
    })
    // Simulate a maliciously-crafted relativePath escaping the export root.
    const node = malicious.workflows.wf.nodes.evil
    node.primaryFile.relativePath = '../../etc/evil.md'
    expect(() => emitWalkableDirectory(malicious, outDir, { workflowId: 'wf' })).toThrow(/refusing to write outside/i)
  })
})

describe('emitWalkableDirectory — round trip', () => {
  it('author -> export -> re-parse: the exported directory parses back into an equivalent workflow', async () => {
    const outDir = makeTmpDir()
    try {
      emitWalkableDirectory(graph(), outDir, { workflowId: 'wf' })
      const reparsed = await parseRoot(outDir)

      expect(Object.keys(reparsed.workflows)).toContain('wf')
      const wf = reparsed.workflows.wf
      expect(Object.keys(wf.nodes).sort()).toEqual(['plan', 'research', 'review', 'ship'])

      // Re-parsed edges should still connect research -> plan -> review -> {ship|plan},
      // even though the exported SKILL.md files now contain plain paths instead of {{-> x}}.
      // (The exported directory is meant to be walked by an agent, not re-authored — so we
      // only assert it re-parses cleanly and preserves node identity, not that edges DSL round-trips.)
      expect(wf.nodes.research).toBeDefined()
      expect(wf.nodes.plan).toBeDefined()
      expect(wf.nodes.review).toBeDefined()
      expect(wf.nodes.ship).toBeDefined()
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })
})
