'use client'

// PeriodicTableOverlay — full-screen study experience entered from the
// Chemistry room. Restyled in AminaChemistry's neo-brutalism look:
// cream background, ink outlines, hard offset shadows, brand trio
// (grape/sky/sun). Theme toggles between light cream and a dark plum
// variant via the ChemistryThemeProvider.
//
// Renders through createPortal to document.body so it escapes
// CareSceneHost's z-40 stacking context; without that, no z-index on
// the overlay can rise above StatsHeader at the page root.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import { ChemistryStoreProvider, useChemistryStore } from '@/lib/chemistry/store'
import { ChemistryThemeProvider, useChemistryTheme, neoShadow, CHEM_FONT } from '@/lib/chemistry/theme'
import PeriodicTable from './PeriodicTable'
import Flashcards from './Flashcards'
import Quiz from './Quiz'
import Match from './Match'

type Mode = 'table' | 'flashcards' | 'quiz' | 'match'

const MODES: { id: Mode; label: string }[] = [
  { id: 'table',      label: 'Table' },
  { id: 'flashcards', label: 'Cards' },
  { id: 'quiz',       label: 'Quiz' },
  { id: 'match',      label: 'Match' },
]

interface Props { onClose: () => void }

export default function PeriodicTableOverlay({ onClose }: Props) {
  return (
    <ChemistryStoreProvider>
      <ChemistryThemeProvider>
        <OverlayInner onClose={onClose} />
      </ChemistryThemeProvider>
    </ChemistryStoreProvider>
  )
}

function OverlayInner({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>('table')
  const { dueCount, newCount, state, hydrated } = useChemistryStore()
  const { palette, theme, toggle } = useChemistryTheme()

  function handleClose() { playSound('ui_tap'); onClose() }
  const stop = (e: React.TouchEvent) => e.stopPropagation()

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col"
      style={{
        background: palette.bg,
        color: palette.fg,
        fontFamily: CHEM_FONT,
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
    >
      {/* ── Top bar ── */}
      <header
        className="relative flex items-center gap-2 px-4"
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
          paddingBottom: 12,
          borderBottom: `2px solid ${palette.ink}`,
          background: palette.bg,
        }}
      >
        <h1 style={{
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: -0.3,
          color: palette.fg,
        }}>
          Chemistry
        </h1>

        <div className="ml-auto flex items-center gap-2">
          {hydrated && dueCount > 0 && (
            <Chip bg={palette.sun} ink={palette.ink} text={palette.ink}>
              ⚡ {dueCount} due
            </Chip>
          )}
          {hydrated && state.streak.current > 0 && (
            <Chip bg={palette.grape} ink={palette.ink} text={palette.ink}>
              🔥 {state.streak.current}
            </Chip>
          )}
          <ThemeToggle theme={theme} onToggle={toggle} palette={palette} />
          <CloseButton onClose={handleClose} palette={palette} />
        </div>
      </header>

      {/* ── Mode tabs ── */}
      <nav
        className="relative flex flex-wrap gap-2 px-4 py-3 overflow-x-auto"
        style={{
          background: palette.cardMuted,
          borderBottom: `2px solid ${palette.ink}`,
        }}
      >
        {MODES.map(m => {
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => { playSound('ui_tap'); setMode(m.id) }}
              className="transition-all"
              style={{
                padding: '8px 16px',
                minHeight: 38,
                fontFamily: CHEM_FONT,
                fontSize: 14,
                fontWeight: 700,
                color: active ? palette.ink : palette.fgMuted,
                background: active ? palette.grape : 'transparent',
                border: `2px solid ${active ? palette.ink : 'transparent'}`,
                borderRadius: 999,
                boxShadow: active ? neoShadow(palette.ink, 'sm') : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </nav>

      {/* Optional: stats row showing DUE / NEW / STREAK / MASTERED */}
      {hydrated && (
        <div
          className="relative flex gap-2 px-4 py-3 overflow-x-auto"
          style={{ background: palette.bg, borderBottom: `2px solid ${palette.ink}` }}
        >
          <MiniStat label="Due"      value={dueCount} bg={palette.sunLight}   ink={palette.ink} fg={palette.fg} />
          <MiniStat label="New"      value={newCount} bg={palette.skyLight}   ink={palette.ink} fg={palette.fg} />
          <MiniStat label="Streak"   value={state.streak.current} bg={palette.grapeLight} ink={palette.ink} fg={palette.fg} />
          <MiniStat label="Longest"  value={state.streak.longest} bg={palette.cardMuted} ink={palette.ink} fg={palette.fg} />
        </div>
      )}

      {/* ── Body ── */}
      <main
        className="relative flex-1 overflow-y-auto"
        style={{
          paddingTop: 16,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          background: palette.bg,
        }}
      >
        {mode === 'table'      && <PeriodicTable />}
        {mode === 'flashcards' && <Flashcards />}
        {mode === 'quiz'       && <Quiz />}
        {mode === 'match'      && <Match />}
      </main>
    </div>,
    document.body,
  )
}

function Chip({ bg, ink, text, children }: {
  bg: string; ink: string; text: string; children: React.ReactNode
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '5px 10px',
      borderRadius: 999,
      border: `2px solid ${ink}`,
      background: bg,
      color: text,
      fontSize: 13,
      fontWeight: 700,
      boxShadow: neoShadow(ink, 'sm'),
    }}>
      {children}
    </span>
  )
}

function MiniStat({ label, value, bg, ink, fg }: {
  label: string; value: number; bg: string; ink: string; fg: string
}) {
  return (
    <div style={{
      flex: '1 0 auto',
      minWidth: 64,
      padding: '8px 10px',
      borderRadius: 12,
      border: `2px solid ${ink}`,
      background: bg,
      boxShadow: neoShadow(ink, 'sm'),
      color: fg,
    }}>
      <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 700, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function ThemeToggle({ theme, onToggle, palette }: {
  theme: 'light' | 'dark'
  onToggle: () => void
  palette: ReturnType<typeof useChemistryTheme>['palette']
}) {
  return (
    <button
      type="button"
      onClick={() => { playSound('ui_tap'); onToggle() }}
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      style={{
        width: 40, height: 40,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: palette.card,
        color: palette.fg,
        border: `2px solid ${palette.ink}`,
        borderRadius: 12,
        boxShadow: neoShadow(palette.ink, 'sm'),
      }}
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function CloseButton({ onClose, palette }: {
  onClose: () => void
  palette: ReturnType<typeof useChemistryTheme>['palette']
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close chemistry"
      style={{
        width: 40, height: 40,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: palette.card,
        color: palette.fg,
        border: `2px solid ${palette.ink}`,
        borderRadius: 12,
        boxShadow: neoShadow(palette.ink, 'sm'),
        fontSize: 18,
        fontWeight: 800,
      }}
    >
      ✕
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
