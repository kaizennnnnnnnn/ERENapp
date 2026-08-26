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
//   GLIDER           keep holding past the apex and a canopy opens. It replaced
//                    the double jump, and it is a better mid-air save: a double
//                    jump is one instant you either time right or don't, a
//                    glide is a control you steer a whole descent with.
//   DIVE             swipe down. Slams the canopy shut and drops fast, and it
//                    is the ONLY way under a hanging pipe — so down is a real
//                    input, not a fidget.
//   GAPS             holes in the parlour floor, over the vat. Every one is
//                    dealt narrow enough to clear with a PLAIN TAP at the speed
//                    you will be moving when you reach it, so a gap you can see
//                    is a gap you can make. Miss it and that is the run.
//
//                    There used to be a second walkable storey down there and
//                    falling in was a detour rather than a death. It came out:
//                    escaping it needed 198px of climb, which is the only
//                    reason the jump was ever 224px tall, and a player who
//                    misjudged the climb was simply stuck in a lane with no
//                    exit. Both of those are the same bug wearing two hats.
//   BEADS -> POWER   collecting charges a bar. Full bar = DASH.
//   DASH             double-tap (or the button): invincible, smashes anything
//                    standing on the floor, and shoves the tide back. It is the
//                    ONLY thing that buys ground back, which is what makes the
//                    bead-collecting loop matter.
//   TWO HAZARDS      crates and pipes COST you — a stumble and a lunge from the
//                    tide. A lit burner KILLS. Everything that merely slows you
//                    is wood or brass; the lethal is the only orange thing on
//                    screen, because colour is read faster than shape.
//   BEADS ON PATHS   every bead sits on a line he can actually travel, so a
//                    string of them is always collectable in full by one move —
//                    usually the move he was already making. Arcs over the
//                    things you jump are sampled from the real parabola.
//   THE TIDE         a wall of jelly on your heels that NEVER stops gaining.
//                    Running cleanly buys time, never ground.
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
  BackWall, WallShelf, CeilingLamp, FloorTile, Crate, Pipe, Burner, Glider, Tide, Bead,
  TILE,
} from '@/components/jelly/RunScenery'
import PixelEren, { type ErenPose } from '@/components/games/PixelEren'
import { playSound } from '@/lib/sounds'
import { INK, CREAM, BERRY, BRASS, BRASS_LT, LEAF, WOOD } from '@/components/jelly/parlourTheme'

// ─── Tuning ────────────────────────────────────────────────────────────────
const GRAVITY = 2600          // px/s²
/**
 * Jump — sized to clear ONE obstacle, and nothing grander.
 *
 * It used to reach 224px, which is seven times the height of the crate it was
 * clearing. That was not a taste call gone wrong: the lower lane needed
 * FLOOR_H + H_RUN + its own depth of climb to escape, and the jump was carrying
 * that. The lane is gone (see the file header), so the jump is free to be what
 * a runner's jump should be — a hop with a definite top to it.
 *
 * A tap now peaks at JUMP_V²/(2·GRAVITY) ≈ 60px: a 30px crate cleared with
 * about its own height again in daylight. Holding stretches that to ~102px for
 * the wider gaps, and the glider does the rest.
 */
const JUMP_V = 560            // px/s off the floor — apex ≈ 60px
const HOLD_ACC = 1400         // px/s² of extra lift while the tap is held...
const HOLD_MS = 170           // ...for at most this long (held apex ≈ 102px)
/**
 * The glider.
 *
 * Keep holding after the apex and a canopy opens: the fall is capped at a
 * crawl for as long as you hold it. It replaces the double jump as the mid-air
 * save, and it is a better one — a double jump is a single instant you either
 * time right or don't, a glide is a control you steer a whole descent with.
 * Release to close it, swipe down to slam it shut and drop.
 */
const GLIDE_V = 118           // px/s terminal fall under the canopy
const DIVE_ACC = 3600         // px/s² added while diving
const SPEED_0 = 250           // px/s at the gun
const SPEED_MAX = 560
const SPEED_RAMP = 78         // seconds to reach SPEED_MAX
/** Two taps inside this window are a DASH, not two jumps. */
const DOUBLE_TAP_MS = 280
/**
 * How long after a press a downward swipe may still take back its jump.
 *
 * Long enough to cover an ordinary thumb flick, short enough that it can never
 * cancel a jump you meant — by 130ms a deliberate jump is already at two thirds
 * of its apex and the player has visibly committed.
 */
const SWIPE_GRACE = 130
/**
 * The two forgivenesses every platformer needs, and this one needed most.
 *
 * COYOTE: you may still jump for a moment after walking off a lip. Without it
 * the honest input "jump at the edge" loses to one frame of arithmetic.
 * BUFFER: a jump pressed just before landing is remembered and fires on
 * touchdown, instead of being dropped for not being grounded yet.
 *
 * Neither makes anything possible that was not already meant to be — they only
 * stop the game refusing inputs the player did make.
 */
const COYOTE_MS = 90
const JUMP_BUFFER_MS = 130

/**
 * The jump, as the terrain generator needs to know it.
 *
 * Every gap in the floor is sized against these, so a gap you can see is a gap
 * you can clear. They are derived, never typed in twice — retuning the jump
 * retunes the map with it, and the two can never drift apart.
 */
