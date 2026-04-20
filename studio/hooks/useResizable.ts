import { useState, useCallback } from 'react'

interface Size { w: number; h: number }

export function useResizable(initialWidth: number, initialHeight: number, minWidth = 260, minHeight = 200) {
  const [size, setSize] = useState<Size>({ w: initialWidth, h: initialHeight })

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const startW = size.w, startH = size.h
    const onMove = (ev: MouseEvent) => {
      setSize({
        w: Math.max(minWidth, startW + ev.clientX - startX),
        h: Math.max(minHeight, startH + ev.clientY - startY),
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [size.w, size.h, minWidth, minHeight])

  return { size, onResizeStart }
}
