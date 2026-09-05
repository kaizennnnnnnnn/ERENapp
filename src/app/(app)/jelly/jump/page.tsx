'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY JUMP — bounce Eren up the parlour storeroom, shelf after shelf.
//
// ── Why there is more here than "one jelly, one bounce" ────────────────────
// A climber where every platform is identical is a test of steering and
// nothing else, which runs out of interest in about forty seconds. Seven kinds
// give the climb a shape, and the director introduces them in the order a
// player can absorb them — the art and the full roster live in
// components/jelly/JumpPlatform.tsx.
//
// Camping is handled by the CHAIN rather than by taking the floor away, and
// the chain now only counts shelves you actually CLIMBED: dropping two storeys
// onto a stranger used to increment it, which is nonsense.
//
// ── The three things that make a run go somewhere ──────────────────────────
//   ZONES    the shaft is four rooms (jumpZones.ts). You punch through a
//            ceiling into each one and the wall, the light, the props and the
//            parallax RATE all change. Before this, 100 M and 900 M were the
//            identical purple tube and the only evidence you had climbed was a
//            number in the corner.
//   SUGAR    cubes strung on the arc BETWEEN two shelves, so collecting is
//            never a detour — missing is the failure. They fill a jar.
//   THE JAM  a full jar buys exactly one catch. Slip past the bottom of the
//            shaft with jam banked and a spoonful throws you back up onto a
//            fresh shelf. Earned, never given, and never two at once.
//
// ── The arithmetic, which is not a matter of taste ─────────────────────────
// A bounce leaves at BOUNCE_V and rises BOUNCE_V²/2·GRAVITY = 174px, so
// GAP_MAX sits at ~86% of that. Horizontally a hop to a 150px gap lasts 0.611s,
// in which he covers ~227px from a standing start, against REACH_X of 165.
// That 62px of slack is the entire budget every mechanic in this file spends
// from, and anything that shortens a bounce (syrup) or steals steering (a
// tipping lid) MUST cap the next platform's gap and reach on its way out.
//
// ── Engine ─────────────────────────────────────────────────────────────────
// Entities in refs, ONE rAF loop writing transforms straight to the DOM, React
// re-rendering only when an entity LIST changes (a shelf recycled off the
// bottom, a cube collected) rather than every frame. The duty cycle on a rack
// and the fade between two zones are CSS custom properties and an opacity,
// written by the loop — no React at all.
//
// The world scrolls, Eren doesn't. He's pinned near the middle of the screen
// and the platforms slide down past him, which keeps him in the player's eye
// line at every height and means the "camera" is one number instead of a
// transform on a container that would blur the sprite.
//
// The SCREEN SHAKE is a second, separate number written to the field. It must
// never be folded into `cam`: CAM_ANCHOR is one of the two terms in the death
// test, so a camera that moves for juice would move the kill line with it.
//
// Steering is HOLD, not tap: touch the left or right half and he accelerates
// that way, release and he coasts.
// ═══════════════════════════════════════════════════════════════════════════

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
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
import { JumpWallLayer, JumpDepth, JumpCeiling, TILE } from '@/components/jelly/JumpScenery'
import { ZONES, ZONE_M, ZONE_FADE_M } from '@/components/jelly/jumpZones'
import { Platform, Sugar, PLAT_W, PLAT_H, SUGAR_SIZE, type PlatKind } from '@/components/jelly/JumpPlatform'
import PixelEren, { type ErenPose } from '@/components/games/PixelEren'
import { IconJelly, IconSparkles } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { INK } from '@/components/jelly/parlourTheme'

// ─── Tuning ────────────────────────────────────────────────────────────────
const GRAVITY = 1750          // px/s²
const BOUNCE_V = 780          // px/s launched off a jelly       — rises 174px
const CREAM_V = 1120          // ...and off whipped cream        — rises 358px
const SYRUP_V = 640           // ...and off a syrup-glazed one   — rises 117px
const MOVE_A = 2600           // px/s² while steering
const MAX_VX = 430
const DRAG = 0.86             // per-frame coast damping when not steering
const EREN = 46               // sprite box
/** Eren sits this far down the screen; the world scrolls under him. */
const CAM_ANCHOR = 0.46
/**
 * Vertical gap between platforms, widened as you climb.
 *
 * The ceiling is not a taste call: a bounce rises 174px, so any gap at or
 * above that is a platform he physically cannot reach. GAP_MAX sits at ~86% of
 * it, which leaves enough margin to still be STEERING at the apex rather than
 * arriving spent. The jitter is applied before the clamp, so it can never push
 * past this.
 */
const GAP_START = 112
const GAP_MIN = 96
const GAP_MAX = 150
/**
 * How far sideways the next platform may sit from the one below it.
 *
 * The same reachability argument as GAP_MAX, on the other axis. Placing each
 * platform at a uniform random x across the whole width — which is what this
 * did first — regularly asked for 300px against a ~227px budget, so a run
 * ended not because the player misjudged anything but because the next shelf
 * was out of range. Anchoring to the PREVIOUS platform keeps every hop honest.
 */
