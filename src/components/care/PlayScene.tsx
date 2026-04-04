'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, Gamepad2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'

interface Props { onClose: () => void }
interface BallPos { x: number; y: number }

export default function PlayScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()

  const [ballPos,      setBallPos]      = useState<BallPos>({ x: 50, y: 44 })
  const [throwCount,   setThrowCount]   = useState(0)
  const [done,         setDone]         = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)
  const [lookDir,      setLookDir]      = useState<'left'|'right'>('right')
  const [ballMoving,   setBallMoving]   = useState(false)
  const [trailDots,    setTrailDots]    = useState<{id:number;x:number;y:number}[]>([])
  const sceneRef = useRef<HTMLDivElement>(null)
  const animRef  = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const trailId  = useRef(0)

  const animateBall = useCallback((sx: number, sy: number, vx: number, vy: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    let x = sx, y = sy, dvx = vx, dvy = vy
    const step = () => {
      x += dvx; y += dvy; dvy += 0.45
      if (x <= 3 || x >= 97) { dvx *= -0.75; x = x <= 3 ? 3 : 97 }
      if (y >= 60)            { dvy *= -0.65; y = 60; dvx *= 0.88 }
      if (y <= 5)             { dvy *= -0.8;  y = 5 }
      setBallPos({ x, y })
      setTrailDots(ts => [...ts.slice(-8), { id: trailId.current++, x, y }])
      if (Math.sqrt(dvx * dvx + dvy * dvy) > 0.35) {
        animRef.current = requestAnimationFrame(step)
      } else {
        setBallMoving(false)
        setTrailDots([])
      }
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  function handleThrow(e: React.MouseEvent<HTMLDivElement>) {
    if (done) return
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = ((e.clientX - rect.left) / rect.width)  * 100
    const cy = ((e.clientY - rect.top)  / rect.height) * 100
    const dx = cx - ballPos.x, dy = cy - ballPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = Math.min(dist * 0.28, 9)
    setBallMoving(true)
    setLookDir(cx > 50 ? 'right' : 'left')
    animateBall(ballPos.x, ballPos.y, (dx / dist) * speed, (dy / dist) * speed)
    setThrowCount(c => c + 1)
  }

  async function handleDone() {
    if (!user?.id || saving || throwCount < 1) return
    setSaving(true)
    const result = await applyAction(user.id, 'play')
    setSaving(false)
    setDone(true)
    setToast(result.message)
    if (result.success) completeTask('daily_play')
    setTimeout(() => setToast(null), 2500)
  }

  const mood = done ? 'happy' : throwCount >= 3 ? 'playful' : 'idle'
  const energy = stats?.energy ?? 100

  return (
    <div ref={sceneRef}
      className="fixed inset-0 z-40 overflow-hidden select-none"
      onClick={handleThrow}>

      {/* ══ BACKGROUND IMAGE ══ */}
      <img src="/playroom.png" alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", objectPosition: "center" }} draggable={false} />

            {/* ══ EREN ══ */}
      <div className={cn('absolute z-10 transition-all duration-500')}
        style={{ bottom: '10%', left: '50%', transform: `translateX(-50%) scaleX(${lookDir === 'left' ? -1 : 1})` }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 200, height: 200, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ UI ══ */}
      <button onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 left-4 z-50 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', borderRadius: 3, border: '2px solid rgba(160,120,230,0.4)', boxShadow: '2px 2px 0 rgba(120,80,200,0.2)', padding: 8 }}>
        <ChevronLeft size={20} className="text-purple-700" />
      </button>

      {/* Games link */}
      <Link href="/games" onClick={e => e.stopPropagation()}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 active:scale-95 transition-transform"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderRadius: 3, border: '2px solid rgba(160,120,230,0.4)', boxShadow: '2px 2px 0 rgba(120,80,200,0.2)', padding: '7px 10px' }}>
        <Gamepad2 size={14} className="text-purple-600" />
        <span className="font-pixel text-purple-600" style={{ fontSize: 6 }}>GAMES</span>
      </Link>

      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap"
          style={{ background: '#1F1F2E', borderRadius: 3, border: '2px solid #3A3A5E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {throwCount === 0 && !done && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 pointer-events-none animate-pulse-soft"
          style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 3, border: '2px solid #C0A0E8', boxShadow: '2px 2px 0 rgba(150,100,220,0.2)', fontFamily: '"Press Start 2P"', fontSize: 7, color: '#7C3AED' }}>
          TAP TO THROW THE BALL!
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div className="absolute bottom-5 inset-x-0 flex flex-col items-center gap-2 px-8 z-20" onClick={e => e.stopPropagation()}>
        {/* Energy bar — pixel segments */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-pixel text-purple-600" style={{ fontSize: 7 }}>ENERGY</span>
            <span className="font-pixel text-purple-600" style={{ fontSize: 7 }}>{energy}</span>
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1" style={{ height: 10, borderRadius: 2, background: i < Math.round(energy / 100 * 12) ? (energy > 50 ? '#A78BFA' : energy > 25 ? '#F5C842' : '#F87171') : '#E8E0FF', boxShadow: i < Math.round(energy / 100 * 12) ? '0 1px 0 rgba(0,0,0,0.15)' : 'none' }} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-pixel text-purple-600" style={{ fontSize: 7 }}>THROWS: {throwCount}</span>
          {throwCount >= 3 && !done && (
            <span className="font-pixel text-green-600 px-2 py-0.5" style={{ fontSize: 6, background: '#D1FAE5', borderRadius: 2, border: '1px solid #6EE7B7' }}>READY! ★</span>
          )}
        </div>

        <button onClick={handleDone} disabled={throwCount < 1 || done || saving}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-40"
          style={done
            ? { background: '#4ade80', borderRadius: 3, border: '2px solid #16a34a', boxShadow: '0 3px 0 #15803d', fontFamily: '"Press Start 2P"', fontSize: 8 }
            : saving
              ? { background: '#C084FC', borderRadius: 3, border: '2px solid #9333ea', boxShadow: '0 3px 0 #7e22ce', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : throwCount < 1
                ? { background: '#D0C8E8', borderRadius: 3, border: '2px solid #B0A8D0', fontFamily: '"Press Start 2P"', fontSize: 8, color: '#9090B0' }
                : { background: 'linear-gradient(135deg, #C084FC, #A855F7)', borderRadius: 3, border: '2px solid #7C3AED', boxShadow: '0 3px 0 #5B21B6', fontFamily: '"Press Start 2P"', fontSize: 8 }
          }>
          {done ? 'GREAT SESSION!' : saving ? 'SAVING...' : 'DONE PLAYING'}
        </button>
      </div>
    </div>
  )
}
