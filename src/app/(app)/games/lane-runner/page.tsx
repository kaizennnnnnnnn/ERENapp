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
import { IconCoin, IconStar } from '@/components/PixelIcons'

const LANES = 3
const SPEED_BASE = 270
const SPEED_RAMP = 14    // px/s² → speed += 14 per second elapsed
const SPEED_MAX = 620
const SPAWN_BASE = 720
const SPAWN_MIN  = 280
const PLAYER_BOTTOM = 90  // distance from ground line
const ITEM_SIZE = 46
const COLLIDE_INSET = 10

type Variant = 'mouse' | 'vacuum' | 'cucumber' | 'dog' | 'coin' | 'fish'

interface Item {
  id: number
  lane: 0 | 1 | 2
  y: number
  variant: Variant
  collected?: boolean
}

let _iid = 0
const newId = () => ++_iid

// 70% obstacle, 30% pickup. Within obstacles each variant equally likely.
const OBSTACLE_VARIANTS: Variant[] = ['mouse', 'vacuum', 'cucumber', 'dog']
const PICKUP_VARIANTS:   Variant[] = ['coin', 'coin', 'coin', 'fish']  // fish is rarer (worth more)

function isObstacle(v: Variant): boolean {
  return v === 'mouse' || v === 'vacuum' || v === 'cucumber' || v === 'dog'
}

