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

// Converge duration covers the longest cloud delay + flight. The hold phase
// then lasts until the destination route is mounted (+ a beat for its first
// paint), with a hard fallback so a slow chunk can never strand the clouds.
const IN_MS = 800
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
  /** translate() endpoints + swirl midpoint, fed to keyframes via CSS vars. */
  fx: string; fy: string; tx: string; ty: string; mx: string; my: string
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
  // Four rings: big front puffs piling on the center, mid and outer rings,
  // and a far ring of small fillers hugging the very edges — together a
  // wall of clouds over the whole screen, not a lump in the middle. X
  // spreads in vw and Y in vh so tall phone screens fill top to bottom.
  const RINGS = [
    { n: 6, r0: 2,  r1: 13, w0: 64, w1: 86, z: 3 },
    { n: 8, r0: 16, r1: 29, w0: 46, w1: 62, z: 2 },
    { n: 8, r0: 32, r1: 45, w0: 38, w1: 52, z: 1 },
    { n: 6, r0: 47, r1: 58, w0: 26, w1: 36, z: 1 },
  ]
  let idx = 0
  RINGS.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const angle = (i / ring.n) * Math.PI * 2 + ri * 0.9 + (rand() - 0.5) * 0.55
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const endR = ring.r0 + rand() * (ring.r1 - ring.r0)
      const w = ring.w0 + rand() * (ring.w1 - ring.w0)
      // Swirl midpoint: 45% of the way in, swung sideways off the straight
      // line — alternating direction so the rainbow flight reads as a vortex.
      const dir = idx % 2 === 0 ? 1 : -1
      const midR = endR + (115 - endR) * 0.45
      const midA = angle + 0.55 * dir
      defs.push({
        w: `${w.toFixed(1)}vmin`,
        fx: `${(cos * 115).toFixed(1)}vw`,
        fy: `${(sin * 115).toFixed(1)}vh`,
        tx: `${(cos * endR).toFixed(1)}vw`,
        ty: `${(sin * endR).toFixed(1)}vh`,
        mx: `${(Math.cos(midA) * midR).toFixed(1)}vw`,
        my: `${(Math.sin(midA) * midR).toFixed(1)}vh`,
        rot: `${((6 + rand() * 10) * dir).toFixed(1)}deg`,
        delayIn: Math.round(rand() * 200),
        durIn: Math.round(480 + rand() * 120),
        delayOut: Math.round(rand() * 120),
        durOut: Math.round(480 + rand() * 140),
        ring: ri,
        z: ring.z,
      })
      idx++
    }
  })
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
  },
  rainbow: {
    cloud: (_c, i) => RAINBOW[i % RAINBOW.length],
    backdrop: 'linear-gradient(150deg, #FFDCDC 0%, #FFEBCC 18%, #FFF9CC 36%, #DCF5DF 54%, #D2EAFF 72%, #DFDAFF 88%, #F6DCFF 100%)',
    sparkleColors: ['#FF6B6B', '#FFA94D', '#FFE066', '#69DB7C', '#4DABF7', '#9775FA', '#F783AC'],
    sparkleCount: 16,
    swirl: true,
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
      runRef.current = run
      targetRef.current = detail.href
      setTheme(detail.theme ?? 'pink')
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
      }, IN_MS)
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
  const inName = t.swirl ? 'ctCloudInArc' : 'ctCloudIn'
  const outName = t.swirl ? 'ctCloudOutArc' : 'ctCloudOut'

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
        /* Swirl flight: curved path through a sideways midpoint, entry tilt
           that levels off, and a puffy overshoot before settling. */
        @keyframes ctCloudInArc {
          from { transform: translate(var(--fx), var(--fy)) rotate(var(--rot)) scale(0.9); }
          55%  { transform: translate(var(--mx), var(--my)) rotate(calc(var(--rot) / -2)) scale(1.1); }
          to   { transform: translate(var(--tx), var(--ty)) rotate(0deg) scale(1); }
        }
        @keyframes ctCloudOutArc {
          from { transform: translate(var(--tx), var(--ty)) rotate(0deg) scale(1); }
          45%  { transform: translate(var(--mx), var(--my)) rotate(calc(var(--rot) / 2)) scale(1.08); }
          to   { transform: translate(var(--fx), var(--fy)) rotate(var(--rot)) scale(0.9); }
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
          ? `ctFadeIn 300ms ease-out ${IN_MS - 320}ms both`
          : 'ctFadeOut 300ms ease-in both',
      }} />

      {/* Clouds */}
      {CLOUDS.map((c, i) => {
        const tone = t.cloud(c, i)
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
            ['--mx' as string]: c.mx,
            ['--my' as string]: c.my,
            ['--rot' as string]: c.rot,
            animation: converging
              ? `${inName} ${c.durIn}ms cubic-bezier(0.16, 0.84, 0.28, 1) ${c.delayIn}ms both`
              : `${outName} ${c.durOut}ms cubic-bezier(0.55, 0.04, 0.85, 0.4) ${c.delayOut}ms both`,
            filter: 'drop-shadow(0 4px 0 rgba(120,100,170,0.18))',
          } as React.CSSProperties}>
            <div style={t.swirl ? {
              width: '100%', height: '100%',
              animation: `ctBob ${1800 + (i % 5) * 220}ms ease-in-out ${-(i * 137) % 1800}ms infinite alternate`,
            } : { width: '100%', height: '100%' }}>
              <PixelCloud body={tone.body} shade={tone.shade} />
            </div>
          </div>
        )
      })}

      {/* Sparkles — only once the pile-up is (nearly) complete */}
      <div className="absolute inset-0" style={{
        zIndex: 3,
        animation: converging
          ? `ctFadeIn 200ms ease-out ${IN_MS - 150}ms both`
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
