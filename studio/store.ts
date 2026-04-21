import { create, useStore as useZustandStore } from 'zustand'
import { temporal } from 'zundo'
import type React from 'react'

// SSR-safe localStorage wrapper
const safeStorage = {
  getItem: (key: string) => typeof window !== 'undefined' ? localStorage.getItem(key) : null,
  setItem: (key: string, value: string) => { if (typeof window !== 'undefined') localStorage.setItem(key, value) },
}
import type {
  WorkflowGraph,
  ResourceCategory,
  ParsedFile,
  NodeDef,
  WorkflowDef,
  TreeNode,
  ValidationResult,
  ThemeMode,
  ResolvedTheme,
  ThemePaletteId,
  LibraryEntry,
  AppNotification,
  NotificationType,
  NotificationAction,
} from '@/lib/types'
import { api } from '@/lib/api'
import { gitApi } from '@/lib/api'
import type { ScanResult, SyncConflict, RepoMapping, SyncDirection } from '@/lib/api'
import { loadPanelStates, savePanelStates, buildDefaultStates, type PanelState, type DockPosition } from '@/lib/panelRegistry'
import { toast } from 'sonner'

// ── Re-export types for backward compatibility ──────────────────────────
export type ViewFilter = {
  instructions: boolean
  capabilities: boolean
  runbooks: boolean
  memory: boolean
  hooks: boolean
  customFiles: boolean
}

export interface PendingDrop {
  resourceCategory: string
  resourceName: string
  resourceFilePath: string
  targetNodeName: string
  targetFilePath: string
  targetFrontmatter: Record<string, unknown>
  targetRawContent: string
}

export type FocusTarget =
  | { type: 'node'; nodeId: string; workflowId: string }
  | { type: 'resource'; category: string; key: string }

export interface Selection {
  type: 'resource' | 'node' | 'workflow' | 'identity'
  category?: ResourceCategory
  key: string
  workflowId?: string
}

// ── Domain state — tracked by undo ──────────────────────────────────────
export interface DomainState {
  data: WorkflowGraph | null
  activeWf: string | null
  selection: Selection | null
  viewFilter: ViewFilter
  breadcrumbs: string[]
}

export type PanelMode = 'docked' | 'floating'

// ── UI state — excluded from undo ───────────────────────────────────────
export interface UIState {
  loading: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'dirty'
  lastSavedAt: number | null
  autoSave: boolean
  explorerOpen: boolean
  explorerTab: 'elements' | 'semantic' | 'files'
  drawerOpen: boolean
  drawerTab: 'content' | 'properties' | 'references' | 'preview'
  panelMode: PanelMode
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  themePalette: ThemePaletteId
  commandPaletteOpen: boolean
  zoomLevel: number
  minimapCollapsed: boolean
  notifications: AppNotification[]
  pendingDrop: PendingDrop | null
  libraryPanelOpen: boolean
  resourcePaletteOpen: boolean
  libraryEntries: LibraryEntry[]
  librarySearch: string
  libraryLoading: boolean
  directoryTree: TreeNode | null
  expandedDirs: Set<string>
  validationResult: ValidationResult | null
  focusTarget: FocusTarget | null
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
}
// ── Git state — excluded from undo ───────────────────────────────────────
export type GitSyncStatus = 'idle' | 'syncing' | 'error' | 'conflicts'

export interface GitState {
  repos: RepoMapping[]
  syncStatus: GitSyncStatus
  lastScanResult: ScanResult | null
  pendingConflicts: SyncConflict[]
}

// ── Actions ─────────────────────────────────────────────────────────────
export interface Actions {
  // Data
  reload: () => Promise<WorkflowGraph>
  save: (filePath: string, content: string) => Promise<void>
  markDirty: () => void
  toggleAutoSave: () => void

  // Selection
  select: (s: Selection | null) => void
  selectFile: (path: string) => void

  // Workflow navigation
  setActiveWf: (id: string | null) => void
  drillIntoSubWorkflow: (workflowId: string) => void
  navigateBreadcrumb: (index: number) => void

  // View filter
  setViewFilter: (f: ViewFilter) => void

  // CRUD
  createResource: (category: ResourceCategory, name: string, content: string) => Promise<void>
  createNode: (workflowId: string, name: string, nodeType?: string, linkedWorkflow?: string, resourceRef?: string) => Promise<void>
  createWorkflow: (name: string) => Promise<void>
  deleteResource: (category: ResourceCategory, name: string) => Promise<void>
  deleteNode: (workflowId: string, nodeId: string) => Promise<void>
  deleteWorkflow: (workflowId: string) => Promise<void>
  duplicateNode: (workflowId: string, nodeId: string) => Promise<void>

