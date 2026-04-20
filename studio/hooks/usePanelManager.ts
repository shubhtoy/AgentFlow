import { useState, useEffect, useCallback } from 'react'
import { PANEL_EVENTS, type PanelKey } from '@/utils/events'

type PanelState = Record<PanelKey, boolean>

const INITIAL: PanelState = {
  shortcuts: false, validation: false, tokenCalc: false,
  library: false, elements: false, git: false, export: false,
  mcp: false, protocols: false, settings: false,
  flow: false, explorer: true,
}

/**
 * Manages all floating panel open/close state and wires up
 * the corresponding CustomEvent listeners automatically.
 */
export function usePanelManager() {
  const [panels, setPanels] = useState<PanelState>(INITIAL)

  const open = useCallback((key: PanelKey) => setPanels(p => ({ ...p, [key]: true })), [])
  const close = useCallback((key: PanelKey) => setPanels(p => ({ ...p, [key]: false })), [])
  const toggle = useCallback((key: PanelKey) => setPanels(p => ({ ...p, [key]: !p[key] })), [])

  useEffect(() => {
    const unsubs = PANEL_EVENTS.map(({ event, key, mode }) => {
      const handler = () => {
        if (mode === 'toggle') toggle(key)
        else open(key)
      }
      window.addEventListener(event, handler)
      return () => window.removeEventListener(event, handler)
    })
    return () => unsubs.forEach(fn => fn())
  }, [open, toggle])

  return { panels, open, close, toggle }
}
