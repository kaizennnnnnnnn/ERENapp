'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY RUN — Eren outruns the jelly tide.
//
// A Banana Kong-style endless runner, rebuilt around the parlour. The
// mechanics are that game's, and they are the reason it plays the way it does
// rather than like every other tap-to-jump runner:
//
//   VARIABLE JUMP    a tap hops, a held tap climbs. One button, two heights,
//                    and the difference is the whole skill floor.
//   DOUBLE JUMP      a second tap in the air. Recovers a misjudged first jump,
//                    which is what stops a runner feeling like a coin flip.
//   DIVE             swipe down. Falls fast, and it is the ONLY way under a
//                    hanging pipe — so down is a real input, not a fidget.
//   TWO FLOORS       gaps in the parlour floor drop you into the cellar. That
//                    is not a death: it is a different, tighter lane you have
//                    to jump back out of. Missing a jump costs you a route,
//                    not the run.
//   BEADS -> POWER   collecting charges a bar. Full bar = DASH.
//   DASH             swipe right (or the button): invincible, smashes crates,
//                    and shoves the tide back. The comeback move.
//   THE TIDE         a wall of jelly on your heels. It creeps in on its own
//                    and lunges every time you take a hit, so a clean run is
//                    the only thing that keeps it off you.
//
// Only two of Banana Kong's systems are deliberately absent: rideable mounts
// and swing-vines. Both are whole subsystems, and neither is what makes the
// first two minutes feel good.
//
// ── Engine ─────────────────────────────────────────────────────────────────
// Same discipline as Jelly Jump: every entity lives in a ref, one rAF loop
// writes transforms straight to pooled DOM nodes, and React renders on EVENTS
// only (start, hit, dash, game over) — never per frame. The pools are fixed
// size and reused, so a 90-second run allocates nothing and mounts nothing.
//
// Eren is pinned near the left third and the world slides past him. A runner's
// camera is one number; making it a transform on a container would blur the
// sprite and cost a layer.
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
import JellyPrize, { type DuelLine } from '@/components/jelly/JellyPrize'
import {
  BackWall, WallShelf, FloorTile, CellarTile, Crate, Pipe, Tide, Bead,
  TILE, FLOOR_H,
} from '@/components/jelly/RunScenery'
import PixelEren, { type ErenPose } from '@/components/games/PixelEren'
import { playSound } from '@/lib/sounds'
import { INK, CREAM, BERRY, BRASS, BRASS_LT, LEAF } from '@/components/jelly/parlourTheme'

// ─── Tuning ────────────────────────────────────────────────────────────────
const GRAVITY = 2500          // px/s²
const JUMP_V = 760            // px/s off the floor
const HOLD_ACC = 1500         // px/s² of extra lift while the tap is held...
const HOLD_MS = 210           // ...for at most this long
const DOUBLE_V = 660          // px/s on the second jump
const DIVE_ACC = 3400         // px/s² added while diving
const SPEED_0 = 250           // px/s at the gun
const SPEED_MAX = 560
const SPEED_RAMP = 78         // seconds to reach SPEED_MAX

const EREN_PX = 34            // sprite box
const EREN_W = 22             // ...and its hitbox, which is narrower than the art
/**
 * Standing and sliding heights.
 *
 * The whole point of the dive is that it makes him SHORT. A hanging pipe is
 * hung between these two numbers — too low to run under, high enough to slide
 * under — so "swipe down" is the only answer to it. Without a second height
 * the pipe would just be a second thing to jump, and down would be a fidget.
 */
const H_RUN = 34
const H_SLIDE = 20
/** How far the pipe's underside sits above the floor. Must be H_SLIDE..H_RUN. */
const PIPE_CLEAR = 27
const PIPE_H = 18
/** A grounded slide ends on its own; it is a move, not a stance. */
const SLIDE_MS = 620

/**
 * Cellar headroom, in px.
 *
 * Sized so a jump plus the mid-air second jump can clear it: a single jump is
 * JUMP_V^2/(2*GRAVITY) ≈ 115px plus the hold, and the double adds most of its
 * own again. Any deeper and falling in would be a slow death sentence rather
 * than a detour, because the only way out is up through the next hole.
 */
