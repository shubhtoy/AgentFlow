'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store'

type ShowcaseCtx = { ready: boolean; firstNode: any | null; firstFile: any | null }
const Ctx = createContext<ShowcaseCtx>({ ready: false, firstNode: null, firstFile: null })

export function useShowcaseNode() { return useContext(Ctx) }

/**
 * Universal wrapper for embedding studio components in docs.
 * - Loads a workflow into the store
 * - Wraps children in `.agentflow-studio.not-prose` (preflight excluded, Fumadocs typography excluded)
 * - Provides firstNode/firstFile via context for Tier-2 components (Editor, FrontmatterForm)
 */
export function DocsShowcase({
  workflow = 'build-feature',
  children,
}: {
  workflow?: string
  children: ReactNode
}) {
  const [ready, setReady] = useState(false)
  const addFromLibrary = useAppStore(s => s.addFromLibrary)
  const setActiveWf = useAppStore(s => s.setActiveWf)
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)

  useEffect(() => {
    addFromLibrary('workflow', workflow).then(async () => {
      setActiveWf(workflow)
      try {
        const { validate } = require('@agentflow/core/validator')
        const d = useAppStore.getState().data
        if (d) useAppStore.setState({ validationResult: validate(d) })
      } catch {}
      setReady(true)
    })
  }, [workflow])

  const firstNode = ready && data && activeWf
    ? Object.values((data.workflows[activeWf] as any)?.nodes ?? {})[0] ?? null
    : null
  const firstFile = (firstNode as any)?.primaryFile ?? null

  if (!ready) {
    return (
      <div className="agentflow-studio not-prose h-full w-full flex items-center justify-center text-muted-foreground text-sm animate-pulse">
        Loading…
      </div>
    )
  }

  return (
    <div className="agentflow-studio h-full w-full">
      <Ctx.Provider value={{ ready, firstNode, firstFile }}>{children}</Ctx.Provider>
    </div>
  )
}
