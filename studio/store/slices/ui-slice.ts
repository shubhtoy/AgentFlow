import { type StateCreator } from 'zustand'

export interface UISlice {
  // State
  panelWidths: { left: number; right: number }
  leftPanelTab: string
  rightPanelTab: string
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  theme: 'light' | 'dark' | 'system'
  commandPaletteOpen: boolean

  // Actions
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setLeftPanelTab: (tab: string) => void
  setRightPanelTab: (tab: string) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setCommandPaletteOpen: (open: boolean) => void
}

function readPanelCollapsed(key: string): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(key) === 'true'
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  panelWidths: { left: 20, right: 20 },
  leftPanelTab: 'explorer',
  rightPanelTab: 'details',
  leftPanelCollapsed: readPanelCollapsed('af-left-collapsed'),
  rightPanelCollapsed: readPanelCollapsed('af-right-collapsed'),
  theme: (typeof localStorage !== 'undefined' && localStorage.getItem('af-theme') as any) || 'system',
  commandPaletteOpen: false,

  toggleLeftPanel: () => set(s => {
    const next = !s.leftPanelCollapsed
    if (typeof localStorage !== 'undefined') localStorage.setItem('af-left-collapsed', String(next))
    return { leftPanelCollapsed: next }
  }),
  toggleRightPanel: () => set(s => {
    const next = !s.rightPanelCollapsed
    if (typeof localStorage !== 'undefined') localStorage.setItem('af-right-collapsed', String(next))
    return { rightPanelCollapsed: next }
  }),
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setTheme: (theme) => {
    set({ theme })
    if (typeof localStorage !== 'undefined') localStorage.setItem('af-theme', theme)
    if (typeof document !== 'undefined') {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', isDark)
    }
  },
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
})
