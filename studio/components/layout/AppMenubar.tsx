'use client'

import { useAppStore, useCanUndo, useCanRedo } from '@/store'
import { api } from '@/lib/api'
import { emit } from '@/utils/events'
import { useState, useEffect } from 'react'
import { Search, Settings, Moon, Sun, Monitor, BookOpen } from 'lucide-react'
import {
  Menubar, MenubarContent, MenubarItem, MenubarMenu,
  MenubarSeparator, MenubarShortcut, MenubarSub,
  MenubarSubContent, MenubarSubTrigger, MenubarTrigger,
  MenubarCheckboxItem,
} from '@/components/ui/menubar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

async function openFolder(reload: () => Promise<any>) {
  if ('showDirectoryPicker' in window) {
    // @ts-expect-error
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    const { createBrowserAdapter, setWorkspace } = await import('@/lib/workspace')
    setWorkspace(createBrowserAdapter(handle))
    reload()
  } else {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.multiple = true
    input.onchange = async () => {
      if (!input.files?.length) return
      useAppStore.getState().showNotification(`Loading ${input.files.length} files…`, 'info')
      const { createIDBAdapter, setWorkspace } = await import('@/lib/workspace')
      const adapter = createIDBAdapter()
      setWorkspace(adapter)
      for (const file of Array.from(input.files)) {
        const rel = (file as any).webkitRelativePath || file.name
        const parts = rel.split('/')
        const p = parts.length > 1 ? parts.slice(1).join('/') : parts[0]
        if (p.endsWith('.md') || p.endsWith('.json')) {
          await adapter.write(p, await file.text())
        }
      }
      reload()
      useAppStore.getState().showNotification('Workspace loaded', 'success')
    }
    input.click()
  }
}

const MENU_TRIGGER = "text-xs text-muted-foreground px-2 py-1 rounded-md data-[state=open]:bg-foreground/5 data-[state=open]:text-foreground"

