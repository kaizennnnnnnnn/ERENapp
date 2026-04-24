'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import {
  IconMeat, IconFish, IconHeart, IconStar, IconCrown, IconCoin,
} from '@/components/PixelIcons'

// ── Config ───────────────────────────────────────────────────────────────────
const GAME_DURATION = 45
const START_LIVES   = 3
const START_SPAWN_MS = 900
const MIN_SPAWN_MS   = 320
const SPAWN_RAMP_PER_SEC = 12
const ITEM_BASE_SPEED = 140   // px/sec at start
const ITEM_SPEED_PER_SEC = 4  // ramp up per second of game time
const EREN_WIDTH  = 64
const ITEM_SIZE   = 32

type ItemKind = 'kibble' | 'fish' | 'cream' | 'golden' | 'shoe' | 'bomb' | 'heart'

interface ItemMeta {
  label: string
  points: number       // negative for bad
  life: number         // change to lives (usually 0 or -1)
  rarity: number       // weight for random spawn
  Icon: React.FC<{ size?: number }>
  tint: string
}

const ITEMS: Record<ItemKind, ItemMeta> = {
  kibble: { label: 'Kibble', points: 1,  life: 0,  rarity: 45, Icon: KibbleIcon, tint: '#F5C842' },
  fish:   { label: 'Fish',   points: 3,  life: 0,  rarity: 25, Icon: IconFish,   tint: '#6BAED6' },
  cream:  { label: 'Cream',  points: 5,  life: 0,  rarity: 12, Icon: CreamIcon,  tint: '#E9D5FF' },
  golden: { label: 'Golden', points: 10, life: 0,  rarity: 5,  Icon: IconStar,   tint: '#FFD700' },
  heart:  { label: 'Heart',  points: 0,  life: 1,  rarity: 4,  Icon: IconHeart,  tint: '#FF6B9D' },
  shoe:   { label: 'Shoe',   points: -4, life: -1, rarity: 6,  Icon: ShoeIcon,   tint: '#8B5A2B' },
  bomb:   { label: 'Bomb',   points: -6, life: -1, rarity: 3,  Icon: BombIcon,   tint: '#DC2626' },
}

const KINDS = Object.keys(ITEMS) as ItemKind[]
const WEIGHT_SUM = KINDS.reduce((s, k) => s + ITEMS[k].rarity, 0)

function pickKind(): ItemKind {
  const r = Math.random() * WEIGHT_SUM
  let acc = 0
  for (const k of KINDS) {
    acc += ITEMS[k].rarity
    if (r < acc) return k
  }
  return 'kibble'
}

interface FallingItem {
  id: number
  x: number          // px from center of scene
  y: number          // px from top
  kind: ItemKind
  caught: boolean
  missed: boolean
}

interface FloatText { id: number; x: number; y: number; text: string; color: string; t0: number }

// Simple pixel icons specific to this game
function KibbleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="3" width="6" height="6" fill="#D4892A" />
      <rect x="4" y="4" width="4" height="4" fill="#F5C842" />
      <rect x="4" y="4" width="1" height="1" fill="#FFF4A3" />
    </svg>
  )
}
function CreamIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="2" width="6" height="2" fill="#FFFFFF" />
      <rect x="2" y="4" width="8" height="6" fill="#E9D5FF" />
      <rect x="2" y="4" width="8" height="1" fill="#FFFFFF" />
      <rect x="3" y="10" width="6" height="1" fill="#A78BFA" />
    </svg>
  )
}
function ShoeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="1" y="6" width="10" height="3" fill="#8B5A2B" />
      <rect x="2" y="4" width="6" height="2" fill="#A0732A" />
      <rect x="1" y="9" width="10" height="1" fill="#4A2810" />
      <rect x="3" y="5" width="1" height="1" fill="#FFFFFF" />
    </svg>
  )
}
function BombIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="6" y="1" width="1" height="3" fill="#F5C842" />
      <rect x="7" y="0" width="1" height="1" fill="#F97316" />
      <rect x="8" y="1" width="1" height="1" fill="#F97316" />
      <rect x="3" y="4" width="6" height="6" fill="#1A1A1A" />
      <rect x="2" y="5" width="8" height="4" fill="#2A2A2A" />
      <rect x="3" y="5" width="1" height="1" fill="#555555" />
    </svg>
  )
}

