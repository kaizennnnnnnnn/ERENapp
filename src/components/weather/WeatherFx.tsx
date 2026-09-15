'use client'

// ═══════════════════════════════════════════════════════════════════════════
// WEATHER FX — the sky itself. One component per kind.
//
// Every effect draws into a box that is exactly the window's aperture and
// nothing else, so all of them size in CONTAINER units (`cqi` / `cqh`) rather
// than px or vw. On a 400x850 phone these apertures run from the playroom's
// ~74px slot to the living room's ~215px bay, and the machine's picker
// thumbnail is ~46px; a raindrop written in px is a smear in one and invisible
// in the other, while 1cqh is "one hundredth of this window" everywhere.
//
// The floor matters as much as the unit. At 46px, 1cqi is under half a pixel,
// so anything thin — a rain streak, a lightning channel — is written
// `max(<px>, <cqi>)` or the thumbnail shows an empty wash.
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

// ─── A ROOM IS NOT A SWATCH ──────────────────────────────────────────────────
// The same component ships into two places that want opposite things.
//
// In a ROOM there is a PAINTING behind this pane — a treeline, a mountain, a
// moon, a lit lamp on the sill — and the weather's job is to happen in front of
// it. A wash heavy enough to set its own colour is a blind pulled down over the
// artwork: snow turned the living room into a milk-white rectangle with the
// trees gone, and rain flattened the kitchen to one grey. So in a room every
// effect only TINTS, lightly, and the painting keeps its shapes.
//
// On a SWATCH — a picker tile, the machine's own little screen — there is
// nothing behind the pane at all, so the same effect has to paint the sky too,
// or the tile is an empty box (which is exactly what the two meteor tiles were).
// That is `plate`, and it is the whole difference between the two.
//
// Why not a blend mode, which is what this obviously wants: the effect box is
// `container-type: size`, which contains layout and style and therefore opens
// its own stacking context, and the room art is painted OUTSIDE it, far up the
// tree. A `mixBlendMode: multiply` in here has a transparent backdrop to blend
// with and composites as if it were normal. Alpha is the tool that actually
// reaches the painting.