const REACH_X = 165
/**
 * SYRUP's two caps, and the reason the kind is allowed to exist at all.
 *
 * A syrup bounce rises 117px, so the shelf above one must be inside that or it
 * is unreachable — 100px leaves 17px of margin. The reach cap is the half
 * nobody thinks of: he reaches 100px only 0.226s after leaving, and in 0.226s
 * from a standing start MOVE_A carries him just 66px sideways. Asking for the
 * full REACH_X after a syrup would be asking for 165px of travel he does not
 * have time to make. 45px leaves a 21px margin.
 */
const SYRUP_GAP_MAX = 100
const SYRUP_REACH_X = 45
/** LID: half-width of the fulcrum, and the sideways shove a tip gives him. */
const LID_DEAD = 11
const LID_VX = 200
/**
 * A tipped lid SETS his horizontal speed rather than adding to it, so the worst
 * case is exactly ±200 and can never compound with an existing ±430. Even so he
 * spends most of the next hop fighting it, so that hop's reach is capped.
 */
const LID_NEXT_REACH = 60
/** RACK: duty cycle, and how long of it is a cream-strength launch. */
const RACK_CYCLE = 2500
const RACK_ON = 1700
const RACK_WARN = 700
/**
 * Height that earns a jelly. One hop is ~14–19 M, so this is about fifteen
 * clean ones — a real run, but reachable on an ordinary day.
 */
const THRESHOLD = 240
/** Height (px) per point — a run reads in hundreds, not tens of thousands. */
const PX_PER_M = 8
/** Metres after which the director is at full strength. */
const RAMP_M = 900
/**
 * How long a landed biscuit holds before it drops.
 *
 * Not politeness — legibility. A platform that vanishes on contact teaches
 * nothing, because by the time you see it go you have already committed. A
 * beat with the cracks showing is what turns "it disappeared" into "I saw that
 * one crack".
 */
const CRUMB_HOLD_MS = 220
/**
 * Consecutive CLIMBED platforms that earn a cream-strength bounce.
 *
 * Lower than the old 10 because the rule got stricter at the same time: the
 * chain now breaks on any landing that isn't higher than the last one, where it
 * used to break only on re-landing the identical shelf.
 */
const CHAIN_REWARD = 8

// ── Sugar and the jam jar ──────────────────────────────────────────────────
/** Chance that a gap is strung with cubes. */
const SUGAR_CHANCE = 0.32
/**
 * Pickup box. Deliberately an ELLIPSE, wider than it is tall: his vertical
 * position between two shelves is deterministic — he passes every height
 * exactly once — while his horizontal position depends on when the player
 * commits the steer. The uncertain axis is the one that gets the tolerance.
 */
const SUGAR_RX = 27
const SUGAR_RY = 17
/** Where on the arc the two cubes sit: fraction of the gap, and of the chord. */
const SUGAR_U = [0.42, 0.66]
/**
 * The x fractions LAG the y fractions on purpose. He accelerates sideways, so
 * a straight-line interpolation between two shelves sits ahead of where a
 * well-steered cat actually is at that height.
 */
const SUGAR_V = [0.30, 0.56]
const JAR_CAPACITY = 18
/**
 * Where the catch puts him. Measured from HIS position, never from the screen
 * height: a relaunch expressed in H would catch a tall phone and drop a short
 * one. He needs to rise JAM_SHELF_UP + EREN/2 = 143px and BOUNCE_V gives 174.
 */
const JAM_SHELF_UP = 120

// ── Feel ───────────────────────────────────────────────────────────────────
/** Screen punch, in px, on an ordinary landing and on a big one. */
const PUNCH_HIT = 4
const PUNCH_BIG = 9
const PUNCH_DECAY = 0.06
/** Speed streaks fade in over this range of upward velocity. */
const STREAK_FROM = 820
const N_STREAK = 5
/** Pose thresholds. 780 < 900 < 1120, so only a BIG launch reads as a hurl. */
const POSE_DASH_V = -900
const POSE_LEAP_V = -260

const ZONE_PX = ZONE_M * PX_PER_M
const ZONE_FADE_PX = ZONE_FADE_M * PX_PER_M
/** A mark within this many px of him brightens. */
const MARK_NEAR = 220

interface Plat {
  id: number
  kind: PlatKind
  x: number
  /** World Y — grows downward; the camera subtracts from it. */
  wy: number
  jelly: JellyDef
  /**
   * Spent. ONLY a crumb can ever be spent.
   *
   * This used to be set for every kind except cream, and the recycler melted
   * anything spent — so jellies AND sliders vanished the moment you touched
   * them. From the player's seat that is "the platforms disappear", with no way
   * to tell which. The rule now is the one the start card states: the biscuit
   * is the thing that gives way, and nothing else does.
   */
  used: boolean
  /** 0..1 squish, decays after a bounce. */
  squish: number
  /** 0→1 as a crumb falls away, so it fades instead of blinking out. */
  melt: number
  falling: boolean
  fallV: number
  /** CRUMB: when it was landed on, so the cracks get a beat to be seen. */
  crackAt: number
  /** SLIDER: horizontal speed and travel bounds. */
  vx: number
  minX: number
  maxX: number
  /** LID: which way it tipped, kept for the rest of the run. */
  tip: -1 | 0 | 1
  /** RACK: phase offset, so a screenful of racks is never synchronised. */
  phase: number
  el?: HTMLDivElement | null
}

