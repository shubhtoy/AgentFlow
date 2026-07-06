/**
 * AgentFlow — L0 contract generator.
 *
 * Generates the root AGENTS.md handed to a host agent on export: identity, workflow
 * entry pointer, walk rules, and gate behaviour. This is the one file every host
 * auto-loads (Kiro confirmed; AGENTS.md is the Linux Foundation / Agentic AI
 * Foundation open standard read natively by Codex, Cursor, Copilot, Gemini CLI,
 * Aider, Windsurf, Zed, and others) — everything else in the exported directory
 * (L1 workflow routing, L2 node contracts, L3 references, L4 artifacts/memory)
 * loads on demand as the agent walks the directory.
 *
 * AGENTS.md has no required schema — it is plain Markdown, any headings the reader
 * finds useful. This generator intentionally emits prose, not YAML frontmatter:
 * matching the real-world convention (see https://agents.md) keeps the exported
 * file readable by every AGENTS.md-aware host, not just AgentFlow's own parser.
 *
 * Browser-safe: pure string templating over an in-memory ParsedGraph, zero
 * Node.js APIs — writing the result to disk is `packages/cli`'s job.
 */

import type { ParsedGraph, ParsedWorkflow } from '../parser-core'

export interface L0ContractOptions {
  /** Workflow to generate the contract for. Required when the graph has more than one. */
  workflowId?: string
}

/** Pick the workflow to contract for for: the explicit id, or the graph's only workflow. */
function selectWorkflow(graph: ParsedGraph, options: L0ContractOptions): { id: string; wf: ParsedWorkflow } {
  const ids = Object.keys(graph.workflows || {})
  const id = options.workflowId || ids[0]
  if (!id) throw new Error('generateL0Contract: graph has no workflows')
  const wf = graph.workflows[id]
  if (!wf) throw new Error(`generateL0Contract: unknown workflow "${id}"`)
  return { id, wf }
}

/** The node the walk starts at: explicit entry points, falling back to an inferred one. */
function findEntryNode(wf: ParsedWorkflow): string | null {
  if (wf.entryPoints && wf.entryPoints.length > 0) return wf.entryPoints[0]
  const inferred = Object.values(wf.nodes || {}).find(n => n.entry || n.entryInferred)
  return inferred ? inferred.id : null
}

/** Relative path (workspace-root-relative) to a workflow's entry node's primary file. */
function entryNodePath(wf: ParsedWorkflow, entryId: string | null): string | null {
  if (!entryId) return null
  const node = wf.nodes[entryId]
  return node?.primaryFile?.relativePath || null
}

/** Human-readable node names in walk order, following unconditional edges from the entry node. */
function walkOrderSummary(wf: ParsedWorkflow, entryId: string | null): string[] {
  const names: string[] = []
  const visited = new Set<string>()
  let current = entryId
  while (current && !visited.has(current) && wf.nodes[current]) {
    visited.add(current)
    names.push(wf.nodes[current].name || current)
    const next = (wf.edges || []).find(e => e.from === current)
    current = next ? next.to : null
  }
  return names
}

/** True if any edge in the workflow carries a condition (a human/automated approval gate). */
function hasGates(wf: ParsedWorkflow): boolean {
  return (wf.edges || []).some(e => !!e.condition)
}

/**
 * Generate the root AGENTS.md (L0 contract) for a parsed workflow graph.
 *
 * Names the entry node, the walk rules (open the next file, follow edges, honour
 * conditions), and gate behaviour (stop and wait for explicit approval before a
 * conditional edge fires) — the minimum a host agent needs to execute the exported
 * directory correctly, matching the hand-validated Kiro rig from Master Plan.
 */
export function generateL0Contract(graph: ParsedGraph, options: L0ContractOptions = {}): string {
  const { id: workflowId, wf } = selectWorkflow(graph, options)
  const entryId = findEntryNode(wf)
  const entryPath = entryNodePath(wf, entryId)
  const walkOrder = walkOrderSummary(wf, entryId)
  const gated = hasGates(wf)

  const identity = (graph.identity as { name?: string; role?: string } | undefined) || undefined
  const name = identity?.name || wf.name || workflowId
  const role = identity?.role

  const lines: string[] = []

  lines.push(`# ${name}`)
  lines.push('')
  if (role) {
    lines.push(role)
    lines.push('')
  }
  if (wf.description) {
    lines.push(wf.description)
    lines.push('')
  }

  lines.push('## How to run this workflow')
  lines.push('')
  if (entryPath) {
    lines.push(`Start by opening \`${entryPath}\`. It is the entry point — read it before doing anything else.`)
  } else {
    lines.push('No entry point could be determined for this workflow; ask the user which node to start at.')
  }
  lines.push('')
  lines.push('Each node file names the next file to open, as a relative path. Follow that path — do not')
  lines.push('guess, skip ahead, or jump to a later node. Treat the directory as the source of truth for')
  lines.push('what happens next, not this file.')
  lines.push('')

  if (walkOrder.length > 1) {
    lines.push('Expected order for the unconditional path through this workflow:')
    lines.push('')
    walkOrder.forEach((n, i) => lines.push(`${i + 1}. ${n}`))
    lines.push('')
    lines.push('Conditional branches may change this order — the node file you are on always wins over')
    lines.push('this summary.')
    lines.push('')
  }

  lines.push('## Gates')
  lines.push('')
  if (gated) {
    lines.push('Some transitions in this workflow are conditional on explicit approval. When a node file')
    lines.push('says to wait for approval before continuing, stop and wait — do not proceed to the next')
    lines.push('node on your own judgement.')
  } else {
    lines.push('This workflow has no approval gates: proceed node to node without stopping for confirmation,')
    lines.push('unless a node file says otherwise.')
  }
  lines.push('')

  lines.push('## Setup commands')
  lines.push('')
  lines.push('None — this is a static, portable export. No install step is required to read or follow it.')

  return lines.join('\n')
}
