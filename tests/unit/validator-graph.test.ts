import { parseFromFiles } from '../../packages/core/src/parser-core'
import { validate } from '../../packages/core/src/validator/index'

function base(extra: Record<string, string>): Record<string, string> {
  return {
    'AGENTS.md': '---\ntype: agents\n---\n# Workspace\n',
    'wf/AGENTS.md': '---\ntype: agents\n---\n# WF\n',
    ...extra,
  }
}

describe('graph validation — cycles', () => {
  it('reports a cycle as a warning while keeping the workflow valid', () => {
    const g = parseFromFiles(base({
      'wf/research/SKILL.md': '---\nname: research\nentry: true\n---\n# R\nNext {{-> plan}}\n',
      'wf/plan/SKILL.md': '---\nname: plan\n---\n# P\nNext {{-> review}}\n',
      'wf/review/SKILL.md':
        '---\nname: review\n---\n# Rv\nApprove {{-> build | approved}} or revise {{-> plan | changes}}\n',
      'wf/build/SKILL.md': '---\nname: build\n---\n# B\n',
    }))
    const result = validate(g)
    const cycles = result.warnings.filter(w => w.type === 'cycle')
    expect(cycles.length).toBeGreaterThan(0)
    expect(cycles[0].workflow).toBe('wf')
    // A revision loop is legitimate — it must NOT fail validation.
    expect(result.valid).toBe(true)
  })

  it('does not report a cycle for an acyclic (linear) workflow', () => {
    const g = parseFromFiles(base({
      'wf/research/SKILL.md': '---\nname: research\nentry: true\n---\n# R\nNext {{-> plan}}\n',
      'wf/plan/SKILL.md': '---\nname: plan\n---\n# P\nNext {{-> review}}\n',
      'wf/review/SKILL.md': '---\nname: review\n---\n# Rv\nNext {{-> build}}\n',
      'wf/build/SKILL.md': '---\nname: build\n---\n# B\n',
    }))
    const result = validate(g)
    expect(result.warnings.filter(w => w.type === 'cycle')).toHaveLength(0)
  })
})

describe('graph validation — acceptance coverage', () => {
  it('flags a broken reference as an error', () => {
    const g = parseFromFiles(base({
      'wf/a/SKILL.md': '---\nname: a\nentry: true\n---\n# A\nSee {{instructions/nope}}\n',
    }))
    const result = validate(g)
    expect(result.errors.some(e => e.type === 'broken_ref')).toBe(true)
    expect(result.valid).toBe(false)
  })

  it('flags a workflow with no entry point as an error', () => {
    const g = parseFromFiles(base({
      'wf/a/SKILL.md': '---\nname: a\n---\n# A\n',
      'wf/b/SKILL.md': '---\nname: b\n---\n# B\n',
    }))
    const result = validate(g)
    expect(result.errors.some(e => e.type === 'no_entry_point')).toBe(true)
  })

  it('flags a dangling sub-workflow target as a warning', () => {
    const g = parseFromFiles(base({
      'wf/start/SKILL.md': '---\nname: start\nentry: true\n---\n# Start\n',
      'wf/sub/SKILL.md': '---\nname: sub\ntype: sub-workflow\nworkflow: ghost\n---\n# Sub\n',
    }))
    const result = validate(g)
    expect(result.warnings.some(w => w.type === 'missing_sub_workflow_target')).toBe(true)
  })
})