  // Derived getters
  getSelectedResource: () => ParsedFile | null
  getSelectedNode: () => NodeDef | null
  getSelectedWorkflow: () => WorkflowDef | null

  // Directory
  toggleDir: (path: string) => void
  moveFile: (from: string, to: string) => Promise<void>

  // Validation
  validate: () => Promise<ValidationResult>

  // Theme
  setThemeMode: (mode: ThemeMode) => void
  setThemePalette: (palette: ThemePaletteId) => void
  toggleDark: () => void

  // Library
  setLibrarySearch: (q: string) => void
  loadLibrary: () => Promise<void>
  addFromLibrary: (type: string, name: string) => Promise<void>

  // Panel toggles
  toggleLibraryPanel: () => void
  toggleResourcePalette: () => void
  toggleExplorer: () => void
  setExplorerTab: (tab: 'elements' | 'semantic' | 'files') => void

  // Drawer
  setDrawerOpen: (open: boolean) => void
  setDrawerTab: (tab: 'content' | 'properties' | 'references' | 'preview') => void

  // Command palette
  setCommandPaletteOpen: (open: boolean) => void

  // Zoom
  setZoomLevel: (level: number) => void

  // Minimap
  setMinimapCollapsed: (collapsed: boolean) => void

  // Notifications
  showNotification: (msg: string, type?: NotificationType, action?: NotificationAction) => void
  dismissNotification: (id: string) => void

  // Panel mode
  togglePanelMode: () => void
  setPanelMode: (mode: PanelMode) => void

  // Side panel collapse
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void

  // Panel registry
  panels: Record<string, PanelState>
  togglePanel: (id: string) => void
  setPanelDock: (id: string, dock: DockPosition) => void
  setPanelSize: (id: string, w: number, h: number) => void
  setPanelFloatPos: (id: string, x: number, y: number) => void
  openPanel: (id: string) => void
  closePanel: (id: string) => void

  // Duplicate resource to another node
  duplicateResourceToNode: (category: ResourceCategory, name: string, targetNodeId: string, targetWorkflowId: string) => Promise<void>

  // Pending drop
  setPendingDrop: (drop: PendingDrop | null) => void

  // Undo / Redo
  undo: () => void
  redo: () => void

  // Focus modal
  openFocus: (target: FocusTarget) => void
  closeFocus: () => void

  // Git
  fetchGitStatus: () => Promise<void>
  triggerSync: (params?: { repoName?: string; direction?: SyncDirection; dryRun?: boolean }) => Promise<void>
  triggerScan: (params?: { dir?: string; depth?: number }) => Promise<void>
  connectRepo: (params: { url: string; name: string; role: string; branch: string; repoType: string }) => Promise<void>
  resolveConflict: (path: string, strategy: string) => Promise<void>
}

// ── Full store type ─────────────────────────────────────────────────────
export type AppStore = DomainState & UIState & GitState & Actions

