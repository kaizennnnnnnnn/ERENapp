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
import { PixelEren, type ErenPose } from './PixelEren'

// The rider IS the shared arcade cat — he moved to PixelEren.tsx once Yarn Sort
// wanted the same character. Re-exported here so the stack game keeps reaching
// for one scenery import.
export type RiderPose = ErenPose
export const ErenRider = PixelEren

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
