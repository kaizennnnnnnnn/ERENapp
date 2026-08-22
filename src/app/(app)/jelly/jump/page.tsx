'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY JUMP — bounce Eren up the parlour storeroom, shelf after shelf.
//
// ── Why there is more here than "one jelly, one bounce" ────────────────────
// A climber where every platform is identical is a test of steering and
// nothing else, which runs out of interest in about forty seconds. Four kinds
// give the climb a shape, and the director introduces them in the order a
// player can absorb them:
//
//   JELLY   the baseline. One bounce, then it melts. No camping.
//   SLIDER  slides along its shelf. Appears early; teaches timing.
//   CREAM   whipped cream — a much bigger bounce, and it survives. The reward
//           line: risk a longer reach for a free storey.
//   CRUMB   a crumbling biscuit. Bounces once, then falls out from under you.
//           It's the one that makes you look before you land.
//
// Gaps widen and sliders speed up with height, so the top of a good run is a
// genuinely different game from the bottom.
//
// ── Engine ─────────────────────────────────────────────────────────────────
// Same discipline as Jelly Slice: entities in refs, one rAF loop writing
// transforms straight to the DOM, React re-rendering only when the platform
// LIST changes (a shelf recycled off the bottom) rather than every frame.
//
// The world scrolls, Eren doesn't. He's pinned near the middle of the screen
// and the platforms slide down past him, which keeps him in the player's eye
// line at every height and means the "camera" is one number instead of a
// transform on a container that would blur the sprite.
//
// Steering is HOLD, not tap: touch the left or right half and he accelerates
// that way, release and he coasts. Tapping to nudge reads as unresponsive on a
// body already in the air, and a run is one long arc of steering.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useJellies, type JellyWin } from '@/hooks/useJellies'
import { useJellyDuel } from '@/hooks/useJellyDuel'
import { JELLIES, type JellyDef } from '@/lib/jellies'
import JellyPrize, { type DuelLine } from '@/components/jelly/JellyPrize'
import { JumpWall, JumpDepth, TILE } from '@/components/jelly/JumpScenery'
import PixelEren, { type ErenPose } from '@/components/games/PixelEren'
import { IconJelly } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { INK } from '@/components/jelly/parlourTheme'

// ─── Tuning ────────────────────────────────────────────────────────────────
const GRAVITY = 1750          // px/s²
const BOUNCE_V = 780          // px/s launched off a jelly
const CREAM_V = 1120          // ...and off whipped cream
const MOVE_A = 2600           // px/s² while steering
const MAX_VX = 430
const DRAG = 0.86             // per-frame coast damping when not steering
const EREN = 46               // sprite box
const PLAT_W = 76
const PLAT_H = 26
/** Eren sits this far down the screen; the world scrolls under him. */
const CAM_ANCHOR = 0.46
/**
 * Vertical gap between platforms, widened as you climb.
 *
 * The ceiling is not a taste call: a bounce leaves at BOUNCE_V and rises
 * BOUNCE_V² / 2·GRAVITY = ~174px, so any gap at or above that is a platform
 * he physically cannot reach. GAP_MAX sits at ~86% of it, which leaves enough
 * margin to still be STEERING at the apex rather than arriving spent. The
 * jitter below is applied before the clamp, so it can never push past this.
 */
const GAP_START = 112
const GAP_MIN = 96
const GAP_MAX = 150
/**
 * How far sideways the next platform may sit from the one below it.
 *
 * The same reachability argument as GAP_MAX, on the other axis. A hop lasts
 * ~0.65s; from a standing start he accelerates to MAX_VX in 0.17s and covers
 * roughly 240px in that time. Placing each platform at a uniform random x
 * across the whole width — which is what this did first — regularly asked for
 * 300px, so a run ended not because the player misjudged anything but because
 * the next shelf was out of range. Anchoring to the PREVIOUS platform keeps
 * every hop honest, and the screen wrap is still there for the tight ones.
 */
const REACH_X = 165
/**
 * Height that earns a jelly. One hop is ~14–19 M, so this is about fifteen
 * clean ones — a real run, but reachable on an ordinary day. It was 400, which
 * is twenty-four flawless hops: a daily goal nobody would ever fill.
 */