// ── Helpers ─────────────────────────────────────────────────────────────
const defaultFilter: ViewFilter = {
  instructions: true,
  capabilities: true,
  runbooks: true,
  memory: false,
  hooks: false,
  customFiles: false,
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function readStoredThemeMode(): ThemeMode {
  const stored = safeStorage.getItem('af-theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function readStoredFilter(): ViewFilter {
  try {
    return { ...defaultFilter, ...JSON.parse(safeStorage.getItem('af-filter') || '{}') }
  } catch {
    return defaultFilter
  }
}

function readStoredPalette(): ThemePaletteId {
  const stored = safeStorage.getItem('af-palette')
  if (stored === 'default' || stored === 'teal' || stored === 'indigo' || stored === 'amber' || stored === 'rose') return stored
  return 'default'
}

// Notification auto-dismiss timers (module-level, not in store state)
const notificationTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Update ## Available Workflows section in root AGENTS.md after workflow mutations */
// syncIdentity removed — {{$workflows}} template var in AGENTS.md handles this at export time

// ── Store creation ──────────────────────────────────────────────────────
export const useAppStore = create<AppStore>()(
  temporal(
    (set, get) => {
      const initialThemeMode = readStoredThemeMode()
      const initialResolvedTheme = resolveTheme(initialThemeMode)

      return {
        // ── Domain state (undo-tracked) ───────────────────────────────
        data: null,
        activeWf: null,
        selection: null,
        viewFilter: readStoredFilter(),
        breadcrumbs: [],

        // ── UI state (excluded from undo) ─────────────────────────────
        loading: true,
        saveStatus: 'idle' as const,
        lastSavedAt: null,
        autoSave: safeStorage.getItem('af-auto-save') !== 'false',
        explorerOpen: true,
        explorerTab: 'elements' as const,
        drawerOpen: false,
        drawerTab: 'content' as const,
        panelMode: (safeStorage.getItem('af-panel-mode') === 'floating' ? 'floating' : 'docked') as PanelMode,
        themeMode: initialThemeMode,
        resolvedTheme: initialResolvedTheme,
        themePalette: readStoredPalette(),
        commandPaletteOpen: false,
        zoomLevel: 100,
        minimapCollapsed: safeStorage.getItem('af-minimap-collapsed') === 'true',
        notifications: [],
        pendingDrop: null,
        libraryPanelOpen: false,
        resourcePaletteOpen: false,
        libraryEntries: [],
        librarySearch: '',
        libraryLoading: false,
        directoryTree: null,
        expandedDirs: new Set<string>(),
        validationResult: null,
        focusTarget: null,
        leftPanelCollapsed: false,
        rightPanelCollapsed: true,

        // ── Git state (excluded from undo) ──────────────────────────────
        repos: [],
        syncStatus: 'idle' as GitSyncStatus,
        lastScanResult: null,
        pendingConflicts: [],

        // ── Panel registry ──────────────────────────────────────────────
        panels: loadPanelStates(),

        // ── Actions ───────────────────────────────────────────────────

        reload: async () => {
          const d = await api.getData()
          const tree = await api.getTree().catch(() => null)
          set({ data: d, directoryTree: tree })
          // Reset activeWf if it doesn't exist in new data
          const wfs = Object.keys(d.workflows)
          const current = get().activeWf
          if (!current || !wfs.includes(current)) {
            set({ activeWf: null, selection: null })
          }
          set({ loading: false })
          return d
        },

        save: async (filePath: string, content: string) => {
          set({ saveStatus: 'saving' })
          const d = await api.save([{ path: filePath, content }])
          set({ data: d, saveStatus: 'saved', lastSavedAt: Date.now() })
          setTimeout(() => {
            if (get().saveStatus === 'saved') set({ saveStatus: 'idle' })
          }, 3000)
        },

        markDirty: () => {
          set({ saveStatus: 'dirty' })
        },

        toggleAutoSave: () => {
          const next = !get().autoSave
          set({ autoSave: next })
          safeStorage.setItem('af-auto-save', String(next))
        },

        select: (s: Selection | null) => set({ selection: s }),

        selectFile: (filePath: string) => {
          const { data } = get()
          if (data) {
            // Check if this file is in customFiles
            const keyWithoutMd = filePath.endsWith('.md') ? filePath.slice(0, -3) : filePath
            if (data.customFiles && data.customFiles[keyWithoutMd]) {
              set({ selection: { type: 'resource', category: 'customFiles', key: keyWithoutMd } })
              return
            }
            // Check standard categories by relativePath
            const { RESOURCE_CATEGORIES } = require('@/lib/constants')
            const categories = RESOURCE_CATEGORIES
            for (const cat of categories) {
              const catMap = data[cat] as Record<string, ParsedFile>
              if (catMap) {
                for (const [key, file] of Object.entries(catMap)) {
                  if (file.relativePath === filePath) {
                    set({ selection: { type: 'resource', category: cat, key } })
                    return
                  }
                }
              }
            }
            // Match by path pattern: "category/key.ext" → { category, key }
            const parts = filePath.split('/')
            if (parts.length >= 2) {
              const dir = parts[0]
              if (categories.includes(dir) && data[dir]) {
                const fileName = parts.slice(1).join('/')
                const key = fileName.replace(/\.\w+$/, '')
                if ((data[dir] as Record<string, any>)[key]) {
                  set({ selection: { type: 'resource', category: dir as ResourceCategory, key } })
                  return
                }
              }
            }
          }
          // Fallback: select by raw path (for files not in any category)
          set({ selection: { type: 'resource', key: filePath } })
        },

        setActiveWf: (id: string | null) => set({ activeWf: id }),

        drillIntoSubWorkflow: (workflowId: string) => {
          const { activeWf, breadcrumbs } = get()
          set({
            breadcrumbs: [...breadcrumbs, activeWf],
            activeWf: workflowId,
          })
        },

        navigateBreadcrumb: (index: number) => {
          const { breadcrumbs } = get()
          const target = breadcrumbs[index]
          if (target != null) {
            set({
              activeWf: target,
              breadcrumbs: breadcrumbs.slice(0, index),
            })
          }
        },

        setViewFilter: (f: ViewFilter) => {
          set({ viewFilter: f })
          safeStorage.setItem('af-filter', JSON.stringify(f))
        },

        createResource: async (category: ResourceCategory, name: string, content: string) => {
          const d = await api.create(`${category}/${name}.md`, content)
          set({ data: d })
        },

        createNode: async (workflowId: string, name: string, nodeType?: string, linkedWorkflow?: string, resourceRef?: string) => {
          const type = nodeType || 'step'
          const fmLines = [`name: ${name}`, `type: ${type}`]
          let body = ''
          if (type === 'router') {
            fmLines.push('description: Routes execution based on conditions')
            body = resourceRef
              ? `# ${name}\n\n{{${resourceRef}}}\n`
              : [
              `# ${name}`,
              '',
              'Evaluate the current state and decide which path to take.',
              '',
              '## Conditions',
              '',
              '- If the task is simple → route to **quick-handler**',
              '- If the task needs review → route to **review-step**',
              '- Otherwise → route to **default-handler**',
              '',
              '## Context',
              '',
              'Consider the following when routing:',
              '- Input complexity',
              '- Required approvals',
              '- Available resources',
              '',
            ].join('\n')
          } else if (type === 'sub-workflow') {
            const wfLabel = linkedWorkflow || name
            fmLines.push(`description: Orchestrates the ${wfLabel} sub-workflow`)
            fmLines.push(`workflow: ${wfLabel}`)
            body = [
              `# ${name}`,
              '',
              `This node delegates execution to the **${wfLabel}** sub-workflow.`,
              '',
              '## When to enter',
              '',
              'Describe the conditions under which the parent workflow should hand off to this sub-workflow.',
              '',
              '## Context passed in',
              '',
              '<!-- What the parent workflow provides to this sub-workflow -->',
              '<!-- Reference shared resources: {{instructions/name}}, {{capabilities/name}} -->',
              '',
              '## Expected outcome',
              '',
              'Describe what this sub-workflow should produce before returning control to the parent.',
              '',
              '## Workflow definition',
              '',
              `{{workflows/${wfLabel}}}`,
              '',
            ].join('\n')
          } else {
            fmLines.push('description: ""')
            fmLines.push('entry: false')
            body = resourceRef
              ? `# ${name}\n\n{{${resourceRef}}}\n`
              : [
              `# ${name}`,
              '',
              '## Goal',
              '',
              'Describe what this agent should accomplish.',
              '',
              '## Instructions',
              '',
              '1. First, analyze the input',
              '2. Then, process according to the rules below',
              '3. Finally, produce the output',
              '',
              '## Rules',
              '',
              '- Be thorough and precise',
              '- Ask for clarification if the input is ambiguous',
              '',
              '## Resources',
              '',
              '<!-- Drag resources from the Assets panel, or reference with {{category/name}} -->',
              '',
            ].join('\n')
          }
          const content = `---\n${fmLines.join('\n')}\n---\n${body}`
          // For blank sub-workflows, also create AGENTS.md so the directory is a parseable workflow
          if (type === 'sub-workflow' && !linkedWorkflow) {
            const agentsContent = [
              '---', `type: agents`, `name: ${name}`, `description: ${name} sub-workflow`, '---', '',
              `# ${name}`, '', '<!-- Add nodes to build this sub-workflow -->', '<!-- Use {{-> nodes/node-name}} to define execution order -->', '',
            ].join('\n')
            await api.create(`${workflowId}/${name}/AGENTS.md`, agentsContent)
          }
          const d = await api.create(
            `${workflowId}/${name}/SKILL.md`,
            content,
          )
          set({ data: d })
        },

        createWorkflow: async (name: string) => {
          const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          const content = [
            '---',
            `type: agents`,
            `name: ${slug}`,
            `description: ${name}`,
            '---',
            '',
            `# ${name}`,
            '',
            '<!-- Add nodes to build this workflow -->',
            '',
          ].join('\n')
          const d = await api.create(`${slug}/AGENTS.md`, content)
          set({ data: d, activeWf: slug })

        },

        deleteResource: async (category: ResourceCategory, name: string) => {
          const d = await api.del(`${category}/${name}.md`)
          set({ data: d, selection: null })
        },

        deleteNode: async (workflowId: string, nodeId: string) => {
          const d = await api.del(`${workflowId}/${nodeId}`)
          set({ data: d, selection: null, drawerOpen: false })
        },

        deleteWorkflow: async (workflowId: string) => {
          const d = await api.del(workflowId)
          const remaining = Object.keys(d.workflows || {})
          set({ data: d, activeWf: remaining[0] || null, selection: null, drawerOpen: false })

        },

        duplicateNode: async (workflowId: string, nodeId: string) => {
          const state = get()
          const wf = state.data?.workflows[workflowId]
          const node = wf?.nodes[nodeId]
          if (!node) return
          const newName = `${nodeId}-copy-${Date.now().toString(36)}`
          const content = node.primaryFile?.rawContent ?? `---\nname: ${newName}\n---\n# ${newName}\n`
          // Replace the name in frontmatter
          const updated = content.replace(
            /^(---[\s\S]*?name:\s*).*$/m,
            `$1${newName}`,
          )
          const d = await api.create(`${workflowId}/${newName}/main.md`, updated)
          set({ data: d })
        },

        getSelectedResource: (): ParsedFile | null => {
          const { data, selection } = get()
          if (!data || !selection || selection.type !== 'resource') return null
          // If category is provided, look up in the corresponding category map
          if (selection.category) {
            const entry = (data[selection.category] as Record<string, any>)?.[selection.key]
            if (!entry) return null
            // Already a ParsedFile (has relativePath)
            if (entry.relativePath) return entry as ParsedFile
            // Raw object (e.g. hooks JSON) — synthesize a ParsedFile
            const ext = selection.category === 'hooks' ? 'json' : 'md'
            const rawContent = typeof entry === 'string' ? entry : JSON.stringify(entry, null, 2)
            const frontmatter = typeof entry === 'object' && entry !== null ? { ...entry } : {}
            return { relativePath: `${selection.category}/${selection.key}.${ext}`, rawContent, name: selection.key, frontmatter, body: rawContent, refs: [], resourceType: selection.category.replace(/s$/, '') } as any
          }
          // No category — try allFiles then raw file map
          const found = data.allFiles?.find(f => f.relativePath === selection.key) ?? null
          if (found) return found
          const rawFile = (data as any)._rawFiles?.[selection.key]
          if (rawFile !== undefined) {
            return { relativePath: selection.key, rawContent: rawFile, name: selection.key.split('/').pop() || selection.key, frontmatter: {}, body: rawFile, refs: [] } as any
          }
          return null
        },

        getSelectedNode: (): NodeDef | null => {
          const { data, selection } = get()
          if (!data || !selection || selection.type !== 'node' || !selection.workflowId) return null
          return data.workflows[selection.workflowId]?.nodes[selection.key] ?? null
        },

        getSelectedWorkflow: (): WorkflowDef | null => {
          const { data, selection } = get()
          if (!data || !selection || selection.type !== 'workflow') return null
          return data.workflows[selection.key] ?? null
        },

        toggleDir: (path: string) => {
          const { expandedDirs } = get()
          const next = new Set(expandedDirs)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          set({ expandedDirs: next })
        },

        moveFile: async (from: string, to: string) => {
          const d = await api.move(from, to)
          set({ data: d })
          const tree = await api.getTree()
          set({ directoryTree: tree })
        },

        validate: async () => {
          const result = await api.validate()
          set({ validationResult: result })
          return result
        },

        setThemeMode: (mode: ThemeMode) => {
          const resolved = resolveTheme(mode)
          set({ themeMode: mode, resolvedTheme: resolved })
          safeStorage.setItem('af-theme', mode)
          document.documentElement.classList.toggle('dark', resolved === 'dark')
        },

        toggleDark: () => {
          const { themeMode } = get()
          const next: ThemeMode = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light'
          const resolved = resolveTheme(next)
          set({ themeMode: next, resolvedTheme: resolved })
          safeStorage.setItem('af-theme', next)
          document.documentElement.classList.toggle('dark', resolved === 'dark')
        },

        setThemePalette: (palette: ThemePaletteId) => {
          set({ themePalette: palette })
          safeStorage.setItem('af-palette', palette)
        },

        setLibrarySearch: (q: string) => set({ librarySearch: q }),

        loadLibrary: async () => {
          set({ libraryLoading: true })
          try {
            const result = await api.getLibrary()
            set({ libraryEntries: result.entries })
          } finally {
            set({ libraryLoading: false })
          }
        },

        addFromLibrary: async (type: string, name: string) => {
          const { importResource, importWorkflow } = await import('@/lib/library-client')
          const { files } = type === 'workflow' ? await importWorkflow(name) : await importResource(type, name)
          if (!files.length) throw new Error(`"${name}" not found in library`)
          const { requireWorkspace } = await import('@/lib/workspace')
          const ws = await requireWorkspace()
          // Write all files
          for (const f of files) {
            try { await ws.write(f.path, f.content) }
            catch (err) { console.warn(`[addFromLibrary] write failed: ${f.path}`, err) }
          }
          // Verify — retry any missing files
          const written = new Set(await ws.list())
          const missing = files.filter((f: any) => !written.has(f.path))
          if (missing.length > 0) {
            console.warn(`[addFromLibrary] ${missing.length} files missing after write, retrying...`)
            for (const f of missing) {
              try { await ws.write(f.path, f.content) }
              catch (err) { console.error(`[addFromLibrary] retry failed: ${f.path}`, err) }
            }
          }
          await get().reload()
        },

        toggleLibraryPanel: () => set(s => ({ libraryPanelOpen: !s.libraryPanelOpen })),
        toggleResourcePalette: () => set(s => {
          // In docked mode, open explorer to Elements tab instead of floating panel
          if (s.panelMode === 'docked') {
            if (s.explorerOpen && s.explorerTab === 'elements') {
              // Already showing elements — close explorer
              return { explorerOpen: false }
            }
            return { explorerOpen: true, explorerTab: 'elements' as const }
          }
          // Floating mode: toggle the floating resource palette
          const opening = !s.resourcePaletteOpen
          // On narrow viewports, close the drawer to avoid overlap
          if (opening && s.drawerOpen && (typeof window !== 'undefined' ? window.innerWidth : 1920) < 1440) {
            return { resourcePaletteOpen: true, drawerOpen: false }
          }
          return { resourcePaletteOpen: opening }
        }),
        toggleExplorer: () => {
          const { panels, explorerOpen } = get()
          const next = !explorerOpen
          const updated = { ...panels, explorer: { ...panels.explorer, open: next } }
          set({ explorerOpen: next, panels: updated })
          savePanelStates(updated)
        },
        setExplorerTab: (tab) => set({ explorerTab: tab }),

        setDrawerOpen: (open: boolean) => {
          const { panels, resourcePaletteOpen } = get()
          const updates: Record<string, unknown> = { drawerOpen: open }
          if (open && resourcePaletteOpen && (typeof window !== 'undefined' ? window.innerWidth : 1920) < 1440) {
            updates.resourcePaletteOpen = false
          }
          // Sync with panel registry
          const updated = { ...panels, details: { ...panels.details, open } }
          updates.panels = updated
          set(updates as any)
          savePanelStates(updated)
        },
        setDrawerTab: (tab) => set({ drawerTab: tab }),

        setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),

        setZoomLevel: (level: number) => set({ zoomLevel: level }),

        setMinimapCollapsed: (collapsed: boolean) => {
          set({ minimapCollapsed: collapsed })
          safeStorage.setItem('af-minimap-collapsed', String(collapsed))
        },

        showNotification: (msg: string, type: NotificationType = 'info', action?: NotificationAction) => {
          const opts: Record<string, unknown> = {}
          if (action) {
            opts.action = { label: action.label, onClick: action.onClick }
          }
          if (type === 'error') toast.error(msg, opts)
          else if (type === 'warning') toast.warning(msg, opts)
          else if (type === 'success') toast.success(msg, opts)
          else toast.info(msg, opts)
        },

        dismissNotification: (id: string) => {
          set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }))
          const timer = notificationTimers.get(id)
          if (timer) {
            clearTimeout(timer)
            notificationTimers.delete(id)
          }
        },

        setPendingDrop: (drop: PendingDrop | null) => set({ pendingDrop: drop }),

        togglePanelMode: () => {
          const next = get().panelMode === 'docked' ? 'floating' : 'docked'
          set({ panelMode: next })
          safeStorage.setItem('af-panel-mode', next)
        },

        setPanelMode: (mode: PanelMode) => {
          set({ panelMode: mode })
          safeStorage.setItem('af-panel-mode', mode)
        },

        setLeftPanelCollapsed: (collapsed: boolean) => set({ leftPanelCollapsed: collapsed }),
        setRightPanelCollapsed: (collapsed: boolean) => set({ rightPanelCollapsed: collapsed }),
        toggleLeftPanel: () => set(s => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
        toggleRightPanel: () => set(s => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),

        // ── Panel registry actions ──────────────────────────────────────

        togglePanel: (id: string) => {
          const { panels } = get()
          const panel = panels[id]
          if (!panel) return
          const next = { ...panels, [id]: { ...panel, open: !panel.open } }
          set({ panels: next })
          savePanelStates(next)
          // Sync legacy state for backward compat
          if (id === 'explorer') set({ explorerOpen: !panel.open })
          if (id === 'details') set({ drawerOpen: !panel.open })
        },

        openPanel: (id: string) => {
          const { panels } = get()
          const panel = panels[id]
          if (!panel) return
          const next = { ...panels, [id]: { ...panel, open: true } }
          set({ panels: next })
          savePanelStates(next)
          if (id === 'explorer') set({ explorerOpen: true })
          if (id === 'details') set({ drawerOpen: true })
        },

        closePanel: (id: string) => {
          const { panels } = get()
          const panel = panels[id]
          if (!panel) return
          const next = { ...panels, [id]: { ...panel, open: false } }
          set({ panels: next })
          savePanelStates(next)
          if (id === 'explorer') set({ explorerOpen: false })
          if (id === 'details') set({ drawerOpen: false })
        },

        setPanelDock: (id: string, dock: DockPosition) => {
          const { panels } = get()
          const panel = panels[id]
          if (!panel) return
          const next = { ...panels, [id]: { ...panel, dock } }
          set({ panels: next })
          savePanelStates(next)
        },

        setPanelSize: (id: string, w: number, h: number) => {
          const { panels } = get()
          const panel = panels[id]
          if (!panel) return
          const next = { ...panels, [id]: { ...panel, width: w, height: h } }
          set({ panels: next })
          savePanelStates(next)
        },

        setPanelFloatPos: (id: string, x: number, y: number) => {
          const { panels } = get()
          const panel = panels[id]
          if (!panel) return
          const next = { ...panels, [id]: { ...panel, floatPosition: { x, y } } }
          set({ panels: next })
          savePanelStates(next)
        },

        duplicateResourceToNode: async (category: ResourceCategory, name: string, targetNodeId: string, targetWorkflowId: string) => {
          const { data } = get()
          if (!data) return
          const wf = data.workflows[targetWorkflowId]
          if (!wf) return
          const targetNode = wf.nodes[targetNodeId]
          if (!targetNode) return
          const refSyntax = `{{${category}/${name}}}`
          const raw = targetNode.primaryFile.rawContent
          // Don't add if already referenced
          if (raw.includes(refSyntax)) {
            get().showNotification(`${name} is already referenced in ${targetNodeId}`, 'warning')
            return
          }
          const newContent = raw.trimEnd() + `\n${refSyntax}\n`
          await get().save(targetNode.primaryFile.relativePath, newContent)
          await get().reload()
          get().showNotification(`Added ${name} to ${targetNodeId}`, 'info')
        },

        undo: () => {
          useAppStore.temporal.getState().undo()
        },

        redo: () => {
          useAppStore.temporal.getState().redo()
        },

        openFocus: (target: FocusTarget) => {
          set({ focusTarget: target })
        },

        closeFocus: () => {
          set({ focusTarget: null })
        },

        // ── Git actions ─────────────────────────────────────────────────

        fetchGitStatus: async () => {
          try {
            await gitApi.getStatus()
            const configResult = await gitApi.getConfig()
            const conflicts = await gitApi.getConflicts()
            set({
              repos: configResult.repos,
              pendingConflicts: conflicts,
              syncStatus: conflicts.length > 0 ? 'conflicts' : 'idle',
            })
          } catch {
            set({ syncStatus: 'error' })
          }
        },

        triggerSync: async (params) => {
          set({ syncStatus: 'syncing' })
          try {
            const result = await gitApi.sync(params ?? {})
            set({
              syncStatus: result.conflicts.length > 0 ? 'conflicts' : 'idle',
              pendingConflicts: result.conflicts,
            })
            get().showNotification(
              `Sync complete: ${result.filesAdded.length} added, ${result.filesModified.length} modified`,
              'success',
            )
          } catch {
            set({ syncStatus: 'error' })
            get().showNotification('Sync failed', 'error')
          }
        },

        triggerScan: async (params) => {
          try {
            const result = await gitApi.scan(params)
            set({ lastScanResult: result })
            get().showNotification(
              `Scan found ${result.stats.totalResources} resources, ${result.stats.totalWorkflows} workflows`,
              'success',
            )
          } catch {
            get().showNotification('Scan failed', 'error')
          }
        },

        connectRepo: async (params) => {
          try {
            const { cloneAndList } = await import('@/lib/git-client')
            const token = localStorage.getItem('af-git-token') || undefined
            const { files } = await cloneAndList(params.url, { branch: params.branch || 'main', token })
            if (!files.length) throw new Error('Repository is empty')
            // Write files to workspace
            const { requireWorkspace } = await import('@/lib/workspace')
            const ws = await requireWorkspace()
            for (const f of files) {
              try { await ws.write(f.path, f.content) } catch {}
            }
            set(s => ({
              repos: [...s.repos, { name: params.name, url: params.url, branch: params.branch, localPath: '/', repoType: params.repoType, role: params.role, agentflowPath: '.agentflow' }],
            }))
            get().showNotification(`Cloned "${params.name}" — ${files.length} files`, 'success')
            await get().reload()
          } catch (err: any) {
            throw err // let caller handle
          }
        },

        resolveConflict: async (path, strategy) => {
          try {
            await gitApi.resolve({ path, strategy })
            set(s => ({
              pendingConflicts: s.pendingConflicts.filter(c => c.path !== path),
              syncStatus: s.pendingConflicts.length <= 1 ? 'idle' : 'conflicts',
            }))
            get().showNotification(`Resolved conflict: ${path}`, 'success')
          } catch {
            get().showNotification(`Failed to resolve conflict: ${path}`, 'error')
          }
        },
      }
    },
    {
      // zundo temporal middleware configuration
      limit: 50,
      partialize: (state): DomainState => ({
        data: state.data,
        activeWf: state.activeWf,
        selection: state.selection,
        viewFilter: state.viewFilter,
        breadcrumbs: state.breadcrumbs,
      }),
      handleSet: (handleSet) => {
        // Debounce rapid edits (500ms) into single undo entries
        let timer: ReturnType<typeof setTimeout> | undefined
        return (state) => {
          clearTimeout(timer)
          timer = setTimeout(() => handleSet(state), 500)
        }
      },
    },
  ),
)

