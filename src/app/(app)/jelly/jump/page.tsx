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
//            fresh shelf. Never two at once — but no longer only earned: her
//            line on the wall gives one outright, above the jelly bar.
//
// ── And the three that make the game NOTICE you ────────────────────────────
//   THE CROWN    landing inside 13px of a shelf's middle counts twice on the
//                chain. Under a hold-only input the deepest skill is knowing
//                when to LET GO, and until this the shaft measured that on one
//                shelf in eleven. The landing SHADOW is the instrument for it:
//                without a readout a bullseye is just a withheld payout.
//   SPILT SUGAR  a sting knocks cubes out of the jar and they land on a shelf
//                below. The only thing in the game you can lose, and the only
//                reason to ever go DOWN.
//   THE MARKS    her height today and your all-time best are painted on the
//                wall, and crossing one now pays — a jar for hers, a chain one
//                landing short of a cream launch for your own.
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
import { Platform, Sugar, PLAT_W, PLAT_H, SUGAR_SIZE, CROWN, CROWNED, type PlatKind } from '@/components/jelly/JumpPlatform'
import {
  dealFoe, dripAt, spiderAt, type Foe,
  EREN_HIT_R, WASP_R, BEETLE_R, DROP_R, SPIDER_R, FLIER_RX, FLIER_RY, BEETLE_SPEED, FLIER_SPEED,
} from '@/components/jelly/jumpFoes'
import { FoeSprite, Drop, Spout, SpiderBody, FLIER_SKIN } from '@/components/jelly/JumpFoe'
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
/**
 * A hit is a STUNG HOP, not a death. He pops up 41px (380²/2·1750), gets
 * shoved away from whatever stung him, and loses the chain. From mid-hop that
 * almost always drops him back onto the shelf he left — a hit costs progress,
 * and only costs the run if he was already somewhere he shouldn't be. The jam
 * still catches a real fall. INVULN_MS stops one sting chaining into a second.
 */
const HIT_V = 380
const HIT_SHOVE = 240
const INVULN_MS = 900
/** WASP sits this far above its shelf's top face; BEETLE a little lower. */
const PERCH_Y: Record<'wasp' | 'beetle', number> = { wasp: 9, beetle: 7 }

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
// ── Spilt sugar ────────────────────────────────────────────────────────────
/**
 * How many cubes a sting knocks out of the jar.
 *
 * Nothing in a run could ever be LOST before this. A hazard was a speed bump,
 * the jar was a pure ratchet, and the eighteen cubes between you and a catch
 * were a number that only went up. Now a hit makes a PLACE — the cubes land on
 * a shelf below and sit there — and going back down for them is the only
 * decision in the game whose answer might honestly be no.
 *
 * A FULL, ARMED JAR SPILLS NOTHING. The clamp below subtracts the armed
 * capacity, so a banked catch can never be stolen: a flier patrols the storey
 * midpoint and can sting a player who is already falling, and deleting the
 * catch on that frame turns a hit into a death — in exactly the case the catch
 * exists to cover, and against this game's own law that a hit is a stung hop.
 */
const STING_SPILL = 4
/** How far below him the pile may come to rest, and the gap it keeps. */
const SPILL_DROP_MAX = 200
const SPILL_MIN_DROP = 60
/**
 * Clearance the pile keeps above the kill line, so a visible pile is always a
 * survivable dive. The recycler already culls a cube at cam+H+30 while death
 * fires at cam+H+92, so "if you can see it, you can go and get it" is a
 * property the existing cull windows hand us for free; this only stops a pile
 * being DEALT into the last screenful.
 */
const SPILL_HEADROOM = 150
/** A pile sits this long, fading out over the last stretch of it. */
const SPILL_LIFE = 9000
const SPILL_FADE = 1500
/** Knocked upward first, so a spill reads as scattering rather than dropping. */
const SPILL_V0 = -120
/**
 * A RESTING pile gets a taller pickup window than a cube on an arc, and this
 * is the difference between the feature working and being a no-op.
 *
 * A cube on the arc is met head-on in mid-flight. A resting one sits 10px above
 * the top face while he is 23px above it, and he is only THERE for the instant
 * of a landing. At the arc's SUGAR_RY of 17 that window is 0.5-0.8 frames at
 * ordinary arrival speeds — so more than half of all dives would land squarely
 * on the pile and sweep nothing, which is the worst possible outcome for a
 * mechanic whose whole point is that going back down is a decision you can
 * commit to. 32 gives 2.3-3.7 frames across the whole range of arrival speeds.
 */
const SUGAR_RY_REST = 32
/** Where the four cubes settle either side of the shelf's centre. */
const SPILL_FAN = [-24, -8, 8, 24]
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

// ── The landing shadow ─────────────────────────────────────────────────────
/**
 * The one input finally has an instrument.
 *
 * A hold-left is a guess whose result arrives 0.6s later, judged by eyeballing
 * a 46px cat against a 76px slab with no reference marks on it. The shadow
 * closes that loop: it says where he is over the shelf he is falling toward,
 * and it tightens and darkens as he arrives. Its other half is the tell this
 * game never had — NO shadow means nothing is under you.
 *
 * It is a LIVE POSITION READOUT, not a promise of a landing. Three things can
 * still take the shelf away after it is drawn: DRAG leaves ~51px of coast if he
 * lets go, a slider keeps moving, and a fast enough descent tunnels the
 * collision band entirely (see the guard on the scan). The honest value is
 * 36-93px of late correction on an ordinary hop, and ~42px on a plunge.
 */
