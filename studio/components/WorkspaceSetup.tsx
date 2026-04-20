'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, X } from 'lucide-react'
import { Spinner } from './ui/spinner'
import { useAppStore } from '@/store'
import { Toaster } from 'sonner'
import { GitPanelContent } from './GitPanel'
import { Button } from './ui/button'
import { FileDropZone } from './FileDropZone'

type Step = 'choose' | 'loading' | 'git'

export function WorkspaceSetup({ onComplete, hasExistingSession }: { onComplete: () => void; hasExistingSession?: boolean }) {
  const [step, setStep] = useState<Step>('choose')
  const [status, setStatus] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  const notify = useAppStore(s => s.showNotification)

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setStep('loading')
    setStatus(label)
    try {
      await fn()
      await useAppStore.getState().reload()
      onComplete()
    } catch (err: any) {
      notify(err?.message || 'Something went wrong', 'error')
      setStep('choose')
    }
  }, [onComplete, notify])

  const handleNew = () => run('Creating workspace…', async () => {
    const { clearOPFSWorkspace, createOPFSAdapter, openWorkspace } = await import('@/lib/workspace')
    await clearOPFSWorkspace()
    await openWorkspace(createOPFSAdapter())
  })

  const handleSample = () => run('Loading sample workflow…', async () => {
    const { clearOPFSWorkspace, createOPFSAdapter, openWorkspace } = await import('@/lib/workspace')
    await clearOPFSWorkspace()
    const ws = createOPFSAdapter()
    await openWorkspace(ws)
    try {
      const store = useAppStore.getState()
      await store.addFromLibrary('workflow', 'build-feature')
    } catch {}
  })

  const handleFiles = (files: FileList) => run('Importing files…', async () => {
    const { clearOPFSWorkspace, createOPFSAdapter, openWorkspace } = await import('@/lib/workspace')
    const { extractEntries, applyImport } = await import('@/lib/import-files')
    await clearOPFSWorkspace()
    const ws = createOPFSAdapter()
    await openWorkspace(ws)
    const { entries } = await extractEntries(Array.from(files))
    await applyImport(entries, ws)
  })

  const handleDrop = (files: File[]) => run('Importing files…', async () => {
    const { clearOPFSWorkspace, createOPFSAdapter, openWorkspace } = await import('@/lib/workspace')
    const { extractEntries, applyImport } = await import('@/lib/import-files')
    await clearOPFSWorkspace()
    const ws = createOPFSAdapter()
    await openWorkspace(ws)
    const { entries, skipped } = await extractEntries(files)
    if (entries.length === 0) throw new Error('No supported files found')
    const count = await applyImport(entries, ws)
    if (skipped.length > 0) notify(`Imported ${count} files, ${skipped.length} skipped`, 'info')
  })

  const handleFolder = async () => {
    if (!('showDirectoryPicker' in window)) { fileInputRef.current?.click(); return }
    try {
      // @ts-expect-error
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      await run('Loading folder…', async () => {
        const { createBrowserAdapter, openWorkspace } = await import('@/lib/workspace')
        await openWorkspace(createBrowserAdapter(handle))
      })
    } catch (err: any) {
      if (err?.name !== 'AbortError') notify(err?.message || 'Failed', 'error')
    }
  }

  const actions = [
    ...(hasExistingSession ? [{ id: 'resume', label: 'Resume session', hint: 'Continue where you left off', action: onComplete }] : []),
    { id: 'sample', label: 'Explore a sample', hint: 'Load a pre-built workflow to see how it works', action: handleSample },
    { id: 'new', label: 'New workspace', hint: 'Start with a blank canvas', action: handleNew },
    { id: 'open', label: 'Open folder', hint: 'Load an existing .agentflow directory', action: handleFolder },
    { id: 'git', label: 'Connect repository', hint: 'Clone and sync via Git', action: () => setStep('git') },
    { id: 'docs', label: 'Explore docs', hint: 'Read the AgentFlow documentation', action: () => window.open('/docs', '_blank') },
  ]

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden selection:bg-primary/20">
      {/* Full-page drop overlay — appears when dragging files */}
      <FileDropZone overlay onFiles={handleDrop} disabled={step !== 'choose'} />

      {/* Single soft top-glow — not a pattern, just atmosphere */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.06] rounded-full blur-[120px] pointer-events-none" />

      <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} position="bottom-right" offset={40} richColors />
      <input ref={fileInputRef} type="file" className="hidden" multiple
        {...{ webkitdirectory: '', directory: '' } as any}
        onChange={e => { if (e.target.files?.length) handleFiles(e.target.files) }}
      />

      <AnimatePresence mode="wait">
        {step === 'choose' && (
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 flex flex-col items-center"
          >
            {/* Hero text */}
            <motion.h1
              className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              AgentFlow
            </motion.h1>

            <motion.p
              className="mt-3 text-base text-muted-foreground/80 font-light tracking-wide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              Design and ship agent workflows
            </motion.p>

            {/* Actions — clean text links */}
            <motion.nav
              className="mt-12 flex flex-col items-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.6 }}
            >
              {actions.map((a, i) => (
                <motion.button
                  key={a.id}
                  onClick={a.action}
                  onMouseEnter={() => setHovered(a.id)}
                  onMouseLeave={() => setHovered(null)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative flex items-center gap-3 px-5 py-3 rounded-xl transition-colors duration-200 hover:bg-foreground/[0.05]"
                >
                  <span className={`text-sm transition-colors duration-200 ${
                    i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground/90 group-hover:text-foreground'
                  }`}>
                    {a.label}
                  </span>
                  <ArrowRight
                    size={13}
                    className="text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-200 -translate-x-1 group-hover:translate-x-0"
                  />
                </motion.button>
              ))}
            </motion.nav>

            {/* Hint text for hovered action */}
            <div className="mt-6 h-4">
              <AnimatePresence mode="wait">
                {hovered && (
                  <motion.p
                    key={hovered}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-muted-foreground/60"
                  >
                    {actions.find(a => a.id === hovered)?.hint}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Terminal hint */}
            <motion.div
              className="mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <code className="text-[11px] text-muted-foreground/40 font-mono">
                npx agentflow ui ./my-project
              </code>
            </motion.div>
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center gap-4"
          >
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground/60">{status}</p>
          </motion.div>
        )}

        {step === 'git' && (
          <motion.div
            key="git"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 w-full max-w-md mx-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep('choose')}>
                <X size={14} />
              </Button>
              <span className="text-sm text-muted-foreground">Connect repository</span>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden max-h-[400px] overflow-y-auto">
              <GitPanelContent />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
