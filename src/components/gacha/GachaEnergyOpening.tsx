'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GachaRarity } from '@/types'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// ─── GachaEnergyOpening ───────────────────────────────────────────────────────
// FoodSuits (3rd machine) opening cinematic. Rebuilt on a SINGLE <canvas> so the
// whole effect is ONE compositor layer. The previous version stacked 30+ blended
// DOM layers — a spinning conic-gradient vortex with mix-blend-mode:screen,
// box-shadow-blur rings scaling to 12×, filter:blur() smoke, and full-screen
// filter:brightness transitions on a cover image — which re-rasterize every frame
// and janked hard on mid-range phones. Canvas draws only cheap primitives (radial
// gradients, stroked arcs, filled dots) with `lighter` compositing at a capped
// DPR, so it holds 60fps on mobile while STILL tinting the burst by the pulled
// rarity — the reason this machine uses a drawn cinematic instead of a video.
//
// Contract is unchanged for the caller: `rarity` is null while the roll resolves,
// so the canvas idles on a charging "shine" until it arrives, then runs
// charge → burst → fade → onDone. Tap anywhere skips. Respects reduced motion.

type Phase = 'shine' | 'charge' | 'burst' | 'fade'

interface Pal { core: string; glow: string } // core = hot centre; glow = "r,g,b" for rgba()
const PALS: Record<GachaRarity, Pal> = {
  common:    { core: '#ffffff', glow: '170,182,198' },
  rare:      { core: '#eaf5ff', glow: '46,139,255' },
  epic:      { core: '#f3e3ff', glow: '166,77,255' },
  legendary: { core: '#fff6d8', glow: '255,186,31' },
}
// Neutral gold-white while the rarity is still unknown (the shine phase).
const SHINE_PAL: Pal = { core: '#fff8e8', glow: '255,228,150' }

const MIN_SHINE = 760, CHARGE_MS = 740, BURST_MS = 540, FADE_MS = 520
const TAU = Math.PI * 2

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeIn = (t: number) => t * t * t
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

// Particle definitions are generated once and animated analytically by phase
// progress (no per-frame physics state) — same stateless approach as the old CSS,
// but drawn on the canvas.
interface Particle { a: number; d: number; delay: number; size: number }
function makeParticles(n: number, dMin: number, dSpan: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    a: (i / n) * TAU + Math.random() * 0.7,
    d: dMin + Math.random() * dSpan,
    delay: Math.random() * 0.18,
    size: 1.6 + Math.random() * 2.6,
  }))
}

interface Props {
  /** Highest rarity in the batch. null while the roll is still resolving. */
  rarity: GachaRarity | null
  onDone: () => void
  machineSrc?: string
}