const SHADOW_RANGE = 190
/**
 * Clipped to the slab, never wider. At 99 the ellipse overhangs onto the wall
 * on a corner catch, and black-on-#101430 is invisible — so the readout would
 * die in exactly the corner catch it exists for. Truncating at the slab edge
 * says the same thing and survives a dark room.
 */
const SHADOW_CLIP = PLAT_W
const SHADOW_W = 30
const SHADOW_H = 9
const SHADOW_A_MIN = 0.16
/**
 * Deliberately under the 0.52 the design called for. At full strength on a
 * 76px slab a 38px ellipse reads as a HOLE in the shelf rather than a shadow
 * on it, and — worse for a round that ships these two together — it blacks out
 * the crown at exactly the moment the player is deciding whether they are in
 * it. The shadow has to sit UNDER the mark it is helping you hit.
 */
const SHADOW_A_MAX = 0.38
const SHADOW_SX_FAR = 0.62
/** Taper to nothing over the outer few px, or it strobes at the boundary. */
const SHADOW_EDGE = 8
/**
 * Where the top face actually is, per kind — not one constant.
 *
 * A slider sits `bottom: 5, height: 21` in a 26px box, so its crown is at 0
 * while a plain jelly's is at 4. Four px of error on the kind this mechanic
 * exists for, which is 10-26% of the shelves in the shaft.
 */
const SHADOW_TOP: Partial<Record<PlatKind, number>> = { slider: 0, cream: 10, crumb: 5, lid: 5 }
const SHADOW_TOP_DEFAULT = 4
/**
 * A sour shelf keeps its shadow in its own colour — but DARK olive, not the
 * slab's own acid green. The design called for the sour palette at 0.30; the
 * sour palette painted on the sour slab is invisible, which is the one outcome
 * this rule exists to prevent.
 */
