import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Trash2, Copy, BookOpen, Wrench, PlayCircle, Database, Webhook, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface ResourceNodeData {
  id: string
  name: string
  category: string
  label: string
  color: string
  description?: string
  inclusion?: string
  subType?: string
  ecosystemHint?: string
  /** When true, renders as a small dot. When false, full pill card. */
  compact?: boolean
}

const categoryIcons: Record<string, typeof BookOpen> = {
  instructions: BookOpen,
  capabilities: Wrench,
  runbooks: PlayCircle,
  memory: Database,
  hooks: Webhook,
  customFiles: FileText,
}

function ResourceNodeComponent({ data, selected }: NodeProps & { data: ResourceNodeData }) {
  const Icon = categoryIcons[data.category] || FileText
  const [hovered, setHovered] = useState(false)
  const isCompact = data.compact !== false

  if (isCompact) {
    return (
      <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'size-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200',
                  'border border-transparent',
                  selected && 'ring-2 ring-primary scale-125',
                  hovered && !selected && 'scale-110 border-border shadow-sm',
                )}
                style={{ backgroundColor: `${data.color}20` }}
              >
                <Icon size={12} style={{ color: data.color }} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] max-w-[220px]">
              <p className="font-medium">{data.name}</p>
              <p className="text-muted-foreground">{data.label}{data.subType ? ` · ${data.subType}` : ''}</p>
              {data.ecosystemHint && <p className="text-muted-foreground/70 mt-0.5">{data.ecosystemHint}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Handle type="target" position={Position.Left} className="!bg-transparent !w-0 !h-0 !border-0" />
      </div>
    )
  }

  // ── Expanded card mode ──
  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1 z-50">
          <div className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg px-1 py-0.5">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7"
                  onClick={() => window.dispatchEvent(new CustomEvent('resource:duplicate', { detail: { category: data.category, name: data.name } }))}>
                  <Copy size={13} />
                </Button>
              </TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 hover:text-destructive"
                  onClick={() => window.dispatchEvent(new CustomEvent('resource:delete', { detail: { category: data.category, name: data.name } }))}>
                  <Trash2 size={13} />
                </Button>
              </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      <div className={cn(
        'flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm w-[200px] overflow-hidden transition-all duration-200',
        selected && 'ring-2 ring-primary border-primary',
        hovered && !selected && 'shadow-md border-muted-foreground/30',
      )}>
        <div className="h-1 w-full" style={{ backgroundColor: data.color }} />

        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
          <div className="size-6 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${data.color}18` }}>
            <Icon size={13} style={{ color: data.color }} />
          </div>
          <span className="truncate text-sm font-medium flex-1">{data.name}</span>
        </div>

        <div className="flex items-center gap-1 px-3 pb-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[9px] px-1.5 h-4">{data.label}</Badge>
          {data.subType && (
            <Badge variant="outline" className="text-[9px] px-1.5 h-4" style={{ borderColor: `${data.color}40`, color: data.color }}>
              {data.subType}
            </Badge>
          )}
          {data.inclusion && (
            <Badge variant="outline" className="text-[9px] px-1.5 h-4">{data.inclusion}</Badge>
          )}
        </div>

        {data.description && (
          <p className="px-3 pb-2 text-[10px] text-muted-foreground leading-snug line-clamp-2">{data.description}</p>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-4 !rounded-sm !-left-0.5 !border-0 hover:!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-4 !rounded-sm !-right-0.5 !border-0 hover:!bg-primary" />
    </div>
  )
}

export const ResourceNode = memo(ResourceNodeComponent)