const TAP_AIR = (2 * JUMP_V) / GRAVITY            // seconds airborne on a tap
const TAP_APEX = (JUMP_V * JUMP_V) / (2 * GRAVITY) // px it peaks at
/**
 * Fraction of a tap-jump's reach a gap is allowed to be.
 *
 * Well under 1 on purpose: the reach assumes he leaves at the last possible
 * pixel and lands on the first, which nobody does. This is the margin that
 * turns "technically possible" into "possible while also reading the next
 * thing coming".
 */
const GAP_SAFETY = 0.62

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
 * How tall a thing standing on the floor is allowed to be.
 *
 * Derived from the jump, like the gaps are, and for the same reason. The burner
 * was 46px against a 60px apex, which left a takeoff window of about 25px —
 * jump a hair late and you clip a LETHAL you were clearly trying to clear. An
 * obstacle you cannot comfortably hop is not an obstacle, it is a wall.
 *
 * At 62% of the apex he is above the obstacle for roughly a quarter of a
 * second, which at running speed is a takeoff window several times the
 * obstacle's own width.
 */
const MAX_OB_H = Math.round(TAP_APEX * 0.62)
const CRATE_W = 30
const CRATE_H = Math.min(30, MAX_OB_H)
/** The lethal burner. Still the tallest thing on the ground — but jumpable. */
const BURNER_W = 32
const BURNER_H = MAX_OB_H


/**
 * Gap the tide sits behind Eren, in px. Hit zero and it has you.
 *
 * The tide ALWAYS gains. There is no passive recovery: running cleanly buys
 * you time, never ground. That is the whole shape of the game — the jelly is
 * always coming, beads charge the bar, and the DASH is the one thing that
 * shoves it back. Collect, spend, survive.
 *
 * Creep is deliberately gentle now. It was 17px/s ramping every 70s, which ate
 * the last 100px — the stretch where the tide is actually ON SCREEN and you can
 * see it — in about six seconds, so the moment it appeared it was already over.
 * At 11px/s that same stretch is nine seconds of visible, answerable pressure,
 * and the ramp is slower behind it.
 */
const GAP_0 = 250
const GAP_MAX = 300
const GAP_CREEP = 11          // px/s it gains at the gun...
const GAP_CREEP_RAMP = 95     // ...doubling every this many seconds
const GAP_HIT = 50            // ...and all at once when a crate or pipe clips you
const GAP_DASH = 150          // ...and what a dash shoves back

const POWER_PER_BEAD = 9
/** Short and sharp. At 1.5s the dash outlasted the moment it was answering. */
const DASH_MS = 900
const DASH_MULT = 1.6

/** A run's terrain is dealt in columns of TILE px. */
const COLS_AHEAD = 26
const SWIPE_PX = 34           // finger travel that counts as a swipe

const THRESHOLD = 220         // metres that earn a jelly

const BEAD_COLORS = ['#F472B6', '#FBBF24', '#5BE81E', '#60A5FA', '#C084FC']

/**
 * The dash's speed lines, authored rather than random.
 *
 * Evenly spaced streaks read as a curtain and hide the world behind them;
 * these are clustered off-centre and staggered so the middle of the screen —
 * where the next hazard is arriving — stays legible while you are dashing.
 */
const DASH_STREAKS = [
  { top: 8, w: 130, h: 4, dur: 300, delay: 0 },
  { top: 21, w: 84, h: 3, dur: 360, delay: 90 },
  { top: 34, w: 160, h: 5, dur: 280, delay: 40 },
  { top: 47, w: 104, h: 3, dur: 320, delay: 210 },
  { top: 58, w: 112, h: 3, dur: 340, delay: 150 },
  { top: 71, w: 146, h: 5, dur: 300, delay: 60 },
  { top: 84, w: 92, h: 3, dur: 380, delay: 200 },
]

// ─── Terrain ───────────────────────────────────────────────────────────────

interface Col {
  /** World x of the column's left edge. */
  x: number
  /** Is there floor here, or is this a gap over the drop? */
  solid: boolean
}

/**
 * Two classes of hazard, and the difference is the point.
 *
 * `crate` and `pipe` COST you — a stumble and a lunge from the tide. `burner`
 * KILLS. A runner where every mistake is survivable has no moment your pulse
 * changes; one where every mistake is fatal is exhausting. Having both means
 * the player reads each obstacle and decides how much it matters.
 */
type ObKind = 'crate' | 'pipe' | 'burner'

const LETHAL: Record<ObKind, boolean> = { crate: false, pipe: false, burner: true }

interface Ob {
  x: number
  kind: ObKind
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
const N_BURNER = 5
const N_BEAD = 34
/**
 * Three background bands, each on its own parallax rate.
 *
 * On a tall phone the parlour floor lands around two-thirds down and the whole
 * space above it was flat wall — the single biggest reason the room read as
 * unfinished. The bands fill it with the shop rather than with noise, and each
 * one is washed further toward the wall colour so depth is unambiguous.
 */
const N_SHELF = 4
const N_SHELF_FAR = 4
const N_LAMP = 4

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
  /** Drives the dash FX layer. Event-driven — never touched by the loop. */
  const [dashOn, setDashOn] = useState(false)
  /** Canopy out. Only flips on a transition, so it costs one render a glide. */
  const [gliding, setGliding] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [wins, setWins] = useState<JellyWin[]>([])
  const [awardFailed, setAwardFailed] = useState(false)
  const [result, setResult] = useState<{ isBest: boolean; duel: DuelLine } | null>(null)

  // ── Stage ────────────────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement>(null)
  const dims = useRef({ w: 360, h: 620, floorY: 0, erenX: 0 })
  const [layout, setLayout] = useState({ floorY: 0, h: 620 })

