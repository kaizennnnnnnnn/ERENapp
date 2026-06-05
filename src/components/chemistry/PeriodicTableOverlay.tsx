'use client'

// PeriodicTableOverlay — full-screen study experience entered from the
// Chemistry room. Holds the top bar (title + ✕), the mode tabs (Browse
// table / Flashcards / future modes), and renders whichever mode is
// active. Daily missions ride on top of this once phase 6 lands.
//
// Mobile notes (kept here so we don't relearn them per phase):
//   • All touch events are stopped at the root so they never reach
//     CareSceneHost's swipe handler — otherwise pulling/scrolling inside
//     the overlay would silently navigate to the next room.
//   • Layout uses safe-area-inset-* so the top bar clears the iOS notch
//     and the bottom doesn't sit under the home indicator.
//   • touch-action: manipulation keeps both vertical scroll (the body)
//     and horizontal scroll (the table grid) working natively, while
//     killing pinch-zoom.
//   • No fixed pixel widths over 360 — the design has to flow on a 320-px
//     iPhone SE and still feel right.

import { useState } from 'react'
import { playSound } from '@/lib/sounds'
import { ChemistryStoreProvider, useChemistryStore } from '@/lib/chemistry/store'
import PeriodicTable from './PeriodicTable'
import Flashcards from './Flashcards'
import Quiz from './Quiz'
import Match from './Match'

type Mode = 'table' | 'flashcards' | 'quiz' | 'match'

const MODES: { id: Mode; label: string }[] = [
  { id: 'table',      label: 'TABLE' },
  { id: 'flashcards', label: 'CARDS' },
  { id: 'quiz',       label: 'QUIZ' },
  { id: 'match',      label: 'MATCH' },
]

interface Props { onClose: () => void }

export default function PeriodicTableOverlay({ onClose }: Props) {
  return (
    <ChemistryStoreProvider>
      <OverlayInner onClose={onClose} />
    </ChemistryStoreProvider>
  )
}

function OverlayInner({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>('table')
  const { dueCount, hydrated } = useChemistryStore()

  function handleClose() {
    playSound('ui_tap')
    onClose()
  }
  // stopPropagation at the root: any touch inside the overlay is "ours"
  // and must not bubble up to CareSceneHost's room-swipe gesture detector.
  const stop = (e: React.TouchEvent) => e.stopPropagation()

  return (
    <div
      // z-[80] sits above StatsHeader (z-60) and the CareSceneHost
      // bottom dots (z-50) so the chemistry takeover actually takes over.
      className="fixed inset-0 z-[80] flex flex-col"
      style={{
        background: '#0A140A',
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
    >
      {/* Subtle CRT-scanlines, same effect used elsewhere on dark surfaces */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)',
      }} />

      {/* ── Top bar: title + close ── */}
      <header
        className="relative flex items-center justify-between px-4"
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
          paddingBottom: 12,
          borderBottom: '2px solid #3F6212',
          background: 'rgba(132, 204, 22, 0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          <h1
            className="font-pixel"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: '#BEF264',
              textShadow: '0 0 6px rgba(132,204,22,0.55)',
            }}
          >
            CHEMISTRY
          </h1>
          {/* Due-count chip — only shown when the store is hydrated AND
              there's at least one card waiting. Quiet otherwise to avoid
              flashing a "0 DUE" placeholder on first open. */}
          {hydrated && dueCount > 0 && (
            <span style={{
              padding: '4px 8px',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 6,
              letterSpacing: 1,
              color: '#0A140A',
              background: '#BEF264',
              border: '2px solid #84CC16',
              borderRadius: 3,
              boxShadow: '1px 1px 0 #050a02',
            }}>
              {dueCount} DUE
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close chemistry overlay"
          className="active:translate-y-[1px] transition-transform"
          style={{
            minWidth: 44, minHeight: 44,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#1A2E05',
            border: '2px solid #84CC16',
            borderRadius: 3,
            boxShadow: '2px 2px 0 #050a02',
            color: '#BEF264',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 10,
            letterSpacing: 1,
          }}
        >
          ✕
        </button>
      </header>

      {/* ── Mode tabs — wrap on narrow screens, never overflow horizontally ── */}
      <nav className="relative flex justify-center flex-wrap gap-2 px-3 py-3">
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => { playSound('ui_tap'); setMode(m.id) }}
            className="active:translate-y-[1px] transition-transform"
            style={{
              padding: '7px 10px',
              minHeight: 34,
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 6.5,
              letterSpacing: 1.2,
              color: mode === m.id ? '#0A140A' : '#BEF264',
              background: mode === m.id ? '#BEF264' : '#1A2E05',
              border: '2px solid #84CC16',
              borderRadius: 3,
              boxShadow: mode === m.id ? 'inset 1px 1px 0 rgba(0,0,0,0.18)' : '2px 2px 0 #050a02',
            }}
          >
            {m.label}
          </button>
        ))}
      </nav>

      {/* ── Body: active mode ── */}
      <main
        className="relative flex-1 overflow-y-auto"
        style={{
          paddingTop: 4,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {mode === 'table'      && <PeriodicTable />}
        {mode === 'flashcards' && <Flashcards />}
        {mode === 'quiz'       && <Quiz />}
        {mode === 'match'      && <Match />}
      </main>
    </div>
  )
}
