'use client'

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'neutral',
      fontFamily: 'inherit',
      flowchart: { curve: 'monotoneX', padding: 16 },
    })

    if (!ref.current) return
    const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`
    mermaid.render(id, chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg
    }).catch(() => setError(true))
  }, [chart])

  useEffect(() => {
    const obs = new MutationObserver(() => {
      if (!ref.current) return
      const isDark = document.documentElement.classList.contains('dark')
      mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'neutral', fontFamily: 'inherit' })
      const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`
      mermaid.render(id, chart).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      }).catch(() => {})
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [chart])

  if (error) return <pre className="text-xs text-fd-muted-foreground p-4 bg-fd-muted rounded-lg overflow-auto">{chart}</pre>

  return (
    <div
      ref={ref}
      className="my-6 flex justify-center overflow-x-auto rounded-lg border border-fd-border bg-fd-card p-4
        [&_svg]:max-w-full [&_svg]:min-h-[120px] [&_svg]:h-auto"
    />
  )
}
