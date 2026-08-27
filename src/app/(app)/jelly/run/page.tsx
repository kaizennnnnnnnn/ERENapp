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
//   HIGH ROADS       suspended walkways over the floor — the run's one real
//                    decision. Running one makes THE TIDE LOSE GROUND, which
//                    nothing else does but spending a full dash bar, and they
//                    carry the gems. They are ONE-WAY platforms and the lit
//                    floor always continues underneath, so the high line is a
//                    choice and never a trap: fall off and you are simply back
//                    where you started, minus the gain.
//                    They ask for it, though. Chains carry RICKETY planks that
//                    crack the moment you touch them, pipes hung low enough to
//                    duck up there, and sometimes a vent off the last plank
//                    that throws you into a glide.
//   TOPS ARE FLOOR   every hazard that is not hot has a landable top. A clean
//                    jump that ends on a crate is a good outcome, not a hit.
//   BEADS -> POWER   collecting charges a bar. Full bar = DASH.
//   DASH             double-tap (or the button): invincible, smashes anything
//                    standing on the floor, skims straight over the gaps, and
//                    shoves the tide back. It is the ONLY thing that buys
//                    ground back, which is what makes the bead-collecting loop
//                    matter — and while it is lit, nothing can end the run.
//   HOT MEANS DEAD   the burner and the syrup spill KILL; crates, pipes and
//                    trolleys only COST you. The two lethals are the only
//                    orange things in the room, because colour is read faster
//                    than shape — and one is tall and narrow while the other is
//                    flat and wide, so they can't collapse into one reflex.
//   VENTS            a floor grate that throws you two and a half jumps up.
//                    The one piece of terrain that helps, and the reason the
//                    glider matters on a single-floor map.
//   THE TIDE         a wall of jelly on your heels that NEVER stops gaining.
//                    Running cleanly buys time, never ground.
//
// ── The solvability rule ───────────────────────────────────────────────────
// Every run is beatable by making the right moves, and that is enforced by
// ARITHMETIC rather than by taste. Nothing below is typed in twice:
//
//   * a gap is never wider than a plain tap clears at the speed you meet it
//   * nothing standing on the floor is taller than MAX_OB_H, derived from the
//     jump's apex, so every hazard has a takeoff window several times its own
//     width
//   * NO TWO HAZARDS EVER LAND INSIDE ONE JUMP OF EACH OTHER. Every hazard
//     reserves a clear stretch behind it, sized from the jump's reach. That is
//     the fix for the whole class of "the only way through was to be in two
//     places at once" — including a duck that landed in a hole, which was a
//     pipe and a gap sharing one stride.
//
// Retune the jump and the map retunes with it; the two cannot drift apart.
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
  BackWall, WallShelf, CeilingLamp, FloorTile, Road, Crate, Pipe, Burner, Spill, Cart, Vent,
  Glider, Tide, Bead, Gem, ShieldPickup, TILE,
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
 * that. The lane is gone, so the jump is free to be what a runner's jump should
 * be — a hop with a definite top to it.
 *
 * A tap peaks at JUMP_V²/(2·GRAVITY) ≈ 60px: a 30px crate cleared with about
 * its own height again in daylight. Holding stretches that to ~102px for the
 * wider gaps, and the glider does the rest.
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
 *
 * On a one-floor map it had almost nothing to do, which is why the map now
 * gives it three jobs: HIGH ROADS with gaps between their segments, VENTS that
 * throw you far above anything you could jump to, and long bead lines strung
 * at glide height. Falling out of any of them costs nothing, so the canopy is
 * the difference between a good line and an ordinary one rather than between
 * living and dying.
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
 * Every gap in the floor and every gap BETWEEN HAZARDS is sized against these,
 * so a thing you can see is a thing you can answer. Derived, never typed in
 * twice — retuning the jump retunes the map with it.
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
/**
 * A grounded slide ends on its own; it is a move, not a stance.
 *
 * Shorter than it was. The generator has to guarantee open floor for the whole
 * of it (see PIPE_RUNOUT) and every millisecond here is floor the map is not
 * allowed to do anything else with.
 */
const SLIDE_MS = 460
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
 * The other lethal: flat, wide, and impossible to duck.
 *
 * Sized to sit INSIDE its own column. At 54 it overhung the next tile by ten
 * pixels, and the next tile is a clear-stretch column that lays a level line
 * of beads at running height — so the map was putting a pickup on top of a
 * thing that kills you.
 */
const SPILL_W = 46
const SPILL_H = 11
/** The runaway trolley. Rolls at you, and its tray is a landable top. */
const CART_W = 34
const CART_H = 26
const CART_V = 76             // px/s it rolls toward you...
const CART_ROAM = TILE * 2    // ...until its brake catches, this far from home
/** The boiler vent. Not a hazard — a launcher. */
const VENT_W = 36
const VENT_H = 10
const VENT_V = 880            // px/s of lift — apex ≈ 149px
const VENT_AIR = (2 * VENT_V) / GRAVITY
const VENT_REACH = 120        // how high above the floor the jet still catches you

/**
 * The high road: a suspended walkway you can hop onto with a plain tap.
 *
 * ROAD_RISE - ROAD_T must stay above H_RUN, or he cannot run UNDERNEATH one,
 * and the low line stops being a route.
 */
const ROAD_RISE = 46          // its surface, above the floor (tap apex is 60)
const ROAD_T = 9              // drawn thickness
/**
 * What the high line is FOR.
 *
 * It used to be a detour that paid in beads: climb, collect, drop off, nothing
 * gained. Now running a walkway makes the TIDE LOSE GROUND — the only other
 * thing in the game that does, besides spending a full dash bar. That turns the
 * chain from scenery into the one decision the run keeps asking: the floor is
 * safe and flat, the walkway buys you distance from the jelly but demands
 * jumps, ducks and planks that will not hold you.
 *
 * Sized against the dash on purpose. Three seconds of clean walkway is worth
 * about one dash, so neither answer to the tide is strictly better.
 */
const ROAD_GAIN = 58          // px/s the gap grows while you run a walkway
/**
 * A chain can step up a tier, and back down.
 *
 * One tier is a plain tap from the plank below — but TWO tiers is 90px, past
 * what a tap reaches from the floor, so the upper deck can only ever be
 * arrived at from the lower one. That is what turns a chain from a shelf you
 * hop onto into a route you climb, and it is why the first plank of every
 * chain is pinned to the bottom tier: the way up has to start somewhere you
 * can actually reach.
 */
