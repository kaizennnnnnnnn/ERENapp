'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PURR BEAT — the stage. Everything that moves at 60fps lives on one canvas.
//
// The old field was DOM: each falling note was an absolutely-positioned div
// animated by rewriting `top: <%>` every frame, with a blurred box-shadow for
// glow. Both halves of that are on this project's do-not list — `top` is
// layout-bound (globals rule: animate transform/opacity only) and a blurred
// shadow on a per-frame-moving element re-rasterizes its layer every frame,
// which is the exact jank CanAura.tsx documents. It also forced a full React
// re-render of the whole page 60 times a second just to reposition six divs.
//
// Canvas fixes all three at once, and buys the thing that actually makes a
// rhythm game read as one: PERSPECTIVE. Lanes converge toward a vanishing
// point, notes accelerate and grow as they approach, and beat lines rush up
// the highway — none of which is affordable as animated DOM.
//
// The projection is a real one-over-depth divide (see projectY), tuned to a
// ~2.6:1 near/far speed ratio. A textbook projection is ~9:1, which looks
// spectacular and plays terribly: the note crawls, then whips through the
// judgment window too fast to time.
//
// This component draws; it does not simulate. The game owns StageState and
// mutates it from its own loop; the canvas reads it. The only thing that
// happens in here is effect integration (ripples/shards age and die), because
// nothing outside cares about a spark's position.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react'

// ─── Field geometry, as fractions of the canvas ─────────────────────────────
const HORIZON = 0.1          // where the lanes converge
const HIT_Y = 0.83           // the judgment line
const SPAN_NEAR = 0.96       // lane block width at the hit line
// Not a true vanishing point. Converging all the way to one makes a gorgeous
// still and an unreadable game — the incoming notes become sub-pixel slivers
// and the player cannot tell which lane one is in until it is nearly on them.
const SPAN_FAR = 0.28
const DEPTH_K = 1.5          // perspective softness — see header
const LANES = 4

export const LANE_HUE = ['#F0509B', '#9D6BFF', '#25D3E8', '#FFBE2E']
const LANE_LIGHT = ['#FFB3D6', '#D6C0FF', '#A6F1FA', '#FFE7A8']

const TAU = Math.PI * 2
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
/** 0-1 alpha as the two hex digits that suffix a #RRGGBB literal. */
const hex = (a: number) => Math.round(clamp01(a) * 255).toString(16).padStart(2, '0')

// ─── Shared state ───────────────────────────────────────────────────────────

export interface StageNote {
  id: number
  lane: number
  /** Game time at which this note reaches the hit line. */
  target: number
  /** Set when the note is a hold's tail marker rather than a tap. */
  accent?: boolean
}

export type JudgeKind = 'perfect' | 'good' | 'ok' | 'miss'

interface Ripple { lane: number; t0: number; kind: JudgeKind }
interface Shard { lane: number; t0: number; ang: number; speed: number; hue: string; size: number }

export interface StageState {
  /** Game time in seconds, from the audio clock. */
  time: number
  travel: number
  notes: StageNote[]
  /** Beat times in game seconds — the floor scrolls on these. Shared, not
   *  copied, with the conductor's grid so drums and visuals cannot disagree. */
  beatGrid: number[]
  /** Game time of the most recent tap on each lane — drives the pad flare. */
  laneTap: number[]
  ripples: Ripple[]
  shards: Shard[]
  /** Game time of the last kick drum, for the whole-stage throb. */
  beatAt: number
  /** Interval between kicks, so the throb decays over a musical length. */
  beatLen: number
  /** 0-3 arrangement density — the backdrop warms up as layers enter. */
  intensity: number
  mult: number
  combo: number
  /** Game time of the last miss — drives shake and the red wash. */
  missAt: number
  /** Game time of the last multiplier step-up — drives the colour flare. */
  flareAt: number
  playing: boolean
}

