'use client'

// ─── JumpScenery ────────────────────────────────────────────────────────────
// The shaft Jelly Jump is played up: the parlour's storeroom, shelf after shelf
// of stock going up into the dark.
//
// Two pieces, both driven by ONE number (the camera) written straight to a
// style by the game loop — no React, no per-frame state.
//
//   JumpWall     a tiling parallax layer. Because it tiles, the whole climb is
//                three background-images and a backgroundPositionY, however
//                high he gets. It scrolls at 0.4× so it sits clearly behind
//                the platforms; a static sky reads as hovering, not climbing.
//   JumpDepth    the near layer: shelf brackets sliding past at 0.85×, which
//                is what actually sells speed. Parallax needs two rates.
//
// The first build had a flat blue gradient and three blurred bubbles. The
// difference isn't detail, it's that this has a floor, a ceiling and a
// direction.

import { forwardRef, memo } from 'react'
import { INK, WOOD, WOOD_DK, WOOD_LT, BRASS_DK } from './parlourTheme'

const DARK = '#43204C'
const MID = '#573062'

/** Height of one repeat, px of world. Also the shelf spacing on the near layer. */
export const TILE = 240

export const JumpWall = memo(forwardRef<HTMLDivElement>(function JumpWall(_props, ref) {
  return (
    <div ref={ref} aria-hidden className="absolute inset-0 pointer-events-none" style={{
      zIndex: 0,
      backgroundColor: DARK,
      backgroundImage: [
        // Warm lamp pools, one per tile, alternating sides.
        `radial-gradient(46% 26% at 16% 14%, rgba(255,206,140,0.34) 0%, rgba(255,206,140,0) 72%)`,
        `radial-gradient(46% 26% at 84% 62%, rgba(255,160,200,0.26) 0%, rgba(255,160,200,0) 72%)`,
        // Panelled wall: wide vertical boards.
        `repeating-linear-gradient(90deg, ${DARK} 0 26px, ${MID} 26px 52px)`,
      ].join(', '),
      backgroundSize: `100% ${TILE}px, 100% ${TILE}px, 52px 100%`,
      backgroundRepeat: 'repeat-y, repeat-y, repeat',
    }} />
  )
}))

/**
 * Near-layer shelf brackets. Rendered once as a tall strip and slid with the
 * camera; `count` covers a screen and a half so the strip never runs out.
 */
export const JumpDepth = memo(forwardRef<HTMLDivElement, { count: number }>(function JumpDepth({ count }, ref) {
  return (
    <div ref={ref} aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, willChange: 'transform' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * TILE }}>
          {/* Wall brackets, pinned to the EDGES.
              Nothing in this layer may cross the play area horizontally. The
              first build ran a full-width plank here and it read as a platform:
              players aimed at scenery they could never land on. Depth now comes
              from things that are obviously part of the wall. */}
          {[0, 1].map(side => (
            <span key={side} style={{
              position: 'absolute', [side ? 'right' : 'left']: 0, top: 0,
              width: 26, height: 12,
              background: `linear-gradient(180deg, ${WOOD_LT}, ${WOOD_DK})`,
              borderTop: `3px solid ${INK}`,
              borderRight: side ? undefined : `3px solid ${INK}`,
              borderLeft: side ? `3px solid ${INK}` : undefined,
              borderRadius: side ? '4px 0 0 4px' : '0 4px 4px 0',
              opacity: 0.9,
            } as React.CSSProperties} />
          ))}
          {[0, 1].map(side => (
            <span key={`b${side}`} style={{
              position: 'absolute', [side ? 'right' : 'left']: 7,
              top: 12, width: 7, height: 20, background: WOOD, opacity: 0.7,
            } as React.CSSProperties} />
          ))}

          {/* A hanging bulb between the brackets, alternating sides. */}
          <span style={{
            position: 'absolute', left: i % 2 ? '78%' : '20%', top: TILE * 0.42,
            width: 2, height: 24, background: BRASS_DK, opacity: 0.85,
          }} />
          <span style={{
            position: 'absolute', left: `calc(${i % 2 ? '78%' : '20%'} - 8px)`, top: TILE * 0.42 + 24,
            width: 17, height: 17, borderRadius: '50%',
            background: 'radial-gradient(50% 50% at 50% 38%, #FFF6DC 0%, #FFD98A 55%, #E39A48 100%)',
            border: `2px solid ${INK}`,
            boxShadow: '0 0 12px rgba(255,214,140,0.95), 0 0 42px rgba(255,196,110,0.55)',
          }} />
        </div>
      ))}
    </div>
  )
}))
