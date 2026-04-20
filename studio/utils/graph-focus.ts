/**
 * Graph focus utilities — pure functions for computing connected sets
 * and paths in workflow graphs. Used by Canvas for spotlight/dim and
 * path trace features.
 */
import type { EdgeDef } from '@/lib/types'

/** Set of node IDs and edge IDs that should stay highlighted */
export interface FocusSet {
  nodes: Set<string>
  edges: Set<string>
}

/**
 * Compute the immediate neighborhood of a node: the node itself,
 * all directly connected nodes (in + out), and the edges between them.
 * Node IDs use the `step:` prefix to match React Flow IDs.
 */
export function computeNeighbors(
  selectedStepId: string,
  wfEdges: EdgeDef[],
): FocusSet {
  const nodes = new Set<string>([`step:${selectedStepId}`])
  const edges = new Set<string>()

  for (const e of wfEdges) {
    if (e.from === selectedStepId) {
      nodes.add(`step:${e.to}`)
      edges.add(`flow:${e.from}-${e.to}`)
    }
    if (e.to === selectedStepId) {
      nodes.add(`step:${e.from}`)
      edges.add(`flow:${e.from}-${e.to}`)
    }
  }

  return { nodes, edges }
}

/** A single execution path through the workflow */
export interface TracedPath {
  /** Ordered node IDs (without step: prefix) */
  nodeIds: string[]
  /** Edge IDs along the path */
  edgeIds: string[]
  /** Condition labels on conditional edges (edge index → condition string) */
  conditions: Map<number, string>
}

/**
 * Find all simple paths from `startId` to `endId` in the workflow graph.
 * Respects conditional edges — each distinct condition creates a separate
 * branch. Returns up to `maxPaths` results to avoid combinatorial explosion.
 *
 * Uses DFS with cycle detection (no revisiting nodes on the same path).
 */
export function findAllPaths(
  startId: string,
  endId: string,
  wfEdges: EdgeDef[],
  maxPaths = 8,
): TracedPath[] {
  // Build adjacency: node → [{to, edgeId, condition}]
  const adj = new Map<string, { to: string; edgeId: string; condition?: string }[]>()
  for (const e of wfEdges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)!.push({
      to: e.to,
      edgeId: `flow:${e.from}-${e.to}`,
      condition: e.condition,
    })
  }

  const results: TracedPath[] = []
  const visited = new Set<string>()

  function dfs(current: string, path: string[], edgePath: string[], conditions: Map<number, string>) {
    if (results.length >= maxPaths) return
    if (current === endId) {
      results.push({
        nodeIds: [...path],
        edgeIds: [...edgePath],
        conditions: new Map(conditions),
      })
      return
    }

    for (const neighbor of adj.get(current) ?? []) {
      if (visited.has(neighbor.to)) continue
      visited.add(neighbor.to)
      path.push(neighbor.to)
      edgePath.push(neighbor.edgeId)
      if (neighbor.condition) conditions.set(edgePath.length - 1, neighbor.condition)
      dfs(neighbor.to, path, edgePath, conditions)
      if (neighbor.condition) conditions.delete(edgePath.length - 1)
      edgePath.pop()
      path.pop()
      visited.delete(neighbor.to)
    }
  }

  visited.add(startId)
  dfs(startId, [startId], [], new Map())

  // Also search in reverse (endId → startId) if no forward paths found
  if (results.length === 0) {
    visited.clear()
    visited.add(endId)
    dfs(endId, [endId], [], new Map())
  }

  return results
}

/**
 * Convert a TracedPath to a FocusSet for highlighting.
 */
export function pathToFocusSet(path: TracedPath): FocusSet {
  return {
    nodes: new Set(path.nodeIds.map(id => `step:${id}`)),
    edges: new Set(path.edgeIds),
  }
}

/**
 * Compute cluster home positions for resource nodes.
 * Places resources in 4 category clouds in the corners of the canvas,
 * well away from the workflow graph center.
 */
export function computeClusterPositions(
  resourceIds: { id: string; category: string }[],
  graphBounds: { minX: number; maxX: number; minY: number; maxY: number },
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const dotSpacing = 42

  // Group by category
  const groups = new Map<string, string[]>()
  for (const r of resourceIds) {
    if (!groups.has(r.category)) groups.set(r.category, [])
    groups.get(r.category)!.push(r.id)
  }

  // Corner anchors — far from the graph center
  const graphW = graphBounds.maxX - graphBounds.minX
  const graphH = graphBounds.maxY - graphBounds.minY
  const pad = Math.max(400, graphW * 0.4, graphH * 0.4)

  const corners: Record<string, { x: number; y: number }> = {
    instructions: { x: graphBounds.minX - pad, y: graphBounds.minY - pad * 0.6 },
    capabilities: { x: graphBounds.maxX + pad * 0.5, y: graphBounds.minY - pad * 0.6 },
    runbooks:     { x: graphBounds.minX - pad, y: graphBounds.maxY + pad * 0.4 },
    memory:       { x: graphBounds.maxX + pad * 0.5, y: graphBounds.maxY + pad * 0.4 },
  }

  for (const [cat, ids] of groups) {
    const anchor = corners[cat] ?? { x: graphBounds.maxX + pad, y: graphBounds.minY }
    const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)))
    for (let i = 0; i < ids.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      positions[ids[i]] = {
        x: anchor.x + col * dotSpacing,
        y: anchor.y + row * dotSpacing,
      }
    }
  }

  return positions
}

/**
 * Compute gathered positions for resources around a selected workflow node.
 * Fans resources in a semicircle to the right of the node.
 */
export function computeGatheredPositions(
  resourceIds: string[],
  nodePos: { x: number; y: number },
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const count = resourceIds.length
  if (count === 0) return positions

  const radius = 180
  const startAngle = -Math.PI / 3
  const sweep = (Math.PI * 2) / 3

  for (let i = 0; i < count; i++) {
    const angle = count === 1
      ? 0
      : startAngle + (sweep * i) / Math.max(1, count - 1)
    positions[resourceIds[i]] = {
      x: nodePos.x + 280 + Math.cos(angle) * radius,
      y: nodePos.y + 75 + Math.sin(angle) * radius,
    }
  }

  return positions
}

/**
 * Build a cumulative FocusSet from a trail of node IDs.
 * Highlights all nodes in the trail and all edges between consecutive pairs.
 */
export function trailToFocusSet(
  trail: string[],
  wfEdges: EdgeDef[],
): FocusSet {
  const nodes = new Set<string>(trail.map(id => `step:${id}`))
  const edges = new Set<string>()

  for (let i = 0; i < trail.length - 1; i++) {
    const from = trail[i]
    const to = trail[i + 1]
    // Find edge in either direction
    const fwd = `flow:${from}-${to}`
    const rev = `flow:${to}-${from}`
    if (wfEdges.some(e => e.from === from && e.to === to)) edges.add(fwd)
    else if (wfEdges.some(e => e.from === to && e.to === from)) edges.add(rev)
  }

  return { nodes, edges }
}
