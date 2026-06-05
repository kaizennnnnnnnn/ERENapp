'use client'

// PeriodicTableOverlay — full-screen study experience entered from the
// Chemistry room. Phase 1: scaffold + close button only; the table, study
// modes, and daily missions land in subsequent phases.
//
// Mobile notes (kept here so we don't relearn them per phase):
//   • All touch events are stopped at the root so they never reach
//     CareSceneHost's swipe handler — otherwise pulling/scrolling inside
//     the overlay would silently navigate to the next room.
//   • Layout uses safe-area-inset-* so the top bar clears the iOS notch
//     and the bottom doesn't sit under the home indicator.
//   • touch-action: pan-y allows vertical scrolling for the table grid
//     once it lands, while blocking horizontal swipe-nav inside the
//     overlay too.
//   • No fixed pixel widths over 360 — the design has to flow on a 320-px
//     iPhone SE and still feel right.

import { playSound } from '@/lib/sounds'
import PeriodicTable from './PeriodicTable'

interface Props { onClose: () => void }

export default function PeriodicTableOverlay({ onClose }: Props) {
  function handleClose() {
    playSound('ui_tap')
    onClose()
  }
  // stopPropagation at the root: any touch inside the overlay is "ours"
  // and must not bubble up to CareSceneHost's room-swipe gesture detector.
  // We leave touch-action loose ('manipulation') so the table's horizontal
  // scroll + the body's vertical scroll both work natively; propagation
  // is killed here so nothing leaks.
  const stop = (e: React.TouchEvent) => e.stopPropagation()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
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
        <h1
          className="font-pixel"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: '#BEF264',
            textShadow: '0 0 6px rgba(132,204,22,0.55)',
          }}
        >
          PERIODIC TABLE
        </h1>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close periodic table"
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

      {/* ── Body: periodic table ── */}
      <main
        className="relative flex-1 overflow-y-auto"
        style={{
          paddingTop: 16,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <PeriodicTable />
      </main>
    </div>
  )
}
