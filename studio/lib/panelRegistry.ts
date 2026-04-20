// ---------------------------------------------------------------------------
// Panel Registry — manages independent, dockable panels
// ---------------------------------------------------------------------------
// Each panel can be docked left, docked right, or floating.
// Panels remember their dock position and open/closed state.

export type DockPosition = 'left' | 'right' | 'float'

export interface PanelConfig {
  id: string
  label: string
  defaultDock: DockPosition
  defaultOpen: boolean
  defaultWidth: number
  defaultHeight: number
  minWidth: number
}

export interface PanelState {
  id: string
  dock: DockPosition
  open: boolean
  width: number
  height: number
  floatPosition: { x: number; y: number }
}

// Panel definitions
export const PANEL_DEFS: PanelConfig[] = [
  { id: 'explorer', label: 'Explorer', defaultDock: 'left', defaultOpen: true, defaultWidth: 280, defaultHeight: 500, minWidth: 220 },
  { id: 'elements', label: 'Elements', defaultDock: 'left', defaultOpen: false, defaultWidth: 300, defaultHeight: 500, minWidth: 240 },
  { id: 'flow', label: 'Flow', defaultDock: 'right', defaultOpen: false, defaultWidth: 380, defaultHeight: 600, minWidth: 320 },
  { id: 'validation', label: 'Validation', defaultDock: 'right', defaultOpen: false, defaultWidth: 380, defaultHeight: 420, minWidth: 300 },
  { id: 'git', label: 'Git', defaultDock: 'right', defaultOpen: false, defaultWidth: 360, defaultHeight: 480, minWidth: 280 },
  { id: 'mcp', label: 'MCP Servers', defaultDock: 'right', defaultOpen: false, defaultWidth: 380, defaultHeight: 500, minWidth: 300 },
  { id: 'details', label: 'Details', defaultDock: 'right', defaultOpen: false, defaultWidth: 480, defaultHeight: 600, minWidth: 360 },
]

const STORAGE_KEY = 'af-panel-states'

export function loadPanelStates(): Record<string, PanelState> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return buildDefaultStates()
}

export function savePanelStates(states: Record<string, PanelState>) {
  typeof window !== "undefined" && localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
}

export function buildDefaultStates(): Record<string, PanelState> {
  const states: Record<string, PanelState> = {}
  for (const def of PANEL_DEFS) {
    states[def.id] = {
      id: def.id,
      dock: def.defaultDock,
      open: def.defaultOpen,
      width: def.defaultWidth,
      height: def.defaultHeight,
      floatPosition: {
        x: def.defaultDock === 'left' ? 16 : -1,
        y: 64,
      },
    }
  }
  return states
}

export function getPanelDef(id: string): PanelConfig | undefined {
  return PANEL_DEFS.find(d => d.id === id)
}
