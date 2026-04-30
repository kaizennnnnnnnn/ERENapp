'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'
import { IconSparkles } from '@/components/PixelIcons'

// ═══════════════════════════════════════════════════════════════════════════
// Pawket Pinball — full table rebuild
// ──────────────────────────────────────────────────────────────────────────
// Real-pinball feature set:
//  · Plunger lane on the right with variable launch power (touch-and-hold)
//  · 3-ball game flow with bonus countdown between balls
//  · Drop target bank (5 targets) → bumping the bank advances the multiplier
//  · Spinner that scores per spin tick
//  · Top rollover lanes (P-A-W) → spell the word to advance the multiplier
//  · Skill shot — first launch landing on the star bumper = big bonus
//  · Ball saver — drain in the first 7 s respawns the ball into the plunger
//  · Multiplier 1x → 5x with glow in the backglass
//  · DMD-style backglass: score, ball #, multiplier, status line
// ═══════════════════════════════════════════════════════════════════════════

// ─── Field geometry ─────────────────────────────────────────────────────────
const W = 320
const H = 600
const BALL_R = 8.5

const PLAY_W       = 276          // playfield right edge (rest is plunger lane)
const LANE_LEFT    = 282          // plunger-lane separator wall x
const LANE_RIGHT   = 316
const PLUNGER_X    = (LANE_LEFT + LANE_RIGHT) / 2
const PLUNGER_REST_Y = H - 28     // ball rests here in the plunger lane
const GLASS_H      = 86           // backglass height (score display, no physics)
const FIELD_TOP    = GLASS_H + 12 // first physical row of playfield

// ─── Physics tuning ─────────────────────────────────────────────────────────
const GRAVITY      = 1280
const FRICTION     = 0.993
const FLIPPER_LERP = 22
const FLIPPER_KICK = 720
const BUMPER_KICK  = 280
const SLING_KICK   = 380
const RESTITUTION  = 0.82

// ─── Game balance ───────────────────────────────────────────────────────────
const BALLS_PER_GAME   = 3
const BALL_SAVER_MS    = 7000
const PLUNGER_MIN_VEL  = 420
const PLUNGER_MAX_VEL  = 1450
const PLUNGER_HOLD_MAX = 1400
const MAX_MULT         = 5

// ─── Types ──────────────────────────────────────────────────────────────────
interface Segment { x1: number; y1: number; x2: number; y2: number }
interface Rollover { x1: number; x2: number; y: number; lit: boolean; label: string; pulseUntil: number }
interface DropTarget { x: number; y: number; w: number; h: number; down: boolean; downAt: number }
interface Spinner { x: number; y: number; len: number; angle: number; angVel: number; hits: number; lastHitMs: number; flashUntil: number }
interface MutBumper { x: number; y: number; r: number; score: number; flashUntil: number; tone: number; kind: 'pop' | 'big' | 'kicker' | 'star' }
interface FlipperCfg { side: 'L' | 'R'; pivotX: number; pivotY: number; length: number; restDeg: number; activeDeg: number }
interface FlipperState { cfg: FlipperCfg; angle: number; target: number; held: boolean }
interface Ball { x: number; y: number; vx: number; vy: number; r: number }

// ─── Static walls ───────────────────────────────────────────────────────────
// Coordinate system: x=0 is left edge, y=0 is the very top of the backglass.
// All physics live in y >= GLASS_H. Plunger lane is x >= LANE_LEFT.
const WALLS: Segment[] = [
  // Playfield top arch with bevelled corners
  { x1: 4,            y1: FIELD_TOP+8,  x2: 16,           y2: FIELD_TOP },
  { x1: 16,           y1: FIELD_TOP,    x2: PLAY_W-22,    y2: FIELD_TOP },
  { x1: PLAY_W-22,    y1: FIELD_TOP,    x2: PLAY_W-4,     y2: FIELD_TOP+18 },

  // Outer walls
  { x1: 4,            y1: FIELD_TOP+8,  x2: 4,            y2: H-150 },     // left
  { x1: PLAY_W-4,     y1: FIELD_TOP+18, x2: PLAY_W-4,     y2: H-150 },     // right (drops to lower angle)

  // Drain funnel — angled walls leading down to the flipper gap
  { x1: 4,            y1: H-150,        x2: PLAY_W*0.16,  y2: H-92 },
  { x1: PLAY_W-4,     y1: H-150,        x2: PLAY_W*0.84,  y2: H-92 },

  // Plunger lane — right wall, bottom and left separator
  { x1: LANE_RIGHT,   y1: FIELD_TOP+18, x2: LANE_RIGHT,   y2: H-12 },      // outer
  { x1: LANE_LEFT,    y1: FIELD_TOP+30, x2: LANE_LEFT,    y2: H-12 },      // inner separator (gap above lets ball drop into field)
  { x1: LANE_LEFT,    y1: H-12,         x2: LANE_RIGHT,   y2: H-12 },      // bottom plate

  // Plunger lane top arch — curves left into the field after launch.
  // Two short segments approximate the metal guide.
  { x1: LANE_RIGHT,   y1: FIELD_TOP+18, x2: PLAY_W-26,    y2: FIELD_TOP+8 },
  { x1: PLAY_W-26,    y1: FIELD_TOP+8,  x2: PLAY_W-22,    y2: FIELD_TOP },
]

// Slingshots — angled rubber walls above the flippers, big outward kick.
const SLINGSHOTS: Segment[] = [
  { x1: PLAY_W*0.16,  y1: H-150,        x2: PLAY_W*0.32,  y2: H-104 },     // left
  { x1: PLAY_W*0.84,  y1: H-150,        x2: PLAY_W*0.68,  y2: H-104 },     // right
]

// Flippers
const FLIPPERS: FlipperCfg[] = [
  { side: 'L', pivotX: PLAY_W*0.32, pivotY: H-90, length: 42, restDeg: 28,  activeDeg: -34 },
  { side: 'R', pivotX: PLAY_W*0.68, pivotY: H-90, length: 42, restDeg: 152, activeDeg: 214 },
]

// Inlane / outlane posts — small vertical guards between slingshot and outer wall
const POSTS: Array<{ x: number; y: number; r: number }> = [
  { x: PLAY_W*0.10, y: H-118, r: 5 },
  { x: PLAY_W*0.90, y: H-118, r: 5 },
]

