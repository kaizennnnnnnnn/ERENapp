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

interface Props { onClose: () => void }

export default function PeriodicTableOverlay({ onClose }: Props) {
  function handleClose() {
    playSound('ui_tap')
    onClose()
  }
  // stopPropagation at the root: any touch inside the overlay is "ours"
  // and must not bubble up to CareSceneHost's room-swipe gesture detector.
  const stop = (e: React.TouchEvent) => e.stopPropagation()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: '#0A140A',
        touchAction: 'pan-y',
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

      {/* ── Body: phase-1 placeholder ── */}
      <main
        className="relative flex-1 overflow-y-auto px-4"
        style={{
          paddingTop: 24,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto max-w-sm text-center" style={{ paddingTop: 40 }}>
          <p className="font-pixel" style={{ fontSize: 8, color: '#BEF264', letterSpacing: 1.5, marginBottom: 14 }}>
            PHASE 1 · ENTRY READY
          </p>
          <p className="font-pixel" style={{ fontSize: 7, color: '#E8FAD0', lineHeight: 1.8, letterSpacing: 0.5 }}>
            the 118-element table, study modes,<br />
            daily missions and stats will land here<br />
            in the next steps.
          </p>
        </div>
      </main>
    </div>
  )
}