const SHADOW_SOUR = '#3F5417'

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
  /**
   * SPILT CUBES ONLY. A cube strung on an arc has none of these and is
   * collectible the instant he touches it; a spilt one is collectible only
   * once it has come to rest.
   *
   * `rest` is the world Y it lands at — Infinity when the hit happened
   * somewhere with no shelf worth piling on, in which case it simply falls
   * away and "there they go" is the outcome.
   */
  vy?: number
  rest?: number
  restX?: number
  restAt?: number
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
  const [brokeTheirs, setBrokeTheirs] = useState(false)
  const [brokeBest, setBrokeBest] = useState(false)
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
  const shadowRef = useRef<HTMLDivElement | null>(null)
  const shadowInnerRef = useRef<HTMLDivElement | null>(null)
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
  const foes = useRef<Foe[]>([])
  /** Shelves dealt since the last hazard — see HAZARD_SPACING in jumpFoes.ts. */
  const hazardCredit = useRef(0)
  const lastPlatId = useRef(-1)
  const invulnUntil = useRef(0)
  /** Red flash on a hit; decays per frame, written as an opacity. */
  const hurtA = useRef(0)
  const hurtRef = useRef<HTMLDivElement | null>(null)
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
  const marksRef = useRef({ theirs: 0, best: 0, name: null as string | null })
  useEffect(() => {
    marksRef.current = { theirs: duel.theirsToday, best: duel.best, name: duel.theirName }
  }, [duel.theirsToday, duel.best, duel.theirName])
  /**
   * The marks as they stood WHEN THIS RUN STARTED, which is what the payouts
   * are gated on.
   *
   * marksRef is rewritten whenever the duel numbers change, and useJellyDuel
   * self-heals on foreground — so if she posts her first score of the day while
   * you are at 400 M, `m >= theirs` goes true on the very next metre and hands
   * you a full jar for climbing nothing. The wall can update mid-run; what it
   * PAYS cannot.
   */
  const runMarks = useRef({ theirs: 0, best: 0 })

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
    const prevKind = lastKind.current
    const punished = prevKind === 'syrup' || prevKind === 'lid'
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

    const id = ++uid
    plats.current.push({
      id,
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
    /**
     * Maybe a hazard for this hop. All the fairness lives in dealFoe(): the
     * spacing, the shelf-below-must-be-waitable rule, the geometry per kind.
     * This site only books what it returns. A sour shelf is pushed BESIDE the
     * real one and never touches lastPlatX, so the chain anchors past it.
     */
    hazardCredit.current++
    const deal = dealFoe({
      W, climbed, heat,
      from: { x: fromX, wy: fromWy, kind: prevKind, id: lastPlatId.current },
      to: { x, wy: nextPlatWy.current, kind, id },
      credit: hazardCredit.current,
      rnd: Math.random,
      nextId: () => ++uid,
    })
    lastPlatId.current = id
    let columnFoe = false
    if (deal) {
      hazardCredit.current = 0
      if (deal.sour) {
        plats.current.push({
          id: ++uid, kind: 'sour', x: deal.sour.x, wy: deal.sour.wy,
          jelly: JELLIES[0],
          used: false, squish: 0, melt: 0, falling: false, fallV: 0, crackAt: 0,
          vx: 0, minX: 0, maxX: 0, tip: 0, phase: 0,
        })
      }
      if (deal.foe) {
        foes.current.push(deal.foe)
        columnFoe = deal.foe.kind === 'drip' || deal.foe.kind === 'spider'
      }
    }

    // No sugar on a hop that owns a column: one thing to read per gap.
    if (!columnFoe && Math.random() < SUGAR_CHANCE) {
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
      // Foes that travel move here too, before any test touches them.
      for (const f of foes.current) {
        if (f.kind === 'beetle') {
          f.ox += f.dir * BEETLE_SPEED * dt
          const lim = PLAT_W / 2 - BEETLE_R - 4
          if (f.ox <= -lim) { f.ox = -lim; f.dir = 1 }
          if (f.ox >= lim) { f.ox = lim; f.dir = -1 }
        } else if (f.kind === 'flier') {
          f.x += f.dir * FLIER_SPEED * dt
          if (f.x <= f.minX) { f.x = f.minX; f.dir = 1 }
          if (f.x >= f.maxX) { f.x = f.maxX; f.dir = -1 }
        }
      }

      /**
       * Every path that puts sugar IN the jar goes through here, so the
       * capacity clamp, the armed latch, the JAR FULL shout and the sound can
       * never drift apart between the cube pickup and anything else that pays
       * in sugar.
       */
      const addSugar = (n: number) => {
        jar.current = Math.min(JAR_CAPACITY, jar.current + n)
        if (jar.current >= JAR_CAPACITY && !jamReady.current) {
          jamReady.current = true
          setJamUi(true)
          playSound('jl_jar')
          shout('JAR FULL')
        }
        setJarUi(jar.current)
      }

      /**
       * The sting. One place, so every hazard hurts the same way and the
       * invulnerability window is honoured by all of them.
       */
      const hurt = (fromX: number) => {
        if (now < invulnUntil.current) return
        invulnUntil.current = now + INVULN_MS
        /**
         * Knock sugar out of the jar and drop it on a shelf below.
         *
         * The armed-capacity subtraction is what makes this safe rather than
         * cruel: at a full jar it spills exactly zero.
         */
        const spill = Math.min(STING_SPILL, jar.current - (jamReady.current ? JAR_CAPACITY : 0))
        if (spill > 0) {
          jar.current -= spill
          setJarUi(jar.current)
          /**
           * Where the pile lands. The highest shelf that is far enough below
           * to be a real trip, close enough to come back from, safely above
           * the kill line, and — the part that is easy to miss — STILL THERE
           * and STILL IN PLACE when he gets back.
           *
           * A slider is excluded for that last reason: its x is frozen at
           * spawn while the shelf roams ±90, so a pile dealt onto one can hang
           * 114px from where the shelf has got to, outside the ±49.5 catch
           * window. The dive would land on nothing, which is a death, in a
           * feature whose entire promise is that what you went down for is
           * where you left it.
           */
          let pile: Plat | null = null
          const floor = cam.current + H + EREN * 2 - SPILL_HEADROOM
          for (const p of plats.current) {
            if (p.falling || p.used) continue
            if (p.kind === 'crumb' || p.kind === 'sour' || p.kind === 'slider') continue
            if (p.wy < c.wy + SPILL_MIN_DROP || p.wy > c.wy + SPILL_DROP_MAX) continue
            if (p.wy > floor) continue
            if (foes.current.some(f => f.host === p.id)) continue
            if (foes.current.some(f => (f.kind === 'drip' || f.kind === 'spider')
              && Math.abs(f.cx - p.x) < 65)) continue
            if (!pile || p.wy < pile.wy) pile = p
          }
          for (let i = 0; i < spill; i++) {
            cubes.current.push({
              id: ++uid, x: c.x, wy: c.wy, vy: SPILL_V0,
              rest: pile ? pile.wy - 10 : Infinity,
              restX: pile ? pile.x + SPILL_FAN[i] : c.x,
            })
          }
          listChanged = true
          playSound('jl_spill')
        }
        c.vy = -HIT_V
        c.vx = (c.x < fromX ? -1 : 1) * HIT_SHOVE
        chain.current = 0
        lastHitWy.current = Infinity
        setChainUi(0)
        hurtA.current = 1
        punch.current = reducedRef.current ? 0 : PUNCH_BIG
        playSound('jl_hit')
        flash('wobble', 520)
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
            // A trap shelf bites instead of bouncing.
            if (p.kind === 'sour') { hurt(p.x); p.squish = 1; break }
            // Something perched on this shelf, under his landing? Stung, not
            // bounced. Tested on the landing frame only: rising past a wasp
            // from below is not touching it.
            let stung = false
            for (const f of foes.current) {
              if (f.host !== p.id) continue
              const fx = p.x + f.ox
              if (Math.abs(c.x - fx) < EREN_HIT_R + (f.kind === 'wasp' ? WASP_R : BEETLE_R)) { hurt(fx); stung = true; break }
            }
            if (stung) { p.squish = 1; break }
            /**
             * The chain counts shelves you CLIMBED. Landing on one that isn't
             * above the last one — a rebound onto the same shelf, or a two-storey
             * drop onto a stranger — breaks it. The old rule only broke on the
             * identical shelf, so falling down the shaft used to build a chain.
             */
            const clean = p.wy < lastHitWy.current - 1
            /**
             * THE CROWN. A landing inside CROWN of the shelf's centre counts
             * TWICE on the chain.
             *
             * Under a hold-only input the deepest skill available is knowing
             * when to LET GO, and until now the shaft read that on exactly one
             * shelf in eleven — the lid's fulcrum. Everywhere else, landing
             * dead centre and landing 49px out on the lip were the same event,
             * so the most practised motion in the game was unmeasured. This
             * prices it, in the currency the chain already spends.
             *
             * Nothing about reachability moves: it writes no velocity, no gap
             * and no reach, and a player who never centres gets the identical
             * run they got before.
             *
             * The perched-foe clause is NOT optional. A beetle roams ±25 and
             * stings within ±25, so whenever it is near its shelf's middle its
             * kill strip completely contains the crown — and the crown would be
             * a painted invitation to land on it.
             */
            const centred = clean
              && CROWNED.includes(p.kind)
              && Math.abs(c.x - p.x) <= CROWN
              && !foes.current.some(f => f.host === p.id)
            const before = chain.current
            if (clean) chain.current += centred ? 2 : 1
            else chain.current = 0
            lastHitWy.current = p.wy
            lastHitId.current = p.id

            /**
             * CROSSED, not modulo. `chain % 8 === 0` silently stops paying the
             * moment the counter can step by two — 7 goes to 9 and never equals
             * 8. Asking whether the step CARRIED past a multiple is exact for
             * both step sizes, and provably identical to the old test for a
             * step of one: (k+1) % n === 0 is true exactly when the floor moves.
             */
            const crossed = (n: number) => Math.floor(chain.current / n) > Math.floor(before / n)
            const earned = chain.current > 0 && crossed(CHAIN_REWARD)
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

            // The crown's payout, said twice: a ring on the shelf and a blip
            // pitched clear of every other landing sound. The ring runs off a
            // custom property so this costs no React — see the keyframe note.
            if (centred) {
              if (p.el) p.el.style.setProperty('--clean', 'running')
              playSound('jl_clean')
            }

            if (big) {
              if (earned && p.kind !== 'cream') shout(`SUGAR RUSH x${chain.current}`)
              else if (p.kind === 'cream') shout('WHIPPED!')
              flash('cheer', 320)
            } else if (chain.current > 0 && crossed(4)) {
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
        /**
         * A SPILT cube in the air is not collectible, and this clause is the
         * whole feature rather than a detail.
         *
         * The spill spawns cubes AT him, and a sour bite or a perched sting
         * calls hurt() from inside the bounce block — which runs before this
         * loop. All four would be swept the same frame at zero distance, and
         * the net jar change would be zero. "You can only sweep a pile that has
         * landed" needs no timer and is a rule the player can see.
         */
        if (s.rest !== undefined && s.wy < s.rest) continue
        const ry = s.restAt !== undefined ? SUGAR_RY_REST : SUGAR_RY
        if (Math.abs(c.x - s.x) > SUGAR_RX || Math.abs(c.wy - s.wy) > ry) continue
        s.wy = Infinity          // marked; the recycler sweeps it this frame
        listChanged = true
        playSound('jl_sugar')
        /**
         * The jar CLAMPS at capacity (see addSugar). It does not zero itself on
         * filling — the jar IS the jam, and the catch spends the whole thing.
         *
         * It used to reset here and raise a separate `ready` flag, so sugar
         * kept banking into a catch you had already earned. By the time you
         * spent one you were most of the way to the next, and a catch read as
         * something you permanently had rather than eighteen cubes you paid.
         */
        addSugar(1)
      }

      // Air hazards. Any direction of travel: a drop lands on him whether he is
      // rising into it or falling onto it.
      for (const f of foes.current) {
        if (f.kind === 'drip') {
          const u = dripAt(f, now)
          if (u === null) continue
          const wy = f.top + u * (f.bot - f.top)
          if (Math.abs(c.x - f.cx) < EREN_HIT_R + DROP_R && Math.abs(c.wy - wy) < EREN_HIT_R + DROP_R) hurt(f.cx)
        } else if (f.kind === 'spider') {
          const wy = f.top + 16 + spiderAt(f, now).u * (f.bot - f.top - 32)
          if (Math.abs(c.x - f.cx) < EREN_HIT_R + SPIDER_R && Math.abs(c.wy - wy) < EREN_HIT_R + SPIDER_R) hurt(f.cx)
        } else if (f.kind === 'flier') {
          if (Math.abs(c.x - f.x) < EREN_HIT_R + FLIER_RX && Math.abs(c.wy - f.wy) < EREN_HIT_R + FLIER_RY) hurt(f.x)
        }
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

      /**
       * The landing shadow. Written here because `cam` is final for the frame
       * and the shelves have already moved — a slider's x this frame is the x
       * the recycler is about to paint, so the shadow can never lag its target.
       *
       * The `c.vy * dt` guard is the tunnelling fix and it is not optional. The
       * collision band is PLAT_H * 0.9 = 23.4px, so any descent faster than
       * ~1400px/s at 60fps — or ~700px/s on a phone that has dropped to 30 —
       * steps straight THROUGH a shelf without ever testing it. Without the
       * guard the shadow would tighten and darken over a shelf he then falls
       * clean through, which is the readout lying at the exact moment it is
       * carrying the most weight.
       */
      let sp: Plat | null = null
      let sd = SHADOW_RANGE
      if (c.vy > 0 && c.vy * dt <= PLAT_H * 0.9) {
        const feet = c.wy + EREN / 2
        for (const p of plats.current) {
          if (p.used || p.falling) continue
          if (Math.abs(c.x - p.x) > PLAT_W / 2 + EREN / 4) continue
          const d = p.wy - feet
          if (d >= 0 && d < sd) { sd = d; sp = p }
        }
      }
      const shOut = shadowRef.current
      const shIn = shadowInnerRef.current
      if (shOut && shIn) {
        if (!sp) shOut.style.opacity = '0'
        else {
          // Nearness drives both channels: darker and wider as he arrives.
          const t = 1 - sd / SHADOW_RANGE
          const dx = c.x - sp.x
          const fade = Math.max(0, Math.min(1,
            (PLAT_W / 2 + EREN / 4 - Math.abs(dx)) / SHADOW_EDGE))
          /**
           * A SOUR shelf keeps its shadow, tinted rather than black. Dropping
           * it would lie in the other direction — the collision does fire on a
           * sour — and a soft black ellipse under the one shelf that bites
           * would teach the eye to read the ellipse instead of the slab.
           */
          const sour = sp.kind === 'sour'
          const lo = sour ? 0.34 : SHADOW_A_MIN
          const hi = sour ? 0.52 : SHADOW_A_MAX
          shOut.style.opacity = String((lo + t * (hi - lo)) * fade)
          shOut.style.transform = `translate3d(${sp.x - SHADOW_CLIP / 2}px, ${
            sp.wy - cam.current + (SHADOW_TOP[sp.kind] ?? SHADOW_TOP_DEFAULT)}px, 0)`
          shIn.style.background = sour ? SHADOW_SOUR : '#000000'
          shIn.style.transform = `translate3d(${SHADOW_CLIP / 2 + dx - SHADOW_W / 2}px, 0, 0) scaleX(${
            SHADOW_SX_FAR + t * (1 - SHADOW_SX_FAR)})`
        }
      }
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
          /**
           * Crossing a line PAYS now.
           *
           * Both latches already existed and did nothing but shout, which meant
           * the single moment this whole two-person framing exists for was the
           * one moment with no consequence. Her line hands you a jar; your own
           * best hands you a chain one landing short of a cream launch. Chasing
           * her becomes the strongest play in the game rather than something
           * you read about on the results card afterwards.
           *
           * ONE banner between them. shout() owns a single timer, so two calls
           * in the same frame — which is exactly the run this feature is for,
           * when her line and your best sit a metre apart — would swallow the
           * first. Beating your own record subsumes beating hers, so it wins.
           */
          const rm = runMarks.current
          let mark: string | null = null
          if (!passedTheirs.current && rm.theirs > 0 && m >= rm.theirs) {
            passedTheirs.current = true
            setBrokeTheirs(true)
            playSound('jl_rival')
            /**
             * The jar, but only above the jelly bar. Below it a free catch
             * lands on any day she happened to score 130 — before the run is
             * even worth extending, which is the opposite of what this is for.
             * Under the bar, and on an already-armed jar, her line pays the
             * chain instead so it is never worth nothing.
             */
            if (m >= THRESHOLD && !jamReady.current) {
              addSugar(JAR_CAPACITY)
            } else {
              chain.current = Math.max(chain.current, CHAIN_REWARD - 1)
              setChainUi(chain.current)
            }
            mark = `${(marksRef.current.name ?? 'HER').slice(0, 7).toUpperCase()} BEATEN`
          }
          if (!passedBest.current && rm.best > 0 && m >= rm.best) {
            passedBest.current = true
            setBrokeBest(true)
            /**
             * One clean landing short of the reward — and it stays fumbleable,
             * because the chain only counts a landing STRICTLY above the last
             * one. A shove you don't finish pays nothing, which is the right
             * shape for a reward for entering new territory.
             */
            chain.current = Math.max(chain.current, CHAIN_REWARD - 1)
            setChainUi(chain.current)
            playSound('jl_chain')
            mark = 'NEW BEST'
          }
          if (mark) shout(mark)
        }
      }

      // Keep a screen and a half of platforms above, recycle below.
      while (nextPlatWy.current > cam.current - H * 0.6) { addPlat(W); listChanged = true }
      plats.current = plats.current.filter(p => {
        if (p.wy - cam.current > H + PLAT_H * 3) { listChanged = true; return false }
        if (p.squish > 0) {
          p.squish = Math.max(0, p.squish - dt * 3.2)
          // The squish IS the ring's clock: both run 312ms, so the animation
          // completes exactly as the shelf finishes recovering, and parks on
          // its own invisible 0% frame.
          if (p.squish === 0 && p.el) p.el.style.setProperty('--clean', 'paused')
        }
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
        let alpha = 1
        if (s.rest !== undefined) {
          if (s.wy < s.rest) {
            // Falls under the CRUMB's gravity, so everything that comes off a
            // shelf in this shaft drops at one rate.
            s.vy = (s.vy ?? 0) + GRAVITY * 0.55 * dt
            s.wy = Math.min(s.rest, s.wy + s.vy * dt)
            /**
             * x EASES to where the pile will sit — it is not integrated from a
             * sideways kick. A 200px fall at 0.55g takes 0.78s, in which any
             * scatter velocity worth seeing would carry a cube a hundred px
             * from the shelf, and the whole sweep arithmetic assumes the four
             * of them are within ±24 of its centre.
             */
            s.x += ((s.restX ?? s.x) - s.x) * Math.min(1, dt * 6)
            if (s.wy === s.rest) s.restAt = now
          } else if (s.restAt !== undefined) {
            const age = now - s.restAt
            if (age > SPILL_LIFE) { listChanged = true; return false }
            if (age > SPILL_LIFE - SPILL_FADE) alpha = (SPILL_LIFE - age) / SPILL_FADE
          }
        }
        if (s.el) {
          s.el.style.transform = `translate3d(${s.x - SUGAR_SIZE / 2}px, ${s.wy - cam.current - SUGAR_SIZE / 2}px, 0)`
          s.el.style.opacity = String(alpha)
          // A cube at rest stops turning. The spin is what says "in flight",
          // and a pile that kept spinning would read as still falling.
          s.el.style.setProperty('--spin', s.restAt !== undefined ? 'paused' : 'running')
        }
        return true
      })

      foes.current = foes.current.filter(f => {
        const host = f.host >= 0 ? plats.current.find(p => p.id === f.host) : undefined
        if (f.host >= 0 && !host) { listChanged = true; return false }
        const low = host ? host.wy : f.kind === 'flier' ? f.wy : f.bot
        if (low - cam.current > H + 60) { listChanged = true; return false }
        if (!f.el) return true
        if (host) {
          // Rides its shelf: a wasp faces inward, a beetle faces its travel.
          const x = host.x + f.ox
          const wy = host.wy - PERCH_Y[f.kind as 'wasp' | 'beetle']
          f.el.style.transform = `translate3d(${x - 11}px, ${wy - cam.current - 8}px, 0)`
          if (f.flip) f.flip.style.transform = `scaleX(${f.kind === 'wasp' ? (f.ox > 0 ? -1 : 1) : f.dir})`
        } else if (f.kind === 'flier') {
          f.el.style.transform = `translate3d(${f.x - 11}px, ${f.wy - cam.current - 8}px, 0)`
          if (f.flip) f.flip.style.transform = `scaleX(${f.dir})`
        } else if (f.kind === 'drip') {
          f.el.style.transform = `translate3d(${f.cx}px, ${f.top - cam.current}px, 0)`
          const u = dripAt(f, now)
          if (f.inner) {
            f.inner.style.opacity = u === null ? '0' : '1'
            f.inner.style.transform = `translateY(${(u ?? 0) * (f.bot - f.top)}px)`
          }
        } else {
          f.el.style.transform = `translate3d(${f.cx}px, ${f.top - cam.current}px, 0)`
          const { u, shiver } = spiderAt(f, now)
          const bodyY = 16 + u * (f.bot - f.top - 32)
          if (f.inner) f.inner.style.transform = `translateY(${bodyY}px)`
          if (f.thread) f.thread.style.transform = `scaleY(${bodyY / (f.bot - f.top)})`
          f.el.style.setProperty('--shiver', shiver && !reducedRef.current ? 'running' : 'paused')
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
        // Blink while he can't be stung again. Meaning-bearing, so it stays
        // on under reduced motion — as a steady dim rather than a flicker.
        const inv = now < invulnUntil.current
        erenRef.current.style.opacity = !inv ? '1' : reducedRef.current ? '0.6' : (Math.floor(now / 70) % 2 ? '0.35' : '1')
      }

      // ── Punch and streaks ──
      // The punch is written to the FIELD, never folded into `cam`: CAM_ANCHOR
      // is one of the two terms in the death test below, so a camera that moved
      // for juice would move the kill line with it. Math.round is load-bearing
      // — a fractional translate on the container resamples the sprite.
      punch.current *= Math.pow(PUNCH_DECAY, dt)
      field.style.transform = `translate3d(0, ${Math.round(punch.current)}px, 0)`
      if (hurtA.current > 0 && hurtRef.current) {
        hurtA.current = Math.max(0, hurtA.current - dt * 4)
        hurtRef.current.style.opacity = String(hurtA.current * 0.5)
      }
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
          // The catch costs the JAR, not a flag. Emptying it here is the whole
          // price: eighteen more cubes before the shaft will catch him again.
          jamReady.current = false
          jar.current = 0
          setJamUi(false)
          setJarUi(0)
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
    // The hazard state. Foes are world-positioned, so a survivor of the last
    // run would hang in the new shaft at whatever height it died at — and a
    // carried-over invulnerability window would make the first sting free.
    foes.current = []
    hazardCredit.current = 0
    lastPlatId.current = -1
    invulnUntil.current = 0
    hurtA.current = 0
    zoneRef.current = 0
    ceilIdxRef.current = 0
    ceilBrokenRef.current = false
    punch.current = 0
    // The field renders in all three phases, so the last frame of the previous
    // run would otherwise still be painted into the first frame of this one.
    if (shadowRef.current) shadowRef.current.style.opacity = '0'
    poseRef.current = 'idle'
    poseHold.current = 0
    passedTheirs.current = false
    passedBest.current = false
    // What the wall is worth for THIS run. See runMarks.
    runMarks.current = { theirs: marksRef.current.theirs, best: marksRef.current.best }
    // Every pending timer from the last run, or one of them fires into this one
    // and clears a banner the new run had just raised.
    if (ceilTimer.current) window.clearTimeout(ceilTimer.current)
    if (poseTimer.current) window.clearTimeout(poseTimer.current)
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current)
    setHeight(0); setChainUi(0); setJarUi(0); setJamUi(false)
    setZoneIdx(0); setCeilIdx(0); setCeilBroken(false)
    // Or Play Again renders both marks already shattered from frame one.
    setBrokeTheirs(false); setBrokeBest(false)
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
        <Mark ref={markTheirsRef} colour="#E9789F" label={(duel.theirName ?? 'HER').slice(0, 7).toUpperCase()} value={duel.theirsToday} broke={brokeTheirs} />
        <Mark ref={markBestRef} colour="#C08A5A" label="BEST" value={duel.best} broke={brokeBest} />
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

      {/* One red wash on a sting, gone in a quarter second. */}
      <div ref={hurtRef} aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 6, background: '#C9283C', opacity: 0 }} />

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
          {jamUi && <span className="font-pixel" style={{ fontSize: 6.5, color: '#FFE6F0' }}>JAM</span>}
          {/* The bar stays up when the jar is full, rather than being replaced
              by a label. A catch DRAINS it, and that drain is the only moment
              the player can see what the catch cost — swapping in a label hid
              exactly the frame that had something to say. */}
          <span aria-hidden style={{
            display: 'block', width: 44, height: 6, borderRadius: 999,
            background: 'rgba(255,255,255,0.18)', overflow: 'hidden',
          }}>
            <span style={{
              display: 'block', height: '100%',
              width: `${jamUi ? 100 : Math.round((jarUi / JAR_CAPACITY) * 100)}%`,
              background: jamUi
                ? 'linear-gradient(90deg, #FFD3E0, #FFF8EE)'
                : 'linear-gradient(90deg, #FFE9B0, #E9789F)',
            }} />
          </span>
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
              // Paused by the loop once a spilt cube lands — see the recycler.
              animationPlayState: 'var(--spin, running)',
            }}>
              <Sugar />
            </span>
          </div>
        ))}

        {plats.current.map(p => {
          // A shelf with something perched on it wears no crown and pays none.
          // This runs on a LIST change, never per frame — a dozen shelves
          // against a handful of foes, a few dozen comparisons a recycle.
          const crown = CROWNED.includes(p.kind) && !foes.current.some(f => f.host === p.id)
          return (
            <div key={p.id} ref={el => { p.el = el }} aria-hidden style={{
              position: 'absolute', left: 0, top: 0, width: PLAT_W, height: PLAT_H,
              willChange: 'transform, opacity', pointerEvents: 'none',
              transformOrigin: 'center bottom',
            }}>
              <Platform kind={p.kind} jelly={p.jelly} cracked={p.used} tip={p.tip} crown={crown} />
              {/* The crown's ring. Its own element, so its keyframe owns a
                  transform channel the loop never writes — the trap this file
                  keeps re-finding. INFINITE and play-state gated, because a
                  finite animation parks on its end frame and can never be
                  re-run by un-pausing it; it would flash once per shelf and
                  then go quiet forever. Centred with margin, never with
                  translate(-50%), for the same channel reason. */}
              {crown && (
                <span aria-hidden style={{
                  position: 'absolute', left: '50%', top: PLAT_H / 2,
                  width: 22, height: 22, marginLeft: -11, marginTop: -11,
                  borderRadius: '50%', border: '2.5px solid #FFF8EE',
                  pointerEvents: 'none', opacity: 0,
                  animation: reduced ? undefined : 'jumpCleanRing 312ms steps(3, end) infinite',
                  animationPlayState: 'var(--clean, paused)',
                }} />
              )}
            </div>
          )
        })}

        {/* The landing shadow, over the shelves and under everything else.
            Outer element is a clip window pinned to the shelf; inner is the
            ellipse, moving inside it with him and truncating at the slab edge.
            Two elements so the clip and the ellipse own separate transforms.
            No INK outline: an outline reads as an object, and this has to read
            as an absence of light. It stays on under reduced motion — it is a
            position readout, not decoration, the same call the file already
            makes for the invulnerability blink. */}
        <div ref={shadowRef} aria-hidden style={{
          position: 'absolute', left: 0, top: 0, width: SHADOW_CLIP, height: SHADOW_H,
          // Rounded like the slab it sits on. A square clip window cuts the
          // ellipse off with a hard vertical edge as he nears the lip, and a
          // black bar standing on a rounded shelf reads as a rendering fault
          // rather than as a shadow running out of shelf.
          borderRadius: '12px 12px 5px 5px',
          overflow: 'hidden', willChange: 'transform, opacity', pointerEvents: 'none',
          opacity: 0,
        }}>
          <div ref={shadowInnerRef} style={{
            position: 'absolute', left: 0, top: 0, width: SHADOW_W, height: SHADOW_H,
            borderRadius: '50%', background: '#000000', willChange: 'transform',
          }} />
        </div>

        {/* Foes draw over the shelves (a wasp SITS on one) and under him. Each
            wrapper is positioned by the loop; anything that flips or idles is
            on a span inside it — see the note atop JumpFoe.tsx. */}
        {foes.current.map(f => (
          <div key={f.id} ref={el => { f.el = el }} aria-hidden style={{
            position: 'absolute', left: 0, top: 0, width: 22, height: 16,
            willChange: 'transform', pointerEvents: 'none',
          }}>
            {f.kind === 'drip' ? (
              <>
                <Spout />
                <span ref={el => { f.inner = el }} style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform, opacity' }}>
                  <Drop />
                </span>
              </>
            ) : f.kind === 'spider' ? (
              <>
                <span ref={el => { f.thread = el }} style={{
                  position: 'absolute', left: -1, top: 0, width: 2, height: f.bot - f.top,
                  background: 'rgba(240,240,255,0.55)', transformOrigin: 'top center', willChange: 'transform',
                }} />
                <span ref={el => { f.inner = el }} style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform' }}>
                  <SpiderBody />
                </span>
              </>
            ) : (
              <span ref={el => { f.flip = el }} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
                <FoeSprite kind={f.kind} skin={FLIER_SKIN[Math.min(zoneIdx, FLIER_SKIN.length - 1)]} reduced={reduced} />
              </span>
            )}
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
              <Rule swatch="#D73832" text="JELLIES hold. Land in the middle and the chain counts double." />
              <Rule swatch="#FFF3D6" text="CREAM throws him twice as high." />
              <Rule swatch="#C89B62" text="BISCUITS crack when you land, then give way. The only ones that do." />
              <Rule swatch="#E0A93E" text="LIDS tip. Land on the middle notch and it launches him." />
              <Rule swatch="#4A2A1E" text="SYRUP is heavy — a short, low bounce." />
              <Rule swatch="#FFF3D6" text="SUGAR fills the jar. A full jar catches him once, when he falls." />
              <Rule swatch="#C9283C" text="A STING spills sugar onto a shelf below. Go back for it, or don't." />
              <Rule swatch="#F4C542" text="WASPS and BEETLES sting. Land beside them, not on them." />
              <Rule swatch="#A9C84A" text="SOUR JELLY bites. It's never the only way up." />
              <Rule swatch="#4A3A5A" text="DRIPS and SPIDERS own a column. Bounce in place and go when it's clear." />
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
const Mark = forwardRef<HTMLDivElement, { colour: string; label: string; value: number; broke?: boolean }>(
  function Mark({ colour, label, value, broke = false }, ref) {
    if (value <= 0) return null
    /**
     * The break animations sit on the PLATES and the chips, never on the
     * wrapper: writeMark writes transform, opacity and visibility to the
     * wrapper every frame, and a keyframe on transform would win and freeze
     * the mark at whatever height it broke at. The plates carry no transform
     * of their own, which is what makes this free.
     */
    const plate = (side: 0 | 1) => (
      <span key={side} style={{
        position: 'absolute', bottom: 0, [side ? 'right' : 'left']: 0,
        padding: '2px 4px', background: '#26313A', border: `2px solid ${colour}`,
        borderRadius: 3, lineHeight: 1.15, textAlign: side ? 'right' : 'left',
        animation: broke
          ? `jumpMarkBreak${side ? 'R' : 'L'} 420ms cubic-bezier(0.16,1,0.3,1) forwards`
          : undefined,
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
          // Dimmed, never removed. The line is BEHIND you now, not gone — you
          // should be able to look back down the shaft and see where it was.
          opacity: broke ? 0.15 : 0.45,
          transition: 'opacity 420ms linear',
        }} />
        {plate(0)}
        {plate(1)}
        {/* Chips off the plates. Only ever mounted on the break, so they cost
            nothing for the whole run up to it. Still edge-anchored: JumpScenery's
            law holds here too, and nothing may cross the play area. */}
        {broke && [0, 1].map(side => [0, 1, 2].map(i => (
          <span key={`${side}${i}`} aria-hidden style={{
            position: 'absolute', bottom: 2 + i * 3, [side ? 'right' : 'left']: 30 + i * 5,
            width: 3, height: 3, background: colour, borderRadius: 1,
            animation: `jumpMarkBreak${side ? 'R' : 'L'} ${340 + i * 70}ms cubic-bezier(0.16,1,0.3,1) forwards`,
            animationDelay: `${i * 40}ms`,
          } as React.CSSProperties} />
        )))}
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
