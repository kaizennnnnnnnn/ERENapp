'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DEFEND THE BOWL — a compact tower-defense, themed for the Eren app.
// ────────────────────────────────────────────────────────────────────────
// Mice, rats and raccoons march along a fixed serpentine path toward Eren's
// food bowl. Spend KIBBLE (earned from kills + clearing waves) to place and
// upgrade defenders on the free tiles between the path runs:
//   • CLAW   — single-target damage.
//   • SQUIRT — slows + small splash (a squirt bottle; cats hate water).
// Each enemy that reaches the bowl costs lives. Endless escalating waves; the
// run ends when the bowl's lives hit 0. Score = waves cleared ×100 + kills ×3.
//
// The play loop runs on rAF only during a wave (dt-clamped, pause-safe via an
// accumulated game clock). You can build between waves (player-paced START) or
// mid-wave.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import GameCoinReward from '@/components/games/GameCoinReward'
import { playSound } from '@/lib/sounds'
import { IconHeart, IconCoin, IconStar } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'

// ─── Tunables ───────────────────────────────────────────────────────────────
const COLS = 6
const ROWS = 9
const CELL = 42
const START_LIVES  = 12
const START_KIBBLE = 120
const MAX_LEVEL    = 3
const RECOIL_DUR   = 0.14  // seconds a fired tower spends lunging/recoiling
const WEEKLY_HS    = 600   // score that completes the weekly high-score task

type TowerType = 'claw' | 'squirt'
interface TowerStats { range: number; dmg: number; rate: number; slow?: number; slowDur?: number; splash?: number }
interface TowerDef { name: string; cost: number; color: string; dark: string; light: string; levels: TowerStats[]; upgradeCost: number[] }

const TOWER: Record<TowerType, TowerDef> = {
  claw: {
    name: 'CLAW', cost: 45, color: '#F59E0B', dark: '#9A3412', light: '#FDE68A',
    // The single-target specialist: best raw DPS-per-kibble, the answer to a
    // tanky raccoon. Cheap to open with so wave 1 is never a death trap.
    levels: [
      { range: 1.8, dmg: 12, rate: 1.4 },
      { range: 2.0, dmg: 21, rate: 1.7 },
      { range: 2.3, dmg: 34, rate: 2.1 },
    ],
    upgradeCost: [0, 50, 90],
  },
  squirt: {
    name: 'SQUIRT', cost: 45, color: '#38BDF8', dark: '#075985', light: '#BAE6FD',
    // The crowd-control specialist: ~half claw's single-target DPS, but its
    // splash hits every enemy in radius and its slow buys claws extra shots —
    // genuinely co-viable now that 70%+ of every wave is a clustered swarm,
    // and priced the same as claw so it's a real choice, not a tax.
    // slowDur is kept strictly BELOW the fire interval (1/rate) at every level
    // (0.85<0.91, 0.72<0.77, 0.60<0.63), so a continuously-targeted enemy always
    // snaps back to full speed between shots — squirt harasses + groups, it can
    // never permanently freeze.
    levels: [
      { range: 1.5, dmg: 8,  rate: 1.1, slow: 0.40, slowDur: 0.85, splash: 0.85 },
      { range: 1.6, dmg: 14, rate: 1.3, slow: 0.48, slowDur: 0.72, splash: 0.95 },
      { range: 1.8, dmg: 22, rate: 1.6, slow: 0.55, slowDur: 0.60, splash: 1.00 },
    ],
    upgradeCost: [0, 50, 90],
  },
}

type EnemyKind = 'mouse' | 'rat' | 'raccoon' | 'kitten'
interface EnemyDef { name: string; hp: number; speed: number; bounty: number; leak: number; color: string; dark: string; size: number; slowResist?: number }
const ENEMY: Record<EnemyKind, EnemyDef> = {
  mouse:   { name: 'MOUSE',   hp: 20,  speed: 1.6,  bounty: 4,  leak: 1, color: '#9CA3AF', dark: '#4B5563', size: 22 },
  rat:     { name: 'RAT',     hp: 44,  speed: 1.2,  bounty: 7,  leak: 1, color: '#92704E', dark: '#5B4327', size: 26 },
  raccoon: { name: 'RACCOON', hp: 115, speed: 0.85, bounty: 16, leak: 2, color: '#475569', dark: '#1E293B', size: 30 },
  // Fast, slow-RESISTANT rusher (introduced wave 8, two waves after raccoons so
  // each new threat is learned on its own). Slips past slow-walls, forcing the
  // player to back squirt with real claw damage. slowResist cuts 50% of any
  // slow applied to it — squirt dents it now, but claw still finishes it.
  kitten:  { name: 'KITTEN',  hp: 30,  speed: 2.2,  bounty: 6,  leak: 1, color: '#FDE68A', dark: '#B45309', size: 20, slowResist: 0.5 },
}

// ─── Path (serpentine, generated + continuous) ──────────────────────────────
interface Cell { c: number; r: number }
function buildPath(): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r < ROWS; r++) {
    if (r % 2 === 0) {
      const leftToRight = (r / 2) % 2 === 0
      if (leftToRight) for (let c = 0; c < COLS; c++) cells.push({ c, r })
      else for (let c = COLS - 1; c >= 0; c--) cells.push({ c, r })
    } else {
      const prevEndedRight = ((r - 1) / 2) % 2 === 0
      cells.push({ c: prevEndedRight ? COLS - 1 : 0, r })
    }
  }
  return cells
}
const PATH = buildPath()
const PATH_SET = new Set(PATH.map(p => `${p.c},${p.r}`))
const BOWL = PATH[PATH.length - 1]
const SPAWN = PATH[0]