export default function GachaEnergyOpening({
  rarity, onDone, machineSrc = '/gacha_foodsuits.png?v=2',
}: Props) {
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('shine')

  const mountRef = useRef(0)
  const phaseStartRef = useRef(0)  // start of the current phase (ms)
  const burstStartRef = useRef(0)  // start of burst — spray/rings span burst+fade
  const startedRef = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const phaseRef = useRef<Phase>('shine')
  phaseRef.current = phase

  const converge = useMemo(() => makeParticles(24, 90, 200), [])
  const spray = useMemo(() => makeParticles(30, 70, 240), [])

  useEffect(() => {
    mountRef.current = performance.now()
    phaseStartRef.current = performance.now()
  }, [])

  // Phase machine — identical timing / sound / onDone contract to the old build.
  // The shine holds until the roll resolves (masking latency), then it advances.
  useEffect(() => {
    if (rarity == null || startedRef.current) return
    startedRef.current = true
    const enter = (p: Phase) => { phaseStartRef.current = performance.now(); setPhase(p) }
    const elapsed = performance.now() - mountRef.current
    const shineWait = Math.max(0, MIN_SHINE - elapsed)
    const timers: number[] = []
    timers.push(window.setTimeout(() => {
      playSound('gift_open'); enter('charge')
      timers.push(window.setTimeout(() => {
        burstStartRef.current = performance.now(); enter('burst'); playSound(`gacha_reveal_${rarity}`)
      }, CHARGE_MS))
      timers.push(window.setTimeout(() => enter('fade'), CHARGE_MS + BURST_MS))
      timers.push(window.setTimeout(() => doneRef.current(), CHARGE_MS + BURST_MS + FADE_MS))
    }, shineWait))
    return () => timers.forEach(clearTimeout)
  }, [rarity])

  // Canvas render loop — one layer, cheap primitives, DPR capped at 2 (retina
  // phones are 3× and the glow-heavy fill doesn't need it — halving fill cost).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0, W = 0, H = 0, dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    // Radial glow disc — the one primitive everything is built from.
    const glow = (x: number, y: number, r: number, inner: string, outer: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, inner)
      g.addColorStop(1, outer)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
    }

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const now = performance.now()
      const ph = phaseRef.current
      const pal = rarity ? PALS[rarity] : SHINE_PAL
      const cx = W / 2, cy = H * 0.46
      const u = Math.min(W, H) / 430 // scale unit so the focal effects track phone size

      // Screen shake folds into the base transform (burst only, decaying).
      let sx = 0, sy = 0
      if (!reduced && ph === 'burst') {
        const amp = 5 * (1 - clamp01((now - burstStartRef.current) / BURST_MS)) * u
        sx = (Math.random() * 2 - 1) * amp; sy = (Math.random() * 2 - 1) * amp
      }
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr)
      ctx.clearRect(-12, -12, W + 24, H + 24)
      ctx.globalCompositeOperation = 'lighter' // additive — overlapping energy reads as light

      if (ph === 'shine') {
        // A calm charging core + a few orbiting sparks while we wait on the roll.
        const t = (now - phaseStartRef.current) / 1000
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.4)
        glow(cx, cy, (24 + 12 * pulse) * u, `rgba(${pal.glow},${0.42 + 0.24 * pulse})`, `rgba(${pal.glow},0)`)
        glow(cx, cy, 9 * u, 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)')
        if (!reduced) {
          for (let i = 0; i < 5; i++) {
            const ang = t * 1.7 + (i / 5) * TAU
            glow(cx + Math.cos(ang) * 30 * u, cy + Math.sin(ang) * 30 * u, 5 * u, `rgba(255,255,255,0.6)`, `rgba(${pal.glow},0)`)
          }
        }
      } else if (ph === 'charge') {
        const p = clamp01((now - phaseStartRef.current) / CHARGE_MS)
        for (const pt of converge) {
          const pp = clamp01((p - pt.delay) / (1 - pt.delay))
          const rr = pt.d * (1 - easeIn(pp)) * u
          const a = Math.sin(pp * Math.PI) // fade in on the way, out as it hits centre
          glow(cx + Math.cos(pt.a) * rr, cy + Math.sin(pt.a) * rr, pt.size * 1.7 * u, `rgba(255,255,255,${0.85 * a})`, `rgba(${pal.glow},0)`)
        }
        const cr = (12 + 26 * easeIn(p)) * u
        glow(cx, cy, cr, `rgba(255,255,255,${0.5 + 0.4 * p})`, `rgba(${pal.glow},0)`)
        glow(cx, cy, cr * 2.6, `rgba(${pal.glow},${0.4 * p})`, `rgba(${pal.glow},0)`)
      } else {
        // burst + fade share the shockwave / spray, driven by time-since-burst.
        const bt = now - burstStartRef.current
        const span = BURST_MS + FADE_MS

        // Flash — one smooth 0→1→0 over the first ~half of the burst (not a strobe).
        const flashP = clamp01(bt / (BURST_MS * 0.5))
        if (flashP < 1) glow(cx, cy, Math.max(W, H) * 0.9, `rgba(255,255,255,${0.82 * Math.sin(flashP * Math.PI)})`, `rgba(${pal.glow},0)`)

        // Core fireball — smooth gradient bloom, no turbulence filter.
        const cp = easeOut(clamp01(bt / BURST_MS))
        glow(cx, cy, (30 + 120 * cp) * u, `rgba(255,255,255,${0.9 * (1 - cp)})`, `rgba(${pal.glow},0)`)

        // Shockwave rings — stroked arcs (cheap), staggered.
        const rings = reduced ? 1 : 3
        for (let i = 0; i < rings; i++) {
          const rp = clamp01((bt - i * 70) / (BURST_MS * 0.9))
          if (rp <= 0 || rp >= 1) continue
          ctx.globalAlpha = 1 - rp
          ctx.lineWidth = Math.max(1, 6 * (1 - rp) * u)
          ctx.strokeStyle = i === 0 ? pal.core : `rgba(${pal.glow},1)`
          ctx.beginPath(); ctx.arc(cx, cy, easeOut(rp) * Math.max(W, H) * 0.55, 0, TAU); ctx.stroke()
          ctx.globalAlpha = 1
        }

        // Spray — outward streaks with a hot head, gravity-arced (skip if reduced).
        if (!reduced) {
          const bp = clamp01(bt / span)
          for (const pt of spray) {
            const sp = clamp01((bp - pt.delay * 0.4) / (1 - pt.delay * 0.4))
            if (sp <= 0) continue
            const rr = pt.d * easeOut(sp) * u
            const grav = 62 * sp * sp * u
            const x = cx + Math.cos(pt.a) * rr, y = cy + Math.sin(pt.a) * rr + grav
            const bx = cx + Math.cos(pt.a) * rr * 0.85, by = cy + Math.sin(pt.a) * rr * 0.85 + grav * 0.85
            const a = clamp01(1 - sp) * (sp < 0.1 ? sp * 10 : 1)
            ctx.strokeStyle = `rgba(${pal.glow},${0.8 * a})`
            ctx.lineWidth = pt.size * u
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke()
            ctx.fillStyle = `rgba(255,255,255,${a})`
            ctx.beginPath(); ctx.arc(x, y, pt.size * 0.7 * u, 0, TAU); ctx.fill()
          }
        }

        // Lingering afterglow through the fade into the reveal.
        if (ph === 'fade') {
          const fp = clamp01((now - phaseStartRef.current) / FADE_MS)
          glow(cx, cy, (60 + 40 * fp) * u, `rgba(${pal.glow},${0.5 * (1 - fp)})`, `rgba(${pal.glow},0)`)
        }
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [rarity, reduced])

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden" style={{ background: '#040208' }}
      onClick={() => doneRef.current()}>
      {/* Machine backdrop — statically dimmed with plain overlays (no animated
          filter, the old build's biggest per-frame cost). */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${machineSrc})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      <div className="absolute inset-0" style={{ background: 'rgba(4,2,8,0.55)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 46%, transparent 24%, rgba(4,2,8,0.92) 100%)' }} />

      {/* The entire energy cinematic — one canvas layer. */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      <span className="absolute font-pixel" style={{
        left: 0, right: 0, bottom: 'calc(var(--safe-bottom) + 16px)', textAlign: 'center',
        fontSize: 6, color: 'rgba(255,255,255,0.35)',
      }}>TAP TO SKIP</span>
    </div>
  )
}
