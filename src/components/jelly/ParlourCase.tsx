'use client'

// ─── ParlourCase ────────────────────────────────────────────────────────────
// The display case: today's tray of five, behind glass.
//
// This replaces a row of white rounded squares with padlocks in them. The
// problem with that row wasn't the lock icon, it was that an empty slot looked
// like a UI placeholder — so four fifths of the hero element read as "nothing
// here yet". An empty alcove now shows the jelly's own SILHOUETTE in the dark,
// lit from below: you can see exactly which flavour is missing, which is the
// thing the player actually wants to know.
//
// Construction, bottom to top: stained frame → dark interior → a warm shelf
// glow → the five alcoves → one diagonal glare across the glass → brass rail.
// The glare is what sells "behind glass"; without it the case is just a dark
// box with fruit in it.

import { memo } from 'react'
import type { JellyDef } from '@/lib/jellies'
import { IconLock } from '@/components/PixelIcons'
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
        paddingTop: 13,
      }}>
        {/* Warm light pooling up from the shelf. */}
        <span aria-hidden style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '68%',
          background: 'radial-gradient(70% 100% at 50% 100%, rgba(255,196,120,0.34) 0%, rgba(255,196,120,0) 74%)',
        }} />
        {/* CRT scanlines — the app's dark-panel texture, so the case belongs to
            the same world as the leaderboards and the reward road. */}
        <span aria-hidden style={{
          position: 'absolute', inset: 0, opacity: 0.5,
          background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
        }} />

        <div className="relative flex justify-between gap-0.5 px-1" style={{ zIndex: 2 }}>
          {tray.map(({ jelly, filled }) => (
            <Alcove key={jelly.id} jelly={jelly} filled={filled && !loading} />
          ))}
        </div>

        {/* The shelf the jellies stand on. */}
        <div style={{
          height: 7, marginTop: 2,
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
      <div className="relative flex items-end justify-center w-full" style={{ aspectRatio: '0.92' }}>
        {/* The jelly's own light, thrown onto the back of the alcove. */}
        {filled && (
          <span aria-hidden style={{
            position: 'absolute', inset: '8% 2% 2% 2%', borderRadius: '46% 46% 30% 30%',
            background: `radial-gradient(58% 52% at 50% 66%, ${jelly.colour}66 0%, ${jelly.colour}00 74%)`,
          }} />
        )}

        <img src={jelly.art} alt="" draggable={false} style={{
          position: 'relative', width: '96%', height: '96%',
          objectFit: 'contain', imageRendering: 'auto',
          // Empty: the flavour reduced to a shadow on the back wall. Readable
          // as "the green one is missing" without pretending to be owned.
          filter: filled ? undefined : 'brightness(0) invert(1) opacity(0.13)',
          animation: filled ? 'parlourJiggle 2.6s ease-in-out infinite' : undefined,
        }} />

        {!filled && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden style={{ opacity: 0.55 }}>
            <IconLock size={13} />
          </span>
        )}
      </div>

      <span className="font-pixel text-center leading-tight" style={{
        fontSize: 5, minHeight: 11, letterSpacing: 0.2,
        color: filled ? BRASS_LT : 'rgba(255,248,238,0.28)',
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
