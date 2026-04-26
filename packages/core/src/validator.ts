/**
 * AgentFlow Validator Module
 *
 * Data-driven validation rules. Router inferred from edges.
 * Skill validation added.
 */

import { resolveRef, RESERVED_DIRS } from './parser-core'
import type { ParsedGraph, ParsedFile, Ref, Edge, ParsedNode } from './parser-core'
import { getValidationSchema, resolveSchemaKey } from './schemas/frontmatter-schemas'
import type { ValidationField } from './schemas/frontmatter-schemas'

// ── Types ──────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info'

export interface RuleDef {
  id: string
  severity: Severity
  message: string
  category: string
}

export interface ValidationIssue {
  type: string
  message: string
  severity?: Severity
  filePath?: string
  field?: string
  resourceType?: string
  ref?: string
  workflow?: string
  nodes?: string[]
  token?: string
  server?: string
  dir?: string
  file?: string
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  valid: boolean
}

// ── Rule definitions (data-driven) ─────────────────────────────────────

export const RULES: RuleDef[] = [
  { id: 'broken_ref', severity: 'error', message: 'Reference {{ref}} does not resolve to any file', category: 'references' },
  { id: 'broken_data_flow', severity: 'error', message: 'Data flow ref to non-existent node', category: 'references' },
  { id: 'missing_condition', severity: 'error', message: 'Missing condition template in conditional edge', category: 'references' },
  { id: 'no_entry_point', severity: 'error', message: 'Workflow has no entry point', category: 'structure' },
  { id: 'multiple_entry_points', severity: 'error', message: 'Workflow has multiple entry points', category: 'structure' },
  { id: 'infinite_sub_workflow', severity: 'error', message: 'Infinite sub-workflow loop detected', category: 'structure' },
  { id: 'malformed_variable', severity: 'error', message: 'Malformed variable token', category: 'variables' },
  { id: 'schema', severity: 'warning', message: 'Schema validation issue', category: 'schema' },
  { id: 'ambiguous_ref', severity: 'warning', message: 'Ambiguous ref matches multiple files', category: 'references' },
  { id: 'unreachable', severity: 'warning', message: 'Node may be unreachable', category: 'structure' },
  { id: 'unknown_category', severity: 'warning', message: 'Unknown category prefix in ref', category: 'taxonomy' },
  { id: 'router_non_conditional', severity: 'warning', message: 'Router node has non-conditional edge', category: 'structure' },
  { id: 'router_has_capabilities', severity: 'warning', message: 'Router node references capabilities', category: 'structure' },
  { id: 'router_has_instructions', severity: 'warning', message: 'Router node references instructions', category: 'structure' },
  { id: 'router_single_exit', severity: 'warning', message: 'Router node has fewer than 2 exits', category: 'structure' },
  { id: 'context_budget', severity: 'warning', message: 'Invalid context budget', category: 'context' },
  { id: 'context_input_broken', severity: 'warning', message: 'Context input ref could not be resolved', category: 'context' },
  { id: 'context_budget_high', severity: 'warning', message: 'Context budget exceeds recommended 8k', category: 'context' },
  { id: 'output_declaration', severity: 'warning', message: 'Output declaration missing name', category: 'schema' },
  { id: 'orphaned_sub_workflow', severity: 'warning', message: 'Sub-workflow node has no linked workflow', category: 'structure' },
  { id: 'missing_sub_workflow_target', severity: 'warning', message: 'Sub-workflow target does not exist', category: 'references' },
  { id: 'unresolved_workflow_ref', severity: 'warning', message: 'Workflow ref does not match any known workflow', category: 'references' },
  { id: 'missing_mcp_server', severity: 'warning', message: 'MCP tool references undeclared server', category: 'mcp' },
  { id: 'orphaned_mcp_tool', severity: 'warning', message: 'Orphaned MCP tool file', category: 'mcp' },
  { id: 'misplaced_resource', severity: 'warning', message: 'Resource inside workflow dir should be at top level', category: 'structure' },
  { id: 'identity', severity: 'warning', message: 'Identity validation issue', category: 'identity' },
  { id: 'missing_skill_description', severity: 'warning', message: 'Skill has no description (needed for progressive disclosure)', category: 'skills' },
]

