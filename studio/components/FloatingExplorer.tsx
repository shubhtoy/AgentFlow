import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, X, FolderOpen, Blocks, Globe } from 'lucide-react'
import { useAppStore } from '@/store'
import { ExplorerPanel } from './ExplorerPanel'
import { ElementsView } from './ElementsView'
import { SkillsDiscoverView } from './SkillsDiscoverView'
import { Button } from './ui/button'

type Tab = 'files' | 'resources' | 'discover'

const TABS: { key: Tab; label: string; icon: typeof FolderOpen }[] = [
  { key: 'files', label: 'Files', icon: FolderOpen },
  { key: 'resources', label: 'Assets', icon: Blocks },
  { key: 'discover', label: 'Discover', icon: Globe },
]

export function FloatingExplorer() {
  const [open, setOpen] = useState(true)
  const constraintsRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('files')

  useEffect(() => {
    const toggle = () => setOpen(o => !o)
    const showFiles = () => { setOpen(true); setTab('files') }
    const showDiscover = () => { setOpen(true); setTab('discover') }
    const showResources = () => { setOpen(true); setTab('resources') }
    window.addEventListener('agentflow:show-explorer', toggle)
    window.addEventListener('agentflow:show-files', showFiles)
    window.addEventListener('agentflow:show-discover', showDiscover)
    window.addEventListener('agentflow:show-resources', showResources)
    return () => {
      window.removeEventListener('agentflow:show-explorer', toggle)
      window.removeEventListener('agentflow:show-files', showFiles)
      window.removeEventListener('agentflow:show-discover', showDiscover)
      window.removeEventListener('agentflow:show-resources', showResources)
    }
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  if (!open) return null

  return (
    <div ref={constraintsRef} className="absolute inset-0 z-30 pointer-events-none">
      <AnimatePresence>
        <motion.div
          key="explorer"
          drag dragMomentum={false} dragConstraints={constraintsRef} dragElastic={0.05}
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.15 }}
          className="absolute top-14 left-4 pointer-events-auto"
          style={{ touchAction: 'none' }}
        >
          <div
            className="rounded-xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col"
            data-tour="explorer"
            style={{ resize: 'both', overflow: 'hidden', minWidth: 280, minHeight: 320, width: 320, height: 560 }}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/30 shrink-0">
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 px-0.5">
                <GripVertical size={14} />
              </div>

              <div className="flex items-center bg-muted/50 rounded-lg p-0.5 gap-0.5 flex-1">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors flex-1 justify-center ${
                      tab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <t.icon size={11} /> {t.label}
                  </button>
                ))}
              </div>

              <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={handleClose}>
                <X size={12} />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-auto">
              {tab === 'files' && <ExplorerPanel />}
              {tab === 'resources' && <ElementsView />}
              {tab === 'discover' && <SkillsDiscoverView />}
            </div>

            {/* Resize grip */}
            <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 opacity-30 hover:opacity-60 transition-opacity">
              <svg width="8" height="8" viewBox="0 0 8 8" className="text-muted-foreground">
                <path d="M7 1v6H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
