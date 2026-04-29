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
import { IconStar, IconHeart, IconSparkles } from '@/components/PixelIcons'

// ─── Logical field — rendered as an SVG with this viewBox; scales to screen ─
const W = 320
const H = 540
const BALL_R = 9

// Tuning. Earlier values let the ball gain energy on every bumper hit and
// retain too much on wall reflections, so it bounced forever even without
// flipper input. Heavier gravity + lower restitution + much smaller bumper
// kick puts the ball on a real fall curve; the player has to actively keep
// it alive.
const GRAVITY      = 1500   // px/s²    was 1100
const FRICTION     = 0.99   //          was 0.998 (more air drag)
const FLIPPER_LERP = 20     //          was 18 (slightly snappier)
const FLIPPER_KICK = 280    //          was 320
const BUMPER_KICK  = 140    //          was 280 — halved
const RESTITUTION  = 0.78   //          was 0.92 — wall bounces lose more energy

interface Segment { x1: number; y1: number; x2: number; y2: number }
interface Bumper  { x: number; y: number; r: number; score: number; flashUntil: number; tone: number }
interface FlipperCfg {
  side: 'L' | 'R'
  pivotX: number; pivotY: number
  length: number
  restDeg: number
  activeDeg: number
}

// Side walls run further down (to H-90) so the lower table is open. The
// drain rails are shorter + steeper than before — they only span the last
// ~32 px vertically, leaving the central play area uncluttered.
const WALLS: Segment[] = [
  { x1: 4,     y1: 4,        x2: W-4,    y2: 4 },        // top
  { x1: 4,     y1: 4,        x2: 4,      y2: H-90 },     // left
  { x1: W-4,   y1: 4,        x2: W-4,    y2: H-90 },     // right
  { x1: 4,     y1: H-90,     x2: W*0.32, y2: H-58 },     // left angled drain (shorter)
  { x1: W-4,   y1: H-90,     x2: W*0.68, y2: H-58 },     // right angled drain (shorter)
]

// Flipper length 48 (was 56). Combined with pivots at W*0.32/W*0.68 this
// leaves a ~28 px gap between the flipper tips at rest — wide enough for the
// 18 px ball to drain, narrow enough to be coverable when both flippers
// flip up actively.
const FLIPPERS: FlipperCfg[] = [
  { side: 'L', pivotX: W*0.32, pivotY: H-58, length: 48, restDeg: 25,  activeDeg: -32 },
  { side: 'R', pivotX: W*0.68, pivotY: H-58, length: 48, restDeg: 155, activeDeg: 212 },
]

interface MutBumper { x: number; y: number; r: number; score: number; flashUntil: number; tone: number }
// Smaller bumpers + the bottom one moved up so it doesn't sit as a permanent
// trampoline in the centre of the field.
const BUMPERS_INIT = (): MutBumper[] => [
  { x: W*0.30, y: H*0.28, r: 18, score: 100, flashUntil: 0, tone: 523 },
  { x: W*0.70, y: H*0.28, r: 18, score: 100, flashUntil: 0, tone: 587 },
  { x: W*0.50, y: H*0.16, r: 14, score: 200, flashUntil: 0, tone: 659 },
  { x: W*0.50, y: H*0.42, r: 18, score: 250, flashUntil: 0, tone: 783 },
]

interface FlipperState { cfg: FlipperCfg; angle: number; target: number; held: boolean }

