/**
 * Shared loading primitives for consistent loading states across the studio.
 *
 * Usage:
 *   <Spinner />                          — inline 14px spinner
 *   <Spinner size="lg" />                — 20px spinner
 *   <LoadingState />                     — centered spinner with optional label
 *   <LoadingState label="Validating…" /> — centered spinner + text
 *   <EmptyState icon={Inbox} title="No results" />
 */

import { type ElementType } from 'react'

const SIZES = { sm: 12, md: 14, lg: 20 } as const

export function Spinner({ size = 'md', className = '' }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function LoadingState({ label, size = 'md', className = '' }: { label?: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 py-8 text-muted-foreground ${className}`}>
      <Spinner size={size} />
      {label && <p className="text-xs text-muted-foreground/60">{label}</p>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, className = '' }: {
  icon?: ElementType; title: string; description?: string; className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}>
      {Icon && <Icon size={20} className="text-muted-foreground/30" />}
      <p className="text-xs font-medium text-muted-foreground/60">{title}</p>
      {description && <p className="text-[10px] text-muted-foreground/40 max-w-[200px]">{description}</p>}
    </div>
  )
}
