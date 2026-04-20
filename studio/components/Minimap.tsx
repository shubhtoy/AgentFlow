import { MiniMap } from '@xyflow/react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip'
import { Map, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store'

/**
 * Minimap wrapper — wraps React Flow's MiniMap in a card.
 * Positioned bottom-right of the canvas. Collapsible with localStorage persistence.
 */
export function Minimap() {
  const minimapCollapsed = useAppStore(s => s.minimapCollapsed)
  const setMinimapCollapsed = useAppStore(s => s.setMinimapCollapsed)

  return (
    <div
      className="absolute bottom-4 right-4 z-[5] rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 flex flex-col"
      style={{
        width: minimapCollapsed ? 40 : 200,
        height: minimapCollapsed ? 40 : 150,
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="absolute top-0.5 right-0.5 z-[1] inline-flex items-center justify-center h-7 w-7 rounded hover:bg-accent transition-colors"
            onClick={() => setMinimapCollapsed(!minimapCollapsed)}
          >
            {minimapCollapsed ? <Map size={16} /> : <ChevronDown size={16} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {minimapCollapsed ? 'Show minimap' : 'Hide minimap'}
        </TooltipContent>
      </Tooltip>

      {!minimapCollapsed && (
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            if (n.type === 'router') return '#F57F17'
            if (n.type === 'sub-workflow') return '#6A1B9A'
            if (n.type === 'step') return '#1565C0'
            return '#9E9E9E'
          }}
          maskColor="rgba(0,0,0,0.12)"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            margin: 0,
            borderRadius: 0,
            border: 'none',
            boxShadow: 'none',
          }}
        />
      )}
    </div>
  )
}
