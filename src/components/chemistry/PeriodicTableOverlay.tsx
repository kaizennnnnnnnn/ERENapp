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
import { playSound } from '@/lib/sounds'
import { ChemistryStoreProvider, useChemistryStore } from '@/lib/chemistry/store'
import { ChemistryThemeProvider, useChemistryTheme, neoShadow, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { useTasks } from '@/contexts/TaskContext'
import { getDailyKey } from '@/lib/tasks'
import PeriodicTable from './PeriodicTable'
import Flashcards from './Flashcards'
import Quiz from './Quiz'
import Match from './Match'

type Mode = 'table' | 'flashcards' | 'quiz' | 'match'

// The full mode roadmap. Live ones map to real screens; 'soon' ones render
// as disabled pills with a sun-yellow dot so the user sees what's coming
// without us having to refactor the header every time a screen lands.
// Order = frequency-of-use, left to right.
type ModeStatus = 'live' | 'soon'
interface ModeDef { id: string; label: string; status: ModeStatus }
const MODES: ModeDef[] = [
  { id: 'review',     label: 'Review',     status: 'soon' },
  { id: 'learn',      label: 'Learn',      status: 'soon' },
  { id: 'table',      label: 'Table',      status: 'live' },
  { id: 'flashcards', label: 'Cards',      status: 'live' },
  { id: 'quiz',       label: 'Quiz',       status: 'live' },
  { id: 'match',      label: 'Match',      status: 'live' },
  { id: 'speed',      label: 'Speed',      status: 'soon' },
  { id: 'locate',     label: 'Locate',     status: 'soon' },
]
const LIVE_MODES = new Set<string>(['table', 'flashcards', 'quiz', 'match'])

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
        {/* LEFT — wordmark */}
        <h1 style={{
          flexShrink: 0,
          fontWeight: 900,
          fontSize: 18,
          letterSpacing: -0.4,
          background: `linear-gradient(135deg, ${palette.grapeDark}, ${palette.sunDark})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Chemistry
        </h1>

        {/* MIDDLE — scrollable pill strip, every mode visible */}
        <div
          className="chem-pill-strip"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            scrollSnapType: 'x proximity',
            paddingBottom: 2,
          }}
        >
          {MODES.map(m => {
            const active = mode === m.id
            const live   = m.status === 'live'
            return (
              <button
                key={m.id}
                ref={el => { pillRefs.current[m.id] = el }}
                type="button"
                disabled={!live}
                onClick={() => {
                  if (!live) return
                  playSound('ui_tap')
                  setMode(m.id as Mode)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 0,
                  padding: '8px 14px',
                  fontFamily: CHEM_FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  borderRadius: 999,
                  border: 'none',
                  background: active ? palette.grape : 'transparent',
                  color: active ? palette.ink
                       : live   ? palette.fg
                       :          palette.fgFaint,
                  opacity: live ? 1 : 0.55,
                  cursor: live ? 'pointer' : 'not-allowed',
                  scrollSnapAlign: 'start',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
              >
                {!live && (
                  <span aria-hidden style={{
                    width: 6, height: 6, borderRadius: 999,
                    background: palette.sun, flexShrink: 0,
                  }} />
                )}
                {m.label}
              </button>
            )
          })}
        </div>

        {/* RIGHT — chips + theme + close, restyled soft (no ink border, no offset shadow) */}
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          {hydrated && dueCount > 0 && (
            <SoftChip bg={palette.sunLight} text={palette.sunDark}>
              ⚡ {dueCount}
            </SoftChip>
          )}
          {hydrated && state.streak.current > 0 && (
            <SoftChip bg={palette.grapeLight} text={palette.grapeDark}>
              🔥 {state.streak.current}
            </SoftChip>
          )}
          <ThemeToggle theme={theme} onToggle={toggle} palette={palette} />
          <CloseButton onClose={handleClose} palette={palette} />
        </div>
      </header>

      {/* Today's missions — two daily reward chips. Replace the older
          stats strip; Due / Streak are already in the header chips and
          the SRS detail lives inside each mode. */}
      {hydrated && <MissionStrip palette={palette} />}

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

// Mandel-soft chip used in the new top-header. No ink border, no offset
// shadow — just a tinted fill + matching dark text colour. Caller picks the
// (bg, text) pair so we can get sunLight/sunDark for "due", grapeLight/
// grapeDark for "streak", etc.
function SoftChip({ bg, text, children }: {
  bg: string; text: string; children: React.ReactNode
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '5px 10px',
      borderRadius: 999,
      background: bg,
      color: text,
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function MissionStrip({ palette }: { palette: Palette }) {
  const { completedIds } = useTasks()
  const dailyKey = getDailyKey()
  const lessonDone = completedIds.has(`daily_chem_lesson:${dailyKey}`)
  const streakDone = completedIds.has(`daily_chem_streak:${dailyKey}`)
  return (
    <div
      className="relative flex gap-2 px-4 py-3 overflow-x-auto"
      style={{ background: palette.bg, borderBottom: `2px solid ${palette.ink}` }}
    >
      <MissionCard
        icon="📚"
        title="Finish a lesson"
        sub={lessonDone ? 'Claimed · +10 coins' : 'Reward: 10 coins, 15 xp'}
        done={lessonDone}
        accent={palette.sun}
        palette={palette}
      />
      <MissionCard
        icon="🔥"
        title="5 in a row"
        sub={streakDone ? 'Claimed · +15 coins' : 'Reward: 15 coins, 20 xp'}
        done={streakDone}
        accent={palette.grape}
        palette={palette}
      />
    </div>
  )
}

function MissionCard({ icon, title, sub, done, accent, palette }: {
  icon: string
  title: string
  sub: string
  done: boolean
  accent: string
  palette: Palette
}) {
  return (
    <div
      style={{
        flex: '1 1 0%',
        minWidth: 140,
        padding: '10px 12px',
        borderRadius: 14,
        border: `2px solid ${palette.ink}`,
        background: done ? accent : palette.card,
        boxShadow: neoShadow(palette.ink, 'sm'),
        color: palette.fg,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        opacity: done ? 0.95 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 34, height: 34,
          display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 10,
          border: `2px solid ${palette.ink}`,
          background: done ? palette.card : accent,
          fontSize: 18,
          boxShadow: neoShadow(palette.ink, 'sm'),
        }}
      >
        {done ? '✓' : icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.2,
          color: done ? palette.ink : palette.fg,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          opacity: 0.7,
          color: done ? palette.ink : palette.fgMuted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {sub}
        </div>
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
        width: 34, height: 34,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: palette.cardMuted,
        color: palette.fg,
        border: 'none',
        borderRadius: 999,
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
        width: 34, height: 34,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: palette.cardMuted,
        color: palette.fg,
        border: 'none',
        borderRadius: 999,
        fontSize: 16,
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
