import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TracedPath } from '@/utils/graph-focus'

interface Props {
  paths: TracedPath[]
  activeIndex: number
  onChangeIndex: (index: number) => void
  onClear: () => void
  nodeNames: Record<string, string>
}

export function PathTraceBar({ paths, activeIndex, onChangeIndex, onClear, nodeNames }: Props) {
  if (paths.length === 0) return null
  const path = paths[activeIndex]
  if (!path) return null

  const startName = nodeNames[path.nodeIds[0]] ?? path.nodeIds[0]
  const endName = nodeNames[path.nodeIds[path.nodeIds.length - 1]] ?? path.nodeIds[path.nodeIds.length - 1]

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <div className="flex items-center gap-2 bg-background/90 backdrop-blur-xl border border-border/50 rounded-full shadow-lg px-3 py-1.5">
        <span className="text-xs font-medium truncate max-w-[120px]">{startName}</span>
        <span className="text-muted-foreground text-xs">→</span>
        <span className="text-xs font-medium truncate max-w-[120px]">{endName}</span>

        {paths.length > 1 && (
          <div className="flex items-center gap-0.5 ml-1">
            <Button variant="ghost" size="icon" className="size-5"
              disabled={activeIndex === 0}
              onClick={() => onChangeIndex(activeIndex - 1)}>
              <ChevronLeft size={12} />
            </Button>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 tabular-nums">
              {activeIndex + 1}/{paths.length}
            </Badge>
            <Button variant="ghost" size="icon" className="size-5"
              disabled={activeIndex === paths.length - 1}
              onClick={() => onChangeIndex(activeIndex + 1)}>
              <ChevronRight size={12} />
            </Button>
          </div>
        )}

        {path.conditions.size > 0 && (
          <div className="flex items-center gap-1 ml-1 border-l border-border/40 pl-2">
            {[...path.conditions.values()].slice(0, 2).map((c, i) => (
              <Badge key={i} variant="outline" className="text-[9px] h-4 px-1.5 text-[var(--node-condition)] border-[var(--node-condition)]/30">
                {c.includes('/') ? c.split('/').pop() : c}
              </Badge>
            ))}
          </div>
        )}

        <Button variant="ghost" size="icon" className="size-5 ml-1" onClick={onClear}>
          <X size={12} />
        </Button>
      </div>
    </div>
  )
}