const THRESHOLD = 240
/** Height (px) per point — a run reads in hundreds, not tens of thousands. */
const PX_PER_M = 8
/** Metres after which the director is at full strength. */
const RAMP_M = 900

type PlatKind = 'jelly' | 'slider' | 'cream' | 'crumb'

interface Plat {
  id: number
  kind: PlatKind
  x: number
  /** World Y — grows downward; the camera subtracts from it. */
  wy: number
  jelly: JellyDef
  used: boolean
  /** 0..1 squish, decays after a bounce. */
  squish: number
  /**
   * 0→1 after it has been used. A spent jelly used to sit at 15% opacity
   * forever, which reads as a dark smudge stuck to the wall rather than
   * something that melted — and worse, it looks landable. It now flattens and
   * goes completely.
   */
  melt: number
  /** CRUMB: bounced once, now falling away. */
  falling: boolean
  fallV: number
  /** SLIDER: horizontal speed and travel bounds. */
  vx: number
  minX: number
  maxX: number
  el?: HTMLDivElement | null
}

let uid = 0

export default function JellyJumpPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const reduced = useReducedMotion()
  const jellies = useJellies()
  const duel = useJellyDuel('jump')

  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [height, setHeight] = useState(0)
  const [pose, setPose] = useState<ErenPose>('idle')
  const [banner, setBanner] = useState<string | null>(null)
  const [wins, setWins] = useState<JellyWin[]>([])
  const [result, setResult] = useState<{ isBest: boolean; duel: DuelLine } | null>(null)

  const fieldRef = useRef<HTMLDivElement | null>(null)
  const erenRef = useRef<HTMLDivElement | null>(null)
  const wallRef = useRef<HTMLDivElement | null>(null)
  const depthRef = useRef<HTMLDivElement | null>(null)
  const plats = useRef<Plat[]>([])
  const cat = useRef({ x: 0, wy: 0, vx: 0, vy: 0 })
  const cam = useRef(0)          // world Y currently at the top of the screen
  const bestWy = useRef(0)       // highest (smallest wy) reached
  const steer = useRef(0)        // -1 / 0 / +1
  const heightRef = useRef(0)
  const phaseRef = useRef<'ready' | 'play' | 'over'>('ready')
  const savedRef = useRef(false)
  const nextPlatWy = useRef(0)
  /** x of the platform below, so the next one lands within reach of it. */
  const lastPlatX = useRef(0)
  const milestone = useRef(0)
  const poseTimer = useRef<number | null>(null)
  const bannerTimer = useRef<number | null>(null)
  const [, force] = useState(0)

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  const flash = useCallback((p: ErenPose, ms = 420) => {
    setPose(p)
    if (poseTimer.current) window.clearTimeout(poseTimer.current)
    poseTimer.current = window.setTimeout(() => setPose('idle'), ms)
  }, [])

  const shout = useCallback((text: string) => {
    setBanner(text)
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current)
    bannerTimer.current = window.setTimeout(() => setBanner(null), 1100)
  }, [])

  const endRound = useCallback(async () => {
    if (savedRef.current) return
    savedRef.current = true
    phaseRef.current = 'over'
    setPhase('over')
    playSound('jl_over')

    const final = heightRef.current
    const submitted = await duel.submit(final)
    const won: JellyWin[] = []
    if (final >= THRESHOLD) {
      const w = await jellies.awardJelly()
      if (w) won.push(w)
      if (submitted.bonusJelly) {
        const b = await jellies.awardJelly()
        if (b) won.push(b)
      }
    }
    setWins(won)
    setResult({
      isBest: submitted.isBest,
      duel: { theirName: duel.theirName, theirsToday: duel.theirsToday, tookLead: submitted.tookLead },
    })
    if (final > 0 && user?.id) {
      completeTask('daily_game')
      void applyAction(user.id, 'play')
    }
  }, [duel, jellies, user?.id, completeTask, applyAction])

  /**
   * The loop must NOT depend on endRound.
   *
   * endRound closes over `jellies` and `duel`, which are fresh objects from
   * their hooks on every render — so it changes identity constantly, and an
   * effect that lists it tears the rAF loop down and rebuilds it on every
   * score tick. That resets the wave clock and the difficulty ramp several
   * times a second, which is why the round never got harder. Calling through a
   * ref keeps the loop mounted for the whole round.
   */
  const endRoundRef = useRef(endRound)
  useEffect(() => { endRoundRef.current = endRound }, [endRound])

  /**
   * Add one platform above the highest so far.
   *
   * `heat` (0→1 over RAMP_M metres) drives the whole difficulty curve: the gap
   * widens toward GAP_MAX, and the mix shifts off plain jellies. Cream is kept
   * at a steady ~10% at every height — it's the pressure valve, and a climb
   * with no free storeys in it stops being fun long before it stops being hard.
   */
  const addPlat = useCallback((W: number) => {
    const climbed = Math.max(0, -nextPlatWy.current) / PX_PER_M
    const heat = Math.min(1, climbed / RAMP_M)
    const gap = Math.max(GAP_MIN, Math.min(GAP_MAX,
      GAP_START + heat * 30 + (Math.random() - 0.5) * 28))
    nextPlatWy.current -= gap

    const roll = Math.random()
    const sliderChance = 0.12 + heat * 0.26
    const crumbChance = heat < 0.12 ? 0 : 0.08 + heat * 0.18
    const kind: PlatKind = roll < 0.10 ? 'cream'
      : roll < 0.10 + sliderChance ? 'slider'
        : roll < 0.10 + sliderChance + crumbChance ? 'crumb'
          : 'jelly'

    const half = PLAT_W / 2
    const lo = half, hi = Math.max(half, W - half)
    // Reflect off the walls instead of clamping: a clamp makes several
    // platforms in a row pile against the same edge.
    let x = lastPlatX.current + (Math.random() * 2 - 1) * REACH_X
    if (x < lo) x = lo + (lo - x)
    if (x > hi) x = hi - (x - hi)
    x = Math.min(hi, Math.max(lo, x))
    lastPlatX.current = x
    // A slider is confined to its own stretch of shelf, so it can never park
    // itself off-screen where the player can't reach it.
    const span = Math.min(W - PLAT_W, 90 + Math.random() * 90)
    const minX = Math.max(half, x - span / 2)
    const maxX = Math.min(W - half, x + span / 2)

    plats.current.push({
      id: ++uid,
      kind,
      x, wy: nextPlatWy.current,
      jelly: JELLIES[Math.floor(Math.random() * JELLIES.length)],
      used: false, squish: 0, melt: 0, falling: false, fallV: 0,
      vx: kind === 'slider' ? (Math.random() < 0.5 ? -1 : 1) * (48 + heat * 78) : 0,
      minX, maxX,
    })
  }, [])

  // ── The loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const field = fieldRef.current
      if (!field) return
      const W = field.clientWidth, H = field.clientHeight
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      const c = cat.current
      // Steering
      if (steer.current !== 0) c.vx += steer.current * MOVE_A * dt
      else c.vx *= Math.pow(DRAG, dt * 60)
      c.vx = Math.max(-MAX_VX, Math.min(MAX_VX, c.vx))
      c.x += c.vx * dt
      // Wrap around the sides — falling off the edge is a death the player
      // can't see coming on a narrow phone, and wrapping is a real tactic.
      if (c.x < -EREN / 2) c.x = W + EREN / 2
      if (c.x > W + EREN / 2) c.x = -EREN / 2

      c.vy += GRAVITY * dt
      c.wy += c.vy * dt

      // Move the sliders BEFORE the collision test, so what you see under his
      // feet is where the platform actually is this frame.
      for (const p of plats.current) {
        if (p.vx !== 0 && !p.falling) {
          p.x += p.vx * dt
          if (p.x <= p.minX) { p.x = p.minX; p.vx = Math.abs(p.vx) }
          if (p.x >= p.maxX) { p.x = p.maxX; p.vx = -Math.abs(p.vx) }
        }
        if (p.falling) { p.fallV += GRAVITY * 0.55 * dt; p.wy += p.fallV * dt }
      }

      // Bounce: only while falling, and only on the way DOWN through the top
      // face — otherwise he sticks to a jelly he's rising through.
      if (c.vy > 0) {
        for (const p of plats.current) {
          if (p.used || p.falling) continue
          const dx = Math.abs(c.x - p.x)
          if (dx > PLAT_W / 2 + EREN / 4) continue
          const feet = c.wy + EREN / 2
          if (feet >= p.wy && feet <= p.wy + PLAT_H * 0.9) {
            if (p.kind === 'cream') {
              c.vy = -CREAM_V
              // Cream survives — it's the one platform you'd come back to, and
              // it never gets the chance because you're already three up.
              p.squish = 1
              playSound('jl_high')
              shout('WHIPPED!')
              flash('cheer', 340)
            } else {
              c.vy = -BOUNCE_V
              p.used = true
              p.squish = 1
              if (p.kind === 'crumb') { p.falling = true; p.fallV = 40 }
              playSound('jl_bounce')
              flash('cheer', 260)
            }
            break
          }
        }
      }

      // Camera follows only upward, so a dip doesn't drag the view down.
      const wantCam = c.wy - H * CAM_ANCHOR
      if (wantCam < cam.current) cam.current = wantCam
      if (c.wy < bestWy.current) {
        bestWy.current = c.wy
        const m = Math.max(0, Math.round(-bestWy.current / PX_PER_M))
        if (m !== heightRef.current) {
          heightRef.current = m
          setHeight(m)
          if (m >= milestone.current + 250) {
            milestone.current = m - (m % 250)
            playSound('jl_high')
            shout(`${milestone.current} M`)
          }
        }
      }

      // Keep a screen and a half of platforms above, recycle below.
      let listChanged = false
      while (nextPlatWy.current > cam.current - H * 0.6) { addPlat(W); listChanged = true }
      plats.current = plats.current.filter(p => {
        if (p.wy - cam.current > H + PLAT_H * 3) { listChanged = true; return false }
        if (p.squish > 0) p.squish = Math.max(0, p.squish - dt * 3.2)
        // Melt a spent jelly away entirely. Cream is never spent; a crumb
        // falls instead, and is recycled by the off-screen test above.
        if (p.used && !p.falling && p.kind !== 'cream') {
          p.melt = Math.min(1, p.melt + dt * 2.4)
          if (p.melt >= 1) { listChanged = true; return false }
        }
        if (p.el) {
          const sy = (1 - p.squish * 0.45) * (1 - p.melt * 0.8)
          const sx = (1 + p.squish * 0.3) * (1 + p.melt * 0.25)
          p.el.style.transform =
            `translate3d(${p.x - PLAT_W / 2}px, ${p.wy - cam.current}px, 0) scale(${sx}, ${sy})`
          p.el.style.opacity = String(1 - p.melt)
        }
        return true
      })

      // Two parallax rates. The far wall tiles, so it only ever needs a
      // background offset; the near shelves are real elements and get one
      // transform on their container.
      if (wallRef.current) {
        wallRef.current.style.backgroundPositionY = `${-cam.current * 0.4}px`
      }
      if (depthRef.current) {
        // Modulo keeps the strip's own offset small: without it the transform
        // grows without bound over a long climb and starts losing precision.
        const y = -cam.current * 0.85
        depthRef.current.style.transform = `translate3d(0, ${y % TILE - TILE}px, 0)`
      }

      if (erenRef.current) {
        // Squash on the way up out of a bounce, stretch at the top of the arc —
        // the cheapest possible weight cue, and it costs one string.
        const s = Math.max(-1, Math.min(1, c.vy / 900))
        const sx = 1 - s * 0.12, sy = 1 + s * 0.12
        erenRef.current.style.transform =
          `translate3d(${c.x - EREN / 2}px, ${c.wy - cam.current - EREN / 2}px, 0) scale(${sx}, ${sy})`
      }

      // Fallen off the bottom of the view.
      if (c.wy - cam.current > H + EREN * 2 && phaseRef.current === 'play') {
        void endRoundRef.current()
      }
      if (listChanged) force(v => v + 1)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, addPlat, flash, shout])

  // ── Steering input ────────────────────────────────────────────────────────
  const setSteerFrom = useCallback((clientX: number) => {
    const field = fieldRef.current
    if (!field) return
    const r = field.getBoundingClientRect()
    steer.current = clientX - r.left < r.width / 2 ? -1 : 1
  }, [])

  // Keyboard for desktop play; the phone uses the halves.
  useEffect(() => {
    if (phase !== 'play') return
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') steer.current = -1
      if (e.key === 'ArrowRight') steer.current = 1
    }
    const up = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' && steer.current === -1) || (e.key === 'ArrowRight' && steer.current === 1)) {
        steer.current = 0
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [phase])

  const start = useCallback(() => {
    const field = fieldRef.current
    const W = field?.clientWidth ?? 360
    const H = field?.clientHeight ?? 640
    plats.current = []
    nextPlatWy.current = 0
    lastPlatX.current = W / 2
    cam.current = -H * CAM_ANCHOR
    // A wide starting jelly right under him so the first bounce is free.
    plats.current.push({
      id: ++uid, kind: 'jelly', x: W / 2, wy: 0, jelly: JELLIES[0],
      used: false, squish: 0, melt: 0, falling: false, fallV: 0, vx: 0, minX: W / 2, maxX: W / 2,
    })
    for (let i = 0; i < 9; i++) addPlat(W)
    cat.current = { x: W / 2, wy: -EREN, vx: 0, vy: 0 }
    bestWy.current = 0
    heightRef.current = 0
    milestone.current = 0
    steer.current = 0
    savedRef.current = false
    setHeight(0); setBanner(null); setWins([]); setResult(null)
    phaseRef.current = 'play'
    setPhase('play')
  }, [addPlat])

  useEffect(() => () => {
    if (poseTimer.current) window.clearTimeout(poseTimer.current)
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{
      background: '#2A1030', touchAction: 'none',
    }}>
      <JumpWall ref={wallRef} />
      <JumpDepth ref={depthRef} count={7} />

      {/* ── HUD ── */}
      <div className="absolute left-0 right-0 flex items-center gap-2 px-3" style={{
        top: 'calc(var(--safe-top) + 8px)', zIndex: 30,
      }}>
        <button onClick={() => { playSound('ui_back'); router.push('/jelly') }} aria-label="Back"
          className="flex items-center justify-center active:translate-y-[1px] transition-transform"
          style={{ width: 34, height: 34, background: '#FFF8EE', borderRadius: 8, border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}` }}>
          <ChevronLeft size={15} style={{ color: INK }} />
        </button>
        <div className="flex items-center gap-1 px-2.5 py-1.5" style={{
          background: '#FFF8EE', borderRadius: 8, border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}`,
        }}>
          <IconJelly size={12} />
          <span className="font-pixel" style={{ fontSize: 10, color: INK }}>{height}</span>
          <span className="font-pixel" style={{ fontSize: 6, color: '#A8836C' }}>M</span>
        </div>
        <div className="flex-1" />
        {/* Her line for today, so you can see what you're chasing mid-run. */}
        {duel.theirName && duel.theirsToday > 0 && (
          <div className="px-2 py-1.5" style={{
            background: height > duel.theirsToday ? '#2FA765' : INK,
            borderRadius: 8, border: '2.5px solid #FFF8EE',
          }}>
            <span className="font-pixel" style={{ fontSize: 6, color: '#FFE6F0' }}>
              {duel.theirName.slice(0, 7).toUpperCase()} {duel.theirsToday}
            </span>
          </div>
        )}
      </div>

      {/* Milestone / cream shout. */}
      {banner && phase === 'play' && (
        <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1.5" style={{
          top: 'calc(var(--safe-top) + 52px)', zIndex: 30,
          background: INK, borderRadius: 999, border: '2.5px solid #FFE6F0',
          animation: reduced ? undefined : 'jellyComboPop 320ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <span className="font-pixel" style={{ fontSize: 8, color: '#FFE6F0' }}>{banner}</span>
        </div>
      )}

      {/* ── Field ── */}
      <div ref={fieldRef} className="absolute inset-0" style={{ zIndex: 5 }}
        onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); setSteerFrom(e.clientX) }}
        onPointerMove={e => { if (steer.current !== 0) setSteerFrom(e.clientX) }}
        onPointerUp={() => { steer.current = 0 }}
        onPointerCancel={() => { steer.current = 0 }}>

        {plats.current.map(p => (
          <div key={p.id} ref={el => { p.el = el }} aria-hidden style={{
            position: 'absolute', left: 0, top: 0, width: PLAT_W, height: PLAT_H,
            willChange: 'transform, opacity', pointerEvents: 'none',
            transformOrigin: 'center bottom',
          }}>
            <Platform kind={p.kind} jelly={p.jelly} />
          </div>
        ))}

        <div ref={erenRef} style={{
          position: 'absolute', left: 0, top: 0, width: EREN, height: EREN,
          willChange: 'transform', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PixelEren pose={pose} size={EREN} />
        </div>
      </div>

      {/* ── Start card ── */}
      {phase === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center px-6" style={{ zIndex: 40, background: 'rgba(20,6,24,0.66)' }}>
          <div className="w-full flex flex-col items-center gap-2.5" style={{
            maxWidth: 292, padding: 18, borderRadius: 16, background: '#FFF8EE',
            border: `3px solid ${INK}`, boxShadow: `0 6px 0 ${INK}`,
          }}>
            <IconJelly size={26} />
            <p className="font-pixel text-center" style={{ fontSize: 11, color: INK }}>JELLY JUMP</p>
            <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.5, color: '#7A4B5E' }}>
              <strong style={{ color: INK }}>Hold</strong> the left or right side to steer him.
              He wraps around the edges.
            </p>
            <div className="w-full flex flex-col gap-1.5 my-0.5">
              <Rule swatch="#D73832" text="JELLIES melt after one bounce — never stop climbing." />
              <Rule swatch="#FFF3D6" text="CREAM throws him twice as high and stays put." />
              <Rule swatch="#C89B62" text="BISCUITS crumble away the moment you land." />
            </div>
            <p className="text-center" style={{ fontSize: 10, color: '#9A7484' }}>
              Slip past the bottom of the shaft and the run ends.
            </p>
            <button onClick={() => { playSound('ui_select'); start() }}
              className="w-full py-3 mt-1 active:translate-y-[1px] transition-transform"
              style={{ borderRadius: 12, background: 'linear-gradient(180deg, #B57BE0, #7B3FB0)', border: `3px solid ${INK}`, boxShadow: `0 4px 0 ${INK}` }}>
              <span className="font-pixel" style={{ fontSize: 9, color: '#FFF8EE' }}>START</span>
            </button>
          </div>
        </div>
      )}

      {/* Steering hint — first run only, fades on its own. */}
      {phase === 'play' && height === 0 && !reduced && (
        <div className="absolute left-0 right-0 flex justify-between px-8 pointer-events-none" style={{
          bottom: '22%', zIndex: 20, animation: 'jellyHintFade 2.6s ease-out forwards',
        }}>
          {['◀ HOLD', 'HOLD ▶'].map(t => (
            <span key={t} className="font-pixel px-2.5 py-1.5" style={{
              fontSize: 7, color: '#FFF8EE', background: 'rgba(42,16,48,0.75)', borderRadius: 999,
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'over' && result && (
        <JellyPrize
          score={height} best={Math.max(duel.best, height)} isBest={result.isBest}
          unit="M" threshold={THRESHOLD} duel={result.duel} wins={wins}
          trayCount={jellies.trayCount} traySize={jellies.traySize}
          onPlayAgain={start}
          onExit={() => router.push('/jelly')}
        />
      )}
    </div>
  )
}

// ─── One platform ───────────────────────────────────────────────────
// A platform is a SLAB, not the shop's pudding art shrunk down.
//
// The first build dropped jelly_*.png into a 76×26 box with objectFit:contain,
// which letterboxes a 1.18:1 portrait into a 31px-wide thumbnail floating in
// the middle of its own hitbox — so the thing you land on looked nothing like
// the thing you were aiming at. These are drawn wide, sitting on a plate, in
// the flavour's own colour, so the whole 76px reads as ground.
//
// Each kind differs in SHAPE as well as colour, because at a screen's distance
// while falling, shape is all you get: cream is a piped swirl, biscuit is a
// bitten slab, a slider wears brass rails.
function Platform({ kind, jelly }: { kind: PlatKind; jelly: JellyDef }) {
  if (kind === 'cream') {
    return (
      <span style={{ position: 'absolute', inset: 0 }}>
        <span style={{
          position: 'absolute', left: 3, right: 3, bottom: 1, height: 13, borderRadius: 999,
          background: 'linear-gradient(180deg, #FFFDF6 0%, #E9D3B8 100%)',
          border: `3px solid ${INK}`,
        }} />
        {[15, 30, 46, 61].map((x, i) => (
          <span key={x} style={{
            position: 'absolute', left: x - 8, bottom: 9 + (i % 2) * 5,
            width: 17, height: 17, borderRadius: '50%',
            background: 'linear-gradient(180deg, #FFFFFF, #EFDCC4)',
            border: `3px solid ${INK}`,
          }} />
        ))}
      </span>
    )
  }

  if (kind === 'crumb') {
    return (
      <span style={{ position: 'absolute', inset: 0 }}>
        {/* A bite out of the top-right, cut with clip-path rather than painted
            over — a "bite" drawn as a background-coloured circle only works on a
            flat backdrop, and this one has lamps on it. */}
        <span style={{
          position: 'absolute', left: 2, right: 2, bottom: 2, height: 19, borderRadius: 6,
          background: 'linear-gradient(180deg, #E8BC85 0%, #B37E45 100%)',
          border: `3px solid ${INK}`,
          clipPath: 'polygon(0% 0%, 72% 0%, 76% 40%, 88% 42%, 92% 0%, 100% 0%, 100% 100%, 0% 100%)',
        }} />
        {[[16, 9], [30, 13], [45, 8], [56, 12]].map(([x, y]) => (
          <span key={x} style={{
            position: 'absolute', left: x, bottom: y, width: 4, height: 4, borderRadius: 1,
            background: 'rgba(88,50,18,0.75)',
          }} />
        ))}
      </span>
    )
  }

  return (
    <span style={{ position: 'absolute', inset: 0 }}>
      {kind === 'slider' && (
        // Rails, so a moving shelf announces itself before it moves.
        <span style={{
          position: 'absolute', left: -5, right: -5, bottom: 0, height: 6, borderRadius: 3,
          background: 'linear-gradient(180deg, #F3CE78, #9A6E1E)', border: `2.5px solid ${INK}`,
        }} />
      )}
      {/* The slab: the flavour's colour, domed like the mould it came out of. */}
      <span style={{
        position: 'absolute', left: 1, right: 1, bottom: kind === 'slider' ? 5 : 1, height: 21,
        borderRadius: '13px 13px 5px 5px',
        background: `linear-gradient(180deg, ${jelly.colour} 0%, ${jelly.colour} 55%, rgba(0,0,0,0.28) 100%)`,
        border: `3px solid ${INK}`,
        overflow: 'hidden',
      }}>
        {/* Wet top face. */}
        <span style={{
          position: 'absolute', left: 4, right: 4, top: 2, height: 6, borderRadius: 999,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.12))',
        }} />
        {/* Mould flutes. */}
        {[22, 50, 78].map(pct => (
          <span key={pct} style={{
            position: 'absolute', left: `${pct}%`, top: 5, bottom: 0, width: 2,
            background: 'rgba(255,255,255,0.22)',
          }} />
        ))}
      </span>
      {/* The leaf off the shop art, so a slab still reads as one of the five. */}
      <span style={{
        position: 'absolute', left: '50%', top: 0, width: 11, height: 7, marginLeft: -5,
        borderRadius: '60% 20% 60% 20%', background: '#4E9E2E', border: `2px solid ${INK}`,
      }} />
    </span>
  )
}

function Rule({ swatch, text }: { swatch: string; text: string }) {
  return (
    <span className="flex items-start gap-2">
      <span style={{
        width: 11, height: 11, borderRadius: '50%', background: swatch,
        border: `2px solid ${INK}`, flexShrink: 0, marginTop: 1,
      }} />
      <span style={{ fontSize: 9.5, lineHeight: 1.35, color: '#7A4B5E' }}>{text}</span>
    </span>
  )
}
