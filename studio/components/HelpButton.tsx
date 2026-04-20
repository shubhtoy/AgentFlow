import { memo } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
const mod = isMac ? '⌘' : 'Ctrl'

interface Tip { keys?: string; label: string }

const TIP_SETS: Record<string, Tip[]> = {
  actionbar: [{ keys: `${mod}K`, label: 'Command palette' }, { keys: `${mod}B`, label: 'Toggle explorer' }, { keys: `${mod}Z`, label: 'Undo' }],
  drawer: [{ keys: 'Esc', label: 'Close drawer' }, { keys: `${mod}1–4`, label: 'Switch tab' }],
  editor: [{ keys: '/', label: 'Insert reference' }, { keys: `${mod}S`, label: 'Save' }],
  focus: [{ keys: `${mod}←→`, label: 'Prev / next node' }, { keys: 'Esc', label: 'Close' }],
  canvas: [{ label: 'Double-click canvas to add a node' }, { keys: `${mod}+/−`, label: 'Zoom in / out' }],
  palette: [{ keys: `${mod}L`, label: 'Toggle panel' }, { label: 'Drag items onto nodes or the editor' }],
}

const TipContent = memo(function TipContent({ tips }: { tips: Tip[] }) {
  return (
    <div className="py-1 min-w-[180px]">
      {tips.map((tip, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          {tip.keys ? (
            <span className="font-mono text-[11px] font-semibold bg-white/15 px-1.5 py-0.5 rounded text-center min-w-[44px] whitespace-nowrap">{tip.keys}</span>
          ) : (
            <span className="min-w-[44px] text-center text-[10px] opacity-40">•</span>
          )}
          <span className="text-xs">{tip.label}</span>
        </div>
      ))}
    </div>
  )
})

export interface HelpButtonProps { context?: keyof typeof TIP_SETS; tips?: Tip[]; size?: number }

export const HelpButton = memo(function HelpButton({ context = 'actionbar', tips, size = 16 }: HelpButtonProps) {
  const resolvedTips = tips ?? TIP_SETS[context] ?? TIP_SETS.actionbar
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <HelpCircle size={size} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="bg-gray-900 text-gray-100 max-w-[300px] rounded-xl px-3 py-2 shadow-xl">
          <TipContent tips={resolvedTips} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

export { TIP_SETS }
export type { Tip }
