'use client'

// ═══════════════════════════════════════════════════════════════════════════
// WEATHER FX — the sky itself. One component per kind.
//
// Every effect draws into a box that is exactly the window's aperture and
// nothing else, so all of them size in CONTAINER units (`cqi` / `cqh`) rather
// than px or vw. The kitchen window is about 66px across on a phone and the
// lab's is nearly three times that; a raindrop written in px is a smear in one
// and invisible in the other, while 1cqh is "one hundredth of this window"
// everywhere.
//
// Nothing here clips or masks. RoomWeather draws the room's own window frame
// back over the top, so an effect may paint its whole rectangle and still be
// physically unable to land on the wall.
//
// Motion is CSS only — these mount behind a room that re-renders on every drag
// frame, and a JS particle loop would be paying for animation nobody is
// looking at. Keyframes live in a plain <style> in each effect (NOT styled-jsx,
// which never resolves keyframes referenced from a React inline style).
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import type { WeatherId } from '@/lib/weather'

/** Stable pseudo-random, so the sky doesn't reshuffle on every render. */
function hash(n: number): number {
  const x = Math.sin(n * 78.233 + 41.7) * 27183.845
  return x - Math.floor(x)
}
const r2 = (n: number) => Math.round(n * 100) / 100

interface FxProps {
  /** Reduced motion: paint the sky, hold everything still. */
  still?: boolean
}

const FILL: React.CSSProperties = { position: 'absolute', inset: 0 }

/** A flat wash over the whole pane — the colour of the day. */
function Wash({ background, blend = 'normal', opacity = 1 }: {
  background: string; blend?: React.CSSProperties['mixBlendMode']; opacity?: number
}) {
  return <span style={{ ...FILL, background, mixBlendMode: blend, opacity }} />
}

// ─── Rain ────────────────────────────────────────────────────────────────────

