import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CheckCircle, ChevronDown, ChevronRight,
  Undo2, Redo2, GripVertical, PanelLeftOpen, Plus,
  Save, Sparkles, GitBranch, FileOutput, Server, Network,
  MessageSquare, Eye, EyeOff, MoreHorizontal, Trash2, Home,
} from 'lucide-react'
import { useAppStore, useCanUndo, useCanRedo } from '@/store'
import { emit } from '@/utils/events'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip'
import { motion, AnimatePresence } from 'framer-motion'

function Btn({ icon: Icon, label, shortcut, onClick, disabled, className = '' }: {
  icon: React.ElementType; label: string; shortcut?: string; onClick: () => void; disabled?: boolean; className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onClick} disabled={disabled}
          className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed
            text-muted-foreground hover:text-foreground hover:bg-foreground/5 ${className}`}>
          <Icon className="size-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}{shortcut && ` ${shortcut}`}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-border/50 mx-1" />
}

/* ── Secondary controls popover ── */
function SecondaryMenu({ isDragging }: { isDragging: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const items = [
    { icon: Sparkles, label: 'Auto Layout', event: 'agentflow:auto-layout' },
    { icon: Server, label: 'MCP Servers', event: 'agentflow:show-mcp' },
    { icon: Network, label: 'Protocols', event: 'agentflow:show-protocols' },
    { icon: FileOutput, label: 'Export', event: 'agentflow:show-export' },
  ]

  return (
    <div className="relative" ref={ref}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={() => { if (!isDragging) setOpen(o => !o) }}
            className={`p-2 rounded-lg transition-colors ${open ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`}>
            <MoreHorizontal className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">More actions</TooltipContent>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-2 right-0 min-w-[160px] py-1 rounded-xl
              bg-popover/95 backdrop-blur-xl border border-border shadow-xl z-50">
            {items.map(item => (
              <button key={item.event}
                onClick={() => { emit(item.event); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:text-foreground hover:bg-accent transition-colors">
                <item.icon size={14} className="text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ActionBar() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const setActiveWf = useAppStore(s => s.setActiveWf)
  const validate = useAppStore(s => s.validate)
  const showNotification = useAppStore(s => s.showNotification)
  const undo = useAppStore(s => s.undo)
  const redo = useAppStore(s => s.redo)
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const saveStatus = useAppStore(s => s.saveStatus)
  const breadcrumbs = useAppStore(s => s.breadcrumbs)
  const navigateBreadcrumb = useAppStore(s => s.navigateBreadcrumb)
  const createWorkflow = useAppStore(s => s.createWorkflow)
  const reload = useAppStore(s => s.reload)
  const addFromLibrary = useAppStore(s => s.addFromLibrary)
  const deleteWorkflow = useAppStore(s => s.deleteWorkflow)

  const [wfOpen, setWfOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const [newWfMode, setNewWfMode] = useState(false)
  const [newWfName, setNewWfName] = useState('')
  const [libraryWorkflows, setLibraryWorkflows] = useState<Array<{ id: string; name: string; description: string; builtin?: boolean }>>([])
  const [libExpanded, setLibExpanded] = useState(false)
  const wfRef = useRef<HTMLDivElement>(null)
  const constraintsRef = useRef<HTMLDivElement>(null)
  const newWfInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const handleDragStart = useCallback(() => setIsDragging(true), [])
  const handleDragEnd = useCallback(() => requestAnimationFrame(() => setIsDragging(false)), [])

  useEffect(() => {
    if (!wfOpen) return
    const handler = (e: MouseEvent) => { if (wfRef.current && !wfRef.current.contains(e.target as Node)) setWfOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [wfOpen])

  const loadLibraryWorkflows = useCallback(async () => {
    try { setLibraryWorkflows(await (await import('@/lib/workspace')).listLibraryWorkflows()) } catch {}
  }, [])
  useEffect(() => { loadLibraryWorkflows() }, [loadLibraryWorkflows])

  const importWorkflow = useCallback(async (id: string) => {
    setWfOpen(false)
    try { await addFromLibrary('workflow', id); await reload(); setActiveWf(id); showNotification(`Added "${id}"`, 'success') }
    catch { showNotification('Failed to add workflow', 'error') }
  }, [addFromLibrary, reload, setActiveWf, showNotification])

  const handleValidate = async () => {
    emit('agentflow:show-validation')
    const result = await validate()
    const n = result?.errors?.length ?? 0
    showNotification(n === 0 ? 'Validation passed' : `${n} issue${n > 1 ? 's' : ''} found`, n === 0 ? 'success' : 'warning')
  }

  const workflows = data ? Object.entries(data.workflows) : []
  const activeLabel = activeWf ? (data?.workflows[activeWf]?.name || activeWf) : 'Workspace'

  // ── Hidden state: show pill ──
  if (!visible) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setVisible(true)}
          className="p-2 rounded-full bg-background/60 backdrop-blur-xl border border-border/40
            shadow-lg hover:bg-background/80 transition-colors text-muted-foreground hover:text-foreground">
          <Eye className="size-[18px]" />
        </button>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={constraintsRef} className="absolute inset-0 z-20 pointer-events-none">
        <motion.div
          drag dragMomentum={false} dragConstraints={constraintsRef} dragElastic={0.05}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}
          initial={{ opacity: 0, y: -12, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute top-4 left-1/2 pointer-events-auto"
          style={{ touchAction: 'none' }}
        >
          <div data-tour="toolbar" className="flex items-center gap-1 px-2 py-1.5 rounded-2xl
            bg-background/60 backdrop-blur-xl border border-border/40
            shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_4px_24px_rgba(0,0,0,0.12)]
            dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(0,0,0,0.35)]">

            {/* Drag handle */}
            <div className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 px-0.5">
              <GripVertical className="size-3.5" />
            </div>
            <Divider />

            {/* Explorer */}
            <Btn icon={PanelLeftOpen} label="Explorer" shortcut="⌘B"
              onClick={() => { if (!isDragging) emit('agentflow:show-explorer') }} />
            <Divider />

            {/* Workflow picker / breadcrumbs */}
            {breadcrumbs.length > 0 ? (
              <div className="flex items-center gap-0.5 max-w-[260px]">
                {breadcrumbs.map((crumbId, idx) => (
                  <div key={crumbId} className="flex items-center gap-0.5">
                    <button onClick={() => { if (!isDragging) navigateBreadcrumb(idx) }}
                      className="text-sm text-muted-foreground hover:text-foreground truncate max-w-[80px] transition-colors">
                      {data?.workflows[crumbId]?.name || crumbId}
                    </button>
                    <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
                  </div>
                ))}
                <span className="text-sm font-medium truncate max-w-[100px]">{activeLabel}</span>
              </div>
            ) : (
              <div className="relative" ref={wfRef}>
                <button onClick={() => { if (!isDragging) { setWfOpen(o => !o); setNewWfMode(false) } }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors max-w-[180px]">
                  <span className="truncate">{activeLabel}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
                <AnimatePresence>
                  {wfOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full mt-1.5 left-0 min-w-[220px] max-w-[280px] py-1 rounded-xl
                        bg-popover/95 backdrop-blur-xl border border-border shadow-xl max-h-[400px] overflow-y-auto">
                      {/* Workspace option */}
                      <button onClick={() => { setActiveWf(null); setWfOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors
                          ${activeWf === null ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent'}`}>
                        <Home className="size-3.5" />
                        <span className="font-medium">Workspace</span>
                      </button>
                      <div className="border-b border-border/50 my-1" />
                      {workflows.map(([id, wf]) => (
                        <div key={id} className="group flex items-center hover:bg-accent transition-colors">
                          <button onClick={() => { setActiveWf(id); setWfOpen(false) }}
                            className={`flex-1 text-left px-3 py-2 text-sm truncate
                              ${id === activeWf ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {wf.name || id}
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (!confirm(`Delete "${wf.name || id}"?`)) return
                              setWfOpen(false)
                              try { await deleteWorkflow(id); showNotification(`Deleted "${wf.name || id}"`, 'success') }
                              catch { showNotification('Failed to delete', 'error') }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 mr-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all shrink-0">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                      {workflows.length === 0 && !newWfMode && (
                        <div className="px-3 py-3 text-center">
                          <p className="text-xs text-muted-foreground/50 mb-2">No workflows yet</p>
                        </div>
                      )}
                      <div className="border-t border-border/50 mt-1 pt-1">
                        {newWfMode ? (
                          <form className="px-2 py-1.5"
                            onSubmit={async (e) => {
                              e.preventDefault(); const name = newWfName.trim(); if (!name) return
                              try { await createWorkflow(name); await reload(); showNotification(`Created "${name}"`, 'success') }
                              catch { showNotification('Failed to create workflow', 'error') }
                              setNewWfName(''); setNewWfMode(false); setWfOpen(false)
                            }}>
                            <div className="flex items-center gap-1.5 bg-accent/50 rounded-lg px-2.5 py-1.5 border border-border/50 focus-within:border-primary/50 transition-colors">
                              <Plus className="size-3.5 text-muted-foreground/50 shrink-0" />
                              <input ref={newWfInputRef} value={newWfName} onChange={e => setNewWfName(e.target.value)}
                                placeholder="Name your workflow…" autoFocus
                                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
                                onKeyDown={e => { if (e.key === 'Escape') { setNewWfMode(false); setNewWfName('') } }} />
                              {newWfName.trim() && (
                                <button type="submit" className="text-[10px] text-primary font-semibold px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors shrink-0">
                                  Create
                                </button>
                              )}
                            </div>
                            {newWfName.trim() && (
                              <p className="text-[10px] text-muted-foreground/40 mt-1 px-1">
                                → {newWfName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                              </p>
                            )}
                          </form>
                        ) : (
                          <button onClick={() => { setNewWfMode(true); requestAnimationFrame(() => newWfInputRef.current?.focus()) }}
                            className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-1.5">
                            <Plus className="size-3.5" /> New Workflow
                          </button>
                        )}
                      </div>
                      {libraryWorkflows.length > 0 && (() => {
                        const ids = new Set(workflows.map(([id]) => id))
                        const avail = libraryWorkflows.filter(t => !ids.has(t.id))
                        if (!avail.length) return null
                        return (
                          <div className="border-t border-border/50 mt-1 pt-1">
                            <button onClick={() => setLibExpanded(o => !o)}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium hover:text-muted-foreground transition-colors">
                              <ChevronRight className={`size-3 transition-transform ${libExpanded ? 'rotate-90' : ''}`} />
                              Library ({avail.length})
                            </button>
                            {libExpanded && avail.map(t => (
                              <button key={t.id} onClick={() => importWorkflow(t.id)}
                                className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-2">
                                <span className="flex-1 min-w-0 truncate text-xs">{t.name}</span>
                                <Plus className="size-3 text-muted-foreground/40 shrink-0" />
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <Divider />

            {/* ── Primary: undo/redo/save ── */}
            <Btn icon={Undo2} label="Undo" shortcut="⌘Z" onClick={() => { if (!isDragging) undo() }} disabled={!canUndo} />
            <Btn icon={Redo2} label="Redo" shortcut="⌘⇧Z" onClick={() => { if (!isDragging) redo() }} disabled={!canRedo} />
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => { if (!isDragging) emit('agentflow:global-save') }} disabled={saveStatus !== 'dirty'}
                  className={`p-2 rounded-lg transition-colors ${
                    saveStatus === 'dirty' ? 'text-amber-500 hover:bg-amber-500/10' :
                    saveStatus === 'saving' ? 'text-muted-foreground animate-pulse' :
                    'text-muted-foreground/30 cursor-not-allowed'}`}>
                  <Save className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {saveStatus === 'dirty' ? 'Save ⌘S' : saveStatus === 'saving' ? 'Saving…' : 'Saved'}
              </TooltipContent>
            </Tooltip>
            <Divider />

            {/* ── Primary: validate + panels ── */}
            <Btn icon={CheckCircle} label="Validate" onClick={() => { if (!isDragging) handleValidate() }} className="hover:!text-emerald-500" />
            <Btn icon={MessageSquare} label="AI Chat" onClick={() => { if (!isDragging) emit('agentflow:show-flow') }} />
            <Btn icon={GitBranch} label="Git" onClick={() => { if (!isDragging) emit('agentflow:show-git') }} />
            <Divider />

            {/* ── Secondary popover ── */}
            <SecondaryMenu isDragging={isDragging} />

            {/* ── Hide ── */}
            <Btn icon={EyeOff} label="Hide toolbar" onClick={() => { if (!isDragging) setVisible(false) }} />
          </div>
        </motion.div>
      </div>
    </TooltipProvider>
  )
}
