'use client'

// PeriodicTableOverlay — full-screen study experience entered from the
// Chemistry room. A Meadow page on the lilac ground: the lab's name and a
// close circle on top, the modes as a scrolling row of chips under it. The
// theme is pinned to light — Meadow has no dark, and the modes' light
// palette is the one that sits on this ground.
//
// Portal beside the room and StatsHeader, inside the app frame. Meadow
// sheets use that same host, so element details can rise above the lab.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import { IconFlask } from '@/components/PixelIcons'
import { ChemistryStoreProvider, useChemistryStore } from '@/lib/chemistry/store'
import { ChemistryThemeProvider, useChemistryTheme } from '@/lib/chemistry/theme'
import { Chip, FONT_ROUNDED, M, MeadowIcon, RoundButton, Tag } from '@/components/meadow'
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
      <ChemistryThemeProvider forced="light">
        <OverlayInner onClose={onClose} />
      </ChemistryThemeProvider>
    </ChemistryStoreProvider>
  )
}

function OverlayInner({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>('home')
  const { dueCount, state, hydrated } = useChemistryStore()
  const { palette } = useChemistryTheme()

  // Open/close transition. The overlay scales + fades in on mount; closing
  // plays the reverse, then unmounts via onClose once the animation lands
  // (kept self-contained so ChemistryScene still just flips overlayOpen).
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])
  function handleClose() {
    if (closing) return
    playSound('ui_modal_close')
    setClosing(true)
    closeTimer.current = setTimeout(onClose, 220)
  }
  const stop = (e: React.TouchEvent) => e.stopPropagation()

  // Auto-scroll the active pill into the middle of the strip whenever the
  // mode changes (e.g. tapping a pill near the edge keeps it visible). The
  // ref array follows MODES order; we look up the pill for the current id.
  const pillRefs = useRef<Record<string, HTMLSpanElement | null>>({})
  useEffect(() => {
    const el = pillRefs.current[mode]
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [mode])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="meadow-root fixed inset-0 z-[80] flex flex-col"
      style={{
        background: palette.bg,
        color: M.text,
        fontFamily: FONT_ROUNDED,
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        transformOrigin: 'center',
        willChange: 'transform, opacity',
        animation: closing
          ? 'chemOverlayOut 200ms cubic-bezier(0.4, 0, 1, 1) forwards'
          : 'chemOverlayIn 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
    >
      {/* Hide the horizontal scrollbar on the chip strip — Chrome/Safari
          via ::-webkit-scrollbar, Firefox via scrollbar-width. Scoped by
          class so it doesn't leak. */}
      <style>{`
        .chem-pill-strip::-webkit-scrollbar { display: none; }
        .chem-pill-strip { scrollbar-width: none; -ms-overflow-style: none; }
        @keyframes chemOverlayIn {
          0%   { opacity: 0; transform: scale(0.94); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes chemOverlayOut {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.96); }
        }
        /* Each mode swap fades so switching chips (and the first open of the
           lab body) is a soft cross-in, never an instant blink. Keyed on the
           mode below so it re-runs on every switch.
           OPACITY ONLY — deliberately no transform: a residual transform on
           this wrapper would make it the containing block for position:fixed
           descendants, and ElementDetail (the tile popup, rendered inline
           inside <PeriodicTable/>) is fixed inset-0. A translateY here re-
           anchored that popup to the wrapper box instead of the viewport. */
        @keyframes chemModeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* -- Sticky top: the lab's name, due / streak tags and the close
          circle, then the modes as a row of chips. On the page's own ground,
          the way every Meadow page carries its title. -- */}
      <header
        className="relative flex flex-col"
        style={{
          paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
          paddingBottom: 10,
          background: palette.bg,
          position: 'sticky',
          top: 0,
          zIndex: 3,
        }}
      >
        <div className="flex items-center" style={{ gap: 8, padding: '0 16px' }}>
          <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
            width: 40, height: 40, borderRadius: 14, background: '#FFFFFF',
          }}>
            <IconFlask size={24} />
          </span>
          <h1 className="flex-1 min-w-0" style={{ margin: '0 0 0 2px', fontSize: 24, lineHeight: 1.2, fontWeight: 800, color: M.text }}>
            Lab
          </h1>
          {hydrated && dueCount > 0 && (
            <Tag tone="amber" icon={<MeadowIcon name="bolt" size={16} />} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {dueCount} due
            </Tag>
          )}
          {hydrated && state.streak.current > 0 && (
            <Tag tone="soft" icon={<MeadowIcon name="flame" size={16} />}
              style={{ background: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
              {state.streak.current}
            </Tag>
          )}
          <RoundButton surface="ground" size={40} ariaLabel="Close the lab" onClick={handleClose}>
            <MeadowIcon name="close" size={20} color={M.text} />
          </RoundButton>
        </div>

        {/* The modes — a scrolling chip row. The edge fade says it scrolls. */}
        <div style={{ position: 'relative', marginTop: 12 }}>
          <div className="chem-pill-strip" aria-label="Lab modes" style={{
            display: 'flex', gap: 6, overflowX: 'auto', scrollSnapType: 'x proximity', padding: '0 16px 3px',
          }}>
            {MODES.map(m => {
              const active = mode === m.id
              return (
                <span key={m.id} ref={el => { pillRefs.current[m.id] = el }} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                  <Chip selected={active} onClick={() => { if (!active) { playSound('ui_tap'); setMode(m.id) } }}
                    style={active ? undefined : { borderColor: 'transparent' }}>
                    {m.label}
                  </Chip>
                </span>
              )
            })}
          </div>
          <div aria-hidden style={{
            position: 'absolute', right: 0, top: 0, bottom: 3, width: 24, pointerEvents: 'none',
            background: `linear-gradient(to right, transparent, ${palette.bg})`,
          }} />
        </div>
      </header>

      {/* Daily missions moved OUT of this overlay — they now live in the
          ChemistryScene room so the user sees them before entering the
          lab. The lab itself shows the SRS dashboard / mode tile grid. */}

      {/* ── Body ── */}
      <main
        className="relative flex-1 overflow-y-auto"
        style={{
          paddingTop: 6,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          zIndex: 2,
        }}
      >
        {/* Keyed on `mode` so React remounts on every swap and chemModeIn
            replays — the new mode rises in instead of hard-cutting. */}
        <div key={mode} style={{ animation: 'chemModeIn 240ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
          {mode === 'home'       && <HomeDashboard onGoto={setMode} />}
          {mode === 'review'     && <Review onExit={() => setMode('home')} />}
          {mode === 'learn'      && <Learn  onExit={() => setMode('home')} />}
          {mode === 'table'      && <PeriodicTable />}
          {mode === 'flashcards' && <Flashcards />}
          {mode === 'quiz'       && <Quiz />}
          {mode === 'match'      && <Match />}
          {mode === 'speed'      && <Speed  onExit={() => setMode('home')} />}
          {mode === 'locate'     && <Locate onExit={() => setMode('home')} />}
        </div>
      </main>
    </div>,
    document.querySelector('.app-container') ?? document.body,
  )
}