function Rain({ still, heavy }: FxProps & { heavy?: boolean }) {
  const n = heavy ? 26 : 16
  return (
    <>
      <Wash background={heavy
        ? 'linear-gradient(180deg, rgba(38,46,72,0.62) 0%, rgba(58,68,96,0.5) 60%, rgba(74,84,110,0.42) 100%)'
        : 'linear-gradient(180deg, rgba(72,88,120,0.62) 0%, rgba(104,120,150,0.5) 100%)'} />

      {Array.from({ length: n }, (_, i) => {
        const s = i * 7
        const dur = (heavy ? 0.42 : 0.62) + hash(s) * (heavy ? 0.22 : 0.4)
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(hash(s + 1) * 104 - 2)}%`,
            top: '-24%',
            width: heavy ? '0.9cqi' : '0.7cqi',
            height: `${r2(11 + hash(s + 2) * 13)}cqh`,
            background: 'linear-gradient(180deg, rgba(224,240,255,0), rgba(224,240,255,0.92))',
            borderRadius: '40%',
            animation: still ? undefined
              : `wxFall ${r2(dur)}s linear ${r2(-hash(s + 3) * dur)}s infinite`,
          }} />
        )
      })}

      {/* On the glass, not behind it: a few drops crawling down the pane. */}
      {Array.from({ length: heavy ? 5 : 4 }, (_, i) => {
        const s = i * 31 + 3
        const dur = 5 + hash(s) * 6
        return (
          <span key={`d${i}`} style={{
            position: 'absolute',
            left: `${r2(8 + hash(s + 1) * 82)}%`,
            top: '-10%',
            width: `${r2(1.6 + hash(s + 2) * 1.6)}cqi`,
            height: `${r2(2.6 + hash(s + 2) * 2.4)}cqi`,
            borderRadius: '50% 50% 60% 60%',
            background: 'radial-gradient(60% 50% at 38% 32%, rgba(255,255,255,0.7), rgba(190,214,244,0.28) 70%, rgba(190,214,244,0.08))',
            boxShadow: 'inset 0 -0.4cqi 0.4cqi rgba(255,255,255,0.35)',
            animation: still ? undefined
              : `wxCrawl ${r2(dur)}s cubic-bezier(0.5,0,0.9,0.4) ${r2(-hash(s + 4) * dur)}s infinite`,
          }} />
        )
      })}

      <style>{`
        @keyframes wxFall  { to { transform: translate3d(-6%, 150%, 0); } }
        @keyframes wxCrawl {
          0%   { transform: translateY(0);    opacity: 0; }
          8%   { opacity: 0.9; }
          92%  { opacity: 0.9; }
          100% { transform: translateY(128cqh); opacity: 0; }
        }
      `}</style>
    </>
  )
}

// ─── Thunderstorm ────────────────────────────────────────────────────────────

function Storm({ still }: FxProps) {
  return (
    <>
      <Rain still={still} heavy />
      {!still && (
        <>
          {/* Two flashes on different clocks, so the timing never feels
              metronomic. The bolt only exists during its own flash. */}
          <span style={{
            ...FILL,
            background: 'linear-gradient(180deg, rgba(226,236,255,0.95), rgba(190,208,255,0.45))',
            opacity: 0, animation: 'wxFlashA 9s linear infinite',
          }} />
          <span style={{
            ...FILL,
            background: 'radial-gradient(70% 50% at 68% 12%, rgba(255,255,255,0.9), transparent 70%)',
            opacity: 0, animation: 'wxFlashB 13.4s linear infinite',
          }} />
          <span style={{
            position: 'absolute', left: '54%', top: '2%', width: '2.2cqi', height: '46cqh',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(200,220,255,0))',
            clipPath: 'polygon(46% 0, 100% 38%, 58% 42%, 92% 100%, 0 48%, 40% 44%, 8% 34%)',
            opacity: 0, animation: 'wxBolt 9s linear infinite',
          }} />
        </>
      )}
      <style>{`
        @keyframes wxFlashA {
          0%, 5.4%, 6.2%, 7.4%, 100% { opacity: 0; }
          5.6%  { opacity: 0.85; }
          6.6%  { opacity: 0.5; }
        }
        @keyframes wxFlashB { 0%, 3.2%, 4.4%, 100% { opacity: 0; } 3.6% { opacity: 0.75; } }
        @keyframes wxBolt   { 0%, 5.4%, 6.6%, 100% { opacity: 0; } 5.7% { opacity: 1; } 6.1% { opacity: 0.35; } }
      `}</style>
    </>
  )
}

// ─── Snow ────────────────────────────────────────────────────────────────────

function Snow({ still }: FxProps) {
  return (
    <>
      <Wash background="linear-gradient(180deg, rgba(196,214,240,0.5) 0%, rgba(228,238,252,0.42) 100%)" />
      {Array.from({ length: 22 }, (_, i) => {
        const s = i * 11
        const size = 1.3 + hash(s) * 2.4
        const dur = 5 + hash(s + 1) * 7
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(hash(s + 2) * 100)}%`,
            top: '-8%',
            width: `${r2(size)}cqi`, height: `${r2(size)}cqi`,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)',
            boxShadow: '0 0 0.6cqi rgba(255,255,255,0.6)',
            opacity: r2(0.5 + hash(s + 3) * 0.5),
            ['--sway' as string]: `${r2(3 + hash(s + 4) * 9)}cqi`,
            animation: still ? undefined
              : `wxSnow ${r2(dur)}s linear ${r2(-hash(s + 5) * dur)}s infinite`,
          }} />
        )
      })}
      <style>{`
        @keyframes wxSnow {
          0%   { transform: translate3d(0, 0, 0); }
          50%  { transform: translate3d(var(--sway), 58cqh, 0); }
          100% { transform: translate3d(0, 118cqh, 0); }
        }
      `}</style>
    </>
  )
}

// ─── Sunrise / sunset ────────────────────────────────────────────────────────
// The same machine pointed two ways: a disc that travels, a graded sky and a
// bloom. Sunrise climbs and warms; sunset sinks and goes violet.

