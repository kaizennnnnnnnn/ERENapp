'use client'

// ═══════════════════════════════════════════════════════════════════════════
// MOOD SKY — the backdrop behind the daily check-in. Layers, back to front:
// sky gradient → horizon haze → two drifting cloud banks → a scattered
// sparkle field → film grain → vignette.
//
// The palette swaps with getDaypart(), so the sky agrees with the greeting:
// "Good afternoon" lands over an afternoon sky, 3am over a near-black one.
// Sparkle placement comes from a seeded PRNG so server and client agree on
// the layout (a Math.random() field would hydrate-mismatch every load).
//
// The sun/moon disc is NOT drawn here — MoodGateView renders it directly
// behind Eren via <SkyDisc>, so the two always line up regardless of how
// tall the screen is.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { getDaypart, type Daypart } from '@/lib/timeOfDay'
import SparkleField from '@/components/SparkleField'

export interface SkyPalette {
  gradient: string
  /** Warm band sitting on the horizon, over the gradient. */
  haze: string
  /** Sun/moon face + rim, used by <SkyDisc>. */
  disc: string
  discEdge: string
  bloom: string
  cloud: string
  sparkle: string[]
  /** The moon gets craters; the sun doesn't. */
  craters: boolean
  vignette: string
}

const SKIES: Record<Daypart, SkyPalette> = {
  dawn: {
    gradient: 'linear-gradient(180deg, #4C3F86 0%, #8A6EB4 28%, #D98CA6 58%, #FFC08C 82%, #FFE6BE 100%)',
    haze: 'linear-gradient(180deg, transparent 55%, rgba(255,186,120,0.42) 88%, rgba(255,226,180,0.6) 100%)',
    disc: '#FFF0C4', discEdge: '#FFC178', bloom: 'rgba(255,190,130,0.55)',
    cloud: 'rgba(255,226,236,0.62)',
    sparkle: ['#FFF6DC', '#FFC9DC', '#FFE0AC'],
    craters: false,
    vignette: 'radial-gradient(ellipse at 50% 42%, transparent 46%, rgba(60,26,84,0.34) 100%)',
  },
  day: {
    gradient: 'linear-gradient(180deg, #93BEEE 0%, #B7B7F2 26%, #D6BFEF 52%, #F1D5EA 78%, #FFF0DA 100%)',
    haze: 'linear-gradient(180deg, transparent 58%, rgba(255,222,186,0.34) 90%, rgba(255,240,218,0.5) 100%)',
    disc: '#FFFBE4', discEdge: '#FFD98E', bloom: 'rgba(255,238,190,0.6)',
    cloud: 'rgba(255,255,255,0.72)',
    // Daytime needs warm/pink sparkles — white ones vanish into a light sky.
    sparkle: ['#FFD666', '#F58FCE', '#FFFFFF'],
    craters: false,
    vignette: 'radial-gradient(ellipse at 50% 42%, transparent 48%, rgba(84,40,120,0.28) 100%)',
  },
  dusk: {
    gradient: 'linear-gradient(180deg, #2E2258 0%, #63397E 26%, #AC4E7C 56%, #E4726A 80%, #F9B168 100%)',
    haze: 'linear-gradient(180deg, transparent 52%, rgba(246,140,96,0.4) 86%, rgba(255,186,116,0.55) 100%)',
    disc: '#FFE3AC', discEdge: '#F98C58', bloom: 'rgba(250,146,104,0.5)',
    cloud: 'rgba(96,44,92,0.45)',
    sparkle: ['#FFE7B4', '#FFB6C9', '#DCBBFE'],
    craters: false,
    vignette: 'radial-gradient(ellipse at 50% 42%, transparent 44%, rgba(24,8,44,0.44) 100%)',
  },
  night: {
    gradient: 'linear-gradient(180deg, #120D33 0%, #271854 32%, #452768 64%, #6A3670 86%, #8B4A6C 100%)',
    haze: 'linear-gradient(180deg, transparent 62%, rgba(158,72,106,0.32) 92%, rgba(196,104,116,0.4) 100%)',
    disc: '#F2EDFD', discEdge: '#B9A9E6', bloom: 'rgba(190,176,255,0.42)',
    cloud: 'rgba(52,32,90,0.5)',
    sparkle: ['#FFFFFF', '#CFC2FF', '#FFE3A6'],
    craters: true,
    vignette: 'radial-gradient(ellipse at 50% 42%, transparent 42%, rgba(6,2,20,0.52) 100%)',
  },
  latenight: {
    gradient: 'linear-gradient(180deg, #070518 0%, #120C31 36%, #201748 68%, #2E2058 100%)',
    haze: 'linear-gradient(180deg, transparent 68%, rgba(72,48,120,0.3) 100%)',
    disc: '#E9E4F8', discEdge: '#9C8BD4', bloom: 'rgba(160,148,232,0.34)',
    cloud: 'rgba(20,12,46,0.55)',
    sparkle: ['#FFFFFF', '#B7ACEF', '#FFD9A0'],
    craters: true,
    vignette: 'radial-gradient(ellipse at 50% 42%, transparent 40%, rgba(0,0,0,0.6) 100%)',
  },
}