export default function LaneRunnerGame() {
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

  const [phase, setPhase]   = useState<'idle' | 'running' | 'gameover'>('idle')
  const [lane, setLane]     = useState<0 | 1 | 2>(1)
  const [score, setScore]   = useState(0)
  const [coins, setCoins]   = useState(0)
  const [bestScore, setBest] = useState(0)
  const [stripeOffset, setStripeOffset] = useState(0)

  const stateRef       = useRef<'idle' | 'running' | 'gameover'>('idle')
  const itemsRef       = useRef<Item[]>([])
  const speedRef       = useRef(SPEED_BASE)
  const lastSpawnRef   = useRef(0)
  const lastFrameRef   = useRef(0)
  const startTimeRef   = useRef(0)
  const stripeRef      = useRef(0)
  const rafRef         = useRef<number>(0)
  const distanceRef    = useRef(0)
  const coinsRef       = useRef(0)
  const laneRef        = useRef<0 | 1 | 2>(1)
  const savedRef       = useRef(false)

  const [, force] = useReducer((n: number) => n + 1, 0)

  function laneToX(l: 0 | 1 | 2) {
    return ((l + 0.5) / LANES) * fieldDims.w
  }

  function spawn(now: number) {
    const elapsed = (now - startTimeRef.current) / 1000
    const interval = Math.max(SPAWN_MIN, SPAWN_BASE - elapsed * 14)
    if (now - lastSpawnRef.current < interval) return
    lastSpawnRef.current = now

    const isPickup = Math.random() < 0.3
    const variant: Variant = isPickup
      ? PICKUP_VARIANTS[Math.floor(Math.random() * PICKUP_VARIANTS.length)]
      : OBSTACLE_VARIANTS[Math.floor(Math.random() * OBSTACLE_VARIANTS.length)]

    // Avoid spawning so close to the previous one in the same lane that the
    // player can't possibly switch in time. If recent same-lane item exists
    // within 100px of the top, pick a different lane.
    const recent = itemsRef.current.filter(i => i.y < 100)
    const usedLanes = new Set(recent.map(i => i.lane))
    const candidates = ([0, 1, 2] as const).filter(l => !usedLanes.has(l))
    const targetLane = (candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : Math.floor(Math.random() * 3) as 0 | 1 | 2)

    itemsRef.current.push({
      id: newId(),
      lane: targetLane,
      y: -ITEM_SIZE,
      variant,
    })
  }

  function loop(now: number) {
    if (stateRef.current !== 'running') return
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000)
    lastFrameRef.current = now

    const elapsed = (now - startTimeRef.current) / 1000
    speedRef.current = Math.min(SPEED_MAX, SPEED_BASE + elapsed * SPEED_RAMP)

    spawn(now)

    // Move items
    for (const it of itemsRef.current) it.y += speedRef.current * dt

    // Scroll the lane stripes for the running illusion
    stripeRef.current = (stripeRef.current + speedRef.current * dt) % 40
    setStripeOffset(stripeRef.current)

    // Update distance
    distanceRef.current += speedRef.current * dt * 0.05  // tuned so 1 unit feels like a meter
    const distScore = Math.floor(distanceRef.current)
    setScore(distScore + coinsRef.current * 5)

    // Collision check
    const playerY = fieldDims.h - PLAYER_BOTTOM
    const playerLane = laneRef.current
    for (const it of itemsRef.current) {
      if (it.collected) continue
      if (it.lane !== playerLane) continue
      if (Math.abs(it.y - playerY) > ITEM_SIZE / 2 + COLLIDE_INSET) continue
      if (isObstacle(it.variant)) {
        playSound('ui_back')
        endGame()
        return
      }
      // Pickup
      it.collected = true
      const reward = it.variant === 'fish' ? 3 : 1
      coinsRef.current += reward
      setCoins(coinsRef.current)
      playSound('ui_modal_close')
    }

    // Drop offscreen items + collected
    itemsRef.current = itemsRef.current.filter(i => !i.collected && i.y < fieldDims.h + ITEM_SIZE)

    force()
    rafRef.current = requestAnimationFrame(loop)
  }

  function startGame() {
    itemsRef.current = []
    speedRef.current = SPEED_BASE
    distanceRef.current = 0
    coinsRef.current = 0
    laneRef.current = 1
    savedRef.current = false
    setLane(1)
    setScore(0)
    setCoins(0)
    setStripeOffset(0)
    stripeRef.current = 0

    const now = performance.now()
    startTimeRef.current = now
    lastFrameRef.current = now
    lastSpawnRef.current = now - SPAWN_BASE + 400

    stateRef.current = 'running'
    setPhase('running')
    rafRef.current = requestAnimationFrame(loop)
  }

  function endGame() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'gameover'
    setPhase('gameover')
    const finalScore = Math.floor(distanceRef.current) + coinsRef.current * 5
    setBest(b => Math.max(b, finalScore))
    if (!savedRef.current && user?.id && finalScore > 0) {
      savedRef.current = true
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'lane_runner', score: finalScore })
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('lane_runner save:', error) })
      addCoins(Math.min(60, Math.floor(finalScore / 8)))
      completeTask('daily_game')
      if (finalScore >= 200) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function reset() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'idle'
    setPhase('idle')
    itemsRef.current = []
    setScore(0)
    setCoins(0)
  }

  useEffect(() => () => { cancelAnimationFrame(rafRef.current) }, [])

  // Keep ref in sync with state for collision check + lane bounds
  useEffect(() => { laneRef.current = lane }, [lane])

  // Touch swipe handling
  const touchStartRef = useRef({ x: 0, y: 0, t: 0 })
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (stateRef.current !== 'running') return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    const elapsed = Date.now() - touchStartRef.current.t
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return // tap, not swipe
    if (Math.abs(dx) > Math.abs(dy)) {
      const dir = dx > 0 ? 1 : -1
      setLane(l => {
        const next = Math.max(0, Math.min(2, l + dir)) as 0 | 1 | 2
        if (next !== l) playSound('ui_swipe_room')
        return next
      })
    }
    void elapsed
  }

  // Keyboard arrows for desktop
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (stateRef.current !== 'running') return
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        setLane(l => Math.max(0, l - 1) as 0 | 1 | 2)
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        setLane(l => Math.min(2, l + 1) as 0 | 1 | 2)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
          style={{ background: 'linear-gradient(135deg, #166534, #16A34A)', border: '2px solid #052e16', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          LANE RUNNER
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* Field — touch swipe handles lane changes */}
      <div ref={fieldRef}
        className="relative flex-1 overflow-hidden select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}>

        {/* Asphalt + scrolling stripes */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #1F2937 0%, #111827 80%, #030712 100%)',
        }} />

        {/* Side grass margins */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6%', background: 'repeating-linear-gradient(0deg, #16a34a 0 12px, #15803d 12px 24px)' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6%', background: 'repeating-linear-gradient(0deg, #16a34a 0 12px, #15803d 12px 24px)' }} />

        {/* Lane dividers — 2 dashed lines between 3 lanes, scroll downward */}
        {[1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i / LANES) * 100}%`,
            top: 0, bottom: 0, width: 4,
            background: `repeating-linear-gradient(180deg, #FCD34D 0 16px, transparent 16px 40px)`,
            backgroundPositionY: `${stripeOffset}px`,
            transform: 'translateX(-50%)',
            opacity: 0.7,
          }} />
        ))}

        {/* Items */}
        {itemsRef.current.map(it => (
          <div key={it.id} className="absolute pointer-events-none"
            style={{
              left: laneToX(it.lane) - ITEM_SIZE / 2,
              top: it.y - ITEM_SIZE / 2,
              width: ITEM_SIZE, height: ITEM_SIZE,
              filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.45))',
            }}>
            <ItemSprite variant={it.variant} />
          </div>
        ))}

        {/* Eren — animated bobbing run cycle */}
        {phase !== 'idle' && (
          <div className="absolute pointer-events-none"
            style={{
              left: laneToX(lane) - 30,
              bottom: PLAYER_BOTTOM - 30,
              width: 60, height: 60,
              transition: 'left 0.16s cubic-bezier(0.34,1.56,0.64,1)',
              animation: 'run-bob 0.36s ease-in-out infinite',
              filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.45))',
            }}>
            <ErenRunner />
          </div>
        )}

        {/* HUD */}
        {phase !== 'idle' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <span className="font-pixel" style={{
              fontSize: 28, color: 'white',
              textShadow: '3px 3px 0 #000', letterSpacing: 2,
            }}>{score}</span>
            <span className="font-pixel mt-1" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1.5 }}>
              {Math.floor(distanceRef.current)}m · ◎ {coins}
            </span>
          </div>
        )}

        {/* Idle */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 px-6 py-5"
              style={{
                background: 'rgba(0,0,0,0.7)',
                border: '3px solid rgba(255,255,255,0.5)',
                borderRadius: 6,
                boxShadow: '0 4px 0 rgba(0,0,0,0.4)',
              }}>
              <p className="font-pixel text-white text-center" style={{ fontSize: 9, letterSpacing: 2 }}>SWIPE TO RUN</p>
              <p className="font-pixel text-center" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1, lineHeight: 1.6 }}>
                ← SWIPE LEFT · SWIPE RIGHT →<br />
                AVOID DOGS · GRAB COINS
              </p>
              <button onClick={() => { playSound('ui_tap'); startGame() }}
                className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #16A34A 0%, #166534 100%)',
                  border: '2px solid #052e16',
                  borderRadius: 3,
                  boxShadow: '0 4px 0 #052e16',
                  fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5,
                }}>
                <IconStar size={12} /> START
              </button>
            </div>
          </div>
        )}

        {/* Game over */}
        {phase === 'gameover' && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-3 px-6 py-5"
              style={{
                background: 'linear-gradient(180deg, #15122A 0%, #0F0A1E 100%)',
                border: '3px solid #16A34A',
                borderRadius: 6,
                boxShadow: '0 6px 0 #052e16, 0 0 24px rgba(22,163,74,0.4)',
                animation: 'lr-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>
              <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 3 }}>GAME OVER</p>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex flex-col items-center">
                  <span className="font-pixel" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>SCORE</span>
                  <span className="font-pixel text-white" style={{ fontSize: 22 }}>{score}</span>
                </div>
                <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
                <div className="flex flex-col items-center">
                  <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}><IconCoin size={8} /> COINS</span>
                  <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{coins}</span>
                </div>
              </div>
              <span className="font-pixel" style={{ fontSize: 6, color: '#9CA3AF', marginTop: 4 }}>BEST {bestScore}</span>
              <button onClick={() => { playSound('ui_tap'); reset() }}
                className="mt-2 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #16A34A 0%, #166534 100%)',
                  border: '2px solid #052e16',
                  borderRadius: 3,
                  boxShadow: '0 4px 0 #052e16',
                  fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5,
                }}>
                <RefreshCw size={11} /> AGAIN
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes run-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-3px) rotate(2deg); }
        }
        @keyframes lr-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Item sprites — small, bold silhouettes that read clearly on asphalt ────
