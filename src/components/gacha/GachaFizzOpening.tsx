'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GachaRarity } from '@/types'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// ─── GachaFizzOpening ─────────────────────────────────────────────────────────
// Snacks & Drinks (1st machine) opening cinematic.
//
// The FoodSuits machine already owns the radial language — charge inward,
// detonate, shockwave rings. Reusing it here made the two machines feel like the
// same box in different wallpaper, so this one is built on the other obvious
// motion for a drinks banner: CARBONATION. The screen fills like a poured glass,
// bubbles stream up through it, and the pull resolves as the surface erupting in
// a fountain rather than a bomb going off. Vertical and liquid instead of radial
// and explosive — nothing in here is a scaled ring.
//
// Same one-canvas discipline as the energy build for the same reason: it holds
// 60fps on a mid-range phone where stacked blended DOM layers did not. Cheap
// primitives only — a filled wave path, radial gradient discs, short strokes —
// at a DPR capped to 2.
//
// Caller contract is identical to GachaEnergyOpening: `rarity` is null while the
// roll resolves, so the fizz idles until it arrives, then runs surge → pop →
// fade → onDone. Tap anywhere skips. Respects reduced motion.

type Phase = 'fizz' | 'surge' | 'pop' | 'fade'

// "r,g,b" triplets so they can be dropped straight into rgba().
const RARITY_GLOW: Record<GachaRarity, string> = {
  common:    '198,212,234',
  rare:      '26,150,255',
  epic:      '176,60,255',
  legendary: '255,190,12',
}
// Pre-roll hue cycle. Deliberately a different set and order from the energy
// machine's so the two openings don't read as the same effect re-tinted —
// these are soda colours: orange → cherry → lime → grape → gold.
const SODA_CYCLE = ['255,138,40', '240,60,110', '120,205,70', '150,80,235', '255,196,30']

const MIN_FIZZ = 1250, SURGE_MS = 720, POP_MS = 560, FADE_MS = 500
const TAU = Math.PI * 2

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

const lerpTriplet = (a: string, b: string, t: number): string => {
  const pa = a.split(','), pb = b.split(',')
  return pa.map((v, i) => Math.round(+v + (+pb[i] - +v) * t)).join(',')
}
const sodaColor = (tMs: number): string => {
  const seg = 680
  const tt = (tMs % (seg * SODA_CYCLE.length)) / seg
  const i = Math.floor(tt) % SODA_CYCLE.length
  return lerpTriplet(SODA_CYCLE[i], SODA_CYCLE[(i + 1) % SODA_CYCLE.length], tt - Math.floor(tt))
}

// Bubbles are defined once and placed analytically from elapsed time — a bubble
// is a phase offset, not a moving object, so there is no per-frame state to step
// and nothing to garbage collect mid-animation.
interface Bubble { x: number; r: number; sp: number; ph: number; wob: number }
const makeBubbles = (n: number): Bubble[] =>
  Array.from({ length: n }, () => ({
    x: Math.random(),                  // 0..1 of width
    r: 1.6 + Math.random() * 3.4,
    sp: 0.22 + Math.random() * 0.42,   // screens per second
    ph: Math.random(),
    wob: 4 + Math.random() * 12,
  }))

// The pop throws droplets up and out; gravity pulls them back into an arc.
interface Drop { a: number; v: number; delay: number; size: number }
const makeDrops = (n: number): Drop[] =>
  Array.from({ length: n }, (_, i) => ({
    // Biased upward (-PI/2) with spread, so it reads as a fountain not a sphere.
    a: -Math.PI / 2 + (i / n - 0.5) * 2.5 + (Math.random() - 0.5) * 0.4,
    v: 230 + Math.random() * 300,
    delay: Math.random() * 0.16,
    size: 2.2 + Math.random() * 3.4,
  }))

interface Props {
  /** Highest rarity in the batch. null while the roll is still resolving. */
  rarity: GachaRarity | null
  onDone: () => void
  machineSrc?: string
}