function Sun({ still, dusk }: FxProps & { dusk?: boolean }) {
  const sky = dusk
    ? 'linear-gradient(180deg, #4A2A63 0%, #A8496B 32%, #F0784E 62%, #FFB055 84%, #FFD79A 100%)'
    : 'linear-gradient(180deg, #7EA9D8 0%, #F5B77E 52%, #FFD79A 78%, #FFF0CC 100%)'
  const disc = dusk ? '#FF8A4C' : '#FFE39A'
  return (
    <>
      <Wash background={sky} opacity={0.92} />
      <span style={{
        position: 'absolute',
        left: dusk ? '58%' : '34%',
        bottom: '4%',
        width: '26cqi', height: '26cqi', marginLeft: '-13cqi',
        borderRadius: '50%',
        background: `radial-gradient(circle, #FFF6D8 0%, ${disc} 46%, rgba(255,160,80,0) 72%)`,
        filter: 'blur(0.3cqi)',
        animation: still ? undefined : `${dusk ? 'wxSink' : 'wxRise'} 22s ease-in-out infinite alternate`,
      }} />
      {/* One soft shaft, so the light has a direction. */}
      <span style={{
        ...FILL,
        background: dusk
          ? 'linear-gradient(112deg, transparent 40%, rgba(255,190,140,0.24) 55%, transparent 70%)'
          : 'linear-gradient(68deg, transparent 36%, rgba(255,236,190,0.28) 52%, transparent 68%)',
      }} />
      <style>{`
        @keyframes wxRise { from { transform: translateY(16cqh) scale(0.92); } to { transform: translateY(-8cqh) scale(1); } }
        @keyframes wxSink { from { transform: translateY(-8cqh) scale(1); } to { transform: translateY(18cqh) scale(0.94); } }
      `}</style>
    </>
  )
}

// ─── Petals ──────────────────────────────────────────────────────────────────

function Petals({ still }: FxProps) {
  return (
    <>
      <Wash background="linear-gradient(180deg, rgba(255,226,240,0.34) 0%, rgba(255,244,248,0.2) 100%)" />
      {Array.from({ length: 18 }, (_, i) => {
        const s = i * 17
        const size = 1.6 + hash(s) * 2.2
        const dur = 4.4 + hash(s + 1) * 5
        const pale = hash(s + 6) > 0.55
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(hash(s + 2) * 100 - 12)}%`,
            top: `${r2(-14 + hash(s + 3) * 10)}%`,
            width: `${r2(size)}cqi`, height: `${r2(size * 0.66)}cqi`,
            borderRadius: '68% 32% 68% 32%',
            background: pale ? '#FFD7E6' : '#FFA9C9',
            opacity: r2(0.6 + hash(s + 4) * 0.4),
            ['--drift' as string]: `${r2(38 + hash(s + 5) * 46)}cqi`,
            animation: still ? undefined
              : `wxPetal ${r2(dur)}s linear ${r2(-hash(s + 7) * dur)}s infinite`,
          }} />
        )
      })}
      <style>{`
        @keyframes wxPetal {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
          100% { transform: translate3d(var(--drift), 124cqh, 0) rotate(680deg); }
        }
      `}</style>
    </>
  )
}

// ─── Fireflies ───────────────────────────────────────────────────────────────

function Fireflies({ still }: FxProps) {
  return (
    <>
      <Wash background="linear-gradient(180deg, #23305C 0%, #35406A 46%, #4E4A6B 78%, #6B5670 100%)" opacity={0.9} />
      {Array.from({ length: 14 }, (_, i) => {
        const s = i * 23
        const size = 0.9 + hash(s) * 1.5
        const dur = 6 + hash(s + 1) * 8
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(6 + hash(s + 2) * 88)}%`,
            top: `${r2(14 + hash(s + 3) * 74)}%`,
            width: `${r2(size)}cqi`, height: `${r2(size)}cqi`,
            borderRadius: '50%',
            background: '#FFF3B0',
            boxShadow: '0 0 1.6cqi 0.4cqi rgba(255,226,138,0.65)',
            opacity: 0,
            ['--fx' as string]: `${r2(hash(s + 4) * 22 - 11)}cqi`,
            ['--fy' as string]: `${r2(hash(s + 5) * 18 - 9)}cqi`,
            animation: still ? 'none'
              : `wxFly ${r2(dur)}s ease-in-out ${r2(-hash(s + 6) * dur)}s infinite`,
          }} />
        )
      })}
      <style>{`
        @keyframes wxFly {
          0%, 100% { transform: translate3d(0,0,0);                 opacity: 0; }
          22%      { opacity: 0.95; }
          50%      { transform: translate3d(var(--fx), var(--fy), 0); opacity: 0.55; }
          78%      { opacity: 0.9; }
        }
      `}</style>
    </>
  )
}

// ─── Night sky, and the things that cross it ─────────────────────────────────

