'use client'

import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Maximize2, GripVertical, ArrowRight, ArrowLeft,
  AlertCircle, AlertTriangle,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { getNodeTypeColor } from '@/lib/constants'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { NodeDetailTabs, ValidationBanner } from './NodeDetail'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from './ui/tooltip'
import type { Ref } from '@/lib/types'

/**
 * Unified inspector card for workflow nodes and resources.
 *
 * Interaction contract (handled in Canvas.tsx):
 *   Click          → select + open this card
 *   Cmd/Ctrl+Click → multi-select (card stays closed)
 *   Double-click   → focus modal (full-screen)
 *   Right-click    → context menu
 */
export function NodeCard() {
  const activeWf = useAppStore(s => s.activeWf)
  const selectionType = useAppStore(s => s.selection?.type)
  const selectionKey = useAppStore(s => s.selection?.key)
  const selectionCategory = useAppStore(s => s.selection?.category)
  const select = useAppStore(s => s.select)
  const save = useAppStore(s => s.save)
  const focusTarget = useAppStore(s => s.focusTarget)
  const openFocus = useAppStore(s => s.openFocus)
  const getSelectedResource = useAppStore(s => s.getSelectedResource)

  const wf = useAppStore(s => s.data?.workflows[s.activeWf] ?? null)
  const node = useAppStore(s => {
    if (!s.data || !s.selection || s.selection.type !== 'node') return null
    return s.data.workflows[s.activeWf]?.nodes[s.selection.key] ?? null
  })
  const validationResult = useAppStore(s => s.validationResult)
  const categoryConfig = useCategoryConfig()

  const [tab, setTab] = useState('content')
  const constraintsRef = useRef<HTMLDivElement>(null)

  const isNode = selectionType === 'node'
  const isResource = selectionType === 'resource'
  const isIdentity = selectionType === 'identity'

  const resource = useMemo(
    () => (isResource ? getSelectedResource() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isResource, selectionKey, selectionCategory, getSelectedResource],
  )

  const identityFile = useAppStore(s => {
    if (!isIdentity) return null
    const key = s.selection?.key || ''
    // If key contains a workflow path (e.g. "build-feature/AGENTS.md"), use that workflow's descriptor
    const wfId = key.includes('/') ? key.split('/')[0] : null
    if (wfId && s.data?.workflows[wfId]?.descriptorFile) {
      return s.data.workflows[wfId].descriptorFile
    }
    return s.data?.descriptorFile ?? null
  })

  const primaryFile = isNode ? (node?.primaryFile ?? null) : isIdentity ? (identityFile ?? null) : (resource ?? null)
  const isDark = document.documentElement.classList.contains('dark')
  const theme = isDark ? 'dark' : 'light'

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => { setTab('content'); setDragOffset(null) }, [selectionKey])

  const [copilotSidebarOpen, setCopilotSidebarOpen] = useState(false)
  useEffect(() => {
    const checkSidebar = () => {
      const el = document.querySelector('[data-copilot-sidebar]')
      setCopilotSidebarOpen(!!el?.classList.toString().includes('translate-x-0'))
    }
    checkSidebar()
    const observer = new MutationObserver(checkSidebar)
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const handleClose = useCallback(() => { select(null) }, [select])
  const handleFocus = useCallback(() => {
    if (isNode && selectionKey && activeWf) openFocus({ type: 'node', nodeId: selectionKey, workflowId: activeWf })
    else if (isResource && selectionCategory && selectionKey) openFocus({ type: 'resource', category: selectionCategory, key: selectionKey })
  }, [isNode, isResource, selectionKey, selectionCategory, activeWf, openFocus])

  const handleRefNavigate = useCallback((ref: Ref) => {
    if (ref.category && ref.name) {
      select({ type: 'resource', category: ref.category as any, key: ref.name })
    }
  }, [select])

  const fileIssues = useMemo(() => {
    if (!validationResult || !primaryFile) return []
    const path = primaryFile.relativePath
    const matchesFile = (i: any) => i.filePath === path || i.source === path
    return [
      ...validationResult.errors.filter(matchesFile).map(e => ({ ...e, severity: 'error' as const })),
      ...validationResult.warnings.filter(matchesFile).map(w => ({ ...w, severity: 'warning' as const })),
    ]
  }, [validationResult, primaryFile])

  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const ox = dragOffset?.x ?? 0
    const oy = dragOffset?.y ?? 0
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox, oy }
    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return
      setDragOffset({ x: dragStartRef.current.ox + (ev.clientX - dragStartRef.current.mx), y: dragStartRef.current.oy + (ev.clientY - dragStartRef.current.my) })
    }
    const onUp = () => { dragStartRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [dragOffset])

  // ── Visibility: show whenever a node or resource is selected ──
  const isFocusModalOpen = !!focusTarget
  const hasContent = isNode ? !!node && !!wf : isIdentity ? !!identityFile : (isResource && !!resource)
  if (!hasContent || isFocusModalOpen) return null

  const allRefs = isNode ? (node?.allRefs ?? []) : isIdentity ? (identityFile?.refs ?? []) : (resource?.refs ?? [])

  // ── Header data ──
  let headerColor = ''
  let headerLabel = ''
  let headerTooltip: string | undefined
  let headerEcosystemHint: string | undefined
  let HeaderIcon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> | null = null
  let showConnections = false
  let incoming: { from: string; to: string }[] = []
  let outgoing: { from: string; to: string }[] = []

  if (isNode && node && wf) {
    headerColor = getNodeTypeColor(node.nodeType, theme)
    headerLabel = node.nodeType === 'sub-workflow' ? 'Workflow'
      : node.nodeType === 'router' ? 'Gateway' : 'Agent'
    incoming = wf.edges.filter(e => e.to === node.id)
    outgoing = wf.edges.filter(e => e.from === node.id)
    showConnections = incoming.length > 0 || outgoing.length > 0
  }
  if (isResource && selectionCategory) {
    const cat = categoryConfig[selectionCategory]
    if (cat) {
      headerColor = cat.primaryColor
      headerLabel = cat.label
      HeaderIcon = cat.icon
      headerTooltip = cat.tooltip
      headerEcosystemHint = cat.ecosystemHint
    }
  }
  if (isIdentity) {
    const key = useAppStore.getState().selection?.key || ''
    headerColor = isDark ? 'hsl(238, 76%, 67%)' : 'hsl(238, 76%, 67%)'
    headerLabel = key.includes('/') ? 'Workflow Identity' : 'Workspace Identity'
  }

  const title = isNode ? node!.name : (resource?.title || selectionKey || '')
  const subtitle = primaryFile?.relativePath ?? ''
  const errorCount = fileIssues.filter(i => i.severity === 'error').length
  const warnCount = fileIssues.filter(i => i.severity === 'warning').length

  return (
    <div ref={constraintsRef} className="absolute inset-0 z-40 pointer-events-none">
      <AnimatePresence>
        <motion.div
          key={selectionKey}
          drag
          dragMomentum={false}
          dragConstraints={constraintsRef}
          dragElastic={0.05}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className={`absolute top-3 ${copilotSidebarOpen ? 'left-3' : 'right-3'} pointer-events-auto`}
          style={{ touchAction: 'none' }}
        >
          <div
            className="rounded-xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col w-[min(460px,85vw)] h-[min(580px,70vh)] min-w-[240px] min-h-[240px] max-w-[90%] max-h-[80%] @container"
            style={{ resize: 'both', overflow: 'hidden' }}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 @[320px]:px-3 @[320px]:py-2 border-b border-border/30 shrink-0">
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70">
                <GripVertical size={14} />
              </div>
              <div className="size-6 @[320px]:size-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${headerColor}18` }}>
                {HeaderIcon
                  ? <HeaderIcon size={13} style={{ color: headerColor }} />
                  : <div className="size-2.5 rounded-full" style={{ backgroundColor: headerColor }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-xs @[360px]:text-sm font-semibold truncate max-w-[60%]">{title}</p>
                  <Badge variant="outline" className="text-[9px] @[320px]:text-[10px] h-4 px-1 @[320px]:px-1.5 capitalize shrink-0"
                    style={{ borderColor: `${headerColor}40`, color: headerColor }}>
                    {headerLabel}
                  </Badge>
                  {(headerTooltip || headerEcosystemHint) && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground/40 hover:text-muted-foreground/70 cursor-help text-[10px] shrink-0">?</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] text-[11px] leading-snug">
                          {headerTooltip && <p>{headerTooltip}</p>}
                          {headerEcosystemHint && <p className="text-muted-foreground mt-0.5">{headerEcosystemHint}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {isNode && node?.entry && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">Entry</Badge>
                  )}
                  {isResource && !!resource?.frontmatter?.inclusion && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0 font-semibold">
                      {String(resource.frontmatter.inclusion).toUpperCase()}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{subtitle}</p>
              </div>

              {(errorCount > 0 || warnCount > 0) && (
                <div className="flex items-center gap-1 shrink-0">
                  {errorCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                      <AlertCircle size={11} /> {errorCount}
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                      <AlertTriangle size={11} /> {warnCount}
                    </span>
                  )}
                </div>
              )}

              {(isNode || isResource) && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-6 @[320px]:size-7" onClick={handleFocus}>
                        <Maximize2 size={12} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Focus mode (double-click)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button variant="ghost" size="icon" className="size-6 @[320px]:size-7" onClick={handleClose}>
                <X size={12} />
              </Button>
            </div>

            {/* Quick connections bar (nodes only) */}
            {showConnections && (
              <div className="px-2 @[320px]:px-3 py-1 @[320px]:py-1.5 border-b border-border/20 flex flex-wrap gap-1">
                {incoming.slice(0, 5).map((e, i) => (
                  <button key={`in-${i}`}
                    onClick={() => select({ type: 'node', key: e.from, workflowId: activeWf })}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5 hover:bg-accent transition-colors">
                    <ArrowLeft size={9} /> {wf?.nodes[e.from]?.name || e.from}
                  </button>
                ))}
                {outgoing.slice(0, 5).map((e, i) => (
                  <button key={`out-${i}`}
                    onClick={() => select({ type: 'node', key: e.to, workflowId: activeWf })}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5 hover:bg-accent transition-colors">
                    {wf?.nodes[e.to]?.name || e.to} <ArrowRight size={9} />
                  </button>
                ))}
                {(incoming.length + outgoing.length) > 10 && (
                  <span className="text-[10px] text-muted-foreground/60 px-1 self-center">
                    +{incoming.length + outgoing.length - 10} more
                  </span>
                )}
              </div>
            )}

            <ValidationBanner issues={fileIssues} />

            <NodeDetailTabs
              file={primaryFile}
              allRefs={allRefs}
              onRefNavigate={handleRefNavigate}
              sourceNodeId={isNode ? selectionKey : undefined}
              tab={tab}
              onTabChange={setTab}
              onSave={save}
            />

            <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 opacity-30 hover:opacity-60 transition-opacity">
              <svg width="8" height="8" viewBox="0 0 8 8" className="text-muted-foreground">
                <path d="M7 1v6H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
