/**
 * Graph structure validation: cycles, reachability, entry points.
 */

import type { ValidationIssue } from './types'

export function detectCycles(nodes: { id: string }[], edges: { from: string; to: string }[]): ValidationIssue[] {
  const warnings: ValidationIssue[] = []
  const adj = new Map<string, string[]>()
  for (const node of nodes) adj.set(node.id, [])
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, [])
    adj.get(edge.from)!.push(edge.to)
  }

  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  for (const node of nodes) color.set(node.id, WHITE)
  const pathStack: string[] = []

  function dfs(nodeId: string) {
    color.set(nodeId, GRAY)
    pathStack.push(nodeId)
    for (const neighbor of adj.get(nodeId) || []) {
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

export function findUnreachable(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
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
    for (const neighbor of adj.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return nodes.map(n => n.id).filter(id => !visited.has(id))
}
