'use client'

// ChemistryTheme — neo-brutalism palette + light/dark toggle for the
// chemistry overlay. Modelled directly on AminaChemistry/app/globals.css
// (the cream + ink + grape/sky/sun colour system) so the overlay reads
// as a separate app skinned over the Eren pixel-art world.
//
// Persists the choice in localStorage. The store provider for SRS state
// and this theme provider are independent — wrap children in either order.

import { createContext, useContext, useEffect, useState, createElement, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

export interface Palette {
  bg: string         // page background
  ink: string        // border + hard shadow colour
  fg: string         // primary text
  fgMuted: string    // secondary text
  fgFaint: string    // tertiary / disabled
  card: string       // card background
  cardRaised: string // answer-option surface — lifted off bg in dark mode
  cardMuted: string  // softer card variant
  grape: string
  grapeLight: string
  grapeDark: string
  sky: string
  skyLight: string
  skyDark: string
  sun: string
  sunLight: string
  sunDark: string
  red: string
  redLight: string
  green: string
  greenLight: string
}

const LIGHT_PALETTE: Palette = {
  bg:         '#FCEED5', // warm cream (--background)
  ink:        '#1A0F2D', // dark plum outline + shadow
  fg:         '#1A0F2D',
  fgMuted:    '#5C4E6E',
  fgFaint:    'rgba(26,15,45,0.45)',
  card:       '#FFFFFF',
  cardRaised: '#FFFFFF',     // light mode already pops; same as card
  cardMuted:  '#FAEFD8',
  grape:      '#C4A7F5',
  grapeLight: '#E4D6FB',
  grapeDark:  '#7C3AED',
  sky:        '#7CB6F2',
  skyLight:   '#D6E9FC',
  skyDark:    '#2F7CE0',
  sun:        '#FCD34D',
  sunLight:   '#FEF1C3',
  sunDark:    '#F1A92E',
  red:        '#EF4444',
  redLight:   '#FECACA',
  green:      '#22C55E',
  greenLight: '#BBF7D0',
}

const DARK_PALETTE: Palette = {
  // Dark mode = dark background under VIVID pastels (the Mandel pattern).
  // The previous palette darkened every brand variant which turned the
  // hero / goal / tile cards into muddy plum. Now: bg is deep navy-plum,
  // ink stays near-black for borders, but every grape/sky/sun/red/green
  // pastel keeps full saturation so surfaces actually pop. Text rendered
  // ON top of those bright cards uses `ink` (dark) — set explicitly in
  // the components, not flipped on `fg` globally.
  bg:         '#161025',
  ink:        '#0A0517',
  fg:         '#FBF1D9',
  fgMuted:    '#C9BBE0',
  fgFaint:    'rgba(251,241,217,0.60)',
  card:       '#231838',     // neutral dark surface (non-accent cards)
  cardRaised: '#352552',     // lifted lavender-plum so answer options read clearly on bg
  cardMuted:  '#1C1330',     // softer dark surface
  // Brand trio — same hex values as LIGHT mode so a "lavender card"
  // reads as lavender regardless of theme.
  grape:      '#C4A7F5',
  grapeLight: '#E4D6FB',
  grapeDark:  '#7C3AED',
  sky:        '#7CB6F2',
  skyLight:   '#D6E9FC',
  skyDark:    '#2F7CE0',
  sun:        '#FCD34D',
  sunLight:   '#FEF1C3',
  sunDark:    '#F1A92E',
  red:        '#EF4444',
  redLight:   '#FECACA',
  green:      '#22C55E',
  greenLight: '#BBF7D0',
}

const STORAGE_KEY = 'eren_chem_theme'
// Fired on every theme change so components OUTSIDE the provider (the
// room's mission chips) can track it — localStorage 'storage' events only
// fire across tabs, never in the tab that wrote the value.
const THEME_EVENT = 'eren:chem-theme'

function readStored(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch { return null /* localStorage blocked */ }
}

interface ThemeApi {
  theme: Theme
  palette: Palette
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ChemistryThemeContext = createContext<ThemeApi | null>(null)

export function ChemistryThemeProvider({ children }: { children: ReactNode }) {
  // Default to dark to match the rest of the Eren PWA aesthetic on first open.
  // The stored choice is read in the lazy initializer (not an effect) so the
  // first render — and the persist effect's first broadcast below — already
  // carry the real theme. Safe: the overlay never SSRs, it mounts on a tap.
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? 'dark')

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, theme) }
    catch { /* ignore */ }
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [theme])

  const palette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE
  const value: ThemeApi = {
    theme,
    palette,
    toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
    setTheme,
  }
  return createElement(ChemistryThemeContext.Provider, { value }, children)
}

export function useChemistryTheme(): ThemeApi {
  const ctx = useContext(ChemistryThemeContext)
  if (!ctx) throw new Error('useChemistryTheme must be used inside <ChemistryThemeProvider>')
  return ctx
}

/**
 * Read-only view of the persisted chemistry theme for components OUTSIDE
 * the ChemistryThemeProvider (the room's mission chips). Lazy-reads the
 * stored value so the first painted frame is already correct, and stays
 * in sync via the event the provider dispatches on every change.
 * Defaults to 'dark', matching the provider.
 */
export function useStoredChemTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? 'dark')
  useEffect(() => {
    const read = () => setTheme(readStored() ?? 'dark')
    window.addEventListener(THEME_EVENT, read)
    return () => window.removeEventListener(THEME_EVENT, read)
  }, [])
  return theme
}

/** Hard offset shadow ("neo" effect) using the active ink colour. */
export const neoShadow = (ink: string, size: 'sm' | 'md' | 'lg' = 'md'): string => {
  const offset = size === 'sm' ? 2 : size === 'lg' ? 6 : 4
  return `${offset}px ${offset}px 0 0 ${ink}`
}

/** Rounded sans stack matching Amina's Fredoka/ui-rounded fallback. */
export const CHEM_FONT = 'ui-rounded, "Quicksand", "Nunito", system-ui, -apple-system, sans-serif'
