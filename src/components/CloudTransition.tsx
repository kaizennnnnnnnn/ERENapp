'use client'

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD TRANSITION — magical route change. Pixel clouds fly in from every
// direction, pile up over the screen, the router swaps the page underneath,
// and the clouds part to reveal the destination.
//
// Lives once in the (app) layout so it survives the navigation. Trigger it
// from anywhere with requestCloudNav('/bakery') — while a transition is
// running the overlay swallows pointer events and ignores repeat requests.
//
// Themes: 'pink' (cake shop — soft pink puffs, straight flight) and
// 'rainbow' (gacha — every cloud a different rainbow hue, swirling curved
// flight with a puffy scale-pop, gentle bobbing while covered, and a denser
// multicolor sparkle field).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { playSound } from '@/lib/sounds'

const EVENT = 'eren:cloud-nav'

export type CloudTheme = 'pink' | 'rainbow'

export function requestCloudNav(href: string, theme: CloudTheme = 'pink') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { href, theme } }))
}

// Converge duration covers the longest cloud delay + flight at speed 1.
// Each theme stretches it by its own `speed` (see THEMES) so the gacha
// drift can read slower than the cake one without retuning every cloud.
// The hold phase then lasts until the destination route is mounted (+ a
// beat for first paint), with a hard fallback so a slow chunk can never
// strand the clouds.
const BASE_IN_MS = 800
const inMsFor = (theme: CloudTheme) => Math.round(BASE_IN_MS * THEMES[theme].speed)
const HOLD_AFTER_ARRIVE_MS = 380
const HOLD_MAX_MS = 2200
const OUT_MS = 700

// Deterministic per-cloud layout — a tiny seeded PRNG instead of
// Math.random() so every entry plays the same hand-tuned shot.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

interface CloudDef {
  /** CSS width — vmin so phones and tablets scale the same composition. */
  w: string
  /** translate() endpoints + sideways swirl offset, fed via CSS vars. */
  fx: string; fy: string; tx: string; ty: string; sx: string; sy: string
  /** entry rotation for the swirl flight */
  rot: string
  delayIn: number; durIn: number
  delayOut: number; durOut: number
  ring: number
  z: number
}

const CLOUDS: CloudDef[] = (() => {
  const rand = rng(20260611)
  const defs: CloudDef[] = []
  let idx = 0

  const push = (
    fxv: number, fyv: number, txv: number, tyv: number,
    sxv: number, syv: number, w: number, ring: number, z: number,
  ) => {
    const dir = idx % 2 === 0 ? 1 : -1
    defs.push({
      w: `${w.toFixed(1)}vmin`,
      fx: `${fxv.toFixed(1)}vw`, fy: `${fyv.toFixed(1)}vh`,
      tx: `${txv.toFixed(1)}vw`, ty: `${tyv.toFixed(1)}vh`,
      sx: `${(sxv * dir).toFixed(1)}vw`, sy: `${(syv * dir).toFixed(1)}vh`,
      rot: `${((6 + rand() * 10) * dir).toFixed(1)}deg`,
      delayIn: Math.round(rand() * 200),
      durIn: Math.round(480 + rand() * 120),
      delayOut: Math.round(rand() * 120),
      durOut: Math.round(480 + rand() * 140),
      ring, z,
    })
    idx++
  }

  // Rings: a small center blanket of big front puffs, then progressively
  // denser mid/outer rings pushed further out. Trimming the center and
  // packing more clouds into the outer rings spreads the pile across the
  // whole screen instead of lumping in the middle — the outer counts climb
  // (4 → 9 → 11 → 10) so a tall phone's top/bottom thirds fill in too.
  // X spreads in vw and Y in vh.
  const RINGS = [
    { n: 4,  r0: 2,  r1: 11, w0: 60, w1: 80, z: 3 },
    { n: 9,  r0: 15, r1: 30, w0: 44, w1: 60, z: 2 },
    { n: 11, r0: 33, r1: 49, w0: 38, w1: 52, z: 1 },
    { n: 10, r0: 51, r1: 66, w0: 28, w1: 42, z: 1 },
  ]
  RINGS.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const angle = (i / ring.n) * Math.PI * 2 + ri * 0.9 + (rand() - 0.5) * 0.55
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const endR = ring.r0 + rand() * (ring.r1 - ring.r0)
      const w = ring.w0 + rand() * (ring.w1 - ring.w0)
      // Swirl swing: at 55% of the flight the cloud sits at the same radius
      // as the straight-line path, swung 0.55 rad sideways — alternating
      // direction so the rainbow flight reads as a vortex. Emitted as a
      // pure offset from the straight line (sx/sy) so the swing can live
      // on its own nested layer with its own easing; baking it into the
      // flight keyframes made the easing restart mid-air and stutter.
      const dir = idx % 2 === 0 ? 1 : -1
      const midR = endR + (115 - endR) * 0.45
      const midA = angle + 0.55 * dir
      push(
        cos * 115, sin * 115, cos * endR, sin * endR,
        (Math.cos(midA) - cos) * midR / dir, (Math.sin(midA) - sin) * midR / dir,
        w, ri, ring.z,
      )
    }
  })

  // Corner fillers — a radial cloud at 45° and radius R only reaches ~0.7R
  // on each axis, so on a tall phone the four diagonal corners stay light
  // while the middle piles up. Plant a big puff aimed straight at each
  // corner, flying in from just past it, so coverage reaches edge-to-edge.
  const CORNERS = [
    { x: -39, y: -46 }, { x: 39, y: -46 },
    { x: -39, y:  46 }, { x: 39, y:  46 },
  ]
  for (const cn of CORNERS) {
    const w = 50 + rand() * 16
    const ang = Math.atan2(cn.y, cn.x)
    const sw = 12 + rand() * 6                 // tangential swirl swing
    push(
      cn.x * 2.6, cn.y * 2.2, cn.x, cn.y,
      -Math.sin(ang) * sw, Math.cos(ang) * sw,
      w, 3, 1,
    )
  }

  return defs
})()

