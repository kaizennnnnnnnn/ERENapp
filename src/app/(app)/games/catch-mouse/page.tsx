'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { RefreshCw, ChevronLeft } from 'lucide-react'
import { IconMouse, IconStar, IconCrown, IconCoin } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { fireMinigameDone } from '@/lib/minigames'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import GameCoinReward from '@/components/games/GameCoinReward'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const MOUSE_SPEED_INIT = 2.2
const GAME_DURATION    = 30

interface MousePos { x: number; y: number; vx: number; vy: number }
interface Particle  { x: number; y: number; vx: number; vy: number; life: number; color: string; kind?: 'spark' | 'dust' | 'star' | 'confetti' }
interface ScorePop  { id: number; x: number; y: number; text: string; color: string; born: number }
interface MissMark  { id: number; x: number; y: number; born: number }
interface ConfettiPiece { id: number; x: number; vx: number; vy: number; color: string; rot: number; vr: number; born: number }

export default function CatchMouseGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef({
    mouse:     { x: 150, y: 150, vx: MOUSE_SPEED_INIT, vy: MOUSE_SPEED_INIT } as MousePos,
    particles: [] as Particle[],
    score:     0,
    timeLeft:  GAME_DURATION,
    running:   false,
    animId:    0,
    timerInterval: 0,
  })

  const [score, setScore]         = useState(0)
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION)
  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [reward, setReward] = useState<GameRewardResult | null>(null)
  const [combo, setCombo]         = useState(0)
  const [scoreBump, setScoreBump] = useState(0)         // increments each catch to retrigger pulse keyframe
  const [shakeNonce, setShakeNonce] = useState(0)       // increments on miss to retrigger shake
  const [scorePops, setScorePops] = useState<ScorePop[]>([])
  const [missMarks, setMissMarks] = useState<MissMark[]>([])
  const [finalScoreDisplay, setFinalScoreDisplay] = useState(0)
  const [confetti, setConfetti]   = useState<ConfettiPiece[]>([])
  const popIdRef    = useRef(0)
  const missIdRef   = useRef(0)
  const confettiIdRef = useRef(0)
  const warnedRef   = useRef(false)
  const lastTickSecRef = useRef(0)
  const peekRef     = useRef({ at: 0, phase: 'idle' as 'idle' | 'peek' | 'dart', side: 0 })
  const lastFrameRef = useRef(0)
  const pausedRef    = useRef(false)
  const hideAtRef    = useRef(0)

  // ── Chibi pixel mouse — smaller, rounder, cuter (14×11) ───────────────────
  // K=outline G=fur P=pink(ear/nose) L=belly E=eye W=white_shine M=tail
  const MOUSE_SPRITE = [
    '...KK....KK...',   // 0 ear tips
    '..KGPK..KPGK..',   // 1 ears w/ pink inside
    '..KGGKKKKGGK..',   // 2 ear base / head top
    '.KGGGGGGGGGGK.',   // 3 head
    'KGGGGGGGGGGGGK',   // 4 head wide
    'KGGEEGGGGEEGGK',   // 5 big eyes
    'KGGEWGGGGEWGGK',   // 6 eye shines
    'KGGGGPPPPGGGGK',   // 7 nose
    'KGGGGGGGGGGGGK',   // 8 cheek
    '.KLLLLLLLLLLK.',   // 9 belly
    '..KKKK..KKKK.M',   // 10 feet + tail stub
  ]
  const MOUSE_PAL: Record<string, string> = {
    '.': 'transparent',
    K: '#1A1A2E',     // dark outline
    G: '#B8A890',     // body fur (softer, lighter warm grey for cuter look)
    L: '#FAEED6',     // belly/light (warmer cream)
    P: '#FFB0C0',     // pink (ear inner + nose)
    E: '#1A1A2E',     // eye (dark)
    W: '#FFFFFF',     // eye shine
    M: '#8C7F6C',     // tail (slightly darker than body)
  }

  function drawPixelMouse(ctx: CanvasRenderingContext2D, mx: number, my: number, facingLeft: boolean) {
    const px = 3  // smaller cell size
    const cols = MOUSE_SPRITE[0].length
    const rows = MOUSE_SPRITE.length
    const ox = Math.round(mx) - Math.round((cols * px) / 2)
    const oy = Math.round(my) - Math.round((rows * px) / 2)

    ctx.save()
    if (facingLeft) {
      ctx.translate(Math.round(mx) * 2, 0)
      ctx.scale(-1, 1)
    }

    // Soft shadow under mouse
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.ellipse(Math.round(mx), oy + rows * px + 2, cols * px * 0.3, 3, 0, 0, Math.PI * 2)
    ctx.fill()

    // Draw sprite
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = MOUSE_SPRITE[y][x]
        const color = MOUSE_PAL[ch]
        if (color && color !== 'transparent') {
          ctx.fillStyle = color
          ctx.fillRect(ox + x * px, oy + y * px, px, px)
        }
      }
    }

    ctx.restore()
  }

  function spawnParticles(x: number, y: number) {
    const colors = ['#FF6B9D', '#FFD700', '#A78BFA', '#4ECDC4', '#FF8C42']
    const burst: Particle[] = Array.from({ length: 12 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 3.5
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: 'spark' as const,
      }
    })
    // Starburst — 4 cardinal "+" spikes that fly outward fast and short
    const stars: Particle[] = [0, 1, 2, 3].map(i => {
      const a = (i * Math.PI) / 2
      return {
        x, y,
        vx: Math.cos(a) * 5.5,
        vy: Math.sin(a) * 5.5,
        life: 0.9,
        color: '#FFF6B0',
        kind: 'star' as const,
      }
    })
    // Soft "POOF" dust ring — 8 pale puffs that drift and fade slowly with no gravity
    const dust: Particle[] = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return {
        x, y,
        vx: Math.cos(a) * 1.2,
        vy: Math.sin(a) * 1.2 - 0.4,
        life: 1.0,
        color: '#F5E6FA',
        kind: 'dust' as const,
      }
    })
    stateRef.current.particles.push(...burst, ...stars, ...dust)
  }

  function pushScorePop(x: number, y: number, text: string, color: string) {
    const id = ++popIdRef.current
    setScorePops(prev => {
      // cap to last 8 to avoid runaway lists
      const next = [...prev, { id, x, y, text, color, born: performance.now() }]
      return next.length > 8 ? next.slice(next.length - 8) : next
    })
    timers.setTimeout(() => {
      setScorePops(prev => prev.filter(p => p.id !== id))
    }, 850)
  }

  function pushMissMark(x: number, y: number) {
    const id = ++missIdRef.current
    setMissMarks(prev => {
      const next = [...prev, { id, x, y, born: performance.now() }]
      return next.length > 6 ? next.slice(next.length - 6) : next
    })
    timers.setTimeout(() => {
      setMissMarks(prev => prev.filter(m => m.id !== id))
    }, 380)
  }

  function fireConfetti() {
    const pieces: ConfettiPiece[] = Array.from({ length: 28 }, () => {
      const id = ++confettiIdRef.current
      const palette = ['#FFD700', '#FF6B9D', '#A78BFA', '#4ECDC4', '#FF8C42', '#7DD3FC']
      return {
        id,
        x: 50 + Math.random() * 220,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -2 - Math.random() * 3,
        color: palette[Math.floor(Math.random() * palette.length)],
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 18,
        born: performance.now(),
      }
    })
    setConfetti(pieces)
    timers.setTimeout(() => setConfetti([]), 2400)
  }

  // ── Draw frame ────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { mouse, particles } = stateRef.current
    const W = canvas.width, H = canvas.height

    // ── Background ──
    ctx.fillStyle = '#FDF6FF'
    ctx.fillRect(0, 0, W, H)

    // Wallpaper dot grid
    ctx.fillStyle = '#EDD8FF'
    for (let gx = 18; gx < W; gx += 36) {
      for (let gy = 18; gy < H - 50; gy += 36) {
        ctx.beginPath()
        ctx.arc(gx, gy, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Floor
    ctx.fillStyle = '#E8D8C8'
    ctx.fillRect(0, H - 50, W, 50)
    ctx.fillStyle = '#F0E4D4'
    ctx.fillRect(0, H - 50, W, 3)
    ctx.strokeStyle = '#D4C4A8'
    ctx.lineWidth = 1
    for (let wx = 0; wx < W; wx += 60) {
      ctx.beginPath()
      ctx.moveTo(wx, H - 50)
      ctx.lineTo(wx + 40, H)
      ctx.stroke()
    }

    // Baseboard
    ctx.fillStyle = '#D0C0B0'
    ctx.fillRect(0, H - 54, W, 4)
    ctx.fillStyle = '#C0B0A0'
    ctx.fillRect(0, H - 50, W, 2)

    // Mouse holes
    ;[[16, H - 50], [W - 50, H - 50]].forEach(([hx, hy]) => {
      ctx.fillStyle = '#2A1A0E'
      ctx.beginPath()
      ctx.ellipse(hx, hy, 16, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1A0E08'
      ctx.beginPath()
      ctx.ellipse(hx, hy, 10, 6, 0, 0, Math.PI * 2)
      ctx.fill()
    })

    // ── Particles ──
    stateRef.current.particles = particles.filter(p => p.life > 0)
    stateRef.current.particles.forEach(p => {
      const kind = p.kind ?? 'spark'
      p.x += p.vx
      p.y += p.vy
      if (kind === 'dust') {
        p.vx *= 0.92
        p.vy *= 0.92
        p.life -= 0.045
      } else if (kind === 'star') {
        p.vx *= 0.86
        p.vy *= 0.86
        p.life -= 0.08
      } else {
        p.vy += 0.15
        p.life -= 0.05
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
      ctx.fillStyle = p.color
      if (kind === 'dust') {
        // Soft pale square, slightly larger as it ages
        const s = 7 + Math.round((1 - p.life) * 4)
        ctx.fillRect(Math.round(p.x) - Math.round(s / 2), Math.round(p.y) - Math.round(s / 2), s, s)
      } else if (kind === 'star') {
        // Pixel "+" starburst
        const cx = Math.round(p.x), cy = Math.round(p.y)
        ctx.fillRect(cx - 1, cy - 4, 2, 8)
        ctx.fillRect(cx - 4, cy - 1, 8, 2)
      } else {
        ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6)
      }
    })
    ctx.globalAlpha = 1

    // ── Pixel mouse ──
    const facingLeft = mouse.vx < 0
    drawPixelMouse(ctx, Math.round(mouse.x), Math.round(mouse.y), facingLeft)

    // ── Time warning vignette + scanline tint (last 10s) ──
    // Decorative full-screen red overlay — skipped under reduced motion.
    if (!reduced && stateRef.current.running && stateRef.current.timeLeft <= 10) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 140)
      // Red vignette gradient (no soft blur — radial pixel feel via alpha steps)
      const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7)
      grad.addColorStop(0, 'rgba(220,38,38,0)')
      grad.addColorStop(1, `rgba(220,38,38,${0.18 + 0.12 * pulse})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      // Faint red scanlines
      ctx.fillStyle = 'rgba(248,113,113,0.08)'
      for (let sy = 0; sy < H; sy += 4) {
        ctx.fillRect(0, sy, W, 1)
      }
    }
  }, [reduced])

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { mouse } = stateRef.current
    const W = canvas.width, H = canvas.height

    // Clamped delta-time, normalized to 60Hz so a 60fps display is unchanged
    // and a 120Hz display doesn't run the mouse at ~2x speed.
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000)
    lastFrameRef.current = now
    const dtScale = dt * 60

    // Cap difficulty multiplier so the mouse can't clip walls at high scores
    const speedMult = Math.min(1 + stateRef.current.score * 0.07, 2.2)
    const peek = peekRef.current

    if (peek.phase === 'peek') {
      // Freeze briefly at a hole, then dart out
      if (performance.now() - peek.at > 300) {
        peek.phase = 'dart'
        // Launch toward room interior
        const dir = peek.side === 0 ? 1 : -1
        mouse.vx = dir * (MOUSE_SPEED_INIT + 1.2)
        mouse.vy = -(MOUSE_SPEED_INIT + Math.random() * 0.8)
      }
    } else {
      mouse.x += mouse.vx * speedMult * dtScale
      mouse.y += mouse.vy * speedMult * dtScale
    }

    // Clamp first, then reflect — prevents tunneling at high speedMult
    if (mouse.x < 22) { mouse.x = 22; if (mouse.vx < 0) mouse.vx *= -1 }
    else if (mouse.x > W - 22) { mouse.x = W - 22; if (mouse.vx > 0) mouse.vx *= -1 }
    if (mouse.y < 22) { mouse.y = 22; if (mouse.vy < 0) mouse.vy *= -1 }
    else if (mouse.y > H - 60) { mouse.y = H - 60; if (mouse.vy > 0) mouse.vy *= -1 }

    if (peek.phase !== 'peek' && Math.random() < 0.025) {
      mouse.vx += (Math.random() - 0.5) * 2
      mouse.vy += (Math.random() - 0.5) * 2
      const spd = Math.sqrt(mouse.vx ** 2 + mouse.vy ** 2)
      if (spd > 5) { mouse.vx = (mouse.vx / spd) * 5; mouse.vy = (mouse.vy / spd) * 5 }
      if (spd > 0 && spd < 1) { mouse.vx = (mouse.vx / spd) * 1; mouse.vy = (mouse.vy / spd) * 1 }
    }

    // Occasionally pop the mouse out of a hole for a tense pause + dart
    if (peek.phase === 'idle' && stateRef.current.score > 0 && Math.random() < 0.0035) {
      const side = Math.random() < 0.5 ? 0 : 1
      const hx = side === 0 ? 16 : W - 50
      const hy = H - 50
      mouse.x = hx
      mouse.y = hy - 6
      mouse.vx = 0
      mouse.vy = 0
      peek.phase = 'peek'
      peek.at = performance.now()
      peek.side = side
    } else if (peek.phase === 'dart' && performance.now() - peek.at > 700) {
      peek.phase = 'idle'
    }

    draw()
    if (stateRef.current.running) {
      stateRef.current.animId = requestAnimationFrame(tick)
    }
  }, [draw])

  function startGame() {
    const s = stateRef.current
    // Flush any stale feedback timers from a prior round so they can't fire
    // a setState into the fresh game.
    timers.clearAll()
    cancelAnimationFrame(s.animId)
    s.score = 0
    s.timeLeft = GAME_DURATION
    s.running = true
    s.particles = []
    s.mouse = { x: 150, y: 150, vx: MOUSE_SPEED_INIT, vy: MOUSE_SPEED_INIT + 0.5 }
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setGameState('running')
    setReward(null)
    setCombo(0)
    setScorePops([])
    setMissMarks([])
    setConfetti([])
    setFinalScoreDisplay(0)
    warnedRef.current = false
    lastTickSecRef.current = 0
    peekRef.current = { at: 0, phase: 'idle', side: 0 }
    pausedRef.current = false
    hideAtRef.current = 0
    lastFrameRef.current = performance.now()

    s.timerInterval = timers.setInterval(() => {
      // Freeze the countdown while the tab is backgrounded.
      if (document.hidden) return
      stateRef.current.timeLeft -= 1
      setTimeLeft(stateRef.current.timeLeft)
      const t = stateRef.current.timeLeft
      if (t === 10 && !warnedRef.current) {
        warnedRef.current = true
        playSound('cm_time_warning')
      }
      if (t > 0 && t <= 3 && lastTickSecRef.current !== t) {
        lastTickSecRef.current = t
        playSound('cm_tick')
      }
      if (t <= 0) endGame()
    }, 1000)

    s.animId = requestAnimationFrame(tick)
  }

  function endGame() {
    const s = stateRef.current
    s.running = false
    cancelAnimationFrame(s.animId)
    timers.clearInterval(s.timerInterval)
    setGameState('finished')
    playSound('cm_gameover')

    // Count-up animation for final score (0 → s.score over ~700ms)
    const finalScore = s.score
    setFinalScoreDisplay(0)
    if (finalScore > 0) {
      const startedAt = performance.now()
      const dur = Math.min(700, 250 + finalScore * 35)
      const stepFn = () => {
        const t = Math.min(1, (performance.now() - startedAt) / dur)
        const eased = 1 - Math.pow(1 - t, 3)
        setFinalScoreDisplay(Math.round(finalScore * eased))
        if (t < 1) requestAnimationFrame(stepFn)
        else setFinalScoreDisplay(finalScore)
      }
      requestAnimationFrame(stepFn)
    }
    if (!reduced && finalScore >= 15) {
      timers.setTimeout(() => fireConfetti(), 220)
    }

    // Coins + high-score save. reportGameResult always pays the participation
    // floor (a weak run is never "nothing") and energy-gates the payout; the
    // score row only persists when score > 0, inside the helper.
    setReward(reportGameResult({ gameType: 'catch_mouse', score: s.score }))
    if (user?.id && s.score > 0) {
      fireMinigameDone('catch_mouse', s.score)
      completeTask('daily_game')
      if (s.score >= 30) completeTask('weekly_high_score')
      if (s.score > 5) applyAction(user.id, 'play')
    }
  }

  function handleTap(e: React.PointerEvent) {
    // Single pointer handler — replaces the old onClick+onTouchStart pair so a
    // touch can't fire twice (the 2nd landing post-teleport as a false miss).
    e.preventDefault()
    if (!stateRef.current.running) return
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const tx = cx * scaleX
    const ty = cy * scaleY

    const { mouse } = stateRef.current
    const dist = Math.sqrt((tx - mouse.x) ** 2 + (ty - mouse.y) ** 2)
    if (dist < 38) {  // slightly tighter hitbox to match smaller sprite
      stateRef.current.score += 1
      const newScore = stateRef.current.score
      setScore(newScore)
      setScoreBump(b => b + 1)
      if (!reduced) spawnParticles(mouse.x, mouse.y)
      // Floating "+1" at catch coordinate, in screen-space
      pushScorePop(cx, cy, '+1', '#FFE05A')

      // Combo logic — every 5th in a row plays the combo chime
      setCombo(prev => {
        const next = prev + 1
        if (next > 0 && next % 5 === 0) {
          playSound('cm_combo')
          pushScorePop(cx, cy - 14, `x${next}!`, '#FF6B9D')
        } else {
          playSound('cm_catch')
        }
        return next
      })

      // Reset peek state on a catch
      peekRef.current = { at: 0, phase: 'idle', side: 0 }

      stateRef.current.mouse.x = 60 + Math.random() * (canvas.width - 120)
      stateRef.current.mouse.y = 40 + Math.random() * (canvas.height - 120)
      stateRef.current.mouse.vx = (Math.random() > 0.5 ? 1 : -1) * (MOUSE_SPEED_INIT + Math.random() * 2)
      stateRef.current.mouse.vy = (Math.random() > 0.5 ? 1 : -1) * (MOUSE_SPEED_INIT + Math.random() * 2)
    } else {
      // MISS — soft thud, screen-space "X" ring, small shake, combo break
      playSound('cm_miss')
      pushMissMark(cx, cy)
      if (!reduced) setShakeNonce(n => n + 1)
      setCombo(0)
    }
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(stateRef.current.animId)
    }
  }, [])

  // ── Pause-on-hidden ──
  // Cancel the rAF when backgrounded; rebase the frame clock and peek/dart
  // wall-clock anchors on return so the mouse doesn't teleport. The countdown
  // setInterval freezes via its own `if (document.hidden) return` guard.
  const handleHide = useCallback(() => {
    if (!stateRef.current.running || pausedRef.current) return
    pausedRef.current = true
    hideAtRef.current = performance.now()
    cancelAnimationFrame(stateRef.current.animId)
  }, [])

  const handleShow = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    const elapsed = performance.now() - hideAtRef.current
    // Shift the peek timestamp forward so its 300ms/700ms windows don't fire
    // instantly on return.
    peekRef.current.at += elapsed
    lastFrameRef.current = performance.now()
    if (stateRef.current.running) {
      stateRef.current.animId = requestAnimationFrame(tick)
    }
  }, [tick])

  useVisibilityPause(handleHide, handleShow)

  useEffect(() => { if (gameState === 'idle') draw() }, [gameState, draw])

  const timeWarning = timeLeft <= 10
  const timePct = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="page-scroll">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => { playSound('ui_back'); router.back() }} className="flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #F5C842, #E8A020)', paddingLeft: 6 }}>
          <IconMouse size={14} />
          <span>CATCH THE MOUSE</span>
        </span>
      </div>

      {/* ── Premium HUD ── */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="relative overflow-hidden py-3 px-3"
          style={{
            background: 'linear-gradient(180deg, #2D1659 0%, #180736 100%)',
            borderRadius: 4,
            border: '2px solid #A78BFA',
            boxShadow: '0 3px 0 #4C1D95, inset 0 1px 0 rgba(255,255,255,0.18), 0 0 10px rgba(167,139,250,0.25)',
          }}>
          <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: 3, background: '#FFD700' }} />
          <div style={{ position: 'absolute', top: 2, right: 2, width: 3, height: 3, background: '#FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, left: 2, width: 3, height: 3, background: '#FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 3, height: 3, background: '#FFD700' }} />
          <div className="flex items-center gap-1 mb-1">
            <IconStar size={10} />
            <span className="font-pixel text-purple-300" style={{ fontSize: 6, letterSpacing: 2 }}>SCORE</span>
          </div>
          <span
            key={`s-${scoreBump}`}
            className="font-pixel text-white inline-block"
            style={{
              fontSize: 22,
              textShadow: '2px 2px 0 #4C1D95, 0 0 6px rgba(167,139,250,0.6)',
              letterSpacing: -0.5,
              animation: scoreBump > 0 ? 'scorePulse 260ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              transformOrigin: 'left center',
            }}
          >{score}</span>
          {combo >= 2 && (
            <span
              className="font-pixel absolute"
              style={{
                right: 8, bottom: 6,
                fontSize: 7,
                color: combo >= 5 ? '#FFD700' : '#FF6B9D',
                textShadow: '1px 1px 0 #4C1D95',
                letterSpacing: 1,
              }}
            >x{combo}</span>
          )}
        </div>

        <div className="relative overflow-hidden py-3 px-3"
          style={{
            background: timeWarning
              ? 'linear-gradient(180deg, #5A1A1A 0%, #3A0808 100%)'
              : 'linear-gradient(180deg, #2D1659 0%, #180736 100%)',
            borderRadius: 4,
            border: timeWarning ? '2px solid #F87171' : '2px solid #A78BFA',
            boxShadow: timeWarning ? '0 3px 0 #7A1A1A, 0 0 10px rgba(248,113,113,0.4)' : '0 3px 0 #4C1D95, 0 0 10px rgba(167,139,250,0.25)',
            animation: !reduced && timeWarning && gameState === 'running' ? 'timerPulse 0.6s ease-in-out infinite' : 'none',
          }}>
          <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: 3, background: timeWarning ? '#FCA5A5' : '#FFD700' }} />
          <div style={{ position: 'absolute', top: 2, right: 2, width: 3, height: 3, background: timeWarning ? '#FCA5A5' : '#FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, left: 2, width: 3, height: 3, background: timeWarning ? '#FCA5A5' : '#FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 3, height: 3, background: timeWarning ? '#FCA5A5' : '#FFD700' }} />
          <div className="flex items-center gap-1 mb-1">
            <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 2, color: timeWarning ? '#FCA5A5' : '#C4B5FD' }}>TIME</span>
          </div>
          <span className="font-pixel" style={{ fontSize: 22, color: timeWarning ? '#FFA0A0' : '#FFFFFF', textShadow: timeWarning ? '2px 2px 0 #7A1A1A' : '2px 2px 0 #4C1D95', letterSpacing: -0.5 }}>{timeLeft}s</span>
        </div>
      </div>

      {/* Time progress bar */}
      <div className="mb-3 relative overflow-hidden" style={{
        height: 8,
        background: '#0F0820',
        border: '1px solid rgba(167,139,250,0.3)',
        borderRadius: 2,
        boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          height: '100%',
          width: `${timePct}%`,
          background: timeWarning
            ? 'linear-gradient(180deg, #FFA0A0 0%, #DC2626 100%)'
            : 'linear-gradient(180deg, #C084FC 0%, #7C3AED 100%)',
          transition: 'width 0.9s linear, background 0.3s',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,0.3) calc(10% - 1px) 10%)',
        }} />
      </div>

      {/* ── Canvas ── */}
      <div
        key={`shake-${shakeNonce}`}
        className="mb-4 relative"
        style={{
          borderRadius: 4,
          border: '3px solid #D8C0F0',
          boxShadow: '4px 4px 0 #C0A0E0',
          overflow: 'hidden',
          animation: shakeNonce > 0 ? 'cmShake 200ms steps(6, end)' : 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={320}
          className="w-full touch-none block"
          style={{ cursor: gameState === 'running' ? 'crosshair' : 'default', display: 'block' }}
          onPointerDown={handleTap}
        />

        {/* Score popups (screen-space, layered over canvas) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {scorePops.map(p => (
            <span
              key={p.id}
              className="font-pixel absolute"
              style={{
                left: p.x,
                top: p.y,
                fontSize: 10,
                color: p.color,
                textShadow: '1px 1px 0 #4C1D95',
                transform: 'translate(-50%, -50%)',
                animation: 'cmScorePop 820ms ease-out forwards',
                letterSpacing: 1,
                whiteSpace: 'nowrap',
              }}
            >{p.text}</span>
          ))}
          {missMarks.map(m => (
            <span
              key={m.id}
              className="font-pixel absolute"
              style={{
                left: m.x,
                top: m.y,
                fontSize: 12,
                color: '#FF4D6D',
                textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
                transform: 'translate(-50%, -50%)',
                animation: 'cmMissMark 380ms steps(4, end) forwards',
              }}
            >x</span>
          ))}
        </div>

        {/* ── Overlays ── */}
        {gameState !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
            style={{ background: 'rgba(253,246,255,0.92)' }}>
            {gameState === 'idle' && (
              <>
                <div className="mb-3" style={{ animation: reduced ? 'none' : 'mouseBob 1.2s ease-in-out infinite', transform: 'scale(3)' }}>
                  <IconMouse size={20} />
                </div>
                <p className="font-pixel text-gray-700 mb-1" style={{ fontSize: 10, letterSpacing: 1 }}>CATCH THE MOUSE!</p>
                <p className="text-xs text-gray-500 mb-5 text-center px-8 leading-relaxed">
                  Tap / click the pixel mouse as fast as you can in {GAME_DURATION} seconds
                </p>
                <button onClick={() => { playSound('ui_tap'); startGame() }}
                  className="px-8 py-3 text-white active:translate-y-[2px] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '0 4px 0 #991A4A, 0 0 12px rgba(255,107,157,0.45)', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 2 }}>
                  ▶ START
                </button>
              </>
            )}
            {gameState === 'finished' && (
              <>
                {/* Confetti shower (only for AMAZING runs) */}
                {confetti.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {confetti.map(c => (
                      <span
                        key={c.id}
                        style={{
                          position: 'absolute',
                          left: c.x,
                          top: -10,
                          width: 5,
                          height: 5,
                          background: c.color,
                          transform: `rotate(${c.rot}deg)`,
                          animation: 'cmConfettiFall 2200ms linear forwards',
                          animationDelay: `${(c.id % 14) * 35}ms`,
                          imageRendering: 'pixelated',
                          boxShadow: '1px 1px 0 rgba(0,0,0,0.15)',
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="mb-2 relative" style={{ animation: reduced ? 'none' : 'cmCrownBob 1.6s ease-in-out infinite' }}>
                  <IconCrown size={28} />
                  {!reduced && score >= 15 && (
                    <>
                      <span style={{ position: 'absolute', top: -4, left: -6, width: 3, height: 3, background: '#FFF6B0', boxShadow: '0 0 0 1px #FFD700', animation: 'cmSparkle 1.4s ease-in-out infinite', imageRendering: 'pixelated' }} />
                      <span style={{ position: 'absolute', top: 2, right: -8, width: 3, height: 3, background: '#FFF6B0', boxShadow: '0 0 0 1px #FFD700', animation: 'cmSparkle 1.4s ease-in-out 0.4s infinite', imageRendering: 'pixelated' }} />
                      <span style={{ position: 'absolute', bottom: -2, left: 2, width: 3, height: 3, background: '#FFF6B0', boxShadow: '0 0 0 1px #FFD700', animation: 'cmSparkle 1.4s ease-in-out 0.8s infinite', imageRendering: 'pixelated' }} />
                    </>
                  )}
                </div>
                <p
                  className="font-pixel text-[#FF6B9D] mb-1"
                  style={{
                    fontSize: 22,
                    textShadow: '2px 2px 0 rgba(204,51,102,0.3)',
                    animation: finalScoreDisplay === score && score > 0 ? 'scorePulse 380ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                  }}
                >{finalScoreDisplay}</p>
                <p className="font-pixel text-gray-600 mb-3" style={{ fontSize: 7, letterSpacing: 2 }}>MICE CAUGHT</p>
                <p className="font-pixel text-gray-500 mb-1" style={{ fontSize: 6 }}>
                  {score >= 15 ? '★ AMAZING! ★' : score >= 8 ? '★ GREAT JOB! ★' : 'GOOD EFFORT!'}
                </p>
                {reward && (
                  <div className="mb-4">
                    <GameCoinReward coins={reward.coins} blocked={reward.blocked} />
                  </div>
                )}
                <div className="flex gap-3 mt-1">
                  <button onClick={() => { playSound('ui_tap'); startGame() }}
                    className="px-4 py-2 text-white active:translate-y-[1px] transition-transform flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '2px 2px 0 #991A4A', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                    <RefreshCw size={10} /> RETRY
                  </button>
                  <button onClick={() => { playSound('ui_back'); router.back() }}
                    className="px-4 py-2 text-white active:translate-y-[1px] transition-transform"
                    style={{ background: 'linear-gradient(135deg, #475569, #1F2937)', borderRadius: 3, border: '2px solid #0F172A', boxShadow: '2px 2px 0 #0F172A', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                    EXIT
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="font-pixel text-gray-400 text-center" style={{ fontSize: 6 }}>
        TAP / CLICK THE MOUSE TO CATCH IT!
      </p>

      <style jsx>{`
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes mouseBob {
          0%, 100% { transform: scale(3) translateY(0); }
          50% { transform: scale(3) translateY(-4px); }
        }
        @keyframes scorePulse {
          0%   { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,215,0,0)); }
          40%  { transform: scale(1.25); filter: drop-shadow(0 0 4px rgba(255,215,0,0.9)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,215,0,0)); }
        }
        @keyframes cmShake {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-3px, 1px); }
          40%  { transform: translate(2px, -2px); }
          60%  { transform: translate(-2px, 2px); }
          80%  { transform: translate(2px, 1px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes cmScorePop {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -60%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -120%) scale(1); opacity: 0; }
        }
        @keyframes cmMissMark {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
          30%  { transform: translate(-50%, -50%) scale(1.4); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }
        @keyframes cmCrownBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes cmSparkle {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          50%      { opacity: 1; transform: scale(1.2); }
        }
        @keyframes cmConfettiFall {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(0, 360px) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
