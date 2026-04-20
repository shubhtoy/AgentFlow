import { useState, useEffect } from 'react'
import { FolderOpen, Blocks, Globe } from 'lucide-react'
import { ExplorerPanel } from './ExplorerPanel'
import { ElementsView } from './ElementsView'
import { SkillsDiscoverView } from './SkillsDiscoverView'
import { FloatingPanel } from './FloatingPanel'

type Tab = 'files' | 'resources' | 'discover'

const TABS: { key: Tab; label: string; icon: typeof FolderOpen }[] = [
  { key: 'files', label: 'Files', icon: FolderOpen },
  { key: 'resources', label: 'Assets', icon: Blocks },
  { key: 'discover', label: 'Discover', icon: Globe },
]

export function FloatingExplorer() {
  const [open, setOpen] = useState(true)
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

  return (
    <FloatingPanel
      open={open}
      onClose={() => setOpen(false)}
      title="Explorer"
      icon={FolderOpen}
      defaultPos={{ x: 16, y: 56 }}
      width={320}
      height={560}
      dataTour="explorer"
    >
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border/30 shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'files' && <ExplorerPanel />}
        {tab === 'resources' && <ElementsView />}
        {tab === 'discover' && <SkillsDiscoverView />}
      </div>
    </FloatingPanel>
  )
}
