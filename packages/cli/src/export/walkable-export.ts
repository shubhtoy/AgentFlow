/**
 * AgentFlow — walkable-directory emitter.
 *
 * Writes a parsed workflow graph to disk as the portable, path-linked directory
 * a host agent walks step by step: root AGENTS.md (L0 contract), one folder per
 * node with its SKILL.md, and an output/ scaffold per node for artifacts the
 * agent produces while executing.
 *
 * `{{...}}` refs are resolved to plain relative paths before anything is written
 * (via `resolveRefsToPaths`) — the exported directory never contains authoring-side
 * template syntax; every link is a path the agent can open directly. See
 * `packages/core/src/ref-paths.ts` for the resolution semantics and
 * `packages/core/src/export/l0-contract.ts` for the L0 file's content.
 *
 * Node.js-only (fs/path) — this is `cli`'s I/O layer over `core`'s pure logic,
 * per the repo's core/cli split (core never touches the filesystem).
 */

import fs from 'fs'
import path from 'path'
import { generateL0Contract } from '@agentflow/core/export/l0-contract'
import type { PlacementCandidate, PlacementLayer } from '@agentflow/core/export/placement-guardrail'
import { checkAllPlacements } from '@agentflow/core/export/placement-guardrail'
import type { HostId } from '@agentflow/core/host-targets'
import type { ParsedGraph } from '@agentflow/core/parser-core'
import { resolveRefsToPaths } from '@agentflow/core/ref-paths'
import { atomicWrite } from '../svc-utils/file-io'
import { validatePath } from '../svc-utils/validate-path'

export interface WalkableExportOptions {
  /** Workflow to export. Required when the graph has more than one. */
  workflowId?: string
  /**
   * Target host for the always-on-channel guardrail (#13). When omitted, the
   * guardrail is skipped entirely — matches today's host-agnostic default so
   * existing callers/tests are unaffected until they opt in to a target.
   */
  hostId?: HostId | string
}

export interface WalkableExportResult {
  /** Workspace-root-relative paths of every file written, in write order. */
  filesWritten: string[]
  /** Refs that could not be resolved to a path — export still proceeds; caller decides whether to treat as fatal. */
  unresolved: { file: string; ref: unknown }[]
}

/**
 * A SKILL.md `name:` per the Agent Skills spec (agentskills.io): 1-64 chars,
 * lowercase unicode alphanumerics and hyphens only, no leading/trailing/doubled
 * hyphens, and must match the parent directory name. Node ids are author-chosen
 * and may not satisfy this — sanitize once here so every emitted node directory
 * and its SKILL.md `name:` agree, rather than emitting a spec-invalid skill.
 */
export function sanitizeSkillName(id: string): string {
  const lowered = (id || '').toLowerCase()
  const hyphenated = lowered.replace(/[^a-z0-9]+/g, '-')
  const collapsed = hyphenated.replace(/-+/g, '-')
  const trimmed = collapsed.replace(/^-+/, '').replace(/-+$/, '')
  const bounded = trimmed.slice(0, 64).replace(/-+$/, '')
  return bounded || 'node'
}

/** Minimal, dependency-free YAML-safe scalar quoting for a frontmatter value. */
function toYamlScalar(value: unknown): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  const str = String(value ?? '')
  if (/^[A-Za-z0-9_./-]*$/.test(str) && str.length > 0) return str
  return JSON.stringify(str)
}

/**
 * Re-serialize a `ParsedFile.frontmatter` object back into a `---`-fenced YAML
 * block, applying `overrides` on top (e.g. a sanitized `name:`). `content` (the
 * frontmatter-stripped, ref-resolved body from `resolveRefsToPaths`) never carries
 * frontmatter itself — the emitter must reconstruct and prepend it explicitly, or
 * every emitted file silently loses its frontmatter block.
 */
function withFrontmatter(
  frontmatter: Record<string, unknown>,
  overrides: Record<string, unknown>,
  body: string,
): string {
  const merged = { ...frontmatter, ...overrides }
  const keys = Object.keys(merged)
  if (keys.length === 0) return body
  const lines = ['---', ...keys.map(k => `${k}: ${toYamlScalar(merged[k])}`), '---', '']
  return lines.join('\n') + body
}

/**
 * Emit a workflow as a walkable directory at `outDir`.
 *
 * Writes:
 *   AGENTS.md                     — L0 contract (always-on, host auto-loaded)
 *   <node-dir>/SKILL.md            — L2 node contract, refs resolved to relative paths
 *   <node-dir>/output/.gitkeep     — scaffolded artifact directory for the node's output
 *
 * Context files attached to a node (L3 references) are written alongside its
 * SKILL.md under the same node directory, preserving the "one level deep from
 * SKILL.md" convention the Agent Skills spec recommends for file references.
 */
