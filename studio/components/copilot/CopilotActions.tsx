/**
 * Registers CopilotKit v2 frontend tools that let the copilot interact with
 * the AgentFlow workspace — create, edit, delete, validate,
 * and manage MCP servers from the panel.
 *
 * Each tool maps to an existing API endpoint. The copilot reads
 * the parsed graph (via readables) and writes raw markdown files
 * (via these tools).
 *
 * Renderless component — just registers tools.
 */

import { useFrontendTool } from '@copilotkit/react-core/v2'
import { z } from 'zod'
import { useAppStore } from '@/store'
import { api } from '@/lib/api'

export function CopilotActions() {
  const reload = useAppStore(s => s.reload)

  // Auto-focus a file path after create/edit — selects the node or resource in the UI
  const autoFocusPath = (filePath: string) => {
    try {
      const store = useAppStore.getState()
      const parts = filePath.replace(/^\//, '').split('/')

      // Node: <workflow>/<node>/SKILL.md → select node
      if (parts.length >= 2 && (filePath.includes('SKILL.md') || filePath.includes('AGENTS.md'))) {
        const wfId = parts[0]
        const nodeId = parts.length >= 3 ? parts[1] : null
        if (nodeId && store.data?.workflows?.[wfId]?.nodes?.[nodeId]) {
          store.select({ type: 'node', key: nodeId, workflowId: wfId })
          return
        }
        if (store.data?.workflows?.[wfId]) {
          store.setActiveWf(wfId)
          return
        }
      }

      // Resource: <category>/<name>.md → select resource
      const CATEGORIES = ['capabilities', 'instructions', 'runbooks', 'memory', 'hooks']
      if (parts.length === 2 && CATEGORIES.includes(parts[0])) {
        const name = parts[1].replace(/\.md$/, '').replace(/\.json$/, '')
        store.select({ type: 'resource', category: parts[0] as any, key: name })
      }
    } catch { /* best effort */ }
  }

  // ── Create a file ─────────────────────────────────────────────────
  useFrontendTool({
    name: 'createFile',
    description:
      'Create a new file in the .agentflow/ workspace. Use this to create AGENTS.md, SKILL.md, capability files, instruction files, runbooks, memory files, etc. The path is relative to the .agentflow/ root.',
    parameters: z.object({
      path: z.string().describe('File path relative to .agentflow/ root'),
      content: z.string().describe('Full file content including YAML frontmatter and markdown body'),
    }),
    handler: async ({ path, content }) => {
      await api.create(path, content)
      await reload()
      // Auto-focus: select the created resource/node in the UI
      autoFocusPath(path)
      return `Created ${path}`
    },
  }, [reload])

  // ── Edit a file ───────────────────────────────────────────────────
  useFrontendTool({
    name: 'editFile',
    description: 'Edit an existing file in the workspace. Provide the full updated content.',
    parameters: z.object({
      path: z.string().describe('File path relative to .agentflow/ root'),
      content: z.string().describe('Full updated file content'),
    }),
    handler: async ({ path, content }) => {
      await api.save([{ path, content }])
      await reload()
      // Auto-focus: select the edited resource/node in the UI
      autoFocusPath(path)
      return `Updated ${path}`
    },
  }, [reload])

  // ── Delete a file ─────────────────────────────────────────────────
  useFrontendTool({
    name: 'deleteFile',
    description: 'Delete a file from the workspace.',
    parameters: z.object({
      path: z.string().describe('File path relative to .agentflow/ root'),
    }),
    handler: async ({ path }) => {
      await api.del(path)
      await reload()
      return `Deleted ${path}`
    },
  }, [reload])

  // ── Validate workspace ────────────────────────────────────────────
  useFrontendTool({
    name: 'validateWorkspace',
    description: 'Run validation on the workspace. Returns errors and warnings.',
    parameters: z.object({
      strict: z.boolean().optional().describe('Enable strict mode'),
    }),
    handler: async ({ strict }) => {
      return await api.validate({ strict: strict ?? false })
    },
  }, [])

  // ── Calculate tokens ──────────────────────────────────────────────
  useFrontendTool({
    name: 'calculateTokens',
    description: 'Calculate token usage for a file, node, workflow, or the full workspace.',
    parameters: z.object({
      scope: z.string().describe('One of: file, node, workflow, full'),
      workflowId: z.string().optional().describe('Workflow ID (for node or workflow scope)'),
      nodeId: z.string().optional().describe('Node ID (for node scope)'),
    }),
    handler: async ({ scope, workflowId, nodeId }) => {
      return await api.calculateTokens({ scope: scope as any, workflowId, nodeId, includeShared: true, includeRefs: true })
    },
  }, [])

  // ── Add from library ──────────────────────────────────────────────
  useFrontendTool({
    name: 'addFromLibrary',
    description: 'Add a pre-built resource from the AgentFlow library.',
    parameters: z.object({
      type: z.string().describe('Resource type (capability, instruction, runbook, memory, hook, workflow)'),
      name: z.string().describe('Resource name from the library'),
    }),
    handler: async ({ type, name }) => {
      await useAppStore.getState().addFromLibrary(type, name)
      return `Added ${type} "${name}" from library`
    },
  }, [reload])

  // ── MCP: List configured servers ──────────────────────────────────
  useFrontendTool({
    name: 'listMcpServers',
    description: 'List all configured MCP servers from the panel, including status, tool count, and enabled state.',
    parameters: z.object({}),
    handler: async () => {
      const res = await fetch('/api/mcp?action=config')
      if (!res.ok) return 'Failed to load MCP config'
      const data = await res.json()
      return data.servers
    },
  }, [])

  // ── MCP: Toggle server ────────────────────────────────────────────
  useFrontendTool({
    name: 'toggleMcpServer',
    description: 'Enable or disable an MCP server by name. Updates the panel and mcp.json.',
    parameters: z.object({
      name: z.string().describe('Server name (key in mcp.json)'),
      enabled: z.boolean().describe('true to enable, false to disable'),
    }),
    handler: async ({ name, enabled }) => {
      await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "toggle", name, disabled: !enabled }),
      })
      window.dispatchEvent(new CustomEvent('mcp-tools-changed'))
      return `${enabled ? 'Enabled' : 'Disabled'} MCP server "${name}"`
    },
  }, [])

  // ── MCP: Discover tools ───────────────────────────────────────────
  useFrontendTool({
    name: 'discoverMcpTools',
    description: 'Discover available tools from a configured MCP server. Connects and lists its tools.',
    parameters: z.object({
      name: z.string().describe('Server name to discover tools from'),
    }),
    handler: async ({ name }) => {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "discover", name }),
      })
      const data = await res.json()
      if (!res.ok) return `Discovery failed: ${data.error}`
      window.dispatchEvent(new CustomEvent('mcp-tools-changed'))
      return `Discovered ${data.toolCount} tools from "${name}"`
    },
  }, [])

  // ── UI: Select a node ─────────────────────────────────────────────
  useFrontendTool({
    name: 'selectNode',
    description: 'Select a node in the canvas to highlight it and show its details. Use this when discussing a specific node.',
    parameters: z.object({
      workflowId: z.string().describe('Workflow ID containing the node'),
      nodeId: z.string().describe('Node ID to select'),
    }),
    handler: async ({ workflowId, nodeId }) => {
      const { useAppStore } = await import('@/store')
      const store = useAppStore.getState()
      if (store.activeWf !== workflowId) store.setActiveWf(workflowId)
      store.select({ type: 'node', key: nodeId })
      return `Selected node "${nodeId}" in workflow "${workflowId}"`
    },
  }, [])

  // ── UI: Select a resource ─────────────────────────────────────────
  useFrontendTool({
    name: 'selectResource',
    description: 'Select a resource (capability, instruction, runbook, memory, hook) to show its details.',
    parameters: z.object({
      category: z.string().describe('Resource category: capabilities, instructions, runbooks, memory, hooks'),
      name: z.string().describe('Resource name (without .md extension)'),
    }),
    handler: async ({ category, name }) => {
      const { useAppStore } = await import('@/store')
      useAppStore.getState().select({ type: 'resource', category: category as any, key: name })
      return `Selected ${category}/${name}`
    },
  }, [])

  // ── UI: Switch workflow ───────────────────────────────────────────
  useFrontendTool({
    name: 'switchWorkflow',
    description: 'Switch the active workflow displayed on the canvas.',
    parameters: z.object({
      workflowId: z.string().describe('Workflow ID to switch to'),
    }),
    handler: async ({ workflowId }) => {
      const { useAppStore } = await import('@/store')
      useAppStore.getState().setActiveWf(workflowId)
      return `Switched to workflow "${workflowId}"`
    },
  }, [])

  // ── UI: Focus node (open detail modal) ────────────────────────────
  useFrontendTool({
    name: 'focusNode',
    description: 'Open the detail modal for a specific node, showing its full content and properties.',
    parameters: z.object({
      workflowId: z.string().describe('Workflow ID'),
      nodeId: z.string().describe('Node ID to focus'),
    }),
    handler: async ({ workflowId, nodeId }) => {
      const { useAppStore } = await import('@/store')
      useAppStore.getState().openFocus({ type: 'node', nodeId, workflowId })
      return `Opened detail view for node "${nodeId}"`
    },
  }, [])

  // ── UI: Set theme ─────────────────────────────────────────────────
  useFrontendTool({
    name: 'setTheme',
    description: 'Change the UI theme mode (light, dark, system) or color palette.',
    parameters: z.object({
      mode: z.string().optional().describe('Theme mode: light, dark, or system'),
      palette: z.string().optional().describe('Color palette: default, midnight, forest, ocean, sunset, rose'),
    }),
    handler: async ({ mode, palette }) => {
      const { useAppStore } = await import('@/store')
      const store = useAppStore.getState()
      if (mode) store.setThemeMode(mode as any)
      if (palette) store.setThemePalette(palette as any)
      const parts = []
      if (mode) parts.push(`mode to ${mode}`)
      if (palette) parts.push(`palette to ${palette}`)
      return `Set theme ${parts.join(' and ')}`
    },
  }, [])

  // ── Memory: Read ──────────────────────────────────────────────────
  useFrontendTool({
    name: 'readMemory',
    description: 'Read a persistent memory file (user preferences, decisions, facts, lessons).',
    parameters: z.object({
      name: z.string().describe('Memory name: user, decisions, facts, lessons'),
    }),
    handler: async ({ name }) => {
      const data = useAppStore.getState().data
      const mem = (data as any)?.memory?.[name]
      return mem?.rawContent ?? `No memory file "${name}" found`
    },
  }, [])

  // ── Memory: Write ─────────────────────────────────────────────────
  useFrontendTool({
    name: 'writeMemory',
    description: 'Append an entry to a persistent memory file. Auto-prefixes with date.',
    parameters: z.object({
      name: z.string().describe('Memory name: user, decisions, facts, lessons'),
      entry: z.string().describe('The memory entry to append'),
    }),
    handler: async ({ name, entry }) => {
      const data = useAppStore.getState().data
      const existing = (data as any)?.memory?.[name]?.rawContent ?? `---\nname: ${name}\neditable: true\n---\n`
      const date = new Date().toISOString().split('T')[0]
      await api.save([{ path: `memory/${name}.md`, content: existing + `\n[${date}] ${entry}` }])
      await reload()
      return `Remembered in ${name}: ${entry}`
    },
  }, [reload])

  return null
}