export function createStage(): StageState {
  return {
    time: 0,
    travel: 1.5,
    notes: [],
    beatGrid: [],
    laneTap: [-9, -9, -9, -9],
    ripples: [],
    shards: [],
    beatAt: -9,
    beatLen: 0.6,
    intensity: 0,
    mult: 1,
    combo: 0,
    missAt: -9,
    flareAt: -9,
    playing: false,
  }
}

// ─── Effect spawners (called by the game, integrated here) ──────────────────

const SHARD_HUE: Record<JudgeKind, string[]> = {
  perfect: ['#FFF4C2', '#FFE066', '#FFFFFF', '#FFD029'],
  good: ['#C8FFE4', '#7CF0BE', '#FFFFFF'],
  ok: ['#CBE9FF', '#8FD0FF'],
  miss: ['#FFB4B4', '#E8635F'],
}

/** `now` is passed in rather than read from stage.time because a tap is judged
 *  against a clock reading taken inside the pointer handler, between frames.
 *  Stamping its particles with the last frame's time would birth them already
 *  up to a frame old. */
export function spawnHit(stage: StageState, lane: number, kind: JudgeKind, now: number) {
  stage.ripples.push({ lane, t0: now, kind })
  if (stage.ripples.length > 14) stage.ripples.splice(0, stage.ripples.length - 14)

  const hues = SHARD_HUE[kind]
  const n = kind === 'perfect' ? 10 : kind === 'good' ? 7 : kind === 'miss' ? 8 : 5
  for (let i = 0; i < n; i++) {
    // Fan upward and outward. The jitter is what stops a burst reading as a
    // mechanical star — the same trick flappy-eren's spawnScoreBurst uses.
    const ang = -Math.PI / 2 + (i / (n - 1) - 0.5) * (kind === 'miss' ? 2.6 : 2.1) + (Math.random() - 0.5) * 0.35
    stage.shards.push({
      lane,
      t0: now,
      ang,
      speed: (kind === 'perfect' ? 150 : 110) + Math.random() * 70,
      hue: hues[i % hues.length],
      size: 3 + Math.random() * 3,
    })
  }
  if (stage.shards.length > 90) stage.shards.splice(0, stage.shards.length - 90)
}

// ─── Projection ─────────────────────────────────────────────────────────────

/** Perspective depth for a note's progress p (0 = spawned at the horizon,
 *  1 = touching the hit line). Returns 1 at the horizon, 0 at the line. */
function depthAt(p: number): number {
  const z = 1 - p
  return (z / (z + DEPTH_K)) * (1 + DEPTH_K)
}