const RULE_MAP = new Map<string, RuleDef>(RULES.map(r => [r.id, r]))

function getRuleSeverity(id: string): Severity {
  return RULE_MAP.get(id)?.severity ?? 'warning'
}

function isHardError(id: string): boolean {
  return getRuleSeverity(id) === 'error'
}

// ── Schema setup ───────────────────────────────────────────────────────

const SCHEMA_TYPES = ['agents', 'node', 'capability', 'instruction', 'skill', 'condition', 'memory'] as const
const SCHEMAS: Record<string, Record<string, ValidationField>> = {}
for (const type of SCHEMA_TYPES) {
  const s = getValidationSchema(type)
  if (s) SCHEMAS[type] = s
}

// ── validateSchema ─────────────────────────────────────────────────────

export function validateSchema(
  frontmatter: Record<string, unknown>,
  resourceType: string,
  filePath = '',
): ValidationIssue[] {
  const errors: ValidationIssue[] = []
  const schema = SCHEMAS[resourceType]
  if (!schema) return errors
  const fm = frontmatter || {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = fm[field]

    if (rules.literal !== undefined) {
      if (value !== undefined && value !== rules.literal) {
        errors.push({ type: 'schema', filePath, field, message: `Expected literal value "${rules.literal}" but got "${value}"`, resourceType })
      }
      continue
    }

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ type: 'schema', filePath, field, message: `Missing required field "${field}"`, resourceType })
      continue
    }

    if (rules.requiredWhen) {
      const { field: depField, value: depValue } = rules.requiredWhen
      if (fm[depField] === depValue && (value === undefined || value === null || value === '')) {
        errors.push({ type: 'schema', filePath, field, message: `Field "${field}" is required when "${depField}" is "${depValue}"`, resourceType })
        continue
      }
    }

    if (value === undefined || value === null) continue

    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push({ type: 'schema', filePath, field, message: `Expected string for "${field}" but got ${typeof value}`, resourceType })
    } else if (rules.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
      errors.push({ type: 'schema', filePath, field, message: `Expected integer for "${field}" but got ${typeof value === 'number' ? 'non-integer number' : typeof value}`, resourceType })
    } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({ type: 'schema', filePath, field, message: `Expected boolean for "${field}" but got ${typeof value}`, resourceType })
    } else if (rules.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push({ type: 'schema', filePath, field, message: `Expected object for "${field}" but got ${Array.isArray(value) ? 'array' : typeof value}`, resourceType })
    } else if (rules.type === 'object[]') {
      if (!Array.isArray(value)) {
        errors.push({ type: 'schema', filePath, field, message: `Expected array of objects for "${field}" but got ${typeof value}`, resourceType })
      } else if (value.some(v => typeof v !== 'object' || v === null || Array.isArray(v))) {
        errors.push({ type: 'schema', filePath, field, message: `Expected all elements of "${field}" to be objects`, resourceType })
      }
    } else if (rules.type === 'string[]') {
      if (!Array.isArray(value)) {
        errors.push({ type: 'schema', filePath, field, message: `Expected array of strings for "${field}" but got ${typeof value}`, resourceType })
      } else if (value.some(v => typeof v !== 'string')) {
        errors.push({ type: 'schema', filePath, field, message: `Expected all elements of "${field}" to be strings`, resourceType })
      }
    }

    if (rules.enum && value !== undefined && value !== null) {
      if (!rules.enum.includes(value as string)) {
        errors.push({ type: 'schema', filePath, field, message: `Invalid value "${value}" for "${field}". Allowed: ${rules.enum.join(', ')}`, resourceType })
      }
    }
  }

  return errors
}

// ── detectCycles ───────────────────────────────────────────────────────