export default function GachaFizzOpening({
  rarity, onDone, machineSrc = '/gacha_food.webp?v=1',
}: Props) {
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('fizz')

  const mountRef = useRef(0)
  const phaseStartRef = useRef(0)
  const popStartRef = useRef(0)
  const startedRef = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const phaseRef = useRef<Phase>('fizz')
  phaseRef.current = phase

  const bubbles = useMemo(() => makeBubbles(reduced ? 14 : 34), [reduced])
  const drops = useMemo(() => makeDrops(reduced ? 10 : 28), [reduced])

  useEffect(() => {
    mountRef.current = performance.now()
    phaseStartRef.current = performance.now()
  }, [])

  // Phase machine. The fizz holds until the roll resolves — that wait is the
  // whole reason the opening exists, so the network latency never shows.
  useEffect(() => {
    if (rarity == null || startedRef.current) return
    startedRef.current = true
    const enter = (p: Phase) => { phaseStartRef.current = performance.now(); setPhase(p) }
    const elapsed = performance.now() - mountRef.current
    const timers: number[] = []
    timers.push(window.setTimeout(() => {
      playSound('gift_open'); enter('surge')
      timers.push(window.setTimeout(() => {
        popStartRef.current = performance.now(); enter('pop'); playSound(`gacha_reveal_${rarity}`)
      }, SURGE_MS))
      timers.push(window.setTimeout(() => enter('fade'), SURGE_MS + POP_MS))
      timers.push(window.setTimeout(() => doneRef.current(), SURGE_MS + POP_MS + FADE_MS))
    }, Math.max(0, MIN_FIZZ - elapsed)))
    return () => timers.forEach(clearTimeout)
  }, [rarity])

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
      const t = (now - mountRef.current) / 1000
      const u = Math.min(W, H) / 430
      const tint = rarity ? RARITY_GLOW[rarity] : sodaColor(now - phaseStartRef.current)

      // How full the glass is. Idles low, rushes up on surge, holds through the
      // pop, drains on fade. It deliberately stops just under halfway rather
      // than near the top: the pop erupts UP from this line, so the headroom
      // above it is what the fountain needs to be visible at all.
      let level: number
      if (ph === 'fizz') {
        level = H * 0.80 + Math.sin(t * 1.6) * 5 * u
      } else if (ph === 'surge') {
        level = H * (0.80 - 0.34 * easeInOut(clamp01((now - phaseStartRef.current) / SURGE_MS)))
      } else if (ph === 'pop') {
        level = H * 0.46
      } else {
        level = H * (0.46 + 0.7 * easeOut(clamp01((now - phaseStartRef.current) / FADE_MS)))
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // Wobbling surface — two sines at different rates so it never looks like a
      // single travelling wave.
      const surfaceAt = (x: number) =>
        level + Math.sin(x / (46 * u) + t * 2.2) * 5 * u + Math.sin(x / (23 * u) - t * 3.1) * 2.4 * u

      // ── Liquid body. source-over: this is a volume, not light. ──
      ctx.globalCompositeOperation = 'source-over'
      const body = ctx.createLinearGradient(0, level, 0, H)
      body.addColorStop(0, `rgba(${tint},0.60)`)
      body.addColorStop(1, `rgba(${tint},0.24)`)
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, surfaceAt(x))
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fill()

      // ── Everything above is light: additive. ──
      ctx.globalCompositeOperation = 'lighter'

      // Pour stream. Without it the waiting beat is a thin strip of liquid at
      // the bottom of an empty screen for over a second; this fills the dead
      // space and, more usefully, explains why the level is climbing.
      if (ph === 'fizz' || ph === 'surge') {
        const px = W / 2 + Math.sin(t * 1.9) * 6 * u
        const sy = Math.max(0, surfaceAt(px))
        const half = 9 * u
        // Soft outer column so the stream has body, then a bright core.
        const halo = ctx.createLinearGradient(px - half * 2.2, 0, px + half * 2.2, 0)
        halo.addColorStop(0, `rgba(${tint},0)`)
        halo.addColorStop(0.5, `rgba(${tint},0.5)`)
        halo.addColorStop(1, `rgba(${tint},0)`)
        ctx.fillStyle = halo
        ctx.fillRect(px - half * 2.2, 0, half * 4.4, sy)
        const col = ctx.createLinearGradient(px - half, 0, px + half, 0)
        col.addColorStop(0, `rgba(${tint},0)`)
        col.addColorStop(0.5, 'rgba(255,255,255,0.62)')
        col.addColorStop(1, `rgba(${tint},0)`)
        ctx.fillStyle = col
        ctx.fillRect(px - half, 0, half * 2, sy)
        // Highlights falling down the column — without these the pour is a
        // static bar and reads as a light beam rather than moving liquid.
        for (let i = 0; i < 3; i++) {
          const fall = ((t * 1.7 + i / 3) % 1) * sy
          ctx.fillStyle = 'rgba(255,255,255,0.5)'
          ctx.fillRect(px - half * 0.34, fall, half * 0.68, 26 * u)
        }
        // Splash where it lands, pulsing so it looks like it's hitting.
        glow(px, sy, (20 + 6 * Math.sin(t * 9)) * u, 'rgba(255,255,255,0.6)', `rgba(${tint},0)`)
      }

      // Foam band riding the surface.
      const foamStep = reduced ? 34 : 18
      for (let x = 0; x <= W; x += foamStep) {
        const y = surfaceAt(x)
        const j = Math.sin(x * 0.37 + t * 4) * 2 * u
        glow(x, y + j, 7 * u, `rgba(255,255,255,0.5)`, `rgba(${tint},0)`)
      }

      // Bubbles rising from the base to the surface, wobbling as they go and
      // thinning out near the top where they'd break.
      for (const b of bubbles) {
        const prog = ((t * b.sp + b.ph) % 1)
        const bx = b.x * W + Math.sin(t * 2 + b.ph * TAU) * b.wob * u
        const by = H - prog * (H - level)
        if (by < level) continue
        const a = (1 - prog) * 0.85
        glow(bx, by, b.r * u * 1.6, `rgba(255,255,255,${0.45 * a})`, `rgba(${tint},0)`)
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * a})`
        ctx.lineWidth = Math.max(0.6, 0.9 * u)
        ctx.beginPath(); ctx.arc(bx, by, b.r * u, 0, TAU); ctx.stroke()
      }

      if (ph === 'pop' || ph === 'fade') {
        const bt = now - popStartRef.current
        const span = POP_MS + FADE_MS

        // One smooth flash, tinted so the peak reads as the rarity's colour.
        const fp = clamp01(bt / (POP_MS * 0.5))
        if (fp < 1) {
          const fa = Math.sin(fp * Math.PI)
          glow(W / 2, level, Math.max(W, H) * 0.95,
            `rgba(255,255,255,${0.72 * fa})`, `rgba(${tint},0)`)
        }

        // The eruption itself — a bloom climbing out of the surface. Without
        // this the flash just brightens the liquid uniformly and there is no
        // moment where something visibly bursts.
        const cp = easeOut(clamp01(bt / POP_MS))
        glow(W / 2, level - 30 * cp * u, (34 + 150 * cp) * u,
          `rgba(255,255,255,${0.85 * (1 - cp)})`, `rgba(${tint},0)`)

        // Fountain — droplets launched from the surface, arced back down by
        // gravity. The upward bias is what separates this from a radial burst.
        if (!reduced) {
          const bp = clamp01(bt / span)
          for (const d of drops) {
            const sp = clamp01((bp - d.delay * 0.4) / (1 - d.delay * 0.4))
            if (sp <= 0) continue
            const dist = d.v * sp * u
            const x = W / 2 + Math.cos(d.a) * dist
            const y = level + Math.sin(d.a) * dist + 220 * sp * sp * u
            const a = clamp01(1 - sp) * (sp < 0.1 ? sp * 10 : 1)
            ctx.strokeStyle = `rgba(${tint},${0.75 * a})`
            ctx.lineWidth = d.size * u
            ctx.beginPath()
            ctx.moveTo(x - Math.cos(d.a) * 17 * u, y - Math.sin(d.a) * 17 * u)
            ctx.lineTo(x, y)
            ctx.stroke()
            ctx.fillStyle = `rgba(255,255,255,${a})`
            ctx.beginPath(); ctx.arc(x, y, d.size * 0.66 * u, 0, TAU); ctx.fill()
          }
        }

        // Afterglow sitting on the surface as it drains into the reveal.
        if (ph === 'fade') {
          const dp = clamp01((now - phaseStartRef.current) / FADE_MS)
          glow(W / 2, level, (70 + 50 * dp) * u,
            `rgba(255,255,255,${0.26 * (1 - dp)})`, `rgba(${tint},0)`)
        }
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [rarity, reduced, bubbles, drops])

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden" style={{ background: '#07040c' }}
      onClick={() => doneRef.current()}>
      {/* Machine backdrop — statically dimmed, no animated filter. */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${machineSrc})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      <div className="absolute inset-0" style={{ background: 'rgba(7,4,12,0.58)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 60%, transparent 26%, rgba(7,4,12,0.92) 100%)' }} />

      <canvas ref={canvasRef} className="absolute inset-0" />

      <span className="absolute font-pixel" style={{
        left: 0, right: 0, bottom: 'calc(var(--safe-bottom) + 16px)', textAlign: 'center',
        fontSize: 6, color: 'rgba(255,255,255,0.35)',
      }}>TAP TO SKIP</span>
    </div>
  )
}