function pathPoint(t: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(PATH.length - 1, t))
  const i = Math.floor(clamped)
  const f = clamped - i
  const a = PATH[i]
  const b = PATH[Math.min(PATH.length - 1, i + 1)]
  return {
    x: (a.c + (b.c - a.c) * f + 0.5) * CELL,
    y: (a.r + (b.r - a.r) * f + 0.5) * CELL,
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

function genWave(w: number): EnemyKind[] {
  const out: EnemyKind[] = []
  // Threats are introduced one at a time so no single wave doubles in difficulty:
  // rats from w3, raccoons from w6, kittens from w8 — each spaced so the player
  // learns the counter before the next type lands.
  const mice = 3 + w * 2
  const rats = Math.max(0, w - 2)
  const raccoons = Math.max(0, Math.floor((w - 4) / 2))  // tanky, from wave 6
  const kittens = Math.max(0, w - 7)                     // fast rushers, from wave 8
  for (let i = 0; i < mice; i++) out.push('mouse')
  for (let i = 0; i < rats; i++) out.push('rat')
  for (let i = 0; i < raccoons; i++) out.push('raccoon')
  for (let i = 0; i < kittens; i++) out.push('kitten')
  return shuffle(out)
}
function spawnInterval(w: number): number { return Math.max(0.45, 0.82 - w * 0.02) }

interface Enemy { id: number; kind: EnemyKind; t: number; hp: number; maxHp: number; speed: number; slowUntil: number; slowFactor: number }
// aimX/aimY = unit vector toward the last target (drives the fire-lunge
// direction); firedAt = game-clock time of the last shot (drives recoil decay).
interface Tower { id: number; type: TowerType; c: number; r: number; level: number; cd: number; aimX: number; aimY: number; firedAt: number }
interface Zap { id: number; x1: number; y1: number; x2: number; y2: number; type: TowerType; until: number }

// ─── Sprites ────────────────────────────────────────────────────────────────
function EnemySprite({ kind, size }: { kind: EnemyKind; size: number }) {
  const d = ENEMY[kind]
  const p = { width: size, height: size, viewBox: '0 0 24 24', shapeRendering: 'crispEdges' as const, style: { imageRendering: 'pixelated' as const } }
  return (
    <svg {...p}>
      {/* ears */}
      <rect x="5"  y="6" width="4" height="4" fill={d.color} />
      <rect x="15" y="6" width="4" height="4" fill={d.color} />
      {kind === 'raccoon' && <><rect x="5" y="7" width="4" height="2" fill={d.dark} /><rect x="15" y="7" width="4" height="2" fill={d.dark} /></>}
      {/* head/body */}
      <rect x="5"  y="9"  width="14" height="10" fill={d.color} />
      <rect x="5"  y="9"  width="14" height="2"  fill="#FFFFFF" opacity="0.18" />
      <rect x="5"  y="17" width="14" height="2"  fill={d.dark} />
      {/* mask for raccoon */}
      {kind === 'raccoon' && <rect x="7" y="11" width="10" height="3" fill={d.dark} />}
      {/* eyes */}
      <rect x="8"  y="12" width="2" height="2" fill="#0F172A" />
      <rect x="14" y="12" width="2" height="2" fill="#0F172A" />
      {/* nose */}
      <rect x="11" y="15" width="2" height="2" fill="#F472B6" />
      {/* tail */}
      <rect x="19" y="13" width="3" height="2" fill={d.dark} />
      {/* kitten = speed streaks so it reads "fast" at a glance */}
      {kind === 'kitten' && <><rect x="2" y="11" width="3" height="1" fill="#FFFFFF" opacity="0.55" /><rect x="0" y="14" width="4" height="1" fill="#FFFFFF" opacity="0.4" /><rect x="2" y="17" width="3" height="1" fill="#FFFFFF" opacity="0.5" /></>}
    </svg>
  )
}

// ─── Tower art — "Gilded Garrison": a weapon head on a shared dark socket ─────
// Level is encoded in the silhouette + accumulating gold (the app's premium-card
// language), not in tiny dots. L1 plain → L2 gains gold rivets + a brighter head
// → L3 grows (4th claw / twin-tank + cannon) and earns a gold mount lip.
type SpriteRect = readonly [number, number, number, number, string]

// CLAW — amber claws + pink toe-bean pad on a dark socket. (level is 0-indexed)
function clawRects(level: number): SpriteRect[] {
  const r: SpriteRect[] = [
    [6, 15, 12, 6, '#9A3412'],   // socket
    [6, 20, 12, 1, '#7C2D12'],   // bottom hard shadow (no blur)
    [7, 15, 10, 2, '#B45309'],   // pressed-metal lip
    [8, 13, 8, 4, '#F472B6'],    // pink toe-bean pad = instant "CLAW"
  ]
  const tip = level >= 1 ? 3 : 2 // claws catch more light once upgraded
  r.push([7, 8, 2, 6, '#F59E0B'], [7, 8, 1, tip, '#FDE68A'])     // left claw
  r.push([11, 6, 2, 8, '#F59E0B'], [11, 6, 1, tip, '#FDE68A'])   // center claw (tallest)
  r.push([15, 8, 2, 6, '#F59E0B'], [15, 8, 1, tip, '#FDE68A'])   // right claw
  if (level >= 1) r.push([7, 19, 1, 1, '#FDE047'], [16, 19, 1, 1, '#FDE047']) // gold rivets
  if (level >= 2) {
    r.push([7, 15, 10, 1, '#FDE047'])             // gold mount lip
    r.push([9, 9, 2, 4, '#F59E0B'], [9, 9, 1, 2, '#FDE68A']) // 4th front claw — "unsheathed"
    r.push([12, 5, 1, 1, '#FFFFFF'])              // white crown tip
  }
  return r
}

// SQUIRT — sky tank with a left-facing barrel on the SAME socket (matched set).
function squirtRects(level: number): SpriteRect[] {
  const r: SpriteRect[] = [
    [6, 15, 12, 6, '#0C4A6E'],   // socket (sky-tinted twin of CLAW's)
    [6, 20, 12, 1, '#075985'],   // bottom hard shadow
    [7, 15, 10, 2, '#0369A1'],   // lip
    [8, 8, 8, 8, '#38BDF8'],     // tank body
    [8, 8, 8, 2, '#BAE6FD'],     // top sheen
    [8, 8, 1, 6, '#BAE6FD'],     // left-edge sheen
    [9, 13, 6, 2, level >= 1 ? '#BAE6FD' : '#7DD3FC'], // water-level line
  ]
  if (level >= 2) {
    r.push([3, 9, 5, 4, '#0369A1'], [2, 10, 1, 2, '#BAE6FD'])    // wide cannon barrel
  } else {
    r.push([4, 9, 4, level >= 1 ? 4 : 3, '#0369A1'], [3, 10, 1, 1, '#BAE6FD']) // barrel
  }
  if (level >= 1) r.push([7, 19, 1, 1, '#FDE047'], [16, 19, 1, 1, '#FDE047']) // gold rivets
  if (level >= 2) {
    r.push([9, 5, 6, 3, '#38BDF8'], [9, 5, 6, 1, '#BAE6FD'])     // stacked 2nd tank
    r.push([7, 15, 10, 1, '#FDE047'])                            // gold mount lip
  }
  return r
}

function TowerSprite({ type, level, size }: { type: TowerType; level: number; size: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', shapeRendering: 'crispEdges' as const, style: { imageRendering: 'pixelated' as const } }
  const rects = type === 'claw' ? clawRects(level) : squirtRects(level)
  return (
    <svg {...p}>
      {rects.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </svg>
  )
}

// ─── Firing FX — replaces the flat line/circle with juicy pixel bursts ───────
// One zap lives 0.12s; `life` (1→0) drives snap timing (no cross-fades). CLAW
// rakes 3 gold claw-streaks + a pink "bonk"; SQUIRT flings a droplet fan into a
// pixel splash. Pure positioned rects/lines — and the whole layer only exists
// when motion is on (zaps aren't pushed under reduced-motion).
function ZapFx({ z, now }: { z: Zap; now: number }) {
  const life = (z.until - now) / 0.12
  if (life <= 0) return null
  const dx = z.x2 - z.x1, dy = z.y2 - z.y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len   // unit normal to the aim line

  if (z.type === 'claw') {
    const sx = z.x1 + dx * 0.5, sy = z.y1 + dy * 0.5  // rake starts mid-flight
    return (
      <g opacity={life > 0.3 ? 0.95 : 0}>
        {[-3, 0, 3].map((o, i) => (
          <line key={i} x1={sx + nx * o} y1={sy + ny * o} x2={z.x2 + nx * o} y2={z.y2 + ny * o}
            stroke={o === 0 ? '#FDE047' : '#FDE68A'} strokeWidth={2} strokeLinecap="round" />
        ))}
        {life > 0.6 && <rect x={z.x2 - 0.5} y={z.y2 - 0.5} width={1} height={1} fill="#FFFFFF" />}
        {life > 0.45 && <rect x={z.x2 - 1} y={z.y2 - 1} width={2} height={2} fill="#F472B6" />}
      </g>
    )
  }
  // squirt: a fan of droplets arcing to the target, then a pixel splash
  const drops = [0, 1, 2, 3].map(k => {
    const prog = Math.min(1, Math.max(0, (1 - life) + k * 0.13))
    const px = z.x1 + dx * prog, py = z.y1 + dy * prog + Math.sin(prog * Math.PI) * 4
    return <rect key={k} x={px - 1} y={py - 1} width={2} height={2} fill={k % 2 ? '#BAE6FD' : '#7DD3FC'} opacity={0.9} />
  })
  return (
    <g>
      {drops}
      {life < 0.5 && (
        <>
          <rect x={z.x2 - 1.5} y={z.y2 - 1.5} width={3} height={3} fill="#38BDF8" opacity={0.85} />
          {[[-2, 0], [2, 0], [0, -2], [0, 2]].map(([ox, oy], i) => (
            <rect key={i} x={z.x2 + ox - 0.5} y={z.y2 + oy - 0.5} width={1} height={1} fill="#BAE6FD" opacity={0.9} />
          ))}
        </>
      )}
    </g>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────
type Phase = 'idle' | 'build' | 'wave' | 'gameover'

export default function DefendBowlGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null)
  const [waveBanner, setWaveBanner] = useState('')
  const [bestScore, setBest] = useState(0)
  const [reward, setReward] = useState<GameRewardResult | null>(null)
  const [endReason, setEndReason] = useState<'dead' | 'cashed'>('dead')
  const [confirmCashOut, setConfirmCashOut] = useState(false)
  const [, setTick] = useState(0)
  const forceRender = () => setTick(t => (t + 1) % 1000000)

  // Authoritative game state in refs (loop mutates; render reads).
  const enemiesRef = useRef<Enemy[]>([])
  const towersRef  = useRef<Tower[]>([])
  const zapsRef    = useRef<Zap[]>([])
  const waveQueueRef = useRef<EnemyKind[]>([])
  const livesRef   = useRef(START_LIVES)
  const kibbleRef  = useRef(START_KIBBLE)
  const killsRef   = useRef(0)
  const clearedRef = useRef(0)
  const waveRef    = useRef(1)
  const idRef      = useRef(0)
  const gameTimeRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const scoreRef   = useRef(0)
  const savedRef   = useRef(false)
  // loop infra
  const phaseRef   = useRef<Phase>('idle')
  const pausedRef  = useRef(false)
  const lastFrameRef = useRef(0)
  const reducedRef = useRef(false)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { reducedRef.current = reduced }, [reduced])

  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem('defend_bowl_best') || '', 10)
      if (Number.isFinite(n) && n > 0) setBest(n)
    } catch { /* localStorage unavailable */ }
  }, [])

  useVisibilityPause(
    () => { pausedRef.current = true },
    () => { pausedRef.current = false; lastFrameRef.current = performance.now() },
  )

  // ── rAF loop runs only during a wave ──
  useEffect(() => {
    if (phase !== 'wave') return
    let raf = 0
    lastFrameRef.current = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(48, now - lastFrameRef.current) / 1000
      lastFrameRef.current = now
      if (!pausedRef.current) { gameTimeRef.current += dt; tick(dt); forceRender() }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function tick(dt: number) {
    const now = gameTimeRef.current
    // spawn
    spawnTimerRef.current -= dt
    if (waveQueueRef.current.length > 0 && spawnTimerRef.current <= 0) {
      spawnEnemy(waveQueueRef.current.shift() as EnemyKind)
      spawnTimerRef.current = spawnInterval(waveRef.current)
    }
    // move + leak
    const moved: Enemy[] = []
    for (const e of enemiesRef.current) {
      const slowed = now < e.slowUntil ? e.slowFactor : 1
      e.t += e.speed * slowed * dt
      if (e.t >= PATH.length - 1) {
        livesRef.current -= ENEMY[e.kind].leak
        playSound('db_leak')
        continue
      }
      moved.push(e)
    }
    enemiesRef.current = moved
    // towers fire
    for (const tw of towersRef.current) {
      tw.cd -= dt
      if (tw.cd > 0) continue
      const st = TOWER[tw.type].levels[tw.level]
      const tx = (tw.c + 0.5) * CELL, ty = (tw.r + 0.5) * CELL
      let target: Enemy | null = null
      for (const e of enemiesRef.current) {
        const p = pathPoint(e.t)
        if (Math.hypot(p.x - tx, p.y - ty) <= st.range * CELL && (!target || e.t > target.t)) target = e
      }
      if (!target) continue
      tw.cd = 1 / st.rate
      const tp = pathPoint(target.t)
      // Record aim direction + fire time so the render can lunge/recoil the
      // tower toward (claw) or away from (squirt) its target.
      const adx = tp.x - tx, ady = tp.y - ty, alen = Math.hypot(adx, ady) || 1
      tw.aimX = adx / alen; tw.aimY = ady / alen; tw.firedAt = now
      if (tw.type === 'claw') {
        target.hp -= st.dmg
      } else {
        const sp = (st.splash ?? 0.85) * CELL
        for (const e of enemiesRef.current) {
          const p = pathPoint(e.t)
          if (Math.hypot(p.x - tp.x, p.y - tp.y) <= sp) {
            e.hp -= st.dmg
            // slow-resistant enemies (kitten) shrug off most of the slow
            const slowAmt = (st.slow ?? 0.4) * (1 - (ENEMY[e.kind].slowResist ?? 0))
            e.slowUntil = now + (st.slowDur ?? 0.8)
            e.slowFactor = 1 - slowAmt
          }
        }
      }
      if (!reducedRef.current) zapsRef.current.push({ id: ++idRef.current, x1: tx, y1: ty, x2: tp.x, y2: tp.y, type: tw.type, until: now + 0.12 })
    }
    // deaths + bounty
    const alive: Enemy[] = []
    let killed = false
    for (const e of enemiesRef.current) {
      if (e.hp <= 0) { kibbleRef.current += ENEMY[e.kind].bounty; killsRef.current += 1; killed = true; continue }
      alive.push(e)
    }
    enemiesRef.current = alive
    if (killed) playSound('db_pop')
    // expire zaps
    if (zapsRef.current.length) zapsRef.current = zapsRef.current.filter(z => z.until > now)
    // end conditions
    if (livesRef.current <= 0) { endRun('dead'); return }
    if (waveQueueRef.current.length === 0 && enemiesRef.current.length === 0) clearWave()
  }

  function spawnEnemy(kind: EnemyKind) {
    const def = ENEMY[kind]
    const w = waveRef.current
    const hp = Math.round(def.hp * (1 + (w - 1) * 0.29))
    enemiesRef.current.push({ id: ++idRef.current, kind, t: 0, hp, maxHp: hp, speed: def.speed * (1 + (w - 1) * 0.018), slowUntil: 0, slowFactor: 1 })
  }

  function clearWave() {
    clearedRef.current = waveRef.current
    kibbleRef.current += 22 + waveRef.current * 5
    waveRef.current += 1
    zapsRef.current = []
    setPhase('build')
    forceRender()
  }

  function startWave() {
    if (phaseRef.current !== 'build') return
    waveQueueRef.current = genWave(waveRef.current)
    spawnTimerRef.current = 0
    setSelectedCell(null)
    setWaveBanner(`WAVE ${waveRef.current}`)
    timers.setTimeout(() => setWaveBanner(''), 1400)
    playSound('db_wave')
    setPhase('wave')
  }

  function towerAt(c: number, r: number): Tower | null {
    return towersRef.current.find(t => t.c === c && t.r === r) ?? null
  }

  function selectCell(c: number, r: number) {
    if (phaseRef.current !== 'build' && phaseRef.current !== 'wave') return
    if (PATH_SET.has(`${c},${r}`)) { setSelectedCell(null); return }
    setSelectedCell(prev => (prev && prev.c === c && prev.r === r) ? null : { c, r })
  }

  function buildTower(type: TowerType) {
    if (!selectedCell) return
    if (towerAt(selectedCell.c, selectedCell.r)) return
    if (kibbleRef.current < TOWER[type].cost) return
    kibbleRef.current -= TOWER[type].cost
    towersRef.current = [...towersRef.current, { id: ++idRef.current, type, c: selectedCell.c, r: selectedCell.r, level: 0, cd: 0, aimX: 0, aimY: -1, firedAt: -999 }]
    playSound('db_place')
    setSelectedCell(null)
    forceRender()
  }

  function upgradeTower() {
    if (!selectedCell) return
    const tw = towerAt(selectedCell.c, selectedCell.r)
    if (!tw || tw.level >= MAX_LEVEL - 1) return
    const cost = TOWER[tw.type].upgradeCost[tw.level + 1]
    if (kibbleRef.current < cost) return
    kibbleRef.current -= cost
    tw.level += 1
    playSound('db_upgrade')
    forceRender()
  }

  function startGame() {
    timers.clearAll()
    enemiesRef.current = []
    towersRef.current = []
    zapsRef.current = []
    waveQueueRef.current = []
    livesRef.current = START_LIVES
    kibbleRef.current = START_KIBBLE
    killsRef.current = 0
    clearedRef.current = 0
    waveRef.current = 1
    gameTimeRef.current = 0
    spawnTimerRef.current = 0
    scoreRef.current = 0
    savedRef.current = false
    setEndReason('dead')
    setConfirmCashOut(false)
    setReward(null)
    setSelectedCell(null)
    setWaveBanner('')
    setPhase('build')
    forceRender()
  }

  // One exit path for both outcomes. Score = waves cleared + kills, banked once
  // (savedRef guard), reward + high-score save identical whether you died or
  // cashed out — so leaving early never loses what you earned.
  function endRun(reason: 'dead' | 'cashed') {
    setEndReason(reason)
    const finalScore = clearedRef.current * 100 + killsRef.current * 3
    scoreRef.current = finalScore
    setPhase('gameover')
    setBest(b => Math.max(b, finalScore))
    try {
      const prev = parseInt(localStorage.getItem('defend_bowl_best') || '0', 10) || 0
      if (finalScore > prev) localStorage.setItem('defend_bowl_best', String(finalScore))
    } catch { /* ignore */ }
    playSound(reason === 'dead' ? 'db_gameover' : 'db_wave')
    if (!savedRef.current && user?.id) {
      savedRef.current = true
      setReward(reportGameResult({ gameType: 'defend_bowl', score: finalScore }))
      if (finalScore > 0) {
        fireMinigameDone('defend_bowl', finalScore)
        completeTask('daily_game')
        if (finalScore >= WEEKLY_HS) completeTask('weekly_high_score')
        applyAction(user.id, 'play')
      }
    }
  }

  // ── Cash out: bank the run mid-game and keep the reward ──
  function requestCashOut() {
    pausedRef.current = true       // freeze the wave so nothing leaks while deciding
    setSelectedCell(null)          // close any open build sheet so the confirm shows
    setConfirmCashOut(true)
  }
  function cancelCashOut() {
    pausedRef.current = false
    lastFrameRef.current = performance.now()  // avoid a dt spike on resume
    setConfirmCashOut(false)
  }
  function cashOut() {
    setConfirmCashOut(false)
    pausedRef.current = false
    if (savedRef.current) return
    const live = phaseRef.current === 'build' || phaseRef.current === 'wave'
    const progressed = clearedRef.current > 0 || killsRef.current > 0
    if (!live || !progressed) return
    endRun('cashed')
  }
  // Header back: mid-run with progress → open the bank-and-leave confirm so
  // pressing back never silently throws away your score.
  function handleBack() {
    const live = phase === 'build' || phase === 'wave'
    const progressed = clearedRef.current > 0 || killsRef.current > 0
    if (live && progressed) {
      if (!confirmCashOut) { playSound('ui_tap'); requestCashOut() }
      return
    }
    playSound('ui_back'); router.back()
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  const FIELD_W = COLS * CELL
  const FIELD_H = ROWS * CELL
  const lives = livesRef.current
  const kibble = kibbleRef.current
  const enemiesLeft = enemiesRef.current.length + waveQueueRef.current.length
  const selTower = selectedCell ? towerAt(selectedCell.c, selectedCell.r) : null
  const selStats = selTower ? TOWER[selTower.type].levels[selTower.level] : null
  const hasProgress = clearedRef.current > 0 || killsRef.current > 0
  const projectedScore = clearedRef.current * 100 + killsRef.current * 3

  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell select-none"
      style={{ background: 'linear-gradient(180deg, #3B1D0E 0%, #5B3018 50%, #2E1608 100%)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(28,12,4,0.95) 0%, rgba(28,12,4,0.55) 100%)',
        borderBottom: '2px solid rgba(251,146,60,0.3)',
      }}>
        <button onClick={handleBack}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(251,146,60,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-orange-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #EA580C, #FB923C)', border: '2px solid #7C2D12', borderRadius: 4, fontSize: 7.5, letterSpacing: 1.5, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          DEFEND THE BOWL
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FED7AA' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* HUD */}
      {phase !== 'idle' && (
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <IconHeart size={15} />
            <span className="font-pixel" style={{ fontSize: 16, color: lives <= 3 ? '#FCA5A5' : '#FECACA', textShadow: '1px 1px 0 #2E1608' }}>{Math.max(0, lives)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconCoin size={15} />
            <span className="font-pixel" style={{ fontSize: 16, color: '#FDE68A', textShadow: '1px 1px 0 #2E1608' }}>{kibble}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-pixel" style={{ fontSize: 5, color: '#FDBA74', letterSpacing: 1 }}>WAVE</span>
            <span className="font-pixel" style={{ fontSize: 14, color: '#FFFFFF' }}>{waveRef.current}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-pixel" style={{ fontSize: 5, color: '#FDBA74', letterSpacing: 1 }}>KILLS</span>
            <span className="font-pixel" style={{ fontSize: 14, color: '#FED7AA' }}>{killsRef.current}</span>
          </div>
        </div>
      )}

      {/* Field */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="relative" style={{ width: FIELD_W, height: FIELD_H }}>
          {/* cells */}
          {Array.from({ length: COLS * ROWS }).map((_, i) => {
            const c = i % COLS, r = Math.floor(i / COLS)
            const onPath = PATH_SET.has(`${c},${r}`)
            const isBowl = c === BOWL.c && r === BOWL.r
            const isSpawn = c === SPAWN.c && r === SPAWN.r
            const isSel = selectedCell && selectedCell.c === c && selectedCell.r === r
            const tw = !onPath ? towerAt(c, r) : null
            return (
              <div key={i}
                onClick={onPath ? undefined : () => { playSound('ui_tap'); selectCell(c, r) }}
                className="absolute"
                style={{
                  left: c * CELL, top: r * CELL, width: CELL, height: CELL,
                  background: onPath
                    ? (isBowl ? 'transparent' : 'linear-gradient(135deg, #7C4A21, #5B3417)')
                    : (isSel ? 'rgba(251,191,36,0.28)' : 'linear-gradient(135deg, #3E7C2A, #2F5E20)'),
                  border: onPath ? '1px solid rgba(0,0,0,0.25)' : `1px solid ${isSel ? '#FDE047' : 'rgba(0,0,0,0.3)'}`,
                  boxShadow: !onPath && !tw ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
                }}>
                {/* spawn hole */}
                {isSpawn && (
                  <div className="absolute" style={{ inset: 8, borderRadius: '50%', background: 'radial-gradient(circle, #1F1108, #3B1D0E)', border: '2px solid #1A0E06' }} />
                )}
                {/* bowl */}
                {isBowl && (
                  <div className="absolute" style={{ left: 4, right: 4, bottom: 5, top: 12 }}>
                    <div style={{ position: 'absolute', inset: 0, top: 6, background: 'linear-gradient(180deg, #CBD5E1, #94A3B8)', borderRadius: '3px 3px 8px 8px', border: '2px solid #475569' }} />
                    <div style={{ position: 'absolute', left: 2, right: 2, top: 4, height: 7, background: '#FBBF24', borderRadius: 3 }} />
                    <div style={{ position: 'absolute', left: 6, top: 2, width: 5, height: 5, background: '#F59E0B', borderRadius: 2 }} />
                    <div style={{ position: 'absolute', right: 6, top: 3, width: 4, height: 4, background: '#F59E0B', borderRadius: 2 }} />
                  </div>
                )}
                {/* empty buildable hint */}
                {!onPath && !tw && (
                  <span className="absolute inset-0 flex items-center justify-center font-pixel" style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)' }}>+</span>
                )}
                {/* tower — pop on place/upgrade · idle bob · fire-recoil lunge */}
                {tw && (() => {
                  const since = gameTimeRef.current - tw.firedAt
                  const recoil = !reduced && since >= 0 && since < RECOIL_DUR ? 1 - since / RECOIL_DUR : 0
                  const innerTransform = recoil <= 0 ? undefined
                    : tw.type === 'claw'
                      // claw pounces toward its target then snaps back
                      ? `translate(${(tw.aimX * 3 * recoil).toFixed(2)}px,${(tw.aimY * 3 * recoil).toFixed(2)}px) scale(${(1 + 0.1 * recoil).toFixed(3)})`
                      // squirt kicks back from the recoil + a pressure squash
                      : `translate(${(-tw.aimX * 2 * recoil).toFixed(2)}px,${(-tw.aimY * 2 * recoil).toFixed(2)}px) scaleY(${(1 - 0.12 * recoil).toFixed(3)})`
                  return (
                    <div key={`${tw.id}:${tw.level}`}
                      className={`absolute inset-0 flex items-center justify-center${reduced ? '' : ' db-turret-pop'}`}
                      style={{ transformOrigin: '50% 88%' }}>
                      <div className={reduced ? undefined : 'db-turret-idle'}
                        style={reduced ? undefined : { animationDelay: `${((c + r) % 4) * 0.2}s` }}>
                        <div style={{ transform: innerTransform, transformOrigin: '50% 88%' }}>
                          <TowerSprite type={tw.type} level={tw.level} size={CELL - 8} />
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}

          {/* range ring for the selected tower */}
          {selTower && selStats && (
            <div className="absolute pointer-events-none" style={{
              left: (selTower.c + 0.5) * CELL - selStats.range * CELL,
              top: (selTower.r + 0.5) * CELL - selStats.range * CELL,
              width: selStats.range * CELL * 2, height: selStats.range * CELL * 2,
              borderRadius: '50%', border: '2px dashed rgba(253,224,71,0.6)', background: 'rgba(253,224,71,0.06)',
            }} />
          )}

          {/* enemies */}
          {enemiesRef.current.map(e => {
            const p = pathPoint(e.t)
            const def = ENEMY[e.kind]
            const dmgd = e.hp < e.maxHp
            return (
              <div key={e.id} className="absolute pointer-events-none" style={{ left: p.x - def.size / 2, top: p.y - def.size / 2, width: def.size, height: def.size }}>
                <EnemySprite kind={e.kind} size={def.size} />
                {dmgd && (
                  <div className="absolute" style={{ left: 2, right: 2, top: -4, height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 1 }}>
                    <div style={{ height: '100%', width: `${Math.max(0, (e.hp / e.maxHp) * 100)}%`, background: e.hp / e.maxHp > 0.5 ? '#4ADE80' : '#F87171', borderRadius: 1 }} />
                  </div>
                )}
              </div>
            )
          })}

          {/* zaps */}
          {zapsRef.current.length > 0 && (
            <svg className="absolute inset-0 pointer-events-none" width={FIELD_W} height={FIELD_H}>
              {zapsRef.current.map(z => <ZapFx key={z.id} z={z} now={gameTimeRef.current} />)}
            </svg>
          )}

          {/* wave banner */}
          {waveBanner && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A', letterSpacing: 3, textShadow: '2px 2px 0 #2E1608, 0 0 14px rgba(251,191,36,0.7)', animation: reduced ? undefined : 'dbBanner 1.4s ease-out forwards' }}>{waveBanner}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: build sheet · start-wave · wave status */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2" style={{ minHeight: 84 }}>
        {selectedCell ? (
          <div className="flex flex-col gap-2 px-3 py-2.5" style={{ background: 'rgba(28,12,4,0.92)', border: '2px solid rgba(251,146,60,0.5)', borderRadius: 8 }}>
            {selTower && selStats ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-pixel" style={{ fontSize: 9, color: TOWER[selTower.type].light, letterSpacing: 1 }}>{TOWER[selTower.type].name} · LV{selTower.level + 1}</span>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#FDBA74', letterSpacing: 1, marginTop: 2 }}>DMG {selStats.dmg} · RNG {selStats.range.toFixed(1)}{selTower.type === 'squirt' ? ' · SLOW' : ''}</span>
                </div>
                {selTower.level < MAX_LEVEL - 1 ? (
                  <button onClick={() => { playSound('ui_tap'); upgradeTower() }} disabled={kibble < TOWER[selTower.type].upgradeCost[selTower.level + 1]}
                    className="font-pixel px-3 py-2 active:translate-y-[1px]" style={{
                      background: kibble >= TOWER[selTower.type].upgradeCost[selTower.level + 1] ? 'linear-gradient(135deg, #F59E0B, #B45309)' : 'rgba(120,80,30,0.4)',
                      border: '2px solid #7C2D12', borderRadius: 4, color: '#FFF', fontSize: 8, letterSpacing: 1,
                      opacity: kibble >= TOWER[selTower.type].upgradeCost[selTower.level + 1] ? 1 : 0.5,
                    }}>
                    UPGRADE · {TOWER[selTower.type].upgradeCost[selTower.level + 1]}
                  </button>
                ) : (
                  <span className="font-pixel px-3 py-2" style={{ background: 'rgba(253,224,71,0.18)', border: '2px solid #FDE047', borderRadius: 4, color: '#FDE047', fontSize: 8 }}>MAX</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {(['claw', 'squirt'] as TowerType[]).map(tt => {
                  const afford = kibble >= TOWER[tt].cost
                  return (
                    <button key={tt} onClick={() => { playSound('ui_tap'); buildTower(tt) }} disabled={!afford}
                      className="flex-1 flex items-center gap-2 px-2 py-2 active:translate-y-[1px]" style={{
                        background: afford ? 'rgba(60,124,42,0.35)' : 'rgba(255,255,255,0.04)',
                        border: `2px solid ${TOWER[tt].color}`, borderRadius: 6, opacity: afford ? 1 : 0.45,
                      }}>
                      <TowerSprite type={tt} level={0} size={28} />
                      <div className="flex flex-col items-start">
                        <span className="font-pixel" style={{ fontSize: 8, color: TOWER[tt].light, letterSpacing: 1 }}>{TOWER[tt].name}</span>
                        <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 7, color: '#FDE68A' }}><IconCoin size={9} />{TOWER[tt].cost}</span>
                      </div>
                    </button>
                  )
                })}
                <button onClick={() => { playSound('ui_back'); setSelectedCell(null) }} className="font-pixel px-2 py-2" style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 5, color: '#FED7AA', fontSize: 7 }}>X</button>
              </div>
            )}
          </div>
        ) : confirmCashOut ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5" style={{ background: 'rgba(28,12,4,0.95)', border: '2px solid #FDE047', borderRadius: 8 }}>
            <div className="flex flex-col">
              <span className="font-pixel" style={{ fontSize: 6, color: '#FDBA74', letterSpacing: 1 }}>BANK SCORE</span>
              <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 18, color: '#FDE68A', textShadow: '0 0 8px rgba(251,191,36,0.5)' }}><IconCoin size={13} />{projectedScore}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { playSound('ui_back'); cancelCashOut() }} className="font-pixel px-3 py-2" style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 5, color: '#FED7AA', fontSize: 7.5, letterSpacing: 1 }}>KEEP PLAYING</button>
              <button onClick={cashOut} className="font-pixel inline-flex items-center gap-1 px-3 py-2 active:translate-y-[1px]" style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)', border: '2px solid #7C2D12', borderRadius: 5, color: '#FFF', fontSize: 8, letterSpacing: 1 }}><IconCoin size={9} /> CASH OUT</button>
            </div>
          </div>
        ) : phase === 'build' ? (
          <div className="flex items-stretch gap-2">
            <button onClick={() => { playSound('ui_tap'); startWave() }}
              className="flex-1 flex items-center justify-center gap-2 py-3 active:translate-y-[2px] transition-transform"
              style={{ background: 'linear-gradient(135deg, #EA580C, #B45309)', border: '2px solid #7C2D12', borderRadius: 6, boxShadow: '0 4px 0 #7C2D12', color: '#FFF', fontFamily: '"Press Start 2P"', fontSize: 11, letterSpacing: 2 }}>
              START WAVE {waveRef.current} <ArrowRight size={16} />
            </button>
            {hasProgress && (
              <button onClick={() => { playSound('ui_tap'); requestCashOut() }}
                className="flex flex-col items-center justify-center gap-0.5 px-3 active:translate-y-[1px]"
                style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid #FDE047', borderRadius: 6, color: '#FDE68A' }}>
                <IconCoin size={13} />
                <span className="font-pixel" style={{ fontSize: 5.5, letterSpacing: 1 }}>CASH OUT</span>
              </button>
            )}
          </div>
        ) : phase === 'wave' ? (
          <div className="w-full flex items-center justify-center gap-3 py-3" style={{ background: 'rgba(28,12,4,0.6)', border: '2px solid rgba(251,146,60,0.3)', borderRadius: 6 }}>
            <span className="font-pixel" style={{ fontSize: 8, color: '#FDBA74', letterSpacing: 1 }}>ENEMIES LEFT</span>
            <span className="font-pixel" style={{ fontSize: 14, color: '#FECACA' }}>{enemiesLeft}</span>
            {hasProgress ? (
              <button onClick={() => { playSound('ui_tap'); requestCashOut() }} className="font-pixel inline-flex items-center gap-1 px-2.5 py-1.5 active:translate-y-[1px]" style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid #FDE047', borderRadius: 5, color: '#FDE68A', fontSize: 7 }}><IconCoin size={9} /> CASH OUT</button>
            ) : (
              <span className="font-pixel" style={{ fontSize: 6, color: '#FDBA74', letterSpacing: 1 }}>· TAP A TILE TO BUILD</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="px-6 py-5 flex flex-col items-center gap-3" style={{ background: 'rgba(28,12,4,0.95)', border: '3px solid #FB923C', borderRadius: 8, boxShadow: '0 4px 0 #7C2D12, 0 0 30px rgba(251,146,60,0.5)', maxWidth: 320 }}>
            <p className="font-pixel" style={{ fontSize: 11, letterSpacing: 1.5, color: '#FED7AA', filter: 'drop-shadow(0 0 6px rgba(251,146,60,0.5))' }}>DEFEND THE BOWL</p>
            <div className="font-pixel text-center" style={{ fontSize: 6, color: '#FDBA74', letterSpacing: 1, lineHeight: 1.9 }}>
              <p>TAP A GREEN TILE TO BUILD</p>
              <p>CLAW HITS · SQUIRT SLOWS</p>
              <p style={{ color: '#FCA5A5' }}>DON&apos;T LET THEM REACH THE BOWL</p>
              <p style={{ color: '#FDE68A' }}>CASH OUT ANYTIME — KEEP YOUR SCORE</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)', border: '2px solid #7C2D12', borderRadius: 3, boxShadow: '0 4px 0 #7C2D12', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5 }}>
              <IconStar size={12} /> DEFEND
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(20,8,2,0.74)', backdropFilter: 'blur(2px)' }}>
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{ background: 'linear-gradient(180deg, #3B1D0E 0%, #2A1308 100%)', border: '3px solid #EA580C', borderRadius: 6, boxShadow: '0 6px 0 #7C2D12, 0 0 30px rgba(234,88,12,0.5)', animation: reduced ? undefined : 'dbPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <p className="font-pixel" style={{ fontSize: 11, color: endReason === 'dead' ? '#FCA5A5' : '#FDE68A', letterSpacing: 2, ...(endReason !== 'dead' ? { filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' } : {}) }}>{endReason === 'dead' ? 'THE BOWL FELL' : 'CASHED OUT'}</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDBA74', letterSpacing: 1 }}>SCORE</span>
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{scoreRef.current}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#7C2D12' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDBA74', letterSpacing: 1 }}>WAVES</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FED7AA' }}>{clearedRef.current}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#7C2D12' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
              </div>
            </div>
            {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => { playSound('ui_tap'); startGame() }}
                className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)', border: '2px solid #7C2D12', borderRadius: 3, boxShadow: '0 4px 0 #7C2D12', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
                <RefreshCw size={11} /> AGAIN
              </button>
              <button onClick={() => { playSound('ui_back'); router.back() }}
                className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #475569 0%, #1F2937 100%)', border: '2px solid #0F172A', borderRadius: 3, boxShadow: '0 4px 0 #0F172A', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes dbPop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes dbBanner { 0% { transform: scale(0.6); opacity: 0; } 25% { transform: scale(1.1); opacity: 1; } 75% { opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        /* turret idle "breathing" — a 1px snap bob, runs in the build phase (no rAF) */
        @keyframes dbTurretIdle { 0%, 49% { transform: translateY(0); } 50%, 100% { transform: translateY(-1px); } }
        .db-turret-idle { animation: dbTurretIdle 1.6s steps(1, end) infinite; transform-origin: 50% 100%; }
        /* place / upgrade pop — gravity overshoot + a one-frame charge flash */
        @keyframes dbTurretPop { 0% { transform: scale(0.2); filter: brightness(2.4); } 45% { transform: scale(1.18); filter: brightness(1.4); } 70% { transform: scale(0.94); filter: brightness(1); } 100% { transform: scale(1); filter: brightness(1); } }
        .db-turret-pop { animation: dbTurretPop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>
    </div>
  )
}
