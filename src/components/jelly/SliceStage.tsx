'use client'

// ─── SliceStage ─────────────────────────────────────────────────────────────
// The room Jelly Slice is played in: the parlour after hours, jellies coming up
// off the counter.
//
// All of it is behind the play field and none of it moves, so it costs one
// paint. It exists because the first build was a pink vertical gradient with
// four flat blobs on it, and a flat gradient is the fastest way to make a game
// look like a prototype. Depth here is built the same way the hub's is: a
// striped wall, a rail, a lit window, a back shelf with real jelly art on it,
// and a wooden counter across the bottom that the player's cat stands behind.

import { memo } from 'react'
import { JELLIES } from '@/lib/jellies'
import { INK, WOOD, WOOD_DK, WOOD_LT, BRASS, BRASS_DK } from './parlourTheme'

const WALL = '#71304B'
const WALL_STRIPE = '#5F2740'
const NIGHT = '#2E0F1E'
const GLASS = '#FFE7A8'

const SliceStage = memo(function SliceStage() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Wallpaper, the hub's stripes after dark. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `repeating-linear-gradient(90deg, ${WALL} 0 20px, ${WALL_STRIPE} 20px 40px)`,
      }} />

      {/* One warm window, high on the left — the room's light source, and the
          reason the jellies read as lit from that side. */}
      <div style={{
        position: 'absolute', left: '8%', top: '11%', width: 74, height: 92,
        borderRadius: '36px 36px 4px 4px',
        background: `linear-gradient(180deg, ${GLASS} 0%, #F7C46A 62%, #E9A54F 100%)`,
        border: `3px solid ${INK}`, boxShadow: '0 0 46px rgba(255,214,140,0.75)',
      }}>
        <span style={{ position: 'absolute', left: '50%', top: 6, bottom: 6, width: 3, background: INK, opacity: 0.8 }} />
        <span style={{ position: 'absolute', left: 6, right: 6, top: '46%', height: 3, background: INK, opacity: 0.8 }} />
      </div>

      <div style={{
        position: 'absolute', left: 0, top: 0, width: '58%', height: '46%',
        background: 'radial-gradient(46% 44% at 22% 28%, rgba(255,214,140,0.24) 0%, rgba(255,214,140,0) 74%)',
      }} />

      {/* Hanging lamp on the right. */}
      <div style={{ position: 'absolute', right: '16%', top: 0, width: 2, height: '13%', background: BRASS_DK }} />
      <div style={{
        position: 'absolute', right: 'calc(16% - 21px)', top: '13%', width: 44, height: 22,
        borderRadius: '22px 22px 3px 3px',
        background: `linear-gradient(180deg, ${BRASS}, ${BRASS_DK})`, border: `3px solid ${INK}`,
      }} />
      <div style={{
        position: 'absolute', right: 'calc(16% - 46px)', top: '15%', width: 94, height: 150,
        background: 'radial-gradient(50% 60% at 50% 0%, rgba(255,214,140,0.28) 0%, rgba(255,214,140,0) 74%)',
      }} />

      {/* Back shelf with the five flavours in reserve. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '34%' }}>
        <div className="flex items-end justify-evenly px-4">
          {JELLIES.map(j => (
            <img key={j.id} src={j.art} alt="" draggable={false} style={{
              width: 27, height: 27, objectFit: 'contain', imageRendering: 'auto', opacity: 0.62,
            }} />
          ))}
        </div>
        <div style={{
          height: 7, background: `linear-gradient(180deg, ${WOOD_LT}, ${WOOD_DK})`,
          borderTop: `2px solid ${INK}`, opacity: 0.72,
        }} />
      </div>

      {/* Bunting under the ceiling. Two rows of triangles, not a gradient band. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 22,
        backgroundImage:
          'linear-gradient(135deg, rgba(255,178,206,0.9) 25%, transparent 25%), ' +
          'linear-gradient(225deg, rgba(255,178,206,0.9) 25%, transparent 25%)',
        backgroundSize: '30px 30px', backgroundPosition: '0 -9px',
      }} />

      {/* Vignette, pushing the play field forward. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(84% 58% at 50% 46%, rgba(0,0,0,0) 0%, ${NIGHT}99 100%)`,
      }} />
    </div>
  )
})

export default SliceStage

/** The counter Eren stands behind, drawn over the field at the very bottom. */
export const SliceCounter = memo(function SliceCounter() {
  return (
    <>
      <div aria-hidden style={{
        height: 13, background: `linear-gradient(180deg, ${WOOD_LT} 0%, ${WOOD} 100%)`,
        borderTop: `3px solid ${INK}`, borderBottom: `3px solid ${INK}`,
      }} />
      <div aria-hidden style={{
        height: 'calc(var(--safe-bottom) + 16px)',
        background: `linear-gradient(180deg, ${WOOD} 0%, ${WOOD_DK} 100%)`,
        backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 50px, rgba(0,0,0,0.16) 50px 53px)',
      }} />
    </>
  )
})
