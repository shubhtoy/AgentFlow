/**
 * AgentFlow — 5-layer placement guardrail (#13).
 *
 * The 5-layer model (see docs/planning/MASTER-PLAN.md "5-layer context placement")
 * only works if L1-L4 stay on-demand: only L0 (the root AGENTS.md / host bootstrap
 * file) may load into a host's eager/always-on channel. If a node contract,
 * reference, or memory file were ever tagged eager for a given host (Kiro
 * `inclusion: always` by omission, Cursor `alwaysApply: true`, Claude Code's root
 * file), that flattens the layers and defeats the whole point of scoped, on-demand
 * context loading this project is built around.
 *
 * This module is the enforcement point: given a set of files about to be emitted
 * (each tagged with its layer and frontmatter) and a target host, it throws on the
 * first violation rather than silently emitting a broken export. Pure, browser-safe
 * — no fs; the caller (packages/cli's walkable-export.ts) supplies file content and
 * writes to disk.
 */

import type { HostId, HostTarget } from '../host-targets'
import { getHostTarget } from '../host-targets'

export type PlacementLayer = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export interface PlacementCandidate {
  /** Workspace-root-relative path, for error messages. */
  relativePath: string
  layer: PlacementLayer
  /** Parsed frontmatter of the file as it will be emitted (post-resolution, pre-write). */
  frontmatter: Record<string, unknown>
  /**
   * True if the file has no body content (e.g. an `output/.gitkeep` scaffold).
   * Empty files are exempt from the guardrail: "always-on" is a statement about
   * what loads into context, and an empty file loads nothing — flagging it would
   * be a false positive on every export, not a real placement risk.
   */
  isEmpty?: boolean
}

export class PlacementViolationError extends Error {
  constructor(
    public readonly relativePath: string,
    public readonly layer: PlacementLayer,
    public readonly host: HostTarget,
  ) {
    super(
      `${relativePath} (${layer}) would load via ${host.label}'s always-on channel ` +
        `(${host.alwaysOnChannel.mechanism}). L1-L4 must load on-demand — see ` +
        `docs/planning/MASTER-PLAN.md "5-layer context placement".`,
    )
    this.name = 'PlacementViolationError'
  }
}

/**
 * Check one candidate file against a host's always-on-channel rule.
 * Returns the violation reason, or `null` if the placement is fine.
 *
 * L0 is exempt by definition (it is *meant* to be always-on) — only L1-L4 are
 * checked. `isRootFile` is threaded through for hosts (Claude Code) whose
 * eagerness is positional rather than frontmatter-driven; a non-L0 candidate is
 * never the root file, so this is always `false` here.
 */
export function checkPlacement(candidate: PlacementCandidate, host: HostTarget): PlacementViolationError | null {
  if (candidate.layer === 'L0') return null
  if (candidate.isEmpty) return null
  const eager = host.alwaysOnChannel.isAlwaysOn(candidate.frontmatter, false)
  if (!eager) return null
  return new PlacementViolationError(candidate.relativePath, candidate.layer, host)
}

/**
 * Check every candidate against `hostId`'s registry entry. Returns all violations
 * found (does not stop at the first one) so a caller can report everything wrong
 * in one pass rather than fix-and-rerun repeatedly. Throws immediately if `hostId`
 * isn't a registered host — that's a caller bug (unknown target), not a placement
 * violation to report alongside real ones.
 */
export function checkAllPlacements(
  candidates: PlacementCandidate[],
  hostId: HostId | string,
): PlacementViolationError[] {
  const host = getHostTarget(hostId)
  if (!host) throw new Error(`checkAllPlacements: unknown host target "${hostId}"`)
  const violations: PlacementViolationError[] = []
  for (const candidate of candidates) {
    const violation = checkPlacement(candidate, host)
    if (violation) violations.push(violation)
  }
  return violations
}
