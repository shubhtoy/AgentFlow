import type { WorkflowGraph, ResourceCategory, ExplorerSection, ExplorerItem } from '@/lib/types'
import { CATEGORY_CONFIG, RESOURCE_CATEGORIES } from '@/lib/constants'

const CATEGORIES = RESOURCE_CATEGORIES

/**
 * Collect all resource keys referenced by a workflow — from node refs,
 * conditional edge conditions, and the workflow descriptor.
 */
function collectReferencedKeys(data: WorkflowGraph, activeWf: string): Set<string> {
  const keys = new Set<string>()
  const wf = data.workflows[activeWf]
  if (!wf) return keys

  // Refs from all nodes (mentions, edges, data flows)
  for (const node of Object.values(wf.nodes)) {
    for (const ref of node.allRefs || []) {
      if (ref.category && ref.name) {
        keys.add(`${ref.category}/${ref.name}`)
      }
      // Conditional edge conditions reference runbooks: "runbooks/design-approved"
      if (ref.condition) {
        const slash = ref.condition.indexOf('/')
        if (slash > 0) {
          keys.add(ref.condition)
        }
      }
    }
  }

  // Refs from the workflow descriptor (AGENTS.md)
  if (wf.descriptorFile) {
    for (const ref of wf.descriptorFile.refs || []) {
      if (ref.category && ref.name) {
        keys.add(`${ref.category}/${ref.name}`)
      }
      if (ref.condition) {
        const slash = ref.condition.indexOf('/')
        if (slash > 0) {
          keys.add(ref.condition)
        }
      }
    }
  }

  return keys
}

export function buildExplorerSections(data: WorkflowGraph, activeWf: string, showAll = false): ExplorerSection[] {
  const sections: ExplorerSection[] = []
  const referencedResources = collectReferencedKeys(data, activeWf)

  for (const cat of RESOURCE_CATEGORIES) {
    const records = (data[cat] ?? {}) as Record<string, { title: string; scope?: string; frontmatter: Record<string, unknown> }>

    // Split runbooks into Conditions and Interactions sub-groups
    if (cat === 'runbooks') {
      const conditions: ExplorerItem[] = []
      const interactions: ExplorerItem[] = []
      for (const [key, file] of Object.entries(records)) {
        if (!showAll && !referencedResources.has(`${cat}/${key}`)) continue
        const item: ExplorerItem = {
          id: `${cat}/${key}`,
          name: (file.frontmatter?.name as string) || file.title || key,
          type: 'resource' as const,
          category: cat,
          referenced: referencedResources.has(`${cat}/${key}`),
        }
        if (file.scope === 'condition') conditions.push(item)
        else interactions.push(item)
      }
      if (conditions.length > 0) {
        sections.push({ key: cat, label: 'Conditions', tooltip: 'Natural language checks that determine routing', ecosystemHint: 'The agent evaluates these to decide which path to take', items: conditions })
      }
      if (interactions.length > 0) {
        sections.push({ key: cat, label: 'Interactions', tooltip: 'Human-in-the-loop pause points', ecosystemHint: 'The agent stops here and asks for your input', items: interactions })
      }
      continue
    }

    const items: ExplorerItem[] = Object.entries(records)
      .filter(([key]) => showAll || referencedResources.has(`${cat}/${key}`))
      .map(([key, file]) => ({
        id: `${cat}/${key}`,
        name: (file.frontmatter?.name as string) || file.title || key,
        type: 'resource' as const,
        category: cat,
        referenced: referencedResources.has(`${cat}/${key}`),
      }))
    if (items.length > 0) {
      sections.push({
        key: cat,
        label: CATEGORY_CONFIG[cat]?.label || cat,
        items,
      })
    }
  }

  // Workflows section
  const wfItems: ExplorerItem[] = Object.entries(data.workflows).map(([id, wf]) => ({
    id,
    name: wf.name || id,
    type: 'workflow' as const,
  }))
  if (wfItems.length > 0) {
    sections.push({ key: 'workflows', label: 'Workflows', items: wfItems })
  }

  // Nodes section (from active workflow)
  const activeWorkflow = data.workflows[activeWf]
  if (activeWorkflow) {
    const nodeItems: ExplorerItem[] = Object.entries(activeWorkflow.nodes).map(([id, node]) => ({
      id,
      name: node.name || id,
      type: 'node' as const,
      workflowId: activeWf,
    }))
    if (nodeItems.length > 0) {
      sections.push({ key: 'nodes', label: 'Nodes', items: nodeItems })
    }
  }

  return sections
}