const DROP = 150

/** Gap the tide sits behind Eren, in px. Hit zero and it has you. */
const GAP_0 = 190
const GAP_MAX = 260
const GAP_RECOVER = 26        // px/s clawed back while you run clean
const GAP_CREEP = 15          // px/s it gains no matter what
const GAP_HIT = 78            // ...and all at once when you clip something
const GAP_DASH = 90           // ...and what a dash buys back

const POWER_PER_BEAD = 9
const DASH_MS = 1500
const DASH_MULT = 1.85

/** A run's terrain is dealt in columns of TILE px. */
const COLS_AHEAD = 26
const SWIPE_PX = 34           // finger travel that counts as a swipe

const THRESHOLD = 220         // metres that earn a jelly

const BEAD_COLORS = ['#F472B6', '#FBBF24', '#5BE81E', '#60A5FA', '#C084FC']

// ─── Terrain ───────────────────────────────────────────────────────────────

interface Col {
  /** World x of the column's left edge. */
  x: number
  /** Is there parlour floor here, or is this a hole into the cellar? */
  upper: boolean
}

type ObKind = 'crate' | 'pipe'

interface Ob {
  x: number
  kind: ObKind
  /** Which floor it belongs to. */
  cellar: boolean
  dead: boolean
  w: number
  h: number
}

interface BeadEnt {
  x: number
  y: number
  taken: boolean
}

// Pool sizes. Generous enough that the generator never runs out on screen,
// small enough that the whole world is ~60 DOM nodes.
const N_COL = COLS_AHEAD + 4
const N_CRATE = 12
const N_PIPE = 6
const N_BEAD = 34
const N_SHELF = 4

