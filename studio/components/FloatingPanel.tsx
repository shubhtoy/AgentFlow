'use client'

import { type ReactNode, useState, useCallback } from 'react'
import { X, Maximize2, Minimize2, GripVertical } from 'lucide-react'
import { useFloatingPanel } from '../hooks/useFloatingPanel'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'

// ── Resize edges — invisible hit areas ──

const EDGE_CLS = 'absolute z-10'
const EDGES: { edge: string; className: string }[] = [
  { edge: 'n',  className: `${EDGE_CLS} top-0 left-3 right-3 h-1 cursor-ns-resize` },
  { edge: 's',  className: `${EDGE_CLS} bottom-0 left-3 right-3 h-1 cursor-ns-resize` },
  { edge: 'w',  className: `${EDGE_CLS} left-0 top-3 bottom-3 w-1 cursor-ew-resize` },
  { edge: 'e',  className: `${EDGE_CLS} right-0 top-3 bottom-3 w-1 cursor-ew-resize` },
  { edge: 'nw', className: `${EDGE_CLS} top-0 left-0 w-3 h-3 cursor-nwse-resize` },
  { edge: 'ne', className: `${EDGE_CLS} top-0 right-0 w-3 h-3 cursor-nesw-resize` },
  { edge: 'sw', className: `${EDGE_CLS} bottom-0 left-0 w-3 h-3 cursor-nesw-resize` },
  { edge: 'se', className: `${EDGE_CLS} bottom-0 right-0 w-3 h-3 cursor-nwse-resize` },
]

export function FloatingPanel({
  open, onClose, title, icon: Icon, children, defaultPos, width = 340, height = 480, headerExtra, dataTour,
}: {
  open: boolean; onClose: () => void; title: string; icon: React.ElementType
  children: ReactNode; defaultPos?: { x: number; y: number }
  width?: number; height?: number; headerExtra?: ReactNode; dataTour?: string
}) {
  const { panelRef, onDragStart, onResizeStart, getInitialStyle, rect } = useFloatingPanel(
    { x: defaultPos?.x ?? 100, y: defaultPos?.y ?? 60, w: width, h: height },
  )
  const [maximized, setMaximized] = useState(false)
  const [savedRect, setSavedRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const toggleMaximize = useCallback(() => {
    const el = panelRef.current
    if (!el) return
    if (!maximized) {
      setSavedRect({ ...rect.current })
      el.style.left = '8px'
      el.style.top = '8px'
      el.style.width = `${window.innerWidth - 16}px`
      el.style.height = `${window.innerHeight - 16}px`
      setMaximized(true)
    } else if (savedRect) {
      Object.assign(rect.current, savedRect)
      el.style.left = `${savedRect.x}px`
      el.style.top = `${savedRect.y}px`
      el.style.width = `${savedRect.w}px`
      el.style.height = `${savedRect.h}px`
      setMaximized(false)
    }
  }, [maximized, savedRect, panelRef, rect])

  if (!open) return null

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={panelRef}
        data-tour={dataTour}
        style={getInitialStyle()}
        className={`
          z-50 flex flex-col overflow-hidden
          rounded-2xl
          border border-white/[0.08]
          bg-background/80 backdrop-blur-xl backdrop-saturate-150
          shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04),0_12px_48px_rgba(0,0,0,0.15)]
          dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_4px_rgba(0,0,0,0.1),0_12px_48px_rgba(0,0,0,0.4)]
          transition-shadow duration-200
          hover:shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_4px_8px_rgba(0,0,0,0.06),0_16px_56px_rgba(0,0,0,0.2)]
          dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_8px_rgba(0,0,0,0.15),0_16px_56px_rgba(0,0,0,0.5)]
        `}
      >
        {/* Resize edges */}
        {!maximized && EDGES.map(({ edge, className }) => (
          <div key={edge} className={className} onPointerDown={onResizeStart(edge)} />
        ))}

        {/* Title bar */}
        <div
          onPointerDown={maximized ? undefined : onDragStart}
          onDoubleClick={toggleMaximize}
          className="flex items-center gap-1.5 px-3 h-10 shrink-0 select-none cursor-grab active:cursor-grabbing
                     border-b border-border/30 bg-muted/30"
        >
          <GripVertical size={12} className="text-muted-foreground/30 shrink-0 mr-0.5" />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Icon size={14} className="text-primary shrink-0" />
            <span className="text-xs font-medium flex-1 truncate text-foreground/80">{title}</span>
          </div>

          {headerExtra}

          <div className="flex items-center gap-0.5 ml-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-lg text-muted-foreground hover:text-foreground" onClick={toggleMaximize} data-no-drag>
                  {maximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{maximized ? 'Restore' : 'Maximize'}</TooltipContent>
            </Tooltip>

            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-lg text-muted-foreground hover:text-destructive" onClick={onClose} data-no-drag>
              <X size={12} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {children}
        </div>

        {/* Resize grip */}
        {!maximized && (
          <div
            className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 cursor-nwse-resize opacity-0 hover:opacity-40 transition-opacity"
            onPointerDown={onResizeStart('se')}
          >
            <svg viewBox="0 0 12 12" className="w-full h-full text-muted-foreground">
              <circle cx="9" cy="9" r="1" fill="currentColor" />
              <circle cx="5" cy="9" r="1" fill="currentColor" />
              <circle cx="9" cy="5" r="1" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
