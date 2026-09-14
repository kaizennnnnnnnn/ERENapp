'use client'

// What the street is doing tonight, seen through the hatch.
//
// One layer per kind of weather, all of them clipped to GLASS — the measured
// aperture of the window — because weather that spills onto the shutter and
// the ceiling lamps is weather in the kiosk with you.
//
// Rain lives in RainLayer; the two dry ones are here:
//
//   fog    a slow drift of haze that thins and thickens, plus a wash that
//          takes the far end of the street away. Fog is the best-paying night
//          in the kiosk and it should LOOK like the reason: nobody out there
//          can see anything but your lamps.
//   wind   nothing falls, so the tell is litter — scraps and a leaf or two
//          driven across the window, and the odd hard gust that shoves the
//          whole street sideways for a moment.

import RainLayer from './RainLayer'
import { GLASS, GLASS_MASK, type WeatherId } from './kioskShift'

/** Stable pseudo-random, so the weather doesn't reshuffle on every render. */
function hash(n: number): number {
  const x = Math.sin(n * 78.233 + 41.7) * 27183.845
  return x - Math.floor(x)
}

/** The box everything outside is drawn into. */
function pane(children: React.ReactNode, extra?: React.CSSProperties) {
  return (
    <div aria-hidden className="absolute pointer-events-none overflow-hidden" style={{
      left: `${GLASS.left}%`, top: `${GLASS.top}%`,
      width: `${GLASS.width}%`, height: `${GLASS.height}%`,
      zIndex: 3,
      // Weather stops at the counter, not at the rectangle.
      ...GLASS_MASK,
      ...extra,
    }}>
      {children}
    </div>
  )
}

function Fog({ still }: { still: boolean }) {
  return pane(
    <>
      {/* The street going. Heaviest at the far end, which in this picture is
          the middle distance where the road runs out. */}
      <span style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(120% 70% at 50% 34%, rgba(196,206,224,0.42), rgba(196,206,224,0.1) 62%, transparent 82%),'
          + ' linear-gradient(180deg, rgba(186,198,218,0.12) 0%, rgba(176,188,210,0.3) 62%, rgba(170,182,206,0.42) 100%)',
      }} />

      {/* Four slow banks, each drifting at its own speed and breathing on its
          own clock, so the haze never settles into one flat sheet. */}
      {Array.from({ length: 4 }, (_, i) => {
        const dur = 26 + hash(i) * 22
        const y = 12 + i * 22
        return (
          <span key={i} style={{
            position: 'absolute',
            left: '-40%', top: `${y}%`, width: '180%', height: '46%',
            background: `radial-gradient(60% 50% at 50% 50%, rgba(214,222,236,${(0.16 + hash(i + 9) * 0.12).toFixed(3)}), transparent 72%)`,
            animation: still ? undefined : `kioskFogDrift ${dur.toFixed(1)}s ease-in-out ${(-hash(i + 3) * dur).toFixed(1)}s infinite`,
          }} />
        )
      })}
    </>,
  )
}

function Wind({ still }: { still: boolean }) {
  return pane(
    <>
      {/* Litter, going past. Scraps are pale and flat, leaves are darker and
          spin — two silhouettes so it reads as rubbish rather than confetti. */}
      {Array.from({ length: 11 }, (_, i) => {
        const s = i * 13
        const leaf = hash(s + 1) > 0.55
        const dur = 1.5 + hash(s + 2) * 2.4
        const size = 0.9 + hash(s + 3) * 1.5
        return (
          <span key={i} style={{
            position: 'absolute',
            // Held still, the litter is scattered with `left` — a percentage
            // of the PANE — rather than left at 0 with the keyframes' own
            // percentage translate, which is a multiple of the scrap's own
            // 1-2cqi width and would pile all eleven into the left edge. And
            // it needs a real opacity: kioskWindBlow is what lifts it off
            // zero, so with the animation dropped the whole window was empty.
            left: still ? `${(hash(s + 6) * 88 + 4).toFixed(1)}%` : 0,
            top: `${(hash(s) * 92 + 3).toFixed(1)}%`,
            width: `${size.toFixed(2)}cqi`, height: `${(size * (leaf ? 0.72 : 0.34)).toFixed(2)}cqi`,
            borderRadius: leaf ? '60% 20% 60% 20%' : '1px',
            background: leaf ? 'rgba(120,104,74,0.62)' : 'rgba(214,208,196,0.5)',
            ['--spin' as string]: leaf ? '540deg' : '90deg',
            ['--sag' as string]: `${(hash(s + 4) * 16 - 6).toFixed(1)}cqi`,
            opacity: still ? 1 : 0,
            transform: still ? `rotate(${(hash(s + 7) * 60 - 30).toFixed(0)}deg)` : undefined,
            animation: still ? undefined : `kioskWindBlow ${dur.toFixed(2)}s linear ${(-hash(s + 5) * dur).toFixed(2)}s infinite`,
          }} />
        )
      })}

      {/* And the gust itself: a pale sheet of dust dragged across the whole
          window every few seconds. It's the only part you feel. Held still it
          stays as a faint diagonal wash rather than being removed — the pane
          still has to read as moving air. Its own opacity, because the
          keyframes hold zero for most of the cycle and an unanimated element
          would otherwise sit at 1. */}
      <span style={{
        position: 'absolute', inset: '-10% -60%',
        background: 'linear-gradient(96deg, transparent 0%, rgba(226,224,214,0.16) 42%, rgba(226,224,214,0.05) 58%, transparent 100%)',
        opacity: still ? 0.7 : undefined,
        animation: still ? undefined : 'kioskWindGust 5.4s ease-in-out infinite',
      }} />
    </>,
  )
}

export default function StreetWeather({ weather, still = false }: {
  weather: WeatherId
  still?: boolean
}) {
  if (weather === 'rain') return <RainLayer still={still} />
  if (weather === 'fog') return <Fog still={still} />
  if (weather === 'wind') return <Wind still={still} />
  return null
}
