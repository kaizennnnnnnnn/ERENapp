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

// ─── Tuning ───────────────────────────────────────────────────────────────────
const GRAVITY        = 1700
const FLAP_V         = -440
const PIPE_W         = 60
const PIPE_GAP       = 175
const PIPE_INTERVAL  = 1500
const SPEED_BASE     = 200
const SPEED_MAX      = 360
// Speed ramp: per-second time pressure + small per-pipe bonus.
const TIME_ACCEL     = 1.7   // px/s added per second elapsed
const SCORE_ACCEL    = 1.2   // px/s added per pipe passed
const EREN_W         = 44
const EREN_H         = 64
const PLAYER_X       = 80
const FIZZ_INTERVAL  = 60
const THEME_EVERY    = 8     // pipes between environment swaps

interface Pipe { id: number; x: number; gapY: number; passed: boolean }
interface Particle { id: number; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; alpha: number; color: string }

let _pid = 0
const newId = () => ++_pid

// ─── Environments ────────────────────────────────────────────────────────────
interface Theme {
  name: 'day' | 'sunset' | 'night' | 'forest' | 'desert'
  sky: string
  ground: string
  groundBorder: string
  pipeMid: string   // gradient color used for pipe body
  pipeShadow: string
  cloudOpacity: number
  starOpacity: number
  pipeColor1: string
  pipeColor2: string
  pipeColor3: string
}

const THEMES: Theme[] = [
  {
    name: 'day',
    sky: 'linear-gradient(180deg, #5BACEC 0%, #8FCCEF 50%, #C5E2EA 75%, #FCE7B4 100%)',
    ground: 'repeating-linear-gradient(90deg, #16a34a 0 8px, #15803d 8px 16px)',
    groundBorder: '#052e16',
    pipeMid: '#22c55e', pipeShadow: '#064e3b',
    pipeColor1: '#14a052', pipeColor2: '#16a34a', pipeColor3: '#22c55e',
    cloudOpacity: 1, starOpacity: 0,
  },
  {
    name: 'sunset',
    sky: 'linear-gradient(180deg, #FF6F47 0%, #FF9966 30%, #FFB888 55%, #FFD7B5 80%, #FFE9C9 100%)',
    ground: 'repeating-linear-gradient(90deg, #B45309 0 8px, #92400E 8px 16px)',
    groundBorder: '#451A03',
    pipeMid: '#F59E0B', pipeShadow: '#78350F',
    pipeColor1: '#D97706', pipeColor2: '#F59E0B', pipeColor3: '#FBBF24',
    cloudOpacity: 0.85, starOpacity: 0,
  },
  {
    name: 'night',
    sky: 'linear-gradient(180deg, #0A0F2A 0%, #1A1A4E 45%, #2D1B5E 80%, #4C1D95 100%)',
    ground: 'repeating-linear-gradient(90deg, #1F2937 0 8px, #111827 8px 16px)',
    groundBorder: '#030712',
    pipeMid: '#7C3AED', pipeShadow: '#2E0F5C',
    pipeColor1: '#5B21B6', pipeColor2: '#7C3AED', pipeColor3: '#A78BFA',
    cloudOpacity: 0, starOpacity: 1,
  },
  {
    name: 'forest',
    sky: 'linear-gradient(180deg, #064E3B 0%, #15803D 35%, #4ADE80 70%, #BBF7D0 100%)',
    ground: 'repeating-linear-gradient(90deg, #052e16 0 8px, #022c22 8px 16px)',
    groundBorder: '#021810',
    pipeMid: '#92400E', pipeShadow: '#451A03', // brown trunk-like pipes
    pipeColor1: '#78350F', pipeColor2: '#92400E', pipeColor3: '#B45309',
    cloudOpacity: 0.45, starOpacity: 0,
  },
  {
    name: 'desert',
    sky: 'linear-gradient(180deg, #FCD34D 0%, #FCA5A5 35%, #FECACA 65%, #FEF3C7 100%)',
    ground: 'repeating-linear-gradient(90deg, #D97706 0 8px, #92400E 8px 16px)',
    groundBorder: '#451A03',
    pipeMid: '#A16207', pipeShadow: '#451A03', // sandstone-style
    pipeColor1: '#854D0E', pipeColor2: '#A16207', pipeColor3: '#CA8A04',
    cloudOpacity: 0.6, starOpacity: 0,
  },
]