// ── Granular selector hooks ─────────────────────────────────────────────

/** All nodes in the active workflow */
export const useNodes = () =>
  useAppStore((s) => (s.activeWf && s.data?.workflows[s.activeWf]?.nodes) ?? {})

/** The currently selected node (if selection is a node) */
export const useSelectedNode = () =>
  useAppStore((s) => {
    if (!s.data || !s.selection || s.selection.type !== 'node' || !s.selection.workflowId) return null
    return s.data.workflows[s.selection.workflowId]?.nodes[s.selection.key] ?? null
  })

/** Current theme mode setting */
export const useThemeMode = () => useAppStore((s) => s.themeMode)

/** Whether undo is available */
export const useCanUndo = () =>
  useZustandStore(useAppStore.temporal, (s) => s.pastStates.length > 0)

/** Whether redo is available */
export const useCanRedo = () =>
  useZustandStore(useAppStore.temporal, (s) => s.futureStates.length > 0)

// ── Backward-compatible useStore hook ───────────────────────────────────
// Provides the same API shape as the old Context-based useStore() so
// existing components continue to work without changes.

interface LegacyStore extends Omit<AppStore, 'drawerOpen' | 'drawerTab' | 'commandPaletteOpen' | 'zoomLevel' | 'minimapCollapsed' | 'setDrawerOpen' | 'setDrawerTab' | 'setCommandPaletteOpen' | 'setZoomLevel' | 'setMinimapCollapsed' | 'undo' | 'redo' | 'openFocus' | 'closeFocus'> {
  /** @deprecated Use resolvedTheme === 'dark' instead */
  dark: boolean
  // Undo/redo and new drawer/palette actions are available but not in legacy shape
  undo: () => void
  redo: () => void
  drawerOpen: boolean
  drawerTab: 'content' | 'properties' | 'references' | 'preview'
  commandPaletteOpen: boolean
  zoomLevel: number
  minimapCollapsed: boolean
  setDrawerOpen: (open: boolean) => void
  setDrawerTab: (tab: 'content' | 'properties' | 'references' | 'preview') => void
  setCommandPaletteOpen: (open: boolean) => void
  setZoomLevel: (level: number) => void
  setMinimapCollapsed: (collapsed: boolean) => void
  openFocus: (target: FocusTarget) => void
  closeFocus: () => void
  focusTarget: FocusTarget | null
}