let _ac: AudioContext | null = null
function tone(freq: number, vol = 0.12, dur = 0.18) {
  if (typeof window === 'undefined') return
  type WebkitAW = Window & { webkitAudioContext?: typeof AudioContext }
  if (!_ac) _ac = new (window.AudioContext || (window as unknown as WebkitAW).webkitAudioContext!)()
  const ac = _ac
  if (ac.state === 'suspended') void ac.resume()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  osc.connect(gain).connect(ac.destination)
  gain.gain.setValueAtTime(0.0001, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
  osc.start()
  osc.stop(ac.currentTime + dur + 0.05)
}

function flipperSegment(f: FlipperState): Segment {
  const rad = f.angle * Math.PI / 180
  return {
    x1: f.cfg.pivotX,
    y1: f.cfg.pivotY,
    x2: f.cfg.pivotX + f.cfg.length * Math.cos(rad),
    y2: f.cfg.pivotY + f.cfg.length * Math.sin(rad),
  }
}

interface Ball { x: number; y: number; vx: number; vy: number; r: number }

export default function PawketPinballGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [phase, setPhase]     = useState<'idle' | 'running' | 'gameover'>('idle')
  const [score, setScore]     = useState(0)
  const [bestScore, setBest]  = useState(0)
  const [lives, setLives]     = useState(3)
  const [comboNote, setComboNote] = useState<{ id: number; text: string } | null>(null)

  const stateRef     = useRef<'idle' | 'running' | 'gameover'>('idle')
  const ballRef      = useRef<Ball>({ x: W*0.92, y: H*0.18, vx: 0, vy: 0, r: BALL_R })
  const flippersRef  = useRef<FlipperState[]>(FLIPPERS.map(cfg => ({ cfg, angle: cfg.restDeg, target: cfg.restDeg, held: false })))
  const bumpersRef   = useRef<MutBumper[]>(BUMPERS_INIT())
  const lastFrameRef = useRef(0)
  const rafRef       = useRef<number>(0)
  const scoreRef     = useRef(0)
  const livesRef     = useRef(3)
  const ballLockedRef = useRef(true)  // ball waiting in launcher chute
  const hitChainRef   = useRef(0)
  const lastHitTimeRef = useRef(0)
  const savedRef       = useRef(false)

  const [, force] = useReducer((n: number) => n + 1, 0)

  function resetBall() {
    ballRef.current = { x: W*0.92, y: H*0.18, vx: 0, vy: 0, r: BALL_R }
    ballLockedRef.current = true
  }

  function launchBall() {
    ballLockedRef.current = false
    ballRef.current.vx = -130
    ballRef.current.vy = 220
    tone(330, 0.15, 0.25)
  }

  function startGame() {
    scoreRef.current = 0
    livesRef.current = 3
    setScore(0)
    setLives(3)
    bumpersRef.current = BUMPERS_INIT()
    flippersRef.current.forEach(f => { f.angle = f.cfg.restDeg; f.target = f.cfg.restDeg; f.held = false })
    resetBall()
    savedRef.current = false
    stateRef.current = 'running'
    setPhase('running')
    lastFrameRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }

  function endGame() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'gameover'
    setPhase('gameover')
    const final = scoreRef.current
    setBest(b => Math.max(b, final))
    if (!savedRef.current && user?.id && final > 0) {
      savedRef.current = true
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'pawket_pinball', score: final })
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('pawket_pinball save:', error) })
      addCoins(Math.min(60, Math.floor(final / 80)))
      completeTask('daily_game')
      if (final >= 1500) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function handleHit(points: number, where: { x: number; y: number }, tag: string) {
    const now = performance.now()
    if (now - lastHitTimeRef.current < 600) hitChainRef.current++
    else hitChainRef.current = 1
    lastHitTimeRef.current = now

    const mult = Math.min(5, hitChainRef.current)
    const gained = points * mult
    scoreRef.current += gained
    setScore(scoreRef.current)

    if (mult > 1) {
      const note = { id: now, text: `x${mult} · +${gained}` }
      setComboNote(note)
      setTimeout(() => setComboNote(n => n && n.id === note.id ? null : n), 700)
    }
    void where; void tag
  }

  function loop(now: number) {
    if (stateRef.current !== 'running') return
    const dt = Math.min(0.025, (now - lastFrameRef.current) / 1000)
    lastFrameRef.current = now

    // Sub-step the physics so a fast ball doesn't tunnel through walls.
    const SUB = 4
    const subDt = dt / SUB
    for (let s = 0; s < SUB; s++) physicsStep(subDt, now)

    // Lerp flipper angles toward target
    for (const f of flippersRef.current) {
      const k = Math.min(1, FLIPPER_LERP * dt)
      f.angle += (f.target - f.angle) * k
    }

    force()
    rafRef.current = requestAnimationFrame(loop)
  }

  function physicsStep(dt: number, now: number) {
    const ball = ballRef.current

    if (ballLockedRef.current) {
      // Idle in chute, no physics
      return
    }

    // Gravity + friction
    ball.vy += GRAVITY * dt
    ball.vx *= Math.pow(FRICTION, dt * 60)
    ball.vy *= Math.pow(FRICTION, dt * 60)

    // Cap velocity to keep collisions stable
    const speedSq = ball.vx * ball.vx + ball.vy * ball.vy
    const maxSpeed = 1400
    if (speedSq > maxSpeed * maxSpeed) {
      const s = maxSpeed / Math.sqrt(speedSq)
      ball.vx *= s; ball.vy *= s
    }

    ball.x += ball.vx * dt
    ball.y += ball.vy * dt

    // Walls
    for (const w of WALLS) collideSegment(ball, w, false)

    // Bumpers
    for (const b of bumpersRef.current) {
      if (collideBumper(ball, b)) {
        b.flashUntil = now + 220
        tone(b.tone, 0.15, 0.18)
        handleHit(b.score, { x: b.x, y: b.y }, 'bumper')
      }
    }

    // Flippers
    for (const f of flippersRef.current) {
      const seg = flipperSegment(f)
      if (collideSegment(ball, seg, true, f)) {
        tone(880, 0.12, 0.08)
      }
    }

    // Drain check
    if (ball.y > H + 20) {
      livesRef.current--
      setLives(livesRef.current)
      tone(180, 0.15, 0.4)
      if (livesRef.current <= 0) {
        setTimeout(endGame, 200)
      } else {
        resetBall()
      }
    }
  }

  function collideSegment(ball: Ball, seg: Segment, isFlipper: boolean, flipper?: FlipperState): boolean {
    const dx = seg.x2 - seg.x1
    const dy = seg.y2 - seg.y1
    const segLenSq = dx*dx + dy*dy
    if (segLenSq < 0.0001) return false
    let t = ((ball.x - seg.x1) * dx + (ball.y - seg.y1) * dy) / segLenSq
    t = Math.max(0, Math.min(1, t))
    const px = seg.x1 + t * dx
    const py = seg.y1 + t * dy
    const cx = ball.x - px
    const cy = ball.y - py
    const distSq = cx*cx + cy*cy
    if (distSq >= ball.r * ball.r) return false
    const dist = Math.sqrt(distSq) || 0.0001
    const nx = cx / dist
    const ny = cy / dist

    const dot = ball.vx * nx + ball.vy * ny
    if (dot < 0) {
      const e = isFlipper ? 1.0 : RESTITUTION
      ball.vx -= (1 + e) * dot * nx
      ball.vy -= (1 + e) * dot * ny
    }
    // Push out
    const push = ball.r - dist + 0.5
    ball.x += nx * push
    ball.y += ny * push

    if (isFlipper && flipper) {
      // Apply rotational kick proportional to how much the flipper is mid-swing
      const sweep = flipper.target - flipper.angle  // remaining rotation
      if (Math.abs(sweep) > 1.5) {
        const omegaSign = sweep > 0 ? 1 : -1
        const dxFromPivot = px - flipper.cfg.pivotX
        const dyFromPivot = py - flipper.cfg.pivotY
        // Tangent perpendicular to radius, sense = omega × r (in 2D z-axis cross)
        const tx = -dyFromPivot * omegaSign
        const ty =  dxFromPivot * omegaSign
        const tLen = Math.sqrt(tx*tx + ty*ty) || 1
        ball.vx += (tx / tLen) * FLIPPER_KICK
        ball.vy += (ty / tLen) * FLIPPER_KICK
      }
    }
    return true
  }

  function collideBumper(ball: Ball, bump: MutBumper): boolean {
    const dx = ball.x - bump.x
    const dy = ball.y - bump.y
    const total = ball.r + bump.r
    const distSq = dx*dx + dy*dy
    if (distSq >= total * total) return false
    const dist = Math.sqrt(distSq) || 0.0001
    const nx = dx / dist
    const ny = dy / dist
    const dot = ball.vx * nx + ball.vy * ny
    if (dot < 0) {
      ball.vx -= 2 * dot * nx
      ball.vy -= 2 * dot * ny
    }
    // Bumper kick — bumpers are aggressive
    ball.vx += nx * BUMPER_KICK
    ball.vy += ny * BUMPER_KICK
    // Push out
    const push = total - dist + 0.5
    ball.x += nx * push
    ball.y += ny * push
    return true
  }

  // Touch / pointer handling — half-screen taps activate flippers
  const fieldRef = useRef<HTMLDivElement>(null)
  function activeForX(clientX: number): 'L' | 'R' | null {
    const r = fieldRef.current?.getBoundingClientRect()
    if (!r) return null
    return clientX < r.left + r.width / 2 ? 'L' : 'R'
  }

  function setFlipperHeld(side: 'L' | 'R', held: boolean) {
    const f = flippersRef.current.find(x => x.cfg.side === side)
    if (!f) return
    f.held = held
    f.target = held ? f.cfg.activeDeg : f.cfg.restDeg
    if (held && ballLockedRef.current && side === 'R') {
      // First right-side press launches the ball
      launchBall()
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (stateRef.current !== 'running') return
    const side = activeForX(e.clientX)
    if (side) setFlipperHeld(side, true)
  }
  function onPointerUp(e: React.PointerEvent) {
    const side = activeForX(e.clientX)
    if (side) setFlipperHeld(side, false)
  }

  // Keyboard for desktop
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (stateRef.current !== 'running') return
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setFlipperHeld('L', true)
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setFlipperHeld('R', true)
      if (e.code === 'Space') {
        e.preventDefault()
        if (ballLockedRef.current) launchBall()
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setFlipperHeld('L', false)
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setFlipperHeld('R', false)
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
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: '#0F0A1E' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'rgba(0,0,0,0.55)',
        borderBottom: '2px solid rgba(255,255,255,0.18)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.18)', borderRadius: 6, border: '2px solid rgba(255,255,255,0.45)', boxShadow: '0 2px 0 rgba(0,0,0,0.25)' }}>
          <ChevronLeft size={16} className="text-white" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #312E81, #4F46E5)', border: '2px solid #1E1B4B', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          PAWKET PINBALL
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div>
          <div className="font-pixel" style={{ fontSize: 6, color: '#A78BFA', letterSpacing: 2 }}>SCORE</div>
          <div className="font-pixel" style={{ fontSize: 24, color: '#FFFFFF', textShadow: '2px 2px 0 #2E0F5C', letterSpacing: 1 }}>{score}</div>
        </div>
        {comboNote && (
          <div className="font-pixel" style={{
            background: 'rgba(0,0,0,0.5)',
            border: '2px solid #FBBF24',
            borderRadius: 3, padding: '4px 10px',
            fontSize: 9, color: '#FBBF24', letterSpacing: 2,
            boxShadow: '0 0 12px rgba(251,191,36,0.5)',
          }}>{comboNote.text}</div>
        )}
        <div className="text-right">
          <div className="font-pixel" style={{ fontSize: 6, color: '#A78BFA', letterSpacing: 2 }}>BALLS</div>
          <div className="flex items-center gap-1 justify-end">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ opacity: i < lives ? 1 : 0.2, transition: 'opacity 0.3s' }}>
                <IconHeart size={14} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Field */}
      <div ref={fieldRef}
        className="flex-1 flex items-center justify-center px-3 pb-4"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
            {/* CRT sheen */}
            <defs>
              <linearGradient id="ppLane" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4C1D95" stopOpacity="0.4" />
                <stop offset="1" stopColor="#0F0A1E" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="ppBumper" cx="0.35" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#FBCFE8" />
                <stop offset="0.5" stopColor="#EC4899" />
                <stop offset="1" stopColor="#831843" />
              </radialGradient>
              <radialGradient id="ppBumperBig" cx="0.35" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#FDE68A" />
                <stop offset="0.5" stopColor="#FBBF24" />
                <stop offset="1" stopColor="#92400E" />
              </radialGradient>
              <radialGradient id="ppBumperFlash" cx="0.5" cy="0.5" r="0.6">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#FDE68A" />
              </radialGradient>
              <radialGradient id="ppBall" cx="0.3" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="0.5" stopColor="#D1D5DB" />
                <stop offset="1" stopColor="#6B7280" />
              </radialGradient>
            </defs>

            {/* lane glow */}
            <rect x="0" y="0" width={W} height={H} fill="url(#ppLane)" />

            {/* Bumpers */}
            {bumpersRef.current.map((b, i) => {
              const flashing = b.flashUntil > now
              return (
                <g key={i}>
                  <circle cx={b.x} cy={b.y} r={b.r}
                    fill={flashing ? 'url(#ppBumperFlash)' : (i === 3 ? 'url(#ppBumperBig)' : 'url(#ppBumper)')}
                    stroke="#1A1A2E" strokeWidth="2"
                    style={{ filter: flashing ? 'drop-shadow(0 0 14px #FDE68A)' : 'drop-shadow(0 2px 0 rgba(0,0,0,0.5))' }} />
                  <circle cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.3} r={b.r * 0.25}
                    fill="rgba(255,255,255,0.5)" />
                </g>
              )
            })}

            {/* Walls */}
            {WALLS.map((w, i) => (
              <line key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"
                opacity="0.85"
                style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' }} />
            ))}

            {/* Drain hole indicator */}
            <rect x={W*0.32} y={H-58} width={W*0.36} height="6" fill="rgba(220,38,38,0.4)" />

            {/* Flippers */}
            {flippersRef.current.map((f, i) => {
              const seg = flipperSegment(f)
              return (
                <g key={i}>
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                    stroke="#1F2937" strokeWidth="14" strokeLinecap="round" />
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                    stroke="#10B981" strokeWidth="10" strokeLinecap="round" />
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                    stroke="#A3F0C0" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                  <circle cx={f.cfg.pivotX} cy={f.cfg.pivotY} r="6" fill="#1F2937" stroke="#10B981" strokeWidth="2" />
                </g>
              )
            })}

            {/* Ball */}
            <g style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.6))' }}>
              <circle cx={ball.x} cy={ball.y} r={ball.r} fill="url(#ppBall)" stroke="#1A1A2E" strokeWidth="1.5" />
              <circle cx={ball.x - ball.r * 0.4} cy={ball.y - ball.r * 0.4} r={ball.r * 0.3} fill="rgba(255,255,255,0.7)" />
            </g>

            {/* Launcher hint when ball is locked */}
            {ballLockedRef.current && phase === 'running' && (
              <g>
                <text x={W/2} y={H*0.55} textAnchor="middle"
                  fontFamily='"Press Start 2P"' fontSize="9" fill="#FBBF24"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' }}>
                  TAP RIGHT TO LAUNCH
                </text>
              </g>
            )}
          </svg>

          {/* Tap zone overlays — visual hint only; the SVG above receives events */}
          <div className="absolute pointer-events-none flex" style={{ inset: 0, opacity: phase === 'running' ? 0.06 : 0 }}>
            <div style={{ flex: 1, background: '#10B981' }} />
            <div style={{ flex: 1, background: '#A78BFA' }} />
          </div>
        </div>
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="px-6 py-5 flex flex-col items-center gap-3"
            style={{ background: 'rgba(15,10,30,0.88)', border: '3px solid #A78BFA', borderRadius: 6, boxShadow: '0 4px 0 #4C1D95, 0 0 24px rgba(167,139,250,0.4)' }}>
            <p className="font-pixel" style={{ fontSize: 10, letterSpacing: 2, color: '#FDE68A' }}>PAWKET PINBALL</p>
            <p className="font-pixel text-center" style={{ fontSize: 7, color: '#C4B5FD', letterSpacing: 1, lineHeight: 1.6 }}>
              TAP LEFT · LEFT FLIPPER<br/>
              TAP RIGHT · RIGHT FLIPPER<br/>
              FIRST RIGHT TAP LAUNCHES
            </p>
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

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{
              background: 'linear-gradient(180deg, #15122A 0%, #0F0A1E 100%)',
              border: '3px solid #4F46E5',
              borderRadius: 6,
              boxShadow: '0 6px 0 #1E1B4B, 0 0 24px rgba(79,70,229,0.4)',
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
      `}</style>
    </div>
  )
}

// keep imports
void IconStar; void IconHeart; void IconSparkles