/**
 * Palette for the current daypart, resolved AFTER mount.
 *
 * getDaypart() reads the browser's clock, which the server has no way to
 * know. Resolving it during SSR is not just imprecise — React 18 does not
 * repaint a mismatched `style` attribute on hydration, so a server that
 * guessed "day" would leave a daytime sky pinned behind a 2am visitor.
 * The gate sits behind the splash screen until the page reports ready, so
 * the one-frame correction is never on screen.
 */
export function useSkyPalette(): SkyPalette {
  const [part, setPart] = useState<Daypart>('day')
  useEffect(() => { setPart(getDaypart()) }, [])
  return SKIES[part]
}

// ── Clouds ─────────────────────────────────────────────────────────────────

function Cloud({ top, width, fill, dur, delay, flip }: {
  top: string; width: string; fill: string; dur: number; delay: number; flip?: boolean
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', top, left: 0, width,
        animation: `mgCloudDrift ${dur}s linear infinite`,
        animationDelay: `-${delay}s`,
        willChange: 'transform',
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    >
      <svg viewBox="0 0 160 56" width="100%" style={{ display: 'block', filter: 'blur(0.5px)' }}>
        <g fill={fill}>
          <ellipse cx="42" cy="34" rx="28" ry="17" />
          <ellipse cx="72" cy="28" rx="24" ry="21" />
          <ellipse cx="100" cy="33" rx="25" ry="15" />
          <ellipse cx="124" cy="36" rx="19" ry="12" />
          <rect x="28" y="34" width="110" height="14" rx="7" />
        </g>
      </svg>
    </div>
  )
}

// ── Sun / moon ─────────────────────────────────────────────────────────────

/** The disc + its bloom. Rendered by the view behind Eren, not by the sky,
 *  so it tracks his position instead of the viewport. */
export function SkyDisc({ palette, size = 132 }: { palette: SkyPalette; size?: number }) {
  return (
    // Deliberately off the centre line: a disc squarely behind his head
    // reads as a halo, and centring everything is what made the old screen
    // feel like a template.
    <div aria-hidden style={{
      position: 'absolute', top: '30%', left: '30%',
      transform: 'translate(-50%, -50%)', pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: size * 3.4, height: size * 3.4, transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${palette.bloom} 0%, transparent 58%)`,
        animation: 'mgBloom 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'relative', width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, #FFFFFF 0%, ${palette.disc} 44%, ${palette.discEdge} 100%)`,
        boxShadow: `0 0 34px ${palette.bloom}`,
      }}>
        {palette.craters && (
          <>
            <span style={craterStyle(palette.discEdge, 28, '24%', '30%')} />
            <span style={craterStyle(palette.discEdge, 17, '58%', '18%')} />
            <span style={craterStyle(palette.discEdge, 22, '42%', '62%')} />
            <span style={craterStyle(palette.discEdge, 12, '70%', '54%')} />
          </>
        )}
      </div>
    </div>
  )
}

const craterStyle = (tone: string, d: number, left: string, top: string): React.CSSProperties => ({
  position: 'absolute', left, top, width: d, height: d, borderRadius: '50%',
  background: tone, opacity: 0.32,
  boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.14)',
})

// ── The sky itself ─────────────────────────────────────────────────────────

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>\")"

export default function MoodSky({ palette, tint }: {
  palette: SkyPalette
  /** Mood glow washed over the sky once a mood is picked. */
  tint?: string | null
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ background: palette.gradient }} />
      <div className="absolute inset-0" style={{ background: palette.haze }} />

      <Cloud top="12%" width="62%" fill={palette.cloud} dur={132} delay={0} />
      <Cloud top="30%" width="44%" fill={palette.cloud} dur={188} delay={64} flip />
      <Cloud top="68%" width="72%" fill={palette.cloud} dur={156} delay={110} />

      <SparkleField colors={palette.sparkle} count={34} className="absolute inset-0" />

      <div className="absolute inset-0" style={{
        backgroundImage: GRAIN, opacity: 0.07, mixBlendMode: 'overlay',
      }} />
      <div className="absolute inset-0" style={{ background: palette.vignette }} />

      {/* Mood wash — the sky takes on the colour you just picked. */}
      <div className="absolute inset-0" style={{
        background: tint
          ? `radial-gradient(ellipse at 50% 38%, ${tint} 0%, transparent 72%)`
          : 'none',
        opacity: tint ? 1 : 0,
        transition: 'opacity 600ms ease-out',
      }} />
    </div>
  )
}
