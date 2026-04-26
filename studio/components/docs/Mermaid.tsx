'use client'

import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'inherit' })

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const isDark = document.documentElement.classList.contains('dark')
    mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'neutral', fontFamily: 'inherit' })
    const id = `m-${Math.random().toString(36).slice(2, 8)}`
    mermaid.render(id, chart)
      .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg })
      .catch(() => { if (ref.current) ref.current.textContent = chart })
  }, [chart])

  return <div ref={ref} className="my-4 flex justify-center [&_svg]:max-w-full" />
}
