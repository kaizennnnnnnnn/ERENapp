'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { RefreshCw, ChevronLeft } from 'lucide-react'

const GAME_DURATION  = 30
const TREAT_COUNT    = 3
const CAT_SPEED_BASE = 2.0
const CAT_SPEED_MAX  = 4.2
const COLLECT_RADIUS = 30  // how close cat must get to a treat

const TREAT_EMOJIS = ['🐟', '🦐', '🍤', '🐠', '🌸', '🎀']
const BONUS_EMOJIS = ['⭐', '💎']

interface Treat    { id: number; x: number; y: number; emoji: string; bonus: boolean; lifeTicks?: number }
interface PawPrint { x: number; y: number; angle: number; alpha: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

let nextTreatId = 1

function randomTreat(W: number, H: number, existing: Treat[]): Treat {
  let x: number, y: number, ok: boolean
  do {
    x = 40 + Math.random() * (W - 80)
    y = 36 + Math.random() * (H - 100)
    ok = existing.every(t => Math.hypot(t.x - x, t.y - y) > 60)
  } while (!ok)
  // 15% chance of bonus treat (worth 3 points, disappears after a few seconds)
  const isBonus = Math.random() < 0.15
  return {
    id: nextTreatId++, x, y,
    emoji: isBonus ? BONUS_EMOJIS[Math.floor(Math.random() * BONUS_EMOJIS.length)] : TREAT_EMOJIS[Math.floor(Math.random() * TREAT_EMOJIS.length)],
    bonus: isBonus,
    lifeTicks: isBonus ? 240 : undefined, // ~4 seconds at 60fps
  }
}

export default function YarnChaseGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef({
    yarn:      { x: 280, y: 150 },
    cat:       { x: 50,  y: 150 },
    yarnAngle: 0,
    treats:    [] as Treat[],
    pawPrints: [] as PawPrint[],
    particles: [] as Particle[],
    lastPawX:  0,
    lastPawY:  0,
    score:     0,
    timeLeft:  GAME_DURATION,
    running:   false,
    animId:    0,
    timerInterval: 0 as unknown as ReturnType<typeof setInterval>,
  })

