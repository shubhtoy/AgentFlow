import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent } from './ui/dialog'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { ScrollArea } from './ui/scroll-area'
import {
  X, Footprints, GitBranch, Layers,
  ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore, type FocusTarget } from '@/store'
import { getNodeTypeColor } from '@/lib/constants'
import { NodeDetailTabs, ConnectionsList, ReachableNodes } from './NodeDetail'
import type { Ref, NodeDef, WorkflowDef } from '@/lib/types'

/* ── Tiny node-type icon ─────────────────────────────────────────────── */

function NodeTypeIcon({ nodeType, size = 16, color }: { nodeType: string; size?: number; color: string }) {
  const props = { size, color, strokeWidth: 2 }
  switch (nodeType) {
    case 'router': return <GitBranch {...props} />
    case 'sub-workflow': return <Layers {...props} />
    default: return <Footprints {...props} />
  }
}

/* ── Sidebar nav list ────────────────────────────────────────────────── */

function NodeNavList({ items, currentId, onNavigate, theme }: {
  items: { id: string; name: string; nodeType: string }[]
  currentId: string
  onNavigate: (id: string) => void
  theme: 'dark' | 'light'
}) {
  return (
    <div className="space-y-0.5">
      {items.map(n => {
        const color = getNodeTypeColor(n.nodeType, theme)
        const active = n.id === currentId
        return (
          <button
            key={n.id}
            onClick={() => onNavigate(n.id)}
            className={cn(
              'flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors relative',
              active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <NodeTypeIcon nodeType={n.nodeType} size={12} color={color} />
            <span className="truncate">{n.name}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Focus Sidebar ───────────────────────────────────────────────────── */

function FocusSidebar({ wf, node, currentNodeId, onNavigate }: {
  wf: WorkflowDef
  node: NodeDef
  currentNodeId: string
  onNavigate: (id: string) => void
}) {
  const isDark = document.documentElement.classList.contains('dark')
  const theme = isDark ? 'dark' : 'light'

  const allNodes = useMemo(() =>
    Object.entries(wf.nodes).map(([id, n]) => ({ id, name: n.name, nodeType: n.nodeType })),
  [wf])

  const [nodesOpen, setNodesOpen] = useState(true)
  const [connectionsOpen, setConnectionsOpen] = useState(true)
  const [reachableOpen, setReachableOpen] = useState(false)

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {/* Nodes section */}
        <SidebarSection title="Nodes" count={allNodes.length} open={nodesOpen} onToggle={() => setNodesOpen(v => !v)}>
          <NodeNavList items={allNodes} currentId={currentNodeId} onNavigate={onNavigate} theme={theme} />
        </SidebarSection>

        {/* Connections section */}
        <SidebarSection title="Connections" open={connectionsOpen} onToggle={() => setConnectionsOpen(v => !v)}>
          <ConnectionsList node={node} wf={wf} onNavigate={onNavigate} />
        </SidebarSection>

        {/* Reachable section */}
        <SidebarSection title="Reachable" open={reachableOpen} onToggle={() => setReachableOpen(v => !v)}>
          <ReachableNodes wf={wf} nodeId={currentNodeId} onNavigate={onNavigate} />
        </SidebarSection>
      </div>
    </ScrollArea>
  )
}

/* ── Sidebar collapsible section ─────────────────────────────────────── */

function SidebarSection({ title, count, open, onToggle, children }: {
  title: string
  count?: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-1.5 py-1.5 rounded-md hover:bg-accent/60 transition-colors text-left"
      >
        <ChevronRight
          size={12}
          className={cn(
            'text-muted-foreground/60 shrink-0 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          {title}
        </span>
        {count != null && (
          <span className="text-[10px] text-muted-foreground/50">{count}</span>
        )}
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  )
}

/* ── Main modal ──────────────────────────────────────────────────────── */

export function NodeFocusModal({ open, onClose, target }: {
  open: boolean
  onClose: () => void
  target: FocusTarget
}) {
  const data = useAppStore(s => s.data)
  const save = useAppStore(s => s.save)
  const select = useAppStore(s => s.select)
  const getSelectedResource = useAppStore(s => s.getSelectedResource)

  const isNodeTarget = target.type === 'node'
  const [currentNodeId, setCurrentNodeId] = useState(isNodeTarget ? target.nodeId : '')
  const [sidebarOpen, setSidebarOpen] = useState(isNodeTarget)
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const [tab, setTab] = useState('content')

  const workflowId = isNodeTarget ? target.workflowId : ''
  const wf = isNodeTarget ? data?.workflows[workflowId] : null
  const node = isNodeTarget && wf ? wf.nodes[currentNodeId] : null

  // For resource target — synthesize a ParsedFile from the store
  const resourceFile = !isNodeTarget && data ? (() => {
    const entry = (data as any)[target.category]?.[target.key]
    if (!entry) return null
    if (entry.relativePath) return entry
    // Synthesize for raw objects (e.g. hooks)
    return getSelectedResource()
  })() : null

  const primaryFile = isNodeTarget ? (node?.primaryFile ?? null) : resourceFile
  const allRefs = isNodeTarget ? (node?.allRefs ?? []) : (resourceFile?.refs ?? [])

  const isDark = document.documentElement.classList.contains('dark')
  const theme = isDark ? 'dark' : 'light'

  // Sync when external target changes
  useEffect(() => { if (isNodeTarget) setCurrentNodeId(target.nodeId) }, [isNodeTarget, target])
  useEffect(() => { setTab('content') }, [currentNodeId])

  // Ordered node list for prev/next
  const nodeIds = useMemo(() => wf ? Object.keys(wf.nodes) : [], [wf])
  const currentIndex = nodeIds.indexOf(currentNodeId)

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentNodeId(nodeIds[currentIndex - 1])
  }, [currentIndex, nodeIds])

  const goNext = useCallback(() => {
    if (currentIndex < nodeIds.length - 1) setCurrentNodeId(nodeIds[currentIndex + 1])
  }, [currentIndex, nodeIds])

  const handleNavigate = useCallback((id: string) => {
    setCurrentNodeId(id)
  }, [])

  const handleRefNavigate = useCallback((ref: Ref) => {
    if (ref.category && ref.name) {
      select({ type: 'resource', category: ref.category as any, key: ref.name })
    }
  }, [select])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); goPrev() }
      if (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); goNext() }
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, goPrev, goNext, onClose])

  if (isNodeTarget && (!wf || !node)) return null
  if (!isNodeTarget && !resourceFile) return null

  const color = isNodeTarget && node ? getNodeTypeColor(node.nodeType, theme) : 'var(--node-step)'
  const typeLabel = isNodeTarget && node
    ? (node.nodeType === 'sub-workflow' ? 'Sub-workflow' : node.nodeType === 'router' ? 'Gateway' : 'Step')
    : (target.type === 'resource' ? target.category.replace(/s$/, '') : '')
  const displayName = isNodeTarget && node ? node.name : (resourceFile?.title || resourceFile?.name || (target.type === 'resource' ? target.key : ''))

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent
        hideClose
        className="p-0 gap-0 flex flex-col overflow-hidden w-screen h-screen max-w-none rounded-none !translate-x-0 !translate-y-0 !left-0 !top-0"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-card/80 shrink-0">
          {/* Sidebar toggle (node mode only) */}
          {isNodeTarget && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setSidebarOpen(v => !v)}>
                  {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">{sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          )}

          {/* Node icon */}
          <div
            className="size-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}18` }}
          >
            <NodeTypeIcon nodeType={isNodeTarget && node ? node.nodeType : 'resource'} color={color} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 capitalize shrink-0"
                style={{ borderColor: `${color}40`, color }}
              >
                {typeLabel}
              </Badge>
              {isNodeTarget && node?.entry && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">Entry</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {primaryFile?.relativePath}
            </p>
          </div>

          {/* Prev / Next (node mode only) */}
          {isNodeTarget && (
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" onClick={goPrev} disabled={currentIndex <= 0}>
                    <ChevronLeft size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Previous node ⌘←</TooltipContent>
              </Tooltip>
              <span className="text-[10px] text-muted-foreground tabular-nums min-w-[32px] text-center">
                {currentIndex + 1}/{nodeIds.length}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" onClick={goNext} disabled={currentIndex >= nodeIds.length - 1}>
                    <ChevronRight size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Next node ⌘→</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          )}

          <TooltipProvider delayDuration={200}>
            {/* Close */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
                  <X size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Close (Esc)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar — node mode only */}
          {isNodeTarget && sidebarOpen && wf && node && (
            <>
              <div
                className="shrink-0 border-r border-border/40 bg-card/30 overflow-y-auto"
                style={{ width: sidebarWidth }}
              >
                <FocusSidebar
                  wf={wf}
                  node={node}
                  currentNodeId={currentNodeId}
                  onNavigate={handleNavigate}
                />
              </div>
              {/* Resize handle */}
              <div
                className="w-1 bg-border/30 hover:bg-primary/40 cursor-col-resize shrink-0 transition-colors"
                onPointerDown={(e) => {
                  e.preventDefault()
                  const startX = e.clientX
                  const startWidth = sidebarWidth
                  const onMove = (ev: PointerEvent) => {
                    setSidebarWidth(Math.min(400, Math.max(180, startWidth + (ev.clientX - startX))))
                  }
                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove)
                    window.removeEventListener('pointerup', onUp)
                  }
                  window.addEventListener('pointermove', onMove)
                  window.addEventListener('pointerup', onUp)
                }}
              />
            </>
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col">
            <NodeDetailTabs
              file={primaryFile}
              allRefs={allRefs}
              onRefNavigate={handleRefNavigate}
              sourceNodeId={currentNodeId}
              tab={tab}
              onTabChange={setTab}
              onSave={save}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
