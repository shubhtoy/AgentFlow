'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { SpotlightTour, type TourStepDef } from './SpotlightTour'

// ── Tour steps ──────────────────────────────────────────────────────────

const TOUR_STEPS: TourStepDef[] = [
  {
    target: 'menubar',
    title: 'Menu Bar',
    description: 'Access file operations, edit commands, view panels, and workflow actions. The search bar in the center lets you find anything with ⌘K.',
    side: 'bottom',
  },
  {
    target: 'toolbar',
    title: 'Toolbar',
    description: 'Your quick-access controls — undo, redo, save, validate, and switch between workflows. Drag it anywhere on the canvas.',
    side: 'bottom',
  },
  {
    target: 'canvas',
    title: 'Workflow Canvas',
    description: 'This is where your agent workflow graph lives. Each node is a step, gateway, or sub-workflow. Drag to pan, scroll to zoom, click nodes to inspect.',
    side: 'top',
  },
  {
    target: 'explorer',
    title: 'Explorer',
    description: 'Browse and manage all your workflow files — nodes, capabilities, instructions, skills, and memory. Drag resources onto nodes to attach them.',
    side: 'right',
    prepare: 'agentflow:show-files',
  },
  {
    target: 'flow-panel',
    title: 'AI Chat — Flow',
    description: 'Your AI copilot. Ask Flow to create workflows, explain nodes, fix validation errors, or scaffold entire agent architectures. It can use all the tools you see in the toolbar.',
    side: 'left',
    prepare: 'agentflow:open-flow',
  },
  {
    target: 'statusbar',
    title: 'Status Bar',
    description: 'Shows your workspace type, active workflow, node count, token usage, and validation status at a glance. Click validation to see details.',
    side: 'top',
  },
]

// ── Context ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'af-tour-v2'

interface TourContextValue {
  startTour: () => void
  /** Track that a feature was used (for contextual hints) */
  markSeen: (feature: string) => void
  hasSeen: (feature: string) => boolean
}

const TourContext = createContext<TourContextValue | null>(null)
export const useTour = () => useContext(TourContext)

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return new Set(parsed.seen || [])
      }
    } catch {}
    return new Set()
  })

  const persist = useCallback((s: Set<string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: [...s] }))
  }, [])

  const startTour = useCallback(() => setActive(true), [])

  const finish = useCallback(() => {
    setActive(false)
    const next = new Set(seen)
    next.add('tour-completed')
    setSeen(next)
    persist(next)
  }, [seen, persist])

  const markSeen = useCallback((feature: string) => {
    setSeen(prev => {
      if (prev.has(feature)) return prev
      const next = new Set(prev)
      next.add(feature)
      persist(next)
      return next
    })
  }, [persist])

  const hasSeen = useCallback((feature: string) => seen.has(feature), [seen])

  // Listen for tour trigger event
  useEffect(() => {
    const handler = () => startTour()
    window.addEventListener('agentflow:start-tour', handler)
    return () => window.removeEventListener('agentflow:start-tour', handler)
  }, [startTour])

  // Auto-start on first visit (after a short delay for UI to settle)
  useEffect(() => {
    if (!seen.has('tour-completed')) {
      const timer = setTimeout(startTour, 800)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TourContext.Provider value={{ startTour, markSeen, hasSeen }}>
      {children}
      {active && (
        <SpotlightTour
          steps={TOUR_STEPS}
          onComplete={finish}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  )
}
