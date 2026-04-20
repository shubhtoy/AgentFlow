'use client'

import { useState, type ReactNode } from 'react'
import { Maximize2, X } from 'lucide-react'
import { createPortal } from 'react-dom'

export function ComponentPreview({
  title,
  description,
  children,
  className,
  height = 'md',
  full,
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  height?: 'sm' | 'md' | 'lg' | 'xl'
  full?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const heights = { sm: 'h-[200px]', md: 'h-[350px]', lg: 'h-[500px]', xl: 'h-[650px]' }

  return (
    <>
      <div className={`agentflow-studio my-4 ${full ? '-mx-4 md:-mx-8 lg:-mx-12' : ''}`}>
        <div className="mb-2 flex items-center justify-between">
          <div>
            {title && <p className="text-sm font-medium text-foreground">{title}</p>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Open fullscreen"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className={`rounded-lg border bg-background relative overflow-hidden ${heights[height]} ${className ?? ''}`}>
          {!expanded && children}
        </div>
      </div>

      {expanded && typeof document !== 'undefined' && createPortal(
        <div className="agentflow-studio fixed inset-0 z-[9999] bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <p className="text-sm font-medium">{title || 'Preview'}</p>
            <button
              onClick={() => setExpanded(false)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export function PreviewGrid({ children }: { children: ReactNode }) {
  return <div className="agentflow-studio my-4 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}
