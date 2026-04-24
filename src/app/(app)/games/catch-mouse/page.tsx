'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { RefreshCw, ChevronLeft } from 'lucide-react'
import { IconMouse, IconStar, IconCrown, IconCoin } from '@/components/PixelIcons'

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
    const newParticles: Particle[] = Array.from({ length: 14 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 3.5
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
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.15
      p.life -= 0.05
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6)
    })
    ctx.globalAlpha = 1

    // ── Pixel mouse ──
    const facingLeft = mouse.vx < 0
    drawPixelMouse(ctx, Math.round(mouse.x), Math.round(mouse.y), facingLeft)
  }, [])

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { mouse } = stateRef.current
    const W = canvas.width, H = canvas.height

    const speedMult = 1 + stateRef.current.score * 0.07
    mouse.x += mouse.vx * speedMult
    mouse.y += mouse.vy * speedMult

    if (mouse.x < 22 || mouse.x > W - 22) mouse.vx *= -1
    if (mouse.y < 22 || mouse.y > H - 60) mouse.vy *= -1
    mouse.x = Math.max(22, Math.min(W - 22, mouse.x))
    mouse.y = Math.max(22, Math.min(H - 60, mouse.y))

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
    if (dist < 38) {  // slightly tighter hitbox to match smaller sprite
      stateRef.current.score += 1
      setScore(stateRef.current.score)
      spawnParticles(mouse.x, mouse.y)
      stateRef.current.mouse.x = 60 + Math.random() * (canvas.width - 120)
      stateRef.current.mouse.y = 40 + Math.random() * (canvas.height - 120)
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
  const timePct = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="page-scroll">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
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
          <span className="font-pixel text-white" style={{ fontSize: 22, textShadow: '2px 2px 0 #4C1D95, 0 0 6px rgba(167,139,250,0.6)', letterSpacing: -0.5 }}>{score}</span>
        </div>

        <div className="relative overflow-hidden py-3 px-3"
          style={{
            background: timeWarning
              ? 'linear-gradient(180deg, #5A1A1A 0%, #3A0808 100%)'
              : 'linear-gradient(180deg, #2D1659 0%, #180736 100%)',
            borderRadius: 4,
            border: timeWarning ? '2px solid #F87171' : '2px solid #A78BFA',
            boxShadow: timeWarning ? '0 3px 0 #7A1A1A, 0 0 10px rgba(248,113,113,0.4)' : '0 3px 0 #4C1D95, 0 0 10px rgba(167,139,250,0.25)',
            animation: timeWarning && gameState === 'running' ? 'timerPulse 0.6s ease-in-out infinite' : 'none',
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
            style={{ background: 'rgba(253,246,255,0.92)' }}>
            {gameState === 'idle' && (
              <>
                <div className="mb-3" style={{ animation: 'mouseBob 1.2s ease-in-out infinite', transform: 'scale(3)' }}>
                  <IconMouse size={20} />
                </div>
                <p className="font-pixel text-gray-700 mb-1" style={{ fontSize: 10, letterSpacing: 1 }}>CATCH THE MOUSE!</p>
                <p className="text-xs text-gray-500 mb-5 text-center px-8 leading-relaxed">
                  Tap / click the pixel mouse as fast as you can in {GAME_DURATION} seconds
                </p>
                <button onClick={startGame}
                  className="px-8 py-3 text-white active:translate-y-[2px] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '0 4px 0 #991A4A, 0 0 12px rgba(255,107,157,0.45)', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 2 }}>
                  ▶ START
                </button>
              </>
            )}
            {gameState === 'finished' && (
              <>
                <div className="mb-2">
                  <IconCrown size={28} />
                </div>
                <p className="font-pixel text-[#FF6B9D] mb-1" style={{ fontSize: 22, textShadow: '2px 2px 0 rgba(204,51,102,0.3)' }}>{score}</p>
                <p className="font-pixel text-gray-600 mb-3" style={{ fontSize: 7, letterSpacing: 2 }}>MICE CAUGHT</p>
                <p className="font-pixel text-gray-500 mb-1" style={{ fontSize: 6 }}>
                  {score >= 15 ? '★ AMAZING! ★' : score >= 8 ? '★ GREAT JOB! ★' : 'GOOD EFFORT!'}
                </p>
                {score > 5 && (
                  <div className="flex items-center gap-1 mb-4" style={{ color: '#A16207' }}>
                    <IconCoin size={12} />
                    <span className="font-pixel" style={{ fontSize: 7 }}>+{Math.floor(score / 2)} coins</span>
                  </div>
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

      <style jsx>{`
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes mouseBob {
          0%, 100% { transform: scale(3) translateY(0); }
          50% { transform: scale(3) translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
