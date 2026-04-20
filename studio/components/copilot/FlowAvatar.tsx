'use client'

/**
 * FlowAvatar — animated sparkle-bot avatar for the Flow agent.
 * Pure CSS animation, no external deps. Sizes: sm (24), md (32), lg (40).
 */

const SIZES = { sm: 24, md: 32, lg: 40 } as const

export function FlowAvatar({ size = 'md', className = '' }: {
  size?: keyof typeof SIZES; className?: string
}) {
  const s = SIZES[size]
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: s, height: s }}
    >
      {/* Outer glow ring — slow pulse */}
      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '3s' }} />

      {/* Main circle */}
      <div
        className="relative w-full h-full rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25"
      >
        {/* Inner sparkle icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="text-white"
          style={{ width: s * 0.5, height: s * 0.5 }}
        >
          {/* 4-point star */}
          <path
            d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5Z"
            fill="currentColor"
            className="origin-center animate-[spin_6s_linear_infinite]"
          />
          {/* Small accent dot */}
          <circle cx="18" cy="5" r="1.5" fill="currentColor" opacity="0.6" className="animate-pulse" />
        </svg>
      </div>
    </div>
  )
}