const ROAD_TIER = 44          // extra height of the upper deck
/**
 * A RICKETY plank cracks the instant you touch it and lets go shortly after.
 *
 * It is what stops the high line being a stroll: you cannot stand still up
 * there, and a chain with one in it has to be read before you commit. Failing
 * costs nothing but the gain — the lit floor is still underneath.
 */
const ROAD_HOLD_MS = 700
const ROAD_FALL_V = 300       // px/s it drops once it goes
/** How far a fallen plank travels before it stops being drawn. */
const ROAD_FALL_MAX = 180

/**
 * Gap the tide sits behind Eren, in px. Hit zero and it has you.
 *
 * The tide ALWAYS gains. There is no passive recovery: running cleanly buys
 * you time, never ground. That is the whole shape of the game — the jelly is
 * always coming, beads charge the bar, and the DASH is the one thing that
 * shoves it back. Collect, spend, survive.
 */
const GAP_0 = 250
const GAP_MAX = 300
const GAP_CREEP = 11          // px/s it gains at the gun...
const GAP_CREEP_RAMP = 95     // ...doubling every this many seconds
const GAP_HIT = 50            // ...and all at once when a crate or pipe clips you
const GAP_DASH = 150          // ...and what a dash shoves back

const POWER_PER_BEAD = 9
/** A gem is five beads in one, and only ever laid on the high road. */
const GEM_POWER = 34
const GEM_BEADS = 5
/**
 * Short and sharp.
 *
 * 1.5s outlasted the moment it was answering; 900ms still did, because of what
 * it was picking up on the way. At 1.6x speed a 900ms dash crosses ~800px of
 * bead lines, and beads are what BUY the dash — so one dash handed back most of
 * the next one and the bar was never really a resource. Collecting is now
 * switched off for the duration (see the pickup pass), and the window is cut to
 * match: long enough to punch through a hazard and shove the tide, too short to
 * be a lap of the level.
 */
const DASH_MS = 600
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

/** A suspended walkway. One-way: you land on top, and pass up through it. */
interface RoadSeg {
  x: number
  w: number
  /** The surface itself — what he stands on. */
  y: number
  /** Cracks under your paws and drops away. Never the first plank of a chain. */
  rickety: boolean
  /** When it was first stood on. 0 while untouched. */
  steppedAt: number
  /** How far it has fallen. 0 while it is still a floor. */
  drop: number
}

/**
 * Six things the terrain can put in front of you, in three classes.
 *
 *   COSTS YOU   crate, pipe, cart — a stumble and a lunge from the tide
 *   KILLS       burner, spill — both orange, and nothing else in the room is
 *   HELPS       vent — throws you up
 *
 * A runner where every mistake is survivable has no moment your pulse changes;
 * one where every mistake is fatal is exhausting. Having all three means the
 * player reads each thing and decides how much it matters.
 */
type ObKind = 'crate' | 'pipe' | 'burner' | 'spill' | 'cart' | 'vent'

const LETHAL: Record<ObKind, boolean> = {
  crate: false, pipe: false, cart: false, burner: true, spill: true, vent: false,
}
/**
 * Which hazards have a top you can stand on.
 *
 * Everything that is not hot. Landing a clean jump on a crate used to cost the
 * same stumble as running into its side, which punishes the player for the
 * exact thing the jump was for — and quietly turns a stepping stone into a
 * trap. A crate lid and a trolley tray are FLOOR now.
 *
 * The two lethals are excluded and the art already says why: a lit burner has
 * a boiling pot where its top would be, and a syrup spill has no top at all,
 * only a surface that is obviously liquid.
 */
const LANDABLE: Record<ObKind, boolean> = {
  crate: true, cart: true, pipe: false, burner: false, spill: false, vent: false,
}
/** What a dash goes through. Plumbing survives; a dash is not a blanket answer. */
const SMASHABLE: Record<ObKind, boolean> = {
  crate: true, cart: true, burner: true, spill: true, pipe: false, vent: false,
}

interface Ob {
  x: number
  kind: ObKind
  dead: boolean
  w: number
  h: number
  /**
   * The surface it sits on or hangs from — the parlour floor for almost
   * everything, a WALKWAY for the pieces that furnish the high line. Without
   * it every obstacle was welded to floorY and the high road could never have
   * anything on it but beads, which is exactly why it was boring.
   */
  base: number
  /** Carts roll toward you. Everything else is nailed down. */
  vx: number
  /** ...and stop here, so a trolley can never wander into the last feature. */
  minX: number
  /** A vent fires once per pass. */
  used: boolean
}

type PickKind = 'bead' | 'gem' | 'shield'

interface Pick {
  x: number
  y: number
  taken: boolean
  kind: PickKind
}

// Pool sizes. Generous enough that the generator never runs out on screen,
// small enough that the whole world is ~110 DOM nodes.
const N_COL = COLS_AHEAD + 4
const N_ROAD = 5
/**
 * Rickety planks get their OWN pool.
 *
 * Same rule as the hazards: a shared pool draws whatever art the SLOT happens
 * to hold, and a plank that looks solid but is not would be the single most
 * expensive lie this game could tell.
 */
