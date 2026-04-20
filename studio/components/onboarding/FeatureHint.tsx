'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useTour } from './TourProvider'

interface FeatureHintProps {
  /** Unique feature ID for persistence */
  id: string
  /** Hint text */
  text: string
  /** Show condition — hint only appears when this is true AND feature hasn't been seen */
  show: boolean
  /** Position relative to parent */
  side?: 'top' | 'bottom'
}

export function FeatureHint({ id, text, show, side = 'bottom' }: FeatureHintProps) {
  const tour = useTour()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show && tour && !tour.hasSeen(id)) {
      // Small delay so it doesn't flash during rapid state changes
      const t = setTimeout(() => setVisible(true), 400)
      return () => clearTimeout(t)
    }
    return undefined
  }, [show, id, tour])

  const dismiss = () => {
    setVisible(false)
    tour?.markSeen(id)
  }

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(dismiss, 8000)
    return () => clearTimeout(t)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: side === 'bottom' ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: side === 'bottom' ? -4 : 4 }}
          transition={{ duration: 0.2 }}
          className={`absolute ${side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2
            z-[100] w-64 px-3 py-2 rounded-lg
            bg-primary text-primary-foreground text-[11px] leading-relaxed
            shadow-lg`}
        >
          <button onClick={dismiss} className="absolute top-1.5 right-1.5 opacity-60 hover:opacity-100 transition-opacity">
            <X size={10} />
          </button>
          <p className="pr-4">{text}</p>
          {/* Arrow */}
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45 ${
            side === 'bottom' ? '-top-1' : '-bottom-1'
          }`} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
