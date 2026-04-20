// ---------------------------------------------------------------------------
// Theme palettes — used for palette menu and branding.
// With MUI removed, these are kept for backward compatibility with components
// that reference THEME_PALETTES (e.g. PaletteMenu in ActionBar).
// The actual theming is handled by CSS variables in globals.css.
// ---------------------------------------------------------------------------

export interface ThemePaletteConfig {
  id: string
  label: string
  light: { primary?: { main: string }; secondary?: { main: string } }
  dark: { primary?: { main: string }; secondary?: { main: string } }
}

export const THEME_PALETTES: ThemePaletteConfig[] = [
  { id: 'default', label: 'Ocean Blue', light: { primary: { main: '#1565C0' } }, dark: { primary: { main: '#64B5F6' } } },
  { id: 'teal', label: 'Teal', light: { primary: { main: '#00796B' } }, dark: { primary: { main: '#4DB6AC' } } },
  { id: 'indigo', label: 'Indigo', light: { primary: { main: '#303F9F' } }, dark: { primary: { main: '#7986CB' } } },
  { id: 'amber', label: 'Warm Amber', light: { primary: { main: '#E65100' } }, dark: { primary: { main: '#FFB74D' } } },
  { id: 'rose', label: 'Rose', light: { primary: { main: '#AD1457' } }, dark: { primary: { main: '#F48FB1' } } },
]

// Stub for backward compat — no longer creates MUI theme
export function buildTheme(_paletteId: string, _mode: 'light' | 'dark'): Record<string, unknown> {
  return {}
}

export const lightTheme = {}
export const darkTheme = {}
