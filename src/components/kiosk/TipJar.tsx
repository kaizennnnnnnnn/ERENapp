'use client'

// The tip jar on the serving ledge.
//
// The till in the corner is a number, and a number going up is something you
// read. A jar is something you SEE — the night's tips as a depth of coins that
// climbs while you work, right where the people leaving them are standing.
//
// Two sprites on one canvas: the coins, and the glass over the top of them.
// The level is a clip on the coins, so the glass never moves and the jar never
// looks like a progress bar wearing a hat.

import { useEffect, useRef, useState } from 'react'
import { TIP_JAR, TIP_JAR_COINS, TIP_JAR_FULL, TIP_JAR_SPRITE } from './kioskShift'

/** The pile's top edge, across seven points. Coins settle into a heap; a
 *  dead-level line would read as liquid — or worse, as the sprite being
 *  cropped, which is exactly the thing the pans just stopped doing. Fixed
 *  offsets rather than random ones: the vertex count has to stay constant for
 *  the clip to animate, and a jar that reshuffles its coins every render would
 *  fizz. */
const HEAP = [2.4, -2.6, 1.1, -3.2, 0.6, -2.1, 2.8]

function heapClip(fill: number): string {
  const line = (1 - fill) * 100
  const top = HEAP.map((d, i) => {
    const x = (i / (HEAP.length - 1)) * 100
    const y = Math.max(0, Math.min(100, line + d))
    return `${x.toFixed(0)}% ${y.toFixed(1)}%`
  })
  return `polygon(${top.join(', ')}, 100% 100%, 0% 100%)`
}

interface Props {
  /** Tips in the till so far tonight. */
  tips: number
}

export default function TipJar({ tips }: Props) {
  const fill = Math.max(0, Math.min(1, tips / TIP_JAR_FULL))
  // Every time it grows, the jar takes the weight of it.
  const [clink, setClink] = useState(0)
  const last = useRef(tips)
  useEffect(() => {
    if (tips > last.current) setClink(c => c + 1)
    last.current = tips
  }, [tips])

  return (
    <span aria-hidden className="pointer-events-none" style={{
      position: 'absolute',
      left: `${TIP_JAR.x}%`, top: `${TIP_JAR.top}%`, width: `${TIP_JAR.width}%`,
      transform: 'translateX(-50%)',
      // In front of the misted pane as well as in front of the customer: the
      // jar is on this side of the glass.
      zIndex: 8,
    }}>
      {/* Position outside, motion inside — a forwards-filling animation on the
          outer element would wipe out the centring. */}
      <span key={clink} style={{
        display: 'block', position: 'relative',
        transformOrigin: '50% 100%',
        animation: clink ? 'kioskJarClink 380ms cubic-bezier(0.32, 0.72, 0, 1)' : undefined,
      }}>
        <img src={TIP_JAR_COINS} alt="" draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: 'auto',
          // Clipped from the top down, so the coins rise rather than grow.
          clipPath: heapClip(fill),
          transition: 'clip-path 520ms cubic-bezier(0.32, 0.72, 0, 1)',
          filter: 'brightness(0.92) drop-shadow(0 0 3px rgba(255,196,64,0.35))',
        }} />
        <img src={TIP_JAR_SPRITE} alt="" draggable={false} style={{
          position: 'relative', display: 'block', width: '100%', height: 'auto',
          filter: 'brightness(0.88) drop-shadow(1px 2px 2px rgba(0,0,0,0.55))',
        }} />
      </span>
    </span>
  )
}
