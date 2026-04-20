/**
 * Shared auto-layout utility using ELK (Eclipse Layout Kernel).
 * Used by both Canvas.tsx and playground.tsx — single source of truth.
 *
 * Supports adaptive direction selection based on graph topology:
 * - Wide/branchy graphs → horizontal (LEFT_TO_RIGHT)
 * - Deep/linear chains  → vertical (DOWN)
 */
import ELK from 'elkjs/lib/elk.bundled.js'
import type { EdgeDef } from '@/lib/types'

const elk = new ELK()

const NODE_W = 280
const NODE_H = 150

export interface LayoutPositions {
  [nodeId: string]: { x: number; y: number }
}

/**
 * Detect back-edges via DFS and reverse them so ELK sees an acyclic graph.
 * This preserves the structural influence of cycles (rejection loops, iteration
 * loops) on layer assignment without triggering ELK's NETWORK_SIMPLEX hang.
 * React Flow still renders the original edge directions.
 */
function acyclicEdges(nodeIds: string[], edges: EdgeDef[]): EdgeDef[] {
  const adj = new Map<string, EdgeDef[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) {
    if (adj.has(e.from) && adj.has(e.to)) {
      adj.get(e.from)!.push(e)
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()
  const result: EdgeDef[] = []

  function dfs(node: string) {
    visited.add(node)
    inStack.add(node)
    for (const edge of adj.get(node) || []) {
      if (inStack.has(edge.to)) {
        // back-edge — reverse it so ELK treats it as a forward edge
        result.push({ from: edge.to, to: edge.from, sourceRef: edge.sourceRef } as EdgeDef)
      } else {
        result.push(edge)
        if (!visited.has(edge.to)) {
          dfs(edge.to)
        }
      }
    }
    inStack.delete(node)
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) dfs(id)
  }

  return result
}

/**
 * Analyze graph topology to pick the best layout direction.
 *
 * Heuristic: compute the "width" (max nodes at any single depth level via BFS)
 * vs the "depth" (longest path from any root). If the graph is wider than it is
 * deep, a horizontal (RIGHT) layout avoids the tall-skinny column problem.
 *
 * Also considers branching factor: routers that fan out to 3+ targets benefit
 * from horizontal layout since the branches spread vertically and stay compact.
 */
function inferDirection(
  nodeIds: string[],
  edges: EdgeDef[]
): 'RIGHT' | 'DOWN' {
  if (nodeIds.length <= 2) return 'DOWN'

  // Build adjacency + compute in-degrees
  const children = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const id of nodeIds) {
    children.set(id, [])
    inDegree.set(id, 0)
  }
  for (const e of edges) {
    if (children.has(e.from) && inDegree.has(e.to)) {
      children.get(e.from)!.push(e.to)
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
    }
  }

  // BFS from roots (in-degree 0) to compute layer widths
  const roots = nodeIds.filter(id => (inDegree.get(id) ?? 0) === 0)
  if (roots.length === 0) return 'DOWN' // fully cyclic — just go vertical

  const depth = new Map<string, number>()
  const queue: string[] = [...roots]
  for (const r of roots) depth.set(r, 0)

  while (queue.length > 0) {
    const node = queue.shift()!
    const d = depth.get(node)!
    for (const child of children.get(node) ?? []) {
      // Only enqueue if we haven't visited yet — prevents infinite loops on cycles
      if (!depth.has(child)) {
        depth.set(child, d + 1)
        queue.push(child)
      }
    }
  }

  // Count nodes per layer
  const layerCounts = new Map<number, number>()
  let maxDepth = 0
  for (const d of depth.values()) {
    layerCounts.set(d, (layerCounts.get(d) ?? 0) + 1)
    if (d > maxDepth) maxDepth = d
  }

  const maxWidth = Math.max(...layerCounts.values())

  // Check branching factor — any node with 3+ children is a "wide" router
  let hasFanOut = false
  for (const ch of children.values()) {
    if (ch.length >= 3) { hasFanOut = true; break }
  }

  // Heuristic: prefer horizontal when graph is wider than deep,
  // or when there's significant fan-out that would stack vertically
  const aspectRatio = maxWidth / Math.max(1, maxDepth + 1)
  if (aspectRatio > 1.2 || (hasFanOut && maxWidth >= 3)) return 'RIGHT'

  return 'DOWN'
}

/**
 * Compute positions for workflow nodes using ELK layered algorithm.
 * Returns a map of `step:<id>` → { x, y }.
 *
 * When no explicit direction is given, the algorithm analyzes the graph
 * topology and picks horizontal or vertical layout automatically.
 *
 * Back-edges (rejection loops) are reversed before layout so ELK sees
 * an acyclic graph and doesn't hang, while still accounting for cycle
 * structure in layer assignment. React Flow renders original directions.
 */
export async function elkLayout(
  stepIds: string[],
  wfEdges: EdgeDef[],
  options?: { direction?: 'RIGHT' | 'DOWN' | 'AUTO' }
): Promise<LayoutPositions> {
  if (stepIds.length === 0) return {}

  const layoutEdges = acyclicEdges(stepIds, wfEdges)

  // Pick direction: explicit override, or auto-detect from topology
  const requestedDir = options?.direction ?? 'AUTO'
  const dir = requestedDir === 'AUTO'
    ? inferDirection(stepIds, layoutEdges)
    : requestedDir

  // Adaptive spacing based on direction and graph size
  const nodeCount = stepIds.length
  const isHorizontal = dir === 'RIGHT'
  const layerSpacing = isHorizontal
    ? String(Math.max(80, Math.min(160, 200 - nodeCount * 5)))
    : String(Math.max(80, Math.min(120, 160 - nodeCount * 3)))
  const nodeSpacing = isHorizontal ? '60' : '80'

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': dir,
      'elk.spacing.nodeNode': nodeSpacing,
      'elk.layered.spacing.nodeNodeBetweenLayers': layerSpacing,
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '25',
      'elk.padding': '[top=40,left=60,bottom=40,right=60]',
      // Better crossing minimization + node ordering
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      // Improve edge routing for conditional branches
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Spread disconnected components side-by-side instead of stacking
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '80',
    },
    children: stepIds.map(id => ({
      id,
      width: NODE_W,
      height: NODE_H,
    })),
    edges: layoutEdges
      .filter(e => stepIds.includes(e.from) && stepIds.includes(e.to))
      .map((e, i) => ({
        id: `e${i}`,
        sources: [e.from],
        targets: [e.to],
      })),
  }

  const laid = await elk.layout(graph)
  const pos: LayoutPositions = {}
  for (const child of laid.children ?? []) {
    pos[`step:${child.id}`] = { x: child.x ?? 0, y: child.y ?? 0 }
  }
  return pos
}

/**
 * Synchronous fallback using simple grid layout (no external deps).
 * Used when ELK hasn't resolved yet on initial render.
 */
export function gridLayout(stepIds: string[]): LayoutPositions {
  const pos: LayoutPositions = {}
  const cols = Math.max(1, Math.ceil(Math.sqrt(stepIds.length)))
  stepIds.forEach((id, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    pos[`step:${id}`] = { x: col * 350, y: row * 220 }
  })
  return pos
}