interface FxProps {
  /** Reduced motion: paint the sky, hold everything still. */
  still?: boolean
  /**
   * There is NO painting behind this pane, so paint the sky as well as the
   * weather. See the note above FxProps.
   */
  plate?: boolean
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

function Clear({ still, lit }: FxProps) {
  // `clear` in a room that is always dark is the painted NIGHT, not a blue
  // afternoon. The picker previews the bedroom with this, and a swatch of
  // summer sky over the word CLEAR was the panel telling that window it would
  // get something it cannot have.
  const night = lit === false
  return (
    <>
      <Wash background={night
        ? 'linear-gradient(180deg, #0A1230 0%, #16224A 58%, #2A3563 100%)'
        : 'linear-gradient(180deg, #56A9E8 0%, #8FD3FF 62%, #CDEAFF 100%)'} />
      {night && <Stars n={16} seed={410} still={still} />}
      {!night && [
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
        background: night
          ? 'linear-gradient(180deg, rgba(14,22,44,0) 0%, rgba(14,22,44,0.9) 55%, rgba(10,16,34,0.98) 100%)'
          : 'linear-gradient(180deg, rgba(96,158,86,0) 0%, rgba(88,150,80,0.85) 55%, rgba(64,120,60,0.95) 100%)',
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
//
// Rain is two depths of falling water, splashes on the sill, and water sitting
// on the glass. All of it hangs on one geometric rule: A STREAK IS A
// FULL-HEIGHT COLUMN with a short dash inside it, never a short element moved
// by a percentage.
//
// The first cut wrote an 11–24cqh drop at `top:-24%` and fell it with
// `translate3d(-6%, 150%, 0)`. A percentage inside `translate` resolves
// against the ELEMENT'S OWN box and never against the container, so "150%"
// meant 150% of the drop's own 11–24cqh — 16 to 36cqh of travel, starting
// 24cqh above the sill. Every drop therefore finished between 4cqh and 36cqh
// down the pane and vanished: it rained on the top third of the window and the
// other two thirds were a flat grey rectangle. The -6% of sideways wind was 6%
// of a 0.7cqi width, i.e. nothing, so they fell dead vertical as well.
//
// The fix is structural rather than arithmetical. The column is `height:100%`,
// so `translateY(-110% → 110%)` is 110% OF THE PANE by construction and cannot
// be got wrong again. It is the shape the kiosk's RainLayer already uses.
//
// `rotate()` comes before `translate()` so a drop travels along the axis it
// leans on. The other order slides it sideways relative to its own tilt, which
// is a stick being dragged across the glass, not rain falling.
//
// Thicknesses are `max(<px>, <cqi>)`. The same component renders into a 215px
// living-room window and a 46px picker thumbnail, and a streak written purely
// in cqi is a third of a pixel in the thumbnail — the tile just looked empty.

interface RainPass {
  count: number
  /** Seed offset, so the passes don't line up with each other. */
  seed: number
  /** Degrees off vertical. The path follows it, so this IS the wind. */
  tilt: number
  /** Dash length, as % of the pane's height. */
  len: [number, number]
  /** CSS width. Floored in px so the smallest thumbnail still shows rain. */
  thick: string
  alpha: [number, number]
  /** One fall, top to bottom, in seconds. */
  dur: [number, number]
}

const RAIN_LIGHT: RainPass[] = [
  { count: 34, seed: 0, tilt: 7, len: [5, 10], thick: 'max(0.6px, 0.32cqi)', alpha: [0.3, 0.5], dur: [1.05, 1.5] },
  { count: 15, seed: 400, tilt: 9, len: [10, 17], thick: 'max(1px, 0.58cqi)', alpha: [0.55, 0.85], dur: [0.62, 0.86] },
]
const RAIN_HEAVY: RainPass[] = [
  { count: 46, seed: 0, tilt: 11, len: [7, 14], thick: 'max(0.65px, 0.36cqi)', alpha: [0.36, 0.58], dur: [0.7, 0.98] },
  { count: 20, seed: 400, tilt: 13, len: [13, 24], thick: 'max(1.1px, 0.68cqi)', alpha: [0.6, 0.9], dur: [0.4, 0.58] },
]

const lerp = (r: [number, number], t: number) => r[0] + (r[1] - r[0]) * t

function RainPassLayer({ spec, still }: { spec: RainPass; still: boolean }) {
  return (
    <>
      {Array.from({ length: spec.count }, (_, i) => {
        const s = spec.seed + i * 7
        // Stratified, not random: one streak per lane, jittered inside it.
        // Pure hashing leaves a bald stripe down the middle and a clump in one
        // corner, which reads as a glitch rather than as weather. The lanes
        // overshoot both edges because a leaning column drifts sideways as it
        // falls, and the pane's own overflow takes care of the rest.
        const x = r2(-14 + ((i + 0.15 + hash(s) * 0.7) / spec.count) * 128)
        const len = r2(lerp(spec.len, hash(s + 1)))
        const dur = r2(lerp(spec.dur, hash(s + 2)))
        const a = lerp(spec.alpha, hash(s + 3))
        // A negative delay starts every streak mid-fall, so it is already
        // raining on the first frame instead of a curtain arriving from above.
        const delay = r2(-hash(s + 4) * dur)
        // Held still, the streaks are spread DOWN the pane rather than stacked
        // above it. Reduced motion should look like a wet day; the first cut
        // was an empty grey rectangle, because every drop sat at its start
        // position and its start position was off the top of the window.
        const held = r2(hash(s + 5) * 190 - 95)
        return (
          <span key={i} style={{
            position: 'absolute', top: 0, left: `${x}%`,
            width: spec.thick, height: '100%',
            ['--tilt' as string]: `${spec.tilt}deg`,
            transform: `rotate(${spec.tilt}deg) translate3d(0, ${still ? held : -110}%, 0)`,
            animation: still ? undefined : `wxRainFall ${dur}s linear ${delay}s infinite`,
            willChange: 'transform',
          }}>
            {/* Soft at BOTH ends. A streak with a hard bottom edge reads as a
                tally mark; real rain is a smear that fades out of focus. */}
            <span style={{
              display: 'block', width: '100%', height: `${len}%`,
              borderRadius: '40%',
              background:
                `linear-gradient(180deg, rgba(206,228,255,0) 0%,`
                + ` rgba(206,228,255,${r2(a)}) 40%,`
                + ` rgba(238,248,255,${r2(Math.min(1, a * 1.45))}) 86%,`
                + ` rgba(238,248,255,0) 100%)`,
            }} />
          </span>
        )
      })}
    </>
  )
}

/** Drops breaking on the sill. Without them the rain reaches the bottom of the
 *  window and simply stops existing, which is the other half of why the old
 *  one never read as rain. */
function RainSplashes({ n, still }: { n: number; still: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const s = 1300 + i * 11
        const dur = r2(0.85 + hash(s) * 1.05)
        const w = r2(1.4 + hash(s + 1) * 1.9)
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(hash(s + 2) * 94 + 3)}%`,
            bottom: `${r2(hash(s + 3) * 3)}%`,
            width: `max(2px, ${w}cqi)`, height: `max(0.6px, ${r2(w * 0.24)}cqi)`,
            borderRadius: '50%',
            background: 'rgba(216,234,255,0.55)',
            opacity: still ? 0.4 : 0,
            animation: still ? undefined
              : `wxSplash ${dur}s ease-out ${r2(-hash(s + 4) * dur)}s infinite`,
          }} />
        )
      })}
    </>
  )
}

/** On the glass, not behind it: a few drops crawling down the pane. */
function GlassDrops({ n, still }: { n: number; still: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const s = i * 31 + 3
        const dur = r2(5 + hash(s) * 6)
        const w = r2(1.6 + hash(s + 2) * 1.6)
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(8 + hash(s + 1) * 82)}%`,
            top: still ? `${r2(10 + hash(s + 5) * 74)}%` : '-10%',
            width: `max(2px, ${w}cqi)`,
            // Its own hash, not the width's: one seed for both axes made every
            // bead the same shape at a different scale, which reads as four
            // copies of one sticker rather than water that has run and merged.
            height: `max(3px, ${r2(w * (1.15 + hash(s + 3) * 0.85))}cqi)`,
            borderRadius: '50% 50% 60% 60%',
            background: 'radial-gradient(60% 50% at 38% 32%, rgba(255,255,255,0.7), rgba(190,214,244,0.28) 70%, rgba(190,214,244,0.08))',
            boxShadow: 'inset 0 -0.4cqi 0.4cqi rgba(255,255,255,0.35)',
            opacity: still ? 0.85 : undefined,
            animation: still ? undefined
              : `wxCrawl ${dur}s cubic-bezier(0.5,0,0.9,0.4) ${r2(-hash(s + 4) * dur)}s infinite`,
          }} />
        )
      })}
    </>
  )
}

