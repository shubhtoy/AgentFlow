'use client'

import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, GripVertical, ArrowRight, GitBranch, BookOpen, Plus, ExternalLink,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from './ui/tooltip'
import { MarkdownPreview } from './MarkdownPreview'

/**
 * ConditionCard — inspector card for condition gates (conditional edges).
 *
 * Shows:
 *   - From → To routing
 *   - Condition text
 *   - If condition is a ref like `instructions/xxx`, resolves and previews the referenced resource
 *   - If free-text, offers to attach an instruction
 */
export function ConditionCard() {
  const selection = useAppStore(s => s.selection)
  const activeWf = useAppStore(s => s.activeWf)
  const select = useAppStore(s => s.select)
  const data = useAppStore(s => s.data)
  const save = useAppStore(s => s.save)
  const showNotification = useAppStore(s => s.showNotification)

  const wf = activeWf ? data?.workflows[activeWf] ?? null : null
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const constraintsRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  useEffect(() => { setDragOffset(null) }, [selection?.key])

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

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const ox = dragOffset?.x ?? 0
    const oy = dragOffset?.y ?? 0
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox, oy }
    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return
      setDragOffset({
        x: dragStartRef.current.ox + (ev.clientX - dragStartRef.current.mx),
        y: dragStartRef.current.oy + (ev.clientY - dragStartRef.current.my),
      })
    }
    const onUp = () => {
      dragStartRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [dragOffset])

  const handleClose = useCallback(() => select(null), [select])

  // Detect if the condition references an instruction/skill like "instructions/xxx"
  const attachedResource = useMemo(() => {
    const cond = selection?.condition
    if (!cond || !data) return null
    const m = cond.match(/^(instructions|skills|capabilities|memory)\/([\w-]+)$/)
    if (!m) return null
    const [, cat, name] = m
    const pool = (data as any)[cat] as Record<string, any> | undefined
    if (!pool) return null
    return pool[name] ? { category: cat, name, file: pool[name] } : { category: cat, name, file: null }
  }, [selection?.condition, data])

  const fromNode = selection?.from && wf?.nodes[selection.from]
  const toNode = selection?.to && wf?.nodes[selection.to]

  // Available instructions for the picker
  const instructionsList = useMemo(() => {
    if (!data?.instructions) return []
    return Object.keys(data.instructions).sort()
  }, [data?.instructions])

  const handleAttachInstruction = useCallback(async (instructionName: string) => {
    if (!fromNode || !selection?.from || !selection.to || !save) return
    const router = wf?.nodes[selection.from]
    const routerFile = router?.primaryFile
    if (!routerFile) {
      showNotification?.('Router file not found', 'error')
      return
    }
    setAttaching(true)
    try {
      const raw = routerFile.rawContent as string
      const to = selection.to
      const currentCondition = selection.condition || ''
      const newCondition = `instructions/${instructionName}`

      // Patterns to find: {{-> <to> | <anything>}} OR {{-> <to> | <current>}}
      // Escape regex special chars in `to`
      const escTo = to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`\\{\\{->\\s*${escTo}\\s*\\|\\s*[^}]+\\}\\}`)
      const replacement = `{{-> ${to} | ${newCondition}}}`

      if (!pattern.test(raw)) {
        showNotification?.(`Could not locate edge "${selection.from} → ${to}" in ${routerFile.relativePath}`, 'error')
        setAttaching(false)
        return
      }

      const updated = raw.replace(pattern, replacement)
      if (updated === raw) {
        showNotification?.('No changes applied', 'warning')
        setAttaching(false)
        return
      }

      await save(routerFile.relativePath, updated)
      showNotification?.(`Attached instructions/${instructionName} to condition`, 'success')
      setPickerOpen(false)
      // Re-select the condition with the new ref text so the card updates
      select({
        type: 'condition',
        key: selection.key,
        workflowId: activeWf!,
        from: selection.from,
        to: selection.to,
        condition: newCondition,
      })
    } catch (err: any) {
      showNotification?.(`Failed to attach: ${err?.message || 'unknown error'}`, 'error')
    } finally {
      setAttaching(false)
    }
  }, [fromNode, selection, save, wf, showNotification, activeWf, select])

  if (selection?.type !== 'condition') return null

  return (
    <div ref={constraintsRef} className="absolute inset-0 z-40 pointer-events-none">
      <AnimatePresence>
        <motion.div
          key={selection.key}
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
            className="rounded-xl bg-background/80 backdrop-blur-xl border border-[var(--node-condition)]/30 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col w-[min(500px,85vw)] max-h-[70vh] min-w-[280px] overflow-hidden @container"
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 px-3 py-2.5 @[320px]:px-4 @[320px]:py-3 border-b border-[var(--node-condition)]/20 shrink-0 bg-[var(--node-condition)]/[0.05]"
              onPointerDown={onDragStart}>
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70">
                <GripVertical size={14} />
              </div>
              <div className="size-6 @[320px]:size-7 rounded-lg flex items-center justify-center shrink-0 bg-[var(--node-condition)]/15">
                <GitBranch size={13} className="text-[var(--node-condition)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-xs @[360px]:text-sm font-semibold truncate">Condition</p>
                  <Badge variant="outline" className="text-[9px] @[320px]:text-[10px] h-4 px-1 @[320px]:px-1.5 shrink-0 border-[var(--node-condition)]/40 text-[var(--node-condition)]">
                    Gate
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {fromNode?.name || selection.from} → {toNode?.name || selection.to}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="size-6 @[320px]:size-7" onClick={handleClose}>
                <X size={12} />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto">
              {/* Routing */}
              <section className="px-4 py-3 border-b border-border/30">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Routing</h4>
                <div className="flex items-center gap-2 text-sm">
                  {fromNode ? (
                    <button
                      onClick={() => select({ type: 'node', key: selection.from!, workflowId: activeWf! })}
                      className="font-medium hover:text-primary transition-colors truncate max-w-[40%]"
                    >
                      {fromNode.name}
                    </button>
                  ) : (
                    <span className="text-muted-foreground italic">{selection.from}</span>
                  )}
                  <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                  {toNode ? (
                    <button
                      onClick={() => select({ type: 'node', key: selection.to!, workflowId: activeWf! })}
                      className="font-medium hover:text-primary transition-colors truncate max-w-[40%]"
                    >
                      {toNode.name}
                    </button>
                  ) : (
                    <span className="text-muted-foreground italic">{selection.to}</span>
                  )}
                </div>
              </section>

              {/* Condition */}
              <section className="px-4 py-3 border-b border-border/30">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Condition</h4>
                {attachedResource ? (
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <BookOpen size={14} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{attachedResource.category}/{attachedResource.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {attachedResource.file ? 'Instruction resource' : 'Missing — resource not found'}
                      </p>
                    </div>
                    {attachedResource.file && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6"
                              onClick={() => select({ type: 'resource', category: attachedResource.category as any, key: attachedResource.name })}>
                              <ExternalLink size={12} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Open resource</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-2 text-foreground">
                      {selection.condition || <span className="italic text-muted-foreground">No condition text</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Free-text condition. Attach an instruction to formalize the gate criteria.
                    </p>
                    {!pickerOpen ? (
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1.5"
                        onClick={() => setPickerOpen(true)}
                        disabled={!instructionsList.length}>
                        <Plus size={12} />
                        {instructionsList.length ? 'Attach instruction' : 'No instructions available'}
                      </Button>
                    ) : (
                      <div className="mt-2 rounded-lg border border-border/50 bg-background overflow-hidden">
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30 bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Pick an instruction</span>
                          <button onClick={() => setPickerOpen(false)}
                            className="text-muted-foreground/60 hover:text-foreground"
                            disabled={attaching}>
                            <X size={12} />
                          </button>
                        </div>
                        <div className="max-h-[180px] overflow-y-auto">
                          {instructionsList.map(name => (
                            <button key={name}
                              onClick={() => handleAttachInstruction(name)}
                              disabled={attaching}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-accent transition-colors text-left disabled:opacity-50">
                              <BookOpen size={12} className="text-muted-foreground shrink-0" />
                              <span className="font-mono truncate flex-1">instructions/{name}</span>
                              {attaching && <span className="text-[10px] text-muted-foreground">…</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Attached resource preview */}
              {attachedResource?.file && (
                <section className="px-4 py-3">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preview</h4>
                  <div className="rounded-lg border border-border/50 overflow-hidden max-h-[240px] overflow-y-auto">
                    <MarkdownPreview content={attachedResource.file.content || attachedResource.file.rawContent || ''} />
                  </div>
                </section>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
