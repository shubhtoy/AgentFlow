// ── Centralized custom event helpers ──────────────────────────────────────

/** Fire a namespaced custom event on `window`. */
export function emit(event: string, detail?: unknown) {
  window.dispatchEvent(detail !== undefined ? new CustomEvent(event, { detail }) : new Event(event))
}

/** Subscribe to a window event; returns an unsubscribe function. */
export function on(event: string, handler: (e: Event) => void) {
  window.addEventListener(event, handler)
  return () => window.removeEventListener(event, handler)
}

// ── Panel event registry ─────────────────────────────────────────────────
// Maps event names → panel keys for data-driven wiring in playground.

export type PanelKey =
  | 'shortcuts' | 'validation' | 'tokenCalc' | 'library' | 'elements'
  | 'git' | 'export' | 'mcp' | 'protocols' | 'settings' | 'flow'
  | 'explorer'

export interface PanelEventDef {
  event: string
  key: PanelKey
  /** 'toggle' flips the boolean, 'open' always sets true */
  mode: 'toggle' | 'open'
}

export const PANEL_EVENTS: PanelEventDef[] = [
  { event: 'agentflow:show-shortcuts',  key: 'shortcuts',  mode: 'open' },
  { event: 'agentflow:show-validation', key: 'validation', mode: 'toggle' },
  { event: 'agentflow:show-token-calc', key: 'tokenCalc',  mode: 'open' },
  { event: 'agentflow:show-library',    key: 'library',    mode: 'toggle' },
  { event: 'agentflow:show-elements',   key: 'elements',   mode: 'toggle' },
  { event: 'agentflow:show-git',        key: 'git',        mode: 'toggle' },
  { event: 'agentflow:show-export',     key: 'export',     mode: 'open' },
  { event: 'agentflow:show-mcp',        key: 'mcp',        mode: 'toggle' },
  { event: 'agentflow:show-protocols',  key: 'protocols',  mode: 'toggle' },
  { event: 'agentflow:show-settings',   key: 'settings',   mode: 'open' },
  { event: 'agentflow:show-flow',       key: 'flow',       mode: 'toggle' },
  { event: 'agentflow:open-flow',       key: 'flow',       mode: 'open' },
  { event: 'agentflow:show-explorer',   key: 'explorer',   mode: 'toggle' },
]
