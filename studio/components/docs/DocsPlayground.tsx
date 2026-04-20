'use client'

import { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from '@/components/Canvas'
import { NodeCard } from '@/components/NodeCard'
import { ValidationPanelContent } from '@/components/ValidationPanel'
import { ExplorerPanel } from '@/components/ExplorerPanel'
import { ElementsView } from '@/components/ElementsView'
import { TokenPanel } from '@/components/TokenPanel'
import { GitPanel } from '@/components/GitPanel'
import { MCPPanel } from '@/components/MCPPanel'
import { ProtocolPanel } from '@/components/ProtocolPanel'
import { SkillsDiscoverView } from '@/components/SkillsDiscoverView'
import { Editor } from '@/components/Editor'
import { FrontmatterForm } from '@/components/FrontmatterForm'
import { ExportDialogContent } from '@/components/ExportDialog'
import { SettingsDialogContent } from '@/components/SettingsDialog'
import { FloatingPanel } from '@/components/FloatingPanel'
import { DocsShowcase, useShowcaseNode } from '@/components/docs/DocsShowcase'
import {
  AlertTriangle, FolderTree, Layers, Calculator,
  GitBranch, Server, Network, Sparkles, Pencil,
  FileText, Download, Settings,
} from 'lucide-react'

export type PanelKey =
  | 'validation' | 'explorer' | 'elements' | 'tokens'
  | 'git' | 'mcp' | 'protocols' | 'skills'
  | 'editor' | 'frontmatter' | 'export' | 'settings'

const PANEL_CONFIG: Record<PanelKey, { title: string; icon: React.ElementType; width?: number; height?: number }> = {
  validation: { title: 'Validation', icon: AlertTriangle, width: 340, height: 380 },
  explorer: { title: 'Explorer', icon: FolderTree, width: 300, height: 400 },
  elements: { title: 'Elements', icon: Layers, width: 300, height: 400 },
  tokens: { title: 'Tokens', icon: Calculator, width: 320, height: 400 },
  git: { title: 'Git', icon: GitBranch, width: 360, height: 420 },
  mcp: { title: 'MCP Servers', icon: Server, width: 380, height: 480 },
  protocols: { title: 'Protocols', icon: Network, width: 360, height: 420 },
  skills: { title: 'Skills', icon: Sparkles, width: 360, height: 460 },
  editor: { title: 'Editor', icon: Pencil, width: 460, height: 500 },
  frontmatter: { title: 'Frontmatter', icon: FileText, width: 380, height: 480 },
  export: { title: 'Export', icon: Download, width: 440, height: 520 },
  settings: { title: 'Settings', icon: Settings, width: 400, height: 500 },
}

function PanelContent({ panel }: { panel: PanelKey }) {
  const { firstFile } = useShowcaseNode()

  switch (panel) {
    case 'validation': return <ValidationPanelContent />
    case 'explorer': return <ExplorerPanel />
    case 'elements': return <ElementsView />
    case 'tokens': return <TokenPanel />
    case 'git': return <GitPanel />
    case 'mcp': return <MCPPanel />
    case 'protocols': return <ProtocolPanel />
    case 'skills': return <SkillsDiscoverView />
    case 'editor':
      if (!firstFile?.rawContent) return <div className="p-4 text-sm text-muted-foreground">No file loaded</div>
      return <Editor filePath={firstFile.relativePath || 'SKILL.md'} content={firstFile.rawContent} />
    case 'frontmatter':
      if (!firstFile) return <div className="p-4 text-sm text-muted-foreground">No file loaded</div>
      return <FrontmatterForm file={firstFile} onSave={() => {}} />
    case 'export': return <ExportDialogContent />
    case 'settings': return <SettingsDialogContent />
    default: return null
  }
}

export function DocsPlayground({
  workflow = 'build-feature',
  panel,
  panels,
}: {
  workflow?: string
  panel?: PanelKey | 'none'
  panels?: PanelKey[]
}) {
  const resolved: PanelKey[] = panels ?? (panel && panel !== 'none' ? [panel] : [])
  const [panelOpen, setPanelOpen] = useState(true)
  const [active, setActive] = useState<PanelKey | null>(resolved[0] ?? null)
  const [activated, setActivated] = useState(false)

  const activeCfg = active ? PANEL_CONFIG[active] : null
  const showTabs = resolved.length > 1

  if (!activated) {
    return (
      <div
        className="relative w-full h-full flex items-center justify-center cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors rounded-lg border border-dashed border-border/50"
        onClick={() => setActivated(true)}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs font-medium">Click to load interactive canvas</span>
          <span className="text-[10px] opacity-60">{workflow} workflow</span>
        </div>
      </div>
    )
  }

  return (
    <DocsShowcase workflow={workflow}>
      <div className="relative w-full h-full">
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
        <NodeCard />
        {activeCfg && panelOpen && (
          <FloatingPanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            title={activeCfg.title}
            icon={activeCfg.icon}
            defaultPos={{ x: 8, y: 8 }}
            width={activeCfg.width!}
            height={activeCfg.height!}
            headerExtra={showTabs ? (
              <div className="flex items-center gap-0.5 mr-1">
                {resolved.map(key => {
                  const Icon = PANEL_CONFIG[key].icon
                  return (
                    <button
                      key={key}
                      onClick={() => setActive(key)}
                      title={PANEL_CONFIG[key].title}
                      className={`p-1 rounded-md transition-colors ${
                        key === active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon size={12} />
                    </button>
                  )
                })}
              </div>
            ) : undefined}
          >
            <div className="h-full overflow-y-auto">
              <PanelContent panel={active!} />
            </div>
          </FloatingPanel>
        )}
      </div>
    </DocsShowcase>
  )
}