const SPARKLES = (() => {
  const rand = rng(424242)
  return Array.from({ length: 16 }, () => ({
    x: `${((rand() - 0.5) * 76).toFixed(1)}vw`,
    y: `${((rand() - 0.5) * 70).toFixed(1)}vh`,
    size: rand() > 0.5 ? 7 : 5,
    delay: Math.round(rand() * 600),
    bobDelay: Math.round(rand() * 1200),
  }))
})()

interface ThemeDef {
  /** body/shade per cloud — pink shades by depth ring, rainbow by index */
  cloud: (c: CloudDef, i: number) => { body: string; shade: string }
  backdrop: string
  sparkleColors: string[]
  sparkleCount: number
  /** swirl = curved flight + rotation + scale pop + bobbing while covered */
  swirl: boolean
  /** flight-time multiplier — 1 = base, >1 drifts in slower. Scales every
   *  cloud's delay + duration and the converge window together. */
  speed: number
}

const PINK_RINGS = [
  { body: '#FFE9F4', shade: '#F2BEDD' },
  { body: '#FCD9EC', shade: '#E8A9CD' },
  { body: '#F6C6E1', shade: '#D898C0' },
  { body: '#F1B9D8', shade: '#D18CB6' },
]

const RAINBOW: Array<{ body: string; shade: string }> = [
  { body: '#FF9B9B', shade: '#D96B6B' }, // red
  { body: '#FFC38F', shade: '#DD9255' }, // orange
  { body: '#FFE48A', shade: '#D9B952' }, // yellow
  { body: '#9FE8A4', shade: '#67BE74' }, // green
  { body: '#93D2FF', shade: '#5BA0DB' }, // blue
  { body: '#AC9EFF', shade: '#7D6CD9' }, // indigo
  { body: '#E5A4FF', shade: '#B470D9' }, // violet
]

const THEMES: Record<CloudTheme, ThemeDef> = {
  pink: {
    cloud: c => PINK_RINGS[c.ring],
    backdrop: 'radial-gradient(circle at 50% 42%, #FFF7FB 0%, #FCE4F1 55%, #F3C9E2 100%)',
    sparkleColors: ['#FFD700', '#FF9DCF', '#FFFFFF'],
    sparkleCount: 12,
    swirl: false,
    speed: 1,
  },
  rainbow: {
    cloud: (_c, i) => RAINBOW[i % RAINBOW.length],
    backdrop: 'linear-gradient(150deg, #FFDCDC 0%, #FFEBCC 18%, #FFF9CC 36%, #DCF5DF 54%, #D2EAFF 72%, #DFDAFF 88%, #F6DCFF 100%)',
    sparkleColors: ['#FF6B6B', '#FFA94D', '#FFE066', '#69DB7C', '#4DABF7', '#9775FA', '#F783AC'],
    sparkleCount: 16,
    swirl: true,
    // Gacha clouds drift in ~35% slower so the rainbow vortex reads as a
    // gentle gather rather than a quick snap.
    speed: 1.35,
  },
}