// Eren pixel icon — simple sitting cat
function ErenPaw({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ears */}
      <rect x="3" y="2" width="2" height="2" fill="#2A2030" />
      <rect x="13" y="2" width="2" height="2" fill="#2A2030" />
      <rect x="3" y="4" width="2" height="1" fill="#7E7272" />
      <rect x="13" y="4" width="2" height="1" fill="#7E7272" />
      {/* head */}
      <rect x="3" y="4" width="12" height="6" fill="#F5F3EF" />
      <rect x="3" y="4" width="1" height="1" fill="#2A2030" />
      <rect x="14" y="4" width="1" height="1" fill="#2A2030" />
      <rect x="2" y="5" width="1" height="5" fill="#2A2030" />
      <rect x="15" y="5" width="1" height="5" fill="#2A2030" />
      <rect x="3" y="10" width="12" height="1" fill="#2A2030" />
      {/* eyes */}
      <rect x="5" y="6" width="2" height="2" fill="#4898D4" />
      <rect x="6" y="6" width="1" height="2" fill="#1A1A2E" />
      <rect x="11" y="6" width="2" height="2" fill="#4898D4" />
      <rect x="12" y="6" width="1" height="2" fill="#1A1A2E" />
      {/* nose + mouth */}
      <rect x="8" y="8" width="2" height="1" fill="#F28898" />
      <rect x="8" y="9" width="2" height="1" fill="#2A2030" />
      {/* body */}
      <rect x="4" y="11" width="10" height="5" fill="#F5F3EF" />
      <rect x="3" y="12" width="1" height="4" fill="#2A2030" />
      <rect x="14" y="12" width="1" height="4" fill="#2A2030" />
      <rect x="4" y="16" width="10" height="1" fill="#2A2030" />
      {/* paws */}
      <rect x="5" y="15" width="2" height="1" fill="#D0CCC4" />
      <rect x="11" y="15" width="2" height="1" fill="#D0CCC4" />
    </svg>
  )
}

