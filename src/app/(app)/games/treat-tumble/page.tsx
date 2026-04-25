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
  IconMeat, IconFish, IconHeart, IconStar, IconCrown, IconCoin, IconBook,
} from '@/components/PixelIcons'

// ── Config ───────────────────────────────────────────────────────────────────
const GAME_DURATION = 45
const START_LIVES   = 3
const MAX_LIVES     = 5
const START_SPAWN_MS = 760
const MIN_SPAWN_MS   = 170
const SPAWN_RAMP_PER_SEC = 24          // was 18 — even steeper
const ITEM_BASE_SPEED = 175             // was 160
const ITEM_SPEED_PER_SEC = 12           // was 8 — climbs faster
const EREN_WIDTH  = 72
const ITEM_SIZE   = 34

type ItemKind = 'kibble' | 'fish' | 'cream' | 'golden' | 'heart'
  | 'shoe' | 'bomb' | 'spider' | 'hairball' | 'thunder'

interface ItemMeta {
  label: string
  points: number
  life: number
  rarity: number   // weight
  Icon: React.FC<{ size?: number }>
  tint: string
  danger: boolean
}

const ITEMS: Record<ItemKind, ItemMeta> = {
  // Good items
  kibble:   { label: 'Kibble',   points: 1,  life: 0,  rarity: 38, Icon: KibbleIcon,   tint: '#F5C842', danger: false },
  fish:     { label: 'Fish',     points: 3,  life: 0,  rarity: 22, Icon: IconFish,     tint: '#6BAED6', danger: false },
  cream:    { label: 'Cream',    points: 5,  life: 0,  rarity: 10, Icon: CreamIcon,    tint: '#E9D5FF', danger: false },
  golden:   { label: 'Golden',   points: 10, life: 0,  rarity: 4,  Icon: IconStar,     tint: '#FFD700', danger: false },
  heart:    { label: 'Heart',    points: 0,  life: 1,  rarity: 3,  Icon: IconHeart,    tint: '#FF6B9D', danger: false },
  // Dangers — weighted so roughly 25% of spawns are bad
  shoe:     { label: 'Shoe',     points: -4, life: -1, rarity: 7,  Icon: ShoeIcon,     tint: '#8B5A2B', danger: true },
  bomb:     { label: 'Bomb',     points: -6, life: -1, rarity: 4,  Icon: BombIcon,     tint: '#DC2626', danger: true },
  spider:   { label: 'Spider',   points: -5, life: -1, rarity: 5,  Icon: SpiderIcon,   tint: '#4B0082', danger: true },
  hairball: { label: 'Hairball', points: -3, life: 0,  rarity: 5,  Icon: HairballIcon, tint: '#6B4423', danger: true },
  thunder:  { label: 'Thunder',  points: -8, life: -1, rarity: 2,  Icon: ThunderIcon,  tint: '#FBBF24', danger: true },
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
  x: number
  y: number
  kind: ItemKind
  caught: boolean
  missed: boolean
  wobble: number // starting rotation phase
}

interface FloatText { id: number; x: number; y: number; text: string; color: string; t0: number }