  // ── Entities (never state — the loop owns these) ─────────────────────────
  const cols = useRef<Col[]>([])
  const obs = useRef<Ob[]>([])
  const bead = useRef<BeadEnt[]>([])
  const nextColX = useRef(0)
  /** One bead arc per gap, not one per column of it. */
  const holeArcDone = useRef(false)
  /** Columns still owed to the current terrain feature. */
  const run = useRef({ kind: 'flat' as 'flat' | 'hole' | 'crates', left: 0 })

  const eren = useRef({ y: 0, vy: 0, grounded: true, gliding: false, diving: false, slideUntil: 0 })
  const world = useRef({ x: 0, speed: SPEED_0, gap: GAP_0, t: 0 })
  const dash = useRef({ until: 0 })
  const stumble = useRef(0)
  const held = useRef<{ at: number; active: boolean }>({ at: 0, active: false })
  const swipe = useRef({ x: 0, y: 0, used: false })
  /** When the last pointerdown landed, so a second one can be read as a dash. */
  const lastTap = useRef(0)
  /** When the current jump left the floor, so a swipe can un-jump it. */
  const jumpedAt = useRef(0)
  /** Latest moment a jump is still allowed after walking off a lip. */
  const coyoteUntil = useRef(0)
  /** A jump pressed mid-air, waiting for the landing that can spend it. */
  const bufferUntil = useRef(0)

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
  const crateEls = useRef<(HTMLDivElement | null)[]>([])
  const pipeEls = useRef<(HTMLDivElement | null)[]>([])
  const burnerEls = useRef<(HTMLDivElement | null)[]>([])
  const beadEls = useRef<(HTMLDivElement | null)[]>([])
  const shelfEls = useRef<(HTMLDivElement | null)[]>([])
  const shelfFarEls = useRef<(HTMLDivElement | null)[]>([])
  const lampEls = useRef<(HTMLDivElement | null)[]>([])
  const erenEl = useRef<HTMLDivElement>(null)
  const ghostEl = useRef<HTMLDivElement>(null)
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
    // One floor. It sits low enough that the drop beneath it reads as a real
    // fall rather than a step, and high enough to leave the jump arc room —
    // which is now only ~102px at its most generous.
    const floorY = Math.round(h * 0.70)
    dims.current = { w, h, floorY, erenX: Math.round(w * 0.26) }
    // The backdrop is React-rendered, so the split has to reach state — a ref
    // alone leaves the wall painted at the pre-measure guess forever.
    setLayout({ floorY, h })
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
    const { floorY } = dims.current
    // Difficulty: holes and crate rows get more common and longer with time.
    const heat = Math.min(1, t / 70)

    /**
     * How fast he will be moving when he ARRIVES here, not how fast he is now.
     *
     * Columns are dealt around 1500px ahead, which is several seconds of run —
     * long enough for the speed ramp to have moved on. Sizing a gap against the
     * current speed deals a gap that was fair when it was written and is not by
     * the time it is reached. Estimating the arrival time first is what keeps
     * the guarantee honest.
     */
    const lead = Math.max(0, x - world.current.x - dims.current.erenX)
    const tArrive = t + lead / Math.max(1, world.current.speed)
    const speedHere = SPEED_0 + (SPEED_MAX - SPEED_0) * Math.min(1, tArrive / SPEED_RAMP)
    /**
     * The widest gap a PLAIN TAP clears here, in whole columns.
     *
     * This is the promise the whole map rests on: every gap is jumpable with
     * the simplest input available, at the speed you will actually meet it, and
     * without needing the hold or the glider. Those are for style and for
     * saving yourself, never for passage.
     */
    const maxGap = Math.max(1, Math.floor((speedHere * TAP_AIR * GAP_SAFETY) / TILE))

    if (run.current.left <= 0) {
      const r = Math.random()
      // A hazard is always followed by flat ground. Not politeness — a runner
      // is a reading game, and back-to-back features give you nothing to read
      // the second one in.
      if (run.current.kind !== 'flat') {
        // The rest has to be LONGER THAN A JUMP. Two columns of flat is 88px,
        // and a jump carries 108px at the gun and 240px at full speed — so a
        // crate followed by a gap put the gap under him while he was still in
        // the air from the crate, with the tap that would have saved him
        // swallowed for not being grounded. Every fall in testing traced back
        // here. Derived from the same reach the gaps are, so they stay in step.
        const restCols = Math.ceil((speedHere * TAP_AIR) / TILE) + 1
        run.current = { kind: 'flat', left: restCols + Math.floor(Math.random() * 2) }
      } else if (r < 0.24 + heat * 0.12) {
        run.current = { kind: 'hole', left: Math.min(maxGap, 1 + (Math.random() < 0.35 + heat * 0.4 ? 1 : 0)) }
      } else if (r < 0.52 + heat * 0.14) {
        run.current = { kind: 'crates', left: 1 + (Math.random() < heat * 0.5 ? 1 : 0) }
      } else {
        run.current = { kind: 'flat', left: 2 + Math.floor(Math.random() * 3) }
      }
    }
    const feature = run.current.kind
    run.current.left--

    const solid = feature !== 'hole'
    cols.current.push({ x, solid })