function Rain({ still, heavy, plate, lit }: FxProps & { heavy?: boolean }) {
  const passes = heavy ? RAIN_HEAVY : RAIN_LIGHT
  return (
    <>
      {/* The overcast a swatch has to supply for itself. */}
      {plate && <Wash background={heavy
        ? (lit === false
          ? 'linear-gradient(180deg, #0B1026 0%, #17203C 56%, #242C4C 100%)'
          : 'linear-gradient(180deg, #171E38 0%, #2A3454 56%, #3D4768 100%)')
        : (lit === false
          ? 'linear-gradient(180deg, #1B2338 0%, #333C55 100%)'
          : 'linear-gradient(180deg, #47536D 0%, #6C7892 100%)')} />}
      {/* What it does to the light in a room. A storm genuinely darkens one —
          a flash needs something to be brighter THAN — so that one is allowed
          to be strong, and at 0.74 it still leaves the treeline and the
          mountain readable through it — a storm was never the complaint. Rain
          was: flat at 0.78 it was not weather over a window but a blind pulled
          down over it, and the kitchen went to a single grey. */}
      <Wash background={heavy
        ? 'linear-gradient(180deg, rgba(20,26,50,0.74) 0%, rgba(38,48,78,0.62) 56%, rgba(56,66,94,0.5) 100%)'
        : 'linear-gradient(180deg, rgba(46,58,90,0.45) 0%, rgba(78,90,118,0.34) 100%)'} />

      {passes.map((p, i) => <RainPassLayer key={i} spec={p} still={!!still} />)}
      <RainSplashes n={heavy ? 10 : 6} still={!!still} />
      <GlassDrops n={heavy ? 6 : 4} still={!!still} />

      <style>{`
        @keyframes wxRainFall {
          from { transform: rotate(var(--tilt, 8deg)) translate3d(0, -110%, 0); }
          to   { transform: rotate(var(--tilt, 8deg)) translate3d(0,  110%, 0); }
        }
        @keyframes wxSplash {
          0%   { opacity: 0;    transform: scale(0.3, 1.2);  }
          16%  { opacity: 0.85; transform: scale(1, 0.6);    }
          100% { opacity: 0;    transform: scale(1.8, 0.28); }
        }
        @keyframes wxCrawl {
          0%   { transform: translateY(0);      opacity: 0; }
          8%   { opacity: 0.9; }
          92%  { opacity: 0.9; }
          100% { transform: translateY(128cqh); opacity: 0; }
        }
      `}</style>
    </>
  )
}