export function detectCycles(
  nodes: { id: string }[],
  edges: { from: string, to: string }[],
): ValidationIssue[] {
  const warnings: ValidationIssue[] = []
  const adj = new Map<string, string[]>()
  for (const node of nodes) adj.set(node.id, [])
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, [])
    adj.get(edge.from)!.push(edge.to)
  }

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const node of nodes) color.set(node.id, WHITE)
  const pathStack: string[] = []

  function dfs(nodeId: string) {
    color.set(nodeId, GRAY)
    pathStack.push(nodeId)
    for (const neighbor of (adj.get(nodeId) || [])) {
      if (color.get(neighbor) === GRAY) {
        const cycleStart = pathStack.indexOf(neighbor)
        const cycleNodes = pathStack.slice(cycleStart)
        warnings.push({
          type: 'cycle',
          message: `Cycle detected: ${cycleNodes.join(' → ')} → ${neighbor}`,
          nodes: cycleNodes,
        })
      } else if (color.get(neighbor) === WHITE) {
        dfs(neighbor)
      }
    }
    pathStack.pop()
    color.set(nodeId, BLACK)
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) dfs(node.id)
  }
  return warnings
}

// ── findUnreachable ────────────────────────────────────────────────────

export function findUnreachable(
  nodes: { id: string }[],
  edges: { from: string, to: string }[],
  entryNodes: string[],
): string[] {
  const entrySet = new Set(entryNodes || [])
  const hasIncoming = new Set<string>()
  for (const edge of edges) hasIncoming.add(edge.to)
  for (const node of nodes) {
    if (!hasIncoming.has(node.id)) entrySet.add(node.id)
  }

  const adj = new Map<string, string[]>()
  for (const node of nodes) adj.set(node.id, [])
  for (const edge of edges) {
    if (adj.has(edge.from)) adj.get(edge.from)!.push(edge.to)
  }

  const visited = new Set<string>()
  const queue = [...entrySet]
  for (const id of queue) visited.add(id)
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of (adj.get(current) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return nodes.map(n => n.id).filter(id => !visited.has(id))
}

// ── validateVariables ──────────────────────────────────────────────────

const VALID_VAR_REGEX = /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g
const ALL_VAR_REGEX = /\$\{env:([^}]*)\}/g

export function validateVariables(content: string): { message: string, token: string }[] {
  if (!content || typeof content !== 'string') return []
  const errors: { message: string, token: string }[] = []
  const validPositions = new Set<number>()

  VALID_VAR_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = VALID_VAR_REGEX.exec(content)) !== null) {
    validPositions.add(match.index)
  }

  ALL_VAR_REGEX.lastIndex = 0
  while ((match = ALL_VAR_REGEX.exec(content)) !== null) {
    if (!validPositions.has(match.index)) {
      errors.push({ message: `Malformed variable token: ${match[0]}`, token: match[0] })
    }
  }
  return errors
}

// ── validate (main) ────────────────────────────────────────────────────

