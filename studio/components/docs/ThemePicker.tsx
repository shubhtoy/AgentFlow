'use client'

import { useEffect, useState } from 'react'

const themes = [
  { id: 'neutral', label: 'Neutral', color: 'hsl(0, 0%, 9%)' },
  { id: 'ocean', label: 'Ocean', color: 'hsl(210, 80%, 40%)' },
  { id: 'purple', label: 'Purple', color: 'hsl(270, 80%, 50%)' },
  { id: 'dusk', label: 'Dusk', color: 'hsl(330, 60%, 45%)' },
  { id: 'catppuccin', label: 'Catppuccin', color: 'hsl(267, 84%, 60%)' },
]

export function ThemePicker() {
  const [active, setActive] = useState('neutral')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('fd-color-theme')
    if (saved) { setActive(saved); document.body.setAttribute('data-fd-theme', saved === 'neutral' ? '' : saved) }
  }, [])

  function pick(id: string) {
    setActive(id)
    setOpen(false)
    localStorage.setItem('fd-color-theme', id)
    document.body.setAttribute('data-fd-theme', id === 'neutral' ? '' : id)
  }

  const current = themes.find(t => t.id === active)!

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md hover:bg-fd-accent text-fd-muted-foreground w-full"
      >
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: current.color }} />
        <span>{current.label}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-fd-border bg-fd-popover p-1 shadow-md">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded w-full hover:bg-fd-accent ${active === t.id ? 'text-fd-primary font-medium' : 'text-fd-muted-foreground'}`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
