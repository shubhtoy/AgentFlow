import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Footprints, GitBranch, Layers, Wrench, Trash2, Copy, Maximize2, BookOpen, FileText, Brain, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface WorkflowNodeData {
  id: string
  name: string
  nodeType: 'step' | 'router' | 'sub-workflow'
  description?: string
  toolCount: number
  refCounts: { instructions: number; capabilities: number; skills: number; memory: number }
  contextFileCount: number
  status: 'idle' | 'running' | 'success' | 'error' | 'waiting' | 'pending'
  isEntry: boolean
  prefix?: string
  suffix?: string
}

const nodeTypeConfig = {
  step: { icon: Footprints, label: 'Step', colorVar: 'var(--node-step)' },
  router: { icon: GitBranch, label: 'Gateway', colorVar: 'var(--node-router)' },
  'sub-workflow': { icon: Layers, label: 'Workflow', colorVar: 'var(--node-sub-workflow)' },
} as const

const statusConfig: Record<WorkflowNodeData['status'], { color: string; label: string }> = {
  idle: { color: 'bg-muted-foreground/40', label: 'Idle' },
  running: { color: 'bg-blue-500 animate-pulse', label: 'Running' },
  success: { color: 'bg-emerald-500', label: 'Success' },
  error: { color: 'bg-red-500', label: 'Error' },
  waiting: { color: 'bg-amber-500', label: 'Waiting' },
  pending: { color: 'bg-violet-400 animate-pulse', label: 'Pending' },
}

const refIcons = {
  instructions: BookOpen,
  capabilities: Wrench,
  skills: FileText,
  memory: Brain,
}

function WorkflowNodeComponent({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  const config = nodeTypeConfig[data.nodeType]
  const Icon = config.icon
  const status = statusConfig[data.status]
  const [hovered, setHovered] = useState(false)

  const totalRefs = data.refCounts
    ? data.refCounts.instructions + data.refCounts.capabilities + data.refCounts.skills + data.refCounts.memory
    : 0

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Hover toolbar */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1 z-50">
          <div className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg px-1 py-0.5">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7"
                  onClick={() => window.dispatchEvent(new CustomEvent('node:focus', { detail: data.id }))}>
                  <Maximize2 size={13} />
                </Button>
              </TooltipTrigger><TooltipContent>Focus</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7"
                  onClick={() => window.dispatchEvent(new CustomEvent('node:duplicate', { detail: data.id }))}>
                  <Copy size={13} />
                </Button>
              </TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 hover:text-destructive"
                  onClick={() => window.dispatchEvent(new CustomEvent('node:delete', { detail: data.id }))}>
                  <Trash2 size={13} />
                </Button>
              </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* Card */}
      <div className={cn(
        'flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm w-[290px] overflow-hidden transition-shadow',
        selected && 'ring-2 ring-primary border-primary',
        hovered && !selected && 'shadow-md border-muted-foreground/30',
      )}>
        {/* Color bar */}
        <div className="h-1 w-full" style={{ backgroundColor: config.colorVar }} />

        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1.5">
          <div className="size-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${config.colorVar} 12%, transparent)` }}>
            <Icon size={14} style={{ color: config.colorVar }} />
          </div>
          <span className="truncate text-[13px] font-semibold flex-1">{data.name}</span>
          <TooltipProvider>
            <Tooltip><TooltipTrigger asChild>
              <span className={cn('size-2 shrink-0 rounded-full', status.color)} />
            </TooltipTrigger><TooltipContent className="text-[10px]">{status.label}</TooltipContent></Tooltip>
          </TooltipProvider>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1 px-3.5 pb-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 h-[18px]">
            {data.nodeType === 'step' && data.isEntry ? 'Entry' : config.label}
          </Badge>
        </div>

        {/* Description */}
        {data.description && (
          <p className="px-3.5 pb-2 text-[11px] text-muted-foreground leading-relaxed line-clamp-3 break-words">{data.description}</p>
        )}

        {/* Metadata footer */}
        {(totalRefs > 0 || data.contextFileCount > 0) && (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 border-t border-border/40 bg-muted/30">
            <TooltipProvider>
              {Object.entries(data.refCounts || {}).map(([cat, count]) => {
                if (!count) return null
                const RefIcon = refIcons[cat as keyof typeof refIcons]
                if (!RefIcon) return null
                return (
                  <Tooltip key={cat}><TooltipTrigger asChild>
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <RefIcon size={11} /> {count}
                    </span>
                  </TooltipTrigger><TooltipContent className="text-[10px]">{count} {cat}</TooltipContent></Tooltip>
                )
              })}
              {data.contextFileCount > 0 && (
                <Tooltip><TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Zap size={11} /> {data.contextFileCount}
                  </span>
                </TooltipTrigger><TooltipContent className="text-[10px]">{data.contextFileCount} context files</TooltipContent></Tooltip>
              )}
            </TooltipProvider>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2.5 !h-6 !rounded-sm !-left-1 !border-0 hover:!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2.5 !h-6 !rounded-sm !-right-1 !border-0 hover:!bg-primary" />
    </div>
  )
}

export const WorkflowNode = memo(WorkflowNodeComponent)
