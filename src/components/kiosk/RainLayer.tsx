'use client'

// Rain, seen THROUGH the serving hatch.
//
// The old version was a repeating gradient stretched across the whole top of
// the wall, which put weather on the shutter, the tiled walls and the ceiling
// lamps — indoors, with you. Worse, a stripe pattern can only ever appear to
// move perpendicular to its own stripes, so sliding it "downward" along the
// slant produced almost no visible motion at all: static scratches on the
// picture rather than rain.
//
// So: real streaks, and only inside GLASS — the measured aperture of the
// window. Three passes, because a downpour has depth:
//
//   far    thin, dim, quick, plentiful — the body of the rain
//   near   fatter and brighter, fewer, faster — drops close to the pane
//   runnel slow near-vertical trails, water ON the glass rather than in front
//
// Every streak is one composited element moving on `transform` alone, and
// their positions come from a hash of their index rather than Math.random, so
// the rain doesn't reshuffle itself on every re-render of the shift.

import { GLASS } from './kioskShift'

/** Stable pseudo-random in [0,1). Same seed, same rain, every render. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

interface StreakSpec {
  /** How many of them. */
  count: number
  /** Seed offset, so the three passes don't line up. */
  seed: number
  /** Tilt off vertical, degrees. The path follows it, so this is the wind. */
  tilt: number
  /** Streak length, as % of the window's height. */
  len: [number, number]
  /** Streak width, in cqi (% of the picture's width). */
  thick: [number, number]
  /** One fall, in ms. */
  dur: [number, number]
  alpha: [number, number]
}

const FAR: StreakSpec = {
  count: 30, seed: 0,   tilt: 8,
  len: [6, 12], thick: [0.2, 0.32], dur: [820, 1180], alpha: [0.16, 0.3],
}
const NEAR: StreakSpec = {
  count: 12, seed: 400, tilt: 9,
  len: [12, 20], thick: [0.4, 0.6],  dur: [520, 720],  alpha: [0.32, 0.5],
}
const RUNNEL: StreakSpec = {
  count: 5,  seed: 900, tilt: 2,
  len: [16, 30], thick: [0.5, 0.8],  dur: [2600, 4200], alpha: [0.1, 0.18],
}

function lerp(range: [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t
}

function Pass({ spec, still }: { spec: StreakSpec; still: boolean }) {
  return (
    <>
      {Array.from({ length: spec.count }, (_, i) => {
        const s = spec.seed + i * 7
        // Stratified, not random: one streak per lane, jittered inside it.
        // Pure hashing left a bald patch down the middle of the window and a
        // clump in one corner, which reads as a glitch rather than weather.
        // The lanes overshoot both edges because a tilted column drifts
        // sideways as it falls — the clip takes care of the rest.
        const x = -12 + ((i + 0.15 + hash(s) * 0.7) / spec.count) * 124
        const len = lerp(spec.len, hash(s + 1))
        const thick = lerp(spec.thick, hash(s + 2))
        const dur = lerp(spec.dur, hash(s + 3))
        const alpha = lerp(spec.alpha, hash(s + 4))
        // A negative delay starts every streak mid-fall, so the rain is
        // already coming down on the first frame instead of arriving as a
        // curtain from above.
        const delay = -hash(s + 5) * dur
        return (
          <span key={i} aria-hidden style={{
            position: 'absolute', top: 0, left: `${x.toFixed(2)}%`,
            width: `${thick.toFixed(2)}cqi`, height: '100%',
            // The rotate comes FIRST so the translate runs along the streak's
            // own axis — the drop falls the way it's leaning, which is the
            // whole difference between rain and a sliding tally mark. The
            // keyframes read the tilt back out of this variable, so all three
            // passes share one animation.
            ['--tilt' as string]: `${spec.tilt}deg`,
            // Standing still, they're spread down the window instead of
            // stacked at the top: reduced motion should still look like a wet
            // night, not like the rain is queueing.
            transform: `rotate(${spec.tilt}deg) translate3d(0, ${still ? (hash(s + 6) * 170 - 85).toFixed(1) : -110}%, 0)`,
            animation: still ? undefined : `kioskRainFall ${dur.toFixed(0)}ms linear ${delay.toFixed(0)}ms infinite`,
            willChange: 'transform',
          }}>
            <span style={{
              display: 'block', width: '100%', height: `${len.toFixed(1)}%`,
              borderRadius: '40%',
              background:
                `linear-gradient(180deg,` +
                ` rgba(198,222,255,0) 0%,` +
                ` rgba(198,222,255,${alpha.toFixed(3)}) 46%,` +
                ` rgba(232,244,255,${(alpha * 1.35).toFixed(3)}) 86%,` +
                ` rgba(198,222,255,0) 100%)`,
            }} />
          </span>
        )
      })}
    </>
  )
}

/** Drops breaking on the ledge, along the bottom edge of the glass. Without
 *  them the rain falls into the picture and simply stops existing. */
function Splashes({ still }: { still: boolean }) {
  if (still) return null
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const s = 1300 + i * 11
        const dur = 900 + hash(s) * 900
        return (
          <span key={i} aria-hidden style={{
            position: 'absolute',
            left: `${(hash(s + 1) * 96 + 2).toFixed(1)}%`, bottom: `${(hash(s + 2) * 3).toFixed(1)}%`,
            width: '1.6cqi', height: '0.34cqi', borderRadius: '50%',
            background: 'rgba(214,232,255,0.55)',
            animation: `kioskRainSplash ${dur.toFixed(0)}ms ease-out ${(-hash(s + 3) * dur).toFixed(0)}ms infinite`,
          }} />
        )
      })}
    </>
  )
}

export default function RainLayer({ still = false }: { still?: boolean }) {
  return (
    <div aria-hidden className="absolute pointer-events-none overflow-hidden" style={{
      left: `${GLASS.left}%`, top: `${GLASS.top}%`,
      width: `${GLASS.width}%`, height: `${GLASS.height}%`,
      zIndex: 3,
    }}>
      {/* The pane going cold and wet. Barely there — it only has to take the
          street half a step further away. */}
      <span aria-hidden style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(180deg, rgba(150,182,235,0.10) 0%, rgba(150,182,235,0.03) 38%, rgba(120,150,200,0.07) 100%)',
      }} />
      <Pass spec={FAR} still={still} />
      <Pass spec={NEAR} still={still} />
      <Pass spec={RUNNEL} still={still} />
      <Splashes still={still} />
    </div>
  )
}