/**
 * Backward-compatible hook matching the old Context API `useStore()`.
 * Adds the derived `dark` boolean for components that still use it.
 * No React Context provider needed — works via direct Zustand subscription.
 */
export const useStore = (): LegacyStore => {
  const store = useAppStore()
  return {
    ...store,
    dark: store.resolvedTheme === 'dark',
  }
}

// ── Initialize store on module load ─────────────────────────────────────
// Only auto-load if welcomed (workspace already chosen)
if (typeof window !== 'undefined' && localStorage.getItem('af-welcomed') === 'true') {
  useAppStore.getState().reload().catch(() => {
    useAppStore.setState({ loading: false })
  })
} else if (typeof window !== 'undefined') {
  // Try loading anyway — if server has data (CLI mode), use it
  useAppStore.getState().reload().catch(() => {
    useAppStore.setState({ loading: false })
  })
}

// Listen for OS color scheme changes when in system mode
if (typeof window !== 'undefined') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  mql.addEventListener('change', () => {
    const { themeMode } = useAppStore.getState()
    if (themeMode === 'system') {
      const resolved = resolveTheme('system')
      useAppStore.setState({ resolvedTheme: resolved })
      document.documentElement.classList.toggle('dark', resolved === 'dark')
    }
  })
}

// ── No-op StoreProvider for backward compatibility ──────────────────────
// Zustand doesn't need a React Context provider. This passthrough component
// keeps existing <StoreProvider> usage in App.tsx working without changes.
export function StoreProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  return children
}