export function validate(
  graph: ParsedGraph,
  options: { strict?: boolean } = {},
): ValidationResult {
  const strict = options.strict || false
  const hardErrors: ValidationIssue[] = []
  const softIssues: ValidationIssue[] = []

  if (!graph) {
    return { errors: [{ type: 'fatal', message: 'No graph provided' }], warnings: [], valid: false }
  }

  const allFiles = graph.allFiles || []
  const workflows = graph.workflows || {}

  // 1. Schema validation for all typed files
  for (const file of allFiles) {
    const fm = file.frontmatter || {}
    const resourceType = file.resourceType
    if (resourceType && SCHEMAS[resourceType]) {
      for (const err of validateSchema(fm, resourceType, file.filePath || file.relativePath)) {
        softIssues.push(err)
      }
    }
  }

  // 1b. Skill validation — warn if no description
  for (const [skillId, skill] of Object.entries(graph.skills || {})) {
    if (!skill.description) {
      softIssues.push({
        type: 'missing_skill_description',
        message: `Skill "${skillId}" has no description (needed for progressive disclosure)`,
        filePath: skill.primaryFile?.relativePath,
      })
    }
  }

  // 2. Validate refs across all workflows
  for (const wfKey of Object.keys(workflows)) {
    const wf = workflows[wfKey]
    const nodes = wf.nodes || {}
    const edges = wf.edges || []
    const nodeIds = new Set(Object.keys(nodes))

    // 2a. Edge validation
    for (const edge of edges) {
      if (!nodeIds.has(edge.to)) {
        hardErrors.push({
          type: 'broken_ref',
          message: `Broken edge ref: target node "${edge.to}" not found in workflow "${wfKey}"`,
          filePath: edge.from, ref: `-> ${edge.to}`, workflow: wfKey,
        })
      }
      if (!nodeIds.has(edge.from)) {
        hardErrors.push({
          type: 'broken_ref',
          message: `Broken edge ref: source node "${edge.from}" not found in workflow "${wfKey}"`,
          filePath: edge.from, ref: `-> ${edge.to}`, workflow: wfKey,
        })
      }
      if (edge.condition) {
        const condRef: Ref = {
          raw: edge.condition,
          category: edge.condition.split('/')[0] || '',
          name: edge.condition.split('/').slice(1).join('/') || '',
          semanticType: 'mention',
        }
        if (!resolveRef(condRef, graph)) {
          hardErrors.push({
            type: 'missing_condition',
            message: `Missing condition template "${edge.condition}" in conditional edge from "${edge.from}" to "${edge.to}"`,
            filePath: edge.from, ref: edge.condition, workflow: wfKey,
          })
        }
      }
    }

    // 2b. Router validation — uses node.isRouter (inferred from edges)
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (!node.isRouter) continue
      const outgoing = edges.filter(e => e.from === nodeId)
      for (const edge of outgoing) {
        if (!edge.condition) {
          softIssues.push({
            type: 'router_non_conditional',
            message: `Router node "${nodeId}" has non-conditional edge to "${edge.to}". Router edges should have conditions for deterministic routing.`,
            filePath: nodeId, ref: `-> ${edge.to}`, workflow: wfKey,
          })
        }
      }
      const allRefs = node.allRefs || []
      const capRefs = allRefs.filter(r => r.category === 'capabilities' && r.semanticType === 'mention')
      const instrRefs = allRefs.filter(r => r.category === 'instructions' && r.semanticType === 'mention')
      if (capRefs.length > 0) {
        softIssues.push({
          type: 'router_has_capabilities',
          message: `Router node "${nodeId}" references capabilities (${capRefs.map(r => r.name).join(', ')}). Router nodes should only route — capabilities belong on step nodes.`,
          filePath: node.primaryFile?.filePath || nodeId, workflow: wfKey,
        })
      }
      if (instrRefs.length > 0) {
        softIssues.push({
          type: 'router_has_instructions',
          message: `Router node "${nodeId}" references instructions (${instrRefs.map(r => r.name).join(', ')}). Router nodes should only route — instructions belong on step nodes.`,
          filePath: node.primaryFile?.filePath || nodeId, workflow: wfKey,
        })
      }
      if (outgoing.length < 2) {
        softIssues.push({
          type: 'router_single_exit',
          message: `Router node "${nodeId}" has ${outgoing.length} outgoing edge(s). Routers typically need at least 2 exits.`,
          filePath: node.primaryFile?.filePath || nodeId, workflow: wfKey,
        })
      }
    }

    // 2c. Broken refs in node files
    for (const [nodeId, node] of Object.entries(nodes)) {
      for (const ref of (node.allRefs || [])) {
        if (ref.semanticType === 'data_flow') {
          if (!resolveRef(ref, graph)) {
            hardErrors.push({
              type: 'broken_data_flow',
              message: `Data flow ref to non-existent node "${ref.name}"`,
              filePath: node.primaryFile?.filePath || nodeId, ref: ref.raw, workflow: wfKey,
            })
          }
          continue
        }
        if (ref.semanticType === 'mention') {
          const resolved = resolveRef(ref, graph)
          if (!resolved) {
            hardErrors.push({
              type: 'broken_ref',
              message: `Broken ref: target "${ref.category}/${ref.name}" not found`,
              filePath: node.primaryFile?.filePath || nodeId, ref: ref.raw, workflow: wfKey,
            })
          } else if (resolved.resolvedBy === 'ambiguous') {
            softIssues.push({
              type: 'ambiguous_ref',
              message: `Ambiguous ref "${ref.category}/${ref.name}" matches multiple files: ${resolved.matches!.map(m => m.filePath || m.relativePath).join(', ')}`,
              filePath: node.primaryFile?.filePath || nodeId, ref: ref.raw, workflow: wfKey,
            })
          }
        }
      }
    }

    // 2e. Unreachable nodes
    const nodeArray = Object.values(nodes)
    const unreachable = findUnreachable(nodeArray, edges, wf.entryPoints || [])
    for (const nodeId of unreachable) {
      softIssues.push({
        type: 'unreachable',
        message: `Node "${nodeId}" may be unreachable (no incoming edges and not an entry node)`,
        nodes: [nodeId], workflow: wfKey,
      })
    }

    // 2e2. Entry point validation
    const entryPoints = wf.entryPoints || []
    if (entryPoints.length === 0) {
      hardErrors.push({
        type: 'no_entry_point',
        message: `Workflow "${wfKey}" has no entry point. Exactly one node must have "entry: true" in frontmatter.`,
        workflow: wfKey,
      })
    } else if (entryPoints.length > 1) {
      hardErrors.push({
        type: 'multiple_entry_points',
        message: `Workflow "${wfKey}" has ${entryPoints.length} entry points (${entryPoints.join(', ')}). Exactly one is allowed.`,
        workflow: wfKey,
      })
    }

    // 2f. Context budget validation
    for (const [nodeId, node] of Object.entries(nodes)) {
      const ctx = node.contextBudget as Record<string, unknown> | undefined
      if (!ctx) continue
      if (ctx.max_tokens !== undefined) {
        if (typeof ctx.max_tokens !== 'number' || !Number.isInteger(ctx.max_tokens) || (ctx.max_tokens as number) <= 0) {
          softIssues.push({
            type: 'context_budget',
            message: `Node "${nodeId}" has invalid context.max_tokens: expected positive integer`,
            filePath: node.primaryFile?.filePath || nodeId, workflow: wfKey,
          })
        }
      }
      const inputs = (ctx.inputs || []) as { ref?: string }[]
      for (const input of inputs) {
        if (!input.ref || input.ref.startsWith('<<')) continue
        const parts = input.ref.split('/')
        const fakeRef: Ref = { raw: input.ref, semanticType: 'mention', category: parts[0] || '', name: parts.slice(1).join('/') || '' }
        const resolved = resolveRef(fakeRef, graph)
        if (!resolved || !resolved.target) {
          softIssues.push({
            type: 'context_input_broken',
            message: `Node "${nodeId}" context input ref "${input.ref}" could not be resolved`,
            filePath: node.primaryFile?.filePath || nodeId, workflow: wfKey,
          })
        }
      }
      if (ctx.max_tokens && (ctx.max_tokens as number) > 8000) {
        softIssues.push({
          type: 'context_budget_high',
          message: `Node "${nodeId}" has context.max_tokens of ${ctx.max_tokens} which exceeds the recommended 8k budget. Consider splitting this node.`,
          filePath: node.primaryFile?.filePath || nodeId, workflow: wfKey,
        })
      }
    }

    // 2g. Output declarations
    for (const [nodeId, node] of Object.entries(nodes)) {
      const outputs = node.outputDeclarations
      if (!outputs || !Array.isArray(outputs)) continue
      for (const output of outputs) {
        if (!(output as Record<string, unknown>).name) {
          softIssues.push({
            type: 'output_declaration',
            message: `Node "${nodeId}" has an output declaration without a "name" field`,
            filePath: node.primaryFile?.filePath || nodeId, workflow: wfKey,
          })
        }
      }
    }
  }

  // 3. Unknown category prefixes
  const knownCategories = new Set<string>([...RESERVED_DIRS, 'nodes', 'output', 'workflows'])
  for (const wfKey of Object.keys(workflows)) {
    knownCategories.add(wfKey)
    for (const nodeId of Object.keys(workflows[wfKey].nodes || {})) {
      knownCategories.add(nodeId)
    }
  }
  for (const file of allFiles) {
    for (const ref of (file.refs || [])) {
      if (ref.category && !knownCategories.has(ref.category)) {
        const categoryExists = allFiles.some(f =>
          (f.relativePath || '').replace(/\\/g, '/').startsWith(ref.category + '/'),
        )
        if (!categoryExists) {
          softIssues.push({
            type: 'unknown_category',
            message: `Unknown category prefix "${ref.category}" in ref "${ref.raw}"`,
            filePath: file.filePath || file.relativePath, ref: ref.raw,
          })
        }
      }
    }
  }

  // 4. Sub-workflow validation
  const workflowIds = new Set(Object.keys(workflows))

  for (const wfKey of Object.keys(workflows)) {
    const wf = workflows[wfKey]
    for (const [nodeId, node] of Object.entries(wf.nodes || {})) {
      if (node.nodeType !== 'sub-workflow') continue
      const fm = node.primaryFile?.frontmatter || node.frontmatter || {}
      const linkedWf = fm.workflow as string | undefined

      if (!linkedWf) {
        softIssues.push({
          type: 'orphaned_sub_workflow',
          message: `Sub-workflow node "${nodeId}" has no linked workflow`,
          filePath: node.primaryFile?.filePath || node.primaryFile?.relativePath,
          workflow: wfKey,
        })
        continue
      }
      if (!workflowIds.has(linkedWf) && linkedWf !== nodeId) {
        softIssues.push({
          type: 'missing_sub_workflow_target',
          message: `Sub-workflow node "${nodeId}" links to workflow "${linkedWf}" which does not exist`,
          filePath: node.primaryFile?.filePath || node.primaryFile?.relativePath,
          ref: linkedWf, workflow: wfKey,
        })
      }
      if (linkedWf === wfKey) {
        hardErrors.push({
          type: 'infinite_sub_workflow',
          message: `Sub-workflow node "${nodeId}" in workflow "${wfKey}" links back to its own workflow — infinite loop`,
          filePath: node.primaryFile?.filePath || node.primaryFile?.relativePath,
          workflow: wfKey,
        })
      }
    }
  }

  // 4d. Transitive sub-workflow loop detection
  const subWfEdges = new Map<string, string[]>()
  for (const wfKey of Object.keys(workflows)) {
    const targets: string[] = []
    for (const node of Object.values(workflows[wfKey].nodes || {})) {
      if (node.nodeType === 'sub-workflow') {
        const linked = (node.primaryFile?.frontmatter || node.frontmatter || {}).workflow as string | undefined
        if (linked && linked !== wfKey) targets.push(linked)
      }
    }
    if (targets.length) subWfEdges.set(wfKey, targets)
  }

  function detectSubWfCycle(start: string) {
    const visited = new Set<string>()
    const stack = [start]
    while (stack.length) {
      const current = stack.pop()!
      if (visited.has(current)) continue
      visited.add(current)
      for (const next of (subWfEdges.get(current) || [])) {
        if (next === start) {
          hardErrors.push({
            type: 'infinite_sub_workflow',
            message: `Infinite sub-workflow loop: ${start} → ... → ${current} → ${start}`,
            workflow: start,
          })
          return
        }
        stack.push(next)
      }
    }
  }
  for (const wfKey of subWfEdges.keys()) detectSubWfCycle(wfKey)

  // 4e. Workflow refs
  for (const file of allFiles) {
    for (const ref of (file.refs || [])) {
      if (ref.category === 'workflows' && ref.name) {
        if (!workflowIds.has(ref.name)) {
          softIssues.push({
            type: 'unresolved_workflow_ref',
            message: `Workflow ref "{{workflows/${ref.name}}}" does not match any known workflow`,
            filePath: file.filePath || file.relativePath, ref: ref.raw,
          })
        }
      }
    }
  }

  // 5. Variable tokens
  for (const file of allFiles) {
    const content = file.rawContent || file.content || ''
    for (const ve of validateVariables(content)) {
      hardErrors.push({
        type: 'malformed_variable', message: ve.message,
        filePath: file.filePath || file.relativePath, token: ve.token,
      })
    }
    const fm = file.frontmatter || {}
    for (const [key, val] of Object.entries(fm)) {
      if (typeof val === 'string') {
        for (const ve of validateVariables(val)) {
          hardErrors.push({
            type: 'malformed_variable', message: ve.message,
            filePath: file.filePath || file.relativePath, field: key, token: ve.token,
          })
        }
      }
    }
  }

  // 6. Identity validation
  if (graph.identity) {
    const id = graph.identity as Record<string, unknown>
    if (typeof id !== 'object' || Array.isArray(id)) {
      softIssues.push({ type: 'identity', message: 'Workspace identity must be an object', filePath: graph.descriptorFile?.filePath || '' })
    } else {
      if (id.name && typeof id.name !== 'string') {
        softIssues.push({ type: 'identity', message: 'Identity "name" must be a string', filePath: graph.descriptorFile?.filePath || '' })
      }
      if (id.role && typeof id.role !== 'string') {
        softIssues.push({ type: 'identity', message: 'Identity "role" must be a string', filePath: graph.descriptorFile?.filePath || '' })
      }
      if (id.constraints && !Array.isArray(id.constraints)) {
        softIssues.push({ type: 'identity', message: 'Identity "constraints" must be an array of strings', filePath: graph.descriptorFile?.filePath || '' })
      }
    }
  }

  // 7. MCP tool references
  const mcpServers = graph.mcpServers
  if (mcpServers && typeof mcpServers === 'object') {
    for (const file of allFiles) {
      const fm = file.frontmatter || {}
      if (fm.type !== 'mcp') continue
      const serverName = fm.mcp as string
      if (!serverName) continue
      const serverExists = Object.prototype.hasOwnProperty.call(mcpServers, serverName)
      if (!serverExists) {
        softIssues.push({
          type: 'missing_mcp_server',
          message: `MCP tool "${fm.name || file.relativePath}" references server "${serverName}" which is not declared in mcp.json. The tool won't be available at runtime.`,
          filePath: file.filePath || file.relativePath, server: serverName,
        })
        if (fm.generated === true) {
          softIssues.push({
            type: 'orphaned_mcp_tool',
            message: `Orphaned MCP tool file "${fm.name || file.relativePath}" — server "${serverName}" was removed from mcp.json but generated tool file remains`,
            filePath: file.filePath || file.relativePath, server: serverName,
          })
        }
      }
    }
  }

  // 8. Misplaced resources inside workflow dirs
  const reservedSet = new Set(RESERVED_DIRS)
  const wfIds = new Set(Object.keys(workflows))
  for (const file of allFiles) {
    const parts = (file.relativePath || '').split('/')
    if (parts.length >= 3 && wfIds.has(parts[0]) && reservedSet.has(parts[1])) {
      softIssues.push({
        type: 'misplaced_resource', workflow: parts[0], dir: parts[1],
        file: file.relativePath, filePath: file.relativePath,
        message: `"${file.relativePath}" is inside workflow "${parts[0]}". Resources like ${parts[1]}/ should be at the top level to be shared across workflows.`,
      })
    }
  }

  // Assemble result
  if (strict) {
    const allErrors = [...hardErrors, ...softIssues]
    return { errors: allErrors, warnings: [], valid: allErrors.length === 0 }
  }
  return { errors: hardErrors, warnings: softIssues, valid: hardErrors.length === 0 }
}

// ── Exports ────────────────────────────────────────────────────────────

export { SCHEMAS, RULES as VALIDATION_RULES }
