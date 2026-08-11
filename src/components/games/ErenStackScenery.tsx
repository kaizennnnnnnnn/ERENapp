'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN STACK — scenery and the rider.
//
// Two things the tower was missing.
//
// DEPTH. The field was a flat gradient with a tower on it, so climbing read as
// "the blocks move down" rather than as altitude. Parallax fixes that for
// almost nothing: the same camera offset applied at three different rates.
// Ground clutter tracks the tower closely, hills drift, the far ridge barely
// moves — and the eye reads the difference as distance without being told.
//
// EREN. The game is named after him and he was not in it. He rides the top of
// the stack, squashes on each landing, throws his paws up on a perfect and
// scrambles when a piece gets trimmed out from under him. He is the difference
// between "a stacking game" and "Eren's stacking game", and he doubles as
// feedback: you can read your last drop off his pose without looking away from
// the tower.
//
// Everything here is memoised — the game force-renders every frame at 60fps
// and none of this changes per frame; only the wrapper transforms do.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'

export type RiderPose = 'ride' | 'cheer' | 'wobble'

/** Far ridgeline. Drawn as one clip-path polygon rather than N divs so the
 *  silhouette is a single cheap shape. */
export const StackRidge = memo(function StackRidge({ tone }: { tone: string }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', left: '-10%', right: '-10%', bottom: 0, height: 160,
      background: tone,
      clipPath: 'polygon(0% 100%, 0% 62%, 8% 48%, 16% 60%, 26% 34%, 34% 52%, 44% 30%, 53% 50%, 62% 26%, 71% 46%, 80% 36%, 88% 54%, 100% 42%, 100% 100%)',
      opacity: 0.55,
    }} />
  )
})

/** Nearer hills, a shade stronger and a different silhouette so the two layers
 *  never look like the same shape scaled. */
export const StackHills = memo(function StackHills({ tone }: { tone: string }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', left: '-10%', right: '-10%', bottom: 0, height: 120,
      background: tone,
      clipPath: 'polygon(0% 100%, 0% 74%, 12% 58%, 22% 72%, 33% 50%, 45% 68%, 58% 46%, 68% 66%, 79% 54%, 90% 70%, 100% 58%, 100% 100%)',
      opacity: 0.7,
    }} />
  )
})

/** One tile of cloud field. Positions are within CLOUD_BAND so the tile can be
 *  repeated seamlessly — a fixed handful of clouds runs out after a few
 *  hundred pixels of climb and leaves an empty sky. */
export const CLOUD_BAND = 380

const CLOUDS = [
  { left: '6%', top: 34, w: 62, h: 20, o: 0.85 },
  { left: '62%', top: 96, w: 48, h: 16, o: 0.7 },
  { left: '28%', top: 178, w: 78, h: 24, o: 0.8 },
  { left: '74%', top: 250, w: 40, h: 14, o: 0.6 },
  { left: '14%', top: 320, w: 56, h: 18, o: 0.65 },
]

const CloudTile = memo(function CloudTile() {
  return (
    <>
      {CLOUDS.map((c, i) => (
        <div key={i} style={{ position: 'absolute', left: c.left, top: c.top, opacity: c.o }}>
          <div style={{ position: 'absolute', width: c.w, height: c.h, background: '#FFFFFF', borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: c.w * 0.18, top: -c.h * 0.5, width: c.w * 0.45, height: c.h, background: '#FFFFFF', borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: c.w * 0.55, top: -c.h * 0.3, width: c.w * 0.32, height: c.h * 0.8, background: '#F3F6FF', borderRadius: 2 }} />
        </div>
      ))}
    </>
  )
})

/** Chunky pixel clouds — three overlapping rects each, so they read as drawn
 *  rather than as blurred blobs. Three stacked tiles, scrolled modulo the band
 *  height by the caller, gives an endless cloud field for the cost of 15 divs. */
export const StackClouds = memo(function StackClouds() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
      {[-1, 0, 1].map(k => (
        <div key={k} style={{ position: 'absolute', left: 0, right: 0, top: k * CLOUD_BAND, height: CLOUD_BAND }}>
          <CloudTile />
        </div>
      ))}
    </div>
  )
})

const INK = '#3B2416'   // outline — the sprite sits on saturated blocks and
                        // needs a dark edge or it dissolves into them
const FUR = '#F9EDD5'
const FUR_DK = '#E4CDA6'
const EAR = '#4A2E1A'