// ─── Initial mutable state factories ────────────────────────────────────────
const BUMPERS_INIT = (): MutBumper[] => [
  // Top cluster — triangle of pop bumpers with a star at the apex
  { x: PLAY_W*0.50, y: FIELD_TOP+72,  r: 14, score: 200, flashUntil: 0, tone: 659, kind: 'star' },
  { x: PLAY_W*0.30, y: FIELD_TOP+114, r: 14, score: 100, flashUntil: 0, tone: 523, kind: 'pop' },
  { x: PLAY_W*0.70, y: FIELD_TOP+114, r: 14, score: 100, flashUntil: 0, tone: 587, kind: 'pop' },
  // Mid heavy bumper — big yellow
  { x: PLAY_W*0.50, y: H*0.45, r: 16, score: 300, flashUntil: 0, tone: 784, kind: 'big' },
  // Lower kickers, flanking
  { x: PLAY_W*0.18, y: H*0.66, r: 11, score: 80,  flashUntil: 0, tone: 880, kind: 'kicker' },
  { x: PLAY_W*0.82, y: H*0.66, r: 11, score: 80,  flashUntil: 0, tone: 932, kind: 'kicker' },
]

const ROLLOVERS_INIT = (): Rollover[] => [
  { x1: PLAY_W*0.18, x2: PLAY_W*0.32, y: FIELD_TOP+22, lit: false, label: 'P', pulseUntil: 0 },
  { x1: PLAY_W*0.43, x2: PLAY_W*0.57, y: FIELD_TOP+22, lit: false, label: 'A', pulseUntil: 0 },
  { x1: PLAY_W*0.68, x2: PLAY_W*0.82, y: FIELD_TOP+22, lit: false, label: 'W', pulseUntil: 0 },
]

const DROP_TARGETS_INIT = (): DropTarget[] => {
  const baseY = H*0.34
  const w = 22
  const gap = 4
  const total = 5 * w + 4 * gap
  const startX = (PLAY_W - total) / 2
  return Array.from({ length: 5 }).map((_, i) => ({
    x: startX + i * (w + gap),
    y: baseY,
    w,
    h: 8,
    down: false,
    downAt: 0,
  }))
}

const SPINNER_INIT = (): Spinner => ({
  x: PLAY_W*0.16, y: H*0.46,
  len: 22,
  angle: 0,
  angVel: 0,
  hits: 0,
  lastHitMs: 0,
  flashUntil: 0,
})

