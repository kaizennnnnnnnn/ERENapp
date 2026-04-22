'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { RefreshCw, ChevronLeft } from 'lucide-react'

const MOUSE_SPEED_INIT = 2.2
const GAME_DURATION    = 30

interface MousePos { x: number; y: number; vx: number; vy: number }
interface Particle  { x: number; y: number; vx: number; vy: number; life: number; color: string }

export default function CatchMouseGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef({
    mouse:     { x: 150, y: 150, vx: MOUSE_SPEED_INIT, vy: MOUSE_SPEED_INIT } as MousePos,
    particles: [] as Particle[],
    score:     0,
    timeLeft:  GAME_DURATION,
    running:   false,
    animId:    0,
    timerInterval: 0 as unknown as ReturnType<typeof setInterval>,
  })

  const [score, setScore]         = useState(0)
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION)
  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')

  // ── Chibi pixel mouse (front-view, 17 wide × 12 tall) ─────────────────────
  // K=outline G=fur P=pink(ear/nose) L=belly E=eye M=tail .=transparent
  const MOUSE_SPRITE = [
    '..KK......KK.....',
    '.KGGK....KGGK....',
    '.KGPK....KPGK....',
    'KKGGKKKKKKGGKK...',
    'KGGGGGGGGGGGGGK..',
    'KGGGEGGGGGEGGGK..',
    'KGGGGGGGGGGGGGK..',
    'KGGGGGGPPGGGGGK..',
    '.KKGGGGGGGGGGKK.M',
    '..KKLLLLLLLLKK.MM',
    '.KLLLLLLLLLLLLK.M',
    '..KK.KKK..KKK.K..',
  ]
  const MOUSE_PAL: Record<string, string> = {
    '.': 'transparent',
    K: '#1A1A2E',     // dark outline
    G: '#9B8B76',     // body fur (warm grey-brown)
    L: '#F0E0C8',     // belly/light
    P: '#F4A6B8',     // pink (ear inner, nose)
    E: '#1A1A2E',     // eye (same as outline)
    M: '#7A6B58',     // tail (slightly darker than body)
  }

  function drawPixelMouse(ctx: CanvasRenderingContext2D, mx: number, my: number, facingLeft: boolean) {
    const px = 4
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
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(Math.round(mx), oy + rows * px + 1, cols * px * 0.35, 3, 0, 0, Math.PI * 2)
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

    // White eye shine on both eyes (row 5, cols 4 and 10)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(ox + 4 * px + 1, oy + 5 * px + 1, 1, 1)
    ctx.fillRect(ox + 10 * px + 1, oy + 5 * px + 1, 1, 1)

    ctx.restore()
  }

  function spawnParticles(x: number, y: number) {
    const colors = ['#FF6B9D', '#FFD700', '#A78BFA', '#4ECDC4', '#FF8C42']
    const newParticles: Particle[] = Array.from({ length: 12 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 3
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
      }
    })
    stateRef.current.particles.push(...newParticles)
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
    // Floor highlight
    ctx.fillStyle = '#F0E4D4'
    ctx.fillRect(0, H - 50, W, 3)
    // Floor wood lines
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

    // Wall/floor divide pixel line
    ctx.fillStyle = '#C0B0A0'
    ctx.fillRect(0, H - 50, W, 2)

    // Mouse holes (corners near floor)
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
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.15 // gravity
      p.life -= 0.05
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6)
    })
    ctx.globalAlpha = 1

    // ── Pixel mouse ──
    const facingLeft = mouse.vx < 0
    drawPixelMouse(ctx, Math.round(mouse.x), Math.round(mouse.y), facingLeft)

    // ── Pixel score badge (canvas-drawn) ──
    ctx.fillStyle = 'rgba(30,20,50,0.85)'
    ctx.fillRect(8, 8, 90, 22)
    ctx.fillStyle = '#FF6B9D'
    ctx.fillRect(8, 8, 90, 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '7px "Press Start 2P", monospace'
    ctx.fillText(`SCORE: ${stateRef.current.score}`, 14, 23)
  }, [])

  // ── Tick (game loop) ──────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { mouse } = stateRef.current
    const W = canvas.width, H = canvas.height

    const speedMult = 1 + stateRef.current.score * 0.07
    mouse.x += mouse.vx * speedMult
    mouse.y += mouse.vy * speedMult

    // Bounce off walls (keep above floor)
    if (mouse.x < 22 || mouse.x > W - 22) mouse.vx *= -1
    if (mouse.y < 22 || mouse.y > H - 60) mouse.vy *= -1
    mouse.x = Math.max(22, Math.min(W - 22, mouse.x))
    mouse.y = Math.max(22, Math.min(H - 60, mouse.y))

    // Random direction nudge
    if (Math.random() < 0.025) {
      mouse.vx += (Math.random() - 0.5) * 2
      mouse.vy += (Math.random() - 0.5) * 2
      const spd = Math.sqrt(mouse.vx ** 2 + mouse.vy ** 2)
      if (spd > 5) { mouse.vx = (mouse.vx / spd) * 5; mouse.vy = (mouse.vy / spd) * 5 }
      if (spd < 1) { mouse.vx = (mouse.vx / spd) * 1; mouse.vy = (mouse.vy / spd) * 1 }
    }

    draw()
    if (stateRef.current.running) {
      stateRef.current.animId = requestAnimationFrame(tick)
    }
  }, [draw])

  function startGame() {
    const s = stateRef.current
    s.score = 0
    s.timeLeft = GAME_DURATION
    s.running = true
    s.particles = []
    s.mouse = { x: 150, y: 150, vx: MOUSE_SPEED_INIT, vy: MOUSE_SPEED_INIT + 0.5 }
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setGameState('running')

    s.timerInterval = setInterval(() => {
      stateRef.current.timeLeft -= 1
      setTimeLeft(stateRef.current.timeLeft)
      if (stateRef.current.timeLeft <= 0) endGame()
    }, 1000)

    requestAnimationFrame(tick)
  }

  function endGame() {
    const s = stateRef.current
    s.running = false
    cancelAnimationFrame(s.animId)
    clearInterval(s.timerInterval)
    setGameState('finished')

    if (user?.id && s.score > 0) {
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'catch_mouse', score: s.score }).then(({ error }) => { if (error) console.error('score save error:', error) })
      const coinsEarned = Math.floor(s.score / 2)
      if (coinsEarned > 0) addCoins(coinsEarned)
      completeTask('daily_game')
      if (s.score >= 30) completeTask('weekly_high_score')
      if (s.score > 5) applyAction(user.id, 'play')
    }
  }

  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    if (!stateRef.current.running) return
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    let cx: number, cy: number
    if ('touches' in e) {
      cx = e.touches[0].clientX - rect.left
      cy = e.touches[0].clientY - rect.top
    } else {
      cx = (e as React.MouseEvent).clientX - rect.left
      cy = (e as React.MouseEvent).clientY - rect.top
    }
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const tx = cx * scaleX
    const ty = cy * scaleY

    const { mouse } = stateRef.current
    const dist = Math.sqrt((tx - mouse.x) ** 2 + (ty - mouse.y) ** 2)
    if (dist < 44) {
      stateRef.current.score += 1
      setScore(stateRef.current.score)
      spawnParticles(mouse.x, mouse.y)
      // Teleport mouse away
      stateRef.current.mouse.x = 60 + Math.random() * (canvas.width - 120)
      stateRef.current.mouse.y = 40 + Math.random() * (canvas.height - 120)
      // Boost speed
      stateRef.current.mouse.vx = (Math.random() > 0.5 ? 1 : -1) * (MOUSE_SPEED_INIT + Math.random() * 2)
      stateRef.current.mouse.vy = (Math.random() > 0.5 ? 1 : -1) * (MOUSE_SPEED_INIT + Math.random() * 2)
    }
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(stateRef.current.animId)
      clearInterval(stateRef.current.timerInterval)
    }
  }, [])

  useEffect(() => { if (gameState === 'idle') draw() }, [gameState, draw])

  const timeWarning = timeLeft <= 10

  return (
    <div className="page-scroll">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #F5C842, #E8A020)' }}>🐭 CATCH THE MOUSE</span>
      </div>

      {/* ── HUD ── */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 flex flex-col items-center py-2.5"
          style={{ background: 'linear-gradient(135deg, #FFF8FF, #F5EEFF)', borderRadius: 3, border: '2px solid #E0D0F8', boxShadow: '2px 2px 0 #C8B0E8' }}>
          <span className="font-pixel text-purple-400" style={{ fontSize: 6 }}>SCORE</span>
          <span className="font-pixel text-[#FF6B9D] mt-1" style={{ fontSize: 16 }}>{score}</span>
        </div>
        <div className={`flex-1 flex flex-col items-center py-2.5 ${timeWarning ? 'animate-heartbeat' : ''}`}
          style={{ background: timeWarning ? 'linear-gradient(135deg, #FFF0F0, #FFE0E0)' : 'linear-gradient(135deg, #FFF8FF, #F5EEFF)', borderRadius: 3, border: `2px solid ${timeWarning ? '#FFB0B0' : '#E0D0F8'}`, boxShadow: `2px 2px 0 ${timeWarning ? '#FF9090' : '#C8B0E8'}` }}>
          <span className="font-pixel text-purple-400" style={{ fontSize: 6 }}>TIME</span>
          <span className={`font-pixel mt-1 ${timeWarning ? 'text-red-500' : 'text-gray-700'}`} style={{ fontSize: 16 }}>{timeLeft}s</span>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="mb-4 relative"
        style={{ borderRadius: 4, border: '3px solid #D8C0F0', boxShadow: '4px 4px 0 #C0A0E0', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={360}
          height={320}
          className="w-full touch-none block"
          style={{ cursor: gameState === 'running' ? 'crosshair' : 'default', display: 'block' }}
          onClick={handleTap}
          onTouchStart={handleTap}
        />

        {/* ── Overlays ── */}
        {gameState !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
            style={{ background: 'rgba(253,246,255,0.88)' }}>
            {gameState === 'idle' && (
              <>
                <div className="text-5xl mb-3 animate-float">🐭</div>
                <p className="font-pixel text-gray-700 mb-1" style={{ fontSize: 9 }}>CATCH THE MOUSE!</p>
                <p className="text-xs text-gray-500 mb-5 text-center px-8 leading-relaxed">
                  Tap/click the pixel mouse as fast as you can in {GAME_DURATION} seconds
                </p>
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
                <p className="font-pixel text-gray-600 mb-3" style={{ fontSize: 7 }}>MICE CAUGHT!</p>
                <p className="font-pixel text-gray-500 mb-1" style={{ fontSize: 6 }}>
                  {score >= 15 ? '★ AMAZING! ★' : score >= 8 ? '★ GREAT JOB! ★' : 'GOOD EFFORT!'}
                </p>
                {score > 5 && (
                  <p className="font-pixel text-[#FF6B9D] mb-4" style={{ fontSize: 6 }}>EREN IS HAPPY! ♥</p>
                )}
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
        TAP / CLICK THE MOUSE TO CATCH IT!
      </p>
    </div>
  )
}
