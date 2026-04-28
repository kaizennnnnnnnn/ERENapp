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
const GRAVITY        = 1700  // px/s²
const FLAP_V         = -440  // instantaneous up burst on tap
const PIPE_W         = 60
const PIPE_GAP       = 175
const PIPE_INTERVAL  = 1500  // ms between pipe spawns
const SPEED_BASE     = 215   // px/s scroll
const SPEED_MAX      = 320
const EREN_W         = 48
const EREN_H         = 64
const PLAYER_X       = 80
const FIZZ_INTERVAL  = 60    // ms between trail puffs

interface Pipe { id: number; x: number; gapY: number; passed: boolean }
interface Particle { id: number; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; alpha: number; color: string }

let _pid = 0
const newId = () => ++_pid

export default function FlappyErenGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])
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

  const [state, setState]       = useState<'idle' | 'running' | 'gameover'>('idle')
  const [score, setScore]       = useState(0)
  const [bestScore, setBestScore] = useState(0)

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
    const py = yRef.current + EREN_H - 6
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
    for (let i = 0; i < 12; i++) {
      const px = PLAYER_X + EREN_W / 2 - 4 + (Math.random() - 0.5) * 14
      const py = yRef.current + EREN_H - 6
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
    spawnFlapBurst()
    playSound('ui_tap')
  }

  function aabbHits(): boolean {
    const ex = PLAYER_X
    const ey = yRef.current
    if (ey < -8) return true
    if (ey + EREN_H > fieldDims.h - 12) return true

    // shrink hitbox slightly so it feels generous
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

    speedRef.current = Math.min(SPEED_MAX, SPEED_BASE + scoreRef.current * 4)
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
    lastPipeRef.current = performance.now() - PIPE_INTERVAL + 500 // first pipe in ~0.5s
    lastFizzRef.current = performance.now()
    lastFrameRef.current = performance.now()
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
    <div className="fixed inset-0 z-40 flex flex-col" style={{
      background: 'linear-gradient(180deg, #5BACEC 0%, #8FCCEF 50%, #C5E2EA 75%, #FCE7B4 100%)',
    }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'rgba(0,0,0,0.25)',
        borderBottom: '2px solid rgba(255,255,255,0.25)',
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
      </div>

      {/* Field */}
      <div ref={fieldRef} onPointerDown={flap}
        className="relative flex-1 overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: 'pointer' }}>

        {/* Pixel clouds (parallax-ish) */}
        <Cloud x="12%"  y="14%" scale={1.0} />
        <Cloud x="68%"  y="22%" scale={0.8} />
        <Cloud x="35%"  y="46%" scale={1.2} />
        <Cloud x="86%"  y="60%" scale={0.7} />
        <Cloud x="6%"   y="70%" scale={0.9} />

        {/* Pipes */}
        {pipesRef.current.map(p => (
          <PipePair key={p.id} pipe={p} fieldH={fieldDims.h} />
        ))}

        {/* Eren on can */}
        <div style={{
          position: 'absolute',
          left: PLAYER_X,
          top: yRef.current,
          width: EREN_W,
          height: EREN_H,
          transform: `rotate(${angleRef.current}deg)`,
          transformOrigin: '50% 65%',
          willChange: 'transform, top',
        }}>
          <ErenOnCan />
        </div>

        {/* Fizz particles — drawn after Eren so they layer on top of his back */}
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

        {/* Ground */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 12, background: 'repeating-linear-gradient(90deg, #16a34a 0 8px, #15803d 8px 16px)', borderTop: '3px solid #052e16' }} />

        {/* Score (floating) */}
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
      `}</style>
    </div>
  )
}

// ─── Pipe pair ────────────────────────────────────────────────────────────────
function PipePair({ pipe, fieldH }: { pipe: Pipe; fieldH: number }) {
  return (
    <>
      {/* Top pipe body */}
      <div style={{
        position: 'absolute',
        left: pipe.x, top: 0, width: PIPE_W, height: pipe.gapY,
        background: 'linear-gradient(90deg, #14a052 0%, #16a34a 30%, #22c55e 50%, #16a34a 70%, #14a052 100%)',
        borderLeft: '3px solid #064e3b',
        borderRight: '3px solid #064e3b',
      }} />
      {/* Top pipe lip */}
      <div style={{
        position: 'absolute',
        left: pipe.x - 5, top: pipe.gapY - 14, width: PIPE_W + 10, height: 14,
        background: 'linear-gradient(90deg, #14a052 0%, #16a34a 30%, #22c55e 50%, #16a34a 70%, #14a052 100%)',
        border: '3px solid #064e3b',
      }} />
      {/* Bottom pipe body */}
      <div style={{
        position: 'absolute',
        left: pipe.x,
        top: pipe.gapY + PIPE_GAP,
        width: PIPE_W,
        height: Math.max(0, fieldH - pipe.gapY - PIPE_GAP - 12),
        background: 'linear-gradient(90deg, #14a052 0%, #16a34a 30%, #22c55e 50%, #16a34a 70%, #14a052 100%)',
        borderLeft: '3px solid #064e3b',
        borderRight: '3px solid #064e3b',
      }} />
      {/* Bottom pipe lip */}
      <div style={{
        position: 'absolute',
        left: pipe.x - 5, top: pipe.gapY + PIPE_GAP, width: PIPE_W + 10, height: 14,
        background: 'linear-gradient(90deg, #14a052 0%, #16a34a 30%, #22c55e 50%, #16a34a 70%, #14a052 100%)',
        border: '3px solid #064e3b',
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

// ─── Eren riding the energy can ──────────────────────────────────────────────
function ErenOnCan() {
  return (
    <svg width={EREN_W} height={EREN_H} viewBox="0 0 48 64" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ─── Eren chibi head/body (top) ─── */}
      {/* ears */}
      <rect x="13" y="0" width="3" height="2" fill="#4A2E1A" />
      <rect x="32" y="0" width="3" height="2" fill="#4A2E1A" />
      <rect x="13" y="2" width="3" height="2" fill="#9B7A5C" />
      <rect x="32" y="2" width="3" height="2" fill="#9B7A5C" />
      <rect x="14" y="3" width="1" height="1" fill="#F4B0B8" />
      <rect x="33" y="3" width="1" height="1" fill="#F4B0B8" />
      {/* head outline + face */}
      <rect x="13" y="2" width="22" height="2" fill="#4A2E1A" />
      <rect x="11" y="4" width="26" height="2" fill="#4A2E1A" />
      <rect x="11" y="6" width="2"  height="14" fill="#4A2E1A" />
      <rect x="35" y="6" width="2"  height="14" fill="#4A2E1A" />
      <rect x="13" y="20" width="22" height="2" fill="#4A2E1A" />
      <rect x="13" y="4"  width="22" height="2" fill="#F9EDD5" />
      <rect x="13" y="6"  width="22" height="14" fill="#F9EDD5" />
      {/* Ragdoll mask */}
      <rect x="14" y="6" width="5" height="3" fill="#D4B896" />
      <rect x="29" y="6" width="5" height="3" fill="#D4B896" />
      {/* eyes — wide-eyed thrill */}
      <rect x="16" y="9"  width="4" height="4" fill="#6BAED6" />
      <rect x="28" y="9"  width="4" height="4" fill="#6BAED6" />
      <rect x="17" y="10" width="2" height="2" fill="#1A1A2E" />
      <rect x="29" y="10" width="2" height="2" fill="#1A1A2E" />
      <rect x="18" y="10" width="1" height="1" fill="#FFFFFF" />
      <rect x="30" y="10" width="1" height="1" fill="#FFFFFF" />
      {/* nose */}
      <rect x="22" y="14" width="4" height="2" fill="#F48B9B" />
      <rect x="22" y="16" width="4" height="1" fill="#4A2E1A" />
      {/* smile */}
      <rect x="20" y="17" width="2" height="1" fill="#4A2E1A" />
      <rect x="26" y="17" width="2" height="1" fill="#4A2E1A" />
      <rect x="22" y="18" width="4" height="1" fill="#4A2E1A" />
      {/* paws gripping the can */}
      <rect x="11" y="22" width="4" height="3" fill="#F9EDD5" />
      <rect x="11" y="22" width="1" height="3" fill="#4A2E1A" />
      <rect x="33" y="22" width="4" height="3" fill="#F9EDD5" />
      <rect x="36" y="22" width="1" height="3" fill="#4A2E1A" />

      {/* ─── Energy can ─── */}
      {/* top rim */}
      <rect x="14" y="22" width="20" height="2" fill="#3A3A3A" />
      <rect x="15" y="23" width="18" height="1" fill="#5A5A5A" />
      {/* body */}
      <rect x="14" y="24" width="20" height="32" fill="#0F0F0F" />
      {/* highlights / shadow */}
      <rect x="15" y="25" width="2"  height="29" fill="#262626" />
      <rect x="31" y="25" width="2"  height="29" fill="#1A1A1A" />
      <rect x="32" y="25" width="1"  height="29" fill="#000000" />
      {/* M-style claw mark in green */}
      <rect x="18" y="30" width="2" height="14" fill="#10B981" />
      <rect x="19" y="29" width="1" height="2"  fill="#A3F0C0" />
      <rect x="22" y="32" width="2" height="10" fill="#10B981" />
      <rect x="22" y="31" width="1" height="1"  fill="#A3F0C0" />
      <rect x="26" y="32" width="2" height="10" fill="#10B981" />
      <rect x="26" y="31" width="1" height="1"  fill="#A3F0C0" />
      <rect x="30" y="30" width="2" height="14" fill="#10B981" />
      <rect x="30" y="29" width="1" height="2"  fill="#A3F0C0" />
      {/* bottom rim */}
      <rect x="14" y="56" width="20" height="2" fill="#3A3A3A" />
      <rect x="15" y="57" width="18" height="1" fill="#1A1A1A" />
      {/* fizz mouth at bottom (the "exploding" bit) */}
      <rect x="18" y="58" width="12" height="2" fill="#A3F0C0" />
      <rect x="20" y="60" width="8"  height="2" fill="#10B981" opacity="0.6" />
    </svg>
  )
}
