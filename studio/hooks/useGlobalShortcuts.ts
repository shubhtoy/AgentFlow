import { useEffect } from 'react'
import { useAppStore } from '@/store'

/**
 * Returns true when the active element is an input, textarea, or
 * contenteditable — i.e. the user is typing text and most shortcuts
 * should be suppressed.
 */
function isEditingText(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

/** Platform-aware meta key check (Cmd on macOS, Ctrl elsewhere). */
function isMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey
}

const DRAWER_TABS = ['content', 'properties', 'references', 'preview'] as const

/**
 * Registers global keyboard shortcuts on the window.
 *
 * Call once from App.tsx or AppShell.tsx — the hook reads/writes
 * directly from the Zustand store for performance (no re-renders
 * on every keypress).
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = isMod(e)
      const editing = isEditingText()

      // ── Escape — always active ──────────────────────────────────
      if (e.key === 'Escape') {
        const state = useAppStore.getState()
        if (state.commandPaletteOpen) {
          useAppStore.getState().setCommandPaletteOpen(false)
        } else if (state.drawerOpen) {
          useAppStore.getState().setDrawerOpen(false)
        }
        return
      }

      // ── Ctrl/Cmd+K — open command palette (active even in inputs) ─
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useAppStore.getState().setCommandPaletteOpen(true)
        return
      }

      // ── Ctrl/Cmd+L — toggle resource palette (active even in inputs) ─
      if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        useAppStore.getState().toggleResourcePalette()
        return
      }

      // ── Skip remaining shortcuts when editing text ──────────────
      if (editing) return

      // ── Ctrl/Cmd+B — toggle explorer ───────────────────────────
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        useAppStore.getState().toggleExplorer()
        return
      }

      // ── Ctrl/Cmd+J — toggle right panel ────────────────────────
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('agentflow:toggle-right-panel'))
        return
      }

      // ── Ctrl/Cmd+Shift+Z — redo ────────────────────────────────
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        useAppStore.getState().redo()
        return
      }

      // ── Ctrl/Cmd+Z — undo ─────────────────────────────────────
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        useAppStore.getState().undo()
        return
      }

      // ── Ctrl/Cmd+1–4 — drawer tab switch (when drawer open) ───
      if (mod && !e.shiftKey && e.key >= '1' && e.key <= '4') {
        const state = useAppStore.getState()
        if (state.drawerOpen) {
          e.preventDefault()
          const idx = Number(e.key) - 1
          useAppStore.getState().setDrawerTab(DRAWER_TABS[idx])
        }
        return
      }

      // ── Ctrl/Cmd+= — zoom in ──────────────────────────────────
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        const state = useAppStore.getState()
        useAppStore.getState().setZoomLevel(Math.min(state.zoomLevel + 10, 200))
        return
      }

      // ── Ctrl/Cmd+- — zoom out ─────────────────────────────────
      if (mod && e.key === '-') {
        e.preventDefault()
        const state = useAppStore.getState()
        useAppStore.getState().setZoomLevel(Math.max(state.zoomLevel - 10, 10))
        return
      }

      // ── Ctrl/Cmd+0 — fit view (reset zoom to 100%) ────────────
      if (mod && e.key === '0') {
        e.preventDefault()
        useAppStore.getState().setZoomLevel(100)
        return
      }

      // ── Arrow keys — pan canvas (when no node selected) ────────
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const state = useAppStore.getState()
        if (!state.selection) {
          e.preventDefault()
        }
      }

      // ── ? — open keyboard shortcuts ────────────────────────────
      if (e.key === '?' && !e.shiftKey && !mod) {
        // Dispatch a custom event that ActionBar listens for
        window.dispatchEvent(new CustomEvent('agentflow:show-shortcuts'))
      }

      // ── Backspace / Delete — delete selected node ──────────────
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const state = useAppStore.getState()
        if (state.selection?.type === 'node' && state.selection.workflowId) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('node:delete', { detail: state.selection.key }))
        }
      }

      // ── Enter — open focus modal for selected node ──────────
      if (e.key === 'Enter' && !e.shiftKey && !mod) {
        const tag = (e.target as HTMLElement)?.tagName
        const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
          || (e.target as HTMLElement)?.closest?.('.monaco-editor, .tiptap, .ProseMirror, [contenteditable]')
        if (isEditing) return
        const state = useAppStore.getState()
        if (state.selection?.type === 'node' && state.activeWf) {
          e.preventDefault()
          state.openFocus({ type: 'node', nodeId: state.selection.key, workflowId: state.activeWf })
        }
      }

      // ── Ctrl/Cmd+D — duplicate selected node ──────────────────
      if (mod && e.key.toLowerCase() === 'd') {
        const state = useAppStore.getState()
        if (state.selection?.type === 'node' && state.selection.workflowId) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('node:duplicate', { detail: state.selection.key }))
        }
      }

      // ── R — toggle canvas view (flow ↔ architecture) ──────────
      if (e.key.toLowerCase() === 'r' && !mod && !e.shiftKey && !isEditingText()) {
        window.dispatchEvent(new CustomEvent('agentflow:toggle-canvas-view'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