export default function TreatTumbleGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const sceneRef = useRef<HTMLDivElement>(null)

  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [erenX, setErenX] = useState(50) // percent 0-100
  const [items, setItems] = useState<FallingItem[]>([])
  const [floats, setFloats] = useState<FloatText[]>([])
  const [shake, setShake] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)

  const itemId  = useRef(0)
  const floatId = useRef(0)
  const lastSpawn = useRef(0)
  const lastTick  = useRef(0)
  const rafId = useRef<number | null>(null)
  const dragging = useRef(false)
  const erenXRef = useRef(50)
  const livesRef = useRef(START_LIVES)
  const gameStartRef = useRef(0)

  // ── Start ──────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    setScore(0)
    setLives(START_LIVES)
    livesRef.current = START_LIVES
    setTimeLeft(GAME_DURATION)
    setItems([])
    setFloats([])
    setErenX(50)
    erenXRef.current = 50
    setSavedOnce(false)
    setGameState('running')
    lastSpawn.current = 0
    lastTick.current = 0
    gameStartRef.current = performance.now()
  }, [])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'running') return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          setGameState('finished')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [gameState])

  // ── End-of-game save ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'finished' || savedOnce || !user?.id) return
    setSavedOnce(true)
    ;(async () => {
      await supabase.from('game_scores').insert({
        user_id: user.id,
        game_type: 'treat_tumble',
        score: Math.max(0, score),
      })
      await applyAction(user.id, 'play')
      await addCoins(Math.min(30, Math.max(0, Math.floor(score / 6))))
      completeTask('daily_game')
      if (score >= 30) completeTask('weekly_high_score')
    })()
  }, [gameState, savedOnce, user?.id, score]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'running') return

    function loop(t: number) {
      const rect = sceneRef.current?.getBoundingClientRect()
      if (!rect) { rafId.current = requestAnimationFrame(loop); return }

      const elapsed = lastTick.current === 0 ? 16 : (t - lastTick.current)
      lastTick.current = t
      const gameElapsedSec = (t - gameStartRef.current) / 1000
      const speed = ITEM_BASE_SPEED + ITEM_SPEED_PER_SEC * gameElapsedSec
      const spawnInterval = Math.max(MIN_SPAWN_MS, START_SPAWN_MS - SPAWN_RAMP_PER_SEC * gameElapsedSec)

      // Spawn
      if (t - lastSpawn.current > spawnInterval) {
        lastSpawn.current = t
        const kind = pickKind()
        setItems(prev => [...prev, {
          id: itemId.current++,
          x: Math.random() * (rect.width - ITEM_SIZE - 24) + 12 + ITEM_SIZE / 2,
          y: -ITEM_SIZE,
          kind,
          caught: false,
          missed: false,
        }])
      }

      // Advance items
      const erenCX = (erenXRef.current / 100) * rect.width
      const catchY = rect.height - 96 // where Eren is

      setItems(prev => {
        const updated: FallingItem[] = []
        let dLives = 0
        let dScore = 0
        const newFloats: FloatText[] = []

        for (const it of prev) {
          if (it.caught || it.missed) continue
          const ny = it.y + speed * (elapsed / 1000)

          // Check catch box
          const dx = Math.abs(it.x - erenCX)
          if (ny >= catchY && ny <= catchY + ITEM_SIZE + 14 && dx <= EREN_WIDTH / 2 + ITEM_SIZE / 2 - 4) {
            const meta = ITEMS[it.kind]
            dScore += meta.points
            if (meta.life < 0) dLives += meta.life
            else if (meta.life > 0) dLives += meta.life
            newFloats.push({
              id: floatId.current++,
              x: it.x, y: catchY - 10,
              text: meta.points > 0 ? `+${meta.points}` : meta.points < 0 ? `${meta.points}` : meta.life > 0 ? '+♥' : '',
              color: meta.points > 0 ? '#FDE68A' : meta.points < 0 ? '#FCA5A5' : '#FF6B9D',
              t0: t,
            })
            continue
          }

          // Missed (past bottom)
          if (ny > rect.height + 10) {
            continue
          }

          updated.push({ ...it, y: ny })
        }

        if (dScore !== 0) setScore(s => Math.max(0, s + dScore))
        if (dLives !== 0) {
          const newLives = Math.max(0, Math.min(5, livesRef.current + dLives))
          livesRef.current = newLives
          setLives(newLives)
          if (dLives < 0) {
            setShake(true)
            setTimeout(() => setShake(false), 260)
          }
          if (newLives === 0) setGameState('finished')
        }
        if (newFloats.length > 0) {
          setFloats(prev => [...prev, ...newFloats].slice(-20))
        }
        return updated
      })

      if (gameState === 'running') {
        rafId.current = requestAnimationFrame(loop)
      }
    }

    rafId.current = requestAnimationFrame(loop)
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current) }
  }, [gameState])

  // ── Clean up old float texts ───────────────────────────────────────────────
  useEffect(() => {
    if (floats.length === 0) return
    const id = setTimeout(() => setFloats(prev => prev.filter(f => performance.now() - f.t0 < 900)), 700)
    return () => clearTimeout(id)
  }, [floats])

  // ── Drag / touch input ────────────────────────────────────────────────────
  function updatePos(clientX: number) {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100))
    erenXRef.current = pct
    setErenX(pct)
  }
  function onPointerDown(e: React.PointerEvent) {
    if (gameState !== 'running') return
    dragging.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    updatePos(e.clientX)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || gameState !== 'running') return
    updatePos(e.clientX)
  }
  function onPointerUp() {
    dragging.current = false
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none"
      style={{
        background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 40%, #FBBF24 100%)',
        touchAction: 'none',
        animation: shake ? 'sceneShake 0.26s linear' : 'none',
      }}
      ref={sceneRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}>

      {/* Drifting clouds */}
      <div className="absolute inset-0 pointer-events-none opacity-70" style={{
        backgroundImage: 'radial-gradient(ellipse 60px 18px at 20% 15%, rgba(255,255,255,0.85), transparent 65%), radial-gradient(ellipse 80px 22px at 65% 28%, rgba(255,255,255,0.7), transparent 65%), radial-gradient(ellipse 50px 14px at 85% 50%, rgba(255,255,255,0.8), transparent 65%)',
        animation: 'cloudDrift 22s linear infinite',
      }} />

      {/* Grass floor */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{
        height: 64,
        background: 'linear-gradient(180deg, #4ADE80 0%, #16A34A 60%, #166534 100%)',
        borderTop: '3px solid #14532D',
      }}>
        <div className="absolute top-0 inset-x-0" style={{
          height: 4,
          background: 'repeating-linear-gradient(90deg, transparent 0 6px, #166534 6px 8px)',
        }} />
      </div>

      {/* Header */}
      <div className="absolute top-0 inset-x-0 pt-3 px-3 z-30 flex items-center gap-2">
        <button onClick={() => router.back()}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.7)', borderRadius: 6, border: '2px solid #D97706', boxShadow: '0 2px 0 #B45309' }}>
          <ChevronLeft size={18} className="text-amber-700" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="font-pixel text-amber-900 px-3 py-1.5"
            style={{ background: 'rgba(255,255,255,0.85)', border: '2px solid #D97706', borderRadius: 4, boxShadow: '0 2px 0 #B45309', fontSize: 7, letterSpacing: 1.5 }}>
            TREAT TUMBLE
          </span>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* HUD row */}
      <div className="absolute top-14 inset-x-0 px-3 z-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 px-2 py-1"
          style={{ background: 'rgba(255,255,255,0.9)', border: '2px solid #D97706', borderRadius: 4, boxShadow: '0 2px 0 #B45309' }}>
          <IconStar size={12} />
          <span className="font-pixel text-amber-700" style={{ fontSize: 9, letterSpacing: 1 }}>{score}</span>
        </div>
        {/* Lives */}
        <div className="flex items-center gap-0.5 px-2 py-1"
          style={{ background: 'rgba(255,255,255,0.9)', border: '2px solid #DB2777', borderRadius: 4, boxShadow: '0 2px 0 #9D174D' }}>
          {Array.from({ length: START_LIVES + 1 }).map((_, i) => (
            <div key={i} style={{ opacity: i < lives ? 1 : 0.18, transition: 'opacity 0.2s', transform: i < lives ? 'scale(1)' : 'scale(0.85)' }}>
              <IconHeart size={12} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2 py-1"
          style={{ background: timeLeft <= 10 ? 'rgba(255,220,220,0.95)' : 'rgba(255,255,255,0.9)', border: timeLeft <= 10 ? '2px solid #DC2626' : '2px solid #D97706', borderRadius: 4, boxShadow: '0 2px 0 #B45309', animation: timeLeft <= 10 && gameState === 'running' ? 'timerPulse 0.6s ease-in-out infinite' : 'none' }}>
          <span className="font-pixel" style={{ fontSize: 9, color: timeLeft <= 10 ? '#991B1B' : '#92400E', letterSpacing: 1 }}>
            {String(Math.floor(timeLeft / 60))}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* ── Idle intro ──────────────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-30 px-6">
          <div className="px-6 py-6 max-w-[330px] text-center"
            style={{ background: 'rgba(255,255,255,0.95)', border: '3px solid #D97706', borderRadius: 6, boxShadow: '0 5px 0 #B45309, 0 0 20px rgba(251,191,36,0.5)' }}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <IconStar size={18} />
              <p className="font-pixel text-amber-800" style={{ fontSize: 10, letterSpacing: 2 }}>TREAT TUMBLE</p>
              <IconStar size={18} />
            </div>
            <p className="text-xs text-amber-900 leading-relaxed mb-4">
              <strong>Drag anywhere</strong> to move Eren along the grass.
              Catch the good treats, <span className="text-red-700">dodge shoes and bombs</span>,
              and grab hearts for extra lives.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-4 text-[10px]">
              <div className="flex flex-col items-center gap-1 p-2" style={{ background: 'rgba(245,200,66,0.15)', border: '1px solid #F5C842', borderRadius: 3 }}>
                <KibbleIcon size={20} />
                <span className="font-pixel text-amber-700" style={{ fontSize: 6 }}>+1</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2" style={{ background: 'rgba(107,174,214,0.15)', border: '1px solid #6BAED6', borderRadius: 3 }}>
                <IconFish size={20} />
                <span className="font-pixel text-sky-700" style={{ fontSize: 6 }}>+3</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2" style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid #A78BFA', borderRadius: 3 }}>
                <CreamIcon size={20} />
                <span className="font-pixel text-purple-700" style={{ fontSize: 6 }}>+5</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2" style={{ background: 'rgba(255,215,0,0.2)', border: '1px solid #FFD700', borderRadius: 3 }}>
                <IconStar size={20} />
                <span className="font-pixel text-amber-700" style={{ fontSize: 6 }}>+10</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="flex flex-col items-center gap-1 p-2" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid #DC2626', borderRadius: 3 }}>
                <ShoeIcon size={20} />
                <span className="font-pixel text-red-700" style={{ fontSize: 6 }}>-4 · −♥</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid #DC2626', borderRadius: 3 }}>
                <BombIcon size={20} />
                <span className="font-pixel text-red-700" style={{ fontSize: 6 }}>-6 · −♥</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2" style={{ background: 'rgba(255,107,157,0.15)', border: '1px solid #FF6B9D', borderRadius: 3 }}>
                <IconHeart size={20} />
                <span className="font-pixel text-pink-700" style={{ fontSize: 6 }}>+♥ LIFE</span>
              </div>
            </div>
          </div>
          <button onClick={start}
            className="px-8 py-3 text-white active:translate-y-[2px] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              border: '3px solid #B45309',
              borderRadius: 4,
              boxShadow: '0 5px 0 #92400E, inset 0 1px 0 rgba(255,255,255,0.35), 0 0 14px rgba(245,158,11,0.5)',
              fontFamily: '"Press Start 2P"', fontSize: 10, letterSpacing: 2,
            }}>
            ▶ START
          </button>
        </div>
      )}

      {/* ── Falling items ───────────────────────────────────────────────────── */}
      {gameState !== 'idle' && items.map(it => {
        const meta = ITEMS[it.kind]
        return (
          <div key={it.id} className="absolute pointer-events-none z-10"
            style={{
              left: it.x - ITEM_SIZE / 2,
              top: it.y - ITEM_SIZE / 2,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              animation: 'itemSpin 1.4s linear infinite',
              filter: `drop-shadow(0 3px 0 rgba(0,0,0,0.25)) drop-shadow(0 0 6px ${meta.tint}55)`,
            }}>
            <meta.Icon size={ITEM_SIZE} />
          </div>
        )
      })}

      {/* ── Eren ────────────────────────────────────────────────────────────── */}
      {gameState !== 'idle' && (
        <div className="absolute pointer-events-none z-20"
          style={{
            left: `${erenX}%`,
            bottom: 36,
            transform: 'translateX(-50%)',
            transition: dragging.current ? 'none' : 'left 0.08s ease-out',
            filter: shake ? 'drop-shadow(0 0 8px rgba(220,38,38,0.8))' : 'drop-shadow(0 4px 0 rgba(0,0,0,0.2))',
            animation: 'erenBob 0.7s ease-in-out infinite',
          }}>
          <ErenPaw size={EREN_WIDTH} />
        </div>
      )}

      {/* ── Float texts ─────────────────────────────────────────────────────── */}
      {floats.map(f => (
        <div key={f.id} className="absolute z-30 pointer-events-none font-pixel" style={{
          left: f.x, top: f.y, transform: 'translateX(-50%)',
          color: f.color, fontSize: 12, letterSpacing: 1,
          textShadow: '2px 2px 0 rgba(0,0,0,0.5)',
          animation: 'floatUp 0.85s ease-out forwards',
        }}>
          {f.text}
        </div>
      ))}

      {/* ── Finish overlay ─────────────────────────────────────────────────── */}
      {gameState === 'finished' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6"
          style={{ background: 'rgba(60,25,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="px-6 py-6 max-w-[340px] w-full text-center relative"
            style={{ background: 'linear-gradient(180deg, #FFF8E0 0%, #FFF0C0 100%)', border: '3px solid #D97706', borderRadius: 6, boxShadow: '0 5px 0 #B45309, 0 0 24px rgba(251,191,36,0.6)' }}>
            <div className="flex justify-center mb-3">
              <IconCrown size={28} />
            </div>
            <p className="font-pixel text-amber-800 mb-1" style={{ fontSize: 9, letterSpacing: 2 }}>
              {lives > 0 ? 'TIME UP' : 'GAME OVER'}
            </p>
            <p className="font-pixel text-amber-900 mb-4" style={{ fontSize: 28, textShadow: '2px 2px 0 rgba(180,83,9,0.35)' }}>
              {Math.max(0, score)}
            </p>
            <div className="flex items-center justify-center gap-1 mb-4" style={{ color: '#A16207' }}>
              <IconCoin size={14} />
              <span className="font-pixel" style={{ fontSize: 8 }}>+{Math.min(30, Math.max(0, Math.floor(score / 6)))} coins</span>
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={start}
                className="flex items-center gap-1.5 px-4 py-2 text-white active:translate-y-[2px] transition-transform"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '2px solid #B45309', borderRadius: 3, boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                <RefreshCw size={12} />
                AGAIN
              </button>
              <button onClick={() => router.push('/games')}
                className="px-4 py-2 text-amber-900 active:translate-y-[2px] transition-transform"
                style={{ background: 'rgba(255,255,255,0.9)', border: '2px solid #D97706', borderRadius: 3, boxShadow: '0 3px 0 #B45309', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                BACK
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes cloudDrift {
          from { transform: translateX(-25px); }
          to   { transform: translateX(25px); }
        }
        @keyframes itemSpin {
          from { transform: rotate(-8deg); }
          50%  { transform: rotate(8deg); }
          to   { transform: rotate(-8deg); }
        }
        @keyframes erenBob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-4px); }
        }
        @keyframes floatUp {
          0%   { transform: translateX(-50%) translateY(0); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-40px); opacity: 0; }
        }
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }
        @keyframes sceneShake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-5px); }
          50%      { transform: translateX(5px); }
          75%      { transform: translateX(-3px); }
        }
      `}</style>
    </div>
  )
}
