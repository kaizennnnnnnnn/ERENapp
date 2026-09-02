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
  /**
   * The ROOM around this window is in daylight. The night skies that paint
   * their own sky — aurora and fireflies — paint an evening instead of a
   * midnight when it is, because a near-black pane in a sunlit room does not
   * read as a night sky: it reads as a hole in the wall, with the sunlit
   * hedge on the sill still lit by a sun that is apparently no longer there.
   * An evening sky is a scene; midnight behind daylight is a mistake.
   *
   * Meteors do not take it, because they no longer paint a sky at all.
   */
  lit?: boolean
}

const FILL: React.CSSProperties = { position: 'absolute', inset: 0 }

/** A flat wash over the whole pane — the colour of the day. */
function Wash({ background, blend = 'normal', opacity = 1 }: {
  background: string; blend?: React.CSSProperties['mixBlendMode']; opacity?: number
}) {
  return <span style={{ ...FILL, background, mixBlendMode: blend, opacity }} />
}

// ─── Clear ───────────────────────────────────────────────────────────────────
// The afternoon the rooms were painted in. It is NOT a layer — RoomWeather
// returns early for `clear` and lets the original art show through — but every
// THUMBNAIL still has to draw something, and "nothing" renders as a black hole:
// the picker's CLEAR tile, a room chip for a window nobody has changed, and the
// built machine's own screen, whose sky defaults to clear. So this exists for
// the little panes only, and it paints what the artist painted: blue going pale
// at the horizon, two slow clouds, and a hint of the treeline.

function Clear({ still }: FxProps) {
  return (
    <>
      <Wash background="linear-gradient(180deg, #56A9E8 0%, #8FD3FF 62%, #CDEAFF 100%)" />
      {[
        { top: 16, left: -30, w: 46, dur: 34, delay: 0 },
        { top: 38, left: -70, w: 32, dur: 44, delay: -18 },
      ].map((c, i) => (
        <span key={i} style={{
          position: 'absolute',
          top: `${c.top}cqh`,
          left: still ? `${-c.left / 3}%` : 0,
          width: `${c.w}cqi`,
          height: `${c.w * 0.42}cqi`,
          background: 'radial-gradient(ellipse at 42% 62%, rgba(255,255,255,0.97) 0%, rgba(244,251,255,0.8) 38%, rgba(240,249,255,0.34) 62%, rgba(255,255,255,0) 78%)',
          animation: still ? undefined
            : `wxClearDrift ${c.dur}s linear ${c.delay}s infinite`,
        }} />
      ))}
      {/* the treeline the windows all look out onto */}
      <span style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '17cqh',
        background: 'linear-gradient(180deg, rgba(96,158,86,0) 0%, rgba(88,150,80,0.85) 55%, rgba(64,120,60,0.95) 100%)',
      }} />
      <style>{`
        @keyframes wxClearDrift {
          0%   { transform: translateX(-40cqi); }
          100% { transform: translateX(140cqi); }
        }
      `}</style>
    </>
  )
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

