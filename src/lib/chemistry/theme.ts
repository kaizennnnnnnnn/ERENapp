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
  // Bumped a step lighter end-to-end based on user feedback: previous bg
  // (#1A1124) was too dark to read counter text inside the progress bar
  // / streak pill, and the card surfaces blended into the bg. Pushing the
  // whole surface stack a step brighter while keeping ink (border +
  // shadow colour) near-black preserves the neo-brutalism contrast.
  bg:         '#291C40',
  ink:        '#0A0517',
  fg:         '#FBF1D9',
  fgMuted:    '#D2C2E6',
  fgFaint:    'rgba(251,241,217,0.62)',
  card:       '#3A2A58',
  cardMuted:  '#2F2148',
  grape:      '#C4A7F5',
  grapeLight: '#3F2A5E',
  grapeDark:  '#9F7BE8',
  sky:        '#7CB6F2',
  skyLight:   '#1F3950',
  skyDark:    '#5A9DDF',
  sun:        '#FCD34D',
  sunLight:   '#4A3C13',
  sunDark:    '#E5BE3E',
  red:        '#FCA5A5',
  redLight:   '#4B1414',
  green:      '#86EFAC',
  greenLight: '#0F3D1F',
}

const STORAGE_KEY = 'eren_chem_theme'

interface ThemeApi {
  theme: Theme
  palette: Palette
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ChemistryThemeContext = createContext<ThemeApi | null>(null)

export function ChemistryThemeProvider({ children }: { children: ReactNode }) {
  // Default to dark to match the rest of the Eren PWA aesthetic on first open.
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch { /* localStorage blocked → keep default */ }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(STORAGE_KEY, theme) }
    catch { /* ignore */ }
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

/** Hard offset shadow ("neo" effect) using the active ink colour. */
export const neoShadow = (ink: string, size: 'sm' | 'md' | 'lg' = 'md'): string => {
  const offset = size === 'sm' ? 2 : size === 'lg' ? 6 : 4
  return `${offset}px ${offset}px 0 0 ${ink}`
}

/** Rounded sans stack matching Amina's Fredoka/ui-rounded fallback. */
export const CHEM_FONT = 'ui-rounded, "Quicksand", "Nunito", system-ui, -apple-system, sans-serif'