  const [score, setScore]         = useState(0)
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION)
  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')

  // ── Pixel cat ─────────────────────────────────────────────────────────────
  function drawPixelCat(ctx: CanvasRenderingContext2D, x: number, y: number, facing: 'left' | 'right', frame: number) {
    const p = 5
    const ox = Math.round(x) - 3 * p
    const oy = Math.round(y) - 3 * p
    const legY = frame % 4 < 2 ? 6 : 5

    ctx.save()
    if (facing === 'left') { ctx.translate(Math.round(x) * 2, 0); ctx.scale(-1, 1) }

    type C = [number, number, string]
    const pixels: C[] = [
      [0,0,'#5A3A1A'],[1,0,'#9B7A4C'],[4,0,'#5A3A1A'],[5,0,'#9B7A4C'],
      [0,1,'#C49A72'],[1,1,'#D4B088'],[2,1,'#D4B088'],[3,1,'#D4B088'],[4,1,'#D4B088'],[5,1,'#C49A72'],
      [0,2,'#C49A72'],[1,2,'#F0DEBA'],[2,2,'#F0DEBA'],[3,2,'#F0DEBA'],[4,2,'#F0DEBA'],[5,2,'#C49A72'],
      [1,2,'#1A1A2E'],[4,2,'#1A1A2E'],
      [0,3,'#C49A72'],[1,3,'#F0DEBA'],[2,3,'#FF6B9D'],[3,3,'#FF6B9D'],[4,3,'#F0DEBA'],[5,3,'#C49A72'],
      [2,4,'#9B7A4C'],[3,4,'#9B7A4C'],
      [0,4,'#C49A72'],[1,4,'#C4A882'],[4,4,'#C4A882'],[5,4,'#C49A72'],
      [0,5,'#C49A72'],[1,5,'#C4A882'],[2,5,'#C4A882'],[3,5,'#C4A882'],[4,5,'#C4A882'],[5,5,'#C49A72'],
      [1,legY,'#9B7A4C'],[4,legY,'#9B7A4C'],
      [6,4,'#C49A72'],[7,3,'#C49A72'],[7,2,'#C49A72'],
    ]
    pixels.forEach(([dx, dy, color]) => {
      ctx.fillStyle = color; ctx.fillRect(ox + dx * p, oy + dy * p, p, p)
    })
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.fillRect(ox + 1 * p + 1, oy + 2 * p + 1, 2, 2)
    ctx.fillRect(ox + 4 * p + 1, oy + 2 * p + 1, 2, 2)
    ctx.restore()
  }

  // ── Yarn ball ─────────────────────────────────────────────────────────────
  function drawYarnBall(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
    const R = 16
    ctx.fillStyle = 'rgba(0,0,0,0.1)'
    ctx.beginPath(); ctx.ellipse(x + 2, y + R - 2, R - 2, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.save(); ctx.translate(x, y)
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.fillStyle = '#FF6B9D'; ctx.fill()
    ctx.strokeStyle = '#E84080'; ctx.lineWidth = 1; ctx.stroke()
    ctx.rotate(angle)
    ctx.strokeStyle = '#FF4080'; ctx.lineWidth = 1.5
    for (let a = 0; a < 5; a++) {
      const la = (a / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(la) * R, Math.sin(la) * R)
      ctx.quadraticCurveTo(Math.cos(la + 1.2) * R * 0.5, Math.sin(la + 1.2) * R * 0.5, Math.cos(la + Math.PI) * R, Math.sin(la + Math.PI) * R)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath(); ctx.ellipse(-R * 0.3, -R * 0.35, R * 0.3, R * 0.18, -0.5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // Loose string
    ctx.strokeStyle = '#FF6B9D'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(x + R - 2, y - R + 4); ctx.quadraticCurveTo(x + R + 8, y - R - 5, x + R + 12, y - R - 1); ctx.stroke()
  }

  // ── Treat token ───────────────────────────────────────────────────────────
  function drawTreat(ctx: CanvasRenderingContext2D, treat: Treat, pulse: number) {
    const glow = 10 + Math.sin(pulse) * 4
    const bonusFlash = treat.bonus && treat.lifeTicks !== undefined && treat.lifeTicks < 90 // flash when about to expire
    const isHidden = bonusFlash && Math.floor(pulse * 4) % 2 === 0
    if (isHidden) return

    const accent = treat.bonus ? '#FFD700' : '#FFD700'
    const radius = treat.bonus ? 17 : 14

    ctx.save()
    // Outer glow (bigger and yellow for bonus)
    ctx.globalAlpha = 0.3 + Math.sin(pulse) * 0.15
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.arc(treat.x, treat.y, glow + (treat.bonus ? 12 : 6), 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    // Badge bg
    ctx.fillStyle = treat.bonus ? 'rgba(255,245,180,0.95)' : 'rgba(255,255,255,0.9)'
    ctx.beginPath(); ctx.arc(treat.x, treat.y, radius, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = accent; ctx.lineWidth = treat.bonus ? 3 : 2
    ctx.beginPath(); ctx.arc(treat.x, treat.y, radius, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
    // Emoji
    ctx.font = treat.bonus ? '18px serif' : '14px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(treat.emoji, treat.x, treat.y)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  }

  // ── Main draw ─────────────────────────────────────────────────────────────
  const frameRef = useRef(0)
  const draw = useCallback((frame = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { yarn, cat, yarnAngle, pawPrints, particles, treats } = stateRef.current
    const W = canvas.width, H = canvas.height
    const pulse = frame * 0.08

    // Background
    ctx.fillStyle = '#FDF0FF'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#EDD8FF'
    for (let gx = 20; gx < W; gx += 34)
      for (let gy = 20; gy < H - 60; gy += 34) {
        ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, Math.PI * 2); ctx.fill()
      }
    // Floor
    ctx.fillStyle = '#E8D8C8'; ctx.fillRect(0, H - 58, W, 58)
    ctx.fillStyle = '#F0E4D8'; ctx.fillRect(0, H - 58, W, 3)
    ctx.strokeStyle = '#D8C8B0'; ctx.lineWidth = 1
    for (let wx = -20; wx < W + 20; wx += 55) {
      ctx.beginPath(); ctx.moveTo(wx, H - 58); ctx.lineTo(wx + 40, H); ctx.stroke()
    }
    ctx.fillStyle = '#C8B8A8'; ctx.fillRect(0, H - 60, W, 3)

    // Paw prints
    stateRef.current.pawPrints = pawPrints.filter(p => p.alpha > 0)
    stateRef.current.pawPrints.forEach(p => {
      p.alpha -= 0.006
      ctx.globalAlpha = p.alpha * 0.4
      ctx.fillStyle = '#D4A0A0'; ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(p.angle)
      ctx.beginPath(); ctx.arc(-3, 0, 3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(3, 0, 3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(0, 4, 4, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // Particles
    stateRef.current.particles = particles.filter(p => p.life > 0)
    stateRef.current.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.04
      ctx.globalAlpha = p.life; ctx.fillStyle = p.color
      ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6)
    })
    ctx.globalAlpha = 1

    // Treats
    treats.forEach(t => drawTreat(ctx, t, pulse + t.id * 1.2))

    // Distance rings (guide lines from cat to nearest treat) — very faint
    if (treats.length > 0) {
      const nearest = treats.reduce((a, b) =>
        Math.hypot(a.x - cat.x, a.y - cat.y) < Math.hypot(b.x - cat.x, b.y - cat.y) ? a : b
      )
      const dist = Math.hypot(nearest.x - cat.x, nearest.y - cat.y)
      if (dist < 80) {
        ctx.globalAlpha = (1 - dist / 80) * 0.2
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1; ctx.setLineDash([3, 4])
        ctx.beginPath(); ctx.moveTo(cat.x, cat.y); ctx.lineTo(nearest.x, nearest.y); ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }
    }

    // Yarn
    drawYarnBall(ctx, yarn.x, yarn.y, yarnAngle)

    // Cat
    const facing = cat.x < yarn.x ? 'right' : 'left'
    drawPixelCat(ctx, cat.x, cat.y, facing, frame)

    // Score chip on canvas
    ctx.fillStyle = 'rgba(30,20,50,0.85)'; ctx.fillRect(8, 8, 104, 22)
    ctx.fillStyle = '#FFD700'; ctx.fillRect(8, 8, 104, 2)
    ctx.fillStyle = '#FFFFFF'; ctx.font = '7px "Press Start 2P", monospace'
    ctx.fillText(`TREATS: ${stateRef.current.score}`, 14, 23)
  }, [])

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const s = stateRef.current
    const canvas = canvasRef.current
    if (!canvas) return
    frameRef.current++
    const W = canvas.width, H = canvas.height

    // Cat chases yarn — speed capped
    const dx = s.yarn.x - s.cat.x
    const dy = s.yarn.y - s.cat.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = Math.min(CAT_SPEED_BASE + s.score * 0.08, CAT_SPEED_MAX)

    if (dist > 8) {
      const nx = dx / dist, ny = dy / dist
      s.cat.x += nx * speed
      s.cat.y += ny * speed

      // Paw prints
      const pdx = s.cat.x - s.lastPawX, pdy = s.cat.y - s.lastPawY
      if (Math.sqrt(pdx * pdx + pdy * pdy) > 24) {
        s.pawPrints.push({ x: s.cat.x, y: s.cat.y, angle: Math.atan2(pdy, pdx), alpha: 1 })
        s.lastPawX = s.cat.x; s.lastPawY = s.cat.y
        if (s.pawPrints.length > 18) s.pawPrints.shift()
      }
    }

    // Keep cat in bounds
    s.cat.x = Math.max(16, Math.min(W - 16, s.cat.x))
    s.cat.y = Math.max(16, Math.min(H - 68, s.cat.y))

    // Rotate yarn
    s.yarnAngle += 0.04

    // Check cat vs treats, tick down bonus treat lifespans
    s.treats = s.treats.filter(t => {
      const td = Math.hypot(t.x - s.cat.x, t.y - s.cat.y)
      if (td < COLLECT_RADIUS) {
        const points = t.bonus ? 3 : 1
        s.score += points
        setScore(s.score)
        const colors = t.bonus
          ? ['#FFD700', '#FFA500', '#FFFACD', '#FFFFFF']
          : ['#FFD700', '#FF6B9D', '#A78BFA', '#4ECDC4']
        const count = t.bonus ? 18 : 10
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 3
          s.particles.push({ x: t.x, y: t.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 1, color: colors[Math.floor(Math.random() * colors.length)] })
        }
        return false
      }
      // Bonus treats expire over time
      if (t.bonus && t.lifeTicks !== undefined) {
        t.lifeTicks--
        if (t.lifeTicks <= 0) return false
      }
      return true
    })

    // Spawn replacement treats to keep count at TREAT_COUNT
    while (s.treats.length < TREAT_COUNT) {
      s.treats.push(randomTreat(W, H, s.treats))
    }

    draw(frameRef.current)
    if (s.running) s.animId = requestAnimationFrame(tick)
  }, [draw])

  // ── Drag yarn ─────────────────────────────────────────────────────────────
  function handleDrag(e: React.MouseEvent | React.TouchEvent) {
    if (!stateRef.current.running) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    let cx: number, cy: number
    if ('touches' in e) {
      cx = e.touches[0].clientX - rect.left
      cy = e.touches[0].clientY - rect.top
    } else {
      cx = (e as React.MouseEvent).clientX - rect.left
      cy = (e as React.MouseEvent).clientY - rect.top
    }
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height
    stateRef.current.yarn.x = Math.max(20, Math.min(canvas.width  - 20, cx * scaleX))
    stateRef.current.yarn.y = Math.max(20, Math.min(canvas.height - 70, cy * scaleY))
  }

  // ── Start / end ───────────────────────────────────────────────────────────
  function startGame() {
    const s = stateRef.current
    const canvas = canvasRef.current!
    s.score = 0; s.timeLeft = GAME_DURATION; s.running = true
    s.yarn = { x: 280, y: 150 }
    s.cat  = { x: 50,  y: 150 }
    s.yarnAngle = 0; s.pawPrints = []; s.particles = []
    s.treats = []
    while (s.treats.length < TREAT_COUNT) s.treats.push(randomTreat(canvas.width, canvas.height, s.treats))
    frameRef.current = 0
    setScore(0); setTimeLeft(GAME_DURATION); setGameState('running')

    s.timerInterval = setInterval(() => {
      stateRef.current.timeLeft -= 1
      setTimeLeft(stateRef.current.timeLeft)
      if (stateRef.current.timeLeft <= 0) endGame()
    }, 1000)

    requestAnimationFrame(tick)
  }

  function endGame() {
    const s = stateRef.current
    s.running = false; cancelAnimationFrame(s.animId); clearInterval(s.timerInterval)
    setGameState('finished')
    if (user?.id && s.score > 0) {
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'yarn_chase', score: s.score }).then(({ error }) => { if (error) console.error('score save error:', error) })
      addCoins(Math.floor(s.score / 2))
      completeTask('daily_game')
      if (s.score >= 30) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  useEffect(() => () => {
    cancelAnimationFrame(stateRef.current.animId)
    clearInterval(stateRef.current.timerInterval)
  }, [])

  useEffect(() => { if (gameState === 'idle') draw(0) }, [gameState, draw])

  const timeWarning = timeLeft <= 8

  return (
    <div className="page-scroll">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)' }}>🧶 YARN CHASE</span>
      </div>

      {/* ── HUD ── */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 flex flex-col items-center py-2.5"
          style={{ background: 'linear-gradient(135deg, #FFF8FF, #F5EEFF)', borderRadius: 3, border: '2px solid #E0D0F8', boxShadow: '2px 2px 0 #C8B0E8' }}>
          <span className="font-pixel text-purple-400" style={{ fontSize: 6 }}>TREATS</span>
          <span className="font-pixel text-[#FF6B9D] mt-1" style={{ fontSize: 16 }}>{score}</span>
        </div>
        <div className={`flex-1 flex flex-col items-center py-2.5 ${timeWarning ? 'animate-heartbeat' : ''}`}
          style={{ background: timeWarning ? 'linear-gradient(135deg, #FFF0F0, #FFE0E0)' : 'linear-gradient(135deg, #FFF8FF, #F5EEFF)', borderRadius: 3, border: `2px solid ${timeWarning ? '#FFB0B0' : '#E0D0F8'}`, boxShadow: `2px 2px 0 ${timeWarning ? '#FF9090' : '#C8B0E8'}` }}>
          <span className="font-pixel text-purple-400" style={{ fontSize: 6 }}>TIME</span>
          <span className={`font-pixel mt-1 ${timeWarning ? 'text-red-500' : 'text-gray-700'}`} style={{ fontSize: 16 }}>{timeLeft}s</span>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="mb-3 relative"
        style={{ borderRadius: 4, border: '3px solid #F0C8E8', boxShadow: '4px 4px 0 #E0A8D0', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={360}
          height={300}
          className="w-full touch-none block"
          style={{ cursor: gameState === 'running' ? 'none' : 'default', display: 'block' }}
          onMouseMove={handleDrag}
          onTouchMove={handleDrag}
          onClick={handleDrag}
          onTouchStart={handleDrag}
        />

        {gameState !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
            style={{ background: 'rgba(253,246,255,0.90)' }}>
            {gameState === 'idle' && (
              <>
                <div className="flex gap-2 text-3xl mb-3">🧶🐱⭐</div>
                <p className="font-pixel text-gray-700 mb-2" style={{ fontSize: 9 }}>YARN CHASE!</p>
                <div className="px-6 mb-5 text-center">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Drag the yarn ball to <strong>lead Eren</strong> toward the glowing treats ✨
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Collect {TREAT_COUNT} treats at a time — more spawn as you go!</p>
                </div>
                <button onClick={startGame}
                  className="px-8 py-3 text-white active:translate-y-[2px] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '0 4px 0 #991A4A', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
                  ▶ START
                </button>
              </>
            )}
            {gameState === 'finished' && (
              <>
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-pixel text-[#FF6B9D] mb-1" style={{ fontSize: 11 }}>{score}</p>
                <p className="font-pixel text-gray-600 mb-3" style={{ fontSize: 7 }}>TREATS COLLECTED!</p>
                <p className="font-pixel text-gray-500 mb-1" style={{ fontSize: 6 }}>
                  {score >= 15 ? '★ TREAT MASTER! ★' : score >= 8 ? '★ NICE WORK! ★' : 'KEEP TRYING!'}
                </p>
                {score > 2 && <p className="font-pixel text-[#FF6B9D] mb-4" style={{ fontSize: 6 }}>EREN IS HAPPY! ♥</p>}
                <div className="flex gap-3 mt-1">
                  <button onClick={startGame}
                    className="px-4 py-2 text-white active:translate-y-[1px] transition-transform flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '2px 2px 0 #991A4A', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                    <RefreshCw size={10} /> RETRY
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="font-pixel text-gray-400 text-center" style={{ fontSize: 6 }}>
        DRAG YARN TO LEAD EREN TO THE GLOWING TREATS!
      </p>
    </div>
  )
}