function Stars({ n = 20, seed = 0 }: { n?: number; seed?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const s = i * 13 + seed
        const size = 0.5 + hash(s) * 0.9
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(hash(s + 1) * 100)}%`,
            top: `${r2(hash(s + 2) * 88)}%`,
            width: `${r2(size)}cqi`, height: `${r2(size)}cqi`,
            borderRadius: '50%',
            background: '#FFFFFF',
            opacity: r2(0.35 + hash(s + 3) * 0.55),
          }} />
        )
      })}
    </>
  )
}

function Meteors({ still, tone }: FxProps & { tone: 'gold' | 'rose' }) {
  const head = tone === 'gold' ? '#FFF3C4' : '#FFD6EC'
  const tail = tone === 'gold' ? 'rgba(255,196,84,0)' : 'rgba(255,124,196,0)'
  const mid = tone === 'gold' ? 'rgba(255,214,120,0.9)' : 'rgba(255,150,208,0.9)'
  return (
    <>
      <Wash background="linear-gradient(180deg, #0B1030 0%, #16204A 58%, #26305C 100%)" opacity={0.95} />
      <Stars n={24} seed={tone === 'gold' ? 0 : 400} />
      {Array.from({ length: 7 }, (_, i) => {
        const s = i * 29 + (tone === 'gold' ? 0 : 91)
        const dur = 2.6 + hash(s) * 3.4
        const len = 22 + hash(s + 1) * 26
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(hash(s + 2) * 88 - 8)}%`,
            top: `${r2(hash(s + 3) * 52 - 12)}%`,
            width: `${r2(len)}cqi`, height: '0.7cqi',
            transform: 'rotate(28deg)',
            transformOrigin: 'left center',
            background: `linear-gradient(90deg, ${tail}, ${mid} 72%, ${head} 100%)`,
            borderRadius: '50%',
            opacity: 0,
            animation: still ? undefined
              : `wxMeteor ${r2(dur)}s ease-in ${r2(-hash(s + 4) * dur * 3)}s infinite`,
          }} />
        )
      })}
      <style>{`
        @keyframes wxMeteor {
          0%       { transform: rotate(28deg) translate3d(-40cqi, -30cqh, 0); opacity: 0; }
          6%       { opacity: 1; }
          26%      { opacity: 1; }
          40%,100% { transform: rotate(28deg) translate3d(120cqi, 74cqh, 0);  opacity: 0; }
        }
      `}</style>
    </>
  )
}

function Aurora({ still }: FxProps) {
  const bands = [
    { hue: 'rgba(99,240,192,0.55)', x: 8, w: 34, dur: 15 },
    { hue: 'rgba(120,180,255,0.45)', x: 30, w: 40, dur: 19 },
    { hue: 'rgba(186,120,255,0.42)', x: 56, w: 36, dur: 23 },
  ]
  return (
    <>
      <Wash background="linear-gradient(180deg, #06102A 0%, #0C1A3C 60%, #142449 100%)" opacity={0.96} />
      <Stars n={18} seed={800} />
      {bands.map((b, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: `${b.x}%`, top: '-14%',
          width: `${b.w}%`, height: '96%',
          background: `linear-gradient(180deg, transparent 0%, ${b.hue} 34%, ${b.hue} 58%, transparent 100%)`,
          filter: 'blur(1.6cqi)',
          mixBlendMode: 'screen',
          transformOrigin: '50% 0%',
          animation: still ? undefined
            : `wxAurora ${b.dur}s ease-in-out ${r2(-i * 4.2)}s infinite alternate`,
        }} />
      ))}
      <style>{`
        @keyframes wxAurora {
          0%   { transform: skewX(-9deg) scaleY(0.86) translateX(-4cqi); opacity: 0.6; }
          50%  { transform: skewX(6deg)  scaleY(1.06) translateX(5cqi);  opacity: 1; }
          100% { transform: skewX(-4deg) scaleY(0.94) translateX(-2cqi); opacity: 0.75; }
        }
      `}</style>
    </>
  )
}

// ─── The switch ──────────────────────────────────────────────────────────────

export default memo(function WeatherFx({ id, still }: {
  id: WeatherId
  still?: boolean
}) {
  switch (id) {
    case 'rain':         return <Rain still={still} />
    case 'storm':        return <Storm still={still} />
    case 'snow':         return <Snow still={still} />
    case 'sunrise':      return <Sun still={still} />
    case 'sunset':       return <Sun still={still} dusk />
    case 'petals':       return <Petals still={still} />
    case 'fireflies':    return <Fireflies still={still} />
    case 'meteors_gold': return <Meteors still={still} tone="gold" />
    case 'meteors_rose': return <Meteors still={still} tone="rose" />
    case 'aurora':       return <Aurora still={still} />
    default:             return null
  }
})
