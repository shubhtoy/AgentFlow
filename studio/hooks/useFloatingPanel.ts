import { useRef, useCallback } from 'react'

/**
 * Combined drag + resize hook for floating panels.
 * Uses refs (not state) during drag/resize for zero re-renders while moving.
 * Commits final position/size to the DOM via ref, triggers one re-render on end.
 */

interface Rect { x: number; y: number; w: number; h: number }

export function useFloatingPanel(
  defaults: { x?: number; y?: number; w?: number; h?: number },
  constraints: { minW?: number; minH?: number; maxW?: number; maxH?: number } = {},
) {
  const { minW = 280, minH = 220, maxW = 1200, maxH = 900 } = constraints
  const rect = useRef<Rect>({
    x: defaults.x ?? 100, y: defaults.y ?? 60,
    w: defaults.w ?? 340, h: defaults.h ?? 480,
  })
  const panelRef = useRef<HTMLDivElement>(null)

  const applyRect = useCallback(() => {
    const el = panelRef.current
    if (!el) return
    const r = rect.current
    el.style.left = `${r.x}px`
    el.style.top = `${r.y}px`
    el.style.width = `${r.w}px`
    el.style.height = `${r.h}px`
  }, [])

  // Clamp to viewport
  const clamp = useCallback(() => {
    const r = rect.current
    const vw = window.innerWidth, vh = window.innerHeight
    r.x = Math.max(0, Math.min(r.x, vw - 80))
    r.y = Math.max(0, Math.min(r.y, vh - 40))
  }, [])

  // ── Drag ──
  const onDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, [data-no-drag]')) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const startRect = { ...rect.current }

    const onMove = (ev: PointerEvent) => {
      rect.current.x = startRect.x + ev.clientX - startX
      rect.current.y = startRect.y + ev.clientY - startY
      clamp()
      applyRect()
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [applyRect, clamp])

  // ── Resize (from any edge/corner) ──
  const onResizeStart = useCallback((edge: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const startRect = { ...rect.current }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      const r = rect.current

      if (edge.includes('e')) r.w = Math.max(minW, Math.min(maxW, startRect.w + dx))
      if (edge.includes('s')) r.h = Math.max(minH, Math.min(maxH, startRect.h + dy))
      if (edge.includes('w')) {
        const newW = Math.max(minW, Math.min(maxW, startRect.w - dx))
        r.x = startRect.x + startRect.w - newW
        r.w = newW
      }
      if (edge.includes('n')) {
        const newH = Math.max(minH, Math.min(maxH, startRect.h - dy))
        r.y = startRect.y + startRect.h - newH
        r.h = newH
      }
      applyRect()
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = edge.length === 2
      ? (edge === 'ne' || edge === 'sw' ? 'nesw-resize' : 'nwse-resize')
      : (edge === 'n' || edge === 's' ? 'ns-resize' : 'ew-resize')
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [applyRect, minW, minH, maxW, maxH])

  const getInitialStyle = useCallback((): React.CSSProperties => ({
    position: 'absolute',
    left: rect.current.x,
    top: rect.current.y,
    width: rect.current.w,
    height: rect.current.h,
  }), [])

  return { panelRef, onDragStart, onResizeStart, getInitialStyle, rect }
}
