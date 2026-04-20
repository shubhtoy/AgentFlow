'use client'

import { useEffect, useState } from 'react'
import { StoreProvider, useAppStore } from '@/store'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Canvas } from '@/components/Canvas'
import { ReactFlowProvider } from '@xyflow/react'
import { NodeFocusModal } from '@/components/NodeFocusModal'
import CommandPalette from '@/components/CommandPalette'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { usePanelManager } from '@/hooks/usePanelManager'
import { AlertTriangle, GitBranch, Server, Network, FolderOpen, ChevronRight, Calculator } from 'lucide-react'
import { emit } from '@/utils/events'
import { Toaster } from 'sonner'
import { WorkspaceSetup } from '@/components/WorkspaceSetup'
import { StatusBar } from '@/components/layout/StatusBar'
import { ActionBar } from '@/components/layout/ActionBar'
import { AppMenubar } from '@/components/layout/AppMenubar'
import { NodeCard } from '@/components/NodeCard'
import { FloatingExplorer } from '@/components/FloatingExplorer'
import { FloatingPanel } from '@/components/FloatingPanel'
import { RefreshButton } from '@/components/RefreshButton'
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog'
import { ValidationPanelContent } from '@/components/ValidationPanel'
import { TokenPanel } from '@/components/TokenPanel'
import { GitPanelContent } from '@/components/GitPanel'
import { ExportDialog } from '@/components/ExportDialog'
import { MCPPanel } from '@/components/MCPPanel'
import { ProtocolPanel } from '@/components/ProtocolPanel'
import { SettingsDialog } from '@/components/SettingsDialog'
import { CopilotProvider } from '@/components/copilot'
import { TourProvider } from '@/components/onboarding/TourProvider'
import { FlowPanelContent, FlowIcon, FlowHeaderExtra } from '@/components/copilot/CopilotPanel'

function Layout() {
  const loading = useAppStore(s => s.loading)
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const setActiveWf = useAppStore(s => s.setActiveWf)
  const focusTarget = useAppStore(s => s.focusTarget)
  const closeFocus = useAppStore(s => s.closeFocus)
  const setPanelMode = useAppStore(s => s.setPanelMode)
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  const { panels, close } = usePanelManager()
  useGlobalShortcuts()

  useEffect(() => { setPanelMode('floating') }, [setPanelMode])

  useEffect(() => {
    if (!data) return
    const wfIds = Object.keys(data.workflows)
    if (activeWf && !data.workflows[activeWf]) {
      setActiveWf(null)
    }
  }, [data, activeWf, setActiveWf])

  const [welcomed, setWelcomed] = useState(false)
  const hasExistingSession = typeof window !== 'undefined' && localStorage.getItem('af-welcomed') === 'true'

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    )
  }

  if (!welcomed) {
    return (
      <WorkspaceSetup hasExistingSession={hasExistingSession} onComplete={() => {
        localStorage.setItem('af-welcomed', 'true')
        setWelcomed(true)
      }} />
    )
  }

  return (
    <TourProvider>
    <div className="h-screen flex flex-col bg-background text-foreground">
      <AppMenubar />
      <div className="flex-1 relative min-h-0">
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
        <FloatingExplorer />
        <NodeCard />
        <ActionBar />
        <FloatingPanel open={panels.validation} onClose={() => close('validation')} title="Validation" icon={AlertTriangle} defaultPos={{ x: 60, y: 100 }} width={360} height={420}
          headerExtra={<RefreshButton event="agentflow:validation-refresh" />}>
          <ValidationPanelContent />
        </FloatingPanel>
        <FloatingPanel open={panels.git} onClose={() => close('git')} title="Git" icon={GitBranch} defaultPos={{ x: 140, y: 100 }} width={360} height={460}
          headerExtra={<RefreshButton event="agentflow:git-refresh" />}>
          <GitPanelContent />
        </FloatingPanel>
        <FloatingPanel open={panels.mcp} onClose={() => close('mcp')} title="MCP Servers" icon={Server} defaultPos={{ x: 120, y: 60 }} width={380} height={520}>
          <MCPPanel />
        </FloatingPanel>
        <FloatingPanel open={panels.flow} onClose={() => close('flow')} title="Flow" icon={FlowIcon} defaultPos={{ x: 200, y: 40 }} width={380} height={560}
          headerExtra={<FlowHeaderExtra />} dataTour="flow-panel">
          <FlowPanelContent />
        </FloatingPanel>
        <FloatingPanel open={panels.protocols} onClose={() => close('protocols')} title="Protocols" icon={Network} defaultPos={{ x: 160, y: 80 }} width={380} height={520}>
          <ProtocolPanel />
        </FloatingPanel>
      </div>
      <StatusBar />
      <KeyboardShortcutsDialog open={panels.shortcuts} onClose={() => close('shortcuts')} />
      <FloatingPanel open={panels.tokenCalc} onClose={() => close('tokenCalc')} title="Tokens" icon={Calculator} defaultPos={{ x: 80, y: 80 }} width={340} height={460}>
        <TokenPanel />
      </FloatingPanel>
      <ExportDialog open={panels.export} onClose={() => close('export')} />
      <SettingsDialog open={panels.settings} onClose={() => close('settings')} />
      {focusTarget && (
        <NodeFocusModal open onClose={closeFocus} target={focusTarget} />
      )}
      <CommandPalette />
      <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} position="bottom-right" offset={40} richColors
        toastOptions={{ className: '!bg-card !backdrop-blur-xl !border !border-border !text-foreground !shadow-2xl !rounded-xl !text-xs' }} />
    </div>
    </TourProvider>
  )
}

export function Playground() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <CopilotProvider>
          <Layout />
        </CopilotProvider>
      </ThemeProvider>
    </StoreProvider>
  )
}
