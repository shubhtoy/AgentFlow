'use client'

import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'

// ── Types ───────────────────────────────────────────────────────────────

export interface MenuItem {
  label: string
  icon?: React.ElementType
  onClick: () => void
  destructive?: boolean
  hidden?: boolean
}

export interface MenuSeparator { separator: true }
export type MenuEntry = MenuItem | MenuSeparator

function isSep(e: MenuEntry): e is MenuSeparator { return 'separator' in e }

// ── Hook: useContextMenu ────────────────────────────────────────────────

interface CtxState { x: number; y: number; items: MenuEntry[] }

const CtxContext = React.createContext<{
  show: (e: React.MouseEvent, items: MenuEntry[]) => void
}>(null!)

export function useContextMenu() { return React.useContext(CtxContext) }

// ── Provider ────────────────────────────────────────────────────────────

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CtxState | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const show = useCallback((e: React.MouseEvent, items: MenuEntry[]) => {
    e.preventDefault()
    e.stopPropagation()
    // Clamp to viewport
    const x = Math.min(e.clientX, window.innerWidth - 180)
    const y = Math.min(e.clientY, window.innerHeight - 200)
    setState({ x, y, items: items.filter(i => isSep(i) || !i.hidden) })
  }, [])

  const close = useCallback(() => setState(null), [])

  useEffect(() => {
    if (!state) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('contextmenu', onDown)
      document.addEventListener('scroll', close, true)
      window.addEventListener('resize', close)
    })
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('contextmenu', onDown)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [state, close])

  return (
    <CtxContext.Provider value={{ show }}>
      {children}
      {state && (
        <div ref={ref}
          style={{ position: 'fixed', left: state.x, top: state.y, zIndex: 9999 }}
          className="w-44 rounded-md border bg-popover shadow-lg py-1 text-[11px] animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {state.items.map((entry, i) =>
            isSep(entry)
              ? <div key={i} className="h-px bg-border/50 my-1" />
              : <button key={i}
                  onClick={() => { entry.onClick(); close() }}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-accent rounded-sm text-left ${entry.destructive ? 'text-destructive' : ''}`}
                >
                  {entry.icon && <entry.icon size={12} />}
                  {entry.label}
                </button>
          )}
        </div>
      )}
    </CtxContext.Provider>
  )
}
