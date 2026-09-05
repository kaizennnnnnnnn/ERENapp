'use client'

// ─── JumpScenery ────────────────────────────────────────────────────────────
// The shaft Jelly Jump is played up. It used to be one room; it is now four
// stacked ones (see jumpZones.ts), and you punch through a ceiling between them.
//
// Every piece here is driven by ONE number (the camera) written straight to a
// style by the game loop — no React, no per-frame state.
//
//   JumpWallLayer  a tiling parallax wall for ONE zone. The page renders TWO of
//                  them and cross-fades B over A as you approach a boundary, so
//                  the room changes around you instead of cutting. Because it
//                  tiles, a whole climb is a handful of gradients and a
//                  backgroundPositionY however high he gets.
//   JumpDepth      the near layer: edge props sliding past faster than the
//                  wall, which is what actually sells speed. Parallax needs two
//                  rates, and each zone sets its own.
//   JumpCeiling    the slab between two rooms. NOT a collider — see below.
//
// ── The law of this file ───────────────────────────────────────────────────
// NOTHING IN THESE LAYERS MAY CROSS THE PLAY AREA HORIZONTALLY. The first build
// ran a full-width plank through the near layer and it read as a platform:
// players aimed at scenery they could never land on. That is why the props are
// pinned to the edges, and it is why the ceiling is TWO half-slabs with a wide
// gap down the middle rather than one lid. A continuous horizontal top face is
// a promise of ground, and this layer must never make one.

import { forwardRef, memo } from 'react'
import { INK, BRASS_DK } from './parlourTheme'
import { ZONES } from './jumpZones'

/** Height of one repeat, px of world. Also the prop spacing on the near layer. */
export const TILE = 240

/**
 * Clear corridor down the middle of a ceiling.
 *
 * Wider than PLAT_W (76) plus the catch window, so no real platform can ever
 * hide inside the gap and neither half can be mistaken for one.
 */
export const CEIL_GAP = 122
export const CEIL_H = 22

export const JumpWallLayer = memo(forwardRef<HTMLDivElement, { zone: number }>(
  function JumpWallLayer({ zone }, ref) {
    const z = ZONES[Math.max(0, Math.min(ZONES.length - 1, zone))]
    return (
      <div ref={ref} aria-hidden className="absolute inset-0 pointer-events-none" style={{
        zIndex: 0,
        backgroundColor: z.base,
        backgroundImage: z.wall.join(', '),
        backgroundSize: z.wallSize,
        backgroundRepeat: z.wallRepeat,
      }} />
    )
  },
))

/**
 * One edge prop, mirrored on both walls.
 *
 * The shape changes per zone because a room you can only identify by its
 * colour is a palette swap, not a room. A bracket, a meat hook, a roof beam and
 * a paper lantern are four different silhouettes at the same 26px of width.
 */
function Prop({ zone, side }: { zone: number; side: 0 | 1 }) {
  const z = ZONES[Math.max(0, Math.min(ZONES.length - 1, zone))]
  const edge = side ? { right: 0 } : { left: 0 }
  const edgeIn = side ? { right: 7 } : { left: 7 }

  if (z.prop === 'hook') {
    // Cold room: a steel rail with a hook curling off it, frost on the top.
    return (
      <>
        <span style={{
          position: 'absolute', ...edge, top: 0, width: 30, height: 8,
          background: `linear-gradient(180deg, ${z.propTone}, ${z.propTone2})`,
          borderTop: `3px solid ${INK}`, opacity: 0.92,
          ...(side ? { borderLeft: `3px solid ${INK}` } : { borderRight: `3px solid ${INK}` }),
        } as React.CSSProperties} />
        <span style={{
          position: 'absolute', ...edgeIn, top: 8, width: 5, height: 16,
          background: z.propTone2, opacity: 0.85,
        } as React.CSSProperties} />
        <span style={{
          position: 'absolute', ...edgeIn, top: 22, width: 13, height: 13,
          border: `3px solid ${z.propTone}`, borderTopColor: 'transparent',
          borderRadius: '0 0 50% 50%', opacity: 0.8,
        } as React.CSSProperties} />
      </>
    )
  }

  if (z.prop === 'beam') {
    // Sugar loft: a rafter end and its iron strap.
    return (
      <>
        <span style={{
          position: 'absolute', ...edge, top: 0, width: 34, height: 15,
          background: `linear-gradient(180deg, ${z.propTone}, ${z.propTone2})`,
          border: `3px solid ${INK}`,
          borderRadius: side ? '5px 0 0 5px' : '0 5px 5px 0',
          opacity: 0.94,
        } as React.CSSProperties} />
        <span style={{
          position: 'absolute', ...edgeIn, top: 15, width: 9, height: 26,
          background: `linear-gradient(180deg, ${z.propTone2}, ${INK})`, opacity: 0.7,
        } as React.CSSProperties} />
      </>
    )
  }

  if (z.prop === 'lantern') {
    // Above the parlour: a paper lantern on a cord, swinging off the eaves.
    return (
      <>
        <span style={{
          position: 'absolute', ...edgeIn, top: 0, width: 2, height: 18,
          background: z.propTone2, opacity: 0.8,
        } as React.CSSProperties} />
        <span style={{
          position: 'absolute', ...edgeIn, top: 18, width: 16, height: 20,
          background: `linear-gradient(180deg, ${z.propTone}, ${z.propTone2})`,
          border: `2px solid ${INK}`, borderRadius: '46% 46% 42% 42%',
          boxShadow: `0 0 14px ${z.lamp}66`,
        } as React.CSSProperties} />
      </>
    )
  }

  // Storeroom: the original wall bracket.
  return (
    <>
      <span style={{
        position: 'absolute', ...edge, top: 0, width: 26, height: 12,
        background: `linear-gradient(180deg, ${z.propTone}, ${z.propTone2})`,
        borderTop: `3px solid ${INK}`,
        borderRadius: side ? '4px 0 0 4px' : '0 4px 4px 0',
        opacity: 0.9,
        ...(side ? { borderLeft: `3px solid ${INK}` } : { borderRight: `3px solid ${INK}` }),
      } as React.CSSProperties} />
      <span style={{
        position: 'absolute', ...edgeIn, top: 12, width: 7, height: 20,
        background: z.propTone2, opacity: 0.7,
      } as React.CSSProperties} />
    </>
  )
}