// ─── Thunderstorm ────────────────────────────────────────────────────────────
//
// What used to be here was a hairline and a grey sheet.
//
//   The bolt was a 2.2cqi-wide box with a zigzag clip-path. clip-path
//   percentages resolve against the element's OWN box, so the entire zigzag
//   happened inside 2.2% of the window's width — about one and a half pixels
//   in the kitchen. On screen it was a slightly brighter raindrop.
//
//   The flash was an opaque wash at 0.85 alpha over the whole pane. Painting
//   an opaque sheet over rain hides the rain: the window went flat
//   grey-lavender for a moment, which reads as fog arriving, not as a strike.
//
// The bolt is now a generated channel. The shape matters more than the
// brightness: a hand-written five-segment zigzag of constant width is the
// lightning GLYPH — the thing on a battery icon — and once you have seen it
// you cannot unsee it in a window. Real lightning is a mostly-vertical random
// walk with many small kinks, it TAPERS as it goes down, and it throws off
// short forks that die in the air. So the path is walked from a seed, drawn in
// three sections of decreasing width, and given two forks that stop short of
// the ground.
//
// The glow is a blurred copy of the same channel rather than an SVG filter —
// this codebase has already been bitten once by nested SVG filters resolving
// in the wrong coordinate space (see SketchEren), and a CSS blur on a plain
// element has none of that behaviour.
//
// The whole lit group blends with `screen`, so a flash ADDS light to the rain
// and the sky instead of covering them: the streaks themselves light up inside
// the flash, which is the part that sells it as a strike rather than a lamp.
//
// Two strikes, on two clocks whose periods do not divide each other, in
// different places and with different silhouettes — so no two consecutive
// strikes are the same strike and the storm never ticks like a metronome.

/** A mostly-vertical random walk with a downwind lean, in the 0–100 × 0–200
 *  viewBox. `bias` leans the whole channel; `kink` is how jagged it is. */
function walk(seed: number, x0: number, y0: number, y1: number, steps: number,
  bias: number, kink: number): [number, number][] {
  const pts: [number, number][] = [[r2(x0), r2(y0)]]
  let x = x0
  for (let i = 1; i <= steps; i++) {
    x += bias + (hash(seed + i * 5) - 0.5) * kink
    pts.push([r2(x), r2(y0 + ((y1 - y0) * i) / steps)])
  }
  return pts
}

const d = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ')

interface BoltShape {
  /** The channel, split in three so it can taper on the way down. */
  top: string
  mid: string
  low: string
  /** Short branches that die in the air. */
  forks: string[]
  /** Where the sky lights up, as % across the pane. */
  glow: number
  /** The bolt's box on the pane. */
  box: { left: string; top: string; width: string; height: string }
}

