/**
 * Exposes AgentFlow state to CopilotKit via useAgentContext (v2).
 *
 * The copilot sees:
 * - The full parsed workspace graph
 * - Current selection with rich detail (node content, resource content)
 * - Active workflow context
 * - Validation results
 * - MCP server config
 */

import { useState, useEffect } from 'react'
import { useAgentContext, type JsonSerializable } from '@copilotkit/react-core/v2'
import { useAppStore } from '@/store'

export function CopilotReadables() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const selection = useAppStore(s => s.selection)
  const validationResult = useAppStore(s => s.validationResult)
  const focusTarget = useAppStore(s => s.focusTarget)
  const resolvedTheme = useAppStore(s => s.resolvedTheme)

  const [mcpServers, setMcpServers] = useState<any[]>([])
  useEffect(() => {
    const load = () =>
      fetch('/api/mcp?action=config')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.servers) setMcpServers(d.servers) })
        .catch(() => {})
    load()
    const handler = () => load()
    window.addEventListener('mcp-tools-changed', handler)
    return () => window.removeEventListener('mcp-tools-changed', handler)
  }, [])

  // Full workspace graph
  useAgentContext({
    description: 'The parsed AgentFlow workspace graph with all workflows, nodes, edges, and resources.',
    value: data ? summarizeGraph(data as any) : null,
  })

  // Rich selection context — tells the agent exactly what the user is looking at
  useAgentContext({
    description: 'Current user focus — the selected workflow, node, or resource with details. Use this to understand what the user is asking about.',
    value: buildSelectionContext(data as any, activeWf, selection, focusTarget?.type === 'node' ? focusTarget.nodeId : null, focusTarget?.type === 'node' ? focusTarget.workflowId : null),
  })

  // UI state
  useAgentContext({
    description: 'Current UI state — theme, active workflow, whether a node detail modal is open.',
    value: {
      activeWorkflowId: activeWf,
      theme: resolvedTheme,
      focusModalOpen: !!focusTarget,
      focusTarget,
    },
  })

  // Validation
  useAgentContext({
    description: 'Validation results — errors that must be fixed and warnings to review.',
    value: (validationResult ?? null) as unknown as JsonSerializable,
  })

  // MCP servers
  useAgentContext({
    description: 'Configured MCP servers with status, tool counts, and available tools.',
    value: mcpServers.length > 0 ? mcpServers.map(s => ({
      name: s.name, enabled: !s.disabled, status: s.status,
      toolCount: s.toolCount, tools: s.tools?.map((t: any) => t.name) ?? [],
      url: s.url || undefined, description: s.description || undefined,
    })) : null,
  })

  return null
}

/** Build rich context about what the user has selected */
function buildSelectionContext(data: any, activeWf: string, selection: any, focusNodeId: string | null, focusWorkflowId: string | null) {
  if (!data) return null

  const ctx: any = { activeWorkflowId: activeWf }

  // If a node detail modal is open, that's the primary focus
  if (focusNodeId && focusWorkflowId) {
    const wf = data.workflows?.[focusWorkflowId]
    const node = wf?.nodes?.[focusNodeId]
    if (node) {
      ctx.focusedNode = {
        id: focusNodeId, workflowId: focusWorkflowId,
        name: node.name, nodeType: node.nodeType, entry: node.entry,
        description: node.description,
        frontmatter: node.frontmatter,
        refs: (node.allRefs ?? []).map((r: any) => r.raw),
        filePath: node.primaryFile?.relativePath || `${focusWorkflowId}/${focusNodeId}/SKILL.md`,
        rawContent: node.primaryFile?.rawContent?.slice(0, 2000) || null,
      }
    }
  }

  // Selection from the canvas/explorer
  if (selection) {
    ctx.selection = { type: selection.type, category: selection.category, key: selection.key }

    if (selection.type === 'node' && activeWf) {
      const wf = data.workflows?.[activeWf]
      const node = wf?.nodes?.[selection.key]
      if (node) {
        ctx.selectedNode = {
          id: selection.key, name: node.name, nodeType: node.nodeType,
          entry: node.entry, description: node.description,
          frontmatter: node.frontmatter,
          refs: (node.allRefs ?? []).map((r: any) => r.raw),
          filePath: node.primaryFile?.relativePath || `${activeWf}/${selection.key}/SKILL.md`,
        }
      }
    }

    if (selection.type === 'resource' && selection.category) {
      const resource = data[selection.category]?.[selection.key]
      if (resource) {
        ctx.selectedResource = {
          category: selection.category, key: selection.key,
          name: resource.frontmatter?.name || selection.key,
          type: resource.frontmatter?.type,
          description: resource.frontmatter?.description,
          filePath: resource.relativePath,
        }
      }
    }
  }

  return ctx
}

/** Compact graph summary for the copilot */
function summarizeGraph(data: any) {
  return {
    identity: data.descriptorFile?.frontmatter?.identity ?? null,
    workspaceName: data.descriptorFile?.frontmatter?.name ?? null,
    workflows: Object.entries(data.workflows ?? {}).map(([id, wf]: [string, any]) => ({
      id, name: wf.name, description: wf.description, entryPoints: wf.entryPoints,
      nodes: Object.entries(wf.nodes ?? {}).map(([nid, n]: [string, any]) => ({
        id: nid, name: n.name, nodeType: n.nodeType, entry: n.entry,
        description: n.description,
        refs: (n.allRefs ?? []).map((r: any) => r.raw),
      })),
      edges: (wf.edges ?? []).map((e: any) => ({ from: e.from, to: e.to, condition: e.condition ?? null })),
    })),
    resources: {
      capabilities: Object.keys(data.capabilities ?? {}),
      instructions: Object.keys(data.instructions ?? {}),
      skills: Object.keys(data.skills ?? {}),
      memory: Object.keys(data.memory ?? {}),
      hooks: Object.keys(data.hooks ?? {}),
    },
  }
}