/**
 * Near-layer props. Rendered once as a tall strip and slid with the camera;
 * `count` covers a screen and a half so the strip never runs out.
 */
export const JumpDepth = memo(forwardRef<HTMLDivElement, { count: number; zone: number }>(
  function JumpDepth({ count, zone }, ref) {
    const z = ZONES[Math.max(0, Math.min(ZONES.length - 1, zone))]
    return (
      <div ref={ref} aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1, willChange: 'transform' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * TILE }}>
            <Prop zone={zone} side={0} />
            <Prop zone={zone} side={1} />

            {/* A hanging bulb between the props, alternating sides. */}
            <span style={{
              position: 'absolute', left: i % 2 ? '78%' : '20%', top: TILE * 0.42,
              width: 2, height: 24, background: BRASS_DK, opacity: 0.85,
            }} />
            <span style={{
              position: 'absolute', left: `calc(${i % 2 ? '78%' : '20%'} - 8px)`, top: TILE * 0.42 + 24,
              width: 17, height: 17, borderRadius: '50%',
              background: `radial-gradient(50% 50% at 50% 38%, #FFF6DC 0%, ${z.lamp} 55%, #E39A48 100%)`,
              border: `2px solid ${INK}`,
              boxShadow: `0 0 12px ${z.lamp}F0, 0 0 42px ${z.lamp}88`,
            }} />
          </div>
        ))}
      </div>
    )
  },
))

/**
 * The ceiling between two rooms.
 *
 * TWO half-slabs with a CEIL_GAP corridor between them, because a full-width
 * lid would be the exact lie this file exists to forbid — a continuous
 * horizontal top face reads as ground, and this one is not. It has no entry in
 * the collision loop and no pointer events: he passes through the gap or
 * through the plaster, and either way the slab only reacts.
 *
 * `broken` flips once, when he crosses it. The halves fling apart on a snap
 * keyframe rather than fading, because the point is that he BROKE it.
 */
export const JumpCeiling = memo(forwardRef<HTMLDivElement, { zone: number; broken: boolean; reduced: boolean }>(
  function JumpCeiling({ zone, broken, reduced }, ref) {
    const z = ZONES[Math.max(0, Math.min(ZONES.length - 1, zone))]
    const half = (side: 0 | 1) => (
      <span key={side} style={{
        position: 'absolute', top: 0,
        [side ? 'right' : 'left']: 0,
        width: `calc(50% - ${CEIL_GAP / 2}px)`, height: CEIL_H,
        background: z.ceiling,
        borderTop: `3px solid ${INK}`,
        borderBottom: `3px solid ${INK}`,
        ...(side ? { borderLeft: `3px solid ${INK}` } : { borderRight: `3px solid ${INK}` }),
        // A ragged plaster underside, so it never presents a clean landable lip.
        clipPath: side
          ? 'polygon(0 0, 100% 0, 100% 100%, 82% 72%, 64% 100%, 44% 70%, 22% 100%, 0 74%)'
          : 'polygon(0 0, 100% 0, 100% 74%, 78% 100%, 56% 70%, 36% 100%, 18% 72%, 0 100%)',
        boxShadow: `inset 0 -3px 0 ${z.ceilingEdge}`,
        animation: broken && !reduced
          ? `jumpCeilBreak${side ? 'R' : 'L'} 520ms cubic-bezier(0.16,1,0.3,1) forwards`
          : undefined,
        opacity: broken && reduced ? 0 : 1,
      } as React.CSSProperties} />
    )
    return (
      <div ref={ref} aria-hidden className="absolute left-0 right-0 pointer-events-none"
        style={{ zIndex: 3, top: 0, height: CEIL_H, willChange: 'transform' }}>
        {half(0)}
        {half(1)}
      </div>
    )
  },
))