// ── Pixel-art icons specific to this game ────────────────────────────────────
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
function SpiderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* legs */}
      <rect x="0" y="4" width="1" height="1" fill="#1A1A1A" />
      <rect x="1" y="5" width="1" height="1" fill="#1A1A1A" />
      <rect x="2" y="6" width="1" height="1" fill="#1A1A1A" />
      <rect x="0" y="8" width="1" height="1" fill="#1A1A1A" />
      <rect x="1" y="7" width="1" height="1" fill="#1A1A1A" />
      <rect x="11" y="4" width="1" height="1" fill="#1A1A1A" />
      <rect x="10" y="5" width="1" height="1" fill="#1A1A1A" />
      <rect x="9" y="6" width="1" height="1" fill="#1A1A1A" />
      <rect x="11" y="8" width="1" height="1" fill="#1A1A1A" />
      <rect x="10" y="7" width="1" height="1" fill="#1A1A1A" />
      {/* body */}
      <rect x="3" y="4" width="6" height="5" fill="#1A1A1A" />
      <rect x="4" y="3" width="4" height="1" fill="#1A1A1A" />
      {/* eyes */}
      <rect x="4" y="5" width="1" height="1" fill="#DC2626" />
      <rect x="7" y="5" width="1" height="1" fill="#DC2626" />
    </svg>
  )
}
function HairballIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="2" width="6" height="2" fill="#6B4423" />
      <rect x="2" y="3" width="8" height="6" fill="#6B4423" />
      <rect x="3" y="9" width="6" height="1" fill="#6B4423" />
      {/* hair strands */}
      <rect x="1" y="4" width="1" height="1" fill="#4A2810" />
      <rect x="10" y="5" width="1" height="1" fill="#4A2810" />
      <rect x="4" y="1" width="1" height="1" fill="#4A2810" />
      <rect x="8" y="1" width="1" height="1" fill="#4A2810" />
      <rect x="5" y="10" width="1" height="1" fill="#4A2810" />
      {/* highlight */}
      <rect x="4" y="4" width="1" height="1" fill="#9B6B3B" />
    </svg>
  )
}
function ThunderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* cloud */}
      <rect x="2" y="2" width="7" height="3" fill="#6B7280" />
      <rect x="1" y="3" width="9" height="2" fill="#6B7280" />
      <rect x="1" y="3" width="9" height="1" fill="#9CA3AF" />
      {/* bolt */}
      <rect x="6" y="5" width="2" height="2" fill="#FBBF24" />
      <rect x="5" y="6" width="2" height="2" fill="#FBBF24" />
      <rect x="6" y="8" width="1" height="2" fill="#FBBF24" />
      <rect x="4" y="8" width="2" height="1" fill="#FBBF24" />
      <rect x="5" y="9" width="1" height="1" fill="#F59E0B" />
    </svg>
  )
}

// ── Eren sprite — Ragdoll, smiling, rosy cheeks, happy eyes ───────────────────
function ErenSprite({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ears */}
      <rect x="3" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="3" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="4" y="4" width="1" height="1" fill="#F4B0B8" />
      <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
      {/* head — ragdoll cream */}
      <rect x="5" y="3" width="12" height="1" fill="#4A2E1A" />
      <rect x="4" y="4" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="5" width="16" height="1" fill="#4A2E1A" />
      <rect x="4" y="5" width="14" height="1" fill="#F9EDD5" />
      <rect x="3" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="18" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="4" y="6" width="14" height="6" fill="#F9EDD5" />
      {/* brown mask (Ragdoll points) around eyes */}
      <rect x="5" y="6" width="3" height="2" fill="#D4B896" />
      <rect x="14" y="6" width="3" height="2" fill="#D4B896" />
      {/* eyes — bigger highlights to read as cheerful */}
      <rect x="6" y="7" width="2" height="2" fill="#6BAED6" />
      <rect x="6" y="7" width="1" height="1" fill="#FFFFFF" />
      <rect x="7" y="8" width="1" height="1" fill="#1A1A2E" />
      <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
      <rect x="14" y="7" width="1" height="1" fill="#FFFFFF" />
      <rect x="15" y="8" width="1" height="1" fill="#1A1A2E" />
      {/* rosy cheeks */}
      <rect x="5" y="9" width="2" height="1" fill="#F4B0B8" />
      <rect x="15" y="9" width="2" height="1" fill="#F4B0B8" />
      {/* nose */}
      <rect x="10" y="9" width="2" height="1" fill="#F48B9B" />
      <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
      {/* mouth — upturned smile :3 */}
      <rect x="9" y="11" width="1" height="1" fill="#4A2E1A" />
      <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
      <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />
      {/* muzzle around the smile */}
      <rect x="10" y="11" width="2" height="1" fill="#F9EDD5" />
      {/* chin fluff */}
      <rect x="4" y="12" width="14" height="1" fill="#4A2E1A" />
      <rect x="5" y="12" width="5" height="1" fill="#F9EDD5" />
      <rect x="12" y="12" width="5" height="1" fill="#F9EDD5" />
      {/* body */}
      <rect x="4" y="13" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="18" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="4" y="14" width="14" height="5" fill="#F9EDD5" />
      {/* body shading */}
      <rect x="5" y="14" width="2" height="1" fill="#E5D9BE" />
      <rect x="15" y="14" width="2" height="1" fill="#E5D9BE" />
      <rect x="4" y="19" width="14" height="1" fill="#4A2E1A" />
      {/* paws */}
      <rect x="5" y="19" width="2" height="1" fill="#D4B896" />
      <rect x="15" y="19" width="2" height="1" fill="#D4B896" />
      <rect x="5" y="20" width="3" height="1" fill="#4A2E1A" />
      <rect x="14" y="20" width="3" height="1" fill="#4A2E1A" />
      {/* whiskers — tilted up to support smile */}
      <rect x="1" y="9" width="3" height="1" fill="rgba(255,255,255,0.65)" />
      <rect x="18" y="9" width="3" height="1" fill="rgba(255,255,255,0.65)" />
      <rect x="2" y="11" width="2" height="1" fill="rgba(255,255,255,0.55)" />
      <rect x="18" y="11" width="2" height="1" fill="rgba(255,255,255,0.55)" />
    </svg>
  )
}

