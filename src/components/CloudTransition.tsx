'use client'

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD TRANSITION — magical route change. Pixel clouds fly in from every
// direction, pile up over the screen, the router swaps the page underneath,
// and the clouds part to reveal the destination.
//
// Lives once in the (app) layout so it survives the navigation. Trigger it
// from anywhere with requestCloudNav('/bakery') — while a transition is
// running the overlay swallows pointer events and ignores repeat requests.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { playSound } from '@/lib/sounds'

const EVENT = 'eren:cloud-nav'

export function requestCloudNav(href: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { href } }))
}

// Converge duration covers the longest cloud delay + flight. The hold phase
// then lasts until the destination route is mounted (+ a beat for its first
// paint), with a hard fallback so a slow chunk can never strand the clouds.
const IN_MS = 800
const HOLD_AFTER_ARRIVE_MS = 380
const HOLD_MAX_MS = 2200
const OUT_MS = 700

// Deterministic per-cloud layout — a tiny seeded PRNG instead of
// Math.random() so every entry to the shop plays the same hand-tuned shot.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

interface CloudDef {
  /** CSS width — vmin so phones and tablets scale the same composition. */
  w: string
  /** translate() endpoints, fed to the keyframes via CSS vars. */
  fx: string; fy: string; tx: string; ty: string
  delayIn: number; durIn: number
  delayOut: number; durOut: number
  /** body / underside tints — back clouds are duskier for depth */
  body: string; shade: string
  z: number
}

const CLOUDS: CloudDef[] = (() => {
  const rand = rng(20260611)
  const defs: CloudDef[] = []
  // Three rings: big front puffs piling on the center, a mid ring, and an
  // outer ring parked near the edges — together a wall of clouds over the
  // whole screen, not a lump in the middle. X spreads in vw and Y in vh so
  // tall phone screens fill top to bottom.
  const RINGS = [
    { n: 5, r0: 2,  r1: 13, w0: 64, w1: 86, body: '#FFFFFF', shade: '#D9D3EC', z: 3 },
    { n: 6, r0: 17, r1: 30, w0: 46, w1: 62, body: '#F7F4FD', shade: '#CFC6E8', z: 2 },
    { n: 6, r0: 33, r1: 46, w0: 38, w1: 52, body: '#EDE7F8', shade: '#C3B8DF', z: 1 },
  ]
  RINGS.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const angle = (i / ring.n) * Math.PI * 2 + ri * 0.9 + (rand() - 0.5) * 0.55
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const endR = ring.r0 + rand() * (ring.r1 - ring.r0)
      const w = ring.w0 + rand() * (ring.w1 - ring.w0)
      defs.push({
        w: `${w.toFixed(1)}vmin`,
        fx: `${(cos * 115).toFixed(1)}vw`,
        fy: `${(sin * 115).toFixed(1)}vh`,
        tx: `${(cos * endR).toFixed(1)}vw`,
        ty: `${(sin * endR).toFixed(1)}vh`,
        delayIn: Math.round(rand() * 200),
        durIn: Math.round(480 + rand() * 120),
        delayOut: Math.round(rand() * 120),
        durOut: Math.round(480 + rand() * 140),
        body: ring.body,
        shade: ring.shade,
        z: ring.z,
      })
    }
  })
  return defs
})()

// Little gold/pink pixel stars that twinkle while the screen is covered.
const SPARKLES = (() => {
  const rand = rng(424242)
  return Array.from({ length: 12 }, (_, i) => ({
    x: `${((rand() - 0.5) * 76).toFixed(1)}vw`,
    y: `${((rand() - 0.5) * 70).toFixed(1)}vh`,
    size: rand() > 0.5 ? 7 : 5,
    color: i % 3 === 0 ? '#F9A8D4' : '#FFD700',
    delay: Math.round(rand() * 600),
  }))
})()

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
      const href = (e as CustomEvent<{ href: string }>).detail?.href
      if (!href || targetRef.current) return // already mid-flight
      const run = {}
      runRef.current = run
      targetRef.current = href
      setPhase('in')
      playSound('gift_open')
      later(() => {
        if (runRef.current !== run) return
        router.push(href)
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

  const converging = phase === 'in' || phase === 'hold'

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
        @keyframes ctFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ctFadeOut { from { opacity: 1; } to { opacity: 0; } }
        /* Snap twinkle — steps(), not a cross-fade, per the house style. */
        @keyframes ctTwinkle {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.25; transform: scale(0.6); }
        }
      `}</style>

      {/* Backdrop — fills any sliver between cloud sprites once they land,
          and is what visibly "opens" on reveal. */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 50% 42%, #FFF9F0 0%, #F3EBFD 55%, #DCD2F2 100%)',
        animation: converging
          ? `ctFadeIn 300ms ease-out ${IN_MS - 320}ms both`
          : 'ctFadeOut 300ms ease-in both',
      }} />

      {/* Clouds */}
      {CLOUDS.map((c, i) => (
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
          animation: converging
            ? `ctCloudIn ${c.durIn}ms cubic-bezier(0.16, 0.84, 0.28, 1) ${c.delayIn}ms both`
            : `ctCloudOut ${c.durOut}ms cubic-bezier(0.55, 0.04, 0.85, 0.4) ${c.delayOut}ms both`,
          filter: 'drop-shadow(0 4px 0 rgba(120,100,170,0.18))',
        } as React.CSSProperties}>
          <PixelCloud body={c.body} shade={c.shade} />
        </div>
      ))}

      {/* Sparkles — only once the pile-up is (nearly) complete */}
      <div className="absolute inset-0" style={{
        zIndex: 3,
        animation: converging
          ? `ctFadeIn 200ms ease-out ${IN_MS - 150}ms both`
          : 'ctFadeOut 200ms ease-in both',
      }}>
        {SPARKLES.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${s.x})`,
            top: `calc(50% + ${s.y})`,
            width: s.size, height: s.size,
            background: s.color,
            boxShadow: `0 0 6px ${s.color}`,
            animation: `ctTwinkle 0.6s steps(2) ${s.delay}ms infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}