const N_ROAD_RICK = 4
const N_CRATE = 10
const N_PIPE = 6
const N_BURNER = 4
const N_SPILL = 4
const N_CART = 3
const N_VENT = 3
const N_BEAD = 30
const N_GEM = 4
const N_SHIELD = 2
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
  /** On a walkway, so the HUD can say the tide is losing ground. */
  const [onRoad, setOnRoad] = useState(false)
  /** The cream bubble. One free hit, and it has to be visible to be worth it. */
  const [shielded, setShielded] = useState(false)
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
  const roads = useRef<RoadSeg[]>([])
  const obs = useRef<Ob[]>([])
  const picks = useRef<Pick[]>([])
  const nextColX = useRef(0)
  /** One bead arc per gap, not one per column of it. */
  const holeArcDone = useRef(false)
  /**
   * World x up to which the floor is GUARANTEED: solid, no holes, no hazards.
   *
   * This one number is the whole solvability fix. Every hazard reserves a
   * stretch behind it at least as long as a jump carries, so the map can never
   * ask for two answers inside one arc — which is how a duck under a pipe used
   * to end in a hole nobody could have avoided, and how a burner could sit one
   * column short of a gap.
   */
  const clearUntilX = useRef(0)
  /**
   * Columns the NEXT feature-end reservation must add on top of its own.
   *
   * A walkway chain that ends on a vent launches you well past where the chain
   * itself finishes, and the flight has to land on floor the generator has
   * promised to leave alone. The chain cannot reserve that itself — reserving
   * anything mid-chain would mark its own remaining columns clear and it would
   * never be built.
   */
  const extraReserve = useRef(0)
  /** Columns still owed to the current terrain feature. */
  const run = useRef({ kind: 'flat' as 'flat' | 'hole' | 'crates' | 'road', left: 0 })

  const eren = useRef({
    y: 0, vy: 0, grounded: true, gliding: false, diving: false, slideUntil: 0, shield: false,
  })
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
  const roadEls = useRef<(HTMLDivElement | null)[]>([])
  const roadRickEls = useRef<(HTMLDivElement | null)[]>([])
  const crateEls = useRef<(HTMLDivElement | null)[]>([])
  const pipeEls = useRef<(HTMLDivElement | null)[]>([])
  const burnerEls = useRef<(HTMLDivElement | null)[]>([])
  const spillEls = useRef<(HTMLDivElement | null)[]>([])
  const cartEls = useRef<(HTMLDivElement | null)[]>([])
  const ventEls = useRef<(HTMLDivElement | null)[]>([])
  const beadEls = useRef<(HTMLDivElement | null)[]>([])
  const gemEls = useRef<(HTMLDivElement | null)[]>([])
  const shieldEls = useRef<(HTMLDivElement | null)[]>([])
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
    // which is now only ~102px at its most generous, plus a vent's 150.
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
   * feature (a 2-3 wide hole, a row of crates, a chain of walkways) and then a
   * guaranteed clear rest gives every hazard a silhouette and every player a
   * beat to breathe.
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
    /**
     * How far a jump CARRIES here, in columns. The unit the map keeps its
     * distance in: a rest shorter than this puts the next thing under him
     * while he is still in the air from the last one, with the tap that would
     * have saved him swallowed for not being grounded.
     */
    const reachCols = Math.ceil((speedHere * TAP_AIR) / TILE) + 1

    /** Beads sit one half-sprite above whatever surface he is on. */
    const lineY = (surfaceY: number) => surfaceY - EREN_PX * 0.5 - 8

    const lay = (px: number, py: number, kind: PickKind = 'bead') =>
      picks.current.push({ x: px, y: py, taken: false, kind })

    /**
     * Is a stretch of floor clear of anything that kills?
     *
     * Level lines are laid at RUNNING height, so one within reach of a burner
     * or a spill is the map offering a bead in exchange for the run. Arcs are
     * exempt and always have been — they are sampled from the jump that clears
     * the thing, so their low samples are meant to be near it.
     */
    const clearOfLethal = (fromX: number, toX: number) =>
      !obs.current.some(o => LETHAL[o.kind] && o.x - 20 < toX && o.x + o.w + 20 > fromX)

    /**
     * A string of beads sampled from a REAL trajectory, so following the line
     * is the move rather than merely near it.
     *
     * `v0` lets the same helper draw a tap-jump's arc and a vent's much taller
     * one; `baseY` is the surface it launches from, which is the floor for most
     * of them and the walkway for a road gap.
     */
    const arc = (fromX: number, n: number, baseY: number, v0: number, kind: PickKind = 'bead') => {
      const air = (2 * v0) / GRAVITY
      const span = speedHere * air
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n
        const tt = f * air
        const rise = v0 * tt - 0.5 * GRAVITY * tt * tt
        lay(fromX + f * span, lineY(baseY) - rise, kind)
      }
    }

    /**
     * A feature that has just run out reserves the clear stretch after it.
     *
     * This has to happen BEFORE the clear-stretch check below, and it has to be
     * a RESERVATION rather than "a flat run of N columns" — which is what it
     * used to be, and the reason a map could still be unplayable after every
     * gap was made jumpable. Flat columns are precisely where hazards are
     * dealt, so a flat rest is not a rest: a crate row could be followed one
     * stride later by a burner, and a spill could be laid inside the arc you
     * were already committed to by the crate before it. Measured in the pilot
     * at 6px, 10px, 52px and 85px of separation — all of them well inside a
     * single jump, and all of them unanswerable.
     */
    if (run.current.left <= 0 && run.current.kind !== 'flat') {
      run.current = { kind: 'flat', left: 0 }
      const extra = extraReserve.current
      extraReserve.current = 0
      clearUntilX.current = Math.max(
        clearUntilX.current,
        x + (reachCols + extra + Math.floor(Math.random() * 2)) * TILE,
      )
    }

    // ── The guaranteed-clear stretch ──
    //
    // Solid floor, no holes, no hazards. Reserved by whatever was dealt last,
    // and long enough that its answer is finished before the next question is
    // asked. Early return: the surest way to keep a guarantee is to make the
    // code that could break it unreachable.
    if (x < clearUntilX.current) {
      cols.current.push({ x, solid: true })
      holeArcDone.current = false
      run.current = { kind: 'flat', left: 0 }
      if (Math.random() < 0.42 && clearOfLethal(x + 6, x + 34)) {
        for (let i = 0; i < 3; i++) lay(x + 6 + i * 14, lineY(floorY))
      }
      nextColX.current += TILE
      return
    }

    // Anything reaching here is on clear ground with its predecessor's answer
    // already finished, so it is free to be the next question.
    if (run.current.left <= 0) {
      const r = Math.random()
      if (r < 0.11 + heat * 0.05) {
        // ── THE HIGH ROAD ──
        //
        // A chain of suspended walkways with gaps between them, laid out in
        // full the moment it is chosen. The floor stays solid under all of it,
        // so the chain is a route rather than a risk: the gems are up there,
        // the glider is how you keep them coming, and dropping off costs you
        // nothing but the gems you did not reach.
        const segs = 2 + (Math.random() < 0.6 ? 1 : 0)
        let cursor = x
        let total = 0
        // The first plank is always on the bottom tier — see ROAD_TIER.
        let tier = 0
        let ry = floorY - ROAD_RISE
        for (let s = 0; s < segs; s++) {
          if (s > 0 && Math.random() < 0.55) tier = tier === 0 ? 1 : 0
          ry = floorY - ROAD_RISE - tier * ROAD_TIER
          const segCols = 3 + Math.floor(Math.random() * 2)
          const rw = segCols * TILE
          // The FIRST plank is always solid. You have to be able to get onto a
          // chain at all, and a chain you cannot board is not a decision.
          const rickety = s > 0 && Math.random() < 0.34 + heat * 0.24
          roads.current.push({ x: cursor, w: rw, y: ry, rickety, steppedAt: 0, drop: 0 })

          // A line of beads down the walkway, and a gem in the middle of it —
          // the reason to be up here at all. A rickety plank carries the gem
          // more often: the thing you cannot stand on is where the prize is.
          const n = Math.max(2, Math.round(rw / 26))
          const gemAt = (rickety || s === segs - 1) ? Math.floor(n / 2) : -1
          for (let i = 0; i < n; i++) {
            const px = cursor + 14 + (i * (rw - 28)) / (n - 1)
            lay(px, lineY(ry), i === gemAt ? 'gem' : 'bead')
          }

          // A pipe hung over the middle of a SOLID plank: the high line's own
          // duck. It is why the walkway is a skill test rather than a stroll —
          // and it is placed centrally so it can never coincide with the jump
          // at either end. Harmless from the floor: at walkway height its
          // underside clears a standing cat by a good margin.
          if (!rickety && s > 0 && segCols >= 3 && Math.random() < 0.42) {
            const px = cursor + rw / 2 - 20
            obs.current.push({
              x: px, kind: 'pipe', dead: false, w: 40, h: PIPE_H, base: ry,
              vx: 0, minX: px, used: false,
            })
            // Sweep out any bead the incoming arc already threw into it. The
            // arc leaving the PREVIOUS plank is laid before this plank's pipe
            // exists and can carry 240px at full speed — far enough to land a
            // pickup inside the one thing up here you have to duck. A bead you
            // cannot take without taking a hit is worse than no bead.
            const pTop = ry - PIPE_CLEAR - PIPE_H
            const pBot = ry - PIPE_CLEAR
            picks.current = picks.current.filter(
              b => !(b.x + 16 > px && b.x < px + 40 && b.y + 16 > pTop && b.y < pBot),
            )
          }

          cursor += rw
          total += segCols
          if (s < segs - 1) {
            // The gap between planks. Sized in columns rather than pixels so it
            // scales with the grid, and clearable with a tap at walkway height
            // — the glider is what makes the WIDE ones routine, not what makes
            // them possible.
            const gapCols = 1 + Math.floor(Math.random() * Math.max(1, Math.min(3, maxGap)))
            arc(cursor - TILE * 0.3, 4, ry, JUMP_V)
            cursor += gapCols * TILE
            total += gapCols
          }
        }

        // A chain that ends on a VENT throws you off the end instead of just
        // dropping you off it — straight into a glide, with the run's longest
        // bead line under you. The whole flight has to be reserved, so it is
        // handed to the feature-end reservation rather than taken here: taking
        // it here would mark the chain's own columns clear and the chain would
        // never be dealt.
        const lastRick = roads.current[roads.current.length - 1]?.rickety
        if (!lastRick && Math.random() < 0.45) {
          const vx2 = cursor - TILE + (TILE - VENT_W) / 2
          obs.current.push({
            x: vx2, kind: 'vent', dead: false, w: VENT_W, h: VENT_H, base: ry,
            vx: 0, minX: vx2, used: false,
          })
          arc(vx2 + VENT_W / 2, 7, ry, VENT_V)
          lay(vx2 + VENT_W / 2 + (speedHere * VENT_AIR) / 2, lineY(ry) - TAP_APEX * 2.3,
            Math.random() < 0.4 ? 'shield' : 'gem')
          extraReserve.current = Math.ceil((speedHere * VENT_AIR) / TILE) + 2
        }
        run.current = { kind: 'road', left: total }
      } else if (r < 0.36 + heat * 0.12) {
        run.current = { kind: 'hole', left: Math.min(maxGap, 1 + (Math.random() < 0.35 + heat * 0.4 ? 1 : 0)) }
      } else if (r < 0.60 + heat * 0.14) {
        run.current = { kind: 'crates', left: 1 + (Math.random() < heat * 0.5 ? 1 : 0) }
      } else {
        run.current = { kind: 'flat', left: 2 + Math.floor(Math.random() * 3) }
      }
    }
    const feature = run.current.kind
    run.current.left--

    const solid = feature !== 'hole'
    cols.current.push({ x, solid })

    // ONE hazard per column at most, and never on a road stretch — the high
    // line is a route, and a route with a lethal under its landing is a trap
    // wearing a route's clothes.
    /** What this column gets, decided before anything is built from it. */
    let hazard: ObKind | null = null
    if (feature === 'crates' && solid) {
      // A row of crates. With landable tops these are stepping stones as much
      // as obstacles — clear both in one arc, or take the lid of the first.
      hazard = 'crate'
    } else if (feature === 'flat' && solid && x > TILE * 8) {
      // The opening columns stay clear of everything: a runner that kills you
      // before you have found the controls is not difficult, it is rude.
      const r = Math.random()
      const pBurner = 0.05 + heat * 0.07
      const pSpill = pBurner + 0.045 + heat * 0.06
      const pPipe = pSpill + 0.085 + heat * 0.07
      const pCart = pPipe + 0.05 + heat * 0.05
      const pVent = pCart + 0.055
      if (r < pBurner) hazard = 'burner'
      else if (r < pSpill) hazard = 'spill'
      else if (r < pPipe) hazard = 'pipe'
      else if (r < pCart) hazard = 'cart'
      else if (r < pVent) hazard = 'vent'
      // A trolley may only be dealt over floor it can roll BACK across: it is
      // the one thing here that moves, so the ground it will be standing on
      // when you meet it is not the ground it was dealt on, and one that
      // wandered out over a hole would ask for a jump and a dodge in the same
      // stride. Refused rather than swapped — falling through to the next
      // branch would quietly deal a vent in its place.
      if (hazard === 'cart' && !behindIsSolid(cols.current, x, 2)) hazard = null
    }

    /**
     * Reserve clear floor behind whatever was just dealt.
     *
     * Measured in units of the jump's REACH unless the hazard needs more: a
     * pipe needs the whole SLIDE to finish over open floor (a slide that ends
     * in a hole is not a mistake the player made), and a vent needs its entire
     * flight, because being thrown into a pipe is not an answerable problem.
     */
    const reserve = (n: number) => {
      clearUntilX.current = Math.max(clearUntilX.current, x + n * TILE)
    }
    /** Where the thing actually sits, once there is a thing. */
    let hazardX = 0
    if (hazard) {
      const W: Record<ObKind, number> = {
        crate: CRATE_W, burner: BURNER_W, spill: SPILL_W, cart: CART_W, vent: VENT_W, pipe: 40,
      }
      const H: Record<ObKind, number> = {
        crate: CRATE_H, burner: BURNER_H, spill: SPILL_H, cart: CART_H, vent: VENT_H, pipe: PIPE_H,
      }
      hazardX = hazard === 'crate' ? x + TILE * 0.28
        : hazard === 'pipe' ? x + TILE * 0.2
          : x + (TILE - W[hazard]) / 2
      obs.current.push({
        x: hazardX, kind: hazard, dead: false, w: W[hazard], h: H[hazard], base: floorY,
        vx: hazard === 'cart' ? CART_V : 0, minX: hazardX - CART_ROAM, used: false,
      })

      const tapSpan = speedHere * TAP_AIR
      if (hazard === 'burner' || hazard === 'spill') {
        // Apex dead-centre over it. Offsetting the arc by even a few percent
        // pulls its first low bead to within a stride of a LETHAL — close
        // enough that taking it leaves no room to take off. The whole point of
        // laying beads on the trajectory is that following them IS the correct
        // move; nudging the arc off the jump breaks that.
        arc(hazardX + W[hazard] / 2 - tapSpan / 2, 5, floorY, JUMP_V)
        reserve(reachCols)
      } else if (hazard === 'pipe') {
        // THE FIX FOR THE DUCK THAT ENDED IN A HOLE. The slide is a committed
        // move with a duration, so the floor it will finish on has to exist
        // before the pipe is dealt. Derived from the slide, not guessed.
        //
        // At DASH_MULT because the slide is the one move where arriving faster
        // than predicted is the bad direction: a dash covers 1.6x the ground
        // the arrival estimate assumed, and a runout measured at the estimate
        // ran out mid-slide. Caught in the pilot as a hole 255px past a pipe
        // whose reserve was 264px — inside by nine pixels, which is exactly
        // the kind of margin that shows up as one unfair death an hour.
        reserve(Math.ceil((speedHere * DASH_MULT * (SLIDE_MS / 1000)) / TILE) + 2)
      } else if (hazard === 'cart') {
        reserve(reachCols)
      } else if (hazard === 'vent') {
        // The whole flight, a tall line of beads up it, and something worth
        // having at the top so the height is a reward and not just a surprise.
        const gift: PickKind = Math.random() < 0.34 ? 'shield' : 'gem'
        arc(hazardX + VENT_W / 2, 7, floorY, VENT_V)
        lay(hazardX + VENT_W / 2 + (speedHere * VENT_AIR) / 2, lineY(floorY) - TAP_APEX * 2.3, gift)
        reserve(Math.ceil((speedHere * VENT_AIR) / TILE) + 2)
      }
    }

    // ── Beads ────────────────────────────────────────────────────────────
    //
    // Every bead sits on a path he can actually travel, so a line of them is
    // always collectable in full by one move — usually the move he was already
    // making. The placements above and below are the only paths he has:
    // standing, jumping something, crossing a gap, walking a road, riding a
    // vent. Nothing is ever put anywhere else.
    if (feature === 'hole') {
      // Only the FIRST column of a gap lays the arc; the flag is cleared by
      // the next solid column. Otherwise a two-column gap gets two overlapping
      // strings of beads across the same jump.
      if (!holeArcDone.current) {
        holeArcDone.current = true
        arc(x - speedHere * TAP_AIR * 0.28, 5, floorY, JUMP_V)
      }
    } else {
      holeArcDone.current = false
      if (hazard === 'crate') {
        // Strung over the crate he already has to jump. This is the one the
        // whole rule exists for: the pickup is ON the move he was making.
        arc(hazardX + CRATE_W / 2 - (speedHere * TAP_AIR) / 2, 5, floorY, JUMP_V)
      } else if (hazard === null && feature !== 'road' && Math.random() < 0.5
        && clearOfLethal(x + 6, x + 34)) {
        // Open floor: a level line at running height, taken by doing nothing.
        for (let i = 0; i < 3; i++) lay(x + 6 + i * 14, lineY(floorY))
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
    const { floorY, erenX, w: stageW } = dims.current
    const camX = world.current.x
    const feetY = eren.current.y
    const onScreen = (x: number, w: number) => x - camX > -w - 40 && x - camX < stageW + 40

    for (let i = 0; i < N_COL; i++) {
      const c = cols.current[i]
      const el = colEls.current[i]
      if (!el) continue
      if (!c || !c.solid) { el.style.display = 'none'; continue }
      el.style.display = 'block'
      el.style.transform = `translate3d(${(c.x - camX).toFixed(1)}px, ${floorY}px, 0)`
    }

    // Roads come in several lengths, so the pool node owns the box and the art
    // fills it. Every other pool draws a fixed-size piece.
    let ri = 0, rri = 0
    for (const r of roads.current) {
      if (r.drop >= ROAD_FALL_MAX || !onScreen(r.x, r.w)) continue
      const i = r.rickety ? rri++ : ri++
      if (i >= (r.rickety ? N_ROAD_RICK : N_ROAD)) continue
      const el = (r.rickety ? roadRickEls : roadEls).current[i]
      if (!el) continue
      el.style.display = 'block'
      el.style.width = `${r.w}px`
      el.style.height = `${ROAD_T}px`
      // A plank that has let go drops, tips and fades. The tip is what stops
      // it reading as the walkway simply being switched off.
      el.style.opacity = r.drop > 0 ? String(Math.max(0, 1 - r.drop / ROAD_FALL_MAX)) : '1'
      el.style.transform = `translate3d(${(r.x - camX).toFixed(1)}px, ${(r.y + r.drop).toFixed(1)}px, 0)`
        + (r.drop > 0 ? ` rotate(${(r.drop * 0.05).toFixed(2)}deg)` : '')
    }
    for (let i = ri; i < N_ROAD; i++) { const el = roadEls.current[i]; if (el) el.style.display = 'none' }
    for (let i = rri; i < N_ROAD_RICK; i++) { const el = roadRickEls.current[i]; if (el) el.style.display = 'none' }

    // One pool PER KIND. A single shared pool drew whatever art the SLOT
    // happened to hold, so a crate could render as a pipe — and the player
    // would duck a thing that was actually a jump. With lethals in the mix
    // that class of bug stops being a nuisance and starts ending runs.
    const obPools: Record<ObKind, { els: (HTMLDivElement | null)[]; n: number; i: number }> = {
      crate: { els: crateEls.current, n: N_CRATE, i: 0 },
      pipe: { els: pipeEls.current, n: N_PIPE, i: 0 },
      burner: { els: burnerEls.current, n: N_BURNER, i: 0 },
      spill: { els: spillEls.current, n: N_SPILL, i: 0 },
      cart: { els: cartEls.current, n: N_CART, i: 0 },
      vent: { els: ventEls.current, n: N_VENT, i: 0 },
    }
    for (const o of obs.current) {
      if (o.dead || !onScreen(o.x, o.w)) continue
      const pool = obPools[o.kind]
      if (pool.i >= pool.n) continue
      const el = pool.els[pool.i++]
      if (!el) continue
      const oy = o.kind === 'pipe' ? o.base - PIPE_CLEAR - PIPE_H : o.base - o.h
      el.style.display = 'block'
      el.style.transform = `translate3d(${(o.x - camX).toFixed(1)}px, ${oy}px, 0)`
    }
    for (const k of Object.keys(obPools) as ObKind[]) {
      const pool = obPools[k]
      for (let i = pool.i; i < pool.n; i++) { const el = pool.els[i]; if (el) el.style.display = 'none' }
    }

    const pickPools: Record<PickKind, { els: (HTMLDivElement | null)[]; n: number; i: number }> = {
      bead: { els: beadEls.current, n: N_BEAD, i: 0 },
      gem: { els: gemEls.current, n: N_GEM, i: 0 },
      shield: { els: shieldEls.current, n: N_SHIELD, i: 0 },
    }
    for (const p of picks.current) {
      if (p.taken || !onScreen(p.x, 22)) continue
      const pool = pickPools[p.kind]
      if (pool.i >= pool.n) continue
      const el = pool.els[pool.i++]
      if (!el) continue
      el.style.display = 'block'
      el.style.transform = `translate3d(${(p.x - camX).toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
    }
    for (const k of Object.keys(pickPools) as PickKind[]) {
      const pool = pickPools[k]
      for (let i = pool.i; i < pool.n; i++) { const el = pool.els[i]; if (el) el.style.display = 'none' }
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
    roads.current = []
    obs.current = []
    picks.current = []
    nextColX.current = 0
    run.current = { kind: 'flat', left: 6 }   // a clear runway to begin on
    holeArcDone.current = false
    clearUntilX.current = 0
    extraReserve.current = 0
    world.current = { x: 0, speed: SPEED_0, gap: GAP_0, t: 0 }
    eren.current = {
      y: floorY, vy: 0, grounded: true, gliding: false, diving: false, slideUntil: 0, shield: false,
    }
    setShielded(false)
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
   * signal that `measure` moved the floor.
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
      /**
       * A DASH NEVER EXPIRES OVER A GAP.
       *
       * The skim finishes on solid ground or it does not finish. Letting the
       * timer run out mid-hole is the last way the comeback move could still
       * kill you, and it is completely invisible — there is no dash clock on
       * screen, so from the player's side it is simply the floor vanishing.
       * The pilot died here: it dashed, jumped during the dash (which carries
       * DASH_MULT further), and the dash ended one frame before it landed,
       * directly above a gap.
       *
       * Extended a frame at a time, so it stretches by exactly as long as the
       * gap takes to cross at dash speed — around a tenth of a second — and
       * not one frame more.
       */
      const wasOverGap = (() => {
        const c = cols.current.find(cc => cc.x === Math.floor((w.x + erenX) / TILE) * TILE)
        return c ? !c.solid : false
      })()
      if (wasOverGap && dash.current.until > 0 && now >= dash.current.until) {
        dash.current.until = now + 16
      }
      const dashing = now < dash.current.until

      // Speed: ramps with time, boosted by a dash, cut while stumbling.
      w.t += dt
      const ramp = SPEED_0 + (SPEED_MAX - SPEED_0) * Math.min(1, w.t / SPEED_RAMP)
      if (stumble.current > 0) stumble.current -= dt
      w.speed = ramp * (dashing ? DASH_MULT : stumble.current > 0 ? 0.55 : 1)
      w.x += w.speed * dt

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

      // ── Terrain recycling ──
      while (nextColX.current < w.x + dims.current.w + COLS_AHEAD * TILE) dealColumn()
      const cullX = w.x - TILE * 3
      if (cols.current.length > N_COL + 6) cols.current = cols.current.filter(c => c.x > cullX)
      // Gated on length, like every other cull here: a filter per frame would
      // allocate for a 90-second run that is supposed to allocate nothing.
      // Planks that have finished falling stop being PAINTED the moment they
      // land (see paint), so leaving them in the array costs nothing but bytes.
      if (roads.current.length > N_ROAD + N_ROAD_RICK + 4) {
        roads.current = roads.current.filter(r => r.x + r.w > cullX && r.drop < ROAD_FALL_MAX)
      }
      if (obs.current.length > 24) obs.current = obs.current.filter(o => o.x > cullX && !o.dead)
      if (picks.current.length > N_BEAD + 24) picks.current = picks.current.filter(p => p.x > cullX && !p.taken)

      // Trolleys roll toward you, up to the point their brake catches. Moved
      // before the ground test so a tray he is standing on carries him.
      for (const o of obs.current) {
        if (o.vx === 0 || o.dead) continue
        o.x = Math.max(o.minX, o.x - o.vx * dt)
      }

      // ── Ground ───────────────────────────────────────────────────────────
      //
      // Everything he can stand on, resolved in one place: the parlour floor,
      // the suspended walkways, and the tops of the hazards that are not hot.
      // Landing is a CROSSING of a surface, not simply being at or below it —
      // testing position alone teleports him back up the moment ground scrolls
      // over his head after he has already dropped past it, and it is also
      // what makes the walkways ONE-WAY: rising through one never catches.
      const hereX = w.x + erenX
      const eL = hereX - EREN_W / 2, eR = hereX + EREN_W / 2
      const idx = Math.floor(hereX / TILE)
      const col = cols.current.find(c => c.x === idx * TILE)
      const floorHere = col ? col.solid : true

      let land = Infinity
      const cross = (top: number) => {
        if (prevY <= top + 1 && e.y >= top && top < land) land = top
      }
      /**
       * A DASH SKIMS THE GAPS.
       *
       * The dash already goes through anything standing on the floor; holes
       * are the last thing that could still punish it, and they were punishing
       * it in the worst possible way. It multiplies your speed by DASH_MULT,
       * so a dash begun mid-jump stretches the arc by the same factor — 230px
       * becomes 367px — and drops you PAST the ground you were aimed at. The
       * pilot died this way four runs running, always the same shape: jump a
       * spill, spend a full bar on the tide while still in the air, overshoot
       * into the next gap.
       *
       * A resource you save up for two hundred metres must not be the thing
       * that kills you. While it is lit, the floor is continuous.
       */
      if (floorHere || dashing) cross(floorY)
      for (const r of roads.current) {
        if (r.drop > 0) continue              // this one has already let go
        if (r.x + r.w < eL || r.x > eR) continue
        cross(r.y)
      }
      for (const o of obs.current) {
        if (o.dead || !LANDABLE[o.kind]) continue
        if (o.x + o.w < eL || o.x > eR) continue
        cross(o.base - o.h)
      }

      if (land < Infinity && e.vy >= 0) {
        e.y = land
        e.vy = 0
        e.grounded = true
        // Spend a jump that was pressed a moment too early.
        if (now < bufferUntil.current) { bufferUntil.current = 0; jumpRef.current() }
      } else if (e.grounded) {
        e.grounded = false             // ran off a lip
        coyoteUntil.current = now + COYOTE_MS
      }
      // Down the hole. There is no lower lane to catch him — the gap is the
      // hazard, and every gap is dealt narrow enough to clear with a plain tap
      // at the speed he meets it (see GAP_SAFETY).
      if (e.y > h + 40) { endRef.current(); return }

      // ── The high road ────────────────────────────────────────────────────
      //
      // Standing on a walkway is the one thing besides a full dash bar that
      // takes ground BACK from the tide, and it is the whole reason to be up
      // here. A rickety plank starts its clock the moment he touches it.
      let onRoadSeg: RoadSeg | null = null
      if (e.grounded) {
        for (const r of roads.current) {
          if (r.drop > 0 || Math.abs(e.y - r.y) > 2) continue
          if (r.x + r.w < eL || r.x > eR) continue
          onRoadSeg = r
          break
        }
      }
      if (onRoadSeg?.rickety && !onRoadSeg.steppedAt) {
        onRoadSeg.steppedAt = now
        playSound('jl_miss')
      }
      for (const r of roads.current) {
        if (!r.rickety) continue
        if (r.steppedAt && r.drop === 0 && now - r.steppedAt > ROAD_HOLD_MS) r.drop = 1
        if (r.drop > 0) r.drop += ROAD_FALL_V * dt
      }

      // The tide. It only ever gains — except up here, and behind a dash.
      if (onRoadSeg) w.gap = Math.min(GAP_MAX, w.gap + ROAD_GAIN * dt)
      else if (!dashing) w.gap -= GAP_CREEP * (1 + w.t / GAP_CREEP_RAMP) * dt

      // ── Vents ──
      // Terrain that helps. Fires once, and only while he is low enough for
      // the jet to reach him, so it is a thing you run over rather than a
      // thing that grabs you out of a jump you meant.
      for (const o of obs.current) {
        if (o.kind !== 'vent' || o.dead || o.used) continue
        if (o.x + o.w < eL || o.x > eR) continue
        const above = o.base - e.y
        if (above < -2 || above > VENT_REACH) continue
        o.used = true
        e.vy = -VENT_V
        e.grounded = false
        e.diving = false
        jumpedAt.current = now
        playSound('jl_high')
        setPose('leap')
      }

      const feetY = e.y
      const eH = e.diving ? H_SLIDE : H_RUN
      const headY = feetY - eH

      // ── Collisions ──
      for (const o of obs.current) {
        if (o.dead || o.kind === 'vent') continue
        if (o.x + o.w < eL || o.x > eR) continue
        const hanging = o.kind === 'pipe'
        const oTop = hanging ? o.base - PIPE_CLEAR - PIPE_H : o.base - o.h
        const oBot = hanging ? o.base - PIPE_CLEAR : o.base
        // THE TOP IS FLOOR. He has just been stood on it by the ground pass,
        // so his feet are exactly at its top — and a hit test that only asks
        // "do the boxes overlap" calls that a collision. It is why landing a
        // clean jump on a crate used to cost the same as running into its side.
        if (LANDABLE[o.kind] && feetY <= oTop + 1) continue
        if (feetY < oTop || headY > oBot) continue
        if (dashing && SMASHABLE[o.kind]) {
          // A dash goes THROUGH anything standing on the floor — that is what
          // makes it the comeback move, and it is the only way past a burner
          // other than jumping. The pipe is plumbing, not cargo: it survives,
          // so a dash can never be a blanket answer to everything.
          o.dead = true
          playSound('jl_combo')
          continue
        }
        if (e.shield) {
          // One free mistake, the lethals included. It is why the run can
          // afford a second way to die outright.
          o.dead = true
          e.shield = false
          setShielded(false)
          playSound('jl_combo')
          shout('SAVED!')
          break
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

      // ── Pickups ──
      //
      // NOT WHILE DASHING. The dash is bought with beads and spent at 1.6x
      // speed straight down the lines of them, so it used to refund most of its
      // own cost — collect, dash, collect the dash, dash again. A resource you
      // earn back by spending it is not a resource, and the whole
      // collect-spend-survive loop the run is built on quietly stopped
      // mattering. Beads passed at speed are simply gone, which is the price of
      // the invincibility.
      for (const p of dashing ? [] : picks.current) {
        if (p.taken) continue
        if (p.x + 18 < eL || p.x > eR + 6) continue
        if (Math.abs(p.y - (feetY - EREN_PX * 0.5)) > 34) continue
        p.taken = true
        if (p.kind === 'shield') {
          e.shield = true
          setShielded(true)
          playSound('jl_combo')
          shout('CREAM SHIELD')
        } else {
          const gem = p.kind === 'gem'
          beadsRef.current += gem ? GEM_BEADS : 1
          powerRef.current = Math.min(100, powerRef.current + (gem ? GEM_POWER : POWER_PER_BEAD))
          playSound(gem ? 'jl_high' : 'jl_bounce')
        }
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
      setOnRoad(v => (v === !!onRoadSeg ? v : !!onRoadSeg))

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

        {/* Floor */}
        {Array.from({ length: N_COL }).map((_, i) => (
          <div key={`c${i}`} ref={el => { colEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0 }}>
            <FloorTile w={TILE + 1} />
          </div>
        ))}

        {/* The high road. Sized by the loop, since segments vary in length. */}
        {Array.from({ length: N_ROAD }).map((_, i) => (
          <div key={`rd${i}`} ref={el => { roadEls.current[i] = el }}
            style={{ position: 'absolute', left: 0, top: 0, display: 'none', width: 132, height: ROAD_T, zIndex: 3 }}>
            <Road />
          </div>
        ))}
        {Array.from({ length: N_ROAD_RICK }).map((_, i) => (
          <div key={`rk${i}`} ref={el => { roadRickEls.current[i] = el }}
            style={{ position: 'absolute', left: 0, top: 0, display: 'none', width: 132, height: ROAD_T, zIndex: 3 }}>
            <Road rickety />
          </div>
        ))}

        {/* Pickups */}
        {Array.from({ length: N_BEAD }).map((_, i) => (
          <div key={`b${i}`} ref={el => { beadEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none' }}>
            <Bead size={16} color={BEAD_COLORS[i % BEAD_COLORS.length]} />
          </div>
        ))}
        {Array.from({ length: N_GEM }).map((_, i) => (
          <div key={`gm${i}`} ref={el => { gemEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none', zIndex: 4 }}>
            <Gem size={22} />
          </div>
        ))}
        {Array.from({ length: N_SHIELD }).map((_, i) => (
          <div key={`sh${i}`} ref={el => { shieldEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none', zIndex: 4 }}>
            <ShieldPickup size={24} />
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
        {Array.from({ length: N_CART }).map((_, i) => (
          <div key={`ct${i}`} ref={el => { cartEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none' }}>
            <Cart w={CART_W} h={CART_H} />
          </div>
        ))}
        {Array.from({ length: N_VENT }).map((_, i) => (
          <div key={`vt${i}`} ref={el => { ventEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none', zIndex: 2 }}>
            <Vent w={VENT_W} h={VENT_H} />
          </div>
        ))}
        {Array.from({ length: N_BURNER }).map((_, i) => (
          <div key={`bn${i}`} ref={el => { burnerEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none', zIndex: 4 }}>
            <Burner w={BURNER_W} h={BURNER_H} />
          </div>
        ))}
        {Array.from({ length: N_SPILL }).map((_, i) => (
          <div key={`sp${i}`} ref={el => { spillEls.current[i] = el }} style={{ position: 'absolute', left: 0, top: 0, display: 'none', zIndex: 4 }}>
            <Spill w={SPILL_W} h={SPILL_H} />
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
          {/* The cream bubble. A held charge has to be visible on HIM, not in
              the HUD — the moment it matters you are looking at the sprite. */}
          {shielded && (
            <div aria-hidden style={{
              position: 'absolute', left: '50%', top: '50%',
              width: EREN_PX * 1.5, height: EREN_PX * 1.5,
              marginLeft: -EREN_PX * 0.75, marginTop: -EREN_PX * 0.75,
              borderRadius: '50%', border: `2px solid ${CREAM}`,
              background: 'radial-gradient(circle at 36% 30%, rgba(255,248,238,0.34) 0%, rgba(255,248,238,0.06) 60%, rgba(255,248,238,0) 100%)',
              boxShadow: '0 0 12px rgba(255,248,238,0.75)',
              animation: reduced ? undefined : 'jrShieldRing 1.5s ease-in-out infinite',
            }} />
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

        {/* The walkway's payoff, stated. The tide is usually off-screen, so a
            player on the high road would otherwise have no way of knowing the
            one thing that makes being up there worth the trouble. */}
        {onRoad && (
          <div className="flex justify-center mt-1.5">
            <span className="font-pixel px-2 py-1" style={{
              fontSize: 8, letterSpacing: 1, color: '#0E3B23',
              background: `linear-gradient(180deg, #7DF3C4, ${LEAF})`,
              border: `2px solid ${INK}`, borderRadius: 5,
              animation: reduced ? undefined : 'jrGainPulse 620ms ease-in-out infinite',
            }}>
              HIGH ROAD — TIDE LOSING
            </span>
          </div>
        )}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 overflow-y-auto"
          style={{ background: 'rgba(43,26,34,0.82)', zIndex: 40 }}>
          <p className="font-pixel mb-2" style={{ fontSize: 14, color: BRASS_LT, letterSpacing: 2 }}>JELLY RUN</p>
          <p className="text-center mb-4" style={{ fontSize: 11, color: CREAM, opacity: 0.8, lineHeight: 1.5 }}>
            The tide never stops gaining.<br />Beads charge the bar. Only a DASH pushes it back.
          </p>
          <div className="flex flex-col gap-1.5 mb-4" style={{ fontSize: 10, color: CREAM, opacity: 0.75 }}>
            <span>TAP to jump — KEEP HOLDING to open the glider</span>
            <span>TAP TWICE to DASH on a full bar</span>
            <span>SWIPE DOWN to drop fast, and to duck the pipes</span>
            <span>Every gap clears with one plain tap. Every hazard gets its own beat.</span>
          </div>
          {/* The three classes, stated before the first one arrives. Each swatch
              is doing the teaching; the sentence only names it. */}
          <div className="flex flex-col gap-1.5 mb-6" style={{ fontSize: 10 }}>
            <span className="flex items-center gap-2" style={{ color: CREAM, opacity: 0.75 }}>
              <span style={{ width: 10, height: 10, background: WOOD, border: `2px solid ${INK}`, borderRadius: 2, flexShrink: 0 }} />
              Wood and brass only cost you — and their TOPS are safe to land on.
            </span>
            <span className="flex items-center gap-2" style={{ color: '#FFC98A' }}>
              <span style={{ width: 10, height: 10, background: '#FF8A2A', border: `2px solid ${INK}`, borderRadius: 2, flexShrink: 0 }} />
              Anything HOT ends the run. Jump it or dash it.
            </span>
            <span className="flex items-center gap-2" style={{ color: '#D8F5E4' }}>
              <span style={{ width: 10, height: 10, background: LEAF, border: `2px solid ${INK}`, borderRadius: 2, flexShrink: 0 }} />
              High walkways push the TIDE BACK. Grey planks give way.
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
        @keyframes jrGainPulse {
          0%, 100% { transform: translateY(0); filter: brightness(1); }
          50%      { transform: translateY(-1px); filter: brightness(1.18); }
        }
        @keyframes jrShieldRing {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.09); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/**
 * Is the floor behind `x` solid for `n` columns?
 *
 * Only the trolley asks, and only because it is the one thing that moves: it
 * rolls back toward you, so the ground it will be standing on when you meet it
 * is not the ground it was dealt on. A trolley that wandered out over a hole
 * would be asking for a jump and a dodge in the same stride, which is exactly
 * the kind of unanswerable pairing the rest of the generator exists to prevent.
 *
 * A column that has already been culled reads as solid — it is far behind the
 * camera and the trolley can never reach it.
 */
function behindIsSolid(cols: Col[], x: number, n: number): boolean {
  for (let i = 1; i <= n; i++) {
    const c = cols.find(cc => cc.x === x - i * TILE)
    if (c && !c.solid) return false
  }
  return true
}