function makeBolt(seed: number, x0: number, bias: number,
  box: BoltShape['box'], glow: number): BoltShape {
  // 15 steps over the full drop: enough kinks to stop reading as a glyph,
  // few enough that it is still one channel and not a scribble.
  const spine = walk(seed, x0, 0, 200, 15, bias, 17)
  const cut = (a: number, b: number) => d(spine.slice(a, b + 1))
  // Forks leave the spine at a joint and die after a third of the drop, which
  // is what makes the main channel read as the one that reached the ground.
  const forks = [
    d(walk(seed + 61, spine[4][0], spine[4][1], spine[4][1] + 62, 4, bias - 3.5, 14)),
    d(walk(seed + 97, spine[9][0], spine[9][1], spine[9][1] + 42, 3, bias + 7, 13)),
  ]
  return { top: cut(0, 5), mid: cut(5, 10), low: cut(10, 15), forks, glow, box }
}

const BOLT_A = makeBolt(7, 62, -2.4,
  { left: '10%', top: '-6%', width: '54%', height: '88%' }, 36)
const BOLT_B = makeBolt(23, 40, 2.2,
  { left: '46%', top: '-8%', width: '48%', height: '72%' }, 72)

function Strike({ shape, anim, cycle, frozen, still }: {
  shape: BoltShape
  anim: string
  cycle: number
  /** Held mid-strike when motion is off, so reduced motion still says storm. */
  frozen: boolean
  still: boolean
}) {
  const { top, mid, low, forks, glow, box } = shape
  // Non-scaling strokes: preserveAspectRatio is `none` so the channel always
  // spans its box whatever the window's aspect, and without non-scaling-stroke
  // that stretch would leave the bolt fat in one axis and a wire in the other.
  // Widths are floored in px because the same bolt renders into a 46px
  // thumbnail, where a pure cqi stroke is a third of a pixel.
  const stroke = (w: string, color: string) => ({
    fill: 'none' as const,
    stroke: color,
    strokeWidth: w,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  })
  // The channel, tapering on the way down, at a given scale. Drawn twice: once
  // blurred underneath for the bloom, once sharp on top for the core.
  const channel = (k: number, color: string) => (
    <>
      <path d={top} {...stroke(`max(${r2(0.9 * k)}px, ${r2(0.42 * k)}cqi)`, color)} />
      <path d={mid} {...stroke(`max(${r2(0.7 * k)}px, ${r2(0.3 * k)}cqi)`, color)} />
      <path d={low} {...stroke(`max(${r2(0.5 * k)}px, ${r2(0.2 * k)}cqi)`, color)} />
      {forks.map((f, i) => (
        <path key={i} d={f} {...stroke(`max(${r2(0.45 * k)}px, ${r2(0.18 * k)}cqi)`, color)} />
      ))}
    </>
  )
  const svg = { position: 'absolute' as const, ...box, overflow: 'visible' as const }
  return (
    <span style={{
      position: 'absolute', inset: 0,
      // The group blends as one, so the sky-lift and the channel both ADD
      // light rather than covering the rain. Keeping the blend and the fade on
      // the same element holds it to one composited layer.
      mixBlendMode: 'screen',
      opacity: still ? (frozen ? 0.5 : 0) : 0,
      animation: still ? undefined : `${anim} ${cycle}s linear infinite`,
      willChange: 'opacity',
    }}>
      {/* The cloud base lighting up. Anchored at the TOP of the pane and wider
          than it, so it falls off towards the sill instead of sitting in the
          middle of the glass as a bright oval with a visible edge. */}
      <span style={{
        position: 'absolute', inset: '-40% -30% auto -30%', height: '150%',
        background:
          `radial-gradient(62% 54% at ${glow}% 26%,`
          + ' rgba(196,218,255,0.62) 0%, rgba(132,164,226,0.26) 34%, rgba(60,82,140,0) 70%)',
      }} />
      {/* bloom: the same channel, fat and blurred, under the core */}
      <svg viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden
        style={{ ...svg, filter: 'blur(max(2px, 1.2cqi))', opacity: 0.95 }}>
        {channel(4.2, 'rgba(158,196,255,0.62)')}
      </svg>
      <svg viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden style={svg}>
        {channel(1.7, 'rgba(206,228,255,0.8)')}
        {channel(1, '#FFFFFF')}
      </svg>
    </span>
  )
}