// Pre-baked star positions so they don't jitter between renders.
const STAR_POSITIONS = Array.from({ length: 38 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 60}%`,
  size: 1 + Math.random() * 2,
  delay: `${Math.random() * 3}s`,
}))

export default function FlappyErenGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const fieldRef = useRef<HTMLDivElement>(null)
  const [fieldDims, setFieldDims] = useState({ w: 360, h: 600 })

  useEffect(() => {
    function measure() {
      const r = fieldRef.current?.getBoundingClientRect()
      if (r && r.width && r.height) setFieldDims({ w: r.width, h: r.height })
    }
    measure()
    const t = setTimeout(measure, 50)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [])

  const [state, setState]         = useState<'idle' | 'running' | 'gameover'>('idle')
  const [score, setScore]         = useState(0)
  const [bestScore, setBestScore] = useState(0)

  // Theme is derived from score so the crossfade is automatic when score
  // crosses a multiple of THEME_EVERY.
  const themeIndex   = Math.floor(score / THEME_EVERY) % THEMES.length
  const currentTheme = THEMES[themeIndex]

  const stateRef     = useRef<'idle' | 'running' | 'gameover'>('idle')
  const yRef         = useRef(0)
  const vyRef        = useRef(0)
  const angleRef     = useRef(0)
  const pipesRef     = useRef<Pipe[]>([])
  const particlesRef = useRef<Particle[]>([])
  const speedRef     = useRef(SPEED_BASE)
  const scoreRef     = useRef(0)
  const lastPipeRef  = useRef(0)
  const lastFizzRef  = useRef(0)
  const lastFrameRef = useRef(0)
  const startTimeRef = useRef(0)
  const flapTimeRef  = useRef<number>(-Infinity)
  const rafRef       = useRef<number>(0)

  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  function spawnPipe() {
    const minMargin = 70
    const range = Math.max(60, fieldDims.h - PIPE_GAP - minMargin * 2)
    const gapY = minMargin + Math.random() * range
    pipesRef.current.push({ id: newId(), x: fieldDims.w + 20, gapY, passed: false })
  }

  function spawnFizzPuff() {
    const px = PLAYER_X + EREN_W / 2 - 4 + (Math.random() - 0.5) * 8
    const py = yRef.current + EREN_H - 4
    particlesRef.current.push({
      id: newId(),
      x: px, y: py,
      vx: -120 - Math.random() * 80,
      vy: 50 + Math.random() * 100,
      life: 0, max: 0.45 + Math.random() * 0.4,
      size: 3 + Math.random() * 3,
      alpha: 0.9,
      color: Math.random() < 0.4 ? '#A3F0C0' : '#FFFFFF',
    })
  }

  function spawnFlapBurst() {
    for (let i = 0; i < 14; i++) {
      const px = PLAYER_X + EREN_W / 2 - 4 + (Math.random() - 0.5) * 14
      const py = yRef.current + EREN_H - 4
      particlesRef.current.push({
        id: newId(),
        x: px, y: py,
        vx: -50 - Math.random() * 230,
        vy: 80 + Math.random() * 240,
        life: 0, max: 0.55 + Math.random() * 0.55,
        size: 4 + Math.random() * 5,
        alpha: 1,
        color: i % 3 === 0 ? '#10B981' : i % 3 === 1 ? '#A3F0C0' : '#FFFFFF',
      })
    }
  }

  function flap() {
    if (stateRef.current === 'idle') { startGame(); return }
    if (stateRef.current !== 'running') return
    vyRef.current = FLAP_V
    flapTimeRef.current = performance.now()
    spawnFlapBurst()
    playSound('ui_tap')
  }

  // ─── Squash/stretch + swing on each flap. Returns instantaneous scale and a
  // small extra rotation kick on top of the vy-based tilt; combines with the
  // outer rotation so the can+Eren feel like they got punched upward by the
  // can's explosion. 0 → 1 over 360 ms after a flap; outside that range the
  // sprite renders at its natural pose.
  function getFlapImpact(now: number): { sx: number; sy: number; r: number } {
    const t = (now - flapTimeRef.current) / 360
    if (!isFinite(t) || t <= 0 || t >= 1) return { sx: 1, sy: 1, r: 0 }
    let sx = 1, sy = 1, r = 0
    if (t < 0.35) {
      const u = t / 0.35
      sx = 0.82 + 0.30 * u   // narrow on impact, then snap back
      sy = 1.22 - 0.32 * u
      r  = -14 + 20 * u
    } else if (t < 0.7) {
      const u = (t - 0.35) / 0.35
      sx = 1.12 - 0.16 * u
      sy = 0.90 + 0.14 * u
      r  = 6 - 9 * u
    } else {
      const u = (t - 0.7) / 0.3
      sx = 0.96 + 0.04 * u
      sy = 1.04 - 0.04 * u
      r  = -3 + 3 * u
    }
    return { sx, sy, r }
  }

  function aabbHits(): boolean {
    const ex = PLAYER_X
    const ey = yRef.current
    if (ey < -8) return true
    if (ey + EREN_H > fieldDims.h - 12) return true

    const hbX = ex + 6
    const hbW = EREN_W - 12
    const hbY = ey + 6
    const hbH = EREN_H - 12

    for (const p of pipesRef.current) {
      if (hbX + hbW < p.x || hbX > p.x + PIPE_W) continue
      if (hbY < p.gapY) return true
      if (hbY + hbH > p.gapY + PIPE_GAP) return true
    }
    return false
  }

  function loop(now: number) {
    if (stateRef.current !== 'running') return
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000)
    lastFrameRef.current = now

    vyRef.current += GRAVITY * dt
    yRef.current  += vyRef.current * dt
    angleRef.current = Math.max(-30, Math.min(70, vyRef.current * 0.085))

    // Time-based speed ramp + small score bonus, clamped to MAX.
    const elapsed = (now - startTimeRef.current) / 1000
    speedRef.current = Math.min(
      SPEED_MAX,
      SPEED_BASE + elapsed * TIME_ACCEL + scoreRef.current * SCORE_ACCEL,
    )
    for (const p of pipesRef.current) p.x -= speedRef.current * dt

    if (now - lastPipeRef.current > PIPE_INTERVAL) {
      spawnPipe()
      lastPipeRef.current = now
    }

    pipesRef.current = pipesRef.current.filter(p => p.x > -PIPE_W - 5)

    if (now - lastFizzRef.current > FIZZ_INTERVAL) {
      spawnFizzPuff()
      lastFizzRef.current = now
    }

    for (const p of particlesRef.current) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life += dt
      p.alpha = Math.max(0, 1 - p.life / p.max)
    }
    particlesRef.current = particlesRef.current.filter(p => p.life < p.max)

    for (const p of pipesRef.current) {
      if (!p.passed && p.x + PIPE_W < PLAYER_X) {
        p.passed = true
        scoreRef.current += 1
        setScore(scoreRef.current)
        playSound('ui_modal_close')
      }
    }

    if (aabbHits()) { endGame(); return }

    forceRender()
    rafRef.current = requestAnimationFrame(loop)
  }

  function startGame() {
    yRef.current = fieldDims.h / 2 - EREN_H / 2
    vyRef.current = 0
    angleRef.current = 0
    pipesRef.current = []
    particlesRef.current = []
    speedRef.current = SPEED_BASE
    scoreRef.current = 0
    const now = performance.now()
    lastPipeRef.current = now - PIPE_INTERVAL + 500
    lastFizzRef.current = now
    lastFrameRef.current = now
    startTimeRef.current = now
    setScore(0)
    stateRef.current = 'running'
    setState('running')
    rafRef.current = requestAnimationFrame(loop)
  }

  function endGame() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'gameover'
    setState('gameover')
    setBestScore(b => Math.max(b, scoreRef.current))
    playSound('ui_back')

    if (user?.id && scoreRef.current > 0) {
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'flappy_eren', score: scoreRef.current })
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('flappy score save error:', error) })
      addCoins(scoreRef.current * 2)
      completeTask('daily_game')
      if (scoreRef.current >= 15) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function reset() {
    stateRef.current = 'idle'
    setState('idle')
    pipesRef.current = []
    particlesRef.current = []
    yRef.current = fieldDims.h / 2 - EREN_H / 2
    vyRef.current = 0
    angleRef.current = 0
    setScore(0)
  }

  useEffect(() => () => { cancelAnimationFrame(rafRef.current) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell" style={{ background: '#0F0A1E' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0 relative z-30" style={{
        background: 'rgba(0,0,0,0.55)',
        borderBottom: '2px solid rgba(255,255,255,0.18)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.18)', borderRadius: 6, border: '2px solid rgba(255,255,255,0.45)', boxShadow: '0 2px 0 rgba(0,0,0,0.25)' }}>
          <ChevronLeft size={16} className="text-white" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #047857, #10B981)', border: '2px solid #064e3b', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          FIZZY EREN
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
        <div className="ml-1 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 4, fontSize: 6, color: '#A3F0C0', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {currentTheme.name}
        </div>
      </div>

      {/* Field */}
      <div ref={fieldRef} onPointerDown={flap}
        className="relative flex-1 overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: 'pointer' }}>

        {/* Stacked sky layers — only the active one is fully opaque, others
            fade out. Result: smooth crossfade when themeIndex changes. */}
        {THEMES.map((t, i) => (
          <div key={`sky-${t.name}`} style={{
            position: 'absolute', inset: 0,
            background: t.sky,
            opacity: i === themeIndex ? 1 : 0,
            transition: 'opacity 1.4s ease',
            pointerEvents: 'none',
          }} />
        ))}

        {/* Stars (visible only in night) */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: currentTheme.starOpacity,
          transition: 'opacity 1.4s ease',
          pointerEvents: 'none',
        }}>
          {STAR_POSITIONS.map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: s.left, top: s.top,
              width: s.size, height: s.size,
              background: '#FFFFFF',
              borderRadius: '50%',
              boxShadow: '0 0 4px rgba(255,255,255,0.7)',
              animation: `twinkle 2.4s ease-in-out ${s.delay} infinite`,
            }} />
          ))}
          {/* Moon */}
          <div style={{
            position: 'absolute',
            top: '12%', right: '14%',
            width: 28, height: 28,
            background: 'radial-gradient(circle at 35% 35%, #FFFFFF, #E5E7EB 60%, #9CA3AF 100%)',
            borderRadius: '50%',
            boxShadow: '0 0 18px rgba(255,255,255,0.4)',
          }} />
        </div>

        {/* Clouds (faded out at night) */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: currentTheme.cloudOpacity,
          transition: 'opacity 1.4s ease',
          pointerEvents: 'none',
        }}>
          <Cloud x="12%"  y="14%" scale={1.0} />
          <Cloud x="68%"  y="22%" scale={0.8} />
          <Cloud x="35%"  y="46%" scale={1.2} />
          <Cloud x="86%"  y="60%" scale={0.7} />
          <Cloud x="6%"   y="70%" scale={0.9} />
        </div>

        {/* Pipes */}
        {pipesRef.current.map(p => (
          <PipePair key={p.id} pipe={p} fieldH={fieldDims.h} theme={currentTheme} />
        ))}

        {/* Eren on can — outer wrapper handles position; inner wrapper applies
            the flap squash/stretch + swing kick on top of the vy-based tilt. */}
        {(() => {
          const impact = getFlapImpact(performance.now())
          return (
            <div style={{
              position: 'absolute',
              left: PLAYER_X,
              top: yRef.current,
              width: EREN_W,
              height: EREN_H,
              willChange: 'transform, top',
            }}>
              <div style={{
                width: '100%', height: '100%',
                transform: `rotate(${angleRef.current + impact.r}deg) scale(${impact.sx}, ${impact.sy})`,
                transformOrigin: '50% 70%',
              }}>
                <ErenOnCan />
              </div>
            </div>
          )
        })()}

        {/* Fizz particles */}
        {particlesRef.current.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            left: p.x, top: p.y,
            width: p.size, height: p.size,
            background: p.color,
            opacity: p.alpha,
            borderRadius: '50%',
            pointerEvents: 'none',
            boxShadow: p.color === '#FFFFFF' ? '0 0 4px rgba(255,255,255,0.8)' : 'none',
          }} />
        ))}

        {/* Ground — also crossfades */}
        {THEMES.map((t, i) => (
          <div key={`ground-${t.name}`} style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 12,
            background: t.ground,
            borderTop: `3px solid ${t.groundBorder}`,
            opacity: i === themeIndex ? 1 : 0,
            transition: 'opacity 1.4s ease',
          }} />
        ))}

        {/* Score */}
        {state !== 'idle' && (
          <div className="absolute font-pixel pointer-events-none" style={{
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 36,
            color: 'white',
            textShadow: '3px 3px 0 #064e3b, -1px -1px 0 #064e3b',
            letterSpacing: 2,
          }}>
            {score}
          </div>
        )}

        {/* Idle overlay */}
        {state === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div style={{
              padding: '14px 22px',
              background: 'rgba(0,0,0,0.55)',
              border: '3px solid rgba(255,255,255,0.5)',
              borderRadius: 6,
              boxShadow: '0 4px 0 rgba(0,0,0,0.4)',
            }}>
              <p className="font-pixel text-white text-center" style={{ fontSize: 9, letterSpacing: 2 }}>TAP TO START</p>
              <p className="font-pixel text-center mt-2" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>FIZZ TO FLY · DODGE PIPES</p>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {state === 'gameover' && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-3 px-6 py-5"
              style={{
                background: 'linear-gradient(180deg, #15122A 0%, #0F0A1E 100%)',
                border: '3px solid #10B981',
                borderRadius: 6,
                boxShadow: '0 6px 0 #064e3b, 0 0 24px rgba(16,185,129,0.4)',
                animation: 'goPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
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
              <button onClick={() => { playSound('ui_tap'); reset() }}
                className="mt-3 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                  border: '2px solid #064e3b',
                  borderRadius: 3,
                  boxShadow: '0 4px 0 #064e3b',
                  fontFamily: '"Press Start 2P"',
                  fontSize: 8,
                  letterSpacing: 1.5,
                }}>
                <RefreshCw size={11} />
                AGAIN
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes goPop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Pipe pair ────────────────────────────────────────────────────────────────
function PipePair({ pipe, fieldH, theme }: { pipe: Pipe; fieldH: number; theme: Theme }) {
  const grad = `linear-gradient(90deg, ${theme.pipeColor1} 0%, ${theme.pipeColor2} 30%, ${theme.pipeColor3} 50%, ${theme.pipeColor2} 70%, ${theme.pipeColor1} 100%)`
  return (
    <>
      <div style={{
        position: 'absolute',
        left: pipe.x, top: 0, width: PIPE_W, height: pipe.gapY,
        background: grad,
        borderLeft: `3px solid ${theme.pipeShadow}`,
        borderRight: `3px solid ${theme.pipeShadow}`,
        transition: 'background 1.4s ease, border-color 1.4s ease',
      }} />
      <div style={{
        position: 'absolute',
        left: pipe.x - 5, top: pipe.gapY - 14, width: PIPE_W + 10, height: 14,
        background: grad,
        border: `3px solid ${theme.pipeShadow}`,
        transition: 'background 1.4s ease, border-color 1.4s ease',
      }} />
      <div style={{
        position: 'absolute',
        left: pipe.x,
        top: pipe.gapY + PIPE_GAP,
        width: PIPE_W,
        height: Math.max(0, fieldH - pipe.gapY - PIPE_GAP - 12),
        background: grad,
        borderLeft: `3px solid ${theme.pipeShadow}`,
        borderRight: `3px solid ${theme.pipeShadow}`,
        transition: 'background 1.4s ease, border-color 1.4s ease',
      }} />
      <div style={{
        position: 'absolute',
        left: pipe.x - 5, top: pipe.gapY + PIPE_GAP, width: PIPE_W + 10, height: 14,
        background: grad,
        border: `3px solid ${theme.pipeShadow}`,
        transition: 'background 1.4s ease, border-color 1.4s ease',
      }} />
    </>
  )
}

// ─── Pixel cloud ──────────────────────────────────────────────────────────────
function Cloud({ x, y, scale = 1 }: { x: string; y: string; scale?: number }) {
  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y, transform: `scale(${scale})` }}>
      <svg width="48" height="22" viewBox="0 0 48 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="6"  y="6"  width="36" height="10" fill="#FFFFFF" />
        <rect x="10" y="3"  width="10" height="3"  fill="#FFFFFF" />
        <rect x="22" y="2"  width="14" height="4"  fill="#FFFFFF" />
        <rect x="4"  y="10" width="40" height="6"  fill="#FFFFFF" />
        <rect x="8"  y="16" width="32" height="2"  fill="#E5E7EB" />
      </svg>
    </div>
  )
}

// ─── Eren on a high-detail energy can ─────────────────────────────────────────
function ErenOnCan() {
  return (
    <svg width={EREN_W} height={EREN_H} viewBox="0 0 44 64" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ═══ EREN CHIBI — clean Ragdoll, forward gaze ═══ */}
      <g transform="translate(11, 0)">
        {/* ears */}
        <rect x="3"  y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="3"  y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="4"  y="4" width="1" height="1" fill="#F4B0B8" />
        <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
        {/* head outline */}
        <rect x="5"  y="3" width="12" height="1" fill="#4A2E1A" />
        <rect x="4"  y="4" width="14" height="1" fill="#4A2E1A" />
        <rect x="3"  y="5" width="16" height="1" fill="#4A2E1A" />
        <rect x="3"  y="6" width="1"  height="6" fill="#4A2E1A" />
        <rect x="18" y="6" width="1"  height="6" fill="#4A2E1A" />
        {/* head fill — pure cream */}
        <rect x="4"  y="5" width="14" height="1" fill="#F9EDD5" />
        <rect x="4"  y="6" width="14" height="6" fill="#F9EDD5" />
        {/* eyes — wide and excited (the can is exploding under him) */}
        <rect x="6"  y="7" width="2" height="2" fill="#6BAED6" />
        <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
        <rect x="6"  y="7" width="1" height="1" fill="#FFFFFF" />
        <rect x="15" y="7" width="1" height="1" fill="#FFFFFF" />
        <rect x="7"  y="8" width="1" height="1" fill="#1A1A2E" />
        <rect x="14" y="8" width="1" height="1" fill="#1A1A2E" />
        {/* cheeks below eyes */}
        <rect x="4"  y="10" width="2" height="1" fill="#FFB6C8" />
        <rect x="16" y="10" width="2" height="1" fill="#FFB6C8" />
        {/* nose */}
        <rect x="10" y="9"  width="2" height="1" fill="#F48B9B" />
        <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
        {/* open little mouth — wind-in-fur look */}
        <rect x="9"  y="11" width="1" height="1" fill="#4A2E1A" />
        <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
        <rect x="10" y="11" width="2" height="1" fill="#FF6B9D" />
        {/* chin */}
        <rect x="4"  y="12" width="14" height="1" fill="#4A2E1A" />
        <rect x="5"  y="12" width="12" height="1" fill="#F9EDD5" />
        {/* body — narrower than head for chibi proportions */}
        <rect x="6"  y="13" width="10" height="1" fill="#4A2E1A" />
        <rect x="5"  y="14" width="1"  height="6" fill="#4A2E1A" />
        <rect x="16" y="14" width="1"  height="6" fill="#4A2E1A" />
        <rect x="6"  y="14" width="10" height="6" fill="#F9EDD5" />
        <rect x="6"  y="20" width="10" height="1" fill="#4A2E1A" />
        {/* paws gripping the can rim — extend outward + downward */}
        <rect x="3"  y="18" width="3" height="2" fill="#D4B896" />
        <rect x="2"  y="18" width="1" height="2" fill="#4A2E1A" />
        <rect x="3"  y="20" width="3" height="1" fill="#4A2E1A" />
        <rect x="16" y="18" width="3" height="2" fill="#D4B896" />
        <rect x="19" y="18" width="1" height="2" fill="#4A2E1A" />
        <rect x="16" y="20" width="3" height="1" fill="#4A2E1A" />
        {/* wind whiskers (one extra fluff line per cheek for motion) */}
        <rect x="0"  y="9"  width="3" height="1" fill="rgba(255,255,255,0.55)" />
        <rect x="19" y="9"  width="3" height="1" fill="rgba(255,255,255,0.55)" />
      </g>

      {/* ═══ HIGH-DETAIL ENERGY CAN (16w × 30h, centered x=14..30) ═══ */}
      {/* outer rim shadow at top (gives the can a "rolled lip") */}
      <rect x="14" y="21" width="16" height="1" fill="#3A3A3A" />
      {/* black opening line */}
      <rect x="14" y="22" width="16" height="1" fill="#0A0A0A" />
      {/* lid silver wedge — tiny dimple where you'd pull the tab */}
      <rect x="15" y="23" width="14" height="1" fill="#3A3A3A" />
      <rect x="20" y="23" width="4"  height="1" fill="#1A1A1A" />
      <rect x="14" y="23" width="1"  height="1" fill="#0A0A0A" />
      <rect x="29" y="23" width="1"  height="1" fill="#0A0A0A" />

      {/* Top metallic ring (silver highlight + dark line beneath) */}
      <rect x="14" y="24" width="16" height="2" fill="#525252" />
      <rect x="15" y="24" width="14" height="1" fill="#D1D5DB" />
      <rect x="15" y="25" width="14" height="1" fill="#525252" />
      <rect x="14" y="25" width="1"  height="1" fill="#0A0A0A" />
      <rect x="29" y="25" width="1"  height="1" fill="#0A0A0A" />

      {/* dark lip just under the ring */}
      <rect x="14" y="26" width="16" height="1" fill="#000000" />

      {/* Body base black */}
      <rect x="14" y="27" width="16" height="24" fill="#0F0F0F" />

      {/* Left vertical highlight column (sheen) */}
      <rect x="15" y="27" width="2" height="24" fill="#262626" />
      <rect x="15" y="27" width="1" height="24" fill="#3A3A3A" />
      <rect x="16" y="29" width="1" height="14" fill="#525252" />
      {/* tiny moving-light glint */}
      <rect x="17" y="32" width="1" height="2" fill="#7A7A7A" />

      {/* Right vertical shadow column */}
      <rect x="27" y="27" width="2" height="24" fill="#1A1A1A" />
      <rect x="28" y="27" width="1" height="24" fill="#000000" />

      {/* Outer left/right black borders */}
      <rect x="14" y="27" width="1"  height="24" fill="#0A0A0A" />
      <rect x="29" y="27" width="1"  height="24" fill="#0A0A0A" />

      {/* Claw-mark logo — three lime streaks with brighter cores + tip glints */}
      <rect x="18" y="32" width="2"  height="14" fill="#10B981" />
      <rect x="18" y="32" width="1"  height="14" fill="#34D399" />
      <rect x="19" y="33" width="1"  height="3"  fill="#A3F0C0" />
      <rect x="18" y="31" width="2"  height="1"  fill="#A3F0C0" />
      <rect x="18" y="46" width="2"  height="1"  fill="#A3F0C0" />

      <rect x="22" y="34" width="2"  height="11" fill="#10B981" />
      <rect x="22" y="34" width="1"  height="11" fill="#34D399" />
      <rect x="23" y="35" width="1"  height="3"  fill="#A3F0C0" />
      <rect x="22" y="33" width="2"  height="1"  fill="#A3F0C0" />
      <rect x="22" y="45" width="2"  height="1"  fill="#A3F0C0" />

      <rect x="26" y="32" width="2"  height="14" fill="#10B981" />
      <rect x="26" y="32" width="1"  height="14" fill="#34D399" />
      <rect x="27" y="33" width="1"  height="3"  fill="#A3F0C0" />
      <rect x="26" y="31" width="2"  height="1"  fill="#A3F0C0" />
      <rect x="26" y="46" width="2"  height="1"  fill="#A3F0C0" />

      {/* "EE" pixel badge below the claws */}
      <rect x="20" y="48" width="1" height="3" fill="#A3F0C0" />
      <rect x="21" y="48" width="2" height="1" fill="#A3F0C0" />
      <rect x="21" y="49" width="1" height="1" fill="#A3F0C0" />
      <rect x="21" y="50" width="2" height="1" fill="#A3F0C0" />
      <rect x="24" y="48" width="1" height="3" fill="#A3F0C0" />
      <rect x="25" y="48" width="2" height="1" fill="#A3F0C0" />
      <rect x="25" y="49" width="1" height="1" fill="#A3F0C0" />
      <rect x="25" y="50" width="2" height="1" fill="#A3F0C0" />

      {/* Bottom metallic ring */}
      <rect x="14" y="51" width="16" height="2" fill="#525252" />
      <rect x="15" y="51" width="14" height="1" fill="#D1D5DB" />
      <rect x="15" y="52" width="14" height="1" fill="#525252" />
      <rect x="14" y="53" width="16" height="1" fill="#0A0A0A" />

      {/* Fizz mouth — explosive opening at the bottom */}
      <rect x="17" y="54" width="10" height="2" fill="#A3F0C0" />
      <rect x="18" y="55" width="8"  height="1" fill="#FFFFFF" />
      <rect x="18" y="56" width="8"  height="1" fill="#10B981" />
      <rect x="19" y="57" width="6"  height="1" fill="#34D399" opacity="0.85" />
      <rect x="20" y="58" width="4"  height="1" fill="#FFFFFF" opacity="0.6" />
      <rect x="21" y="59" width="2"  height="1" fill="#A3F0C0" opacity="0.6" />
    </svg>
  )
}