    // ONE hazard per column at most. Stacking a burner behind a crate reads as
    // a single blurred shape at 500px/s, and the two ask for opposite things.
    let hazard: ObKind | null = null
    let hazardX = 0
    if (feature === 'crates' && solid) {
      hazard = 'crate'
      hazardX = x + TILE * 0.28
      obs.current.push({ x: hazardX, kind: 'crate', dead: false, w: CRATE_W, h: CRATE_H })
    } else if (feature === 'flat' && solid && x > TILE * 8) {
      // The opening columns stay clear of both: a runner that kills you before
      // you have found the controls is not difficult, it is rude.
      const r = Math.random()
      const burnerOdds = 0.055 + heat * 0.085
      const pipeOdds = 0.10 + heat * 0.10
      if (r < burnerOdds) {
        hazard = 'burner'
        hazardX = x + (TILE - BURNER_W) / 2
        obs.current.push({ x: hazardX, kind: 'burner', dead: false, w: BURNER_W, h: BURNER_H })
      } else if (r < burnerOdds + pipeOdds) {
        // A hanging pipe over open floor — the dive gate. Never over a hole,
        // where it would ask for a dive and a jump in the same step.
        hazard = 'pipe'
        hazardX = x + TILE * 0.2
        obs.current.push({ x: hazardX, kind: 'pipe', dead: false, w: 40, h: 18 })
      }
    }

