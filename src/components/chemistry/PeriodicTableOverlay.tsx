'use client'

// PeriodicTableOverlay — full-screen study experience entered from the
// Chemistry room. Chrome is drawn with the shared chemistry pixel kit
// (components/chemistry/pixel): 3px edges, hard offset shadows, Press Start
// 2P labels, so the lab reads as part of the same game as every other room
// instead of an imported study app. Light/dark still toggles — both skins
// are pixel skins.
//
// Renders through createPortal to document.body so it escapes
// CareSceneHost's z-40 stacking context; without that, no z-index on
// the overlay can rise above StatsHeader at the page root.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import { IconFlask, IconLightning, IconFire, IconClose, IconSun, IconMoon } from '@/components/PixelIcons'
import { pixelSkin, hard, PIXEL_FONT, Scanlines, type PixelSkin } from './pixel'
import { ChemistryStoreProvider, useChemistryStore } from '@/lib/chemistry/store'
import { ChemistryThemeProvider, useChemistryTheme, CHEM_FONT } from '@/lib/chemistry/theme'
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
  { id: 'home',       label: 'HOME' },
  { id: 'review',     label: 'REVIEW' },
  { id: 'learn',      label: 'LEARN' },
  { id: 'table',      label: 'TABLE' },
  { id: 'flashcards', label: 'CARDS' },
  { id: 'quiz',       label: 'QUIZ' },
  { id: 'match',      label: 'MATCH' },
  { id: 'speed',      label: 'SPEED' },
  { id: 'locate',     label: 'LOCATE' },
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
  const { theme, toggle } = useChemistryTheme()
  const skin = pixelSkin(theme)

  // Open/close transition. The overlay scales + fades in on mount; closing
  // plays the reverse, then unmounts via onClose once the animation lands
  // (kept self-contained so ChemistryScene still just flips overlayOpen).
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])
  function handleClose() {
    if (closing) return
    playSound('ui_tap')
    setClosing(true)
    closeTimer.current = setTimeout(onClose, 220)
  }
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
        background: skin.bg,
        color: skin.fg,
        fontFamily: CHEM_FONT,
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
      {/* Hide the horizontal scrollbar on the pill strip — Chrome/Safari
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
        /* Each mode swap fades so switching pills (and the first open of the
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

      <Scanlines skin={skin} />

      {/* -- Single sticky top bar, as a pixel slab. Brand flask on the left,
          the mode strip in the middle, chips + theme + close on the right.
          Same construction as every other panel in the app: 3px edge, hard
          offset shadow, Press Start 2P labels. -- */}
      <header
        className="relative flex items-center gap-2.5"
        style={{
          paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
          paddingBottom: 10,
          paddingLeft: 12,
          paddingRight: 12,
          background: skin.panel,
          borderBottom: `3px solid ${skin.edge}`,
          boxShadow: `0 3px 0 ${skin.ink}`,
          position: 'sticky',
          top: 0,
          zIndex: 3,
        }}
      >
        <span aria-label="Chemistry" style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>
          <IconFlask size={26} />
        </span>

        {/* MIDDLE -- scrollable mode strip. Edge fade tells you it scrolls. */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div
            className="chem-pill-strip"
            style={{
              display: 'flex',
              gap: 5,
              overflowX: 'auto',
              scrollSnapType: 'x proximity',
              paddingBottom: 3,
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
                  className="chem-pixel-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    padding: '8px 10px',
                    fontFamily: PIXEL_FONT,
                    fontSize: 7,
                    letterSpacing: 1,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    border: `3px solid ${active ? skin.edge : 'transparent'}`,
                    boxShadow: active ? hard(skin.ink, 2) : 'none',
                    background: active ? skin.gold : 'transparent',
                    color: active ? skin.onAccent : skin.fgDim,
                    scrollSnapAlign: 'start',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          <div aria-hidden style={{
            position: 'absolute',
            right: 0, top: 0, bottom: 3,
            width: 22,
            pointerEvents: 'none',
            background: `linear-gradient(to right, transparent, ${skin.panel})`,
          }} />
        </div>

        {/* RIGHT -- due / streak chips, then theme + close. */}
        <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
          {hydrated && dueCount > 0 && (
            <PixelChip skin={skin} accent="#FCD34D">
              <IconLightning size={11} />
              {dueCount}
            </PixelChip>
          )}
          {hydrated && state.streak.current > 0 && (
            <PixelChip skin={skin} accent="#C4A7F5">
              <IconFire size={11} />
              {state.streak.current}
            </PixelChip>
          )}
          <SquareButton
            skin={skin}
            onClick={() => { playSound('ui_toggle'); toggle() }}
            label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? <IconMoon size={15} /> : <IconSun size={15} />}
          </SquareButton>
          <SquareButton skin={skin} onClick={handleClose} label="Close chemistry">
            <IconClose size={15} tone={skin.fgDim} />
          </SquareButton>
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
    document.body,
  )
}

// Pixel chip for the due / streak counters in the header.
function PixelChip({ skin, accent, children }: {
  skin: PixelSkin; accent: string; children: React.ReactNode
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 7px',
      background: accent,
      color: skin.onAccent,
      border: `2px solid ${skin.edge}`,
      boxShadow: hard(skin.ink, 2),
      fontFamily: PIXEL_FONT,
      fontSize: 7,
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function SquareButton({ skin, onClick, label, children }: {
  skin: PixelSkin; onClick: () => void; label: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="chem-pixel-btn"
      style={{
        width: 32, height: 32, display: 'grid', placeItems: 'center',
        background: skin.raised,
        border: `3px solid ${skin.edge}`,
        boxShadow: hard(skin.ink, 2),
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