// ─── Audio helper ───────────────────────────────────────────────────────────
let _ac: AudioContext | null = null
function tone(freq: number, vol = 0.12, dur = 0.18, type: OscillatorType = 'square') {
  if (typeof window === 'undefined') return
  type WebkitAW = Window & { webkitAudioContext?: typeof AudioContext }
  if (!_ac) _ac = new (window.AudioContext || (window as unknown as WebkitAW).webkitAudioContext!)()
  const ac = _ac
  if (ac.state === 'suspended') void ac.resume()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(gain).connect(ac.destination)
  gain.gain.setValueAtTime(0.0001, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
  osc.start()
  osc.stop(ac.currentTime + dur + 0.05)
}

// ─── Geometry helpers ───────────────────────────────────────────────────────
function flipperSegment(f: FlipperState): Segment {
  const rad = f.angle * Math.PI / 180
  return {
    x1: f.cfg.pivotX,
    y1: f.cfg.pivotY,
    x2: f.cfg.pivotX + f.cfg.length * Math.cos(rad),
    y2: f.cfg.pivotY + f.cfg.length * Math.sin(rad),
  }
}

function spinnerSegment(s: Spinner): Segment {
  const r = s.angle * Math.PI / 180
  const half = s.len / 2
  return {
    x1: s.x - half * Math.cos(r),
    y1: s.y - half * Math.sin(r),
    x2: s.x + half * Math.cos(r),
    y2: s.y + half * Math.sin(r),
  }
}

// ─── Component ──────────────────────────────────────────────────────────────
type Phase = 'idle' | 'plunge' | 'play' | 'bonus' | 'gameover'

export default function PawketPinballGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  // ── React state (renders the HUD) ──
  const [phase, setPhase]     = useState<Phase>('idle')
  const [score, setScore]     = useState(0)
  const [bestScore, setBest]  = useState(0)
  const [ballNum, setBallNum] = useState(1)
  const [mult, setMult]       = useState(1)
  const [comboNote, setComboNote] = useState<{ id: number; text: string } | null>(null)
  const [statusLine, setStatusLine] = useState<string>('PLUNGE TO START')
  const [bonus, setBonus]     = useState(0)
  const [plungerCharge, setPlungerCharge] = useState(0)

  // ── Mutable refs (game loop reads/writes these directly) ──
  const phaseRef        = useRef<Phase>('idle')
  const ballRef         = useRef<Ball>({ x: PLUNGER_X, y: PLUNGER_REST_Y, vx: 0, vy: 0, r: BALL_R })
  const flippersRef     = useRef<FlipperState[]>(FLIPPERS.map(cfg => ({ cfg, angle: cfg.restDeg, target: cfg.restDeg, held: false })))
  const bumpersRef      = useRef<MutBumper[]>(BUMPERS_INIT())
  const rolloversRef    = useRef<Rollover[]>(ROLLOVERS_INIT())
  const dropsRef        = useRef<DropTarget[]>(DROP_TARGETS_INIT())
  const spinnerRef      = useRef<Spinner>(SPINNER_INIT())
  const lastFrameRef    = useRef(0)
  const rafRef          = useRef<number>(0)
  const scoreRef        = useRef(0)
  const ballNumRef      = useRef(1)
  const multRef         = useRef(1)
  const bonusRef        = useRef(0)

  // Plunger
  const plungerHoldStartRef = useRef(0)
  const plungerHoldingRef   = useRef(false)
  const plungerChargeRef    = useRef(0)

  // Ball-state
  const ballLockedRef    = useRef(true)            // ball waiting in plunger lane
  const ballSaverEndsRef = useRef(0)               // ms timestamp when ball-saver ends
  const skillShotActiveRef = useRef(false)         // true until first non-launch contact
  const justLaunchedRef    = useRef(false)
  const hitChainRef        = useRef(0)
  const lastHitTimeRef     = useRef(0)
  const savedRef           = useRef(false)         // score persisted to DB

  // Force re-render so SVG reflects ref changes between frames
  const [, force] = useReducer((n: number) => n + 1, 0)

  // ── Helpers ─────────────────────────────────────────────────────────────
  function flashStatus(text: string, ms = 1200) {
    setStatusLine(text)
    const id = ++flashStatusIdRef.current
    setTimeout(() => {
      if (flashStatusIdRef.current === id) setStatusLine(defaultStatusLine())
    }, ms)
  }
  const flashStatusIdRef = useRef(0)
  function defaultStatusLine(): string {
    if (phaseRef.current === 'plunge') return 'PLUNGE TO LAUNCH'
    if (phaseRef.current === 'play') {
      const remain = ballSaverEndsRef.current - performance.now()
      if (remain > 0) return `BALL SAVER ${Math.ceil(remain / 1000)}S`
      return ''
    }
    return ''
  }

  function resetBallToPlunger() {
    ballRef.current = { x: PLUNGER_X, y: PLUNGER_REST_Y, vx: 0, vy: 0, r: BALL_R }
    ballLockedRef.current = true
    plungerChargeRef.current = 0
    setPlungerCharge(0)
    skillShotActiveRef.current = ballNumRef.current === 1
    setStatusLine(skillShotActiveRef.current ? 'SKILL SHOT — STAR BUMPER' : 'PLUNGE TO LAUNCH')
    phaseRef.current = 'plunge'
    setPhase('plunge')
  }

  function startGame() {
    scoreRef.current = 0; setScore(0)
    ballNumRef.current = 1; setBallNum(1)
    multRef.current = 1; setMult(1)
    bonusRef.current = 0; setBonus(0)
    bumpersRef.current = BUMPERS_INIT()
    rolloversRef.current = ROLLOVERS_INIT()
    dropsRef.current = DROP_TARGETS_INIT()
    spinnerRef.current = SPINNER_INIT()
    flippersRef.current.forEach(f => { f.angle = f.cfg.restDeg; f.target = f.cfg.restDeg; f.held = false })
    savedRef.current = false
    resetBallToPlunger()
    lastFrameRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }

  function endGame() {
    cancelAnimationFrame(rafRef.current)
    phaseRef.current = 'gameover'
    setPhase('gameover')
    const final = scoreRef.current
    setBest(b => Math.max(b, final))
    if (!savedRef.current && user?.id && final > 0) {
      savedRef.current = true
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'pawket_pinball', score: final })
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('pawket_pinball save:', error) })
      addCoins(Math.min(80, Math.floor(final / 80)))
      completeTask('daily_game')
      if (final >= 1500) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  // ── Plunger logic ─────────────────────────────────────────────────────────
  function plungerHold() {
    if (!ballLockedRef.current) return
    if (plungerHoldingRef.current) return
    plungerHoldingRef.current = true
    plungerHoldStartRef.current = performance.now()
    tone(110, 0.05, 0.08, 'sawtooth')
  }

  function plungerRelease() {
    if (!plungerHoldingRef.current) return
    plungerHoldingRef.current = false
    if (!ballLockedRef.current) return
    const charge = plungerChargeRef.current
    const v = PLUNGER_MIN_VEL + (PLUNGER_MAX_VEL - PLUNGER_MIN_VEL) * charge
    ballRef.current.vx = 0
    ballRef.current.vy = -v
    ballLockedRef.current = false
    justLaunchedRef.current = true
    ballSaverEndsRef.current = performance.now() + BALL_SAVER_MS
    phaseRef.current = 'play'
    setPhase('play')
    tone(140 + charge * 200, 0.18, 0.32, 'sawtooth')
    setStatusLine(`BALL SAVE ${Math.ceil(BALL_SAVER_MS / 1000)}S`)
  }

  // ── Game loop ───────────────────────────────────────────────────────────
  function loop(now: number) {
    if (phaseRef.current === 'gameover' || phaseRef.current === 'idle') return
    const dt = Math.min(0.025, (now - lastFrameRef.current) / 1000)
    lastFrameRef.current = now

    // Update plunger charge while held
    if (plungerHoldingRef.current && ballLockedRef.current) {
      const held = now - plungerHoldStartRef.current
      const c = Math.min(1, held / PLUNGER_HOLD_MAX)
      plungerChargeRef.current = c
      setPlungerCharge(c)
    }

    // Sub-step the physics so a fast ball doesn't tunnel through walls
    const SUB = 4
    const subDt = dt / SUB
    for (let s = 0; s < SUB; s++) physicsStep(subDt, now)

    // Lerp flipper angles
    for (const f of flippersRef.current) {
      const k = Math.min(1, FLIPPER_LERP * dt)
      f.angle += (f.target - f.angle) * k
    }

    // Spinner inertia + decay
    const sp = spinnerRef.current
    sp.angle += sp.angVel * dt
    sp.angVel *= Math.pow(0.92, dt * 60)

    // Ball saver status countdown text — only update when no flash is active
    // (flashStatus sets text like "MULTIPLIER 2X" that we shouldn't clobber).
    if (phaseRef.current === 'play') {
      const remain = ballSaverEndsRef.current - now
      const sl = statusLineRef.current ?? ''
      if (remain > 0 && (sl === '' || sl.startsWith('BALL SAVE'))) {
        setStatusLine(`BALL SAVE ${Math.ceil(remain / 1000)}S`)
      } else if (remain <= 0 && sl.startsWith('BALL SAVE')) {
        setStatusLine('')
      }
    }

    force()
    rafRef.current = requestAnimationFrame(loop)
  }
  const statusLineRef = useRef<string | null>(null)
  useEffect(() => { statusLineRef.current = statusLine }, [statusLine])

  // ── Physics step ────────────────────────────────────────────────────────
  function physicsStep(dt: number, now: number) {
    const ball = ballRef.current

    if (ballLockedRef.current) {
      // Held in plunger — visually pull the ball down a few px while charging
      ball.x = PLUNGER_X
      ball.y = PLUNGER_REST_Y + plungerChargeRef.current * 14
      ball.vx = 0; ball.vy = 0
      return
    }

    ball.vy += GRAVITY * dt
    ball.vx *= Math.pow(FRICTION, dt * 60)
    ball.vy *= Math.pow(FRICTION, dt * 60)

    // Cap velocity
    const speedSq = ball.vx*ball.vx + ball.vy*ball.vy
    const cap = 1500
    if (speedSq > cap*cap) {
      const s = cap / Math.sqrt(speedSq)
      ball.vx *= s; ball.vy *= s
    }

    ball.x += ball.vx * dt
    ball.y += ball.vy * dt

    // Walls
    for (const w of WALLS) collideSegment(ball, w, false)

    // Plunger-lane gate (one-way): once ball clears the top of the
    // separator, prevent it falling back into the lane.
    if (justLaunchedRef.current && ball.y < FIELD_TOP + 30 && ball.x < LANE_LEFT) {
      justLaunchedRef.current = false
    }

    // Slingshots
    for (const sl of SLINGSHOTS) {
      if (collideSegment(ball, sl, false)) {
        const dx = sl.x2 - sl.x1
        const dy = sl.y2 - sl.y1
        const len = Math.sqrt(dx*dx + dy*dy) || 1
        let nx = -dy / len, ny = dx / len
        const midX = (sl.x1 + sl.x2) / 2
        if ((PLAY_W/2 - midX) * nx < 0) { nx = -nx; ny = -ny }
        ball.vx += nx * SLING_KICK
        ball.vy += ny * SLING_KICK
        tone(660, 0.16, 0.14)
        handleHit(50, 'slingshot')
      }
    }

    // Bumpers
    for (const b of bumpersRef.current) {
      if (collideBumper(ball, b)) {
        b.flashUntil = now + 220
        tone(b.tone, 0.15, 0.18)
        let pts = b.score
        // Skill shot — first contact after a launch on the star bumper
        if (skillShotActiveRef.current && b.kind === 'star') {
          pts += 1500
          flashStatus('SKILL SHOT! +1500', 1600)
          tone(1100, 0.2, 0.4, 'triangle')
        }
        skillShotActiveRef.current = false
        handleHit(pts, b.kind)
      }
    }

    // Posts
    for (const p of POSTS) {
      const dx = ball.x - p.x, dy = ball.y - p.y
      const total = ball.r + p.r
      if (dx*dx + dy*dy < total*total) {
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.0001
        const nx = dx/dist, ny = dy/dist
        const dot = ball.vx*nx + ball.vy*ny
        if (dot < 0) { ball.vx -= 1.7 * dot * nx; ball.vy -= 1.7 * dot * ny }
        const push = total - dist + 0.5
        ball.x += nx * push; ball.y += ny * push
        tone(440, 0.08, 0.06)
      }
    }

    // Drop targets — collide as horizontal segments (top edge), only if up
    for (const dt0 of dropsRef.current) {
      if (dt0.down) continue
      // top edge segment
      const seg: Segment = { x1: dt0.x, y1: dt0.y, x2: dt0.x + dt0.w, y2: dt0.y }
      if (collideSegment(ball, seg, false)) {
        dt0.down = true; dt0.downAt = now
        tone(720, 0.16, 0.20, 'triangle')
        handleHit(120, 'drop')
        // All 5 down? Bump multiplier and reset.
        if (dropsRef.current.every(d => d.down)) {
          // Stagger reset visually
          const after = now + 600
          setTimeout(() => {
            for (const d of dropsRef.current) { d.down = false; d.downAt = 0 }
            force()
          }, 600)
          // Multiplier up
          if (multRef.current < MAX_MULT) {
            multRef.current = Math.min(MAX_MULT, multRef.current + 1)
            setMult(multRef.current)
          }
          flashStatus(`MULTIPLIER ${multRef.current}X!`, 1500)
          tone(1320, 0.2, 0.4, 'triangle')
          handleHit(500, 'drop_bank')
          void after
        }
      }
    }

    // Spinner — segment that the ball passes through, scoring per crossing.
    // We treat it as a thin segment with no restitution; instead we "tick" it
    // when the ball passes over it (within range) and add angular velocity.
    {
      const sp = spinnerRef.current
      const dx = ball.x - sp.x
      const dy = ball.y - sp.y
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (dist < sp.len/2 + ball.r && dist > 4) {
        // throttle hits to avoid a single pass scoring a hundred points
        if (now - sp.lastHitMs > 80) {
          sp.lastHitMs = now
          sp.hits++
          // angular velocity proportional to ball horizontal speed
          sp.angVel += ball.vx * 4
          sp.flashUntil = now + 160
          tone(440 + (sp.hits % 8) * 30, 0.07, 0.07)
          handleHit(20, 'spinner')
        }
      }
    }

    // Rollover lanes — ball passing over an unlit lane lights it
    for (const r of rolloversRef.current) {
      if (r.lit) continue
      if (ball.x >= r.x1 && ball.x <= r.x2 && Math.abs(ball.y - r.y) < ball.r + 4) {
        r.lit = true
        r.pulseUntil = now + 420
        tone(520 + r.label.charCodeAt(0) * 4, 0.14, 0.18, 'triangle')
        handleHit(60, 'rollover')
        // All 3 lit → multiplier up + reset
        if (rolloversRef.current.every(x => x.lit)) {
          if (multRef.current < MAX_MULT) {
            multRef.current = Math.min(MAX_MULT, multRef.current + 1)
            setMult(multRef.current)
          }
          flashStatus(`P-A-W LIT! ${multRef.current}X`, 1500)
          tone(1500, 0.2, 0.5, 'triangle')
          for (const x of rolloversRef.current) x.lit = false
          handleHit(400, 'paw_complete')
        }
      }
    }

    // Flippers
    for (const f of flippersRef.current) {
      const seg = flipperSegment(f)
      if (collideSegment(ball, seg, true, f)) {
        tone(880, 0.12, 0.08)
      }
    }

    // Drain — ball below playfield
    if (ball.y > H + 20) {
      onDrain(now)
    }
  }

  function onDrain(now: number) {
    // Ball saver?
    if (now < ballSaverEndsRef.current) {
      tone(680, 0.12, 0.2, 'triangle')
      flashStatus('BALL SAVED', 1100)
      resetBallToPlunger()
      // Auto-launch with mid-power so it feels generous
      setTimeout(() => {
        if (ballLockedRef.current && phaseRef.current === 'plunge') {
          plungerChargeRef.current = 0.7
          setPlungerCharge(0.7)
          plungerHoldingRef.current = false
          plungerRelease()
        }
      }, 380)
      return
    }
    tone(180, 0.16, 0.45)

    // Banked bonus from drop targets / rollovers
    const earned = bonusRef.current * multRef.current
    scoreRef.current += earned
    setScore(scoreRef.current)
    if (earned > 0) flashStatus(`BONUS +${earned}`, 1400)

    // Reset multiplier and bonus between balls (real pinball convention)
    multRef.current = 1; setMult(1)
    bonusRef.current = 0; setBonus(0)
    rolloversRef.current = ROLLOVERS_INIT()
    dropsRef.current = DROP_TARGETS_INIT()

    if (ballNumRef.current >= BALLS_PER_GAME) {
      setTimeout(endGame, 900)
      return
    }
    ballNumRef.current++
    setBallNum(ballNumRef.current)
    setTimeout(resetBallToPlunger, 900)
  }

  function handleHit(points: number, tag: string) {
    const now = performance.now()
    if (now - lastHitTimeRef.current < 600) hitChainRef.current++
    else hitChainRef.current = 1
    lastHitTimeRef.current = now

    const combo = Math.min(5, hitChainRef.current)
    const gained = points * multRef.current * (combo > 1 ? 2 : 1) // combo doubles on chain
    scoreRef.current += gained
    setScore(scoreRef.current)

    // Bonus accumulator — drop bank and rollovers feed it
    if (tag === 'drop' || tag === 'rollover' || tag === 'spinner') {
      bonusRef.current += Math.floor(points * 0.5)
      setBonus(bonusRef.current)
    }

    if (combo > 1) {
      const note = { id: now, text: `x${combo} · +${gained}` }
      setComboNote(note)
      setTimeout(() => setComboNote(n => n && n.id === note.id ? null : n), 700)
    }
  }

  // ── Collision primitives ────────────────────────────────────────────────
  function collideSegment(ball: Ball, seg: Segment, isFlipper: boolean, flipper?: FlipperState): boolean {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1
    const segLenSq = dx*dx + dy*dy
    if (segLenSq < 0.0001) return false
    let t = ((ball.x - seg.x1) * dx + (ball.y - seg.y1) * dy) / segLenSq
    t = Math.max(0, Math.min(1, t))
    const px = seg.x1 + t * dx, py = seg.y1 + t * dy
    const cx = ball.x - px, cy = ball.y - py
    const distSq = cx*cx + cy*cy
    if (distSq >= ball.r * ball.r) return false
    const dist = Math.sqrt(distSq) || 0.0001
    const nx = cx/dist, ny = cy/dist
    const dot = ball.vx*nx + ball.vy*ny
    if (dot < 0) {
      const e = isFlipper ? 1.0 : RESTITUTION
      ball.vx -= (1+e) * dot * nx
      ball.vy -= (1+e) * dot * ny
    }
    const push = ball.r - dist + 0.5
    ball.x += nx * push; ball.y += ny * push
    if (isFlipper && flipper) {
      const sweep = flipper.target - flipper.angle
      if (Math.abs(sweep) > 1.5) {
        const omegaSign = sweep > 0 ? 1 : -1
        const dxFromPivot = px - flipper.cfg.pivotX
        const dyFromPivot = py - flipper.cfg.pivotY
        const tx = -dyFromPivot * omegaSign
        const ty =  dxFromPivot * omegaSign
        const tLen = Math.sqrt(tx*tx + ty*ty) || 1
        ball.vx += (tx/tLen) * FLIPPER_KICK
        ball.vy += (ty/tLen) * FLIPPER_KICK
      }
    }
    return true
  }

  function collideBumper(ball: Ball, b: MutBumper): boolean {
    const dx = ball.x - b.x, dy = ball.y - b.y
    const total = ball.r + b.r
    const distSq = dx*dx + dy*dy
    if (distSq >= total*total) return false
    const dist = Math.sqrt(distSq) || 0.0001
    const nx = dx/dist, ny = dy/dist
    const dot = ball.vx*nx + ball.vy*ny
    if (dot < 0) {
      ball.vx -= 2 * dot * nx
      ball.vy -= 2 * dot * ny
    }
    ball.vx += nx * BUMPER_KICK
    ball.vy += ny * BUMPER_KICK
    const push = total - dist + 0.5
    ball.x += nx * push; ball.y += ny * push
    return true
  }

  // ── Input handling ──────────────────────────────────────────────────────
  // The playfield is split into 3 regions:
  //   left half (excluding right plunger lane) → left flipper
  //   right half of playfield                  → right flipper
  //   plunger lane (right strip)               → plunger charge/release
  const fieldRef = useRef<HTMLDivElement>(null)
  function regionForX(clientX: number): 'L' | 'R' | 'P' | null {
    const r = fieldRef.current?.getBoundingClientRect()
    if (!r) return null
    const xRel = clientX - r.left
    const wPx = r.width
    // Plunger lane occupies roughly right ~12% of width
    const plungerCutoff = wPx * (LANE_LEFT / W)
    if (xRel >= plungerCutoff) return 'P'
    return xRel < wPx / 2 ? 'L' : 'R'
  }

  function setFlipperHeld(side: 'L' | 'R', held: boolean) {
    const f = flippersRef.current.find(x => x.cfg.side === side)
    if (!f) return
    f.held = held
    f.target = held ? f.cfg.activeDeg : f.cfg.restDeg
  }

  function onPointerDown(e: React.PointerEvent) {
    if (phaseRef.current !== 'plunge' && phaseRef.current !== 'play') return
    const region = regionForX(e.clientX)
    if (!region) return
    if (region === 'P') {
      plungerHold()
    } else {
      setFlipperHeld(region, true)
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const region = regionForX(e.clientX)
    if (!region) return
    if (region === 'P') {
      plungerRelease()
    } else {
      setFlipperHeld(region, false)
    }
  }

  // Keyboard
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (phaseRef.current !== 'plunge' && phaseRef.current !== 'play') return
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setFlipperHeld('L', true)
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setFlipperHeld('R', true)
      if (e.code === 'Space') { e.preventDefault(); plungerHold() }
    }
    function up(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setFlipperHeld('L', false)
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setFlipperHeld('R', false)
      if (e.code === 'Space') plungerRelease()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { cancelAnimationFrame(rafRef.current) }, [])

  // ─── Render ─────────────────────────────────────────────────────────────
  const ball = ballRef.current
  const now = performance.now()

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: '#070512' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'rgba(0,0,0,0.6)',
        borderBottom: '2px solid rgba(167,139,250,0.3)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.12)', borderRadius: 6, border: '2px solid rgba(167,139,250,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-purple-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #312E81, #4F46E5)', border: '2px solid #1E1B4B', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          PAWKET PINBALL
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 4, fontSize: 7, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* Field */}
      <div ref={fieldRef}
        className="flex-1 flex items-center justify-center px-2 py-2"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ touchAction: 'none' }}>
        <div className="relative" style={{
          width: 'min(94vw, 380px)',
          aspectRatio: `${W} / ${H}`,
          background: 'linear-gradient(180deg, #2D1B5E 0%, #1A1A4E 60%, #0A0F2A 100%)',
          border: '4px solid #4C1D95',
          borderRadius: 8,
          boxShadow: '0 4px 0 #2E0F5C, inset 0 0 30px rgba(167,139,250,0.18), 0 0 30px rgba(167,139,250,0.25)',
          overflow: 'hidden',
        }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="ppGlass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0A0420" />
                <stop offset="1" stopColor="#1A0E3A" />
              </linearGradient>
              <linearGradient id="ppLane" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4C1D95" stopOpacity="0.5" />
                <stop offset="1" stopColor="#0F0A1E" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="ppBumperPop" cx="0.35" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#FBCFE8" />
                <stop offset="0.5" stopColor="#EC4899" />
                <stop offset="1" stopColor="#831843" />
              </radialGradient>
              <radialGradient id="ppBumperBig" cx="0.35" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#FDE68A" />
                <stop offset="0.5" stopColor="#FBBF24" />
                <stop offset="1" stopColor="#92400E" />
              </radialGradient>
              <radialGradient id="ppBumperKicker" cx="0.35" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#A3F0C0" />
                <stop offset="0.5" stopColor="#10B981" />
                <stop offset="1" stopColor="#064E3B" />
              </radialGradient>
              <radialGradient id="ppBumperStar" cx="0.35" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="0.4" stopColor="#A78BFA" />
                <stop offset="1" stopColor="#3730A3" />
              </radialGradient>
              <radialGradient id="ppBumperFlash" cx="0.5" cy="0.5" r="0.7">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#FDE68A" />
              </radialGradient>
              <linearGradient id="ppSling" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#7C3AED" />
                <stop offset="0.5" stopColor="#A78BFA" />
                <stop offset="1" stopColor="#7C3AED" />
              </linearGradient>
              <radialGradient id="ppBall" cx="0.3" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="0.5" stopColor="#D1D5DB" />
                <stop offset="1" stopColor="#6B7280" />
              </radialGradient>
              <linearGradient id="ppDrop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#F87171" />
                <stop offset="1" stopColor="#7F1D1D" />
              </linearGradient>
              <linearGradient id="ppDropDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3F3F46" />
                <stop offset="1" stopColor="#18181B" />
              </linearGradient>
              <linearGradient id="ppPlunger" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FBBF24" />
                <stop offset="1" stopColor="#92400E" />
              </linearGradient>
            </defs>

            {/* ── BACKGLASS — score, ball, multiplier, status ─────────── */}
            <rect x="0" y="0" width={W} height={GLASS_H} fill="url(#ppGlass)" />
            <rect x="0" y={GLASS_H-2} width={W} height="2" fill="#A78BFA" opacity="0.6" />
            {/* Inner panel */}
            <rect x="6" y="4" width={W-12} height={GLASS_H-12} fill="rgba(0,0,0,0.55)"
              stroke="rgba(167,139,250,0.4)" strokeWidth="1" rx="3" />
            {/* SCORE label + value */}
            <text x="14" y="22" fontFamily='"Press Start 2P"' fontSize="6" fill="#A78BFA" letterSpacing="2">SCORE</text>
            <text x="14" y="56" fontFamily='"Press Start 2P"' fontSize="22" fill="#FDE68A"
              style={{ filter: 'drop-shadow(0 0 6px rgba(253,230,138,0.7))' }}>
              {String(score).padStart(6, '0')}
            </text>
            {/* BALL */}
            <text x="180" y="22" fontFamily='"Press Start 2P"' fontSize="6" fill="#A78BFA" letterSpacing="2">BALL</text>
            <text x="180" y="40" fontFamily='"Press Start 2P"' fontSize="13" fill="#FFFFFF">{ballNum}/{BALLS_PER_GAME}</text>
            {/* MULTIPLIER */}
            <text x="180" y="60" fontFamily='"Press Start 2P"' fontSize="6" fill="#A78BFA" letterSpacing="2">MULT</text>
            <text x="180" y="78" fontFamily='"Press Start 2P"' fontSize="13"
              fill={mult > 1 ? '#FDE68A' : '#9CA3AF'}
              style={mult > 1 ? { filter: 'drop-shadow(0 0 6px rgba(253,230,138,0.7))' } : undefined}>
              {mult}X
            </text>
            {/* BONUS */}
            <text x="244" y="22" fontFamily='"Press Start 2P"' fontSize="6" fill="#A78BFA" letterSpacing="2">BONUS</text>
            <text x="244" y="40" fontFamily='"Press Start 2P"' fontSize="11" fill="#A3F0C0">{bonus}</text>
            {/* STATUS line */}
            {statusLine && (
              <text x={W/2} y="78" textAnchor="middle"
                fontFamily='"Press Start 2P"' fontSize="7"
                fill={statusLine.includes('SKILL') ? '#FBBF24' : statusLine.includes('SAVE') ? '#A3F0C0' : '#F472B6'}
                style={{ filter: 'drop-shadow(0 0 6px rgba(244,114,182,0.6))' }}>
                {statusLine}
              </text>
            )}

            {/* ── PLAYFIELD GLOW ─────────────────────────────────────── */}
            <rect x="0" y={GLASS_H} width={PLAY_W} height={H-GLASS_H} fill="url(#ppLane)" />

            {/* Plunger lane backdrop */}
            <rect x={LANE_LEFT} y={FIELD_TOP+18} width={LANE_RIGHT-LANE_LEFT} height={H-FIELD_TOP-30}
              fill="rgba(15,10,30,0.8)" stroke="rgba(167,139,250,0.3)" strokeWidth="1" />
            {/* Tick marks on plunger lane (visual cues for power) */}
            {[0.25, 0.5, 0.75].map((p, i) => (
              <line key={i}
                x1={LANE_LEFT+2} x2={LANE_RIGHT-2}
                y1={H-30 - p * 200} y2={H-30 - p * 200}
                stroke="rgba(167,139,250,0.35)" strokeWidth="1" />
            ))}

            {/* Plunger spring graphic */}
            <PlungerSprite charge={plungerCharge} ballLocked={ballLockedRef.current} />

            {/* ── Rollover lanes ─────────────────────────────────────── */}
            {rolloversRef.current.map((r, i) => {
              const lit = r.lit
              const pulsing = r.pulseUntil > now
              return (
                <g key={`rl-${i}`}>
                  {/* Lane channel */}
                  <line x1={r.x1} y1={r.y} x2={r.x2} y2={r.y}
                    stroke={lit ? '#FBBF24' : 'rgba(167,139,250,0.45)'}
                    strokeWidth={lit ? 5 : 3}
                    strokeLinecap="round"
                    style={lit ? { filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.8))' } : undefined} />
                  {/* Lane letter */}
                  <text x={(r.x1 + r.x2)/2} y={r.y - 7} textAnchor="middle"
                    fontFamily='"Press Start 2P"' fontSize="8"
                    fill={lit ? '#FDE68A' : 'rgba(167,139,250,0.6)'}
                    style={lit && pulsing ? { filter: 'drop-shadow(0 0 8px rgba(253,230,138,1))' } : undefined}>
                    {r.label}
                  </text>
                </g>
              )
            })}

            {/* ── Drop targets ───────────────────────────────────────── */}
            {dropsRef.current.map((d, i) => {
              const knocked = d.down
              return (
                <g key={`dt-${i}`}>
                  {!knocked ? (
                    <>
                      <rect x={d.x} y={d.y - d.h} width={d.w} height={d.h}
                        fill="url(#ppDrop)"
                        stroke="#FBBF24" strokeWidth="1.5" rx="1"
                        style={{ filter: 'drop-shadow(0 0 4px rgba(248,113,113,0.5))' }} />
                      {/* Inner highlight */}
                      <rect x={d.x+1} y={d.y - d.h + 1} width={d.w - 2} height="1.5" fill="rgba(255,255,255,0.4)" />
                    </>
                  ) : (
                    <rect x={d.x} y={d.y - 1.5} width={d.w} height="1.5"
                      fill="url(#ppDropDown)" rx="0.5" />
                  )}
                </g>
              )
            })}

            {/* ── Spinner ────────────────────────────────────────────── */}
            <SpinnerSprite spinner={spinnerRef.current} now={now} />

            {/* ── Slingshots ─────────────────────────────────────────── */}
            {SLINGSHOTS.map((sl, i) => {
              const baseX = sl.x1 < PLAY_W/2 ? 4 : PLAY_W-4
              return (
                <g key={`sl-${i}`}>
                  <polygon
                    points={`${sl.x1},${sl.y1} ${sl.x2},${sl.y2} ${baseX},${sl.y2}`}
                    fill="url(#ppSling)"
                    stroke="#1E1B4B" strokeWidth="2"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.55))' }} />
                  <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2}
                    stroke="#FBBF24" strokeWidth="3" strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' }} />
                </g>
              )
            })}

            {/* ── Posts ──────────────────────────────────────────────── */}
            {POSTS.map((p, i) => (
              <circle key={`post-${i}`} cx={p.x} cy={p.y} r={p.r}
                fill="#3F3F46" stroke="#FBBF24" strokeWidth="1.5" />
            ))}

            {/* ── Bumpers ────────────────────────────────────────────── */}
            {bumpersRef.current.map((b, i) => {
              const flashing = b.flashUntil > now
              const fill = flashing
                ? 'url(#ppBumperFlash)'
                : b.kind === 'kicker' ? 'url(#ppBumperKicker)'
                : b.kind === 'star'   ? 'url(#ppBumperStar)'
                : b.kind === 'big'    ? 'url(#ppBumperBig)'
                                      : 'url(#ppBumperPop)'
              const glowColor = b.kind === 'kicker' ? 'rgba(16,185,129,0.5)'
                              : b.kind === 'star'   ? 'rgba(167,139,250,0.7)'
                              : b.kind === 'big'    ? 'rgba(251,191,36,0.5)'
                                                    : 'rgba(236,72,153,0.5)'
              return (
                <g key={`bp-${i}`}>
                  <circle cx={b.x} cy={b.y} r={b.r}
                    fill={fill}
                    stroke="#1A1A2E" strokeWidth="2"
                    style={{ filter: flashing
                      ? 'drop-shadow(0 0 14px #FDE68A)'
                      : `drop-shadow(0 2px 0 rgba(0,0,0,0.5)) drop-shadow(0 0 8px ${glowColor})` }} />
                  <circle cx={b.x - b.r*0.3} cy={b.y - b.r*0.3} r={b.r*0.25}
                    fill="rgba(255,255,255,0.6)" />
                  {b.kind === 'star' ? (
                    <text x={b.x} y={b.y + 3} textAnchor="middle"
                      fontFamily='"Press Start 2P"' fontSize="9" fill="#FFFFFF"
                      style={{ pointerEvents: 'none' }}>★</text>
                  ) : (
                    <text x={b.x} y={b.y + 3} textAnchor="middle"
                      fontFamily='"Press Start 2P"' fontSize="6" fill="rgba(255,255,255,0.85)"
                      style={{ pointerEvents: 'none' }}>{b.score}</text>
                  )}
                </g>
              )
            })}

            {/* ── Walls — drawn for visual structure (top + sides) ──── */}
            {WALLS.map((w, i) => (
              <line key={`w-${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                stroke="#A78BFA" strokeWidth="3" strokeLinecap="round"
                opacity="0.85"
                style={{ filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.5))' }} />
            ))}

            {/* Drain hole indicator */}
            <rect x={PLAY_W*0.32 + 36} y={H-94} width={PLAY_W*0.36 - 72} height="6"
              fill="rgba(220,38,38,0.45)" rx="2" />

            {/* ── Flippers ───────────────────────────────────────────── */}
            {flippersRef.current.map((f, i) => {
              const seg = flipperSegment(f)
              return (
                <g key={`fl-${i}`}>
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                    stroke="#1F2937" strokeWidth="14" strokeLinecap="round" />
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                    stroke="#10B981" strokeWidth="10" strokeLinecap="round" />
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                    stroke="#A3F0C0" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                  <circle cx={f.cfg.pivotX} cy={f.cfg.pivotY} r="6" fill="#1F2937"
                    stroke="#10B981" strokeWidth="2" />
                </g>
              )
            })}

            {/* ── Ball ───────────────────────────────────────────────── */}
            <g style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.6))' }}>
              <circle cx={ball.x} cy={ball.y} r={ball.r} fill="url(#ppBall)" stroke="#1A1A2E" strokeWidth="1.5" />
              <circle cx={ball.x - ball.r*0.4} cy={ball.y - ball.r*0.4} r={ball.r*0.3} fill="rgba(255,255,255,0.7)" />
            </g>

            {/* Combo flash inside the field */}
            {comboNote && (
              <text x={W/2} y={H/2} textAnchor="middle"
                fontFamily='"Press Start 2P"' fontSize="11" fill="#FBBF24"
                style={{ filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.8))', animation: 'pp-combo 0.7s ease-out forwards' }}>
                {comboNote.text}
              </text>
            )}
          </svg>

          {/* Tap-zone overlays — thin coloured strip on each side, plus
              plunger column on the far right. Helps the player learn the
              control split without obscuring the field. */}
          <div className="absolute pointer-events-none flex" style={{ inset: 0, opacity: phase === 'play' || phase === 'plunge' ? 0.05 : 0 }}>
            <div style={{ flex: LANE_LEFT - 0, background: 'linear-gradient(90deg, #10B981 50%, #A78BFA 50%)' }} />
            <div style={{ flex: W - LANE_LEFT, background: '#FBBF24' }} />
          </div>

          {/* Plunger label on far right */}
          {(phase === 'plunge' || phase === 'play') && (
            <div className="absolute pointer-events-none" style={{
              right: 6, bottom: 8, fontFamily: '"Press Start 2P"', fontSize: 6,
              color: '#FBBF24', letterSpacing: 1.5, opacity: ballLockedRef.current ? 1 : 0.4,
              textShadow: '0 0 6px rgba(251,191,36,0.7)',
            }}>
              HOLD →
            </div>
          )}
        </div>
      </div>

      {/* ── Idle modal ─────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="px-6 py-5 flex flex-col items-center gap-3"
            style={{ background: 'rgba(15,10,30,0.92)', border: '3px solid #A78BFA', borderRadius: 6, boxShadow: '0 4px 0 #4C1D95, 0 0 30px rgba(167,139,250,0.5)' }}>
            <p className="font-pixel" style={{ fontSize: 11, letterSpacing: 2, color: '#FDE68A',
              filter: 'drop-shadow(0 0 6px rgba(253,230,138,0.5))' }}>PAWKET PINBALL</p>
            <div className="font-pixel text-center px-2" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 1, lineHeight: 1.8 }}>
              <p>TAP LEFT · LEFT FLIPPER</p>
              <p>TAP RIGHT · RIGHT FLIPPER</p>
              <p style={{ color: '#FBBF24' }}>HOLD PLUNGER LANE TO LAUNCH</p>
              <div className="my-2 mx-auto" style={{ width: 60, height: 1, background: 'rgba(167,139,250,0.4)' }} />
              <p>SPELL P-A-W AT TOP · MULT</p>
              <p>KNOCK 5 RED TARGETS · MULT</p>
              <p>FIRST BALL TO ★ · SKILL SHOT</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #312E81 100%)',
                border: '2px solid #1E1B4B',
                borderRadius: 3,
                boxShadow: '0 4px 0 #1E1B4B',
                fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5,
              }}>
              <IconSparkles size={12} /> START
            </button>
          </div>
        </div>
      )}

      {/* ── Game over ──────────────────────────────────────────────────── */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{
              background: 'linear-gradient(180deg, #15122A 0%, #0F0A1E 100%)',
              border: '3px solid #4F46E5',
              borderRadius: 6,
              boxShadow: '0 6px 0 #1E1B4B, 0 0 30px rgba(79,70,229,0.5)',
              animation: 'pp-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 3 }}>GAME OVER</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>SCORE</span>
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{score}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
              </div>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-3 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
                border: '2px solid #4C1D95',
                borderRadius: 3,
                boxShadow: '0 4px 0 #4C1D95',
                fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5,
              }}>
              <RefreshCw size={11} /> AGAIN
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pp-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes pp-combo {
          0%   { transform: translateY(0) scale(0.7); opacity: 0; }
          30%  { transform: translateY(-12px) scale(1.15); opacity: 1; }
          100% { transform: translateY(-30px) scale(0.95); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── Plunger sprite ─────────────────────────────────────────────────────────
// The plunger is rendered as a yellow rod that retracts down by `charge * 14`
// pixels — mirroring the ball's visual offset in the lane while held.
function PlungerSprite({ charge, ballLocked }: { charge: number; ballLocked: boolean }) {
  const offset = ballLocked ? charge * 14 : 0
  const top = PLUNGER_REST_Y + 16 + offset       // top of the plunger rod
  const bottom = H - 14
  return (
    <g>
      {/* Rod */}
      <rect x={PLUNGER_X-3} y={top} width="6" height={bottom - top} fill="url(#ppPlunger)"
        stroke="#7C2D12" strokeWidth="1" rx="1" />
      {/* Cap (handle) */}
      <rect x={PLUNGER_X-7} y={bottom-3} width="14" height="8" fill="#FBBF24" stroke="#7C2D12" strokeWidth="1.5" rx="1.5" />
      <rect x={PLUNGER_X-5} y={bottom-1} width="10" height="2" fill="#FFFFFF" opacity="0.5" />
    </g>
  )
}

// ─── Spinner sprite ─────────────────────────────────────────────────────────
function SpinnerSprite({ spinner, now }: { spinner: Spinner; now: number }) {
  const seg = spinnerSegment(spinner)
  const flashing = spinner.flashUntil > now
  return (
    <g>
      {/* Mounting post */}
      <circle cx={spinner.x} cy={spinner.y} r="3" fill="#3F3F46" stroke="#A78BFA" strokeWidth="1" />
      {/* Spinner blade */}
      <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
        stroke={flashing ? '#FDE68A' : '#A78BFA'}
        strokeWidth="3" strokeLinecap="round"
        style={{ filter: flashing ? 'drop-shadow(0 0 8px #FDE68A)' : 'drop-shadow(0 0 4px rgba(167,139,250,0.6))' }} />
      {/* Hub */}
      <circle cx={spinner.x} cy={spinner.y} r="2" fill="#FBBF24" />
    </g>
  )
}