function ItemSprite({ variant }: { variant: Variant }) {
  if (variant === 'mouse') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="3" y="3" width="6" height="5" fill="#9CA3AF" />
        <rect x="2" y="4" width="8" height="3" fill="#9CA3AF" />
        <rect x="3" y="3" width="2" height="2" fill="#6B7280" />
        <rect x="7" y="3" width="2" height="2" fill="#6B7280" />
        <rect x="4" y="5" width="1" height="1" fill="#1A1A1A" />
        <rect x="7" y="5" width="1" height="1" fill="#1A1A1A" />
        <rect x="5" y="7" width="2" height="1" fill="#FBA8D8" />
        <rect x="9" y="6" width="3" height="1" fill="#9CA3AF" />
      </svg>
    )
  }
  if (variant === 'vacuum') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="6" width="8" height="4" fill="#DC2626" />
        <rect x="2" y="6" width="8" height="1" fill="#FCA5A5" />
        <rect x="2" y="9" width="8" height="1" fill="#7F1D1D" />
        <rect x="4" y="3" width="4" height="3" fill="#1F2937" />
        <rect x="5" y="2" width="2" height="1" fill="#1F2937" />
        <rect x="3" y="10" width="2" height="2" fill="#1F2937" />
        <rect x="7" y="10" width="2" height="2" fill="#1F2937" />
      </svg>
    )
  }
  if (variant === 'cucumber') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="5" width="8" height="3" fill="#16A34A" />
        <rect x="1" y="6" width="10" height="1" fill="#22C55E" />
        <rect x="2" y="5" width="8" height="1" fill="#86EFAC" />
        <rect x="2" y="8" width="8" height="1" fill="#15803D" />
        <rect x="3" y="6" width="1" height="1" fill="#86EFAC" />
        <rect x="6" y="7" width="1" height="1" fill="#86EFAC" />
        <rect x="8" y="6" width="1" height="1" fill="#86EFAC" />
      </svg>
    )
  }
  if (variant === 'dog') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="3" y="3" width="6" height="6" fill="#A06030" />
        <rect x="2" y="4" width="8" height="4" fill="#A06030" />
        <rect x="2" y="3" width="2" height="2" fill="#7A4520" />
        <rect x="8" y="3" width="2" height="2" fill="#7A4520" />
        <rect x="4" y="5" width="1" height="1" fill="#1A1A1A" />
        <rect x="7" y="5" width="1" height="1" fill="#1A1A1A" />
        <rect x="5" y="7" width="2" height="1" fill="#1A1A1A" />
        <rect x="3" y="9" width="2" height="1" fill="#1A1A1A" />
        <rect x="7" y="9" width="2" height="1" fill="#1A1A1A" />
      </svg>
    )
  }
  if (variant === 'coin') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="3" y="2" width="6" height="8" fill="#F59E0B" />
        <rect x="2" y="3" width="8" height="6" fill="#F59E0B" />
        <rect x="3" y="2" width="6" height="1" fill="#FCD34D" />
        <rect x="2" y="3" width="2" height="6" fill="#FCD34D" />
        <rect x="4" y="3" width="4" height="6" fill="#FBBF24" />
        <rect x="5" y="4" width="2" height="4" fill="#92400E" />
        <rect x="5" y="4" width="2" height="1" fill="#451A03" />
      </svg>
    )
  }
  // fish
  return (
    <svg width="100%" height="100%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="2" y="4" width="6" height="4" fill="#6BAED6" />
      <rect x="3" y="3" width="4" height="6" fill="#6BAED6" />
      <rect x="3" y="3" width="4" height="1" fill="#A0CCE5" />
      <rect x="8" y="4" width="1" height="4" fill="#3A88B8" />
      <rect x="9" y="3" width="1" height="2" fill="#3A88B8" />
      <rect x="9" y="7" width="1" height="2" fill="#3A88B8" />
      <rect x="4" y="5" width="1" height="1" fill="#1A1A2E" />
    </svg>
  )
}

