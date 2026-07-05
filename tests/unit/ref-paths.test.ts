import { parseFromFiles } from '../../packages/core/src/parser-core'
import {
  toRelativePath,
  rewriteRefsToPaths,
  resolveRefsToPaths,
} from '../../packages/core/src/ref-paths'

// A mini workflow mirroring the validated directory-walk rig.
const FILE_MAP: Record<string, string> = {
  'AGENTS.md': '---\ntype: agents\n---\n# Workspace\nStyle: {{instructions/web-style}}\n',
  'instructions/web-style.md': '---\nname: web-style\n---\n# Web style guide\n',
  'wf/AGENTS.md': '---\ntype: agents\n---\n# WF\nBegin at {{-> research}}\n',
  'wf/research/SKILL.md': '---\nname: research\nentry: true\n---\n# Research\nWhen done, go to {{-> plan}}\n',
  'wf/plan/SKILL.md':
    '---\nname: plan\n---\n# Plan\nFollow {{instructions/web-style}}. Use {{<< output.research}}. Next {{-> review}}\n',
  'wf/review/SKILL.md':
    '---\nname: review\n---\n# Review\nApprove {{-> build | approved}} or revise {{-> plan | changes}}\n',
  'wf/build/SKILL.md': '---\nname: build\n---\n# Build\nRead {{<< output.research}} then produce output\n',
}

function graph() {
  return parseFromFiles(FILE_MAP)
}

describe('toRelativePath', () => {
  it('resolves a sibling directory (one up, one down)', () => {
    expect(toRelativePath('wf/review/SKILL.md', 'wf/plan/SKILL.md')).toBe('../plan/SKILL.md')
  })

  it('resolves across two levels up', () => {
    expect(toRelativePath('wf/build/SKILL.md', 'instructions/x.md')).toBe('../../instructions/x.md')
  })

  it('resolves a same-directory target with ./ prefix', () => {
    expect(toRelativePath('wf/a/SKILL.md', 'wf/a/other.md')).toBe('./other.md')
  })

  it('resolves from a root-level file with ./ prefix', () => {
    expect(toRelativePath('AGENTS.md', 'instructions/web-style.md')).toBe('./instructions/web-style.md')
  })

  it('normalizes backslashes and redundant segments', () => {
    expect(toRelativePath('wf\\plan\\SKILL.md', 'wf/./review/SKILL.md')).toBe('../review/SKILL.md')
  })
})

describe('rewriteRefsToPaths — per ref type', () => {
  it('resolves a mention ref to a relative path', () => {
    const r = rewriteRefsToPaths('See {{instructions/web-style}} here', 'wf/plan/SKILL.md', graph(), 'wf')
    expect(r.content).toBe('See `../../instructions/web-style.md` here')
    expect(r.unresolved).toHaveLength(0)
  })

  it('resolves a plain edge ref to the target node file', () => {
    const r = rewriteRefsToPaths('Go to {{-> plan}}', 'wf/research/SKILL.md', graph(), 'wf')
    expect(r.content).toBe('Go to `../plan/SKILL.md`')
  })

  it('resolves a conditional edge ref with its condition annotation', () => {
    const r = rewriteRefsToPaths('Approve {{-> build | approved}}', 'wf/review/SKILL.md', graph(), 'wf')
    expect(r.content).toBe('Approve `../build/SKILL.md` (when: approved)')
    expect(r.unresolved).toHaveLength(0)
  })

  it('resolves a data-flow ref to the producing node output directory', () => {
    const r = rewriteRefsToPaths('Use {{<< output.research}}', 'wf/plan/SKILL.md', graph(), 'wf')
    expect(r.content).toBe('Use `../research/output/`')
  })

  it('resolves multiple refs in one file and leaves no tokens behind', () => {
    const src = FILE_MAP['wf/plan/SKILL.md'].split('---')[2] // body only
    const r = rewriteRefsToPaths(src, 'wf/plan/SKILL.md', graph(), 'wf')
    expect(r.content).not.toContain('{{')
    expect(r.content).toContain('`../../instructions/web-style.md`')
    expect(r.content).toContain('`../research/output/`')
    expect(r.content).toContain('`../review/SKILL.md`')
    expect(r.unresolved).toHaveLength(0)
  })
})

describe('resolveRefsToPaths — whole graph', () => {
  it('rewrites every ref-bearing file with no tokens left and nothing unresolved', () => {
    const { files, unresolved } = resolveRefsToPaths(graph())
    expect(unresolved).toHaveLength(0)
    for (const [path, content] of Object.entries(files)) {
      expect(content, `tokens remaining in ${path}`).not.toContain('{{')
    }
  })

  it('resolves the workflow descriptor entry edge', () => {
    const { files } = resolveRefsToPaths(graph())
    expect(files['wf/AGENTS.md']).toContain('`./research/SKILL.md`')
  })

  it('resolves both branches of a conditional (router) node', () => {
    const { files } = resolveRefsToPaths(graph())
    const review = files['wf/review/SKILL.md']
    expect(review).toContain('`../build/SKILL.md` (when: approved)')
    expect(review).toContain('`../plan/SKILL.md` (when: changes)')
  })

  it('resolves a root-level mention from AGENTS.md', () => {
    const { files } = resolveRefsToPaths(graph())
    expect(files['AGENTS.md']).toContain('`./instructions/web-style.md`')
  })
})

describe('broken refs', () => {
  it('reports an unresolved mention and leaves the token untouched (no silent pass)', () => {
    const fm = {
      'AGENTS.md': '---\ntype: agents\n---\n# W\n',
      'wf/AGENTS.md': '---\ntype: agents\n---\n# WF\n',
      'wf/step/SKILL.md': '---\nname: step\nentry: true\n---\n# Step\nSee {{instructions/does-not-exist}}\n',
    }
    const g = parseFromFiles(fm)
    const { files, unresolved } = resolveRefsToPaths(g)
    expect(unresolved.length).toBeGreaterThan(0)
    expect(unresolved.some(u => u.ref.name === 'does-not-exist')).toBe(true)
    expect(files['wf/step/SKILL.md']).toContain('{{instructions/does-not-exist}}')
  })

  it('reports an unresolved data-flow ref to a non-existent node', () => {
    const r = rewriteRefsToPaths('Use {{<< output.ghost}}', 'wf/plan/SKILL.md', graph(), 'wf')
    expect(r.unresolved).toHaveLength(1)
    expect(r.content).toContain('{{<< output.ghost}}')
  })
})