interface Cube {
  id: number
  x: number
  wy: number
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
  const [chainUi, setChainUi] = useState(0)
  const [jarUi, setJarUi] = useState(0)
  const [jamUi, setJamUi] = useState(false)
  const [zoneIdx, setZoneIdx] = useState(0)
  const [ceilIdx, setCeilIdx] = useState(0)
  const [ceilBroken, setCeilBroken] = useState(false)
  const [pose, setPose] = useState<ErenPose>('idle')
  const [banner, setBanner] = useState<string | null>(null)
  const [wins, setWins] = useState<JellyWin[]>([])
  const [awardFailed, setAwardFailed] = useState(false)
  const [result, setResult] = useState<{ isBest: boolean; duel: DuelLine } | null>(null)

  const fieldRef = useRef<HTMLDivElement | null>(null)
  const erenRef = useRef<HTMLDivElement | null>(null)
  const wallARef = useRef<HTMLDivElement | null>(null)
  const wallBRef = useRef<HTMLDivElement | null>(null)
  const depthRef = useRef<HTMLDivElement | null>(null)
  const ceilRef = useRef<HTMLDivElement | null>(null)
  const streakRef = useRef<HTMLDivElement | null>(null)
  const markTheirsRef = useRef<HTMLDivElement | null>(null)
  const markBestRef = useRef<HTMLDivElement | null>(null)
  const plats = useRef<Plat[]>([])
  const cubes = useRef<Cube[]>([])
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
  /** Caps a SINGLE upcoming platform, set by whatever shortened the bounce. */
  const nextGapCap = useRef(GAP_MAX)
  const nextReach = useRef(REACH_X)
  /** The kind just dealt, so two shelves that both punish can't stack. */
  const lastKind = useRef<PlatKind>('jelly')
  const milestone = useRef(0)
  /** Consecutive platforms strictly above the previous one. */
  const chain = useRef(0)
  const lastHitWy = useRef(Infinity)
  const lastHitId = useRef(-1)
  /** The shelf he last left, so the dive pose is positional, not a guess. */
  const launchWy = useRef(0)
  const jar = useRef(0)
  const jamReady = useRef(false)
  const zoneRef = useRef(0)
  const ceilIdxRef = useRef(0)
  const ceilBrokenRef = useRef(false)
  const punch = useRef(0)
  const poseRef = useRef<ErenPose>('idle')
  const poseHold = useRef(0)
  const reducedRef = useRef(reduced)
  const passedTheirs = useRef(false)
  const passedBest = useRef(false)
  const poseTimer = useRef<number | null>(null)
  const bannerTimer = useRef<number | null>(null)
  const ceilTimer = useRef<number | null>(null)
  const [, force] = useState(0)

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])
  useEffect(() => { reducedRef.current = reduced }, [reduced])

  /**
   * The duel numbers, mirrored into a ref.
   *
   * The loop must not close over `duel` — it is a fresh object every render, and
   * an effect that listed it would tear the rAF loop down and rebuild it on
   * every score tick. Same reasoning as endRoundRef below.
   */
  const marksRef = useRef({ theirs: 0, best: 0 })
  useEffect(() => {
    marksRef.current = { theirs: duel.theirsToday, best: duel.best }
  }, [duel.theirsToday, duel.best])

  const flash = useCallback((p: ErenPose, ms = 420) => {
    poseRef.current = p
    poseHold.current = performance.now() + ms
    setPose(p)
    if (poseTimer.current) window.clearTimeout(poseTimer.current)
    poseTimer.current = window.setTimeout(() => { poseRef.current = 'idle'; setPose('idle') }, ms)
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
    // Cleared the bar but came back empty-handed: the write failed, and the
    // card must say that rather than quote a threshold the player already beat.
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

  /**
   * The loop must NOT depend on endRound.
   *
   * endRound closes over `jellies` and `duel`, which are fresh objects from
   * their hooks on every render — so it changes identity constantly, and an
   * effect that lists it tears the rAF loop down and rebuilds it on every
   * score tick. That resets the difficulty ramp several times a second, which
   * is why the round never got harder.
   */
  const endRoundRef = useRef(endRound)
  useEffect(() => { endRoundRef.current = endRound }, [endRound])

  /**
   * Add one platform above the highest so far, and maybe string sugar under it.
   *
   * `heat` (0→1 over RAMP_M metres) drives the difficulty curve: the gap widens
   * toward GAP_MAX and the mix shifts off plain jellies. Cream is kept at a
   * steady ~10% at every height — it's the pressure valve, and a climb with no
   * free storeys in it stops being fun long before it stops being hard.
   *
   * The kinds unlock by HEIGHT rather than all at once, so the shaft teaches
   * one idea at a time: the biscuit can leave, then the lid can act on you,
   * then the syrup can shortchange you, then the rack has a clock.
   */
  const addPlat = useCallback((W: number) => {
    const climbed = Math.max(0, -nextPlatWy.current) / PX_PER_M
    const heat = Math.min(1, climbed / RAMP_M)

    // Whatever the platform below was, it may have shortened this hop.
    const cap = nextGapCap.current; nextGapCap.current = GAP_MAX
    const reach = nextReach.current; nextReach.current = REACH_X

    const fromX = lastPlatX.current
    const fromWy = nextPlatWy.current
    const gap = Math.max(GAP_MIN, Math.min(cap,
      GAP_START + heat * 30 + (Math.random() - 0.5) * 28))
    nextPlatWy.current -= gap

    /**
     * Never two shelves in a row that both take something from you. A syrup
     * under a lid, or a lid under a lid, is the one combination that can make a
     * frame genuinely unmakeable — each is fair alone because each caps the
     * hop that follows it, and neither can cap a hop that is already capped.
     */
    const punished = lastKind.current === 'syrup' || lastKind.current === 'lid'
    const roll = Math.random()
    const pCream = 0.10
    const pSlider = 0.10 + heat * 0.16
    const pCrumb = punished || climbed < 90 ? 0 : 0.10 + heat * 0.12
    const pLid = punished || climbed < 100 ? 0 : 0.09
    const pSyrup = punished || climbed < 260 ? 0 : 0.09
    const pRack = climbed < 380 ? 0 : 0.09
    let acc = pCream
    let kind: PlatKind = 'jelly'
    if (roll < acc) kind = 'cream'
    else if (roll < (acc += pSlider)) kind = 'slider'
    else if (roll < (acc += pCrumb)) kind = 'crumb'
    else if (roll < (acc += pLid)) kind = 'lid'
    else if (roll < (acc += pSyrup)) kind = 'syrup'
    else if (roll < (acc += pRack)) kind = 'rack'
    lastKind.current = kind

    const half = PLAT_W / 2
    const lo = half, hi = Math.max(half, W - half)
    // Reflect off the walls instead of clamping: a clamp makes several
    // platforms in a row pile against the same edge.
    let x = fromX + (Math.random() * 2 - 1) * reach
    if (x < lo) x = lo + (lo - x)
    if (x > hi) x = hi - (x - hi)
    x = Math.min(hi, Math.max(lo, x))
    lastPlatX.current = x

    // What THIS shelf costs the next hop.
    if (kind === 'syrup') { nextGapCap.current = SYRUP_GAP_MAX; nextReach.current = SYRUP_REACH_X }
    else if (kind === 'lid') nextReach.current = LID_NEXT_REACH

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
      used: false, squish: 0, melt: 0, falling: false, fallV: 0, crackAt: 0,
      vx: kind === 'slider' ? (Math.random() < 0.5 ? -1 : 1) * (48 + heat * 78) : 0,
      minX, maxX, tip: 0,
      phase: Math.random() * RACK_CYCLE,
    })

    /**
     * Sugar sits ON the arc he has to fly anyway, so it costs no reachability
     * at all — the whole risk is precision, not greed. A cube placed off the
     * chord would be asking him to spend the 62px of slack the map is built on.
     */
    if (Math.random() < SUGAR_CHANCE) {
      for (let i = 0; i < 2; i++) {
        cubes.current.push({
          id: ++uid,
          x: fromX + (x - fromX) * SUGAR_V[i],
          wy: fromWy - gap * SUGAR_U[i],
        })
      }
    }
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
      // Declared up here rather than at the recycler, because landing on a
      // biscuit has to repaint too — that is what makes its cracks appear.
      let listChanged = false
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
      // feet is where the platform actually is this frame. The rack's duty
      // cycle is resolved here too, for the same reason: what it looks like and
      // what it does have to be decided on the same frame.
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
            /**
             * The chain counts shelves you CLIMBED. Landing on one that isn't
             * above the last one — a rebound onto the same shelf, or a two-storey
             * drop onto a stranger — breaks it. The old rule only broke on the
             * identical shelf, so falling down the shaft used to build a chain.
             */
            const clean = p.wy < lastHitWy.current - 1
            if (clean) chain.current++
            else chain.current = 0
            lastHitWy.current = p.wy
            lastHitId.current = p.id

            const earned = chain.current > 0 && chain.current % CHAIN_REWARD === 0
            // A rack that is still lit launches like cream. It ALWAYS catches
            // him either way — a platform you could fall through would be the
            // crumb's lie told twice, with no tell you can read while falling.
            const rackHot = p.kind === 'rack' && (now + p.phase) % RACK_CYCLE < RACK_ON
            let big = p.kind === 'cream' || earned || rackHot

            if (p.kind === 'lid') {
              const off = c.x - p.x
              if (Math.abs(off) > LID_DEAD) {
                // Tipped. c.vx is SET, not added, so the shove is exactly
                // ±LID_VX and can never compound with a full-speed steer.
                p.tip = off < 0 ? -1 : 1
                c.vx = p.tip * LID_VX
                playSound('jl_tip')
                listChanged = true
              } else {
                // The fulcrum pays like cream. Every other kind moves the
                // score; a platform whose only outcome is a banner would be
                // the one shelf in the shaft that does nothing.
                big = true
                shout('BALANCED')
              }
            }

            c.vy = big ? -CREAM_V : p.kind === 'syrup' ? -SYRUP_V : -BOUNCE_V
            launchWy.current = p.wy
            p.squish = 1
            // What the platform DOES is independent of how hard he leaves it.
            // Folding these together made a chain reward landing on a biscuit
            // leave the biscuit standing — the one platform whose whole
            // identity is that it breaks.
            if (p.kind === 'crumb') {
              // Spent immediately so it can't be bounced twice, but it does
              // not LEAVE yet — see CRUMB_HOLD_MS.
              p.used = true
              p.crackAt = now
              listChanged = true    // repaint once so the cracks show
              playSound('jl_crack')
            } else if (p.kind === 'cream') {
              playSound('jl_cream')
            } else if (earned) {
              playSound('jl_chain')
            } else if (rackHot) {
              playSound('jl_rack')
            } else if (p.kind !== 'lid') {
              playSound('jl_bounce')
            }

            if (big) {
              if (earned && p.kind !== 'cream') shout(`SUGAR RUSH x${chain.current}`)
              else if (p.kind === 'cream') shout('WHIPPED!')
              flash('cheer', 320)
            } else if (chain.current > 0 && chain.current % 4 === 0) {
              shout(`CHAIN x${chain.current}`)
            }
            punch.current = reducedRef.current ? 0 : (big ? PUNCH_BIG : PUNCH_HIT)
            setChainUi(chain.current)
            break
          }
        }
      }

      /**
       * Sugar. Tested after the bounce so a cube grabbed on the way up and the
       * landing that follows can both resolve in the same frame.
       */
      for (const s of cubes.current) {
        if (Math.abs(c.x - s.x) > SUGAR_RX || Math.abs(c.wy - s.wy) > SUGAR_RY) continue
        s.wy = Infinity          // marked; the recycler sweeps it this frame
        listChanged = true
        jar.current++
        playSound('jl_sugar')
        if (jar.current >= JAR_CAPACITY && !jamReady.current) {
          jamReady.current = true
          jar.current = 0
          setJamUi(true)
          playSound('jl_jar')
          shout('JAR FULL')
        }
        setJarUi(jar.current)
      }

      // ── Pose ──
      // Positional, not velocity-based: he is DIVING once he has fallen a slab
      // below the shelf he left, which no rebound or cream overshoot can fake.
      if (poseHold.current < now) {
        const want: ErenPose =
          c.vy < POSE_DASH_V ? 'dash'
            : c.vy < POSE_LEAP_V ? 'leap'
              : (c.vy > 0 && c.wy + EREN / 2 > launchWy.current + PLAT_H) ? 'dive'
                : 'idle'
        if (want !== poseRef.current) { poseRef.current = want; setPose(want) }
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
          // Passing a line in the shaft is something you SEE happen, at the
          // moment it happens, instead of reading about it on the results card.
          const mk = marksRef.current
          if (!passedTheirs.current && mk.theirs > 0 && m >= mk.theirs) {
            passedTheirs.current = true
            playSound('jl_rival')
            shout('TOOK THE LEAD')
          }
          if (!passedBest.current && mk.best > 0 && m >= mk.best) {
            passedBest.current = true
            playSound('jl_rival')
            shout('NEW BEST')
          }
        }
      }

      // Keep a screen and a half of platforms above, recycle below.
      while (nextPlatWy.current > cam.current - H * 0.6) { addPlat(W); listChanged = true }
      plats.current = plats.current.filter(p => {
        if (p.wy - cam.current > H + PLAT_H * 3) { listChanged = true; return false }
        if (p.squish > 0) p.squish = Math.max(0, p.squish - dt * 3.2)
        // A landed biscuit holds, cracks showing, then gives way. Nothing else
        // is ever spent, so nothing else is ever removed from under the player.
        if (p.used && !p.falling && now - p.crackAt > CRUMB_HOLD_MS) {
          p.falling = true
          p.fallV = 40
        }
        // Fade it out as it drops, so it leaves rather than blinks off.
        if (p.falling) p.melt = Math.min(1, p.melt + dt * 1.5)
        if (p.el) {
          const sy = 1 - p.squish * 0.45
          const sx = 1 + p.squish * 0.3
          // A biscuit TUMBLES as it goes. It used to squash flat on the way
          // out, borrowed from the melting jellies — but a biscuit that
          // flattens reads as melting, and the point of this one is that it
          // broke. A tipped lid keeps its tilt for the rest of the run, so you
          // can look back down the shaft and see what you did.
          const spin = p.falling ? ` rotate(${p.melt * 34}deg)`
            : p.tip ? ` rotate(${p.tip * 7}deg)` : ''
          p.el.style.transform =
            `translate3d(${p.x - PLAT_W / 2}px, ${p.wy - cam.current}px, 0) scale(${sx}, ${sy})${spin}`
          p.el.style.opacity = String(1 - p.melt)
          if (p.kind === 'rack') {
            const t = (now + p.phase) % RACK_CYCLE
            const hot = t < RACK_ON
            p.el.style.setProperty('--on', hot ? '1' : '0.18')
            p.el.style.setProperty('--warn',
              hot && t >= RACK_ON - RACK_WARN && !reducedRef.current ? 'running' : 'paused')
          }
        }
        return true
      })

      cubes.current = cubes.current.filter(s => {
        if (s.wy === Infinity || s.wy - cam.current > H + SUGAR_SIZE * 2) { listChanged = true; return false }
        if (s.el) {
          s.el.style.transform = `translate3d(${s.x - SUGAR_SIZE / 2}px, ${s.wy - cam.current - SUGAR_SIZE / 2}px, 0)`
        }
        return true
      })

      // ── Zones ──
      // The wall is two stacked layers: A is the room he is in, B is the one
      // above, faded up over the last ZONE_FADE_PX before the boundary so it
      // reaches full opacity exactly AT the ceiling. That is what makes the
      // swap seamless — at the moment A becomes the next room, B was already
      // covering it completely, so a render arriving a frame late shows nothing.
      const zi = zoneRef.current
      const lastZone = zi >= ZONES.length - 1
      const ceilWy = -(zi + 1) * ZONE_PX
      if (!lastZone) {
        const dist = c.wy - ceilWy
        const t = Math.max(0, Math.min(1, 1 - dist / ZONE_FADE_PX))
        if (wallBRef.current) wallBRef.current.style.opacity = String(t)
        if (dist <= 0 && !ceilBrokenRef.current) {
          ceilBrokenRef.current = true
          setCeilBroken(true)
          zoneRef.current = zi + 1
          setZoneIdx(zi + 1)
          playSound('jl_zone')
          shout(ZONES[zi + 1].name)
          punch.current = reducedRef.current ? 0 : PUNCH_BIG
          // Retire the broken slab once it has finished flying apart, and move
          // a fresh one up to the next boundary.
          if (ceilTimer.current) window.clearTimeout(ceilTimer.current)
          ceilTimer.current = window.setTimeout(() => {
            ceilIdxRef.current = zi + 1
            setCeilIdx(zi + 1)
            setCeilBroken(false)
            ceilBrokenRef.current = false
          }, 560)
        }
      } else if (wallBRef.current) {
        wallBRef.current.style.opacity = '0'
      }

      const rate = ZONES[Math.min(zi, ZONES.length - 1)].rate
      const rateB = ZONES[Math.min(zi + 1, ZONES.length - 1)].rate
      if (wallARef.current) wallARef.current.style.backgroundPositionY = `${-cam.current * rate}px`
      if (wallBRef.current) wallBRef.current.style.backgroundPositionY = `${-cam.current * rateB}px`
      if (depthRef.current) {
        // Modulo keeps the strip's own offset small: without it the transform
        // grows without bound over a long climb and starts losing precision.
        const y = -cam.current * (rate + 0.45)
        depthRef.current.style.transform = `translate3d(0, ${y % TILE - TILE}px, 0)`
      }
      if (ceilRef.current) {
        const cwy = -(ceilIdxRef.current + 1) * ZONE_PX
        ceilRef.current.style.transform = `translate3d(0, ${cwy - cam.current}px, 0)`
        ceilRef.current.style.visibility = ceilIdxRef.current >= ZONES.length - 1 ? 'hidden' : 'visible'
      }

      // ── Marks ──
      const mk = marksRef.current
      const writeMark = (el: HTMLDivElement | null, m: number) => {
        if (!el) return
        if (m <= 0) { el.style.visibility = 'hidden'; return }
        const wy = -m * PX_PER_M
        el.style.visibility = 'visible'
        el.style.transform = `translate3d(0, ${wy - cam.current}px, 0)`
        el.style.opacity = Math.abs(wy - c.wy) < MARK_NEAR ? '1' : '0.5'
      }
      writeMark(markTheirsRef.current, mk.theirs)
      writeMark(markBestRef.current, mk.best)

      if (erenRef.current) {
        // Squash on the way up out of a bounce, stretch at the top of the arc —
        // the cheapest possible weight cue, and it costs one string.
        const s = Math.max(-1, Math.min(1, c.vy / 900))
        const sx = 1 - s * 0.12, sy = 1 + s * 0.12
        erenRef.current.style.transform =
          `translate3d(${c.x - EREN / 2}px, ${c.wy - cam.current - EREN / 2}px, 0) scale(${sx}, ${sy})`
      }

      // ── Punch and streaks ──
      // The punch is written to the FIELD, never folded into `cam`: CAM_ANCHOR
      // is one of the two terms in the death test below, so a camera that moved
      // for juice would move the kill line with it. Math.round is load-bearing
      // — a fractional translate on the container resamples the sprite.
      punch.current *= Math.pow(PUNCH_DECAY, dt)
      field.style.transform = `translate3d(0, ${Math.round(punch.current)}px, 0)`
      if (streakRef.current) {
        const speed = Math.max(0, -c.vy - STREAK_FROM) / (CREAM_V - STREAK_FROM)
        streakRef.current.style.opacity = reducedRef.current ? '0' : String(Math.min(1, speed) * 0.7)
      }

      // Fallen off the bottom of the view.
      if (c.wy - cam.current > H + EREN * 2 && phaseRef.current === 'play') {
        if (jamReady.current) {
          /**
           * The catch. Everything here is measured from HIM, not from the
           * screen: a relaunch expressed in H would catch a tall phone and drop
           * a short one on the identical run.
           */
          jamReady.current = false
          setJamUi(false)
          const half = PLAT_W / 2
          c.vy = -BOUNCE_V
          c.vx *= 0.3
          plats.current.push({
            id: ++uid, kind: 'jelly',
            x: Math.min(Math.max(half, c.x), Math.max(half, W - half)),
            wy: c.wy - JAM_SHELF_UP,
            jelly: JELLIES[0],
            used: false, squish: 0, melt: 0, falling: false, fallV: 0, crackAt: 0,
            vx: 0, minX: 0, maxX: 0, tip: 0, phase: 0,
          })
          // A catch is not a climb: it must not pay a chain it didn't earn.
          chain.current = 0
          lastHitWy.current = Infinity
          setChainUi(0)
          listChanged = true
          playSound('jl_jam')
          flash('cheer', 620)
          shout('CAUGHT!')
          punch.current = reducedRef.current ? 0 : PUNCH_BIG
        } else {
          void endRoundRef.current()
        }
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
    cubes.current = []
    nextPlatWy.current = 0
    lastPlatX.current = W / 2
    nextGapCap.current = GAP_MAX
    nextReach.current = REACH_X
    lastKind.current = 'jelly'
    cam.current = -H * CAM_ANCHOR
    // A wide starting jelly right under him so the first bounce is free.
    plats.current.push({
      id: ++uid, kind: 'jelly', x: W / 2, wy: 0, jelly: JELLIES[0],
      used: false, squish: 0, melt: 0, falling: false, fallV: 0, crackAt: 0,
      vx: 0, minX: W / 2, maxX: W / 2, tip: 0, phase: 0,
    })
    for (let i = 0; i < 9; i++) addPlat(W)
    cat.current = { x: W / 2, wy: -EREN, vx: 0, vy: 0 }
    bestWy.current = 0
    heightRef.current = 0
    milestone.current = 0
    chain.current = 0
    lastHitWy.current = Infinity
    lastHitId.current = -1
    launchWy.current = 0
    steer.current = 0
    savedRef.current = false
    jar.current = 0
    jamReady.current = false
    zoneRef.current = 0
    ceilIdxRef.current = 0
    ceilBrokenRef.current = false
    punch.current = 0
    poseRef.current = 'idle'
    poseHold.current = 0
    passedTheirs.current = false
    passedBest.current = false
    if (ceilTimer.current) window.clearTimeout(ceilTimer.current)
    setHeight(0); setChainUi(0); setJarUi(0); setJamUi(false)
    setZoneIdx(0); setCeilIdx(0); setCeilBroken(false)
    setBanner(null); setWins([]); setAwardFailed(false); setResult(null)
    setPose('idle')
    phaseRef.current = 'play'
    setPhase('play')
  }, [addPlat])

  useEffect(() => () => {
    if (poseTimer.current) window.clearTimeout(poseTimer.current)
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current)
    if (ceilTimer.current) window.clearTimeout(ceilTimer.current)
  }, [])

  const zone = ZONES[Math.min(zoneIdx, ZONES.length - 1)]

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{
      background: zone.base, touchAction: 'none',
    }}>
      <JumpWallLayer ref={wallARef} zone={zoneIdx} />
      <div ref={wallBRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0, opacity: 0 }}>
        <JumpWallLayer zone={Math.min(zoneIdx + 1, ZONES.length - 1)} />
      </div>
      <JumpDepth ref={depthRef} count={7} zone={zoneIdx} />

      {/* Marks: her height today and your all-time best, painted on the wall.
          EDGE plates only — JumpScenery records that a full-width element in
          the play area got aimed at as ground, and a line the player tries to
          land on would be the most expensive lie this screen could tell. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
        <Mark ref={markTheirsRef} colour="#E9789F" label={(duel.theirName ?? 'HER').slice(0, 7).toUpperCase()} value={duel.theirsToday} />
        <Mark ref={markBestRef} colour="#C08A5A" label="BEST" value={duel.best} />
      </div>

      {/* The slab between this room and the next. Not a collider. */}
      <JumpCeiling key={ceilIdx} ref={ceilRef} zone={ceilIdx} broken={ceilBroken} reduced={reduced} />

      {/* Speed streaks — only ever visible on a launch bigger than a hop. */}
      <div ref={streakRef} aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 4, opacity: 0 }}>
        {Array.from({ length: N_STREAK }).map((_, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${8 + i * 21}%`, top: '-10%', width: 3, height: '32%',
            borderRadius: 999,
            background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${zone.lamp} 55%, rgba(255,255,255,0) 100%)`,
            animation: reduced ? undefined : `jumpStreak ${380 + i * 90}ms linear infinite`,
          }} />
        ))}
      </div>

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
        {/* The chain. Hidden until it means something, so the HUD stays a
            height readout on an ordinary hop. */}
        {phase === 'play' && chainUi >= 3 && (
          <div className="flex items-center px-2 py-1.5" style={{
            background: chainUi >= CHAIN_REWARD - 2 ? '#2FA765' : INK,
            borderRadius: 8, border: '2.5px solid #FFF8EE',
          }}>
            <span className="font-pixel" style={{ fontSize: 7, color: '#FFE6F0' }}>x{chainUi}</span>
          </div>
        )}
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

      {/* The jam jar. Only on screen once there's something in it — an empty
          meter on a first run is a promise the player can't read yet. */}
      {phase === 'play' && (jarUi > 0 || jamUi) && (
        <div className="absolute flex items-center gap-1.5 px-2 py-1.5" style={{
          top: 'calc(var(--safe-top) + 50px)', left: 12, zIndex: 30,
          background: jamUi ? '#B0324F' : 'rgba(42,16,48,0.8)',
          borderRadius: 8, border: `2.5px solid ${jamUi ? '#FFD3E0' : '#FFF8EE'}`,
        }}>
          <IconSparkles size={10} />
          {jamUi ? (
            <span className="font-pixel" style={{ fontSize: 6.5, color: '#FFE6F0' }}>JAM READY</span>
          ) : (
            <span aria-hidden style={{
              display: 'block', width: 44, height: 6, borderRadius: 999,
              background: 'rgba(255,255,255,0.18)', overflow: 'hidden',
            }}>
              <span style={{
                display: 'block', height: '100%',
                width: `${Math.round((jarUi / JAR_CAPACITY) * 100)}%`,
                background: 'linear-gradient(90deg, #FFE9B0, #E9789F)',
              }} />
            </span>
          )}
        </div>
      )}

      {/* Milestone / cream shout. */}
      {banner && phase === 'play' && (
        <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1.5" style={{
          top: 'calc(var(--safe-top) + 84px)', zIndex: 30,
          background: INK, borderRadius: 999, border: '2.5px solid #FFE6F0',
          animation: reduced ? undefined : 'jellyComboPop 320ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <span className="font-pixel" style={{ fontSize: 8, color: '#FFE6F0' }}>{banner}</span>
        </div>
      )}

      {/* ── Field ── */}
      <div ref={fieldRef} className="absolute inset-0" style={{ zIndex: 5, willChange: 'transform' }}
        onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); setSteerFrom(e.clientX) }}
        onPointerMove={e => { if (steer.current !== 0) setSteerFrom(e.clientX) }}
        onPointerUp={() => { steer.current = 0 }}
        onPointerCancel={() => { steer.current = 0 }}>

        {/* The spin lives on an INNER span, never on the positioned wrapper.
            A CSS animation on `transform` beats an inline `transform`, so a
            spinning cube would sit at the origin forever while the loop wrote
            a translate nothing honoured — which is exactly what it did. Two
            nested elements = two independent transform channels. */}
        {cubes.current.map(s => (
          <div key={s.id} ref={el => { s.el = el }} aria-hidden style={{
            position: 'absolute', left: 0, top: 0, width: SUGAR_SIZE, height: SUGAR_SIZE,
            willChange: 'transform', pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', inset: 0,
              animation: reduced ? undefined : 'jumpSugarSpin 1.5s linear infinite',
            }}>
              <Sugar />
            </span>
          </div>
        ))}

        {plats.current.map(p => (
          <div key={p.id} ref={el => { p.el = el }} aria-hidden style={{
            position: 'absolute', left: 0, top: 0, width: PLAT_W, height: PLAT_H,
            willChange: 'transform, opacity', pointerEvents: 'none',
            transformOrigin: 'center bottom',
          }}>
            <Platform kind={p.kind} jelly={p.jelly} cracked={p.used} tip={p.tip} />
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
            maxWidth: 296, padding: 18, borderRadius: 16, background: '#FFF8EE',
            border: `3px solid ${INK}`, boxShadow: `0 6px 0 ${INK}`,
          }}>
            <IconJelly size={26} />
            <p className="font-pixel text-center" style={{ fontSize: 11, color: INK }}>JELLY JUMP</p>
            <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.5, color: '#7A4B5E' }}>
              <strong style={{ color: INK }}>Hold</strong> the left or right side to steer him.
              He wraps around the edges.
            </p>
            <div className="w-full flex flex-col gap-1.5 my-0.5">
              <Rule swatch="#D73832" text="JELLIES hold. Bounce them as often as you like." />
              <Rule swatch="#FFF3D6" text="CREAM throws him twice as high." />
              <Rule swatch="#C89B62" text="BISCUITS crack when you land, then give way. The only ones that do." />
              <Rule swatch="#E0A93E" text="LIDS tip. Land on the middle notch and it launches him." />
              <Rule swatch="#4A2A1E" text="SYRUP is heavy — a short, low bounce." />
              <Rule swatch="#FFF3D6" text="SUGAR fills the jar. A full jar catches him once, when he falls." />
            </div>
            <p className="text-center" style={{ fontSize: 10, color: '#9A7484' }}>
              Four rooms to climb through. Slip past the bottom and the run ends.
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
          unit="M" threshold={THRESHOLD} duel={result.duel} wins={wins} awardFailed={awardFailed}
          trayCount={jellies.trayCount} traySize={jellies.traySize}
          onPlayAgain={start}
          onExit={() => router.push('/jelly')}
        />
      )}
    </div>
  )
}