// The flappy-eren cloud silhouette, promoted to a multi-tone shop cloud.
function PixelCloud({ body, shade }: { body: string; shade: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 48 22" shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' }}>
      <rect x="10" y="3"  width="10" height="3"  fill={body} />
      <rect x="22" y="2"  width="14" height="4"  fill={body} />
      <rect x="6"  y="6"  width="36" height="10" fill={body} />
      <rect x="4"  y="10" width="40" height="6"  fill={body} />
      <rect x="2"  y="12" width="44" height="4"  fill={body} />
      <rect x="6"  y="16" width="36" height="2"  fill={shade} />
      <rect x="10" y="18" width="28" height="2"  fill={shade} />
    </svg>
  )
}

type Phase = 'idle' | 'in' | 'hold' | 'out'

export default function CloudTransition() {
  const router = useRouter()
  const pathname = usePathname()
  const [phase, setPhase] = useState<Phase>('idle')
  const [theme, setTheme] = useState<CloudTheme>('pink')
  const targetRef = useRef<string | null>(null)
  // Token identifying the current transition — stale timers (e.g. the slow
  // fallback from a finished run) bail instead of clobbering a new flight.
  const runRef = useRef<object | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms))
  }

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  // Trigger: start converging, push the route once the screen is covered.
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ href: string; theme?: CloudTheme }>).detail
      if (!detail?.href || targetRef.current) return // already mid-flight
      const run = {}
      const nav = detail.theme ?? 'pink'
      runRef.current = run
      targetRef.current = detail.href
      setTheme(nav)
      setPhase('in')
      playSound('gift_open')
      later(() => {
        if (runRef.current !== run) return
        router.push(detail.href)
        setPhase('hold')
        // Fallback: if the destination chunk crawls, part the clouds anyway.
        later(() => {
          if (runRef.current !== run || !targetRef.current) return
          targetRef.current = null
          setPhase('out')
          later(() => { if (runRef.current === run) setPhase('idle') }, OUT_MS)
        }, HOLD_MAX_MS)
      }, inMsFor(nav))
    }
    window.addEventListener(EVENT, onNav)
    return () => window.removeEventListener(EVENT, onNav)
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal: once the destination route is actually mounted, give it a beat
  // to paint, then open the clouds.
  useEffect(() => {
    if (phase !== 'hold' || pathname !== targetRef.current) return
    const run = runRef.current
    later(() => {
      if (runRef.current !== run || !targetRef.current) return // superseded
      targetRef.current = null
      setPhase('out')
      later(() => { if (runRef.current === run) setPhase('idle') }, OUT_MS)
    }, HOLD_AFTER_ARRIVE_MS)
  }, [phase, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'idle') return null

  const t = THEMES[theme]
  const converging = phase === 'in' || phase === 'hold'
  const inMs = inMsFor(theme)

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 100 }}>
      <style>{`
        @keyframes ctCloudIn {
          from { transform: translate(var(--fx), var(--fy)); }
          to   { transform: translate(var(--tx), var(--ty)); }
        }
        @keyframes ctCloudOut {
          from { transform: translate(var(--tx), var(--ty)); }
          to   { transform: translate(var(--fx), var(--fy)); }
        }
        /* Swirl swing — layered ON TOP of the straight ctCloudIn/Out flight
           (separate nested element). The main flight keeps one continuous
           deceleration while this adds the sideways arc, entry tilt and
           puffy scale. Symmetric ease-in-out segments peak at the swing's
           turning point, so velocity is naturally zero there — no mid-air
           hitch like the old single-animation arc had. */
        @keyframes ctSwirlIn {
          from { transform: translate(0, 0) rotate(var(--rot)) scale(0.92);
                 animation-timing-function: ease-in-out; }
          55%  { transform: translate(var(--sx), var(--sy)) rotate(calc(var(--rot) * 0.3)) scale(1.07);
                 animation-timing-function: ease-in-out; }
          to   { transform: translate(0, 0) rotate(0deg) scale(1); }
        }
        @keyframes ctSwirlOut {
          from { transform: translate(0, 0) rotate(0deg) scale(1);
                 animation-timing-function: ease-in-out; }
          45%  { transform: translate(var(--sx), var(--sy)) rotate(calc(var(--rot) * 0.3)) scale(1.06);
                 animation-timing-function: ease-in-out; }
          to   { transform: translate(0, 0) rotate(var(--rot)) scale(0.92); }
        }
        @keyframes ctFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ctFadeOut { from { opacity: 1; } to { opacity: 0; } }
        /* Snap twinkle — steps(), not a cross-fade, per the house style. */
        @keyframes ctTwinkle {
          0%, 100% { opacity: 1;    transform: scale(1); }
          50%      { opacity: 0.25; transform: scale(0.6); }
        }
        /* Gentle float for the rainbow pile-up — on the inner sprite so it
           never fights the flight transform on the outer element. */
        @keyframes ctBob {
          from { transform: translateY(-1.2%); }
          to   { transform: translateY(1.2%); }
        }
      `}</style>

      {/* Backdrop — fills any sliver between cloud sprites once they land,
          and is what visibly "opens" on reveal. */}
      <div className="absolute inset-0" style={{
        background: t.backdrop,
        animation: converging
          ? `ctFadeIn 300ms ease-out ${inMs - 320}ms both`
          : 'ctFadeOut 300ms ease-in both',
      }} />

      {/* Clouds */}
      {CLOUDS.map((c, i) => {
        const tone = t.cloud(c, i)
        // Stretch the inbound flight by the theme speed (the swing layer
        // below must use the same scaled values so the two stay locked).
        const durIn = Math.round(c.durIn * t.speed)
        const delayIn = Math.round(c.delayIn * t.speed)
        return (
          <div key={i} style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: c.w,
            aspectRatio: '48 / 22',
            marginLeft: `calc(${c.w} / -2)`,
            marginTop: `calc(${c.w} * 22 / 48 / -2)`,
            zIndex: c.z,
            ['--fx' as string]: c.fx,
            ['--fy' as string]: c.fy,
            ['--tx' as string]: c.tx,
            ['--ty' as string]: c.ty,
            ['--sx' as string]: c.sx,
            ['--sy' as string]: c.sy,
            ['--rot' as string]: c.rot,
            animation: converging
              ? `ctCloudIn ${durIn}ms cubic-bezier(0.16, 0.84, 0.28, 1) ${delayIn}ms both`
              : `ctCloudOut ${c.durOut}ms cubic-bezier(0.55, 0.04, 0.85, 0.4) ${c.delayOut}ms both`,
            filter: 'drop-shadow(0 4px 0 rgba(120,100,170,0.18))',
          } as React.CSSProperties}>
            {/* Swirl layer — same duration/delay as the flight so the swing
                spans the whole trip, but eased independently. */}
            <div style={t.swirl ? {
              width: '100%', height: '100%',
              animation: converging
                ? `ctSwirlIn ${durIn}ms ${delayIn}ms both`
                : `ctSwirlOut ${c.durOut}ms ${c.delayOut}ms both`,
            } : { width: '100%', height: '100%' }}>
              <div style={t.swirl ? {
                width: '100%', height: '100%',
                animation: `ctBob ${1800 + (i % 5) * 220}ms ease-in-out ${-(i * 137) % 1800}ms infinite alternate`,
              } : { width: '100%', height: '100%' }}>
                <PixelCloud body={tone.body} shade={tone.shade} />
              </div>
            </div>
          </div>
        )
      })}

      {/* Sparkles — only once the pile-up is (nearly) complete */}
      <div className="absolute inset-0" style={{
        zIndex: 3,
        animation: converging
          ? `ctFadeIn 200ms ease-out ${inMs - 150}ms both`
          : 'ctFadeOut 200ms ease-in both',
      }}>
        {SPARKLES.slice(0, t.sparkleCount).map((s, i) => {
          const color = t.sparkleColors[i % t.sparkleColors.length]
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `calc(50% + ${s.x})`,
              top: `calc(50% + ${s.y})`,
              width: s.size, height: s.size,
              background: color,
              boxShadow: `0 0 6px ${color}`,
              animation: `ctTwinkle 0.6s steps(2) ${s.delay}ms infinite`,
            }} />
          )
        })}
      </div>
    </div>
  )
}