function Storm({ still, plate, lit }: FxProps) {
  return (
    <>
      <Rain still={still} plate={plate} lit={lit} heavy />
      <Strike shape={BOLT_A} anim="wxStrikeA" cycle={7.3} frozen still={!!still} />
      <Strike shape={BOLT_B} anim="wxStrikeB" cycle={11.9} frozen={false} still={!!still} />
      <style>{`
        /* A real strike: a leader, a peak, a fast decay, then a weaker return
           stroke a few dozen ms later. The flicker is the whole tell — one
           clean fade in and out reads as a lamp being switched on. */
        @keyframes wxStrikeA {
          0%, 4%      { opacity: 0; }
          4.3%        { opacity: 1; }
          5%          { opacity: 0.26; }
          5.5%        { opacity: 0.88; }
          6.9%        { opacity: 0.07; }
          7.6%, 100%  { opacity: 0; }
        }
        @keyframes wxStrikeB {
          0%, 61%     { opacity: 0; }
          61.3%       { opacity: 0.92; }
          61.9%       { opacity: 0.18; }
          62.3%       { opacity: 0.66; }
          63.4%, 100% { opacity: 0; }
        }
      `}</style>
    </>
  )
}

// ─── Snow ────────────────────────────────────────────────────────────────────

function Snow({ still, plate, lit }: FxProps) {
  return (
    <>
      {/* NOTHING over a room. Snow does not paint the world white; it falls
          THROUGH it, and the treeline it falls past is the only reason a white
          dot reads as a flake rather than as dust on the screen. The wash that
          used to be here was pale at half alpha, so every window it landed in
          became a rectangle of milk with the painting behind it gone. A swatch
          has no painting to fall past, so it still gets a winter sky. */}
      {plate && <Wash background={lit === false
        ? 'linear-gradient(180deg, #232C46 0%, #414C6C 100%)'
        : 'linear-gradient(180deg, #7E92B4 0%, #B6C7E1 100%)'} />}
      {Array.from({ length: 22 }, (_, i) => {
        const s = i * 11
        const size = 1.3 + hash(s) * 2.4
        const dur = 5 + hash(s + 1) * 7
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${r2(hash(s + 2) * 100)}%`,
            // Held still, the flakes hang in the air down the whole pane.
            // Parked at the start line they are all above the sash and the
            // reduced-motion snow is a pale blue rectangle with no snow in it.
            top: still ? `${r2(hash(s + 6) * 94)}%` : '-8%',
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

function Sun({ still, dusk, plate }: FxProps & { dusk?: boolean }) {
  const sky = dusk
    ? 'linear-gradient(180deg, #4A2A63 0%, #A8496B 32%, #F0784E 62%, #FFB055 84%, #FFD79A 100%)'
    : 'linear-gradient(180deg, #7EA9D8 0%, #F5B77E 52%, #FFD79A 78%, #FFF0CC 100%)'
  // The same sky in transparent form, for a window that already has a painting
  // in it. The old one sat at 0.92 and simply replaced the view: sunrise turned
  // the living room into a beige haze with the trees dissolved in it. Saturated
  // and around half strength turns the painted afternoon golden instead of
  // erasing it — and the pale top end is gone, because the near-white was what
  // made it read as milk rather than as light.
  const tint = dusk
    ? 'linear-gradient(180deg, rgba(74,42,99,0.64) 0%, rgba(168,73,107,0.62) 32%, rgba(240,120,78,0.6) 62%, rgba(255,176,85,0.52) 100%)'
    : 'linear-gradient(180deg, rgba(74,112,176,0.5) 0%, rgba(228,138,64,0.6) 50%, rgba(255,172,80,0.56) 100%)'
  const disc = dusk ? '#FF8A4C' : '#FFE39A'
  return (
    <>
      {plate && <Wash background={sky} />}
      <Wash background={tint} />
      <span style={{
        position: 'absolute',
        left: dusk ? '58%' : '34%',
        // Anchored in the same unit the disc is sized and travels in. It used
        // to rest at `4%` — a percentage of the pane's HEIGHT — while sinking
        // in cqh and being 26cqi across, so in the narrow windows the sweep
        // carried it clean under the sill and the sunset was a violet gradient
        // with no sun in it.
        bottom: '1cqi',
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
        @keyframes wxRise { from { transform: translateY(15cqi) scale(0.92); } to { transform: translateY(-13cqi) scale(1); } }
        @keyframes wxSink { from { transform: translateY(-13cqi) scale(1); } to { transform: translateY(17cqi) scale(0.94); } }
      `}</style>
    </>
  )
}

// ─── Petals ──────────────────────────────────────────────────────────────────

function Petals({ still, plate, lit }: FxProps) {
  return (
    <>
      {plate && <Wash background={lit === false
        ? 'linear-gradient(180deg, #202A48 0%, #3A3A5E 58%, #4E3A50 100%)'
        : 'linear-gradient(180deg, #8FB8E2 0%, #D8E8F6 58%, #F6E4EC 100%)'} />}
      {/* A blush, not a fog. Pink over a painted afternoon at anything heavier
          than this greys the trees out on its way to looking like spring. */}
      <Wash background="linear-gradient(180deg, rgba(255,214,234,0.2) 0%, rgba(255,242,247,0.1) 100%)" />
      {Array.from({ length: 18 }, (_, i) => {
        const s = i * 17
        const size = 1.6 + hash(s) * 2.2
        const dur = 4.4 + hash(s + 1) * 5
        const pale = hash(s + 6) > 0.55
        return (
          <span key={i} style={{
            position: 'absolute',
            // Held still, both axes have to be moved, not just the vertical:
            // the animated spawn band starts off the LEFT edge too (so petals
            // drift in), and a frozen frame has no delays to cycle them back.
            left: still ? `${r2(4 + hash(s + 2) * 84)}%`
              : `${r2(hash(s + 2) * 100 - 12)}%`,
            top: still ? `${r2(4 + hash(s + 8) * 84)}%`
              : `${r2(-14 + hash(s + 3) * 10)}%`,
            width: `${r2(size)}cqi`, height: `${r2(size * 0.66)}cqi`,
            borderRadius: '68% 32% 68% 32%',
            background: pale ? '#FFD7E6' : '#FFA9C9',
            opacity: r2(0.6 + hash(s + 4) * 0.4),
            ['--drift' as string]: `${r2(38 + hash(s + 5) * 46)}cqi`,
            // wxPetal spins them 680deg on the way down. A frozen petal has to
            // be tilted as well, or the 68%/32% radii read as a row of
            // identically-oriented rounded rectangles.
            transform: still ? `rotate(${r2(hash(s + 9) * 360)}deg)` : undefined,
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

function Fireflies({ still, lit, plate }: FxProps) {
  const dusk = lit
    ? 'linear-gradient(180deg, #3B4A7B 0%, #56608B 46%, #75697F 78%, #937486 100%)'
    : 'linear-gradient(180deg, #23305C 0%, #35406A 46%, #4E4A6B 78%, #6B5670 100%)'
  return (
    <>
      {plate && <Wash background={dusk} />}
      {/* This one has to carry the room from afternoon to dusk, so it is the
          heaviest tint here — but still a tint: the treeline and the mountain
          go blue and stay there rather than disappearing into a flat panel. */}
      <Wash background={dusk} opacity={lit ? 0.64 : 0.72} />
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
            // The flies are already positioned on the pane; what hid them
            // under reduced motion was this. wxFly is what lifts the opacity
            // off zero, so with the animation switched off all sixteen stayed
            // fully transparent and the sky named for them had none in it.
            // Varied, not flat: a uniform value reads as a grid of dots.
            opacity: still ? r2(0.55 + hash(s + 7) * 0.4) : 0,
            ['--fx' as string]: `${r2(hash(s + 4) * 22 - 11)}cqi`,
            ['--fy' as string]: `${r2(hash(s + 5) * 18 - 9)}cqi`,
            animation: still ? undefined
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
function Meteors({ still, tone, plate }: FxProps & { tone: 'gold' | 'rose' }) {
  const gold = tone === 'gold'
  const head = gold ? '#FFFBEA' : '#FFEAF5'
  const mid = gold ? 'rgba(255,206,107,0.95)' : 'rgba(255,150,205,0.95)'
  const soft = gold ? 'rgba(255,196,84,0.34)' : 'rgba(255,124,196,0.34)'
  const faint = gold ? 'rgba(255,196,84,0)' : 'rgba(255,124,196,0)'
  const seed = gold ? 0 : 91
  return (
    <>
      {/* In a ROOM this effect is already the model the others were just made
          to follow: the streaks cross the sky the artist painted and nothing
          else about the window changes. On a SWATCH that left nothing at all —
          the two meteor tiles in the picker were empty boxes with one faint
          scratch in them — so here is the night they need to cross. */}
      {plate && (
        <>
          <Wash background="linear-gradient(180deg, #060C20 0%, #0E1634 58%, #1A2246 100%)" />
          <Stars n={15} seed={gold ? 300 : 420} still={still} />
        </>
      )}
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
            // Spread down the PANE, not stacked above it. A meteor travels
            // `--run` cqi along its own axis, so the vertical part of that
            // flight is run·sin(ang) measured against the pane's WIDTH, while
            // this offset is measured against its HEIGHT. In the playroom
            // (74 wide, 260 tall) the descent is worth a tenth of what it is
            // worth here, so a band starting at -30% never arrived: a third
            // to a half of the shower burned out above the sash and the
            // narrow windows looked like the meteors were broken in them.
            // Starting inside the pane, each one simply streaks across at its
            // own height, which is what a shower looks like anyway.
            top: `${r2(hash(s + 6) * 96 - 14)}%`,
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

function Aurora({ still, lit, plate }: FxProps) {
  const night = lit
    ? 'linear-gradient(180deg, #142450 0%, #1E3167 60%, #2A3F78 100%)'
    : 'linear-gradient(180deg, #06102A 0%, #0C1A3C 60%, #142449 100%)'
  const bands = [
    { hue: 'rgba(99,240,192,0.55)', x: 8, w: 34, dur: 15 },
    { hue: 'rgba(120,180,255,0.45)', x: 30, w: 40, dur: 19 },
    { hue: 'rgba(186,120,255,0.42)', x: 56, w: 36, dur: 23 },
  ]
  return (
    <>
      {plate && <Wash background={night} />}
      {/* Deep, because an aurora is a night sky and the stars below have to
          have somewhere to be — but the painting still shows through it. */}
      <Wash background={night} opacity={lit ? 0.72 : 0.82} />
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

export default memo(function WeatherFx({ id, still, lit, plate }: {
  id: WeatherId
  still?: boolean
  /** The room around this window is in daylight — see FxProps. */
  lit?: boolean
  /** Nothing is painted behind this pane, so paint the sky too — see FxProps. */
  plate?: boolean
}) {
  switch (id) {
    // Clear is the painting itself, so it is a swatch sky and nothing else —
    // RoomWeather never renders it.
    case 'clear':        return <Clear still={still} lit={lit} />
    case 'rain':         return <Rain still={still} plate={plate} lit={lit} />
    case 'storm':        return <Storm still={still} plate={plate} lit={lit} />
    case 'snow':         return <Snow still={still} plate={plate} lit={lit} />
    case 'sunrise':      return <Sun still={still} plate={plate} />
    case 'sunset':       return <Sun still={still} plate={plate} dusk />
    case 'petals':       return <Petals still={still} plate={plate} lit={lit} />
    case 'fireflies':    return <Fireflies still={still} lit={lit} plate={plate} />
    case 'meteors_gold': return <Meteors still={still} tone="gold" plate={plate} />
    case 'meteors_rose': return <Meteors still={still} tone="rose" plate={plate} />
    case 'aurora':       return <Aurora still={still} lit={lit} plate={plate} />
    default:             return null
  }
})
