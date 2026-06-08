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

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Zap, Flame, X as XIcon, Sun, Moon, Atom } from 'lucide-react'
import { playSound } from '@/lib/sounds'
import { ChemistryStoreProvider, useChemistryStore } from '@/lib/chemistry/store'
import { ChemistryThemeProvider, useChemistryTheme, neoShadow, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import PeriodicTable from './PeriodicTable'
import Flashcards from './Flashcards'
import Quiz from './Quiz'
import Match from './Match'
import HomeDashboard from './HomeDashboard'
import Review from './Review'
import Learn from './Learn'
import Speed from './Speed'
import Locate from './Locate'

type Mode = 'home' | 'review' | 'learn' | 'table' | 'flashcards' | 'quiz' | 'match' | 'speed' | 'locate'

// Header pill strip — order = frequency of use, left to right.
interface ModeDef { id: Mode; label: string }
const MODES: ModeDef[] = [
  { id: 'home',       label: 'Home' },
  { id: 'review',     label: 'Review' },
  { id: 'learn',      label: 'Learn' },
  { id: 'table',      label: 'Table' },
  { id: 'flashcards', label: 'Cards' },
  { id: 'quiz',       label: 'Quiz' },
  { id: 'match',      label: 'Match' },
  { id: 'speed',      label: 'Speed' },
  { id: 'locate',     label: 'Locate' },
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
  const [mode, setMode] = useState<Mode>('home')
  const { dueCount, state, hydrated } = useChemistryStore()
  const { palette, theme, toggle } = useChemistryTheme()

  function handleClose() { playSound('ui_tap'); onClose() }
  const stop = (e: React.TouchEvent) => e.stopPropagation()

  // Auto-scroll the active pill into the middle of the strip whenever the
  // mode changes (e.g. tapping a pill near the edge keeps it visible). The
  // ref array follows MODES order; we look up the pill for the current id.
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  useEffect(() => {
    const el = pillRefs.current[mode]
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [mode])

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
      {/* Hide the horizontal scrollbar on the pill strip — Chrome/Safari
          via ::-webkit-scrollbar, Firefox via scrollbar-width. Scoped by
          class so it doesn't leak. */}
      <style>{`
        .chem-pill-strip::-webkit-scrollbar { display: none; }
        .chem-pill-strip { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      {/* ── Single sticky top bar — left wordmark, middle scrollable pill
          strip with every mode, right zone with chips + theme + close.
          Mandel-soft: no ink border, no offset shadow, rounded chips. */}
      <header
        className="relative flex items-center gap-3"
        style={{
          paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
          paddingBottom: 10,
          paddingLeft: 14,
          paddingRight: 14,
          background: palette.bg,
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        {/* LEFT — brand mark. An atom logo badge in the slot where the
            "Chemistry" wordmark used to live: grape fill, ink outline + hard
            offset shadow to match the neo-brutalism chips on the right. A
            glowing sun-coloured nucleus sits behind the orbits for a pop of
            colour inside. */}
        <div
          aria-label="Chemistry"
          style={{
            flexShrink: 0,
            width: 34, height: 34,
            borderRadius: 999,
            background: palette.grape,
            border: `2px solid ${palette.ink}`,
            boxShadow: neoShadow(palette.ink, 'sm'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: palette.ink,
            position: 'relative',
          }}
        >
          <span style={{
            position: 'absolute', inset: 0, margin: 'auto',
            width: 10, height: 10, borderRadius: 999,
            background: palette.sun,
            boxShadow: `0 0 4px 1px ${palette.sunDark}`,
          }} />
          <Atom size={21} strokeWidth={2.4} style={{ position: 'relative' }} />
        </div>

        {/* MIDDLE — scrollable pill strip, live modes only. Edge-fade
            gradient on the right edge tells the user it scrolls. */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div
            className="chem-pill-strip"
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              scrollSnapType: 'x proximity',
              paddingBottom: 2,
            }}
          >
            {MODES.map(m => {
              const active = mode === m.id
              return (
                <button
                  key={m.id}
                  ref={el => { pillRefs.current[m.id] = el }}
                  type="button"
                  onClick={() => { playSound('ui_tap'); setMode(m.id) }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    padding: '7px 13px',
                    fontFamily: CHEM_FONT,
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    borderRadius: 999,
                    border: active ? `2px solid ${palette.ink}` : '2px solid transparent',
                    boxShadow: active ? neoShadow(palette.ink, 'sm') : 'none',
                    background: active ? palette.grape : 'transparent',
                    color: active ? palette.ink : palette.fg,
                    scrollSnapAlign: 'start',
                    transition: 'background 120ms ease, color 120ms ease',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          {/* Right-edge fade so a half-clipped pill reads as "more to scroll" */}
          <div aria-hidden style={{
            position: 'absolute',
            right: 0, top: 0, bottom: 2,
            width: 24,
            pointerEvents: 'none',
            background: `linear-gradient(to right, transparent, ${palette.bg})`,
          }} />
        </div>

        {/* RIGHT — chips + theme + close, restyled soft (no ink border, no offset shadow) */}
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          {hydrated && dueCount > 0 && (
            <SoftChip bg={palette.sunLight} text={palette.sunDark} ink={palette.ink}>
              <Zap size={12} strokeWidth={2.6} />
              {dueCount}
            </SoftChip>
          )}
          {hydrated && state.streak.current > 0 && (
            <SoftChip bg={palette.grapeLight} text={palette.grapeDark} ink={palette.ink}>
              <Flame size={12} strokeWidth={2.4} />
              {state.streak.current}
            </SoftChip>
          )}
          <ThemeToggle theme={theme} onToggle={toggle} palette={palette} />
          <CloseButton onClose={handleClose} palette={palette} />
        </div>
      </header>

      {/* Daily missions moved OUT of this overlay — they now live in the
          ChemistryScene room so the user sees them before entering the
          lab. The lab itself shows the SRS dashboard / mode tile grid. */}

      {/* ── Body ── */}
      <main
        className="relative flex-1 overflow-y-auto"
        style={{
          paddingTop: 16,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          background: palette.bg,
        }}
      >
        {mode === 'home'       && <HomeDashboard palette={palette} onGoto={setMode} />}
        {mode === 'review'     && <Review onExit={() => setMode('home')} />}
        {mode === 'learn'      && <Learn  onExit={() => setMode('home')} />}
        {mode === 'table'      && <PeriodicTable />}
        {mode === 'flashcards' && <Flashcards />}
        {mode === 'quiz'       && <Quiz />}
        {mode === 'match'      && <Match />}
        {mode === 'speed'      && <Speed  onExit={() => setMode('home')} />}
        {mode === 'locate'     && <Locate onExit={() => setMode('home')} />}
      </main>
    </div>,
    document.body,
  )
}

// Mandel-soft chip used in the new top-header. No ink border, no offset
// shadow — just a tinted fill + matching dark text colour. Caller picks the
// (bg, text) pair so we can get sunLight/sunDark for "due", grapeLight/
// grapeDark for "streak", etc.
function SoftChip({ bg, text, ink, children }: {
  bg: string; text: string; ink: string; children: React.ReactNode
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '5px 9px',
      borderRadius: 999,
      background: bg,
      color: text,
      fontSize: 12,
      fontWeight: 800,
      whiteSpace: 'nowrap',
      lineHeight: 1,
      border: `2px solid ${ink}`,
      boxShadow: neoShadow(ink, 'sm'),
    }}>
      {children}
    </span>
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
        width: 34, height: 34,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: palette.card,
        color: palette.fg,
        border: `2px solid ${palette.ink}`,
        boxShadow: neoShadow(palette.ink, 'sm'),
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      {theme === 'light' ? <Moon size={16} strokeWidth={2.4} /> : <Sun size={16} strokeWidth={2.4} />}
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
        width: 34, height: 34,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: palette.card,
        color: palette.fg,
        border: `2px solid ${palette.ink}`,
        boxShadow: neoShadow(palette.ink, 'sm'),
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      <XIcon size={16} strokeWidth={2.6} />
    </button>
  )
}