/** Eren, riding the top of the stack. 20x20 pixel grid, crisp-edged.
 *
 *  The three poses have to be readable at 30 CSS px, which means silhouette,
 *  not detail: raised paws must clear the head outline entirely, and the
 *  scramble tilts the whole body. Recolouring the eyes alone is invisible at
 *  this size. */
export const ErenRider = memo(function ErenRider({ pose, size = 32 }: { pose: RiderPose; size?: number }) {
  const cheer = pose === 'cheer'
  const wobble = pose === 'wobble'
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated', display: 'block',
        transform: wobble ? 'rotate(-9deg)' : undefined,
        transformOrigin: 'center bottom',
      }}>
      {/* tail — up and curled when cheering, flat out when scrambling */}
      {cheer
        ? <><rect x="1" y="9" width="2" height="4" fill={EAR} /><rect x="1" y="7" width="3" height="2" fill={EAR} /></>
        : <><rect x="0" y="14" width="4" height="2" fill={EAR} /><rect x="0" y="12" width="2" height="2" fill={EAR} /></>}

      {/* raised paws (cheer) — drawn BEHIND the head, clear above the ears */}
      {cheer && (
        <>
          <rect x="2" y="2" width="3" height="5" fill={FUR} />
          <rect x="2" y="2" width="3" height="5" fill="none" stroke={INK} strokeWidth="0.6" />
          <rect x="15" y="2" width="3" height="5" fill={FUR} />
          <rect x="15" y="2" width="3" height="5" fill="none" stroke={INK} strokeWidth="0.6" />
        </>
      )}

      {/* body */}
      <rect x="3" y="11" width="14" height="8" fill={INK} />
      <rect x="4" y="12" width="12" height="6" fill={FUR} />
      <rect x="4" y="12" width="12" height="1" fill="#FFFFFF" opacity="0.45" />
      <rect x="4" y="17" width="12" height="1" fill={FUR_DK} />

      {/* front paws — braced wide when scrambling, tucked when calm */}
      {!cheer && (wobble
        ? <><rect x="0" y="15" width="4" height="3" fill={INK} /><rect x="16" y="15" width="4" height="3" fill={INK} />
           <rect x="1" y="16" width="3" height="1" fill={FUR} /><rect x="16" y="16" width="3" height="1" fill={FUR} /></>
        : <><rect x="5" y="18" width="4" height="2" fill={INK} /><rect x="11" y="18" width="4" height="2" fill={INK} />
           <rect x="6" y="18" width="2" height="1" fill={FUR_DK} /><rect x="12" y="18" width="2" height="1" fill={FUR_DK} /></>)}

      {/* ears */}
      <rect x="4" y="1" width="4" height="5" fill={INK} />
      <rect x="12" y="1" width="4" height="5" fill={INK} />
      <rect x="5" y="2" width="2" height="3" fill={EAR} />
      <rect x="13" y="2" width="2" height="3" fill={EAR} />
      <rect x="5" y="3" width="1" height="2" fill="#F472B6" />
      <rect x="14" y="3" width="1" height="2" fill="#F472B6" />

      {/* head */}
      <rect x="3" y="4" width="14" height="9" fill={INK} />
      <rect x="4" y="5" width="12" height="7" fill={FUR} />
      <rect x="4" y="5" width="12" height="1" fill="#FFFFFF" opacity="0.5" />

      {/* eyes — happy arcs cheering, wide when scrambling */}
      {cheer
        ? <><rect x="6" y="7" width="3" height="1" fill={INK} /><rect x="11" y="7" width="3" height="1" fill={INK} />
           <rect x="6" y="8" width="1" height="1" fill={INK} /><rect x="8" y="8" width="1" height="1" fill={INK} />
           <rect x="11" y="8" width="1" height="1" fill={INK} /><rect x="13" y="8" width="1" height="1" fill={INK} /></>
        : <><rect x="6" y="7" width="2" height={wobble ? 4 : 3} fill={INK} /><rect x="12" y="7" width="2" height={wobble ? 4 : 3} fill={INK} />
           <rect x="6" y="7" width="1" height="1" fill="#FFFFFF" /><rect x="12" y="7" width="1" height="1" fill="#FFFFFF" /></>}

      {/* blush + nose */}
      <rect x="4" y="10" width="2" height="1" fill="#F9A8D4" opacity={cheer ? 0.95 : 0.6} />
      <rect x="14" y="10" width="2" height="1" fill="#F9A8D4" opacity={cheer ? 0.95 : 0.6} />
      <rect x="9" y="10" width="2" height="1" fill="#F472B6" />
    </svg>
  )
})
