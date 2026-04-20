'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { emit } from '@/utils/events'

export interface TourStepDef {
  target: string
  title: string
  description: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  prepare?: string
}

interface Props {
  steps: TourStepDef[]
  onComplete: () => void
  onSkip: () => void
}

const PAD = 6
const GAP = 12
const MAX_CUT = 500

function findTarget(sel: string): DOMRect | null {
  const el = document.querySelector(`[data-tour="${sel}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  // Clamp oversized elements
  const w = Math.min(r.width, MAX_CUT)
  const h = Math.min(r.height, MAX_CUT)
  return new DOMRect(r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h)
}

function cardPos(r: DOMRect, side: string): React.CSSProperties {
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const cardW = 320
  const cardH = 160 // approximate
  const s: React.CSSProperties = { position: 'fixed' }

  switch (side) {
    case 'bottom':
      s.top = Math.min(r.bottom + PAD + GAP, innerHeight - cardH - 16)
      s.left = Math.max(16, Math.min(cx - cardW / 2, innerWidth - cardW - 16))
      break
    case 'top':
      s.top = Math.max(16, r.top - PAD - GAP - cardH)
      s.left = Math.max(16, Math.min(cx - cardW / 2, innerWidth - cardW - 16))
      break
    case 'right':
      s.top = Math.max(16, Math.min(cy - cardH / 2, innerHeight - cardH - 16))
      s.left = Math.min(r.right + PAD + GAP, innerWidth - cardW - 16)
      break
    case 'left': {
      s.top = Math.max(16, Math.min(cy - cardH / 2, innerHeight - cardH - 16))
      const leftEdge = r.left - PAD - GAP - cardW
      // If card would go off-screen left, flip to bottom
      if (leftEdge < 16) {
        s.top = Math.min(r.bottom + PAD + GAP, innerHeight - cardH - 16)
        s.left = Math.max(16, Math.min(cx - cardW / 2, innerWidth - cardW - 16))
      } else {
        s.left = leftEdge
      }
      break
    }
  }
  return s
}

export function SpotlightTour({ steps, onComplete, onSkip }: Props) {
  const [cur, setCur] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[cur]
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const measure = useCallback(() => {
    if (!step) return
    if (timer.current) clearTimeout(timer.current)

    if (step.prepare) {
      emit(step.prepare)
      let tries = 0
      const poll = () => {
        const r = findTarget(step.target)
        if (r) setRect(r)
        else if (tries++ < 8) timer.current = setTimeout(poll, 150)
      }
      timer.current = setTimeout(poll, 200)
    } else {
      setRect(findTarget(step.target))
    }
  }, [step])

  useEffect(() => {
    measure()
    addEventListener('resize', measure)
    return () => {
      removeEventListener('resize', measure)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [measure])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') cur < steps.length - 1 ? setCur(c => c + 1) : onComplete()
      else if (e.key === 'ArrowLeft' && cur > 0) setCur(c => c - 1)
    }
    addEventListener('keydown', h)
    return () => removeEventListener('keydown', h)
  }, [cur, steps.length, onComplete, onSkip])

  if (!step || !rect) return null

  const side = step.side || 'bottom'
  const last = cur === steps.length - 1

  // Spotlight uses box-shadow: a transparent div at the target position
  // with a huge box-shadow creates the overlay. GPU-composited, no polygon math.
  const spotStyle: React.CSSProperties = {
    position: 'fixed',
    left: rect.left - PAD,
    top: rect.top - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
    pointerEvents: 'none',
    zIndex: 9998,
    transition: 'left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease',
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Click-to-dismiss backdrop (transparent, behind the shadow) */}
      <div className="absolute inset-0" onClick={onSkip} />

      {/* Spotlight cutout */}
      <div style={spotStyle} />

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={cur}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          style={cardPos(rect, side)}
          className="fixed w-[320px] rounded-xl bg-popover border border-border shadow-2xl p-4 z-[10000]"
        >
          <button onClick={onSkip} className="absolute top-3 right-3 text-muted-foreground/40 hover:text-muted-foreground">
            <X size={14} />
          </button>
          <h3 className="text-sm font-semibold pr-6">{step.title}</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{step.description}</p>
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-200 ${
                  i === cur ? 'w-4 bg-primary' : i < cur ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted-foreground/20'
                }`} />
              ))}
            </div>
            <div className="flex items-center gap-1">
              {cur > 0 && (
                <button onClick={() => setCur(c => c - 1)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40">
                  <ChevronLeft size={14} />
                </button>
              )}
              <button onClick={() => last ? onComplete() : setCur(c => c + 1)}
                className="h-7 px-3 flex items-center gap-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                {last ? 'Done' : 'Next'}{!last && <ChevronRight size={12} />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