    // ── Beads ────────────────────────────────────────────────────────────
    //
    // Every bead sits on a path he can actually travel, so a line of them is
    // always collectable in full by one move. They used to be dropped at a
    // "low" or "high" row picked at random, which meant a high row over open
    // floor asked for a jump that gained nothing, and a row could be strung
    // across a jump he had no reason to make — half of them uncollectable in
    // practice.
    //
    // The three placements below are the only three paths he has: standing,
    // jumping something, and crossing a gap. Nothing is ever put anywhere else.
    const arc = (fromX: number, span: number, n: number) => {
      // The parabola of the tap-jump that clears `span` px, apex centred on it.
      // Sampling the real trajectory is what makes the line collectable in one
      // move rather than merely near one.
      const air = TAP_AIR
      const v0 = JUMP_V
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n                       // 0..1 along the arc
        const tt = f * air
        const rise = v0 * tt - 0.5 * GRAVITY * tt * tt
        bead.current.push({
          x: fromX + f * span,
          // The pickup test compares against his CENTRE, so the arc is written
          // in centre-height and the bead's own box is offset off it.
          y: floorY - rise - EREN_PX * 0.5 - 8,
          taken: false,
        })
      }
    }

    if (feature === 'hole') {
      // Only the FIRST column of a gap lays the arc; the flag is cleared by
      // the next solid column. Otherwise a two-column gap gets two overlapping
      // strings of beads across the same jump.
      if (!holeArcDone.current) {
        holeArcDone.current = true
        const span = speedHere * TAP_AIR
        arc(x - span * 0.28, span, 5)
      }
    } else {
      holeArcDone.current = false
      if (hazard === 'crate') {
        // Strung over the crate he already has to jump. This is the one the
        // whole rule exists for: the pickup is ON the move he was making.
        const span = speedHere * TAP_AIR
        arc(hazardX + CRATE_W / 2 - span * 0.5, span, 5)
      } else if (hazard === 'burner') {
        // Apex dead-centre over it, exactly like the crate. Offsetting it by a
        // few percent pulled the arc's first low bead to within a stride of a
        // LETHAL — close enough that taking it left no room to take off. The
        // whole point of laying beads on the trajectory is that following them
        // IS the correct move; nudging the arc off the jump breaks that.
        const span = speedHere * TAP_AIR
        arc(hazardX + BURNER_W / 2 - span * 0.5, span, 5)
      } else if (hazard === null && Math.random() < 0.5) {
        // Open floor: a level line at running height, taken by doing nothing.
        for (let i = 0; i < 3; i++) {
          bead.current.push({ x: x + 6 + i * 14, y: floorY - EREN_PX * 0.5 - 8, taken: false })
        }
      }
    }

    nextColX.current += TILE
  }, [])

  // ── Paint ────────────────────────────────────────────────────────────────
  /**
   * Writes the world to the pooled DOM.
   *
   * Pure geometry read out of the refs — it advances nothing — so the READY
   * screen can call it once. Without that, none of the pooled nodes has a
   * transform yet and the entire world sits stacked in the top-left corner
   * until the first frame runs.
   */
  const paint = useCallback(() => {
    const { floorY, erenX } = dims.current
    const camX = world.current.x
    const feetY = eren.current.y

    for (let i = 0; i < N_COL; i++) {
      const c = cols.current[i]
      const el = colEls.current[i]
      if (!el) continue
      if (!c || !c.solid) { el.style.display = 'none'; continue }
      el.style.display = 'block'
      el.style.transform = `translate3d(${(c.x - camX).toFixed(1)}px, ${floorY}px, 0)`
    }
    // One pool PER KIND. A single shared pool drew whatever art the SLOT
    // happened to hold, so a crate could render as a pipe — and the player
    // would duck a thing that was actually a jump. With a lethal in the mix
    // that class of bug stops being a nuisance and starts ending runs.
    let ci = 0, pi = 0, bi = 0
    for (const o of obs.current) {
      if (o.dead) continue
      let el: HTMLDivElement | null = null
      if (o.kind === 'crate') { if (ci >= N_CRATE) continue; el = crateEls.current[ci++] }
      else if (o.kind === 'pipe') { if (pi >= N_PIPE) continue; el = pipeEls.current[pi++] }
      else { if (bi >= N_BURNER) continue; el = burnerEls.current[bi++] }
      if (!el) continue
      const oy = o.kind === 'pipe' ? floorY - PIPE_CLEAR - PIPE_H : floorY - o.h
      el.style.display = 'block'
      el.style.transform = `translate3d(${(o.x - camX).toFixed(1)}px, ${oy}px, 0)`
    }
    for (let i = ci; i < N_CRATE; i++) { const el = crateEls.current[i]; if (el) el.style.display = 'none' }
    for (let i = pi; i < N_PIPE; i++) { const el = pipeEls.current[i]; if (el) el.style.display = 'none' }
    for (let i = bi; i < N_BURNER; i++) { const el = burnerEls.current[i]; if (el) el.style.display = 'none' }
    for (let i = 0; i < N_BEAD; i++) {
      const b = bead.current[i]
      const el = beadEls.current[i]
      if (!el) continue
      if (!b || b.taken) { el.style.display = 'none'; continue }
      el.style.display = 'block'
      el.style.transform = `translate3d(${(b.x - camX).toFixed(1)}px, ${b.y}px, 0)`
    }
    // Parallax bands. Each is a fixed ring of nodes wrapped around a span, so
    // the further back a band is the slower it slides — the only depth cue a
    // flat side-on runner has, and the one that stops the wall reading as a
    // sticker glued to the camera.
    const band = (
      els: (HTMLDivElement | null)[], n: number, span: number, rate: number, y: number,
    ) => {
      const loop = span * n
      for (let i = 0; i < n; i++) {
        const el = els[i]
        if (!el) continue
        const sx = ((i * span - camX * rate) % loop + loop) % loop - span
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${y.toFixed(0)}px, 0)`
      }
    }
    band(lampEls.current, N_LAMP, 210, 0.16, 30)
    band(shelfFarEls.current, N_SHELF_FAR, 300, 0.22, Math.max(58, floorY - 232))
    band(shelfEls.current, N_SHELF, 260, 0.33, floorY - 120)
    const erenT = `translate3d(${erenX - EREN_PX / 2}px, ${(feetY - EREN_PX).toFixed(1)}px, 0)`
    if (erenEl.current) erenEl.current.style.transform = erenT
    // The trail rides exactly where he is; its stamps carry their own offsets.
    if (ghostEl.current) ghostEl.current.style.transform = erenT
    if (tideEl.current) {
      tideEl.current.style.transform = `translate3d(${(erenX - world.current.gap - 300).toFixed(1)}px, 0, 0)`
    }
  }, [])

  // ── Seed ─────────────────────────────────────────────────────────────────
  /** Puts the world back at the starting line. Shared by READY and by start. */
  const seed = useCallback(() => {
    const { floorY } = dims.current
    cols.current = []
    obs.current = []
    bead.current = []
    nextColX.current = 0
    run.current = { kind: 'flat', left: 6 }   // a clear runway to begin on
    holeArcDone.current = false
    world.current = { x: 0, speed: SPEED_0, gap: GAP_0, t: 0 }
    eren.current = { y: floorY, vy: 0, grounded: true, gliding: false, diving: false, slideUntil: 0 }
    hud.current = { m: -1, b: -1, p: -1 }
    dash.current = { until: 0 }
    held.current = { at: 0, active: false }
    lastTap.current = 0
    stumble.current = 0
    metresRef.current = 0
    beadsRef.current = 0
    powerRef.current = 0
    lastT.current = 0
    stepT.current = 0
    for (let i = 0; i < COLS_AHEAD + 2; i++) dealColumn()
  }, [dealColumn])

  /**
   * The READY screen's backdrop: a real, still parlour rather than a pile of
   * tiles at the origin. Re-runs on resize, since `layout` changing is the
   * signal that `measure` moved the floors.
   */
  useEffect(() => {
    if (phase !== 'ready') return
    seed()
    paint()
  }, [phase, layout, seed, paint])

  // ── Start ────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    measure()
    seed()
    savedRef.current = false
    setMetres(0); setBeads(0); setPower(0)
    setResult(null); setWins([]); setAwardFailed(false); setBanner(null)
    setPose('run')
    phaseRef.current = 'play'
    setPhase('play')
  }, [measure, seed])

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
  /** The loop fires buffered jumps, and is built before doJump exists. */
  const jumpRef = useRef<() => boolean>(() => false)

  // ── Input ────────────────────────────────────────────────────────────────
  //
  // One thumb, four moves:
  //   tap          jump (grounded only — there is no second jump any more)
  //   keep holding climb higher, then the glider opens on the way down
  //   tap twice    DASH
  //   swipe down   dive: slam the glider shut and hit the floor, or slide
  const doJump = useCallback((): boolean => {
    const e = eren.current
    const now = performance.now()
    if (!e.grounded && now > coyoteUntil.current) {
      // Can't go yet — remember it and let the landing spend it.
      bufferUntil.current = now + JUMP_BUFFER_MS
      return false
    }
    coyoteUntil.current = 0
    bufferUntil.current = 0
    e.slideUntil = 0
    e.vy = -JUMP_V
    e.grounded = false
    e.diving = false
    e.gliding = false
    // Remembered so a swipe can take it back — see SWIPE_GRACE.
    jumpedAt.current = now
    playSound('jl_bounce')
    setPose('leap')
    return true
  }, [])

  /** Returns whether it actually fired, so the caller knows if the tap was spent. */
  const doDash = useCallback((): boolean => {
    if (powerRef.current < 100 || phaseRef.current !== 'play') return false
    powerRef.current = 0
    setPower(0)
    dash.current.until = performance.now() + DASH_MS
    // The dash is the ONLY thing that buys ground back from the tide.
    world.current.gap = Math.min(GAP_MAX, world.current.gap + GAP_DASH)
    eren.current.gliding = false
    setDashOn(true)
    setPose('dash')
    playSound('jl_combo')
    shout('DASH!')
    return true
  }, [shout])

  // The FX layer is mounted on an event, not per frame, so it needs its own
  // timer to come back down.
  useEffect(() => {
    if (!dashOn) return
    const t = window.setTimeout(() => setDashOn(false), DASH_MS)
    return () => window.clearTimeout(t)
  }, [dashOn])

  useEffect(() => { jumpRef.current = doJump }, [doJump])

  const onDown = useCallback((ev: React.PointerEvent) => {
    if (phaseRef.current !== 'play') return
    swipe.current = { x: ev.clientX, y: ev.clientY, used: false }
    const now = performance.now()
    // Hold is armed on EVERY press, not just the one that jumps: holding is
    // what opens the glider, and you can open it without having jumped.
    held.current = { at: now, active: true }
    // Only a dash that actually FIRES consumes the tap. With an empty bar a
    // quick second tap has to fall through and behave like any other tap —
    // otherwise landing and immediately jumping again silently eats the jump,
    // which feels exactly like the controls dropping an input.
    if (now - lastTap.current < DOUBLE_TAP_MS && doDash()) {
      lastTap.current = 0
      return
    }
    lastTap.current = now
    doJump()
  }, [doJump, doDash])

  const onMove = useCallback((ev: React.PointerEvent) => {
    if (phaseRef.current !== 'play' || swipe.current.used) return
    const dx = ev.clientX - swipe.current.x
    const dy = ev.clientY - swipe.current.y
    if (dy > SWIPE_PX && dy > Math.abs(dx)) {
      // Down: dive.
      swipe.current.used = true
      held.current.active = false
      const e = eren.current
      /**
       * PUT THE JUMP BACK.
       *
       * A swipe begins with a pointerdown, and pointerdown jumps — it has to,
       * because a runner cannot afford to wait and see whether a press becomes
       * a gesture. So every swipe down was silently launching him first, and
       * "duck" turned into "hop, then slam": he arrived at the pipe airborne,
       * at head height, holding a short hitbox that was never going to help.
       * It was the single commonest death in testing.
       *
       * Inside the grace window the press is reclassified as a swipe and the
       * jump is undone — he is put back on the floor he left. Only over solid
       * ground: undoing a jump that was carrying him across a gap would stand
       * him on nothing.
       */
      const sinceDown = performance.now() - jumpedAt.current
      if (sinceDown < SWIPE_GRACE) {
        const { floorY, erenX } = dims.current
        const idx = Math.floor((world.current.x + erenX) / TILE)
        const under = cols.current.find(c => c.x === idx * TILE)
        if (!under || under.solid) {
          e.y = floorY
          e.vy = 0
          e.grounded = true
        }
      }
      e.diving = true
      e.gliding = false
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
    eren.current.gliding = false
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
      const { floorY, erenX, h } = dims.current
      const dashing = now < dash.current.until

      // Speed: ramps with time, boosted by a dash, cut while stumbling.
      w.t += dt
      const ramp = SPEED_0 + (SPEED_MAX - SPEED_0) * Math.min(1, w.t / SPEED_RAMP)
      if (stumble.current > 0) stumble.current -= dt
      w.speed = ramp * (dashing ? DASH_MULT : stumble.current > 0 ? 0.55 : 1)
      w.x += w.speed * dt

      // Tide: creeps in always, is clawed back by running clean, and lunges on
      // a hit. Dashing holds it off entirely.
      // The tide only ever gains. Dashing is the one thing that holds it, and
      // the gap it bought is spent from the moment the dash ends.
      if (!dashing) {
        w.gap -= GAP_CREEP * (1 + w.t / GAP_CREEP_RAMP) * dt
      }

      // ── Vertical ──
      if (held.current.active && now - held.current.at < HOLD_MS && e.vy < 0) {
        e.vy -= HOLD_ACC * dt
      }
      e.vy += GRAVITY * dt
      if (e.diving) e.vy += DIVE_ACC * dt
      // The glider: hold past the apex and the canopy catches him. Checked
      // AFTER gravity so it clamps the speed gravity just produced, and gated
      // on falling so it can never be used to hang at the top of a rise.
      const wantGlide = held.current.active && !e.grounded && !e.diving && !dashing && e.vy > 0
      e.gliding = wantGlide
      if (wantGlide && e.vy > GLIDE_V) e.vy = GLIDE_V
      const prevY = e.y
      e.y += e.vy * dt

      // A slide runs out on its own, so he can't crawl the whole level.
      if (e.diving && e.grounded && now > e.slideUntil) e.diving = false

      // Is there floor under him at this instant?
      const hereX = w.x + erenX          // Eren's world x = camera + his offset
      const idx = Math.floor(hereX / TILE)
      const col = cols.current.find(c => c.x === idx * TILE)
      const solid = col ? col.solid : true

      // Landing is a CROSSING of the floor line, not simply being at or below
      // it. Testing position alone teleports him back up the moment solid
      // ground scrolls over his head after he has already dropped past it.
      if (solid && prevY <= floorY && e.y >= floorY) {
        e.y = floorY; e.vy = 0; e.grounded = true
        // Spend a jump that was pressed a moment too early.
        if (now < bufferUntil.current) { bufferUntil.current = 0; jumpRef.current() }
      } else if (e.grounded && !solid) {
        e.grounded = false             // ran off the lip of a gap
        coyoteUntil.current = now + COYOTE_MS
      } else if (e.y < floorY || !solid) {
        e.grounded = false
      }
      // Down the hole. There is no lower lane to catch him any more — the gap
      // is the hazard, and every gap is dealt narrow enough to clear with a
      // plain tap at the speed he meets it (see GAP_SAFETY).
      if (e.y > h + 40) { endRef.current(); return }

      const feetY = e.y
      const eH = e.diving ? H_SLIDE : H_RUN
      const headY = feetY - eH

      // ── Terrain recycling ──
      while (nextColX.current < w.x + dims.current.w + COLS_AHEAD * TILE) dealColumn()
      const cullX = w.x - TILE * 2
      if (cols.current.length > N_COL + 6) cols.current = cols.current.filter(c => c.x > cullX)
      if (obs.current.length > N_CRATE + N_PIPE + N_BURNER + 6) obs.current = obs.current.filter(o => o.x > cullX && !o.dead)
      if (bead.current.length > N_BEAD + 8) bead.current = bead.current.filter(b => b.x > cullX && !b.taken)

      // ── Collisions ──
      const eL = hereX - EREN_W / 2, eR = hereX + EREN_W / 2
      for (const o of obs.current) {
        if (o.dead) continue
        if (o.x + o.w < eL || o.x > eR) continue
        const hanging = o.kind === 'pipe'
        const oTop = hanging ? floorY - PIPE_CLEAR - PIPE_H : floorY - o.h
        const oBot = hanging ? floorY - PIPE_CLEAR : floorY
        if (feetY < oTop || headY > oBot) continue
        if (dashing) {
          // A dash goes THROUGH anything standing on the floor — that is what
          // makes it the comeback move, and it is the only way past a burner
          // other than jumping. The pipe is plumbing, not cargo: it survives,
          // so a dash can never be a blanket answer to everything.
          if (!hanging) { o.dead = true; playSound('jl_combo'); continue }
        }
        if (LETHAL[o.kind]) {
          // No stumble, no lunge, no shout. It ends.
          setPose('wobble')
          playSound('jl_miss')
          endRef.current()
          return
        }
        o.dead = true
        stumble.current = 0.55
        w.gap -= GAP_HIT
        playSound('jl_miss')
        setPose('wobble')
        shout(hanging ? 'DUCK IT!' : 'OOF!')
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
      paint()

      // ── Pose ──
      stepT.current += dt
      const cadence = 0.5 - 0.2 * Math.min(1, w.t / SPEED_RAMP)
      if (stepT.current > cadence * 0.28) { stepT.current = 0; setStep(s => !s) }
      if (stumble.current <= 0) {
        const want: ErenPose = dashing ? 'dash'
          : e.diving ? 'dive'
            : e.gliding ? 'glide'
              : !e.grounded ? 'leap' : 'run'
        setPose(p => (p === want || p === 'wobble' ? p : want))
      }
      // The canopy is a mounted element, so it only reacts to the TRANSITION —
      // setState with the same value is free, but the check keeps it obvious.
      setGliding(g => (g === e.gliding ? g : e.gliding))

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
  }, [phase, dealColumn, paint, shout])

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
      {/* The stage takes a z-index of its OWN so it becomes a stacking context.
          Without one it is `z-index: auto`, the world's layers (Eren at 6, the
          tide at 7) escape into the root context, and the tide paints straight
          over the HUD and the RUN button. */}
      <div ref={stageRef} className="absolute inset-0 overflow-hidden"
        style={{ touchAction: 'none', zIndex: 5, isolation: 'isolate' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>

        <BackWall floorY={layout.floorY || 420} />

        {/* Parallax dressing, furthest band first so nearer ones overlap it */}
        {Array.from({ length: N_LAMP }).map((_, i) => (
          <div key={`l${i}`} ref={el => { lampEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0 }}>
            <CeilingLamp depth={1} />
          </div>
        ))}
        {Array.from({ length: N_SHELF_FAR }).map((_, i) => (
          <div key={`sf${i}`} ref={el => { shelfFarEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0 }}>
            <WallShelf depth={1} />
          </div>
        ))}
        {Array.from({ length: N_SHELF }).map((_, i) => (
          <div key={`s${i}`} ref={el => { shelfEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0 }}>
            <WallShelf depth={0} />
          </div>
        ))}

        {/* Floors */}
        {Array.from({ length: N_COL }).map((_, i) => (
          <div key={`c${i}`} ref={el => { colEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0 }}>
            <FloorTile w={TILE + 1} />
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
            <Crate w={CRATE_W} h={CRATE_H} />
          </div>
        ))}
        {Array.from({ length: N_PIPE }).map((_, i) => (
          <div key={`pp${i}`} ref={el => { pipeEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none' }}>
            <Pipe w={40} h={PIPE_H} clear={PIPE_CLEAR} />
          </div>
        ))}
        {Array.from({ length: N_BURNER }).map((_, i) => (
          <div key={`bn${i}`} ref={el => { burnerEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none', zIndex: 4 }}>
            <Burner w={BURNER_W} h={BURNER_H} />
          </div>
        ))}

        {/*
          The dash afterimages, as their OWN layer rather than as children of
          Eren.

          They are screen-blended, and mix-blend-mode only reaches the backdrop
          inside its own stacking context — Eren's wrapper makes one (z-index +
          will-change), so nested ghosts blended against nothing and came out as
          plain alpha: three grey smudges over the near-black cellar, which is
          precisely where a speed trail most needs to read as light. Out here
          the group blends against the world. The blend goes on the WRAPPER so
          the three stamps composite together first and don't screen each other.

          Always mounted, toggled by opacity, so the loop's transform is already
          on it and it never flashes at the origin on the frame a dash starts.
        */}
        <div ref={ghostEl} aria-hidden style={{
          position: 'absolute', left: 0, top: 0, zIndex: 5,
          willChange: 'transform', mixBlendMode: 'screen', pointerEvents: 'none',
          opacity: dashOn && !reduced ? 1 : 0,
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute', left: -i * 16, top: 0,
              filter: 'brightness(1.3)', opacity: 0.62 - i * 0.16,
            }}>
              <PixelEren pose="dash" size={EREN_PX} />
            </div>
          ))}
        </div>

        {/* Eren */}
        <div ref={erenEl} style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform', zIndex: 6 }}>
          {/* The canopy, riding above his paws. */}
          {gliding && (
            <div style={{
              position: 'absolute', left: '50%', top: -EREN_PX * 0.66,
              width: EREN_PX * 1.45, marginLeft: -EREN_PX * 0.725,
              animation: reduced ? undefined : 'jrCanopyPop 180ms cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <Glider w={EREN_PX * 1.45} />
            </div>
          )}
          <PixelEren pose={pose} size={EREN_PX} step={step} />
          {/* The shove-off ring, on the frame the dash starts. */}
          {dashOn && !reduced && (
            <div aria-hidden style={{
              position: 'absolute', left: '50%', top: '50%', width: 26, height: 26,
              marginLeft: -13, marginTop: -13, borderRadius: '50%',
              border: `3px solid ${BRASS_LT}`,
              animation: 'jrDashRing 420ms cubic-bezier(0.16,1,0.3,1) forwards',
            }} />
          )}
        </div>

        {/* Dash speed lines — a screen effect, so it sits above the world but
            inside the stage's own stacking context. */}
        {dashOn && !reduced && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none', overflow: 'hidden' }}>
            {DASH_STREAKS.map((s, i) => (
              <div key={i} style={{
                position: 'absolute', top: `${s.top}%`, left: '100%', width: s.w, height: s.h,
                // A hot CREAM core inside a brass falloff. A flat brass line on
                // a pink wall was near-invisible; the light core is what makes
                // it read as speed rather than as a scratch on the screen.
                background: `linear-gradient(90deg, rgba(255,248,238,0) 0%, ${BRASS} 34%, ${CREAM} 62%, rgba(255,248,238,0) 100%)`,
                boxShadow: `0 0 6px ${BRASS_LT}`,
                borderRadius: 999,
                animation: `jrStreak ${s.dur}ms linear ${s.delay}ms infinite`,
              }} />
            ))}
          </div>
        )}

        {/* The tide */}
        <div ref={tideEl} style={{ position: 'absolute', left: 0, top: 0, zIndex: 7, willChange: 'transform' }}>
          <Tide h={layout.h} />
        </div>
      </div>

      {/* ── HUD ── */}
      <div className="absolute inset-x-0 top-0 px-3 pointer-events-none"
        style={{ paddingTop: 'calc(var(--safe-top) + 8px)', zIndex: 30 }}>
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
            right: 14, bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', zIndex: 30,
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
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '22%', zIndex: 35 }}>
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
          style={{ background: 'rgba(43,26,34,0.82)', zIndex: 40 }}>
          <p className="font-pixel mb-2" style={{ fontSize: 14, color: BRASS_LT, letterSpacing: 2 }}>JELLY RUN</p>
          <p className="text-center mb-4" style={{ fontSize: 11, color: CREAM, opacity: 0.8, lineHeight: 1.5 }}>
            The tide never stops gaining.<br />Beads charge the bar. Only a DASH pushes it back.
          </p>
          <div className="flex flex-col gap-1.5 mb-4" style={{ fontSize: 10, color: CREAM, opacity: 0.75 }}>
            <span>TAP to jump — KEEP HOLDING to open the glider</span>
            <span>TAP TWICE to DASH on a full bar</span>
            <span>SWIPE DOWN to drop fast, and to duck the pipes</span>
            <span>Every gap can be cleared with one plain tap</span>
          </div>
          {/* The two hazard classes, stated before the first one arrives. The
              lethal is the only thing in the room that is orange, so the
              swatch is doing the teaching, not the sentence. */}
          <div className="flex flex-col gap-1.5 mb-6" style={{ fontSize: 10 }}>
            <span className="flex items-center gap-2" style={{ color: CREAM, opacity: 0.75 }}>
              <span style={{ width: 10, height: 10, background: WOOD, border: `2px solid ${INK}`, borderRadius: 2, flexShrink: 0 }} />
              Crates and pipes cost you — the tide lunges.
            </span>
            <span className="flex items-center gap-2" style={{ color: '#FFC98A' }}>
              <span style={{ width: 10, height: 10, background: '#FF8A2A', border: `2px solid ${INK}`, borderRadius: 2, flexShrink: 0 }} />
              Anything BURNING ends the run. Jump it or dash it.
            </span>
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

      {/* GLOBAL on purpose. styled-jsx renames keyframes it scopes, and a
          renamed name never resolves from a React inline `animation` string —
          the animation silently does nothing. Anything referenced inline has
          to live in a global block. */}
      <style jsx global>{`
        @keyframes jrPop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jrStreak {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(calc(-100vw - 160px), 0, 0); }
        }
        @keyframes jrDashRing {
          0%   { transform: scale(0.3); opacity: 0.9; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        @keyframes jrCanopyPop {
          0%   { transform: scaleY(0.2) scaleX(0.6); opacity: 0; }
          100% { transform: scaleY(1) scaleX(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