export function AppMenubar() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const setActiveWf = useAppStore(s => s.setActiveWf)
  const undo = useAppStore(s => s.undo)
  const redo = useAppStore(s => s.redo)
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const themeMode = useAppStore(s => s.themeMode)
  const setThemeMode = useAppStore(s => s.setThemeMode)
  const setCommandPaletteOpen = useAppStore(s => s.setCommandPaletteOpen)
  const reload = useAppStore(s => s.reload)
  const saveStatus = useAppStore(s => s.saveStatus)

  const [brandName, setBrandName] = useState('AgentFlow')
  useEffect(() => {
    api.getBrand().then(d => { if (d?.name) setBrandName(d.name) }).catch(() => {})
  }, [])

  const workflows = data ? Object.entries(data.workflows) : []
  const cycleTheme = () => setThemeMode(themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light')
  const ThemeIcon = themeMode === 'dark' ? Moon : themeMode === 'light' ? Sun : Monitor

  return (
    <TooltipProvider delayDuration={400}>
      <header data-tour="menubar" className="h-10 flex items-center px-3 shrink-0 z-40 select-none relative
        border-b border-border/30
        bg-background/80 backdrop-blur-xl backdrop-saturate-150
        shadow-[0_1px_0_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.04)]
        dark:shadow-[0_1px_0_rgba(255,255,255,0.02),0_1px_3px_rgba(0,0,0,0.2)]">

        {/* ── Left: Brand + menus ── */}
        <Menubar className="h-auto border-0 bg-transparent p-0 shadow-none gap-0 shrink-0">
          <MenubarMenu>
            <MenubarTrigger className="text-xs font-semibold tracking-tight px-2 py-1 rounded-md data-[state=open]:bg-foreground/5">
              {brandName}
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => openFolder(reload).catch(() => {})}>Open Folder… <MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
              <MenubarItem onClick={() => emit('agentflow:show-git')}>Connect Git…</MenubarItem>
              <MenubarItem onClick={() => { localStorage.removeItem('af-welcomed'); window.location.reload() }}>Switch Workspace…</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => emit('agentflow:global-save')} disabled={saveStatus !== 'dirty'}>Save <MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
              <MenubarItem onClick={() => reload()}>Reload <MenubarShortcut>⌘R</MenubarShortcut></MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => emit('agentflow:show-export')}>Export…</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className={MENU_TRIGGER}>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={undo} disabled={!canUndo}>Undo <MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
              <MenubarItem onClick={redo} disabled={!canRedo}>Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className={MENU_TRIGGER}>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => emit('agentflow:show-explorer')}>Explorer <MenubarShortcut>⌘B</MenubarShortcut></MenubarItem>
              <MenubarItem onClick={() => emit('agentflow:show-resources')}>Assets</MenubarItem>
              <MenubarItem onClick={() => emit('agentflow:show-discover')}>Discover</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => emit('agentflow:show-flow')}>AI Chat</MenubarItem>
              <MenubarItem onClick={() => emit('agentflow:show-git')}>Git</MenubarItem>
              <MenubarItem onClick={() => emit('agentflow:show-mcp')}>MCP Servers</MenubarItem>
              <MenubarItem onClick={() => emit('agentflow:show-validation')}>Validation</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => window.open('/docs', '_blank')}>Documentation ↗</MenubarItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>Theme</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarCheckboxItem checked={themeMode === 'light'} onClick={() => setThemeMode('light')}>Light</MenubarCheckboxItem>
                  <MenubarCheckboxItem checked={themeMode === 'dark'} onClick={() => setThemeMode('dark')}>Dark</MenubarCheckboxItem>
                  <MenubarCheckboxItem checked={themeMode === 'system'} onClick={() => setThemeMode('system')}>System</MenubarCheckboxItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className={MENU_TRIGGER}>Workflow</MenubarTrigger>
            <MenubarContent>
              {workflows.length > 0 && (
                <>
                  <MenubarSub>
                    <MenubarSubTrigger>Switch Workflow</MenubarSubTrigger>
                    <MenubarSubContent>
                      {workflows.map(([id, wf]) => (
                        <MenubarCheckboxItem key={id} checked={id === activeWf} onClick={() => setActiveWf(id)}>
                          {(wf as any).name || id}
                        </MenubarCheckboxItem>
                      ))}
                    </MenubarSubContent>
                  </MenubarSub>
                  <MenubarSeparator />
                </>
              )}
              <MenubarItem onClick={() => window.dispatchEvent(new CustomEvent('agentflow:auto-layout'))}>Auto Layout</MenubarItem>
              <MenubarItem onClick={async () => {
                const result = await useAppStore.getState().validate()
                const n = result?.errors?.length ?? 0
                useAppStore.getState().showNotification(n === 0 ? 'Validation passed' : `${n} issue${n > 1 ? 's' : ''} found`, n === 0 ? 'success' : 'warning')
              }}>Validate</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className={MENU_TRIGGER}>Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => emit('agentflow:start-tour')}>Take a Tour</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => emit('agentflow:show-shortcuts')}>Keyboard Shortcuts <MenubarShortcut>?</MenubarShortcut></MenubarItem>
              <MenubarItem onClick={() => window.open('/docs', '_blank')}>Documentation</MenubarItem>
              <MenubarItem onClick={() => emit('agentflow:show-discover')}>Skills Marketplace</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => window.open('https://skills.sh', '_blank')}>skills.sh ↗</MenubarItem>
              <MenubarItem onClick={() => window.open('https://github.com/agentflow', '_blank')}>GitHub ↗</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        {/* ── Center: Search bar (absolutely centered) ── */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-xs px-4 pointer-events-none">
          <button onClick={() => setCommandPaletteOpen(true)}
            className="pointer-events-auto flex items-center gap-2 w-full h-7 px-3 rounded-lg
              text-muted-foreground/50 hover:text-muted-foreground
              bg-muted/25 hover:bg-muted/40 border border-border/20 hover:border-border/40
              transition-all duration-150 text-xs">
            <Search size={13} className="shrink-0" />
            <span className="flex-1 text-left">Search workflows, nodes, resources…</span>
            <kbd className="text-[9px] font-mono opacity-30 shrink-0">⌘K</kbd>
          </button>
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Right: theme + settings ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <a href="/docs" target="_blank" rel="noopener noreferrer" className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <BookOpen size={14} />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Documentation</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={cycleTheme} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <ThemeIcon size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'} theme</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => emit('agentflow:show-settings')} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <Settings size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Settings</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  )
}
