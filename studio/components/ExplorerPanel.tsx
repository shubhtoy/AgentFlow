'use client'

import React, { useState, useCallback, useMemo, useRef, memo } from 'react'
import {
  Search, FolderOpen, Folder, FileText, ChevronRight,
  Plus, Trash2, Copy, X, Pencil, ClipboardCopy, FolderPlus, AlertTriangle, Upload,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { getCategoryConfig, RESOURCE_CATEGORIES } from '@/lib/constants'
import { buildExplorerSections } from '../utils/buildExplorerSections'
import { api } from '@/lib/api'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from './ui/collapsible'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from './ui/tooltip'
import type { ExplorerItem, ResourceCategory, TreeNode as TreeNodeType } from '@/lib/types'
import { emit } from '@/utils/events'
import { useContextMenu, ContextMenuProvider, type MenuEntry } from './ui/context-menu'
import { FileDropZone } from './FileDropZone'
import type { ImportPreview } from '@/lib/import-files'

// ── Main panel ──────────────────────────────────────────────────────────

export function ExplorerPanel() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const selection = useAppStore(s => s.selection)
  const select = useAppStore(s => s.select)
  const setActiveWf = useAppStore(s => s.setActiveWf)
  const directoryTree = useAppStore(s => s.directoryTree)
  const toggleDir = useAppStore(s => s.toggleDir)
  const expandedDirs = useAppStore(s => s.expandedDirs)
  const selectFile = useAppStore(s => s.selectFile)
  const categoryConfig = useCategoryConfig()
  const reload = useAppStore(s => s.reload)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(true)
  const notify = useAppStore(s => s.showNotification)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(async (files: File[]) => {
    try {
      const { extractEntries, detectConflicts } = await import('@/lib/import-files')
      const { requireWorkspace } = await import('@/lib/workspace')
      const ws = await requireWorkspace()
      const { entries, skipped } = await extractEntries(files)
      if (entries.length === 0) { notify('No supported files found', 'error'); return }
      const preview = await detectConflicts(entries, ws)
      preview.skipped = skipped
      setImportPreview(preview)
    } catch (err: any) {
      notify(err?.message || 'Failed to read files', 'error')
    }
  }, [notify])

  const confirmImport = useCallback(async () => {
    if (!importPreview) return
    try {
      const { applyImport } = await import('@/lib/import-files')
      const { requireWorkspace } = await import('@/lib/workspace')
      const ws = await requireWorkspace()
      const count = await applyImport(importPreview.entries, ws)
      await reload()
      const msg = importPreview.skipped.length > 0
        ? `Imported ${count} files, ${importPreview.skipped.length} skipped`
        : `Imported ${count} files`
      notify(msg, 'success')
    } catch (err: any) {
      notify(err?.message || 'Import failed', 'error')
    } finally {
      setImportPreview(null)
    }
  }, [importPreview, reload, notify])

  const promptNewFile = useCallback(async (dir?: string) => {
    const name = prompt('File name:', 'new-file.md')
    if (!name?.trim()) return
    const base = dir || (activeWf ? `${activeWf}` : 'instructions')
    try { await api.create(`${base}/${name.trim()}`, `---\nname: ${name.trim().replace(/\.\w+$/, '')}\n---\n`); await reload() }
    catch { notify('Failed to create file', 'error') }
  }, [activeWf, reload, notify])

  const promptNewFolder = useCallback(async (dir?: string) => {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    const base = dir || (activeWf || '')
    const folderPath = `${base}/${name.trim()}`
    // Create folder with a default file — write() creates parent dirs automatically
    try { await api.create(`${folderPath}/SKILL.md`, `---\nname: ${name.trim()}\n---\n# ${name.trim()}\n`); await reload() }
    catch { notify('Failed to create folder', 'error') }
  }, [activeWf, reload, notify])

  const handleAdd = useCallback(async (category: ResourceCategory) => {
    if (category === 'hooks') {
      const name = `new-hook`
      const hook = {
        name,
        version: '1.0.0',
        description: '',
        event: 'fileEdited',
        action: { type: 'log', target: 'console', params: {} },
        enabled: false,
        priority: 100,
      }
      await api.create(`hooks/${name}.json`, JSON.stringify(hook, null, 2))
    } else {
      const name = `new-${category.replace(/s$/, '')}`
      await api.create(`${category}/${name}.md`, `---\nname: ${name}\n---\n`)
    }
    reload()
  }, [reload])

  const sections = useMemo(
    () => (data ? buildExplorerSections(data, activeWf, showAll) : []),
    [data, activeWf, showAll],
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return sections
    const q = query.toLowerCase()
    return sections
      .map(s => ({ ...s, items: s.items.filter((i: any) => i.name.toLowerCase().includes(q)) }))
      .filter(s => s.items.length > 0)
  }, [sections, query])

  const handleClick = useCallback(
    (item: ExplorerItem) => {
      if (item.type === 'workflow') {
        setActiveWf(item.id)
        select({ type: 'workflow', key: item.id })
      } else if (item.type === 'node') {
        select({ type: 'node', key: item.id, workflowId: item.workflowId })
      } else {
        const key = item.id.includes('/') ? item.id.split('/').slice(1).join('/') : item.id
        select({ type: 'resource', category: item.category, key })
      }
    },
    [select, setActiveWf],
  )

  const isActive = useCallback(
    (item: ExplorerItem) => {
      if (!selection) return false
      if (item.type === 'workflow') return selection.type === 'workflow' && selection.key === item.id
      if (item.type === 'node') return selection.type === 'node' && selection.key === item.id
      const key = item.id.includes('/') ? item.id.split('/').slice(1).join('/') : item.id
      return selection.type === 'resource' && selection.category === item.category && selection.key === key
    },
    [selection],
  )

  const SHARED_DIRS: Set<string> = new Set(RESOURCE_CATEGORIES)

  // Scope file tree to active workflow dir + shared resource dirs
  const scopedChildren = useMemo(() => {
    if (!directoryTree?.children) return []
    const children = directoryTree.children.filter(child => {
      if (child.type !== 'directory') return true
      // Always show shared resource dirs
      if (SHARED_DIRS.has(child.name)) return !activeWf ? true : true
      // When workspace view (null), hide workflow dirs
      if (!activeWf) return false
      // Show the active workflow dir
      if (child.name === activeWf) return true
      return false
    })
    // Filter by search query
    if (!query.trim()) return children
    const q = query.toLowerCase()
    const filterTree = (node: any): any | null => {
      if (node.type === 'file') return node.name.toLowerCase().includes(q) ? node : null
      const filtered = (node.children || []).map(filterTree).filter(Boolean)
      if (filtered.length > 0 || node.name.toLowerCase().includes(q)) return { ...node, children: filtered }
      return null
    }
    return children.map(filterTree).filter(Boolean)
  }, [directoryTree, activeWf, query])

  return (
    <ContextMenuProvider>
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col h-full bg-card/50 relative">
      {/* Drop overlay — appears when dragging files over explorer */}
      <FileDropZone overlay onFiles={handleDrop} />

      {/* Import preview — shown after drop, before confirm */}
      {importPreview && (
        <div className="absolute inset-0 z-40 bg-card/95 backdrop-blur-sm flex flex-col p-3 gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Upload size={13} /> Import {importPreview.entries.length} files
            </span>
            <button onClick={() => setImportPreview(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <ScrollArea className="flex-1 -mx-1 px-1">
            <div className="space-y-0.5">
              {importPreview.entries.map(e => (
                <div key={e.path} className="flex items-center gap-1.5 text-[11px] py-0.5 px-1 rounded">
                  <FileText size={11} className="shrink-0 text-muted-foreground/50" />
                  <span className="truncate flex-1">{e.path}</span>
                  {importPreview.conflicts.includes(e.path) && (
                    <span className="flex items-center gap-0.5 text-amber-500 shrink-0">
                      <AlertTriangle size={10} />
                      <span className="text-[9px]">overwrite</span>
                    </span>
                  )}
                </div>
              ))}
              {importPreview.skipped.map(s => (
                <div key={s} className="flex items-center gap-1.5 text-[11px] py-0.5 px-1 rounded text-muted-foreground/50 line-through">
                  <FileText size={11} className="shrink-0" />
                  <span className="truncate">{s}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          {importPreview.conflicts.length > 0 && (
            <p className="text-[10px] text-amber-500/80 flex items-center gap-1">
              <AlertTriangle size={10} /> {importPreview.conflicts.length} file{importPreview.conflicts.length > 1 ? 's' : ''} will be overwritten
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setImportPreview(null)}>Cancel</Button>
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={confirmImport}>Import</Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-2 pb-1.5">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Filter files…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-7 pl-7 text-xs bg-background/60 border-border/50 focus-visible:ring-1 focus-visible:ring-ring/30"
          />
          {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12} /></button>}
        </div>
        {activeWf ? (
          <p className="text-[9px] text-muted-foreground/50 px-0.5 mt-1">Showing: {activeWf}</p>
        ) : (
          <p className="text-[9px] text-muted-foreground/50 px-0.5 mt-1">Showing: Workspace</p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 pb-1.5">
        <Tooltip><TooltipTrigger asChild>
          <button onClick={() => promptNewFile()} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            <FileText size={13} />
          </button>
        </TooltipTrigger><TooltipContent side="bottom" className="text-[10px]">New File</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild>
          <button onClick={() => promptNewFolder()} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            <FolderPlus size={13} />
          </button>
        </TooltipTrigger><TooltipContent side="bottom" className="text-[10px]">New Folder</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild>
          <button onClick={() => fileInputRef.current?.click()} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            <Upload size={13} />
          </button>
        </TooltipTrigger><TooltipContent side="bottom" className="text-[10px]">Import Files</TooltipContent></Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={e => { if (e.target.files?.length) { handleDrop(Array.from(e.target.files)); e.target.value = '' } }}
        />
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="px-1 pb-4 space-y-0.5">
          {/* Workflow identity (active workflow's AGENTS.md) */}
          {/* File tree */}
          {scopedChildren.length > 0 ? (
            scopedChildren.map((child: any) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={0}
                expandedDirs={expandedDirs}
                toggleDir={toggleDir}
                selectFile={selectFile}
                catConfig={categoryConfig}
                promptNewFile={promptNewFile}
                promptNewFolder={promptNewFolder}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 gap-3">
              <FileDropZone
                onFiles={handleDrop}
                className="w-full"
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
    </TooltipProvider>
    </ContextMenuProvider>
  )
}

/** Builds context menu items for a file/folder path */
function useFileMenu() {
  const { show } = useContextMenu()
  const reload = useAppStore(s => s.reload)
  const notify = useAppStore(s => s.showNotification)

  return useCallback((e: React.MouseEvent, path: string, isDir: boolean) => {
    const name = path.substring(path.lastIndexOf('/') + 1)
    const dir = path.substring(0, path.lastIndexOf('/') + 1)
    const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : ''
    const base = ext ? path.slice(0, -ext.length) : path

    show(e, [
      { label: 'Rename', icon: Pencil, onClick: async () => {
        const newName = prompt('Rename to:', name)
        if (!newName?.trim() || newName === name) return
        try { await api.move(path, `${dir}${newName.trim()}`); await reload(); notify('Renamed', 'success') }
        catch { notify('Rename failed', 'error') }
      }},
      { label: 'Duplicate', icon: Copy, hidden: isDir, onClick: async () => {
        try {
          const content = await (await import('@/lib/workspace')).requireWorkspace().then(ws => ws.read(path)).catch(() => '')
          await api.create(`${base}-copy${ext}`, content); await reload(); notify('Duplicated', 'success')
        } catch { notify('Duplicate failed', 'error') }
      }},
      { label: 'Copy Path', icon: ClipboardCopy, onClick: () => {
        navigator.clipboard.writeText(path).catch(() => {})
        notify('Path copied', 'info')
      }},
      { separator: true },
      { label: 'Delete', icon: Trash2, destructive: true, onClick: async () => {
        if (!confirm(`Delete "${name}"?`)) return
        try { await api.del(path); await reload(); notify('Deleted', 'info') }
        catch { notify('Delete failed', 'error') }
      }},
    ])
  }, [show, reload, notify])
}

// ── Explorer item with context menu ─────────────────────────────────────

function ExplorerItemRow({
  item, active, icon: ItemIcon, color, onClick,
}: {
  item: ExplorerItem; active: boolean
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color?: string; onClick: () => void
}) {
  const ext = item.category === 'hooks' ? 'json' : 'md'
  const key = item.id.includes('/') ? item.id.split('/').slice(1).join('/') : item.id
  const filePath = `${item.category}/${key}.${ext}`
  const showMenu = useFileMenu()

  return (
    <button onClick={onClick} onContextMenu={e => showMenu(e, filePath, false)}
      className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
        active ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground/80 hover:bg-accent/50'
      }`}>
      {ItemIcon && (
        <span className="flex items-center justify-center size-5 rounded shrink-0" style={{ backgroundColor: `${color}18` }}>
          <ItemIcon size={12} style={{ color }} />
        </span>
      )}
      <span className="truncate flex-1">{item.name}</span>
    </button>
  )
}

// ── Collapsible section ─────────────────────────────────────────────────

function SectionGroup({
  label, count, icon: Icon, color, tooltip, ecosystemHint, onAdd, children,
}: {
  label: string; count?: number
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color?: string; tooltip?: string; ecosystemHint?: string; onAdd?: () => void; children: React.ReactNode
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
        {(tooltip || ecosystemHint) && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="opacity-0 group-hover/trigger:opacity-60 transition-opacity text-muted-foreground cursor-help px-0.5 shrink-0 text-[10px]"
                  onClick={e => e.stopPropagation()}
                >?</span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px] text-[11px] leading-snug">
                {tooltip && <p>{tooltip}</p>}
                {ecosystemHint && <p className="text-muted-foreground mt-0.5">{ecosystemHint}</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onAdd && (
          <span onClick={e => { e.stopPropagation(); onAdd() }} className="opacity-0 group-hover/trigger:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0">
            <Plus size={13} />
          </span>
        )}
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

// ── File tree node ──────────────────────────────────────────────────────

/** Map folder/file resourceType or name to a category config key */
function getCategoryKey(node: TreeNodeType): string | null {
  if (node.resourceType) {
    const map: Record<string, string> = {
      instruction: 'instructions', capability: 'capabilities', runbook: 'runbooks',
      memory: 'memory', hook: 'hooks', node: 'nodes', agents: 'workflows',
    }
    return map[node.resourceType] ?? null
  }
  // Fallback: match folder name
  const nameMap: Record<string, string> = {
    instructions: 'instructions', capabilities: 'capabilities', runbooks: 'runbooks',
    memory: 'memory', hooks: 'hooks', workflows: 'workflows',
  }
  return nameMap[node.name] ?? null
}

const FileTreeNode = memo(function FileTreeNode({
  node, depth, expandedDirs, toggleDir, selectFile, catConfig, promptNewFile, promptNewFolder,
}: {
  node: TreeNodeType; depth: number; expandedDirs: Set<string>
  toggleDir: (path: string) => void; selectFile: (path: string) => void
  catConfig: ReturnType<typeof getCategoryConfig>
  promptNewFile: (dir?: string) => void; promptNewFolder: (dir?: string) => void
}) {
  const isDir = node.type === 'directory'
  const isOpen = expandedDirs.has(node.path)
  const catKey = getCategoryKey(node)
  const cfg = catKey ? catConfig[catKey] : null
  const showMenu = useFileMenu()

  if (isDir) {
    const DirIcon = cfg?.icon ?? (isOpen ? FolderOpen : Folder)
    const dirColor = cfg?.primaryColor ?? undefined
    return (
      <div>
        <div className="group/dir flex items-center">
          <button
            onClick={() => toggleDir(node.path)}
            onContextMenu={e => showMenu(e, node.path, true)}
            className="flex items-center gap-1.5 flex-1 text-left px-2 py-1 hover:bg-accent/50 rounded-md text-xs transition-colors"
            style={{ paddingLeft: 8 + depth * 14 }}
          >
            <ChevronRight size={11} className={`text-muted-foreground/50 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
            <span className="flex items-center justify-center size-5 rounded shrink-0"
              style={dirColor ? { backgroundColor: `${dirColor}18` } : undefined}>
              <DirIcon size={13} style={dirColor ? { color: dirColor } : undefined}
                className={dirColor ? '' : isOpen ? 'text-amber-500/70' : 'text-muted-foreground/60'} />
            </span>
            <span className="truncate flex-1">{node.name}</span>
            {node.children && <span className="text-[9px] text-muted-foreground/40 shrink-0 group-hover/dir:hidden">{node.children.length}</span>}
          </button>
          <span className="hidden group-hover/dir:flex items-center gap-0.5 pr-1 shrink-0">
            <span onClick={() => promptNewFile(node.path)} className="p-0.5 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground"><FileText size={11} /></span>
            <span onClick={() => promptNewFolder(node.path)} className="p-0.5 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground"><FolderPlus size={11} /></span>
          </span>
        </div>
        {isOpen && node.children?.map(child => (
          <FileTreeNode key={child.path} node={child} depth={depth + 1} expandedDirs={expandedDirs} toggleDir={toggleDir} selectFile={selectFile} catConfig={catConfig} promptNewFile={promptNewFile} promptNewFolder={promptNewFolder} />
        ))}
      </div>
    )
  }

  const FileIcon = cfg?.icon ?? FileText
  const fileColor = cfg?.primaryColor ?? undefined

  return (
    <button
      onClick={() => node.path.startsWith('hooks/') ? emit('agentflow:show-protocols') : selectFile(node.path)}
      onContextMenu={e => showMenu(e, node.path, false)}
      className="flex items-center gap-1.5 w-full text-left px-2 py-1 hover:bg-accent/50 rounded-md text-xs transition-colors text-foreground/70 hover:text-foreground"
      style={{ paddingLeft: 8 + depth * 14 + 16 }}
    >
      <FileIcon size={12} style={fileColor ? { color: fileColor } : undefined}
        className={fileColor ? 'shrink-0' : 'text-muted-foreground/40 shrink-0'} />
      <span className="truncate">{node.name}</span>
    </button>
  )
})