// ── Component ────────────────────────────────────────────────────────────────
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
  const [erenX, setErenX] = useState(50)
  const [items, setItems] = useState<FallingItem[]>([])
  const [floats, setFloats] = useState<FloatText[]>([])
  const [shake, setShake] = useState(false)
  const [hurtFlash, setHurtFlash] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)
  const [scoreBump, setScoreBump] = useState(0) // for scale pop on score change

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
      await addCoins(Math.min(40, Math.max(0, Math.floor(score / 5))))
      completeTask('daily_game')
      if (score >= 30) completeTask('weekly_high_score')
    })()
  }, [gameState, savedOnce, user?.id, score]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Score bump animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (scoreBump === 0) return
    const id = setTimeout(() => setScoreBump(0), 260)
    return () => clearTimeout(id)
  }, [scoreBump])

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
          wobble: Math.random() * Math.PI * 2,
        }])
      }

      // Advance items
      const erenCX = (erenXRef.current / 100) * rect.width
      const catchY = rect.height - 110

      setItems(prev => {
        const updated: FallingItem[] = []
        let dLives = 0
        let dScore = 0
        let hurt = false
        const newFloats: FloatText[] = []

        for (const it of prev) {
          if (it.caught || it.missed) continue
          const ny = it.y + speed * (elapsed / 1000)

          const dx = Math.abs(it.x - erenCX)
          if (ny >= catchY && ny <= catchY + ITEM_SIZE + 18 && dx <= EREN_WIDTH / 2 + ITEM_SIZE / 2 - 4) {
            const meta = ITEMS[it.kind]
            dScore += meta.points
            if (meta.life < 0) { dLives += meta.life; hurt = true }
            else if (meta.life > 0) dLives += meta.life
            newFloats.push({
              id: floatId.current++,
              x: it.x, y: catchY - 10,
              text: meta.points > 0
                ? `+${meta.points}`
                : meta.points < 0 ? `${meta.points}` : meta.life > 0 ? '+♥' : '',
              color: meta.points > 0 ? '#FDE68A' : meta.points < 0 ? '#FCA5A5' : '#FF6B9D',
              t0: t,
            })
            continue
          }

          if (ny > rect.height + 10) continue
          updated.push({ ...it, y: ny })
        }

        if (dScore !== 0) {
          setScore(s => {
            const next = Math.max(0, s + dScore)
            if (dScore > 0) setScoreBump(1)
            return next
          })
        }
        if (dLives !== 0) {
          const newLives = Math.max(0, Math.min(MAX_LIVES, livesRef.current + dLives))
          livesRef.current = newLives
          setLives(newLives)
          if (dLives < 0) {
            setShake(true)
            setHurtFlash(true)
            setTimeout(() => setShake(false), 280)
            setTimeout(() => setHurtFlash(false), 220)
          }
          if (newLives === 0) setGameState('finished')
        }
        if (newFloats.length > 0) {
          setFloats(prev => [...prev, ...newFloats].slice(-22))
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
  const timeWarning = timeLeft <= 10
  const lowLives = lives <= 1
  const timePct = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none"
      style={{
        background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 40%, #FBBF24 100%)',
        touchAction: 'none',
        animation: shake ? 'sceneShake 0.28s linear' : 'none',
      }}
      ref={sceneRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}>

      {/* Red hurt flash */}
      {hurtFlash && (
        <div className="absolute inset-0 pointer-events-none z-40" style={{
          background: 'radial-gradient(circle at center, rgba(220,38,38,0.35) 0%, rgba(220,38,38,0.08) 55%, transparent 80%)',
          animation: 'hurtFade 0.22s ease-out forwards',
        }} />
      )}

      {/* Drifting clouds */}
      <div className="absolute inset-0 pointer-events-none opacity-70" style={{
        backgroundImage: 'radial-gradient(ellipse 60px 18px at 20% 15%, rgba(255,255,255,0.85), transparent 65%), radial-gradient(ellipse 80px 22px at 65% 28%, rgba(255,255,255,0.7), transparent 65%), radial-gradient(ellipse 50px 14px at 85% 50%, rgba(255,255,255,0.8), transparent 65%)',
        animation: 'cloudDrift 22s linear infinite',
      }} />

      {/* Grass floor */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{
        height: 72,
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
          style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.9)', borderRadius: 6, border: '2px solid #D97706', boxShadow: '0 2px 0 #B45309' }}>
          <ChevronLeft size={18} className="text-amber-700" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="font-pixel text-amber-900 px-3 py-1.5 inline-flex items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.92)', border: '2px solid #D97706', borderRadius: 4, boxShadow: '0 2px 0 #B45309', fontSize: 7, letterSpacing: 1.5 }}>
            <IconMeat size={12} />
            TREAT TUMBLE
          </span>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* ══ PREMIUM HUD ═════════════════════════════════════════════════════ */}
      {gameState !== 'idle' && (
        <div className="absolute top-14 inset-x-0 px-3 z-20">
          {/* Big score banner */}
          <div className="mb-2 relative overflow-hidden py-2.5 px-3"
            style={{
              background: 'linear-gradient(180deg, rgba(120,53,15,0.92) 0%, rgba(69,26,3,0.95) 100%)',
              border: '3px solid #F59E0B',
              borderRadius: 5,
              boxShadow: '0 4px 0 #92400E, inset 0 1px 0 rgba(255,255,255,0.25), 0 0 14px rgba(245,158,11,0.4)',
            }}>
            {/* Corner rivets */}
            <div style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
            <div style={{ position: 'absolute', top: 3, right: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
            <div style={{ position: 'absolute', bottom: 3, left: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
            <div style={{ position: 'absolute', bottom: 3, right: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />

            <div className="flex items-center justify-between gap-3">
              {/* Score */}
              <div className="flex items-center gap-1.5">
                <IconStar size={14} />
                <span className="font-pixel" style={{ fontSize: 6, color: '#FCD34D', letterSpacing: 2 }}>SCORE</span>
                <span className="font-pixel" style={{
                  fontSize: 16,
                  color: '#FFFFFF',
                  textShadow: '2px 2px 0 #92400E, 0 0 6px rgba(251,191,36,0.7)',
                  letterSpacing: 1,
                  transform: scoreBump ? 'scale(1.22)' : 'scale(1)',
                  transition: 'transform 0.16s cubic-bezier(0.34,1.56,0.64,1)',
                  display: 'inline-block',
                }}>{Math.max(0, score)}</span>
              </div>

              {/* Lives — large, labelled */}
              <div className="flex items-center gap-1.5 px-2 py-1"
                style={{
                  background: lowLives ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.45)',
                  border: lowLives ? '2px solid #FCA5A5' : '2px solid rgba(245,158,11,0.5)',
                  borderRadius: 4,
                  boxShadow: lowLives ? '0 2px 0 rgba(0,0,0,0.4), 0 0 8px rgba(248,113,113,0.55)' : '0 2px 0 rgba(0,0,0,0.4)',
                  transition: 'all 0.25s',
                }}>
                <span className="font-pixel" style={{
                  fontSize: 6, letterSpacing: 2,
                  color: lowLives ? '#FFE4E4' : '#FCD34D',
                  textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
                }}>HP</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: MAX_LIVES }).map((_, i) => (
                    <div key={i} style={{
                      opacity: i < lives ? 1 : 0.18,
                      transform: i < lives ? 'scale(1)' : 'scale(0.75)',
                      transition: 'opacity 0.25s, transform 0.25s',
                      filter: i < lives && lowLives && gameState === 'running' ? 'drop-shadow(0 0 5px rgba(255,107,157,1))' : 'none',
                      animation: i < lives && lowLives && gameState === 'running' ? 'heartBeat 0.55s ease-in-out infinite' : 'none',
                    }}>
                      <IconHeart size={18} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Time progress bar */}
            <div className="mt-2 relative overflow-hidden" style={{
              height: 6,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 2,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                height: '100%',
                width: `${timePct}%`,
                background: timeWarning
                  ? 'linear-gradient(180deg, #FCA5A5 0%, #DC2626 100%)'
                  : 'linear-gradient(180deg, #FDE68A 0%, #F59E0B 100%)',
                transition: 'width 0.9s linear, background 0.3s',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
              }} />
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,0.35) calc(10% - 1px) 10%)',
              }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 2, color: '#FCD34D' }}>TIME</span>
              <span className="font-pixel" style={{
                fontSize: 7,
                color: timeWarning ? '#FCA5A5' : '#FDE68A',
                animation: timeWarning && gameState === 'running' ? 'timerPulse 0.6s ease-in-out infinite' : 'none',
              }}>{String(Math.floor(timeLeft / 60))}:{String(timeLeft % 60).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Idle intro ──────────────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-30 px-6 pt-10 overflow-y-auto">
          <div className="px-5 py-5 max-w-[330px] text-center"
            style={{ background: 'rgba(255,255,255,0.95)', border: '3px solid #D97706', borderRadius: 6, boxShadow: '0 5px 0 #B45309, 0 0 20px rgba(251,191,36,0.5)' }}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <IconStar size={18} />
              <p className="font-pixel text-amber-800" style={{ fontSize: 10, letterSpacing: 2 }}>TREAT TUMBLE</p>
              <IconStar size={18} />
            </div>
            <p className="text-xs text-amber-900 leading-relaxed mb-3">
              <strong>Drag</strong> to move Eren. Catch treats,
              <span className="text-red-700"> dodge dangers</span>, grab hearts for lives.
              <span className="font-pixel text-amber-700" style={{ fontSize: 6 }}> It gets FASTER.</span>
            </p>
            <p className="font-pixel text-amber-700 mb-2" style={{ fontSize: 6, letterSpacing: 1 }}>✦ GOODS ✦</p>
            <div className="grid grid-cols-5 gap-1.5 mb-3 text-[10px]">
              <LegendTile Icon={KibbleIcon} tint="#F5C842" pts="+1" />
              <LegendTile Icon={IconFish}   tint="#6BAED6" pts="+3" />
              <LegendTile Icon={CreamIcon}  tint="#A78BFA" pts="+5" />
              <LegendTile Icon={IconStar}   tint="#FFD700" pts="+10" />
              <LegendTile Icon={IconHeart}  tint="#FF6B9D" pts="+♥" />
            </div>
            <p className="font-pixel text-red-700 mb-2" style={{ fontSize: 6, letterSpacing: 1 }}>⚠ DANGERS ⚠</p>
            <div className="grid grid-cols-5 gap-1.5 text-[10px]">
              <LegendTile Icon={HairballIcon} tint="#6B4423" pts="-3" danger />
              <LegendTile Icon={ShoeIcon}     tint="#8B5A2B" pts="-4" danger />
              <LegendTile Icon={SpiderIcon}   tint="#4B0082" pts="-5" danger />
              <LegendTile Icon={BombIcon}     tint="#DC2626" pts="-6" danger />
              <LegendTile Icon={ThunderIcon}  tint="#FBBF24" pts="-8" danger />
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

      {/* ── Falling items — dangers blend in, only a faint glow gives them away */}
      {gameState !== 'idle' && items.map(it => {
        const meta = ITEMS[it.kind]
        const danger = meta.danger
        return (
          <div key={it.id} className="absolute pointer-events-none z-10"
            style={{
              left: it.x - ITEM_SIZE / 2,
              top: it.y - ITEM_SIZE / 2,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              animation: 'itemSpin 1.4s linear infinite',
              filter: danger
                ? `drop-shadow(0 3px 0 rgba(0,0,0,0.3)) drop-shadow(0 0 4px rgba(180,30,30,0.35))`
                : `drop-shadow(0 3px 0 rgba(0,0,0,0.25)) drop-shadow(0 0 6px ${meta.tint}55)`,
            }}>
            <meta.Icon size={ITEM_SIZE} />
          </div>
        )
      })}

      {/* ── Eren (new sprite) + floating HP bar ─────────────────────────────── */}
      {gameState !== 'idle' && (
        <div className="absolute pointer-events-none z-20"
          style={{
            left: `${erenX}%`,
            bottom: 48,
            transform: 'translateX(-50%)',
            transition: dragging.current ? 'none' : 'left 0.08s ease-out',
            filter: hurtFlash
              ? 'drop-shadow(0 0 10px rgba(220,38,38,1)) drop-shadow(0 0 16px rgba(220,38,38,0.6))'
              : 'drop-shadow(0 5px 0 rgba(0,0,0,0.25)) drop-shadow(0 0 8px rgba(255,255,255,0.25))',
            animation: 'erenBob 0.7s ease-in-out infinite',
          }}>
          {/* Floating HP indicator above head */}
          <div className="flex items-center justify-center gap-0.5 mb-1"
            style={{
              padding: '2px 5px',
              background: 'rgba(0,0,0,0.55)',
              border: lowLives ? '2px solid #FCA5A5' : '2px solid rgba(255,255,255,0.45)',
              borderRadius: 3,
              boxShadow: lowLives ? '0 1px 0 rgba(0,0,0,0.45), 0 0 6px rgba(248,113,113,0.7)' : '0 1px 0 rgba(0,0,0,0.45)',
              animation: lowLives ? 'heartBeat 0.5s ease-in-out infinite' : 'none',
            }}>
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <div key={i} style={{
                opacity: i < lives ? 1 : 0.15,
                transform: i < lives ? 'scale(1)' : 'scale(0.7)',
                transition: 'opacity 0.25s, transform 0.25s',
              }}>
                <IconHeart size={10} />
              </div>
            ))}
          </div>

          <ErenSprite size={EREN_WIDTH} />
        </div>
      )}

      {/* ── Float texts ─────────────────────────────────────────────────────── */}
      {floats.map(f => (
        <div key={f.id} className="absolute z-30 pointer-events-none font-pixel" style={{
          left: f.x, top: f.y, transform: 'translateX(-50%)',
          color: f.color, fontSize: 13, letterSpacing: 1,
          textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
          animation: 'floatUp 0.95s ease-out forwards',
        }}>
          {f.text}
        </div>
      ))}

      {/* ── Finish overlay ─────────────────────────────────────────────────── */}
      {gameState === 'finished' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6"
          style={{ background: 'rgba(60,25,0,0.65)', backdropFilter: 'blur(4px)' }}>
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
              <span className="font-pixel" style={{ fontSize: 8 }}>+{Math.min(40, Math.max(0, Math.floor(score / 5)))} coins</span>
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
          50%      { transform: translateX(-50%) translateY(-5px); }
        }
        @keyframes floatUp {
          0%   { transform: translateX(-50%) translateY(0); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-46px); opacity: 0; }
        }
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes sceneShake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          45%      { transform: translateX(6px); }
          70%      { transform: translateX(-4px); }
        }
        @keyframes hurtFade {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.18); }
        }
      `}</style>
    </div>
  )
}

// ── Small legend tile used in intro ─────────────────────────────────────────
function LegendTile({ Icon, tint, pts, danger }: { Icon: React.FC<{ size?: number }>, tint: string, pts: string, danger?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 p-1.5"
      style={{
        background: danger ? 'rgba(220,38,38,0.1)' : `${tint}22`,
        border: `1px solid ${danger ? '#DC2626' : tint}`,
        borderRadius: 3,
      }}>
      <Icon size={22} />
      <span className="font-pixel" style={{ fontSize: 6, color: danger ? '#991B1B' : '#92400E' }}>{pts}</span>
    </div>
  )
}
