import { parseFromFiles, assembleIdentity } from '../../packages/core/src/parser-core'

const FILE_MAP: Record<string, string> = {
  'AGENTS.md': '---\ntype: agents\n---\n# Workspace\nUse {{instructions/backend-patterns}} everywhere.\n',
  'instructions/backend-patterns.md': '---\nname: backend-patterns\n---\n# Backend Patterns\nLayer your services.\n',
  'wf/AGENTS.md': '---\ntype: agents\n---\n# WF Router\nBegin {{-> step}} and follow {{instructions/backend-patterns}}.\n',
  'wf/step/SKILL.md': '---\nname: step\nentry: true\n---\n# Step\nDo work.\n',
}

describe('assembleIdentity — L0/L1 ref loading', () => {
  it('is attached to the parsed graph', () => {
    const g = parseFromFiles(FILE_MAP)
    expect(g.identityAssembly).toBeDefined()
  })

  it('loads the workspace descriptor body (L0)', () => {
    const a = assembleIdentity(parseFromFiles(FILE_MAP))
    expect(a.workspace.descriptor).toContain('# Workspace')
  })

  it('resolves and loads a workspace-level reference (L0)', () => {
    const a = assembleIdentity(parseFromFiles(FILE_MAP))
    expect(a.workspace.refs).toHaveLength(1)
    const ref = a.workspace.refs[0]
    expect(ref.path).toBe('instructions/backend-patterns.md')
    expect(ref.content).toContain('# Backend Patterns')
    expect(ref.resolvedBy).toBe('path')
  })

  it('resolves and loads a nested workflow-level reference (L1)', () => {
    const a = assembleIdentity(parseFromFiles(FILE_MAP))
    expect(a.workflows.wf).toBeDefined()
    expect(a.workflows.wf.descriptor).toContain('# WF Router')
    // Only mention refs are loaded; the {{-> step}} edge is excluded.
    expect(a.workflows.wf.refs).toHaveLength(1)
    expect(a.workflows.wf.refs[0].path).toBe('instructions/backend-patterns.md')
    expect(a.workflows.wf.refs[0].content).toContain('Layer your services.')
  })

  it('reports an unresolved reference with null path and content', () => {
    const fm = {
      'AGENTS.md': '---\ntype: agents\n---\n# W\nSee {{instructions/missing}}.\n',
    }
    const a = assembleIdentity(parseFromFiles(fm))
    expect(a.workspace.refs).toHaveLength(1)
    expect(a.workspace.refs[0].path).toBeNull()
    expect(a.workspace.refs[0].content).toBeNull()
  })

  it('handles a workspace with no descriptor', () => {
    const a = assembleIdentity(parseFromFiles({ 'notes/x.md': '# just a note\n' }))
    expect(a.workspace.descriptor).toBeNull()
    expect(a.workspace.refs).toEqual([])
  })
})
