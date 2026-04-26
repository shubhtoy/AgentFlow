import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, ChevronRight,
  Library, GripHorizontal, Minus, Maximize2, GripVertical,
  Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppStore } from '@/store'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { getNarrativeScaffolding } from '../utils/narrative'
import { parseIOContract, checkCompatibility } from '../utils/compatibility'
import type { ResourceCategory, ParsedFile, LibraryEntry } from '@/lib/types'
import { HelpButton } from './HelpButton'

import { RESOURCE_CATEGORIES } from '@/lib/constants'
const PALETTE_CATEGORIES = RESOURCE_CATEGORIES
const PANEL_WIDTH = 360
const PANEL_HEIGHT = 540

interface UnifiedItem {
  name: string
  category: string
  description?: string
  source: 'workspace' | 'library'
  file?: ParsedFile
  entry?: LibraryEntry
}

/* ── UnifiedCard ── */
const UnifiedCard = memo(function UnifiedCard({
  item, onAdd,
}: { item: UnifiedItem; onAdd?: (entry: LibraryEntry) => void }) {
  const categoryConfig = useCategoryConfig()
  const isDark = document.documentElement.classList.contains('dark')
  const cfg = categoryConfig[item.category] ?? categoryConfig.customFiles
  const Icon: LucideIcon = cfg?.icon ?? categoryConfig.nodes.icon
  const color = cfg?.primaryColor ?? 'var(--node-step)'
  const isLibrary = item.source === 'library'

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    if (isLibrary && item.entry) {
      e.dataTransfer.setData('application/agentflow-library', JSON.stringify({
        type: 'library-item', name: item.entry.name, entryType: item.entry.type,
      }))
    } else if (item.file) {
      e.dataTransfer.setData('application/agentflow-resource', JSON.stringify({
        type: 'resource-palette', category: item.category, name: item.name, filePath: item.file.filePath,
      }))
    }
    e.dataTransfer.effectAllowed = 'copy'
  }, [item, isLibrary])

  return (
    <div draggable onDragStart={handleDragStart}
      className={cn(
        'group rounded-xl border overflow-hidden cursor-grab transition-all',
        'hover:-translate-y-0.5 hover:shadow-lg active:cursor-grabbing active:scale-[0.98]',
        isDark ? 'bg-card/50 border-border/50 hover:border-border' : 'bg-card border-border/60 hover:border-border',
      )}>
      {/* Accent top bar */}
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

      <div className="px-2.5 py-2 flex items-start gap-2">
        <div className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center border"
          style={{ backgroundColor: `${color}12`, borderColor: `${color}20` }}>
          <Icon size={13} style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-semibold truncate">{item.name}</span>
            {isLibrary && (
              <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-muted" style={{ color }}>Library</span>
            )}
          </div>
          <span className="text-[11px] block leading-tight" style={{ color }}>
            {cfg?.label ?? item.category}
          </span>
          {item.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
              {item.description}
            </p>
          )}
          {isLibrary && item.entry && item.entry.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {item.entry.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[9px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isLibrary && onAdd && item.entry && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={e => { e.stopPropagation(); e.preventDefault(); onAdd(item.entry!) }}
                    className="p-1 rounded hover:bg-accent transition-colors" style={{ color }}>
                    <Download size={12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Add to workspace</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <GripVertical size={11} className="opacity-25 mt-0.5" />
        </div>
      </div>
    </div>
  )
})

/* ── CategoryGroup ── */
const CategoryGroup = memo(function CategoryGroup({
  category, items, onAdd, defaultExpanded = true,
}: { category: string; items: UnifiedItem[]; onAdd: (entry: LibraryEntry) => void; defaultExpanded?: boolean }) {
  const categoryConfig = useCategoryConfig()
  const cfg = categoryConfig[category] ?? categoryConfig.customFiles
  const Icon: LucideIcon = cfg?.icon ?? categoryConfig.nodes.icon
  const color = cfg?.primaryColor ?? 'var(--node-step)'
  const wsCount = items.filter(i => i.source === 'workspace').length
  const libCount = items.filter(i => i.source === 'library').length

  if (items.length === 0) return null

  return (
    <Collapsible defaultOpen={defaultExpanded} className="mb-1">
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1 rounded-md hover:bg-accent transition-colors">
        <ChevronRight size={13} className="text-muted-foreground transition-transform data-[state=open]:rotate-90" />
        <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}>
          <Icon size={11} style={{ color }} />
        </div>
        <span className="text-xs font-semibold flex-1 text-left" style={{ color }}>
          {cfg?.label ?? category}
        </span>
        <div className="flex gap-1">
          {wsCount > 0 && (
            <span className="text-[9px] font-bold min-w-[18px] h-[18px] rounded flex items-center justify-center px-1"
              style={{ backgroundColor: `${color}15`, color }}>{wsCount}</span>
          )}
          {libCount > 0 && (
            <span className="text-[9px] font-semibold min-w-[18px] h-[18px] rounded border flex items-center justify-center px-1 text-muted-foreground"
              style={{ borderColor: `${color}30` }}>+{libCount}</span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1 px-1 pt-1">
          {items.map(item => (
            <UnifiedCard key={`${item.source}-${item.category}/${item.name}`} item={item} onAdd={onAdd} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})

/* ── Drop handler utilities (preserved) ── */

export function handleResourceDropOnNode(
  resource: { category: ResourceCategory; name: string; file: ParsedFile },
  targetNodeMarkdown: string,
  targetNodeFrontmatter: Record<string, unknown>,
  strict: boolean = false,
): { newContent: string; warnings: string[]; rejected: boolean } {
  const refPath = resource.category === 'customFiles'
    ? resource.name : `${resource.category}/${resource.name}`
  const refSyntax = `{{${refPath}}}`
  const sourceContract = parseIOContract(resource.file.frontmatter)
  const targetContract = parseIOContract(targetNodeFrontmatter)
  const result = checkCompatibility(sourceContract, targetContract, strict)
  if (!result.compatible) return { newContent: targetNodeMarkdown, warnings: result.mismatches, rejected: true }
  return { newContent: targetNodeMarkdown.trimEnd() + `\n${refSyntax}\n`, warnings: result.mismatches, rejected: false }
}

export function handleResourceDropOnEditor(
  resource: { category: ResourceCategory; name: string; file: ParsedFile },
): string {
  const scaffolding = getNarrativeScaffolding({ frontmatter: resource.file.frontmatter, category: resource.category })
  const refPath = resource.category === 'customFiles'
    ? resource.name : `${resource.category}/${resource.name}`
  const refSyntax = `{{${refPath}}}`
  const prefix = scaffolding.prefix ? `${scaffolding.prefix} ` : ''
  const suffix = scaffolding.suffix ? ` ${scaffolding.suffix}` : ''
  return `${prefix}${refSyntax}${suffix}`
}

export function handleResourceMove(
  resource: { category: ResourceCategory; name: string },
  sourceMarkdown: string,
  targetMarkdown: string,
): { newSourceContent: string; newTargetContent: string } {
  const refSyntax = `{{${resource.category}/${resource.name}}}`
  const escaped = refSyntax.replace(/[{}]/g, '\\$&')
  const removePattern = new RegExp(`\\n?${escaped}\\n?`, 'g')
  const newSourceContent = sourceMarkdown.replace(removePattern, '\n').replace(/\n{3,}/g, '\n\n')
  const newTargetContent = targetMarkdown.trimEnd() + `\n${refSyntax}\n`
  return { newSourceContent, newTargetContent }
}

/* ── ResourcePalette — unified floating panel ── */
export function ResourcePalette() {
  const resourcePaletteOpen = useAppStore(s => s.resourcePaletteOpen)
  const toggleResourcePalette = useAppStore(s => s.toggleResourcePalette)
  const data = useAppStore(s => s.data)
  const libraryEntries = useAppStore(s => s.libraryEntries)
  const libraryLoading = useAppStore(s => s.libraryLoading)
  const loadLibrary = useAppStore(s => s.loadLibrary)
  const addFromLibrary = useAppStore(s => s.addFromLibrary)
  const reload = useAppStore(s => s.reload)
  const showNotification = useAppStore(s => s.showNotification)

  const isDark = document.documentElement.classList.contains('dark')

  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [position, setPosition] = useState({ x: -1, y: 64 })
  const [size, setSize] = useState({ w: PANEL_WIDTH, h: PANEL_HEIGHT })
  const posRef = useRef(position)
  posRef.current = position

  useEffect(() => {
    if (resourcePaletteOpen) { loadLibrary(); setSearch('') }
  }, [resourcePaletteOpen, loadLibrary])

  const unifiedByCategory = useMemo(() => {
    const result: Record<string, UnifiedItem[]> = {}
    for (const cat of PALETTE_CATEGORIES) result[cat] = []

    if (data) {
      for (const cat of PALETTE_CATEGORIES) {
        const records = data[cat] as Record<string, ParsedFile> | undefined
        if (!records) continue
        for (const [name, file] of Object.entries(records)) {
          const description = (file.frontmatter?.description as string) ?? (file.title !== name ? file.title : undefined)
          result[cat].push({ name, category: cat, description, source: 'workspace', file })
        }
      }
    }

    for (const entry of libraryEntries) {
      if (entry.type === 'workflow') continue
      const cat = entry.type.endsWith('s') ? entry.type : entry.type + 's'
      if (!result[cat]) result[cat] = []
      if (result[cat].some(i => i.source === 'workspace' && i.name === entry.name)) continue
      result[cat].push({ name: entry.name, category: cat, description: entry.description, source: 'library', entry })
    }
    return result
  }, [data, libraryEntries])

  const filteredByCategory = useMemo(() => {
    if (!search.trim()) return unifiedByCategory
    const q = search.toLowerCase()
    const result: Record<string, UnifiedItem[]> = {}
    for (const [cat, items] of Object.entries(unifiedByCategory)) {
      result[cat] = items.filter(i =>
        i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false) ||
        (i.entry?.tags.some(t => t.toLowerCase().includes(q)) ?? false),
      )
    }
    return result
  }, [unifiedByCategory, search])

  const totalCount = useMemo(() => Object.values(filteredByCategory).reduce((s, items) => s + items.length, 0), [filteredByCategory])
  const wsCount = useMemo(() => Object.values(filteredByCategory).reduce((s, items) => s + items.filter(i => i.source === 'workspace').length, 0), [filteredByCategory])

  const handleAdd = useCallback(async (entry: LibraryEntry) => {
    try {
      await addFromLibrary(entry.type, entry.name)
      await reload()
      showNotification(`Added "${entry.name}" to workspace`, 'info')
    } catch (err) {
      showNotification(`Failed to add: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    }
  }, [addFromLibrary, reload, showNotification])

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const startX = e.clientX; const startY = e.clientY
    const startPos = { ...posRef.current }
    const wasDefault = startPos.x === -1
    const onMove = (ev: PointerEvent) => {
      setPosition({
        x: wasDefault ? (window.innerWidth - size.w - 16) + (ev.clientX - startX) : startPos.x + (ev.clientX - startX),
        y: startPos.y + (ev.clientY - startY),
      })
    }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [size.w])

  const sizeRef = useRef(size)
  sizeRef.current = size
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    const startY = e.clientY; const startH = sizeRef.current.h
    const onMove = (ev: PointerEvent) => { setSize(prev => ({ ...prev, h: Math.max(300, startH + (ev.clientY - startY)) })) }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  return (
    <AnimatePresence>
      {resourcePaletteOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="fixed z-50"
          style={{
            top: position.y,
            right: position.x === -1 ? 16 : undefined,
            left: position.x === -1 ? undefined : position.x,
          }}
        >
          <div className={cn(
            'flex flex-col rounded-xl border shadow-xl overflow-hidden backdrop-blur-xl',
            isDark ? 'bg-zinc-900/98 border-white/10' : 'bg-white/98 border-border',
          )} style={{ width: size.w }}>
            {/* Header */}
            <div onPointerDown={handleHeaderPointerDown}
              className="flex items-center gap-1.5 px-3 py-2 border-b cursor-grab active:cursor-grabbing select-none bg-muted/30 min-h-[42px]">
              <GripHorizontal size={14} className="text-muted-foreground shrink-0" />
              <div className="w-6 h-6 rounded-md shrink-0 bg-primary flex items-center justify-center shadow-sm">
                <Library size={13} className="text-primary-foreground" />
              </div>
              <span className="text-[13px] font-semibold flex-1 truncate">Elements</span>

              {!collapsed && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {wsCount} local
                  </span>
                  {libraryLoading && (
                    <div className="size-3.5 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent" />
                  )}
                </div>
              )}

              {!collapsed && <HelpButton context="palette" size={14} />}

              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(c => !c)}>
                      {collapsed ? <Maximize2 size={14} /> : <Minus size={14} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{collapsed ? 'Expand' : 'Collapse'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleResourcePalette}>
                      <X size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close (⌘L)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Body */}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: size.h, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden flex flex-col"
                >
                  {/* Search */}
                  <div className="px-2 py-1.5 shrink-0">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search workspace & library…"
                        className="h-8 pl-8 text-[13px]" />
                      {search && (
                        <button onClick={() => setSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto px-1 pb-2">
                    {totalCount === 0 ? (
                      <div className="flex flex-col items-center py-10 text-center">
                        <Library size={28} className="text-muted-foreground mb-2 opacity-40" />
                        <span className="text-[13px] text-muted-foreground">
                          {search ? 'No matching elements' : 'No elements yet'}
                        </span>
                        <span className="text-xs text-muted-foreground/60 mt-1">
                          {search ? 'Try a different search' : 'Elements will appear here as you add resources'}
                        </span>
                      </div>
                    ) : (
                      PALETTE_CATEGORIES.map(cat => (
                        <CategoryGroup key={cat} category={cat}
                          items={filteredByCategory[cat] ?? []} onAdd={handleAdd} />
                      ))
                    )}
                  </div>

                  {/* Resize handle */}
                  <div onPointerDown={handleResizePointerDown}
                    className="h-2 cursor-ns-resize shrink-0 flex items-center justify-center hover:bg-accent">
                    <div className="w-8 h-[3px] rounded-full bg-border" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
