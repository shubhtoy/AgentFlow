'use client'

import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import {
  ChevronRight, Download, Library, GripVertical, Check,
  Server, Loader2, Search, X, Workflow, LayoutGrid, LayoutList,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { getCategoryConfig, RESOURCE_CATEGORIES } from '@/lib/constants'
import type { ResourceCategory, ParsedFile, LibraryEntry } from '@/lib/types'

const PALETTE_CATEGORIES = RESOURCE_CATEGORIES
type SourceFilter = 'all' | 'workflow' | 'library'

interface MCPTool { name: string; description: string; server: string }

interface UnifiedItem {
  name: string; category: string; description?: string; source: 'workspace' | 'library' | 'mcp'
  file?: ParsedFile; entry?: LibraryEntry; server?: string; draggable?: boolean
}

function setDragData(e: React.DragEvent, item: UnifiedItem) {
  e.stopPropagation()
  if (item.category === 'workflows') {
    e.dataTransfer.setData('application/agentflow-workflow', JSON.stringify({ id: item.name, name: item.name }))
  } else if (item.source === 'library' && item.entry) {
    e.dataTransfer.setData('application/agentflow-library', JSON.stringify({ type: 'library-item', name: item.entry.name, entryType: item.entry.type }))
  } else {
    e.dataTransfer.setData('application/agentflow-resource', JSON.stringify({ type: 'resource-palette', category: item.category, name: item.name, ...(item.file ? { filePath: item.file.filePath } : {}) }))
  }
  e.dataTransfer.effectAllowed = 'copy'
}

// ── Section group (matches Layers style) ────────────────────────────────

function SectionGroup({ label, count, icon: Icon, color, children }: {
  label: string; count?: number
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color?: string; children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1.5 hover:bg-accent/40 rounded-md transition-colors group/trigger">
        <ChevronRight size={12} className="text-muted-foreground/50 shrink-0 transition-transform duration-150 group-data-[state=open]/trigger:rotate-90" />
        {Icon && (
          <span className="flex items-center justify-center size-5 rounded shrink-0" style={{ backgroundColor: color ? `${color}18` : undefined }}>
            <Icon size={12} style={{ color }} />
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">{label}</span>
        {count != null && (
          <Badge variant="secondary" className="h-4 min-w-[20px] justify-center text-[9px] font-medium px-1 bg-muted/60">{count}</Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-2 pl-2 border-l border-border/30 space-y-px py-0.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Item row (matches Layers style + drag + source badge) ───────────────

const ItemRow = memo(function ItemRow({ item, icon: ItemIcon, color, onInstall, installed }: {
  item: UnifiedItem
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color?: string; onInstall?: (entry: LibraryEntry) => void; installed?: boolean
}) {
  const canDrag = item.draggable !== false
  const handleDragStart = useCallback((e: React.DragEvent) => setDragData(e, item), [item])

  const sourceLabel = item.source === 'mcp' ? item.server : null; const isBuiltin = item.source === 'library' && (item.entry as any)?.builtin

  return (
    <div className="relative group/item">
      <div
        draggable={canDrag}
        onDragStart={canDrag ? handleDragStart : undefined}
        className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-accent/50 ${
          canDrag ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        {ItemIcon && (
          <span className="flex items-center justify-center size-5 rounded shrink-0" style={{ backgroundColor: `${color}18` }}>
            <ItemIcon size={12} style={{ color }} />
          </span>
        )}
        <span className="truncate flex-1">{item.name}</span>
        {sourceLabel && <Badge variant="secondary" className="h-3.5 text-[8px] px-1 shrink-0">{sourceLabel}</Badge>}
        {isBuiltin && <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" title="Built-in" />}
        <span className="opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
          {item.source === 'library' && onInstall && item.entry && !installed && (
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <button className="p-0.5 rounded hover:bg-accent" onClick={e => { e.stopPropagation(); onInstall(item.entry!) }}>
                <Download size={11} className="text-muted-foreground" />
              </button>
            </TooltipTrigger><TooltipContent>Install to workspace</TooltipContent></Tooltip></TooltipProvider>
          )}
          {canDrag && <GripVertical size={10} className="text-muted-foreground/30" />}
        </span>
      </div>
    </div>
  )
})

// ── Block card (grid view) ───────────────────────────────────────────────

const BlockCard = memo(function BlockCard({ item, icon: ItemIcon, color, onInstall, installed }: {
  item: UnifiedItem
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color?: string; onInstall?: (entry: LibraryEntry) => void; installed?: boolean
}) {
  const canDrag = item.draggable !== false
  const handleDragStart = useCallback((e: React.DragEvent) => setDragData(e, item), [item])

  const sourceLabel = item.source === 'mcp' ? item.server : null; const isBuiltin = item.source === 'library' && (item.entry as any)?.builtin

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? handleDragStart : undefined}
      className={`group/block relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-border/40 hover:border-border hover:bg-accent/40 transition-all text-center ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      <span className="flex items-center justify-center size-8 rounded-lg" style={{ backgroundColor: `${color}15` }}>
        {ItemIcon ? <ItemIcon size={16} style={{ color }} /> : <Library size={16} className="text-muted-foreground" />}
      </span>
      <span className="text-[10px] font-medium leading-tight truncate w-full">{item.name}</span>
      {sourceLabel && <Badge variant="secondary" className="h-3.5 text-[8px] px-1">{sourceLabel}</Badge>}
      {isBuiltin && <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-primary/40" title="Built-in" />}
      {item.source === 'library' && onInstall && item.entry && !installed && (
        <button className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover/block:opacity-100 hover:bg-accent transition-opacity"
          onClick={e => { e.stopPropagation(); onInstall(item.entry!) }}>
          <Download size={10} className="text-muted-foreground" />
        </button>
      )}
    </div>
  )
})

// ── Main view ───────────────────────────────────────────────────────────

export const ElementsView = memo(function ElementsView() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const libraryEntries = useAppStore(s => s.libraryEntries)
  const libraryLoading = useAppStore(s => s.libraryLoading)
  const loadLibrary = useAppStore(s => s.loadLibrary)
  const addFromLibrary = useAppStore(s => s.addFromLibrary)
  const reload = useAppStore(s => s.reload)
  const showNotification = useAppStore(s => s.showNotification)
  const categoryConfig = useCategoryConfig()

  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('af-assets-view') as 'list' | 'grid') || 'grid'
    }
    return 'grid'
  })

  const toggleViewMode = useCallback(() => {
    setViewMode(v => {
      const next = v === 'list' ? 'grid' : 'list'
      localStorage.setItem('af-assets-view', next)
      return next
    })
  }, [])
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([])
  const [mcpLoading, setMcpLoading] = useState(false)

  useEffect(() => { loadLibrary() }, [loadLibrary])

  const loadMcpTools = useCallback(() => {
    setMcpLoading(true)
    fetch('/api/mcp/tools').then(r => r.ok ? r.json() : { tools: [] }).then(d => setMcpTools(d.tools || [])).catch(() => setMcpTools([])).finally(() => setMcpLoading(false))
  }, [])
  useEffect(() => { loadMcpTools() }, [loadMcpTools])
  useEffect(() => { const h = () => loadMcpTools(); window.addEventListener('mcp-tools-changed', h); return () => window.removeEventListener('mcp-tools-changed', h) }, [loadMcpTools])

  // All workspace resource names per category
  const wsNames = useMemo(() => {
    const result: Record<string, Set<string>> = {}
    for (const cat of PALETTE_CATEGORIES) result[cat] = new Set()
    if (!data) return result
    for (const cat of PALETTE_CATEGORIES) {
      const records = data[cat] as Record<string, ParsedFile> | undefined
      if (records) for (const name of Object.keys(records)) result[cat].add(name)
    }
    return result
  }, [data])

  // Resources referenced by the active workflow's nodes
  const activeWfRefs = useMemo(() => {
    const result: Record<string, Set<string>> = {}
    for (const cat of PALETTE_CATEGORIES) result[cat] = new Set()
    if (!data || !activeWf) return result
    const wf = data.workflows[activeWf]
    if (!wf) return result

    const addRef = (ref: { category?: string; name?: string; condition?: string }) => {
      const cat = ref.category as string
      const name = ref.name as string
      if (cat && name && result[cat]) result[cat].add(name)
      // Conditional edge conditions: "runbooks/design-approved"
      if (ref.condition && ref.condition.includes('/')) {
        const [condCat, condName] = ref.condition.split('/', 2)
        if (condCat && condName && result[condCat]) result[condCat].add(condName)
      }
    }

    for (const node of Object.values(wf.nodes)) {
      for (const ref of (node as any).allRefs || []) addRef(ref)
    }
    if (wf.descriptorFile) {
      for (const ref of (wf.descriptorFile as any).refs || []) addRef(ref)
    }
    return result
  }, [data, activeWf])

  // Build all items
  const { resourceItems, workflowItems } = useMemo(() => {
    const res: Record<string, UnifiedItem[]> = {}
    for (const cat of PALETTE_CATEGORIES) res[cat] = []
    const wfItems: UnifiedItem[] = []

    // Workspace resources
    if (data) {
      for (const cat of PALETTE_CATEGORIES) {
        const records = data[cat] as Record<string, ParsedFile> | undefined
        if (!records) continue
        for (const [name, file] of Object.entries(records)) {
          res[cat].push({ name, category: cat, description: (file.frontmatter?.description as string) ?? undefined, source: 'workspace', file })
        }
      }
    }

    // Library resources (non-workflow, not already in workspace)
    for (const entry of libraryEntries) {
      if (entry.type === 'workflow') {
        wfItems.push({ name: entry.name, category: 'workflows', description: entry.description, source: 'library', entry })
        continue
      }
      const TYPE_TO_CATEGORY: Record<string, string> = {
        skill: 'instructions', instruction: 'instructions',
        tool: 'capabilities', capability: 'capabilities',
        interaction: 'runbooks', runbook: 'runbooks', template: 'runbooks',
        memory: 'memory',
        hook: 'hooks',
      }
      const cat = TYPE_TO_CATEGORY[entry.type] || (entry.type.endsWith('s') ? entry.type : entry.type + 's')
      if (!res[cat]) continue
      if (wsNames[cat]?.has(entry.name)) continue
      res[cat].push({ name: entry.name, category: cat, description: entry.description, source: 'library', entry })
    }

    // MCP tools → capabilities
    for (const t of mcpTools) {
      res.capabilities.push({ name: t.name, category: 'capabilities', description: t.description, source: 'mcp', server: t.server })
    }

    // Workspace workflows
    if (data) {
      for (const [id, wf] of Object.entries(data.workflows)) {
        wfItems.push({ name: (wf as any).name || id, category: 'workflows', description: (wf as any).description, source: 'workspace' })
      }
    }

    return { resourceItems: res, workflowItems: wfItems }
  }, [data, libraryEntries, mcpTools, wsNames])

  // Filter: "workflow" = only resources referenced by active workflow, "library" = everything else, "all" = everything
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    const res: Record<string, UnifiedItem[]> = {}
    for (const [cat, items] of Object.entries(resourceItems)) {
      let list = items
      if (sourceFilter === 'workflow') {
        list = list.filter(i => i.source === 'workspace' && activeWfRefs[cat]?.has(i.name))
      } else if (sourceFilter === 'library') {
        // Everything NOT referenced by the active workflow: library items, MCP tools, and unreferenced workspace resources
        list = list.filter(i => i.source === 'library' || i.source === 'mcp' || (i.source === 'workspace' && !activeWfRefs[cat]?.has(i.name)))
      }
      if (q) list = list.filter(i => i.name.toLowerCase().includes(q) || (i.description?.toLowerCase().includes(q) ?? false))
      res[cat] = list
    }
    let wf = sourceFilter === 'all' || sourceFilter === 'library' ? workflowItems : []
    if (q) wf = wf.filter(i => i.name.toLowerCase().includes(q) || (i.description?.toLowerCase().includes(q) ?? false))
    return { resources: res, workflows: wf }
  }, [resourceItems, workflowItems, query, sourceFilter, activeWfRefs])

  const totalCount = useMemo(() =>
    Object.values(filtered.resources).reduce((s, items) => s + items.length, 0) + filtered.workflows.length,
  [filtered])

  const handleInstall = useCallback(async (entry: LibraryEntry) => {
    try {
      // Fetch files from library
      const res = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: entry.type, name: entry.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')

      // Write files to workspace (works with both server fs and OPFS)
      const { requireWorkspace } = await import('@/lib/workspace')
      const ws = await requireWorkspace()
      for (const f of data.files) await ws.write(f.path, f.content)

      await reload()
      showNotification(`Added "${entry.name}"`, 'success')
    } catch (err) {
      showNotification(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    }
  }, [reload, showNotification])

  return (
    <div className="flex flex-col h-full bg-card/50">
      <div className="p-2 pb-1.5 space-y-1.5">
        <div className="relative flex gap-1">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <Input placeholder="Filter…" value={query} onChange={e => setQuery(e.target.value)}
              className="h-7 pl-7 text-xs bg-background/60 border-border/50 focus-visible:ring-1 focus-visible:ring-ring/30" />
            {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12} /></button>}
          </div>
          <button onClick={toggleViewMode}
            className="flex items-center justify-center size-7 rounded-md border border-border/50 bg-background/60 hover:bg-accent transition-colors shrink-0">
            {viewMode === 'list' ? <LayoutGrid size={12} className="text-muted-foreground" /> : <LayoutList size={12} className="text-muted-foreground" />}
          </button>
        </div>
        <div className="flex w-full border border-border/50 rounded-md overflow-hidden">
          {([
            { key: 'all' as SourceFilter, label: 'All' },
            { key: 'workflow' as SourceFilter, label: 'In Use' },
            { key: 'library' as SourceFilter, label: 'Available' },
          ]).map(f => (
            <button key={f.key} onClick={() => setSourceFilter(f.key)}
              className={`flex-1 py-1 text-[10px] font-medium transition-colors ${sourceFilter === f.key ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground/50 px-0.5">
          {sourceFilter === 'all' ? 'All resources in your project and library' : sourceFilter === 'workflow' ? 'Resources used by the current workflow' : 'Library & MCP tools not yet in use'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-1 pb-4 space-y-0.5">
          {(libraryLoading || mcpLoading) && <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>}
          {totalCount === 0 && !libraryLoading && !mcpLoading ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <Library size={28} className="text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                {query ? 'No matches' : sourceFilter === 'workflow' ? 'No resources used by this workflow yet' : 'No elements'}
              </p>
              {sourceFilter === 'workflow' && (
                <button onClick={() => setSourceFilter('all')} className="text-[10px] text-primary hover:underline mt-1">Show all</button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ── Grid view ── */
            <div className="px-1.5 space-y-1">
              {PALETTE_CATEGORIES.map(cat => {
                const items = filtered.resources[cat] ?? []
                if (items.length === 0) return null
                const cfg = categoryConfig[cat]
                return (
                  <Collapsible key={cat} defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-1 py-1.5 hover:bg-accent/40 rounded-md transition-colors group/trigger">
                      <ChevronRight size={12} className="text-muted-foreground/50 shrink-0 transition-transform duration-150 group-data-[state=open]/trigger:rotate-90" />
                      {cfg?.icon && (
                        <span className="flex items-center justify-center size-4 rounded" style={{ backgroundColor: `${cfg.primaryColor}18` }}>
                          <cfg.icon size={10} style={{ color: cfg.primaryColor }} />
                        </span>
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">{cfg?.label || cat}</span>
                      <span className="text-[9px] text-muted-foreground/50">{items.length}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-3 gap-1.5 pt-1 pb-2">
                        {items.map(item => (
                          <BlockCard key={`${item.source}-${cat}-${item.name}`} item={item}
                            icon={item.source === 'mcp' ? Server : cfg?.icon} color={cfg?.primaryColor}
                            onInstall={handleInstall} installed={wsNames[cat]?.has(item.name)} />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
              {filtered.workflows.length > 0 && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-1 py-1.5 hover:bg-accent/40 rounded-md transition-colors group/trigger">
                    <ChevronRight size={12} className="text-muted-foreground/50 shrink-0 transition-transform duration-150 group-data-[state=open]/trigger:rotate-90" />
                    <span className="flex items-center justify-center size-4 rounded" style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}>
                      <Workflow size={10} style={{ color: 'hsl(var(--primary))' }} />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">Workflows</span>
                    <span className="text-[9px] text-muted-foreground/50">{filtered.workflows.length}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-3 gap-1.5 pt-1 pb-2">
                      {filtered.workflows.map(item => (
                        <BlockCard key={`lib-wf-${item.name}`} item={item} icon={Workflow} color="hsl(var(--primary))"
                          onInstall={handleInstall} installed={false} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ) : (
            <>
              {PALETTE_CATEGORIES.map(cat => {
                const items = filtered.resources[cat] ?? []
                if (items.length === 0) return null
                const cfg = categoryConfig[cat]

                // Split runbooks into Conditions and Interactions
                if (cat === 'runbooks') {
                  const conditions = items.filter(i => {
                    const fm = i.file?.frontmatter
                    const scope = (i.file as any)?.scope
                    return scope === 'condition' || fm?.type === 'condition'
                  })
                  const interactions = items.filter(i => {
                    const fm = i.file?.frontmatter
                    const scope = (i.file as any)?.scope
                    return scope !== 'condition' && fm?.type !== 'condition'
                  })
                  return (
                    <div key={cat}>
                      {conditions.length > 0 && (
                        <SectionGroup label="Conditions" count={conditions.length} icon={cfg?.icon} color={cfg?.primaryColor}>
                          {conditions.map(item => (
                            <ItemRow key={`${item.source}-${item.name}`} item={item}
                              icon={cfg?.icon} color={cfg?.primaryColor}
                              onInstall={handleInstall} installed={wsNames[cat]?.has(item.name)} />
                          ))}
                        </SectionGroup>
                      )}
                      {interactions.length > 0 && (
                        <SectionGroup label="Interactions" count={interactions.length} icon={cfg?.icon} color={cfg?.primaryColor}>
                          {interactions.map(item => (
                            <ItemRow key={`${item.source}-${item.name}`} item={item}
                              icon={cfg?.icon} color={cfg?.primaryColor}
                              onInstall={handleInstall} installed={wsNames[cat]?.has(item.name)} />
                          ))}
                        </SectionGroup>
                      )}
                    </div>
                  )
                }

                return (
                  <SectionGroup key={cat} label={cfg?.label || cat} count={items.length} icon={cfg?.icon} color={cfg?.primaryColor}>
                    {items.map((item, idx) => (
                      <ItemRow key={`${item.source}-${cat}-${item.name}-${idx}`} item={item}
                        icon={item.source === 'mcp' ? Server : cfg?.icon} color={cfg?.primaryColor}
                        onInstall={handleInstall} installed={wsNames[cat]?.has(item.name)} />
                    ))}
                  </SectionGroup>
                )
              })}
              {filtered.workflows.length > 0 && (
                <SectionGroup label="Workflows" count={filtered.workflows.length} icon={Workflow} color="hsl(var(--primary))">
                  {filtered.workflows.map(item => (
                    <ItemRow key={`lib-wf-${item.name}`} item={item} icon={Workflow} color="hsl(var(--primary))"
                      onInstall={handleInstall} installed={false} />
                  ))}
                </SectionGroup>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
})
