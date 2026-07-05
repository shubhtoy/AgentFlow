/**
 * AgentFlow — reference → relative-path resolution for export.
 *
 * Authoring uses `{{...}}` DSL refs (`{{-> node}}`, `{{-> node | cond}}`,
 * `{{<< output.node}}`, `{{category/name}}`). The executable artifact handed to a
 * host agent must instead use plain relative file paths, so the exported workflow
 * directory is a self-contained, path-linked graph any agent can walk by opening
 * files. This module resolves each token to a path relative to the file that
 * contains it and rewrites the tokens in-place.
 *
 * Browser-safe: pure string path math, zero Node.js APIs. Reuses the existing
 * `resolveRef` / `resolveEdgeTarget` semantics from parser-core so resolution
 * behaviour stays consistent with validation.
 */

import { extractRefs, resolveRef, resolveEdgeTarget } from './parser-core'
import type { ParsedGraph, ParsedNode, ParsedFile, Ref } from './parser-core'

// ── Relative path math (POSIX, browser-safe) ─────────────────────────────

/** Split a path into clean segments (normalizes `\`, drops `''` and `.`). */
function segments(p: string): string[] {
  return (p || '').replace(/\\/g, '/').split('/').filter(s => s !== '' && s !== '.')
}

/** Directory portion (workspace-relative) of a file path, or '' for root-level files. */
function dirOf(relPath: string): string {
  const s = segments(relPath)
  s.pop()
  return s.join('/')
}

/**
 * Compute a POSIX relative path from the directory containing `fromRelPath`
 * to `toRelPath`. Both inputs are workspace-root-relative.
 *
 * Examples:
 *   toRelativePath('wf/review/SKILL.md', 'wf/plan/SKILL.md')  → '../plan/SKILL.md'
 *   toRelativePath('wf/build/SKILL.md',  'instructions/x.md') → '../../instructions/x.md'
 *   toRelativePath('wf/a/SKILL.md',      'wf/a/other.md')     → './other.md'
 *   toRelativePath('AGENTS.md',          'instructions/x.md') → './instructions/x.md'
 *
 * The result can never escape the workspace root: `..` segments are bounded by
 * the source file's own depth, after which it only descends via the target path.
 */
export function toRelativePath(fromRelPath: string, toRelPath: string): string {
  const fromDir = segments(fromRelPath)
  fromDir.pop() // drop the source filename → its directory
  const to = segments(toRelPath)

  let i = 0
  while (i < fromDir.length && i < to.length && fromDir[i] === to[i]) i++

  const ups: string[] = []
  for (let u = i; u < fromDir.length; u++) ups.push('..')
  const parts = [...ups, ...to.slice(i)]
  if (parts.length === 0) return '.'
  const rel = parts.join('/')
  return rel.startsWith('..') ? rel : './' + rel
}

// ── Ref → target-path resolution ─────────────────────────────────────────

export interface RefResolution {
  ref: Ref
  /** Path (relative to the referencing file) of the target, or its output dir. */
  path: string
  /** For conditional edges: resolved condition (relative path if a file ref, else literal). */
  condition?: string
}

export interface RewriteResult {
  /** Rewritten content with every resolvable `{{...}}` token replaced by a path. */
  content: string
  resolved: RefResolution[]
  /** Refs that could not be resolved; their tokens are left untouched (never silently dropped). */
  unresolved: Ref[]
}

export interface GraphRewriteResult {
  /** Map of workspace-relative path → rewritten file content. */
  files: Record<string, string>
  /** Unresolved refs across the whole graph, tagged with their source file. */
  unresolved: { file: string; ref: Ref }[]
}

/** Find the node an edge ref points to, preferring the ref's own workflow. */
function findEdgeTargetNode(
  ref: Ref,
  graph: ParsedGraph,
  workflowId?: string,
): ParsedNode | null {
  const workflows = graph.workflows || {}
  const inWorkflow = (wfId: string): ParsedNode | null => {
    const wf = workflows[wfId]
    if (!wf) return null
    const targetId = resolveEdgeTarget(ref, new Set(Object.keys(wf.nodes || {})))
    return targetId ? wf.nodes[targetId] || null : null
  }
  if (workflowId) {
    const n = inWorkflow(workflowId)
    if (n) return n
  }
  for (const wfId of Object.keys(workflows)) {
    if (wfId === workflowId) continue
    const n = inWorkflow(wfId)
    if (n) return n
  }
  return null
}

/**
 * Resolve a single ref to a target path that is workspace-root-relative.
 * Returns null when the ref cannot be resolved (broken or ambiguous).
 */
function resolveRefTargetPath(ref: Ref, graph: ParsedGraph, workflowId?: string): string | null {
  // Edge → a node in the (given) workflow; target is that node's primary file.
  if (ref.semanticType === 'edge') {
    const node = findEdgeTargetNode(ref, graph, workflowId)
    return node?.primaryFile?.relativePath || null
  }

  // Data flow → the producing node's output directory.
  if (ref.semanticType === 'data_flow') {
    const resolved = resolveRef(ref, graph)
    const node = resolved?.target as ParsedNode | undefined
    const primary = node?.primaryFile?.relativePath
    if (!primary) return null
    const dir = dirOf(primary)
    return dir ? `${dir}/output` : 'output'
  }

  // Mention → a file resolved by the shared resolver (path first, then name).
  const resolved = resolveRef(ref, graph)
  if (!resolved || !resolved.target || resolved.resolvedBy === 'ambiguous') return null
  return (resolved.target as ParsedFile).relativePath || null
}