function Fireflies({ still, lit }: FxProps) {
  return (
    <>
      <Wash background={lit
        ? 'linear-gradient(180deg, #3B4A7B 0%, #56608B 46%, #75697F 78%, #937486 100%)'
        : 'linear-gradient(180deg, #23305C 0%, #35406A 46%, #4E4A6B 78%, #6B5670 100%)'}
        opacity={lit ? 0.84 : 0.9} />
      {Array.from({ length: 16 }, (_, i) => {
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

function Stars({ n = 20, seed = 0, still }: { n?: number; seed?: number; still?: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const s = i * 13 + seed
        // A handful of bright ones among many faint: an even scatter of
        // identical dots reads as noise, not a sky.
        const bright = hash(s + 5) > 0.9
        const size = bright ? 0.6 + hash(s) * 0.35 : 0.32 + hash(s) * 0.4
        const dim = r2(0.25 + hash(s + 3) * 0.4)
        return (
          <span key={i} className="wxStar" style={{
            position: 'absolute',
            left: `${r2(hash(s + 1) * 100)}%`,
            top: `${r2(hash(s + 2) * 88)}%`,
            width: `${r2(size)}cqi`, height: `${r2(size)}cqi`,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: bright ? `0 0 ${r2(size * 0.8)}cqi rgba(198,220,255,0.55)` : undefined,
            opacity: r2(dim + 0.35),
            ['--dim' as string]: dim,
            ['--lit' as string]: r2(Math.min(1, dim + 0.55)),
            animation: still ? undefined
              : `wxTwinkle ${r2(2.6 + hash(s + 4) * 4.4)}s ease-in-out ${r2(-hash(s + 6) * 7)}s infinite`,
          }} />
        )
      })}
      <style>{`
        @keyframes wxTwinkle {
          0%, 100% { opacity: var(--dim); }
          50%      { opacity: var(--lit); }
        }
      `}</style>
    </>
  )
}

// A meteor shower, drawn the way one actually looks.
//
// Four things separate this from a diagonal bar sliding across the pane:
//
//   it travels along its own tail.  The first cut wrote
//   `rotate(28deg) translate3d(-40cqi, -30cqh, 0)`, and because a translate
//   AFTER a rotate happens in the rotated frame, the streak pointed at 28°
//   while actually moving at 61° — sliding sideways, like a stick being
//   dragged. Every meteor here is `rotate(var(--ang)) translateX(...)`, one
//   axis only, so the direction of travel IS the direction it points.
//
//   they share a radiant.  Real showers fan out from one point in the sky,
//   so the angles spread over a narrow arc instead of all being identical.
//
//   the tail grows.  scaleX from a fifth to full, anchored at the head, so
//   the trail draws itself out behind a moving point rather than gliding
//   across fully formed. The stretch lives on the TAIL, never on the wrapper:
//   scaling the wrapper squashed the head with it and turned the bright point
//   into a wedge.
//
//   they are brief and rare.  The streak occupies about a sixth of each
//   element's cycle; the rest is empty sky. A meteor you can set your watch
//   by is not a meteor.
//
//   they do not bring their own sky.  This one painted a night gradient over
//   the pane and scattered stars across it, which is a different cosmetic
//   wearing this one's name: it threw away the view the artist painted and
//   replaced it with a flat ramp. In the bathroom, whose lower sash is not
//   cut, that put a midnight pane directly above a sunlit one in the same
//   window. So the sky is whatever the room already shows, and the only thing
//   added is the meteors.
function Meteors({ still, tone }: FxProps & { tone: 'gold' | 'rose' }) {
  const gold = tone === 'gold'
  const head = gold ? '#FFFBEA' : '#FFEAF5'
  const mid = gold ? 'rgba(255,206,107,0.95)' : 'rgba(255,150,205,0.95)'
  const soft = gold ? 'rgba(255,196,84,0.34)' : 'rgba(255,124,196,0.34)'
  const faint = gold ? 'rgba(255,196,84,0)' : 'rgba(255,124,196,0)'
  const seed = gold ? 0 : 91
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => {
        const s = i * 29 + seed
        // The arc of a radiant off the top-left: every streak leans the same
        // way, none of them exactly alike.
        const ang = r2(20 + hash(s) * 22)
        const len = r2(18 + hash(s + 1) * 34)
        const thick = r2(0.28 + hash(s + 2) * 0.3)
        // Short enough that most of the run happens INSIDE the pane. The
        // first cut sent them 1.5-2.3 box-widths, so they spent two thirds of
        // their lit window already off the edge and the sky looked empty.
        // Burning out mid-sky is what they do anyway.
        const run = r2(88 + hash(s + 3) * 62)
        const cycle = r2(3.2 + hash(s + 4) * 5)
        const delay = r2(-hash(s + 7) * cycle)
        const glow = r2(thick * 4.5)
        const halo = r2(glow * 2.1)
        // Reduced motion still has to say "meteor shower". A few of them are
        // frozen mid-flight rather than all of them sitting at the start line
        // with the opacity the keyframes would have given them: zero.
        const frozen = still && i % 4 === 0
        return (
          <span key={i} style={{
            position: 'absolute',
            // Biased up and to the left of the pane: the flight is down and
            // to the right, and the bright half of it has to happen where
            // someone can see it rather than past the far corner.
            left: `${r2(hash(s + 5) * 92 - 46)}%`,
            top: `${r2(hash(s + 6) * 74 - 30)}%`,
            width: `${len}cqi`, height: `${thick}cqi`,
            // The head is the anchor: the tail stretches out behind it.
            transformOrigin: 'right center',
            opacity: frozen ? 0.9 : 0,
            transform: frozen ? `rotate(${ang}deg) translateX(${r2(run * 0.5)}cqi)` : undefined,
            ['--ang' as string]: `${ang}deg`,
            ['--run' as string]: `${run}cqi`,
            animation: still ? undefined
              : `wxMeteor ${cycle}s linear ${delay}s infinite`,
          }}>
            {/* the trail — long, faint at the far end, drawn out behind */}
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '999px',
              transformOrigin: 'right center',
              background: `linear-gradient(90deg, ${faint} 0%, ${soft} 58%, ${mid} 88%, ${head} 100%)`,
              animation: still ? undefined
                : `wxMeteorTail ${cycle}s linear ${delay}s infinite`,
            }} />
            {/* the halo, then the burning point itself */}
            <span style={{
              position: 'absolute', right: `${r2(-halo / 2 + thick / 2)}cqi`, top: '50%',
              width: `${halo}cqi`, height: `${halo}cqi`,
              marginTop: `${r2(-halo / 2)}cqi`,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${mid} 0%, ${faint} 62%)`,
              opacity: 0.5,
            }} />
            <span style={{
              position: 'absolute', right: `${r2(-glow / 2 + thick / 2)}cqi`, top: '50%',
              width: `${glow}cqi`, height: `${glow}cqi`,
              marginTop: `${r2(-glow / 2)}cqi`,
              borderRadius: '50%',
              background: `radial-gradient(circle, #FFFFFF 0%, ${head} 30%, ${mid} 50%, ${faint} 74%)`,
            }} />
          </span>
        )
      })}

      <style>{`
        @keyframes wxMeteor {
          0%   { transform: rotate(var(--ang)) translateX(0); opacity: 0; }
          3%   { opacity: 0.5; }
          11%  { opacity: 1; }
          18%  { opacity: 0.85; }
          22%,
          100% { transform: rotate(var(--ang)) translateX(var(--run)); opacity: 0; }
        }
        @keyframes wxMeteorTail {
          0%        { transform: scaleX(0.18); }
          22%, 100% { transform: scaleX(1); }
        }
      `}</style>
    </>
  )
}