export default function PurrBeatStage({ stage, reduced, drawRef }: {
  stage: React.MutableRefObject<StageState>
  reduced: boolean
  /** The game publishes its draw function here and calls it from ITS loop.
   *
   *  The canvas deliberately does not own a requestAnimationFrame of its own.
   *  It used to, and because a child's mount effect runs before the parent's,
   *  the canvas callback was always registered first — so every frame drew the
   *  state the game had written on the PREVIOUS frame. A permanent one-frame
   *  lag is invisible in most games and unacceptable in this one: the picture
   *  the player times their tap against would sit ~17 ms behind the clock that
   *  judges it, in a window only 55 ms wide, biased late in one direction. */
  drawRef: React.MutableRefObject<(() => void) | null>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedRef = useRef(reduced)
  useEffect(() => { reducedRef.current = reduced }, [reduced])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0
    let H = 0
    let dpr = 1
    // Cached per-resize paint objects. Rebuilding these every frame was ~30
    // gradient allocations and 230 scanline fillRects per frame; they only
    // actually change when the canvas does.
    let scanlines: CanvasPattern | null = null
    let floorFade: CanvasGradient | null = null
    const skyCache = new Map<number, CanvasGradient>()
    let gridCursor = 0

    const buildCaches = () => {
      skyCache.clear()
      floorFade = null
      const tile = document.createElement('canvas')
      tile.width = 1
      tile.height = 3
      const tctx = tile.getContext('2d')
      if (tctx) {
        tctx.fillStyle = 'rgba(0,0,0,0.14)'
        tctx.fillRect(0, 0, 1, 1)
        scanlines = ctx.createPattern(tile, 'repeat')
      }
    }

    const skyFor = (intensity: number): CanvasGradient => {
      const key = Math.round(intensity)
      const hit = skyCache.get(key)
      if (hit) return hit
      const heat = key / 3
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, `rgb(${26 + heat * 16}, ${5 + heat * 3}, ${50 + heat * 14})`)
      g.addColorStop(0.6, `rgb(${15 + heat * 8}, 4, ${32 + heat * 8})`)
      g.addColorStop(1, `rgb(${8 + heat * 4}, 2, ${18 + heat * 4})`)
      skyCache.set(key, g)
      return g
    }

    const resize = () => {
      // Capped at 2 for the same reason the gacha cinematics cap it: a 3x
      // retina phone gains nothing visible from a gradient-heavy fill and
      // pays 2.25x the fill cost.
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      W = Math.max(1, rect.width)
      H = Math.max(1, rect.height)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      buildCaches()
    }
    resize()
    window.addEventListener('resize', resize)
    // The field's height depends on the HUD above it, which changes when the
    // combo readout appears. ResizeObserver catches that; `resize` alone does not.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    // ── geometry helpers, recomputed per frame from W/H ──
    const horizonY = () => H * HORIZON
    const hitY = () => H * HIT_Y

    /** Screen y for a progress value. */
    const projectY = (p: number) => hitY() - (hitY() - horizonY()) * depthAt(p)

    /** Horizontal scale of the lane block at a given depth (1 = at the line). */
    const spreadAt = (depth: number) => (SPAN_FAR + (SPAN_NEAR - SPAN_FAR) * (1 - depth)) * W

    const laneCentreX = (lane: number, depth: number) => {
      const span = spreadAt(depth)
      return W / 2 + ((lane + 0.5) / LANES - 0.5) * span
    }
    const laneHalfW = (depth: number) => (spreadAt(depth) / LANES) * 0.42

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w / 2, h / 2)
      ctx.beginPath()
      ctx.moveTo(x + rr, y)
      ctx.arcTo(x + w, y, x + w, y + h, rr)
      ctx.arcTo(x + w, y + h, x, y + h, rr)
      ctx.arcTo(x, y + h, x, y, rr)
      ctx.arcTo(x, y, x + w, y, rr)
      ctx.closePath()
    }

    const glow = (x: number, y: number, r: number, inner: string, outer: string) => {
      if (r <= 0) return
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, inner)
      g.addColorStop(1, outer)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
    }

    const draw = () => {
      if (W <= 0 || H <= 0) return
      const s = stage.current
      const low = reducedRef.current
      const now = s.time
      const hY = hitY()
      const hzY = horizonY()

      // Beat throb, 1 on the kick decaying to 0 over half a beat.
      const throb = low ? 0 : clamp01(1 - (now - s.beatAt) / (s.beatLen * 0.5))
      const missAge = now - s.missAt
      const flareAge = now - s.flareAt

      // Screen shake on a miss, folded into the base transform so it moves the
      // whole stage at zero extra cost (the gacha cinematics' trick).
      let sx = 0
      let sy = 0
      if (!low && missAge >= 0 && missAge < 0.28) {
        const amp = 7 * (1 - missAge / 0.28)
        sx = (Math.random() * 2 - 1) * amp
        sy = (Math.random() * 2 - 1) * amp
      }
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr)
      ctx.clearRect(-16, -16, W + 32, H + 32)

      // ── 1. Backdrop ──────────────────────────────────────────────────────
      // Deliberately near-black. Every light on this stage is additive, so the
      // base has to stay dark or the accumulated glow flattens into one bright
      // magenta wash and the neon notes have nothing to be brighter than.
      ctx.fillStyle = skyFor(s.intensity)
      ctx.fillRect(0, 0, W, H)

      // Stage lights — the ONLY additive pass over the backdrop, and kept tight
      // so they read as light sources rather than as fog.
      ctx.globalCompositeOperation = 'lighter'
      glow(W / 2, hzY + H * 0.01, W * (0.3 + throb * 0.07),
        `rgba(210,90,250,${0.09 + throb * 0.1})`, 'rgba(210,90,250,0)')
      ctx.globalCompositeOperation = 'source-over'

      // ── 1b. The stage itself ─────────────────────────────────────────────
      // Speaker stacks flanking the runway and a booth for Eren to stand
      // behind. Without them the lanes emerge from nowhere and the whole
      // screen reads as an abstract gradient rather than a place.
      const spkW = Math.max(16, W * 0.07)
      const spkH = spkW * 1.7
      const spkY = hzY - spkH * 0.42
      for (const side of [-1, 1]) {
        const cx = W / 2 + side * W * 0.375
        ctx.fillStyle = '#170A28'
        roundRect(cx - spkW / 2, spkY, spkW, spkH, 3)
        ctx.fill()
        ctx.strokeStyle = 'rgba(232,121,249,0.4)'
        ctx.lineWidth = 2
        ctx.stroke()
        // Two cones that punch out on the kick.
        for (let i = 0; i < 2; i++) {
          const cyc = spkY + spkH * (0.3 + i * 0.42)
          const r = spkW * (i === 0 ? 0.27 : 0.19) * (1 + throb * 0.3)
          ctx.fillStyle = '#0C0417'
          ctx.beginPath(); ctx.arc(cx, cyc, r, 0, TAU); ctx.fill()
          ctx.fillStyle = `rgba(255,190,46,${0.25 + throb * 0.6})`
          ctx.beginPath(); ctx.arc(cx, cyc, r * 0.42, 0, TAU); ctx.fill()
        }
        if (!low) {
          ctx.globalCompositeOperation = 'lighter'
          glow(cx, spkY + spkH / 2, spkW * (1.5 + throb * 0.5),
            `rgba(255,190,46,${0.05 + throb * 0.12})`, 'rgba(255,190,46,0)')
          ctx.globalCompositeOperation = 'source-over'
        }
      }

      // Booth — a lit slab at the vanishing point. Eren (a DOM sprite above
      // the canvas) stands behind its top edge.
      const boothW = W * 0.3
      const boothY = hzY - 6
      ctx.fillStyle = '#1E0B33'
      roundRect(W / 2 - boothW / 2, boothY, boothW, 18, 3)
      ctx.fill()
      ctx.strokeStyle = `rgba(34,211,238,${0.45 + throb * 0.4})`
      ctx.lineWidth = 2
      ctx.stroke()
      for (let i = 0; i < 2; i++) {
        const tx = W / 2 + (i === 0 ? -1 : 1) * boothW * 0.26
        ctx.fillStyle = `rgba(103,232,249,${0.5 + throb * 0.45})`
        ctx.beginPath(); ctx.arc(tx, boothY + 9, 3.4, 0, TAU); ctx.fill()
      }

      // ── 2. Lane floor ────────────────────────────────────────────────────
      // One trapezoid per lane, from the horizon to the hit line. Drawn
      // NON-additively: it is a surface, not a light, and blending four
      // full-height shapes additively is what washes the stage out.
      for (let lane = 0; lane < LANES; lane++) {
        const tapAge = now - s.laneTap[lane]
        const lit = clamp01(1 - tapAge / 0.22)
        const nearX = laneCentreX(lane, 0)
        const nearW = laneHalfW(0)
        const farX = laneCentreX(lane, 1)
        const farW = laneHalfW(1)

        ctx.beginPath()
        ctx.moveTo(farX - farW, hzY)
        ctx.lineTo(farX + farW, hzY)
        ctx.lineTo(nearX + nearW, hY)
        ctx.lineTo(nearX - nearW, hY)
        ctx.closePath()

        const g = ctx.createLinearGradient(0, hzY, 0, hY)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(1, 'rgba(255,255,255,0.045)')
        ctx.fillStyle = g
        ctx.fill()

        // Tap beam — a short coloured flare that dies out a third of the way
        // up the lane. A full-height beam reads as a searchlight and buries
        // the notes still travelling behind it.
        if (lit > 0) {
          const bg = ctx.createLinearGradient(0, hY, 0, hY - (hY - hzY) * 0.34)
          bg.addColorStop(0, `${LANE_HUE[lane]}${hex(lit * 0.36)}`)
          bg.addColorStop(1, `${LANE_HUE[lane]}00`)
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = bg
          ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
        }

        // Lane edge rails.
        ctx.strokeStyle = `rgba(232,180,255,${0.06 + lit * 0.2})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(farX - farW, hzY)
        ctx.lineTo(nearX - nearW, hY)
        ctx.moveTo(farX + farW, hzY)
        ctx.lineTo(nearX + nearW, hY)
        ctx.stroke()
      }

      // ── 3. Beat lines rushing the highway ────────────────────────────────
      // The single strongest "this is a rhythm game" cue: the floor scrolls in
      // time, so the tempo is visible before a note ever arrives.
      if (s.playing) {
        // Walk forward from a cursor rather than scanning the whole grid. The
        // grid only grows — a five-minute run reaches ~650 entries — while the
        // visible window is never more than a handful, so a full scan makes the
        // draw cost creep upward the longer the player survives.
        while (gridCursor > 0 && s.beatGrid[gridCursor] > now) gridCursor--
        while (gridCursor < s.beatGrid.length - 1 && s.beatGrid[gridCursor + 1] <= now) gridCursor++
        for (let bi = gridCursor; bi < s.beatGrid.length; bi++) {
          const bt = s.beatGrid[bi]
          const p = 1 - (bt - now) / s.travel
          if (p < 0) break        // everything past here is further in the future
          if (p > 1.04) continue
          const d = depthAt(p)
          const y = projectY(p)
          const halfSpan = spreadAt(d) / 2
          const a = 0.1 + 0.34 * (1 - d) * (1 - d)
          ctx.strokeStyle = `rgba(245,208,254,${a})`
          ctx.lineWidth = 1 + (1 - d) * 1.6
          ctx.beginPath()
          ctx.moveTo(W / 2 - halfSpan, y)
          ctx.lineTo(W / 2 + halfSpan, y)
          ctx.stroke()
        }
      }

      // ── 4. Notes ─────────────────────────────────────────────────────────
      for (const n of s.notes) {
        const p = 1 - (n.target - now) / s.travel
        if (p < -0.02 || p > 1.12) continue
        const d = depthAt(Math.min(1, p))
        const y = projectY(Math.min(1, p))
        const cx = laneCentreX(n.lane, d)
        const hw = laneHalfW(d)
        const scale = hw / laneHalfW(0)
        const h = Math.max(3, 17 * scale)
        const fade = clamp01(p * 6)   // fade in out of the haze at the horizon

        // Speed trail — a stretched, dim copy behind the note. Reads as motion
        // without a per-element blur.
        const trailH = h * 2.4
        const tg = ctx.createLinearGradient(0, y - trailH, 0, y)
        tg.addColorStop(0, `${LANE_HUE[n.lane]}00`)
        tg.addColorStop(1, `${LANE_HUE[n.lane]}55`)
        ctx.fillStyle = tg
        ctx.globalAlpha = fade * 0.8
        roundRect(cx - hw * 0.7, y - trailH, hw * 1.4, trailH, h * 0.3)
        ctx.fill()

        ctx.globalAlpha = fade
        // Halo. One radial per note, no shadowBlur — shadowBlur is the single
        // most expensive canvas op on mobile and this is the cheap equivalent.
        ctx.globalCompositeOperation = 'lighter'
        glow(cx, y, hw * 1.45, `${LANE_HUE[n.lane]}4D`, `${LANE_HUE[n.lane]}00`)
        ctx.globalCompositeOperation = 'source-over'

        const body = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2)
        body.addColorStop(0, LANE_LIGHT[n.lane])
        body.addColorStop(0.45, LANE_HUE[n.lane])
        body.addColorStop(1, LANE_HUE[n.lane])
        ctx.fillStyle = body
        roundRect(cx - hw, y - h / 2, hw * 2, h, Math.max(1, h * 0.32))
        ctx.fill()

        // Hard top highlight — the pixel-art convention, and it makes the note
        // read as a solid object rather than a smear.
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        roundRect(cx - hw * 0.82, y - h / 2 + h * 0.13, hw * 1.64, Math.max(1, h * 0.16), h * 0.08)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // ── 5. Hit line + pads ───────────────────────────────────────────────
      // The stage front. Everything below the line is darkened so the eye is
      // pulled to the judgment row instead of drifting off the bottom.
      const nearSpan = spreadAt(0)
      if (!floorFade) {
        floorFade = ctx.createLinearGradient(0, hY, 0, H)
        floorFade.addColorStop(0, 'rgba(0,0,0,0)')
        floorFade.addColorStop(1, 'rgba(0,0,0,0.55)')
      }
      ctx.fillStyle = floorFade
      ctx.fillRect(0, hY, W, H - hY)

      const linePulse = 0.55 + throb * 0.45
      ctx.fillStyle = `rgba(255,255,255,${0.22 + throb * 0.28})`
      ctx.fillRect(W / 2 - nearSpan / 2, hY - 1.5, nearSpan, 3)

      for (let lane = 0; lane < LANES; lane++) {
        const cx = laneCentreX(lane, 0)
        const hw = laneHalfW(0)
        const tapAge = now - s.laneTap[lane]
        const lit = clamp01(1 - tapAge / 0.18)
        const padH = 15

        roundRect(cx - hw, hY - padH / 2, hw * 2, padH, 4)
        ctx.fillStyle = `rgba(255,255,255,${0.05 + lit * 0.4})`
        ctx.fill()
        ctx.strokeStyle = `${LANE_HUE[lane]}${hex(0.55 + lit * 0.45)}`
        ctx.lineWidth = 2
        ctx.stroke()

        // Reflection on the stage front. Cheap (one squashed copy at low
        // alpha) and it turns the empty strip below the line into floor.
        // Mirror about the pad's bottom edge, squashed to 0.55: solving
        // T - 0.55y = y at y = the bottom edge gives the translate below.
        const edge = hY + padH / 2
        ctx.save()
        ctx.globalAlpha = 0.1 + lit * 0.2
        ctx.translate(0, edge * 1.38)
        ctx.scale(1, -0.38)
        roundRect(cx - hw, hY - padH / 2, hw * 2, padH, 4)
        ctx.fillStyle = LANE_HUE[lane]
        ctx.fill()
        ctx.restore()
      }

      ctx.globalCompositeOperation = 'lighter'
      glow(W / 2, hY, nearSpan * 0.5, `rgba(245,208,254,${0.09 * linePulse})`, 'rgba(245,208,254,0)')
      for (let lane = 0; lane < LANES; lane++) {
        const lit = clamp01(1 - (now - s.laneTap[lane]) / 0.18)
        if (lit <= 0) continue
        glow(laneCentreX(lane, 0), hY, laneHalfW(0) * 2.4 * lit, `${LANE_HUE[lane]}${hex(lit * 0.5)}`, `${LANE_HUE[lane]}00`)
      }

      // ── 6. Judgment ripples ──────────────────────────────────────────────
      for (let i = s.ripples.length - 1; i >= 0; i--) {
        const r = s.ripples[i]
        const age = (now - r.t0) / 0.42
        if (age >= 1 || age < 0) { if (age >= 1) s.ripples.splice(i, 1); continue }
        const cx = laneCentreX(r.lane, 0)
        const hw = laneHalfW(0)
        const rad = hw * (0.5 + age * 2.6)
        const a = (1 - age) * (r.kind === 'perfect' ? 0.9 : 0.6)
        ctx.strokeStyle = r.kind === 'miss'
          ? `rgba(248,113,113,${a})`
          : r.kind === 'perfect' ? `rgba(255,236,150,${a})` : `${LANE_HUE[r.lane]}${hex(a)}`
        ctx.lineWidth = 3 * (1 - age) + 0.6
        // Squashed — the ring lies on the floor plane, not facing the camera.
        ctx.beginPath()
        ctx.ellipse(cx, hY, rad, rad * 0.42, 0, 0, TAU)
        ctx.stroke()
      }

      // ── 7. Shards ────────────────────────────────────────────────────────
      // The reaping pass runs even under reduced motion (only the DRAWING is
      // skipped). Gating the whole block meant shards piled up to the cap and
      // stayed there, so every subsequent hit paid an O(n) splice to make room
      // for particles that were never going to be drawn.
      {
        for (let i = s.shards.length - 1; i >= 0; i--) {
          const sh = s.shards[i]
          const age = now - sh.t0
          if (age > 0.62 || age < 0) { if (age > 0.62) s.shards.splice(i, 1); continue }
          if (low) continue
          const t = age
          const cx = laneCentreX(sh.lane, 0)
          const x = cx + Math.cos(sh.ang) * sh.speed * t
          // +gravity. Faked with a t² term rather than integrated per frame —
          // a spark's arc doesn't need a simulation.
          const y = hY + Math.sin(sh.ang) * sh.speed * t + 340 * t * t
          const a = 1 - age / 0.62
          const sz = sh.size * (0.4 + a * 0.6)
          ctx.globalAlpha = a
          ctx.fillStyle = sh.hue
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz)
          ctx.globalAlpha = 1
        }
      }

      // ── 8. Full-field washes ─────────────────────────────────────────────
      // Multiplier step-up: a gold bloom from the hit line.
      if (!low && flareAge >= 0 && flareAge < 0.6) {
        const a = (1 - flareAge / 0.6) * 0.26
        glow(W / 2, hY, W * 0.9, `rgba(253,224,71,${a})`, 'rgba(253,224,71,0)')
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1

      // Miss: a red vignette hugging the EDGES. Centred on the screen, not on
      // the hit line — anchored at the line, the far corner of the gradient is
      // the top of the screen, so the whole playfield floods red and the notes
      // you still have to hit disappear inside the punishment for the one you
      // missed.
      if (missAge >= 0 && missAge < 0.4) {
        const a = (1 - missAge / 0.4) * 0.34
        const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.34, W / 2, H * 0.55, Math.max(W, H) * 0.72)
        vg.addColorStop(0, 'rgba(220,38,38,0)')
        vg.addColorStop(1, `rgba(220,38,38,${a})`)
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, W, H)
      }

      // CRT scanlines — the project's dark-panel signature, drawn last so it
      // sits over the light rather than under it. One tiled pattern fill, not
      // H/3 separate fillRects; at ~230 rects a frame that was the single most
      // expensive call in the loop and it never changes.
      if (scanlines) {
        ctx.fillStyle = scanlines
        ctx.fillRect(0, 0, W, H)
      }
    }

    drawRef.current = draw
    return () => {
      drawRef.current = null
      window.removeEventListener('resize', resize)
      ro?.disconnect()
    }
  }, [stage, drawRef])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}