/**
 * A height mark painted across the shaft.
 *
 * Two small plates hugging the walls and a 1px dotted rule between them —
 * never a solid band. JumpScenery's law applies here more than anywhere: this
 * is a line at a height the player desperately wants to reach, and if it looked
 * landable they would aim at it.
 */
const Mark = forwardRef<HTMLDivElement, { colour: string; label: string; value: number }>(
  function Mark({ colour, label, value }, ref) {
    if (value <= 0) return null
    const plate = (side: 0 | 1) => (
      <span key={side} style={{
        position: 'absolute', bottom: 0, [side ? 'right' : 'left']: 0,
        padding: '2px 4px', background: '#26313A', border: `2px solid ${colour}`,
        borderRadius: 3, lineHeight: 1.15, textAlign: side ? 'right' : 'left',
      } as React.CSSProperties}>
        <span className="font-pixel block" style={{ fontSize: 5, color: colour }}>{label}</span>
        <span className="font-pixel block" style={{ fontSize: 6.5, color: '#EAF2F5' }}>{value}</span>
      </span>
    )
    return (
      <div ref={ref} aria-hidden style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 16,
        willChange: 'transform', pointerEvents: 'none', visibility: 'hidden',
      }}>
        <span style={{
          position: 'absolute', left: 40, right: 40, bottom: 1, height: 1,
          background: `repeating-linear-gradient(90deg, ${colour} 0 4px, transparent 4px 11px)`,
          opacity: 0.45,
        }} />
        {plate(0)}
        {plate(1)}
      </div>
    )
  },
)

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
