import { parseFromFiles } from '../../packages/core/src/parser-core'
import { generateL0Contract } from '../../packages/core/src/export/l0-contract'

// Same validated rig as ref-paths.test.ts: entry node, a linear path, and a
// conditional gate (review -> build | approved, review -> plan | changes).
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

// A minimal ungated workflow: one node, no edges, no conditions.
const UNGATED_FILE_MAP: Record<string, string> = {
  'AGENTS.md': '---\ntype: agents\n---\n# Workspace\n',
  'solo/AGENTS.md': '---\ntype: agents\n---\n# Solo\nBegin at {{-> only}}\n',
  'solo/only/SKILL.md': '---\nname: only\nentry: true\n---\n# Only step\n',
}

function graph() {
  return parseFromFiles(FILE_MAP)
}

describe('generateL0Contract', () => {
  it('names the entry node path', () => {
    const contract = generateL0Contract(graph(), { workflowId: 'wf' })
    expect(contract).toContain('wf/research/SKILL.md')
  })

  it('lists the unconditional walk order', () => {
    const contract = generateL0Contract(graph(), { workflowId: 'wf' })
    expect(contract).toMatch(/1\.\s+.*research/i)
    expect(contract).toMatch(/2\.\s+.*plan/i)
  })

  it('flags gate behaviour when the workflow has conditional edges', () => {
    const contract = generateL0Contract(graph(), { workflowId: 'wf' })
    expect(contract.toLowerCase()).toContain('wait for approval')
  })

  it('does not claim gates exist when the workflow has none', () => {
    const g = parseFromFiles(UNGATED_FILE_MAP)
    const contract = generateL0Contract(g, { workflowId: 'solo' })
    expect(contract.toLowerCase()).toContain('no approval gates')
    expect(contract.toLowerCase()).not.toContain('wait for approval')
  })

  it('defaults to the graph\u2019s only workflow when workflowId is omitted', () => {
    const g = parseFromFiles(UNGATED_FILE_MAP)
    const contract = generateL0Contract(g)
    expect(contract).toContain('solo/only/SKILL.md')
  })

  it('throws for an unknown workflow id', () => {
    expect(() => generateL0Contract(graph(), { workflowId: 'nope' })).toThrow(/unknown workflow/i)
  })

  it('is plain Markdown \u2014 no YAML frontmatter block', () => {
    const contract = generateL0Contract(graph(), { workflowId: 'wf' })
    expect(contract.startsWith('---')).toBe(false)
  })

  it('produces a stable snapshot for the validated rig', () => {
    const contract = generateL0Contract(graph(), { workflowId: 'wf' })
    expect(contract).toMatchSnapshot()
  })
})
