'use client'

// The coins going in the jar.
//
// The jar has always filled — it just filled by itself, a level that rose
// because a number somewhere went up. Now you watch somebody decide: the
// coins come off the ledge in front of them, turn over in the air, and drop
// in one at a time with the jar answering each one. Nothing about the money
// changed. It just has a cause now.
//
// How MANY is the point. A good tip should look like a good tip before you
// have read a single number, so a couple of coins is a couple of coins and a
// fat one is a handful thrown together — fanned across different arcs, at
// different heights, landing a beat apart.

import { useEffect } from 'react'
import { TIP_JAR, SILL_PCT } from './kioskShift'
import { playSound, type SoundName } from '@/lib/sounds'

/** Where they start: in front of whoever's at the window, on the ledge. */
const FROM = { x: 50, y: SILL_PCT - 2.4 }
/** And where they end: the mouth of the jar. */
const TO = { x: TIP_JAR.x, y: TIP_JAR.top + 1.6 }

/** The picture is 768 x 1376, so a percentage DOWN is not the same distance
 *  as a percentage ACROSS. Both legs of the flight are converted into cqi —
 *  percent of the picture's width — or the arc lands short. */
const PIC_ASPECT = 1376 / 768

/** One coin's flight. */
export const COIN_MS = 560
/** And the gap between them. Slow enough to hear as separate coins, quick
 *  enough that five of them still read as one handful. */
const COIN_GAP_MS = 95

/** Most coins a tip is ever worth showing. Past this it stops reading as a
 *  count and starts reading as confetti. */
const MAX_COINS = 5
/** How much of a tip one coin stands for. */
const PER_COIN = 6

/** Ascending, so a handful climbs rather than repeating one note. */
const TIP_SOUNDS: SoundName[] = ['kiosk_tip', 'kiosk_tip2', 'kiosk_tip3']

export function coinsFor(tip: number): number {
  return Math.max(1, Math.min(MAX_COINS, Math.round(tip / PER_COIN) || 1))
}

/** How long the whole handful is in the air — what the caller has to wait
 *  before it can unmount us. */
export function coinFlightMs(tip: number): number {
  return COIN_MS + (coinsFor(tip) - 1) * COIN_GAP_MS
}

/** Fixed offsets rather than random ones: a jar that reshuffles its coins on
 *  every render would fizz, and these are hand-picked to fan rather than to
 *  scatter. Per coin: where on the ledge it was sitting, how high it goes,
 *  and how fast it turns over. */
const FAN = [
  { x: 0,    lift: 5.4, spin: 250 },
  { x: -3.1, lift: 7.0, spin: 205 },
  { x: 2.6,  lift: 4.2, spin: 300 },
  { x: -1.4, lift: 6.2, spin: 175 },
  { x: 3.6,  lift: 8.1, spin: 230 },
]

interface Props {
  /** Bumped per payout, so React remounts the whole handful. */
  id: number
  /** What they left. Decides how many coins you see. */
  tip: number
  /** Reduced motion: the money still arrives, it just doesn't fly. */
  still?: boolean
}

export default function TipCoin({ id, tip, still = false }: Props) {
  const n = coinsFor(tip)

  // The jar answers each coin as it lands, not all of them when the sale
  // closes — the sound IS the landing, and a stack of them fired together is
  // one noise instead of a handful of coins.
  useEffect(() => {
    const timers = Array.from({ length: n }, (_, i) =>
      setTimeout(() => playSound(TIP_SOUNDS[i % TIP_SOUNDS.length]),
        still ? i * COIN_GAP_MS : COIN_MS * 0.86 + i * COIN_GAP_MS))
    return () => timers.forEach(clearTimeout)
  }, [id, n, still])

  // Reduced motion: the money still arrives and the jar still fills, it just
  // doesn't fly. Nothing is rendered rather than rendered invisible.
  if (still) return null

  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const fan = FAN[i % FAN.length]
        const dx = TO.x - (FROM.x + fan.x)
        const dy = (TO.y - FROM.y) * PIC_ASPECT
        const delay = i * COIN_GAP_MS
        return (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none"
            style={{
              position: 'absolute',
              left: `${FROM.x + fan.x}%`, top: `${FROM.y}%`,
              width: '2.6cqi', height: '2.6cqi',
              zIndex: 9,
              opacity: 0,
              ['--dx' as string]: `${dx.toFixed(2)}cqi`,
              ['--dy' as string]: `${dy.toFixed(2)}cqi`,
              ['--lift' as string]: `${fan.lift.toFixed(1)}cqi`,
              animation: `kioskTipCoin ${COIN_MS}ms cubic-bezier(0.36, 0, 0.66, 1) ${delay}ms both`,
            }}
          >
            {/* Position outside, spin inside. A forwards-filling flip on the
                outer element would overwrite the flight's own transform. */}
            <span style={{
              display: 'block', width: '100%', height: '100%',
              borderRadius: '50%',
              // A struck coin, not a dot: a bright face, a darker milled rim
              // around it, and one hard glint. At eleven pixels the rim is
              // what makes it read as metal rather than as a bubble.
              background: 'radial-gradient(circle at 36% 30%,'
                + ' #FFF6CE 0%, #FFDE84 26%, #E8B441 58%, #B97F1E 84%, #7A4E0C 100%)',
              boxShadow: 'inset 0 0 0 0.28cqi rgba(122,78,12,0.75),'
                + ' 0 0 5px rgba(255,206,90,0.5)',
              animation: `kioskTipFlip ${fan.spin}ms linear ${delay}ms infinite`,
            }} />
          </span>
        )
      })}

      {/* The jar mouth flashing as each one goes in. `forwards`, not `both`:
          a backwards fill paints the 0% frame for the whole delay, which left
          every ring sitting lit on the jar from the moment the coins were
          thrown, waiting for its turn. */}
      {Array.from({ length: n }, (_, i) => (
        <span key={`land-${i}`} aria-hidden className="pointer-events-none" style={{
          position: 'absolute',
          left: `${TO.x}%`, top: `${TO.y}%`,
          width: '4.6cqi', height: '4.6cqi',
          borderRadius: '50%',
          border: '0.34cqi solid rgba(255,214,120,0.85)',
          zIndex: 9,
          opacity: 0,
          animation: `kioskTipLand 260ms ease-out ${(COIN_MS * 0.86 + i * COIN_GAP_MS).toFixed(0)}ms forwards`,
        }} />
      ))}
    </>
  )
}
