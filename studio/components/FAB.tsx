import { useState, useRef, useEffect } from 'react'
import { Plus, ZoomIn, ZoomOut, Maximize, Sparkles, ChevronDown, ChevronUp, GripVertical, Network } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReactFlow } from '@xyflow/react'
import { NodeTemplatePicker } from './NodeTemplatePicker'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'

export function FAB() {
  const [collapsed, setCollapsed] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [isArchView, setIsArchView] = useState(true)
  const reactFlow = useReactFlow()
  const constraintsRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null)

  // Sync with keyboard shortcut R — listen for the same event
  useEffect(() => {
    const handler = () => setIsArchView(v => !v)
    window.addEventListener('agentflow:toggle-canvas-view', handler)
    return () => window.removeEventListener('agentflow:toggle-canvas-view', handler)
  }, [])

  const toggleMenu = () => {
    if (isDragging.current) return
    if (addMenuOpen) { setAddMenuOpen(false); setFabPos(null); return }
    if (fabRef.current) {
      const rect = fabRef.current.getBoundingClientRect()
      setFabPos({ x: rect.right - 240, y: rect.top })
    }
    setAddMenuOpen(true)
  }

  const closeMenu = () => { setAddMenuOpen(false); setFabPos(null) }

  return (
    <TooltipProvider>
      <div ref={constraintsRef} className="absolute inset-0 z-[4] pointer-events-none" />
      <motion.div
        drag dragMomentum={false} dragConstraints={constraintsRef} dragElastic={0}
        onDragStart={() => { isDragging.current = true }}
        onDragEnd={() => { requestAnimationFrame(() => { isDragging.current = false }) }}
        initial={{ x: 0, y: 0 }}
        className="absolute bottom-[120px] right-6 z-[5] flex flex-col items-center gap-2 pointer-events-auto"
        style={{ touchAction: 'none' }}
      >
        <div className="cursor-grab active:cursor-grabbing w-9 h-5 rounded-md bg-card/60 border border-border/50 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-card transition-colors">
          <GripVertical size={12} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 20 }} transition={{ duration: 0.2 }}>
              <div className="flex flex-col items-center rounded-xl overflow-hidden bg-card border border-border shadow-lg">
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="rounded-none h-9 w-9" onClick={() => reactFlow.zoomIn({ duration: 200 })}><ZoomIn size={18} /></Button></TooltipTrigger><TooltipContent side="left">Zoom in</TooltipContent></Tooltip>
                <div className="h-px w-full bg-border" />
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="rounded-none h-9 w-9" onClick={() => reactFlow.zoomOut({ duration: 200 })}><ZoomOut size={18} /></Button></TooltipTrigger><TooltipContent side="left">Zoom out</TooltipContent></Tooltip>
                <div className="h-px w-full bg-border" />
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="rounded-none h-9 w-9" onClick={() => reactFlow.fitView({ duration: 300, padding: 0.3 })}><Maximize size={18} /></Button></TooltipTrigger><TooltipContent side="left">Fit view</TooltipContent></Tooltip>
                <div className="h-px w-full bg-border" />
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="rounded-none h-9 w-9" onClick={() => window.dispatchEvent(new CustomEvent('agentflow:auto-layout'))}><Sparkles size={18} /></Button></TooltipTrigger><TooltipContent side="left">Auto-layout</TooltipContent></Tooltip>
                <div className="h-px w-full bg-border" />
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`rounded-none h-9 w-9 ${!isArchView ? 'text-muted-foreground' : ''}`} onClick={() => { setIsArchView(v => !v); window.dispatchEvent(new CustomEvent('agentflow:toggle-canvas-view')) }}><Network size={18} /></Button></TooltipTrigger><TooltipContent side="left">{isArchView ? 'Hide resources (R)' : 'Show resources (R)'}</TooltipContent></Tooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Tooltip><TooltipTrigger asChild>
          <button onClick={() => { if (!isDragging.current) setCollapsed(c => !c) }} className="w-9 h-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:bg-accent">
            {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </TooltipTrigger><TooltipContent side="left">{collapsed ? 'Show controls' : 'Hide controls'}</TooltipContent></Tooltip>

        <div className="relative">
          <Tooltip><TooltipTrigger asChild>
            <button ref={fabRef} onClick={toggleMenu} className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl hover:bg-primary/90 flex items-center justify-center">
              <motion.div animate={{ rotate: addMenuOpen ? 45 : 0 }} transition={{ duration: 0.2 }}><Plus size={24} /></motion.div>
            </button>
          </TooltipTrigger><TooltipContent side="left">Add node</TooltipContent></Tooltip>

          {addMenuOpen && <NodeTemplatePicker pos={fabPos} onClose={closeMenu} anchor="top" />}
        </div>
      </motion.div>
    </TooltipProvider>
  )
}
