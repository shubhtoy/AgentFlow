/**
 * Sample workflow data for documentation component previews.
 * Based on the build-feature workflow from the library.
 */

export const buildFeatureWorkflow = {
  id: 'build-feature',
  name: 'build-feature',
  description: 'Spec-driven feature development — requirements, design, tasks, implement, verify',
  nodes: [
    { id: 'gather-requirements', name: 'gather-requirements', nodeType: 'step' as const, entry: true, description: 'Understand the feature request and produce a structured requirements document' },
    { id: 'review-requirements-gate', name: 'review-requirements-gate', nodeType: 'router' as const, entry: false, description: 'Present requirements to user, route on approval or rejection' },
    { id: 'create-design', name: 'create-design', nodeType: 'step' as const, entry: false, description: 'Transform approved requirements into a detailed technical design' },
    { id: 'review-design-gate', name: 'review-design-gate', nodeType: 'router' as const, entry: false, description: 'Present design to user, route on approval or rejection' },
    { id: 'plan-tasks', name: 'plan-tasks', nodeType: 'step' as const, entry: false, description: 'Break the approved design into ordered, atomic implementation tasks' },
    { id: 'review-tasks-gate', name: 'review-tasks-gate', nodeType: 'router' as const, entry: false, description: 'Present task list to user, route on approval or rejection' },
    { id: 'implement-task', name: 'implement-task', nodeType: 'step' as const, entry: false, description: 'Execute one implementation task — write code, run diagnostics, run tests, verify' },
    { id: 'task-completion-gate', name: 'task-completion-gate', nodeType: 'router' as const, entry: false, description: 'Check if more tasks remain or all tasks are done' },
    { id: 'verify-feature', name: 'verify-feature', nodeType: 'step' as const, entry: false, description: 'Final integration check — run full test suite, verify all requirements, sign off' },
  ],
  edges: [
    { from: 'gather-requirements', to: 'review-requirements-gate', condition: null },
    { from: 'review-requirements-gate', to: 'create-design', condition: 'runbooks/requirements-approved' },
    { from: 'review-requirements-gate', to: 'gather-requirements', condition: 'runbooks/requirements-rejected' },
    { from: 'create-design', to: 'review-design-gate', condition: null },
    { from: 'review-design-gate', to: 'plan-tasks', condition: 'runbooks/design-approved' },
    { from: 'review-design-gate', to: 'create-design', condition: 'runbooks/design-rejected' },
    { from: 'plan-tasks', to: 'review-tasks-gate', condition: null },
    { from: 'review-tasks-gate', to: 'implement-task', condition: 'runbooks/tasks-approved' },
    { from: 'review-tasks-gate', to: 'plan-tasks', condition: 'runbooks/tasks-rejected' },
    { from: 'implement-task', to: 'task-completion-gate', condition: null },
    { from: 'task-completion-gate', to: 'implement-task', condition: 'runbooks/more-tasks-remain' },
    { from: 'task-completion-gate', to: 'implement-task', condition: 'runbooks/task-failed' },
    { from: 'task-completion-gate', to: 'verify-feature', condition: 'runbooks/all-tasks-done' },
    { from: 'verify-feature', to: 'implement-task', condition: null },
  ],
}

export const sampleResources = {
  capabilities: ['read-code', 'write-file', 'get-diagnostics', 'run-tests', 'source-agent', 'web-search'],
  instructions: ['requirements-elicitation', 'technical-design', 'task-decomposition', 'implementation-discipline', 'code-search', 'test-analysis'],
  runbooks: ['requirements-approved', 'requirements-rejected', 'design-approved', 'design-rejected', 'tasks-approved', 'tasks-rejected', 'more-tasks-remain', 'task-failed', 'all-tasks-done', 'checkpoint'],
  memory: ['user', 'decisions', 'facts', 'lessons'],
  hooks: ['diagnostics-after-write', 'test-on-change'],
}

export const sampleIdentity = {
  name: 'Senior Engineer',
  role: 'Full-stack developer specializing in spec-driven feature development',
  personality: 'Methodical, thorough, prefers small PRs and incremental verification',
  constraints: [
    'Never skip tests',
    'Always check diagnostics after edits',
    'Never skip the requirements or design phase',
    'Write to memory as you learn',
  ],
}

/** Sample node SKILL.md frontmatter */
export const sampleNodeFrontmatter = {
  name: 'gather-requirements',
  type: 'step',
  entry: true,
  agent: 'requirements-analyst',
  context: {
    max_tokens: 4000,
    inputs: [
      { ref: 'instructions/requirements-elicitation', scope: 'full' },
      { ref: 'capabilities/read-code', scope: 'signature' },
      { ref: 'capabilities/source-agent', scope: 'signature' },
      { ref: 'memory/user', scope: 'full' },
    ],
  },
  outputs: [
    { name: 'requirements-doc', format: 'markdown', description: 'Structured requirements document' },
  ],
}