function Aurora({ still, lit }: FxProps) {
  const bands = [
    { hue: 'rgba(99,240,192,0.55)', x: 8, w: 34, dur: 15 },
    { hue: 'rgba(120,180,255,0.45)', x: 30, w: 40, dur: 19 },
    { hue: 'rgba(186,120,255,0.42)', x: 56, w: 36, dur: 23 },
  ]
  return (
    <>
      <Wash background={lit
        ? 'linear-gradient(180deg, #142450 0%, #1E3167 60%, #2A3F78 100%)'
        : 'linear-gradient(180deg, #06102A 0%, #0C1A3C 60%, #142449 100%)'}
        opacity={lit ? 0.9 : 0.96} />
      <Stars n={lit ? 11 : 18} seed={800} still={still} />
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

export default memo(function WeatherFx({ id, still, lit }: {
  id: WeatherId
  still?: boolean
  /** The room around this window is in daylight — see FxProps. */
  lit?: boolean
}) {
  switch (id) {
    case 'clear':        return <Clear still={still} />
    case 'rain':         return <Rain still={still} />
    case 'storm':        return <Storm still={still} />
    case 'snow':         return <Snow still={still} />
    case 'sunrise':      return <Sun still={still} />
    case 'sunset':       return <Sun still={still} dusk />
    case 'petals':       return <Petals still={still} />
    case 'fireflies':    return <Fireflies still={still} lit={lit} />
    case 'meteors_gold': return <Meteors still={still} tone="gold" />
    case 'meteors_rose': return <Meteors still={still} tone="rose" />
    case 'aurora':       return <Aurora still={still} lit={lit} />
    default:             return null
  }
})
