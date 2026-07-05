/**
 * AgentFlow Validator — barrel module.
 *
 * Composes sub-validators (schema, structure, variables) into a single
 * validate() entry point. Public API is identical to the old monolith.
 */

import { resolveRef, RESERVED_DIRS } from '../parser-core'
import type { ParsedGraph, Ref } from '../parser-core'
import type { ValidationIssue, ValidationResult } from './types'
import { SCHEMAS, validateSchema } from './schema'
import { detectCycles, findUnreachable } from './structure'
import { validateVariables } from './variables'

// ── Re-exports (public API) ────────────────────────────────────────────

export type { Severity, RuleDef, ValidationIssue, ValidationResult } from './types'
export { RULES, RULES as VALIDATION_RULES, getRuleSeverity } from './types'
export { SCHEMAS, validateSchema } from './schema'
export { detectCycles, findUnreachable } from './structure'
export { validateVariables } from './variables'

// ── validate (main) ────────────────────────────────────────────────────

export function validate(graph: ParsedGraph, options: { strict?: boolean } = {}): ValidationResult {
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
    const { resourceType } = file
    if (resourceType && SCHEMAS[resourceType]) {
      for (const err of validateSchema(fm, resourceType, file.filePath || file.relativePath)) {
        softIssues.push(err)
      }
    }
  }

  // 1b. Skill validation
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
          filePath: edge.from,
          ref: `-> ${edge.to}`,
          workflow: wfKey,
        })
      }
      if (!nodeIds.has(edge.from)) {
        hardErrors.push({
          type: 'broken_ref',
          message: `Broken edge ref: source node "${edge.from}" not found in workflow "${wfKey}"`,
          filePath: edge.from,
          ref: `-> ${edge.to}`,
          workflow: wfKey,
        })
      }
      if (edge.condition) {
        const slashIdx = edge.condition.indexOf('/')
        const isFileRef = slashIdx > 0 && RESERVED_DIRS.includes(edge.condition.slice(0, slashIdx))

        if (isFileRef) {
          const condRef: Ref = {
            raw: edge.condition,
            category: edge.condition.slice(0, slashIdx),
            name: edge.condition.slice(slashIdx + 1),
            semanticType: 'mention',
          }
          if (!resolveRef(condRef, graph)) {
            hardErrors.push({
              type: 'missing_condition',
              message: `Missing condition template "${edge.condition}" in conditional edge from "${edge.from}" to "${edge.to}"`,
              filePath: edge.from,
              ref: edge.condition,
              workflow: wfKey,
            })
          }
        } else {
          softIssues.push({
            type: 'inline_condition',
            message: `Inline text condition "${edge.condition}" on edge "${edge.from}" → "${edge.to}". Consider using an instructions/ reference for reusability and clearer criteria.`,
            filePath:
              nodes[edge.from]?.primaryFile?.filePath || nodes[edge.from]?.primaryFile?.relativePath || edge.from,
            ref: edge.condition,
            workflow: wfKey,
          })
        }
      }
    }

    // 2b. Router validation
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (!node.isRouter) continue
      const outgoing = edges.filter(e => e.from === nodeId)
      for (const edge of outgoing) {
        if (!edge.condition) {
          softIssues.push({
            type: 'router_non_conditional',
            message: `Router node "${nodeId}" has non-conditional edge to "${edge.to}". Router edges should have conditions for deterministic routing.`,
            filePath: nodeId,
            ref: `-> ${edge.to}`,
            workflow: wfKey,
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
          filePath: node.primaryFile?.filePath || nodeId,
          workflow: wfKey,
        })
      }
      if (instrRefs.length > 0) {
        softIssues.push({
          type: 'router_has_instructions',
          message: `Router node "${nodeId}" references instructions (${instrRefs.map(r => r.name).join(', ')}). Router nodes should only route — instructions belong on step nodes.`,
          filePath: node.primaryFile?.filePath || nodeId,
          workflow: wfKey,
        })
      }
      if (outgoing.length < 2) {
        softIssues.push({
          type: 'router_single_exit',
          message: `Router node "${nodeId}" has ${outgoing.length} outgoing edge(s). Routers typically need at least 2 exits.`,
          filePath: node.primaryFile?.filePath || nodeId,
          workflow: wfKey,
        })
      }
    }

    // 2c. Broken refs in node files
    for (const [nodeId, node] of Object.entries(nodes)) {
      for (const ref of node.allRefs || []) {
        if (ref.semanticType === 'data_flow') {
          if (!resolveRef(ref, graph)) {
            hardErrors.push({
              type: 'broken_data_flow',
              message: `Data flow ref to non-existent node "${ref.name}"`,
              filePath: node.primaryFile?.filePath || nodeId,
              ref: ref.raw,
              workflow: wfKey,
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
              filePath: node.primaryFile?.filePath || nodeId,
              ref: ref.raw,
              workflow: wfKey,
            })
          } else if (resolved.resolvedBy === 'ambiguous') {
            softIssues.push({
              type: 'ambiguous_ref',
              message: `Ambiguous ref "${ref.category}/${ref.name}" matches multiple files: ${resolved.matches!.map(m => m.filePath || m.relativePath).join(', ')}`,
              filePath: node.primaryFile?.filePath || nodeId,
              ref: ref.raw,
              workflow: wfKey,
            })
          }
        }
      }
    }

    // 2d. Unreachable nodes
    const unreachable = findUnreachable(Object.values(nodes), edges, wf.entryPoints || [])
    for (const nodeId of unreachable) {
      softIssues.push({
        type: 'unreachable',
        message: `Node "${nodeId}" may be unreachable (no incoming edges and not an entry node)`,
        nodes: [nodeId],
        workflow: wfKey,
      })
    }

    // 2d-ii. Cycles — informational. Revision loops (e.g. review → plan) are a
    // legitimate pattern, so cycles are reported as warnings, never hard errors.
    for (const cycleIssue of detectCycles(Object.values(nodes), edges)) {
      softIssues.push({ ...cycleIssue, workflow: wfKey })
    }

    // 2e. Entry point validation
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
        if (
          typeof ctx.max_tokens !== 'number' ||
          !Number.isInteger(ctx.max_tokens) ||
          (ctx.max_tokens as number) <= 0
        ) {
          softIssues.push({
            type: 'context_budget',
            message: `Node "${nodeId}" has invalid context.max_tokens: expected positive integer`,
            filePath: node.primaryFile?.filePath || nodeId,
            workflow: wfKey,
          })
        }
      }
      const rawInputs = (ctx.inputs || []) as (string | { ref?: string })[]
      const inputs = rawInputs.map(i => (typeof i === 'string' ? { ref: i } : i))
      for (const input of inputs) {
        if (!input.ref || input.ref.startsWith('<<')) continue
        const parts = input.ref.split('/')
        const fakeRef: Ref = {
          raw: input.ref,
          semanticType: 'mention',
          category: parts[0] || '',
          name: parts.slice(1).join('/') || '',
        }
        if (!resolveRef(fakeRef, graph)?.target) {
          softIssues.push({
            type: 'context_input_broken',
            message: `Node "${nodeId}" context input ref "${input.ref}" could not be resolved`,
            filePath: node.primaryFile?.filePath || nodeId,
            workflow: wfKey,
          })
        }
      }
      if (ctx.max_tokens && (ctx.max_tokens as number) > 8000) {
        softIssues.push({
          type: 'context_budget_high',
          message: `Node "${nodeId}" has context.max_tokens of ${ctx.max_tokens} which exceeds the recommended 8k budget. Consider splitting this node.`,
          filePath: node.primaryFile?.filePath || nodeId,
          workflow: wfKey,
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
            filePath: node.primaryFile?.filePath || nodeId,
            workflow: wfKey,
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
    for (const ref of file.refs || []) {
      if (ref.category && !knownCategories.has(ref.category)) {
        const categoryExists = allFiles.some(f =>
          (f.relativePath || '').replace(/\\/g, '/').startsWith(`${ref.category}/`),
        )
        if (!categoryExists) {
          softIssues.push({
            type: 'unknown_category',
            message: `Unknown category prefix "${ref.category}" in ref "${ref.raw}"`,
            filePath: file.filePath || file.relativePath,
            ref: ref.raw,
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
          ref: linkedWf,
          workflow: wfKey,
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
      for (const next of subWfEdges.get(current) || []) {
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
    for (const ref of file.refs || []) {
      if (ref.category === 'workflows' && ref.name) {
        if (!workflowIds.has(ref.name)) {
          softIssues.push({
            type: 'unresolved_workflow_ref',
            message: `Workflow ref "{{workflows/${ref.name}}}" does not match any known workflow`,
            filePath: file.filePath || file.relativePath,
            ref: ref.raw,
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
        type: 'malformed_variable',
        message: ve.message,
        filePath: file.filePath || file.relativePath,
        token: ve.token,
      })
    }
    const fm = file.frontmatter || {}
    for (const [key, val] of Object.entries(fm)) {
      if (typeof val === 'string') {
        for (const ve of validateVariables(val)) {
          hardErrors.push({
            type: 'malformed_variable',
            message: ve.message,
            filePath: file.filePath || file.relativePath,
            field: key,
            token: ve.token,
          })
        }
      }
    }
  }

  // 6. Identity validation
  if (graph.identity) {
    const id = graph.identity as Record<string, unknown>
    if (typeof id !== 'object' || Array.isArray(id)) {
      softIssues.push({
        type: 'identity',
        message: 'Workspace identity must be an object',
        filePath: graph.descriptorFile?.filePath || '',
      })
    } else {
      if (id.name && typeof id.name !== 'string') {
        softIssues.push({
          type: 'identity',
          message: 'Identity "name" must be a string',
          filePath: graph.descriptorFile?.filePath || '',
        })
      }
      if (id.role && typeof id.role !== 'string') {
        softIssues.push({
          type: 'identity',
          message: 'Identity "role" must be a string',
          filePath: graph.descriptorFile?.filePath || '',
        })
      }
      if (id.constraints && !Array.isArray(id.constraints)) {
        softIssues.push({
          type: 'identity',
          message: 'Identity "constraints" must be an array of strings',
          filePath: graph.descriptorFile?.filePath || '',
        })
      }
    }
  }

  // 7. MCP tool references
  const { mcpServers } = graph
  if (mcpServers && typeof mcpServers === 'object') {
    for (const file of allFiles) {
      const fm = file.frontmatter || {}
      if (fm.type !== 'mcp') continue
      const serverName = fm.mcp as string
      if (!serverName) continue
      if (!Object.prototype.hasOwnProperty.call(mcpServers, serverName)) {
        softIssues.push({
          type: 'missing_mcp_server',
          message: `MCP tool "${fm.name || file.relativePath}" references server "${serverName}" which is not declared in mcp.json. The tool won't be available at runtime.`,
          filePath: file.filePath || file.relativePath,
          server: serverName,
        })
        if (fm.generated === true) {
          softIssues.push({
            type: 'orphaned_mcp_tool',
            message: `Orphaned MCP tool file "${fm.name || file.relativePath}" — server "${serverName}" was removed from mcp.json but generated tool file remains`,
            filePath: file.filePath || file.relativePath,
            server: serverName,
          })
        }
      }
    }
  }

  // Assemble result
  if (strict) {
    const allErrors = [...hardErrors, ...softIssues]
    return { errors: allErrors, warnings: [], valid: allErrors.length === 0 }
  }
  return { errors: hardErrors, warnings: softIssues, valid: hardErrors.length === 0 }
}
