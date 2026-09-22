'use client'

// The shutter coming down.
//
// It is painted into the wall — the roller drum sits across the top of the
// window in InsideOfKiosk.webp, end caps and all — and in every shift so far
// it has done nothing. The night ended with a modal appearing over a window
// that was still wide open, playing the sound of a shutter nobody saw.
//
// Now closing up is a thing you do TO the kiosk. You turn round to the window,
// the curtain rolls down out of the drum, it lands on the serving ledge, and
// only then does the receipt come up. The sound belongs here rather than on
// the receipt for the same reason the till's screen belongs on the till.
//
// It lives in the GLASS rect and wears GLASS_MASK, like the customer and the
// weather: the shakers, the napkins and the till display are on YOUR side of
// the window and stay in front of it. A shutter that came down over the salt
// would be a shutter that came down inside the kiosk.

import { useEffect } from 'react'
import { GLASS, GLASS_MASK } from './kioskShift'
import { useResume } from './useResume'
import { playSound } from '@/lib/sounds'

/** The wall takes this long to swing round to the window — the same 0.45s
 *  kioskSlideIn runs for. Nothing can happen at the window until it has. */
const TURN_MS = 450
/** Then a beat, so the turn reads as a turn before the shutter moves. */
const PULL_AT = TURN_MS + 90
/** The roll itself. Long enough to be a deliberate act, short enough that it
 *  is not in the way of reading the night's takings. */
const ROLL_MS = 880
/** And the rail is allowed to stop rattling before the paper arrives. */
const REST_MS = 300

/** Tap to receipt, with the roll. */
export const SHUTTER_MS = PULL_AT + ROLL_MS + REST_MS
/** Tap to receipt, without it: the turn still happens and the shutter is
 *  still shut, it simply doesn't travel. */
export const SHUTTER_STILL_MS = TURN_MS + 240

interface Props {
  /** When CLOSE UP was tapped, as a clock reading. The window wall unmounts
   *  whenever you turn away from it, so this is what lets the roll resume
   *  instead of starting over — see useResume. */
  startedAt: number
  /** Reduced motion: the shutter is shut, it just never travelled. */
  still?: boolean
}

export default function Shutter({ startedAt, still = false }: Props) {
  const elapsed = useResume(startedAt)

  useEffect(() => {
    // Skip the cue if it is already behind us, which it will be on a remount.
    const at = PULL_AT - elapsed
    if (at < 0) return
    const t = setTimeout(() => playSound('kiosk_shutter'), at)
    return () => clearTimeout(t)
  }, [elapsed])

  return (
    <div aria-hidden className="absolute overflow-hidden pointer-events-none" style={{
      left: `${GLASS.left}%`, top: `${GLASS.top}%`,
      width: `${GLASS.width}%`, height: `${GLASS.height}%`,
      // Above everything else at the window — the street, the weather, the
      // person standing in it, the jar, the till. All of it is outside or
      // behind the glass; this is the glass being shut.
      zIndex: 10,
      ...GLASS_MASK,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        // Corrugated metal, sized in cqi so the slats keep their pitch at any
        // screen width: the picture's aspect is fixed, so a percentage of its
        // width scales with everything else pinned to it.
        background:
          // The bow of the curtain, dark where it meets each guide rail.
          'linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 13%,'
          + ' rgba(0,0,0,0) 87%, rgba(0,0,0,0.46) 100%),'
          // The ceiling lamps are above it and nothing else is.
          + ' linear-gradient(180deg, rgba(255,206,140,0.13) 0%, rgba(0,0,0,0) 24%),'
          // And the slats themselves: seam, highlight, body, shadow.
          //
          // Sampled against the drum it unrolls from rather than picked by
          // eye. The first pass was cool where the painted metal is warm
          // (R-B of -5 against its +7) and a tenth brighter than it, which
          // made the closed window the brightest thing in a kiosk lit by
          // three bulbs. These land the curtain's average on the drum's own
          // tone: about (87,79,80), luminance 81 against its 83.
          + ' repeating-linear-gradient(180deg,'
          + ' #231E20 0, #231E20 0.2cqi,'
          + ' #7E7373 0.2cqi, #7E7373 0.58cqi,'
          + ' #5F5757 0.58cqi, #5F5757 1.46cqi,'
          + ' #453E3F 1.46cqi, #453E3F 2.1cqi)',
        animation: still
          ? undefined
          : `kioskShutterDown ${ROLL_MS}ms ${PULL_AT - elapsed}ms both`,
      }}>
        {/* The bottom rail — heavier than a slat, with the lock slot in the
            middle of it. This is the edge your eye follows all the way down. */}
        <span style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '2.7cqi',
          background: 'linear-gradient(180deg, #968A8A 0%, #665C5C 26%, #322B2C 100%)',
          boxShadow: '0 -0.2cqi 0 rgba(0,0,0,0.55)',
        }}>
          <span style={{
            position: 'absolute', left: '50%', top: '38%',
            width: '3.4cqi', height: '0.7cqi',
            transform: 'translateX(-50%)',
            background: '#1F1A1B',
            boxShadow: '0 0.14cqi 0 rgba(196,182,180,0.35)',
          }} />
        </span>
      </div>
    </div>
  )
}
