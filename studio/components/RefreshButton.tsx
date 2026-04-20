import { RefreshCw } from 'lucide-react'
import { emit } from '../utils/events'

/** Compact refresh icon button used as `headerExtra` in FloatingPanels. */
export function RefreshButton({ event }: { event: string }) {
  return (
    <button
      onClick={() => emit(event)}
      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
    >
      <RefreshCw size={13} />
    </button>
  )
}
