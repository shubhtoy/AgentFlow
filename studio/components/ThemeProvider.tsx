import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/store'
import { api } from '@/lib/api'

/**
 * ThemeProvider manages the `dark` class on document.documentElement.
 * The CSS variable system in globals.css handles the actual theming.
 * If the branding config includes a `theme` field, loads that CSS file dynamically.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { themeMode, resolvedTheme, setThemeMode } = useStore()

  // Listen to OS color scheme changes when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setThemeMode('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode, setThemeMode])

  // Sync DOM attributes when resolved theme changes
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.setAttribute('data-theme', resolvedTheme)
    root.setAttribute('data-theme-mode', themeMode)
  }, [resolvedTheme, themeMode])

  // Load custom theme CSS from branding config
  useEffect(() => {
    api.getBrand()
      .then(d => {
        if (d?.theme) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = d.theme
          document.head.appendChild(link)
        }
      })
      .catch(() => {})
  }, [])

  return <>{children}</>
}

/** Cycle theme mode: light → dark → system → light */
export function cycleThemeMode(current: 'light' | 'dark' | 'system'): 'light' | 'dark' | 'system' {
  if (current === 'light') return 'dark'
  if (current === 'dark') return 'system'
  return 'light'
}