// ─── Eren runner sprite — chibi with bobbing run animation handled by parent ─
function ErenRunner() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="3" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="4" y="4" width="1" height="1" fill="#F4B0B8" />
      <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
      <rect x="5" y="3" width="12" height="1" fill="#4A2E1A" />
      <rect x="4" y="4" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="5" width="16" height="1" fill="#4A2E1A" />
      <rect x="3" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="18" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="4" y="5" width="14" height="1" fill="#F9EDD5" />
      <rect x="4" y="6" width="14" height="6" fill="#F9EDD5" />
      <rect x="6" y="7" width="2" height="2" fill="#6BAED6" />
      <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
      <rect x="6" y="7" width="1" height="1" fill="#FFFFFF" />
      <rect x="15" y="7" width="1" height="1" fill="#FFFFFF" />
      <rect x="7" y="8" width="1" height="1" fill="#1A1A2E" />
      <rect x="14" y="8" width="1" height="1" fill="#1A1A2E" />
      <rect x="4" y="10" width="2" height="1" fill="#FFB6C8" />
      <rect x="16" y="10" width="2" height="1" fill="#FFB6C8" />
      <rect x="10" y="9" width="2" height="1" fill="#F48B9B" />
      <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
      <rect x="9" y="11" width="1" height="1" fill="#4A2E1A" />
      <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
      <rect x="4" y="12" width="14" height="1" fill="#4A2E1A" />
      <rect x="5" y="12" width="12" height="1" fill="#F9EDD5" />
      <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />
      <rect x="6" y="13" width="10" height="1" fill="#4A2E1A" />
      <rect x="5" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="16" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="6" y="14" width="10" height="5" fill="#F9EDD5" />
      <rect x="6" y="19" width="10" height="1" fill="#4A2E1A" />
      {/* Running paws — alternating front/back */}
      <rect x="3" y="20" width="4" height="1" fill="#4A2E1A" />
      <rect x="15" y="20" width="4" height="1" fill="#4A2E1A" />
      <rect x="3" y="19" width="2" height="1" fill="#D4B896" />
      <rect x="17" y="19" width="2" height="1" fill="#D4B896" />
    </svg>
  )
}
