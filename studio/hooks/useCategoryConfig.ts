import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getCategoryConfig, type CategoryConfig } from '@/lib/constants'

/** Returns theme-aware category config (colors adapt to light/dark mode) */
export function useCategoryConfig(): CategoryConfig {
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  return useMemo(() => getCategoryConfig(resolvedTheme), [resolvedTheme])
}
