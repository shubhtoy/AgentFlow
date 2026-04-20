import { type ReactNode, useState, useCallback, useRef, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { ArrowLeftRight, PanelLeftClose, PanelRightClose } from 'lucide-react'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '../ui/tooltip'
import { useAppStore } from '@/store'

export interface ThreePanelLayoutProps {
  leftContent: ReactNode
  centerContent: ReactNode
  rightContent: ReactNode
  statusBar: ReactNode
  /** Labels shown in panel headers */
  leftLabel?: string
  rightLabel?: string
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative w-1.5 cursor-col-resize transition-colors hover:bg-primary/20 data-[resize-handle-state=drag]:bg-primary/40">
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/50 group-data-[resize-handle-state=drag]:bg-primary" />
    </PanelResizeHandle>
  )
}

function PanelHeader({
  label,
  side,
  onSwap,
  onCollapse,
}: {
  label: string
  side: 'left' | 'right'
  onSwap: () => void
  onCollapse: () => void
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center h-9 px-2.5 border-b border-border/50 bg-card/80 shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex-1 select-none">
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSwap}
                className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <ArrowLeftRight size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Move to {side === 'left' ? 'right' : 'left'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCollapse}
                className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {side === 'left'
                  ? <PanelLeftClose size={12} />
                  : <PanelRightClose size={12} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Collapse panel
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}

export function ThreePanelLayout({
  leftContent,
  centerContent,
  rightContent,
  statusBar,
  leftLabel = 'Explorer',
  rightLabel = 'Details',
}: ThreePanelLayoutProps) {
  // Track whether panels are swapped
  const [swapped, setSwapped] = useState(() => {
    return localStorage.getItem('af-panels-swapped') === 'true'
  })

  const toggleSwap = useCallback(() => {
    setSwapped(prev => {
      const next = !prev
      localStorage.setItem('af-panels-swapped', String(next))
      return next
    })
  }, [])

  // Resolve which content goes where
  const resolvedLeft = swapped ? rightContent : leftContent
  const resolvedRight = swapped ? leftContent : rightContent
  const resolvedLeftLabel = swapped ? rightLabel : leftLabel
  const resolvedRightLabel = swapped ? leftLabel : rightLabel

  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const leftCollapsed = useAppStore(s => s.leftPanelCollapsed)
  const rightCollapsed = useAppStore(s => s.rightPanelCollapsed)
  const setLeftCollapsed = useAppStore(s => s.setLeftPanelCollapsed)
  const setRightCollapsed = useAppStore(s => s.setRightPanelCollapsed)

  const collapseLeft = useCallback(() => leftPanelRef.current?.collapse(), [])
  const collapseRight = useCallback(() => rightPanelRef.current?.collapse(), [])
  const expandLeft = useCallback(() => leftPanelRef.current?.expand(), [])
  const expandRight = useCallback(() => rightPanelRef.current?.expand(), [])

  // Sync imperative panel state when store changes (e.g. from ActionBar toggle)
  useEffect(() => {
    if (leftCollapsed) leftPanelRef.current?.collapse()
    else leftPanelRef.current?.expand()
  }, [leftCollapsed])

  useEffect(() => {
    if (rightCollapsed) rightPanelRef.current?.collapse()
    else rightPanelRef.current?.expand()
  }, [rightCollapsed])

  return (
    <div className="flex flex-col h-full min-h-0 flex-1">
      <PanelGroup
        direction="horizontal"
        autoSaveId="agentflow-panels"
        className="flex-1"
      >
        <Panel
          ref={leftPanelRef}
          defaultSize={20}
          minSize={12}
          collapsible
          collapsedSize={0}
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => { setLeftCollapsed(false) }}
        >
          {!leftCollapsed && (
            <div className="flex flex-col h-full min-h-0 overflow-hidden">
              <PanelHeader
                label={resolvedLeftLabel}
                side="left"
                onSwap={toggleSwap}
                onCollapse={collapseLeft}
              />
              <div className="flex-1 min-h-0 overflow-hidden">{resolvedLeft}</div>
            </div>
          )}
        </Panel>

        <ResizeHandle />

        <Panel minSize={30}>
          <div className="relative h-full min-h-0 overflow-hidden">{centerContent}</div>
        </Panel>

        <ResizeHandle />

        <Panel
          ref={rightPanelRef}
          defaultSize={20}
          minSize={12}
          collapsible
          collapsedSize={0}
          onCollapse={() => setRightCollapsed(true)}
          onExpand={() => setRightCollapsed(false)}
        >
          {!rightCollapsed && (
            <div className="flex flex-col h-full min-h-0 overflow-hidden">
              <PanelHeader
                label={resolvedRightLabel}
                side="right"
                onSwap={toggleSwap}
                onCollapse={collapseRight}
              />
              <div className="flex-1 min-h-0 overflow-hidden">{resolvedRight}</div>
            </div>
          )}
        </Panel>
      </PanelGroup>

      {statusBar}
    </div>
  )
}
