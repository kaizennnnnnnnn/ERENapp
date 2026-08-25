'use client'

// ─── ParlourCase ────────────────────────────────────────────────────────────
// The display case: today's tray of five, behind glass.
//
// This replaces a row of white rounded squares with padlocks in them. The
// problem with that row wasn't the lock icon, it was that an empty slot looked
// like a UI placeholder — so four fifths of the hero element read as "nothing
// here yet".
//
// The fix that stuck: an empty slot is an ALCOVE with the jelly still in it,
// just unlit. Each flavour keeps its own hue at a fraction of its brightness,
// so an empty case reads as five jellies waiting in the dark rather than as a
// black rectangle with ghosts in it — you can still see which flavour is
// missing, which is the thing the player actually wants to know. Winning one
// switches its alcove light on, and the difference between lit and unlit is
// the whole readout.
//
// Construction, bottom to top: stained frame → dark interior → a warm shelf
// glow → the five alcoves → one diagonal glare across the glass → brass rail.
// The glare is what sells "behind glass"; without it the case is just a dark
// box with fruit in it.

import { memo } from 'react'
import type { JellyDef } from '@/lib/jellies'
import {
  INK, CREAM, CREAM_DIM, WOOD, WOOD_DK, WOOD_LT, CASE_IN, CASE_IN_LT,
  BRASS, BRASS_LT, BRASS_DK, dropShadow,
} from './parlourTheme'

interface Props {
  tray: { jelly: JellyDef; filled: boolean }[]
  count: number
  size: number
  /** Ownership is still being confirmed — draw the case, not a wrong answer. */
  loading?: boolean
}

const ParlourCase = memo(function ParlourCase({ tray, count, size, loading = false }: Props) {
  const full = count >= size

  return (
    <div className="relative" style={{
      borderRadius: 10,
      background: `linear-gradient(180deg, ${WOOD_LT} 0%, ${WOOD} 40%, ${WOOD_DK} 100%)`,
      border: `3px solid ${INK}`,
      boxShadow: dropShadow(5),
      padding: 7,
    }}>
      {/* ── Enamel plate on the top rail ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1" style={{
        top: -11, zIndex: 3,
        background: full
          ? `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})`
          : `linear-gradient(180deg, ${CREAM}, ${CREAM_DIM})`,
        borderRadius: 5, border: `2.5px solid ${INK}`, boxShadow: dropShadow(2),
      }}>
        <span className="font-pixel" style={{ fontSize: 6.5, color: INK, letterSpacing: 0.6 }}>
          {full ? 'TRAY COMPLETE' : "TODAY'S TRAY"}
        </span>
        <span className="font-pixel" style={{ fontSize: 6.5, color: full ? INK : '#A8836C' }}>
          {count}/{size}
        </span>
      </div>

      {/* ── Inside the case ── */}
      <div className="relative overflow-hidden" style={{
        borderRadius: 5,
        background: `linear-gradient(180deg, ${CASE_IN} 0%, ${CASE_IN_LT} 78%, ${CASE_IN} 100%)`,
        border: `2px solid ${INK}`,
        paddingTop: 11,
      }}>
        {/* Warm light pooling up from the shelf. */}
        <span aria-hidden style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%',
          background: 'radial-gradient(72% 100% at 50% 100%, rgba(255,196,120,0.4) 0%, rgba(255,196,120,0) 74%)',
        }} />
        {/* CRT scanlines — the app's dark-panel texture, so the case belongs to
            the same world as the leaderboards and the reward road. */}
        <span aria-hidden style={{
          position: 'absolute', inset: 0, opacity: 0.45,
          background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
        }} />

        <div className="relative flex justify-between px-1.5" style={{ zIndex: 2, gap: 4 }}>
          {tray.map(({ jelly, filled }) => (
            <Alcove key={jelly.id} jelly={jelly} filled={filled && !loading} />
          ))}
        </div>

        {/* The shelf the jellies stand on. */}
        <div style={{
          height: 7, marginTop: 3,
          background: `linear-gradient(180deg, ${WOOD_LT}, ${WOOD_DK})`,
          borderTop: `2px solid ${INK}`,
        }} />

        {/* ── Glass ── one diagonal glare, edge to edge. */}
        <span aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(114deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.16) 44%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 58%)',
        }} />
      </div>

      {/* ── Brass rail along the front ── */}
      <div aria-hidden className="flex items-center justify-between px-1" style={{ marginTop: 5 }}>
        <Foot />
        <div style={{
          flex: 1, height: 5, margin: '0 4px', borderRadius: 3,
          background: `linear-gradient(180deg, ${BRASS_LT} 0%, ${BRASS} 45%, ${BRASS_DK} 100%)`,
          border: `1.5px solid ${INK}`,
        }} />
        <Foot />
      </div>
    </div>
  )
})

export default ParlourCase

// ─── One slot ────────────────────────────────────────────────────────────────
function Alcove({ jelly, filled }: { jelly: JellyDef; filled: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
      {/* The niche itself — a recess cut into the back of the case, with its
          own little light. An unlit one is a hollow, not a gap. */}
      <div className="relative flex items-end justify-center w-full overflow-hidden" style={{
        aspectRatio: '0.8',
        borderRadius: '13px 13px 3px 3px',
        background: filled
          ? `linear-gradient(180deg, #1B1017 0%, ${jelly.colour}22 76%, ${jelly.colour}33 100%)`
          : 'linear-gradient(180deg, #170D13 0%, #241621 100%)',
        boxShadow: `inset 0 2px 4px rgba(0,0,0,0.62), inset 0 0 0 1px rgba(255,255,255,0.05)`,
      }}>
        {/* The jelly's own light, thrown onto the back of the alcove. */}
        <span aria-hidden style={{
          position: 'absolute', inset: '10% 4% 0 4%', borderRadius: '46% 46% 30% 30%',
          background: `radial-gradient(58% 54% at 50% 68%, ${jelly.colour}${filled ? '7A' : '12'} 0%, ${jelly.colour}00 74%)`,
        }} />

        <img src={jelly.art} alt="" draggable={false} style={{
          position: 'relative', width: '92%', height: '92%', marginBottom: 2,
          objectFit: 'contain', imageRendering: 'auto',
          // Empty: the same jelly, just not lit. It keeps its hue, so the case
          // reads as five flavours in the dark instead of five holes.
          filter: filled ? undefined : 'brightness(0.26) saturate(0.55) contrast(0.95)',
          animation: filled ? 'parlourJiggle 2.6s ease-in-out infinite' : undefined,
        }} />

        {/* Reflection on the polished shelf under a lit jelly. */}
        {filled && (
          <span aria-hidden style={{
            position: 'absolute', bottom: 0, width: '62%', height: 5, borderRadius: '50%',
            background: `radial-gradient(50% 50% at 50% 50%, ${jelly.colour}99 0%, ${jelly.colour}00 70%)`,
          }} />
        )}
      </div>

      <span className="font-pixel text-center leading-tight w-full overflow-hidden" style={{
        fontSize: 5, minHeight: 11, marginTop: 2, letterSpacing: 0,
        color: filled ? BRASS_LT : 'rgba(255,248,238,0.34)',
        textShadow: filled ? `1px 1px 0 ${INK}` : undefined,
      }}>
        {filled ? jelly.name.split(' ')[0].toUpperCase() : '???'}
      </span>
    </div>
  )
}

function Foot() {
  return (
    <span style={{
      width: 9, height: 9, borderRadius: 2,
      background: `linear-gradient(180deg, ${BRASS_LT}, ${BRASS_DK})`,
      border: `1.5px solid ${INK}`,
    }} />
  )
}