/** Resolve a conditional-edge condition: a relative path if it is a file ref, else the literal text. */
function resolveCondition(condition: string, fromRelPath: string, graph: ParsedGraph): string {
  const slash = condition.indexOf('/')
  if (slash > 0) {
    const condRef: Ref = {
      raw: condition,
      semanticType: 'mention',
      category: condition.slice(0, slash),
      name: condition.slice(slash + 1),
    }
    const target = resolveRefTargetPath(condRef, graph)
    if (target) return toRelativePath(fromRelPath, target)
  }
  return condition
}

/** Render the replacement text for a resolved ref (backticked path, with condition for edges). */
function renderReplacement(res: RefResolution): string {
  if (res.ref.semanticType === 'data_flow') return `\`${res.path}/\``
  if (res.ref.semanticType === 'edge' && res.condition) return `\`${res.path}\` (when: ${res.condition})`
  return `\`${res.path}\``
}

/**
 * Rewrite every `{{...}}` token in `content` to a path relative to `fromRelPath`.
 * `workflowId` scopes edge/data-flow resolution to the file's own workflow.
 * Unresolved tokens are left untouched and reported in `unresolved`.
 */
export function rewriteRefsToPaths(
  content: string,
  fromRelPath: string,
  graph: ParsedGraph,
  workflowId?: string,
): RewriteResult {
  const resolved: RefResolution[] = []
  const unresolved: Ref[] = []
  if (!content) return { content: content || '', resolved, unresolved }

  const edits: { start: number; end: number; text: string }[] = []
  // core's extractRefs emits a conditional edge as two refs (a `conditional_edge`
  // plus a spurious plain `edge` capturing "target | cond"). Dedup by token span,
  // keeping the first — extractRefs orders conditional_edge before edge, so the
  // correct ref wins and the duplicate is dropped.
  const seenSpan = new Set<string>()
  for (const ref of extractRefs(content)) {
    const start = ref.offset ?? -1
    if (start < 0) continue
    const close = content.indexOf('}}', start)
    if (close < 0) continue
    const spanKey = `${start}:${close}`
    if (seenSpan.has(spanKey)) continue
    seenSpan.add(spanKey)

    const targetPath = resolveRefTargetPath(ref, graph, workflowId)
    if (!targetPath) {
      unresolved.push(ref)
      continue
    }
    const res: RefResolution = { ref, path: toRelativePath(fromRelPath, targetPath) }
    if (ref.semanticType === 'edge' && ref.condition) {
      res.condition = resolveCondition(ref.condition, fromRelPath, graph)
    }
    resolved.push(res)
    edits.push({ start, end: close + 2, text: renderReplacement(res) })
  }

  // Apply edits back-to-front so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start)
  let out = content
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return { content: out, resolved, unresolved }
}

/**
 * Rewrite `{{...}}` refs to relative paths across an entire parsed graph.
 *
 * Walks every ref-bearing file (workspace descriptor, top-level resources,
 * workflow descriptors, and node files), providing each node/descriptor file
 * its own workflow context so edge and data-flow refs resolve correctly.
 *
 * Callers should treat a non-empty `unresolved` list as a hard error and refuse
 * to emit — a broken ref must never pass silently. (The validator surfaces the
 * same refs as `broken_ref` / `broken_data_flow` errors.)
 */
export function resolveRefsToPaths(graph: ParsedGraph): GraphRewriteResult {
  const files: Record<string, string> = {}
  const unresolved: { file: string; ref: Ref }[] = []

  const rewriteFile = (file: ParsedFile | undefined | null, workflowId?: string): void => {
    if (!file || !file.relativePath) return
    const source = file.content ?? file.rawContent ?? ''
    const r = rewriteRefsToPaths(source, file.relativePath, graph, workflowId)
    files[file.relativePath] = r.content
    for (const ref of r.unresolved) unresolved.push({ file: file.relativePath, ref })
  }

  // L0 identity + top-level resources
  rewriteFile(graph.descriptorFile)
  for (const f of Object.values(graph.instructions || {})) rewriteFile(f)
  for (const f of Object.values(graph.capabilities || {})) rewriteFile(f as ParsedFile)
  for (const f of Object.values(graph.memory || {})) rewriteFile(f)
  for (const s of Object.values(graph.skills || {})) rewriteFile(s.primaryFile)

  // L1 workflow descriptors + L2 node files (scoped to their workflow)
  for (const [wfId, wf] of Object.entries(graph.workflows || {})) {
    rewriteFile(wf.descriptorFile, wfId)
    for (const node of Object.values(wf.nodes || {})) {
      rewriteFile(node.primaryFile, wfId)
      for (const cf of node.contextFiles || []) rewriteFile(cf, wfId)
    }
  }

  return { files, unresolved }
}