export default function JellyRunPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const reduced = useReducedMotion()
  const jellies = useJellies()
  const duel = useJellyDuel('run')

  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [metres, setMetres] = useState(0)
  const [power, setPower] = useState(0)
  const [beads, setBeads] = useState(0)
  const [pose, setPose] = useState<ErenPose>('idle')
  const [step, setStep] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [wins, setWins] = useState<JellyWin[]>([])
  const [awardFailed, setAwardFailed] = useState(false)
  const [result, setResult] = useState<{ isBest: boolean; duel: DuelLine } | null>(null)

  // ── Stage ────────────────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement>(null)
  const dims = useRef({ w: 360, h: 620, upperY: 0, cellarY: 0, erenX: 0 })
  const [layout, setLayout] = useState({ upperY: 0, h: 620 })

  // ── Entities (never state — the loop owns these) ─────────────────────────
  const cols = useRef<Col[]>([])
  const obs = useRef<Ob[]>([])
  const bead = useRef<BeadEnt[]>([])
  const nextColX = useRef(0)
  /** Columns still owed to the current terrain feature. */
  const run = useRef({ kind: 'flat' as 'flat' | 'hole' | 'crates', left: 0 })

  const eren = useRef({ y: 0, vy: 0, grounded: true, cellar: false, doubled: false, diving: false, slideUntil: 0 })
  const world = useRef({ x: 0, speed: SPEED_0, gap: GAP_0, t: 0 })
  const dash = useRef({ until: 0 })
  const stumble = useRef(0)
  const held = useRef<{ at: number; active: boolean }>({ at: 0, active: false })
  const swipe = useRef({ x: 0, y: 0, used: false })

  const phaseRef = useRef<'ready' | 'play' | 'over'>('ready')
  const savedRef = useRef(false)
  const metresRef = useRef(0)
  const beadsRef = useRef(0)
  const powerRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)
  const stepT = useRef(0)
  const bannerTimer = useRef<number | null>(null)
  /** Last value pushed to the HUD. The loop's closure can't see React state. */
  const hud = useRef({ m: -1, b: -1, p: -1 })

  // ── Pooled DOM ───────────────────────────────────────────────────────────
  const colEls = useRef<(HTMLDivElement | null)[]>([])
  const cellEls = useRef<(HTMLDivElement | null)[]>([])
  const crateEls = useRef<(HTMLDivElement | null)[]>([])
  const pipeEls = useRef<(HTMLDivElement | null)[]>([])
  const beadEls = useRef<(HTMLDivElement | null)[]>([])
  const shelfEls = useRef<(HTMLDivElement | null)[]>([])
  const erenEl = useRef<HTMLDivElement>(null)
  const tideEl = useRef<HTMLDivElement>(null)

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  const shout = useCallback((text: string) => {
    setBanner(text)
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current)
    bannerTimer.current = window.setTimeout(() => setBanner(null), 1000)
  }, [])

  // ── Measure ──────────────────────────────────────────────────────────────
  const measure = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    const w = el.clientWidth, h = el.clientHeight
    // Both floors are derived from DROP so the cellar is always escapable,
    // whatever the screen. Clamped so a short screen doesn't push the parlour
    // floor up into the HUD.
    const cellarY = h - 54
    const upperY = Math.max(Math.round(h * 0.34), cellarY - (FLOOR_H + H_RUN + DROP))
    dims.current = { w, h, upperY, cellarY, erenX: Math.round(w * 0.26) }
    // The backdrop is React-rendered, so the split has to reach state — a ref
    // alone leaves the wall painted at the pre-measure guess forever.
    setLayout({ upperY, h })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [measure])

  // ── Terrain generation ───────────────────────────────────────────────────
  /**
   * Deals one column, in FEATURES rather than per-column coin flips.
   *
   * Random-per-column terrain produces one-tile holes and lone crates that are
   * unreadable at speed — you cannot see a hazard shape, only noise. Dealing a
   * feature (a 2-3 wide hole, a row of crates) and then a guaranteed flat rest
   * gives every hazard a silhouette and every player a beat to breathe.
   */
  const dealColumn = useCallback(() => {
    const x = nextColX.current
    const t = world.current.t
    // Difficulty: holes and crate rows get more common and longer with time.
    const heat = Math.min(1, t / 70)

    if (run.current.left <= 0) {
      const r = Math.random()
      if (r < 0.20 + heat * 0.14) {
        run.current = { kind: 'hole', left: 2 + (Math.random() < heat * 0.5 ? 1 : 0) }
      } else if (r < 0.46 + heat * 0.16) {
        run.current = { kind: 'crates', left: 1 + (Math.random() < heat * 0.6 ? 1 : 0) }
      } else {
        run.current = { kind: 'flat', left: 2 + Math.floor(Math.random() * 3) }
      }
    }
    const feature = run.current.kind
    run.current.left--

    const upper = feature !== 'hole'
    cols.current.push({ x, upper })

    if (feature === 'crates' && upper) {
      obs.current.push({ x: x + TILE * 0.28, kind: 'crate', cellar: false, dead: false, w: 30, h: 30 })
    }
    // A hanging pipe over open floor — the dive gate. Never over a hole, where
    // it would ask for a dive and a jump in the same step.
    if (feature === 'flat' && upper && Math.random() < 0.10 + heat * 0.10) {
      obs.current.push({ x: x + TILE * 0.2, kind: 'pipe', cellar: false, dead: false, w: 40, h: 18 })
    }
    // The cellar gets its own crates so falling in is a lane, not a rest.
    if (Math.random() < 0.18 + heat * 0.12) {
      obs.current.push({ x: x + TILE * 0.3, kind: 'crate', cellar: true, dead: false, w: 28, h: 26 })
    }

    // Beads. Over a hole they arc across the gap (the reward for jumping it);
    // on flat ground they sit at hop height.
    const { upperY, cellarY } = dims.current
    if (feature === 'hole') {
      // Arced across the gap — the payment for committing to the jump.
      for (let i = 0; i < 3; i++) {
        bead.current.push({ x: x + 8 + i * 13, y: upperY - 62 - Math.sin((i + 1) / 4 * Math.PI) * 26, taken: false })
      }
    } else if (Math.random() < 0.55) {
      const low = Math.random() < 0.5
      const baseY = (Math.random() < 0.25 ? cellarY : upperY) - (low ? 26 : 64)
      for (let i = 0; i < 3; i++) {
        bead.current.push({ x: x + 6 + i * 14, y: baseY, taken: false })
      }
    }

    nextColX.current += TILE
  }, [])

  // ── Start ────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    measure()
    const { upperY } = dims.current
    cols.current = []
    obs.current = []
    bead.current = []
    nextColX.current = 0
    run.current = { kind: 'flat', left: 6 }   // a clear runway to begin on
    world.current = { x: 0, speed: SPEED_0, gap: GAP_0, t: 0 }
    eren.current = { y: upperY, vy: 0, grounded: true, cellar: false, doubled: false, diving: false, slideUntil: 0 }
    hud.current = { m: -1, b: -1, p: -1 }
    dash.current = { until: 0 }
    stumble.current = 0
    metresRef.current = 0
    beadsRef.current = 0
    powerRef.current = 0
    savedRef.current = false
    lastT.current = 0
    stepT.current = 0
    for (let i = 0; i < COLS_AHEAD + 2; i++) dealColumn()
    setMetres(0); setBeads(0); setPower(0)
    setResult(null); setWins([]); setAwardFailed(false); setBanner(null)
    setPose('run')
    phaseRef.current = 'play'
    setPhase('play')
  }, [measure, dealColumn])

  // ── End ──────────────────────────────────────────────────────────────────
  const endRun = useCallback(async () => {
    if (savedRef.current) return
    savedRef.current = true
    phaseRef.current = 'over'
    setPhase('over')
    setPose('wobble')
    playSound('jl_over')

    const final = metresRef.current
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
    setAwardFailed(final >= THRESHOLD && won.length === 0)
    setResult({
      isBest: submitted.isBest,
      duel: { theirName: duel.theirName, theirsToday: duel.theirsToday, tookLead: submitted.tookLead },
    })
    if (final > 0 && user?.id) {
      completeTask('daily_game')
      void applyAction(user.id, 'play')
    }
  }, [duel, jellies, user?.id, completeTask, applyAction])

  // The loop must not depend on endRun: it closes over `jellies` and `duel`,
  // which are new objects every render, so listing it would tear the rAF loop
  // down and restart the difficulty ramp several times a second.
  const endRef = useRef(endRun)
  useEffect(() => { endRef.current = endRun }, [endRun])

  // ── Input ────────────────────────────────────────────────────────────────
  const doJump = useCallback(() => {
    const e = eren.current
    e.slideUntil = 0
    if (e.grounded) {
      e.vy = -JUMP_V
      e.grounded = false
      e.doubled = false
      e.diving = false
      held.current = { at: performance.now(), active: true }
      playSound('jl_bounce')
      setPose('leap')
    } else if (!e.doubled) {
      e.doubled = true
      e.vy = -DOUBLE_V
      e.diving = false
      held.current = { at: performance.now(), active: true }
      playSound('jl_bounce')
      setPose('leap')
    }
  }, [])

  const doDash = useCallback(() => {
    if (powerRef.current < 100) return
    powerRef.current = 0
    setPower(0)
    dash.current.until = performance.now() + DASH_MS
    world.current.gap = Math.min(GAP_MAX, world.current.gap + GAP_DASH)
    playSound('jl_combo')
    shout('DASH!')
  }, [shout])

  const onDown = useCallback((ev: React.PointerEvent) => {
    if (phaseRef.current !== 'play') return
    swipe.current = { x: ev.clientX, y: ev.clientY, used: false }
    doJump()
  }, [doJump])

  const onMove = useCallback((ev: React.PointerEvent) => {
    if (phaseRef.current !== 'play' || swipe.current.used) return
    const dx = ev.clientX - swipe.current.x
    const dy = ev.clientY - swipe.current.y
    if (dy > SWIPE_PX && dy > Math.abs(dx)) {
      // Down: dive. Cancels the jump this same gesture started — a swipe down
      // is unambiguously "get me to the floor", never "hop then drop".
      swipe.current.used = true
      held.current.active = false
      const e = eren.current
      e.diving = true
      // Grounded, this is a SLIDE with a timer; airborne it's a fast fall that
      // becomes the slide the moment he lands. Either way he's short.
      e.slideUntil = performance.now() + SLIDE_MS
      if (!e.grounded && e.vy < 0) e.vy = 0
      setPose('dive')
    } else if (dx > SWIPE_PX && dx > Math.abs(dy)) {
      swipe.current.used = true
      doDash()
    }
  }, [doDash])

  const onUp = useCallback(() => {
    held.current.active = false
  }, [])

  // ── The loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      if (!lastT.current) { lastT.current = now; return }
      // Clamped: a backgrounded tab returns with a huge delta, and an
      // unclamped one teleports Eren through the floor and into the tide.
      const dt = Math.min(0.05, (now - lastT.current) / 1000)
      lastT.current = now
      if (phaseRef.current !== 'play') return

      const w = world.current
      const e = eren.current
      const { upperY, cellarY, erenX, h } = dims.current
      const dashing = now < dash.current.until

      // Speed: ramps with time, boosted by a dash, cut while stumbling.
      w.t += dt
      const ramp = SPEED_0 + (SPEED_MAX - SPEED_0) * Math.min(1, w.t / SPEED_RAMP)
      if (stumble.current > 0) stumble.current -= dt
      w.speed = ramp * (dashing ? DASH_MULT : stumble.current > 0 ? 0.55 : 1)
      w.x += w.speed * dt

      // Tide: creeps in always, is clawed back by running clean, and lunges on
      // a hit. Dashing holds it off entirely.
      if (!dashing) {
        w.gap += (GAP_RECOVER * (stumble.current > 0 ? 0 : 1) - GAP_CREEP) * dt
        w.gap = Math.min(GAP_MAX, w.gap)
      }

      // ── Vertical ──
      if (held.current.active && now - held.current.at < HOLD_MS && e.vy < 0) {
        e.vy -= HOLD_ACC * dt
      }
      e.vy += GRAVITY * dt
      if (e.diving) e.vy += DIVE_ACC * dt
      e.y += e.vy * dt

      // A slide runs out on its own, so he can't crawl the whole level.
      if (e.diving && e.grounded && now > e.slideUntil) e.diving = false

      // Which floor is under him at this instant?
      const hereX = w.x + erenX          // Eren's world x = camera + his offset
      const idx = Math.floor(hereX / TILE)
      const col = cols.current.find(c => c.x === idx * TILE)
      const hasUpper = col ? col.upper : true
      /** Lowest his FEET may go while under the parlour floor. */
      const ceilFeet = upperY + FLOOR_H + H_RUN

      if (e.cellar) {
        // In the cellar. The upper slab is a CEILING here — the only way back
        // out is up through the next hole, which is what makes the cellar a
        // lane you have to escape rather than a safe corridor.
        if (e.y >= cellarY) {
          e.y = cellarY; e.vy = 0; e.grounded = true; e.doubled = false
        } else {
          e.grounded = false
        }
        if (!hasUpper && e.y <= upperY) {
          e.cellar = false            // climbed out through a hole
        } else if (hasUpper && e.y < ceilFeet) {
          // Bonked the underside. Feet clamp so his HEAD stays below the slab.
          e.y = ceilFeet
          if (e.vy < 0) e.vy = 0
        }
      } else {
        if (e.y >= upperY) {
          if (hasUpper) {
            e.y = upperY; e.vy = 0; e.grounded = true; e.doubled = false
          } else {
            e.cellar = true           // over a hole — drop into the cellar
            e.grounded = false
          }
        } else {
          e.grounded = false
        }
      }
      if (e.y > h + 80) { endRef.current(); return }

      const feetY = e.y
      const eH = e.diving ? H_SLIDE : H_RUN
      const headY = feetY - eH

      // ── Terrain recycling ──
      while (nextColX.current < w.x + dims.current.w + COLS_AHEAD * TILE) dealColumn()
      const cullX = w.x - TILE * 2
      if (cols.current.length > N_COL + 6) cols.current = cols.current.filter(c => c.x > cullX)
      if (obs.current.length > N_CRATE + N_PIPE + 6) obs.current = obs.current.filter(o => o.x > cullX && !o.dead)
      if (bead.current.length > N_BEAD + 8) bead.current = bead.current.filter(b => b.x > cullX && !b.taken)

      // ── Collisions ──
      const eL = hereX - EREN_W / 2, eR = hereX + EREN_W / 2
      for (const o of obs.current) {
        if (o.dead) continue
        if (o.cellar !== e.cellar) continue
        if (o.x + o.w < eL || o.x > eR) continue
        const base = o.cellar ? cellarY : upperY
        const oTop = o.kind === 'crate' ? base - o.h : base - PIPE_CLEAR - PIPE_H
        const oBot = o.kind === 'crate' ? base : base - PIPE_CLEAR
        if (feetY < oTop || headY > oBot) continue
        if (dashing) {
          // A dash goes THROUGH a crate. The pipe is plumbing, not cargo —
          // it survives, so dash can never be a blanket answer to everything.
          if (o.kind === 'crate') { o.dead = true; playSound('jl_combo'); continue }
        }
        o.dead = true
        stumble.current = 0.55
        w.gap -= GAP_HIT
        playSound('jl_miss')
        setPose('wobble')
        shout(o.kind === 'pipe' ? 'DUCK IT!' : 'OOF!')
        break
      }

      for (const b of bead.current) {
        if (b.taken) continue
        if (b.x + 16 < eL || b.x > eR + 4) continue
        if (Math.abs(b.y - (feetY - EREN_PX * 0.5)) > 34) continue
        b.taken = true
        beadsRef.current++
        powerRef.current = Math.min(100, powerRef.current + POWER_PER_BEAD)
        playSound('jl_bounce')
      }

      // ── Caught? ──
      if (w.gap <= 0) { endRef.current(); return }

      // ── Score ──
      const m = Math.floor(w.x / 12)
      if (m !== metresRef.current) {
        metresRef.current = m
        if (m > 0 && m % 250 === 0) { playSound('jl_high'); shout(`${m} M`) }
      }

      // ── Paint ──
      const camX = w.x
      for (let i = 0; i < N_COL; i++) {
        const c = cols.current[i]
        const el = colEls.current[i], ce = cellEls.current[i]
        if (!c) { if (el) el.style.display = 'none'; if (ce) ce.style.display = 'none'; continue }
        const sx = c.x - camX
        if (el) {
          el.style.display = c.upper ? 'block' : 'none'
          if (c.upper) el.style.transform = `translate3d(${sx.toFixed(1)}px, ${upperY}px, 0)`
        }
        if (ce) {
          ce.style.display = 'block'
          ce.style.transform = `translate3d(${sx.toFixed(1)}px, ${cellarY}px, 0)`
        }
      }
      // Two pools, one per kind. A single shared pool drew whatever art the
      // SLOT happened to hold, so a crate could render as a pipe — and the
      // player would duck a thing that was actually a jump.
      let ci = 0, pi = 0
      for (const o of obs.current) {
        if (o.dead) continue
        const crate = o.kind === 'crate'
        const el = crate ? crateEls.current[ci] : pipeEls.current[pi]
        if (crate) { if (ci >= N_CRATE) continue; ci++ } else { if (pi >= N_PIPE) continue; pi++ }
        if (!el) continue
        const base = o.cellar ? cellarY : upperY
        const oy = crate ? base - o.h : base - PIPE_CLEAR - PIPE_H
        el.style.display = 'block'
        el.style.transform = `translate3d(${(o.x - camX).toFixed(1)}px, ${oy}px, 0)`
      }
      for (let i = ci; i < N_CRATE; i++) { const el = crateEls.current[i]; if (el) el.style.display = 'none' }
      for (let i = pi; i < N_PIPE; i++) { const el = pipeEls.current[i]; if (el) el.style.display = 'none' }
      for (let i = 0; i < N_BEAD; i++) {
        const b = bead.current[i]
        const el = beadEls.current[i]
        if (!el) continue
        if (!b || b.taken) { el.style.display = 'none'; continue }
        el.style.display = 'block'
        el.style.transform = `translate3d(${(b.x - camX).toFixed(1)}px, ${b.y}px, 0)`
      }
      for (let i = 0; i < N_SHELF; i++) {
        const el = shelfEls.current[i]
        if (!el) continue
        // Parallax: the far wall slides at a third of the floor's rate.
        const span = 260
        const sx = ((i * span - camX * 0.33) % (span * N_SHELF) + span * N_SHELF) % (span * N_SHELF) - span
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${(upperY - 120).toFixed(0)}px, 0)`
      }
      if (erenEl.current) {
        erenEl.current.style.transform = `translate3d(${erenX - EREN_PX / 2}px, ${(feetY - EREN_PX).toFixed(1)}px, 0)`
      }
      if (tideEl.current) {
        tideEl.current.style.transform = `translate3d(${(erenX - w.gap - 300).toFixed(1)}px, 0, 0)`
      }

      // ── Pose ──
      stepT.current += dt
      const cadence = 0.5 - 0.2 * Math.min(1, w.t / SPEED_RAMP)
      if (stepT.current > cadence * 0.28) { stepT.current = 0; setStep(s => !s) }
      if (stumble.current <= 0) {
        const want: ErenPose = e.diving ? 'dive' : !e.grounded ? 'leap' : 'run'
        setPose(p => (p === want || p === 'wobble' ? p : want))
      }

      // HUD only when a number actually changed. Compared against a REF of the
      // last pushed value: this closure was built once, so `metres`/`beads`/
      // `power` from state are frozen at their mount values and every frame
      // would look like a change.
      if (m !== hud.current.m) { hud.current.m = m; setMetres(m) }
      if (beadsRef.current !== hud.current.b) { hud.current.b = beadsRef.current; setBeads(beadsRef.current) }
      if (powerRef.current !== hud.current.p) { hud.current.p = powerRef.current; setPower(powerRef.current) }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dealColumn, shout])

  // Stumbling clears back to running once the wobble is spent.
  useEffect(() => {
    if (pose !== 'wobble' || phase !== 'play') return
    const t = window.setTimeout(() => setPose('run'), 520)
    return () => window.clearTimeout(t)
  }, [pose, phase])

  useEffect(() => () => { if (bannerTimer.current) window.clearTimeout(bannerTimer.current) }, [])

  const full = power >= 100

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none" style={{ background: CREAM }}>
      <div ref={stageRef} className="absolute inset-0 overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>

        <BackWall upperY={layout.upperY || 320} />

        {/* Parallax shelving */}
        {Array.from({ length: N_SHELF }).map((_, i) => (
          <div key={`s${i}`} ref={el => { shelfEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, opacity: 0.55 }}>
            <WallShelf />
          </div>
        ))}

        {/* Floors */}
        {Array.from({ length: N_COL }).map((_, i) => (
          <div key={`c${i}`} ref={el => { colEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0 }}>
            <FloorTile w={TILE + 1} />
          </div>
        ))}
        {Array.from({ length: N_COL }).map((_, i) => (
          <div key={`k${i}`} ref={el => { cellEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0 }}>
            <CellarTile w={TILE + 1} />
          </div>
        ))}

        {/* Beads */}
        {Array.from({ length: N_BEAD }).map((_, i) => (
          <div key={`b${i}`} ref={el => { beadEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none' }}>
            <Bead size={16} color={BEAD_COLORS[i % BEAD_COLORS.length]} />
          </div>
        ))}

        {/* Obstacles */}
        {Array.from({ length: N_CRATE }).map((_, i) => (
          <div key={`cr${i}`} ref={el => { crateEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none' }}>
            <Crate w={30} h={30} />
          </div>
        ))}
        {Array.from({ length: N_PIPE }).map((_, i) => (
          <div key={`pp${i}`} ref={el => { pipeEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none' }}>
            <Pipe w={40} h={PIPE_H} />
          </div>
        ))}

        {/* Eren */}
        <div ref={erenEl} style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform', zIndex: 6 }}>
          <PixelEren pose={pose} size={EREN_PX} step={step} />
        </div>

        {/* The tide */}
        <div ref={tideEl} style={{ position: 'absolute', left: 0, top: 0, zIndex: 7, willChange: 'transform' }}>
          <Tide h={layout.h} />
        </div>
      </div>

      {/* ── HUD ── */}
      <div className="absolute inset-x-0 top-0 px-3 pointer-events-none"
        style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/jelly')}
            className="pointer-events-auto flex items-center justify-center active:translate-y-[1px]"
            style={{ width: 30, height: 30, background: 'rgba(58,31,43,0.8)', border: `2px solid ${INK}`, borderRadius: 6 }}>
            <ChevronLeft size={16} color={CREAM} />
          </button>
          <div className="flex-1" />
          <span className="font-pixel px-2 py-1.5" style={{
            fontSize: 9, color: CREAM, background: 'rgba(58,31,43,0.8)',
            border: `2px solid ${INK}`, borderRadius: 6,
          }}>{metres} M</span>
          <span className="font-pixel px-2 py-1.5 inline-flex items-center gap-1" style={{
            fontSize: 9, color: BRASS_LT, background: 'rgba(58,31,43,0.8)',
            border: `2px solid ${INK}`, borderRadius: 6,
          }}>
            <span style={{ width: 8, height: 8, background: BERRY, borderRadius: 2, display: 'inline-block' }} />
            {beads}
          </span>
        </div>

        {/* Power bar */}
        <div className="mt-2" style={{
          height: 12, background: 'rgba(58,31,43,0.8)', border: `2px solid ${INK}`, borderRadius: 4, overflow: 'hidden',
        }}>
          <div style={{
            width: `${power}%`, height: '100%',
            background: full ? `linear-gradient(90deg, ${LEAF}, ${BRASS})` : `linear-gradient(90deg, ${BERRY}, ${BRASS})`,
            transition: 'width 120ms linear',
          }} />
        </div>
      </div>

      {/* Dash button — the swipe is the real control, but a thumb on a phone
          wants a target too, and a full bar you cannot spend is a tease. */}
      {phase === 'play' && (
        <button onClick={doDash} disabled={!full}
          className="absolute font-pixel active:translate-y-[2px]"
          style={{
            right: 14, bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
            padding: '12px 14px', fontSize: 9, letterSpacing: 1,
            color: full ? '#3A1B02' : 'rgba(255,248,238,0.4)',
            background: full ? `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})` : 'rgba(58,31,43,0.7)',
            border: `2px solid ${INK}`, borderRadius: 6,
            boxShadow: full ? `0 3px 0 ${INK}` : 'none',
            opacity: full ? 1 : 0.75,
          }}>
          DASH
        </button>
      )}

      {banner && (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '22%' }}>
          <span className="font-pixel px-3 py-2" style={{
            fontSize: 11, color: CREAM, background: 'rgba(58,31,43,0.85)',
            border: `2px solid ${BRASS}`, borderRadius: 6,
            animation: reduced ? undefined : 'jrPop 300ms cubic-bezier(0.34,1.56,0.64,1)',
          }}>{banner}</span>
        </div>
      )}

      {/* ── Ready ── */}
      {phase === 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6"
          style={{ background: 'rgba(43,26,34,0.82)' }}>
          <p className="font-pixel mb-2" style={{ fontSize: 14, color: BRASS_LT, letterSpacing: 2 }}>JELLY RUN</p>
          <p className="text-center mb-5" style={{ fontSize: 11, color: CREAM, opacity: 0.8, lineHeight: 1.5 }}>
            The tide is right behind you.
          </p>
          <div className="flex flex-col gap-1.5 mb-6" style={{ fontSize: 10, color: CREAM, opacity: 0.75 }}>
            <span>TAP to jump — HOLD to jump higher</span>
            <span>TAP again in the air for a second jump</span>
            <span>SWIPE DOWN to dive under the pipes</span>
            <span>SWIPE RIGHT on a full bar to DASH</span>
          </div>
          <button onClick={start} className="font-pixel active:translate-y-[2px]" style={{
            padding: '14px 26px', fontSize: 11, letterSpacing: 1.5, color: '#3A1B02',
            background: `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})`,
            border: `2px solid ${INK}`, borderRadius: 8, boxShadow: `0 4px 0 ${INK}`,
          }}>
            RUN
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'over' && result && (
        <JellyPrize
          score={metres} best={Math.max(duel.best, metres)} isBest={result.isBest}
          unit="M" threshold={THRESHOLD} duel={result.duel} wins={wins} awardFailed={awardFailed}
          trayCount={jellies.trayCount} traySize={jellies.traySize}
          onPlayAgain={start}
          onExit={() => router.push('/jelly')}
        />
      )}

      <style jsx global>{`
        @keyframes jrPop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
