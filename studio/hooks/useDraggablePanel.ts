import { useState, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react'

interface Position { x: number; y: number }

export function useDraggablePanel(initialPosition?: Position) {
  const [offset, setOffset] = useState<Position>(initialPosition ?? { x: 0, y: 0 })
  const offsetRef = useRef(offset)
  offsetRef.current = offset

  const dragging = useRef(false)
  const startPos = useRef<Position>({ x: 0, y: 0 })
  const startOffset = useRef<Position>({ x: 0, y: 0 })

  const onPointerDown = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation()
    dragging.current = true
    startPos.current = { x: e.clientX, y: e.clientY }
    startOffset.current = { ...offsetRef.current }

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const dx = ev.clientX - startPos.current.x
      const dy = ev.clientY - startPos.current.y
      setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy })
    }

    const onPointerUp = () => {
      dragging.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [])

  const resetPosition = useCallback(() => setOffset(initialPosition ?? { x: 0, y: 0 }), [initialPosition])

  return { offset, onPointerDown, resetPosition }
}