export function emitWalkableDirectory(
  graph: ParsedGraph,
  outDir: string,
  options: WalkableExportOptions = {},
): WalkableExportResult {
  const ids = Object.keys(graph.workflows || {})
  const workflowId = options.workflowId || ids[0]
  if (!workflowId) throw new Error('emitWalkableDirectory: graph has no workflows')
  const wf = graph.workflows[workflowId]
  if (!wf) throw new Error(`emitWalkableDirectory: unknown workflow "${workflowId}"`)

  const resolved = resolveRefsToPaths(graph)
  const l0 = generateL0Contract(graph, { workflowId })

  // Every file about to be written, tagged with its layer and final frontmatter,
  // built up first so the guardrail (#13) can check the whole set before anything
  // touches disk — a placement violation must fail the export outright, not leave
  // a partially-written directory behind.
  const pending: {
    relPath: string
    content: string
    layer: PlacementLayer
    frontmatter: Record<string, unknown>
    isEmpty?: boolean
  }[] = []

  // L0 — root AGENTS.md, always-on channel. Exempt from the guardrail by definition.
  pending.push({ relPath: 'AGENTS.md', content: l0, layer: 'L0', frontmatter: {} })

  // L1 — workflow descriptor, if present, with refs resolved.
  if (wf.descriptorFile?.relativePath) {
    const frontmatter = wf.descriptorFile.frontmatter || {}
    const body = resolved.files[wf.descriptorFile.relativePath] ?? wf.descriptorFile.content ?? ''
    pending.push({
      relPath: wf.descriptorFile.relativePath,
      content: withFrontmatter(frontmatter, {}, body),
      layer: 'L1',
      frontmatter,
    })
  }

  // L2 — one directory per node: SKILL.md (name sanitized to match dir), context
  // files alongside it, and an output/ scaffold for the node's artifacts.
  for (const node of Object.values(wf.nodes || {})) {
    const primaryPath = node.primaryFile?.relativePath
    if (!primaryPath) continue

    const dirName = sanitizeSkillName(node.id)
    const nodeDir = path.posix.dirname(primaryPath)

    const frontmatter = node.primaryFile.frontmatter || {}
    const body = resolved.files[primaryPath] ?? node.primaryFile.content ?? ''
    const overrides = frontmatter.name !== undefined ? { name: dirName } : {}
    const content = withFrontmatter(frontmatter, overrides, body)
    pending.push({ relPath: path.posix.join(nodeDir, 'SKILL.md'), content, layer: 'L2', frontmatter })

    for (const cf of node.contextFiles || []) {
      if (!cf.relativePath) continue
      const cfFrontmatter = cf.frontmatter || {}
      const cfBody = resolved.files[cf.relativePath] ?? cf.content ?? ''
      pending.push({
        relPath: cf.relativePath,
        content: withFrontmatter(cfFrontmatter, {}, cfBody),
        layer: 'L2',
        frontmatter: cfFrontmatter,
      })
    }

    // output/ scaffold — AgentFlow's own addition on top of the Agent Skills
    // spec (which recommends scripts/, references/, assets/ for skill inputs);
    // this directory is where the node's own execution artifacts land.
    pending.push({
      relPath: path.posix.join(nodeDir, 'output', '.gitkeep'),
      content: '',
      layer: 'L4',
      frontmatter: {},
      isEmpty: true,
    })
  }

  // L3 — top-level referenced resources (instructions/capabilities/skills), refs
  // resolved, written at their original workspace-relative path.
  const l3Sources = [...Object.values(graph.instructions || {}), ...Object.values(graph.capabilities || {})]
  for (const f of l3Sources) {
    if (!f?.relativePath) continue
    const frontmatter = f.frontmatter || {}
    const body = resolved.files[f.relativePath] ?? f.content ?? ''
    pending.push({ relPath: f.relativePath, content: withFrontmatter(frontmatter, {}, body), layer: 'L3', frontmatter })
  }
  for (const skill of Object.values(graph.skills || {})) {
    const primaryPath = skill.primaryFile?.relativePath
    if (!primaryPath) continue
    const frontmatter = skill.primaryFile.frontmatter || {}
    const body = resolved.files[primaryPath] ?? skill.primaryFile.content ?? ''
    pending.push({ relPath: primaryPath, content: withFrontmatter(frontmatter, {}, body), layer: 'L3', frontmatter })
  }

  // L4 — memory files, refs resolved. Grouped with output/ scaffolds above as the
  // "artifacts + memory" layer per MASTER-PLAN.md.
  for (const f of Object.values(graph.memory || {})) {
    if (!f?.relativePath) continue
    const frontmatter = f.frontmatter || {}
    const body = resolved.files[f.relativePath] ?? f.content ?? ''
    pending.push({ relPath: f.relativePath, content: withFrontmatter(frontmatter, {}, body), layer: 'L4', frontmatter })
  }

  // Guardrail (#13): every L1-L4 file must load on-demand, never through the
  // target host's eager/always-on channel. Runs over the whole pending set before
  // any write, so a violation fails the export cleanly rather than leaving a
  // partially-written directory. Skipped when no hostId is given (host-agnostic
  // export, today's default for existing callers).
  if (options.hostId) {
    const candidates: PlacementCandidate[] = pending.map(p => ({
      relativePath: p.relPath,
      layer: p.layer,
      frontmatter: p.frontmatter,
      isEmpty: p.isEmpty,
    }))
    const violations = checkAllPlacements(candidates, options.hostId)
    if (violations.length > 0) {
      const details = violations.map(v => `  - ${v.message}`).join('\n')
      throw new Error(
        `emitWalkableDirectory: ${violations.length} placement violation(s) for host "${options.hostId}":\n${details}`,
      )
    }
  }

  const filesWritten: string[] = []
  const writeAt = (relPath: string, content: string): void => {
    const check = validatePath(relPath, outDir)
    if (!check.valid)
      throw new Error(`emitWalkableDirectory: refusing to write outside outDir (${relPath}): ${check.error}`)
    fs.mkdirSync(path.dirname(check.resolved), { recursive: true })
    atomicWrite(check.resolved, content)
    filesWritten.push(relPath)
  }

  for (const p of pending) writeAt(p.relPath, p.content)

  return { filesWritten, unresolved: resolved.unresolved }
}
