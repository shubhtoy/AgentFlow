import { useCallback, useEffect } from 'react'
import { Footprints, GitBranch, Layers } from 'lucide-react'
import { useAppStore } from '../store'
import { generateUniqueName } from './name-gen'
import type { LibraryEntry } from '@/lib/types'

/* ── Shared constants ─────────────────────────────────────────────── */

export const NODE_TYPE_LABELS: Record<string, string> = {
  step: 'Step',
  router: 'Gateway',
  'sub-workflow': 'Sub-workflow',
}

export interface NodeTypeOption {
  type: string
  label: string
  description: string
  icon: typeof Footprints
}

export const NODE_OPTIONS: NodeTypeOption[] = [
  { type: 'step', label: 'Step', description: 'A node that executes instructions and uses tools', icon: Footprints },
  { type: 'sub-workflow', label: 'Sub-workflow', description: 'Delegates to another workflow', icon: Layers },
]

/** Map node type → relevant library entry types */
export const NODE_LIBRARY_MAP: Record<string, string[]> = {
  step: ['instruction', 'skill'],
  'sub-workflow': ['workflow'],
}

/** Map singular library type → plural directory name for refs */
const TYPE_TO_DIR: Record<string, string> = {
  instruction: 'instructions', instructions: 'instructions',
  skill: 'skills', skills: 'skills',
  capability: 'capabilities', capabilities: 'capabilities',
  memory: 'memory',
  workflow: 'workflows',
}

/** Map node type → workspace category keys */
const NODE_WORKSPACE_MAP: Record<string, string> = {
  step: 'instructions',
  router: 'skills',
}

/* ── Hooks ────────────────────────────────────────────────────────── */

/** Create a node in the active workflow, optionally attaching a resource reference. */
export function useCreateNode() {
  const createNode = useAppStore(s => s.createNode)
  const activeWf = useAppStore(s => s.activeWf)
  const reload = useAppStore(s => s.reload)
  const select = useAppStore(s => s.select)
  const showNotification = useAppStore(s => s.showNotification)

  const createWorkflow = useAppStore(s => s.createWorkflow)
  const setActiveWf = useAppStore(s => s.setActiveWf)

  return useCallback(async (nodeType: string, resource?: { name: string; type: string; source: string }, position?: { x: number; y: number }) => {
    let wfId = activeWf
    if (!wfId) {
      try {
        await createWorkflow('main')
        await reload()
        wfId = 'main'
        setActiveWf(wfId)
      } catch {
        showNotification('Failed to create workflow', 'error')
        return
      }
    }
    const slug = resource ? resource.name : generateUniqueName()
    // Pre-save position so buildGraph picks it up
    if (position) {
      try {
        const key = `af-pos-${wfId}`
        const saved = JSON.parse(localStorage.getItem(key) || '{}')
        saved[`step:${slug}`] = position
        localStorage.setItem(key, JSON.stringify(saved))
      } catch { /* best-effort */ }
    }
    try {
      await createNode(wfId, slug, nodeType, undefined, resource ? `${TYPE_TO_DIR[resource.type] || resource.type}/${resource.name}` : undefined)
      select({ type: 'node', key: slug, workflowId: wfId })
    } catch {
      showNotification('Failed to create node', 'error')
    }
  }, [activeWf, createNode, createWorkflow, setActiveWf, reload, select, showNotification])
}

export interface TemplateItem {
  name: string
  description?: string
  source: 'workspace' | 'library'
  type: string
}

/** Get templates relevant to a given node type from both workspace and library. */
export function useNodeTemplates() {
  const libraryEntries = useAppStore(s => s.libraryEntries)
  const loadLibrary = useAppStore(s => s.loadLibrary)
  const data = useAppStore(s => s.data)

  useEffect(() => { if (libraryEntries.length === 0) loadLibrary() }, [libraryEntries.length, loadLibrary])

  const getTemplates = useCallback((nodeType: string): TemplateItem[] => {
    const items: TemplateItem[] = []

    // Workspace resources
    const wsCat = NODE_WORKSPACE_MAP[nodeType]
    if (wsCat && data) {
      const records = (data as any)[wsCat] as Record<string, any> | undefined
      if (records) {
        for (const [name, file] of Object.entries(records)) {
          items.push({
            name,
            description: file?.frontmatter?.description as string | undefined,
            source: 'workspace',
            type: wsCat,
          })
        }
      }
    }

    // Library entries
    const libTypes = NODE_LIBRARY_MAP[nodeType] || []
    for (const entry of libraryEntries) {
      if (libTypes.includes(entry.type)) {
        items.push({ name: entry.name, description: entry.description, source: 'library', type: entry.type })
      }
    }

    return items
  }, [libraryEntries, data])

  const hasTemplates = useCallback((nodeType: string): boolean => {
    const wsCat = NODE_WORKSPACE_MAP[nodeType]
    if (wsCat && data) {
      const records = (data as any)[wsCat] as Record<string, any> | undefined
      if (records && Object.keys(records).length > 0) return true
    }
    const libTypes = NODE_LIBRARY_MAP[nodeType] || []
    return libraryEntries.some(e => libTypes.includes(e.type))
  }, [libraryEntries, data])

  return { getTemplates, hasTemplates }
}
