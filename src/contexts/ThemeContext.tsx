'use client'

// ═══════════════════════════════════════════════════════════════════════════
// Theme provider — drives the obsidian accent palette via data-theme on body.
// The actual colors live in CSS variables in globals.css, so palette swaps
// happen instantly without re-rendering every styled component.
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeKey = 'pink' | 'gold' | 'purple'

export const THEMES: Array<{ key: ThemeKey; label: string; swatch: string; swatchHi: string; swatchLo: string }> = [
  { key: 'gold',   label: 'Gold',   swatch: '#D4AF37', swatchHi: '#F2D77A', swatchLo: '#7A5C18' },
  { key: 'purple', label: 'Purple', swatch: '#A78BFA', swatchHi: '#E9D5FF', swatchLo: '#5B21B6' },
  { key: 'pink',   label: 'Pink',   swatch: '#EC4899', swatchHi: '#F9A8D4', swatchLo: '#831843' },
]

const LS_KEY = 'eren_theme'
const DEFAULT: ThemeKey = 'pink'

interface ThemeContextValue {
  theme: ThemeKey
  setTheme: (t: ThemeKey) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readPersisted(): ThemeKey {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'pink' || v === 'gold' || v === 'purple') return v
  } catch { /* ignore */ }
  return DEFAULT
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT)

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const persisted = readPersisted()
    setThemeState(persisted)
  }, [])

  // Apply data-theme to <body> whenever theme changes.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  function setTheme(t: ThemeKey) {
    setThemeState(t)
    try { localStorage.setItem(LS_KEY, t) } catch { /* ignore */ }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
