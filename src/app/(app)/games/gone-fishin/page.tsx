'use client'

// ═══════════════════════════════════════════════════════════════════════════
// GONE FISHIN' — a cosy four-phase fishing game with a collection meta.
// ────────────────────────────────────────────────────────────────────────
// Loop:  CAST (tap a sweeping power marker — the sweet spot reaches deeper,
//        rarer water) → WAIT (the bobber dips after a beat; tap too early and
//        you spook it) → HOOK (tap inside a shrinking reaction window) →
//        REEL (hold to raise the catch bar; keep the darting fish inside it to
//        fill the meter). Land the fish to bank its value.
//
// Run economy = a BAIT budget (no timer): each cast spends 1 bait, landing a
// rare-or-better fish refunds 1 — so skill extends the run and it always ends
// cleanly when the bait runs out. Score = total value of fish landed.
//
// Difficulty ramps WITHIN a run (faster marker, shorter hook window, twitchier
// fish as you land more). Caught species persist to a fish-dex (localStorage)
// — the cross-run hook.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
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
import { IconFish, IconStar } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'
import { FishSprite } from './FishSprite'
import Atmosphere from './Atmosphere'
import CatchCelebration from './CatchCelebration'

// ─── Tunables ───────────────────────────────────────────────────────────────
const START_BAIT  = 10
const LOW_BAIT     = 3
const WEEKLY_HS    = 300   // total fish value that completes the weekly high-score task
const CAST_BASE    = 1.25  // cast-marker sweeps per second (climbs with catches)
const HOOK_BASE    = 760   // hook window ms (shrinks with catches, floored)
const HOOK_MIN     = 470
// ── Reel physics (velocity-driven — snappy + controllable) ──
// The catch bar is DIRECT-velocity controlled: holding drives it up at REEL_UP,
// releasing lets it sink at REEL_DOWN, and its velocity chases that target over
// ~VEL_SMOOTH so it keeps a hint of weight without floating. It crosses the
// whole column in ~0.35s and settles within ~0.1s of release. (The old momentum
// bar topped out ~1.35 units/s and drifted — sluggish and hard to place.)
const REEL_UP      = 2.75   // bar top speed upward (track-units/sec) while held
const REEL_DOWN    = 2.15   // bar sink speed while released
const VEL_SMOOTH   = 22     // how fast bar velocity chases its target (bigger = snappier)
const CATCH_RATE   = 0.62   // progress/sec while the fish sits inside the bracket
const DRAIN_RATE   = 0.34   // progress/sec while the fish is fully off the bracket
const GRACE_DRAIN  = 0.13   // gentler drain when the fish is only just off an edge
const GRACE_MARGIN = 0.06   // "just off" = the fish is within this of a bracket edge
const PROGRESS_START = 0.40

// ── Fish fight (behaviour archetypes + a tiring arc) ──
// Each species moves to its own rhythm (see the `move` archetype). As the catch
// meter climbs past its start the fish tires — its darts shorten, calm toward
// the middle, and space out — so every fight opens frantic and ends controllable.
const FISH_EASE    = 3.6    // base approach rate toward the fish's current target
const TIRE_CALM    = 0.5    // a fully-tired fish approaches this much slower
const TIRE_DWELL   = 1.4    // …and waits this much longer between darts

type Rarity = 'junk' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
// How a hooked fish moves in the reel column:
//  cruise — gentle mid-water drift · dart — snappy jumps anywhere ·
//  dive — sounds to the floor then bolts up · jitter — nervous hops ·
//  run — long committed runs to an edge (the hardest to bracket).
type Move = 'cruise' | 'dart' | 'dive' | 'jitter' | 'run'

interface Species {
  id: string
  name: string
  rarity: Rarity
  value: number
  color: string
  dark: string
  light: string
  kind: 'fish' | 'junk'
  speed: number   // reel: dart speed
  jitter: number  // reel: re-target frequency
  move: Move      // reel: behaviour archetype
}

const SPECIES: Species[] = [
  { id: 'boot',    name: 'OLD BOOT',    rarity: 'junk',      value: 2,   color: '#92400E', dark: '#451A03', light: '#B45309', kind: 'junk', speed: 0.22, jitter: 0.18, move: 'cruise' },
  { id: 'can',     name: 'TIN CAN',     rarity: 'junk',      value: 2,   color: '#9CA3AF', dark: '#4B5563', light: '#D1D5DB', kind: 'junk', speed: 0.22, jitter: 0.18, move: 'cruise' },
  { id: 'weed',    name: 'SEAWEED',     rarity: 'junk',      value: 3,   color: '#15803D', dark: '#14532D', light: '#22C55E', kind: 'junk', speed: 0.26, jitter: 0.24, move: 'cruise' },
  { id: 'minnow',  name: 'MINNOW',      rarity: 'common',    value: 6,   color: '#CBD5E1', dark: '#64748B', light: '#F1F5F9', kind: 'fish', speed: 0.34, jitter: 0.30, move: 'cruise' },
  { id: 'sardine', name: 'SARDINE',     rarity: 'common',    value: 9,   color: '#60A5FA', dark: '#1E40AF', light: '#BFDBFE', kind: 'fish', speed: 0.40, jitter: 0.38, move: 'dart' },
  { id: 'perch',   name: 'PERCH',       rarity: 'common',    value: 12,  color: '#84CC16', dark: '#3F6212', light: '#BEF264', kind: 'fish', speed: 0.44, jitter: 0.44, move: 'dart' },
  { id: 'bass',    name: 'BASS',        rarity: 'uncommon',  value: 20,  color: '#10B981', dark: '#065F46', light: '#6EE7B7', kind: 'fish', speed: 0.50, jitter: 0.52, move: 'dart' },
  { id: 'trout',   name: 'TROUT',       rarity: 'uncommon',  value: 26,  color: '#2DD4BF', dark: '#115E59', light: '#99F6E4', kind: 'fish', speed: 0.54, jitter: 0.58, move: 'jitter' },
  { id: 'puffer',  name: 'PUFFERFISH',  rarity: 'rare',      value: 42,  color: '#FBBF24', dark: '#92400E', light: '#FDE68A', kind: 'fish', speed: 0.60, jitter: 0.66, move: 'dive' },
  { id: 'koi',     name: 'KOI',         rarity: 'rare',      value: 58,  color: '#FB923C', dark: '#9A3412', light: '#FED7AA', kind: 'fish', speed: 0.66, jitter: 0.82, move: 'jitter' },
  { id: 'catfish', name: 'CATFISH',     rarity: 'epic',      value: 85,  color: '#A78BFA', dark: '#4C1D95', light: '#DDD6FE', kind: 'fish', speed: 0.72, jitter: 0.80, move: 'dive' },
  { id: 'goldfish',name: 'GOLDEN FISH', rarity: 'legendary', value: 160, color: '#FDE047', dark: '#A16207', light: '#FEF9C3', kind: 'fish', speed: 0.78, jitter: 0.95, move: 'run' },
]

const BASE_WEIGHT: Record<Rarity, number> = {
  junk: 1.1, common: 3, uncommon: 1.5, rare: 0.65, epic: 0.26, legendary: 0.1,
}

const RARITY_LABEL: Record<Rarity, string> = {
  junk: 'JUNK', common: 'COMMON', uncommon: 'UNCOMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY',
}
const RARITY_COLOR: Record<Rarity, string> = {
  junk: '#94A3B8', common: '#A7F3D0', uncommon: '#7DD3FC', rare: '#FBBF24', epic: '#C4B5FD', legendary: '#FDE047',
}
const RARITY_BAR_H: Record<Rarity, number> = {
  junk: 0.42, common: 0.36, uncommon: 0.31, rare: 0.26, epic: 0.22, legendary: 0.19,
}

function isRarePlus(r: Rarity): boolean {
  return r === 'rare' || r === 'epic' || r === 'legendary'
}

// Weighted pick. A cleaner cast (quality 0..1) and a longer run (landed)
// both bias toward the rarer pools.
function pickSpecies(quality: number, landed: number): Species {
  const boost = (r: Rarity): number => {
    if (r === 'rare')      return 0.40 + quality * 1.3 + landed * 0.015
    if (r === 'epic')      return 0.25 + quality * 1.1 + landed * 0.012
    if (r === 'legendary') return 0.12 + quality * 0.9 + landed * 0.008
    if (r === 'uncommon')  return 0.80 + quality * 0.6
    return 1
  }
  const weights = SPECIES.map(s => BASE_WEIGHT[s.rarity] * boost(s.rarity))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < SPECIES.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return SPECIES[i]
  }
  return SPECIES[0]
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

// Where the hooked fish darts next, by archetype. `tired` (0..1) drags the
// chosen target back toward the catchable middle so a worn-out fish is landable.
function pickFishTarget(move: Move, tired: number, cur: number): number {
  const r = Math.random()
  let t: number
  switch (move) {
    case 'cruise': t = 0.30 + r * 0.40; break                          // gentle mid-water drift
    case 'dart':   t = 0.08 + r * 0.84; break                          // snappy jumps anywhere
    case 'dive':   t = r < 0.5 ? 0.72 + Math.random() * 0.20           // sounds to the floor…
                               : 0.08 + Math.random() * 0.18; break    // …or bolts to the top
    case 'jitter': t = r < 0.72 ? clamp01(cur + (Math.random() - 0.5) * 0.32)
                                : 0.10 + Math.random() * 0.80; break   // nervous hops + rare bolt
    case 'run':    t = r < 0.5 ? 0.06 + Math.random() * 0.12           // long commits to an edge
                               : 0.82 + Math.random() * 0.12; break
    default:       t = 0.20 + r * 0.60
  }
  return t + (0.5 - t) * tired * 0.55
}

// ─── Component ──────────────────────────────────────────────────────────────
type Phase = 'idle' | 'cast' | 'wait' | 'hook' | 'reel' | 'caught' | 'missed' | 'gameover'

export default function GoneFishinGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

  const [phase, setPhase]   = useState<Phase>('idle')
  const [bait, setBait]     = useState(START_BAIT)
  const [score, setScore]   = useState(0)
  const [bestScore, setBest] = useState(0)
  const [castMarker, setCastMarker] = useState(0)   // 0..1, render mirror
  const [bobberDip, setBobberDip]   = useState(false)
  const [castMsg, setCastMsg]       = useState('')  // GOOD CAST / DEEP CAST
  const [missMsg, setMissMsg]       = useState('')
  const [holding, setHolding]       = useState(false)
  const [fishY, setFishY]           = useState(0.5)
  const [barY, setBarY]             = useState(0.45)
  const [progress, setProgress]     = useState(PROGRESS_START)
  const [inside, setInside]         = useState(false)  // fish currently in the catch bar (drives glow)
  const [caught, setCaught]         = useState<{ s: Species; isNew: boolean } | null>(null)
  const [dex, setDex]               = useState<string[]>([])
  const [reward, setReward]         = useState<GameRewardResult | null>(null)

  // Refs for the rAF loop + synchronous decisions (avoid stale closures).
  const phaseRef    = useRef<Phase>('idle')
  const pausedRef   = useRef(false)
  const lastFrameRef = useRef(0)
  const scoreRef    = useRef(0)
  const baitRef     = useRef(START_BAIT)
  const landedRef   = useRef(0)
  const savedRef    = useRef(false)
  const resolvingRef = useRef(false)
  const dexRef      = useRef<string[]>([])
  // cast
  const castMarkerRef = useRef(0)
  const castDirRef    = useRef(1)
  const castQualityRef = useRef(0)
  // reel
  const fishYRef    = useRef(0.5)
  const fishTargetRef = useRef(0.5)
  const fishTimerRef = useRef(0)
  const barYRef     = useRef(0.45)
  const barVelRef   = useRef(0)
  const progressRef = useRef(PROGRESS_START)
  const insideRef   = useRef(false)
  const holdingRef  = useRef(false)
  const speciesRef  = useRef<Species>(SPECIES[0])
  const barHRef     = useRef(0.3)
  // timers
  const hookTimerRef = useRef<number | null>(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { scoreRef.current = score }, [score])

  // Load persisted BEST + fish-dex once.
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem('gone_fishin_best') || '', 10)
      if (Number.isFinite(n) && n > 0) setBest(n)
      const raw = localStorage.getItem('gone_fishin_dex')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) { dexRef.current = arr; setDex(arr) }
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  // Pause: rAF stops while hidden on its own; just drop the held input and
  // rebase the frame clock so the first visible frame doesn't jump.
  useVisibilityPause(
    () => { pausedRef.current = true; holdingRef.current = false; setHolding(false) },
    () => { pausedRef.current = false; lastFrameRef.current = performance.now() },
  )

  // ── rAF loop drives the cast marker + the reel; nothing else needs frames ──
  useEffect(() => {
    if (phase !== 'cast' && phase !== 'reel') return
    let raf = 0
    lastFrameRef.current = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(48, now - lastFrameRef.current) / 1000
      lastFrameRef.current = now
      if (!pausedRef.current) {
        if (phaseRef.current === 'cast') tickCast(dt)
        else if (phaseRef.current === 'reel') tickReel(dt)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function tickCast(dt: number) {
    const speed = CAST_BASE + landedRef.current * 0.05
    let m = castMarkerRef.current + castDirRef.current * speed * dt
    if (m >= 1) { m = 1; castDirRef.current = -1 }
    else if (m <= 0) { m = 0; castDirRef.current = 1 }
    castMarkerRef.current = m
    setCastMarker(m)
  }

  function tickReel(dt: number) {
    if (resolvingRef.current) return
    const sp = speciesRef.current
    // how worn-out the fish is: climbs from 0 as the catch meter passes its start
    const tired = clamp01((progressRef.current - PROGRESS_START) / (1 - PROGRESS_START))

    // fish darts to archetype-driven targets; tiring shortens + spaces out its moves
    fishTimerRef.current -= dt
    if (fishTimerRef.current <= 0) {
      fishTargetRef.current = pickFishTarget(sp.move, tired, fishYRef.current)
      const beat = 0.5 + Math.random() * 0.6
      fishTimerRef.current = (beat / (0.5 + sp.jitter)) * (1 + tired * TIRE_DWELL)
    }
    const ease = FISH_EASE * sp.speed * (1 - tired * TIRE_CALM)
    fishYRef.current += (fishTargetRef.current - fishYRef.current) * Math.min(1, ease * dt)
    setFishY(fishYRef.current)

    // catch bar: direct velocity toward a hold(up)/sink(down) target, lightly smoothed
    const targetVel = holdingRef.current ? -REEL_UP : REEL_DOWN
    barVelRef.current += (targetVel - barVelRef.current) * Math.min(1, VEL_SMOOTH * dt)
    let by = barYRef.current + barVelRef.current * dt
    const maxY = 1 - barHRef.current
    if (by <= 0) { by = 0; if (barVelRef.current < 0) barVelRef.current = 0 }
    else if (by >= maxY) { by = maxY; if (barVelRef.current > 0) barVelRef.current = 0 }
    barYRef.current = by
    setBarY(by)
    // progress fills while the fish sits inside the bracket; a near-miss drains gently
    const top = by, bot = by + barHRef.current
    const fy = fishYRef.current
    const isIn = fy >= top && fy <= bot
    if (isIn !== insideRef.current) { insideRef.current = isIn; setInside(isIn) }
    let rate: number
    if (isIn) rate = CATCH_RATE
    else {
      const gap = fy < top ? top - fy : fy - bot
      rate = -(gap <= GRACE_MARGIN ? GRACE_DRAIN : DRAIN_RATE)
    }
    const pr = progressRef.current + rate * dt
    if (pr >= 1) { progressRef.current = 1; setProgress(1); landFish(); return }
    if (pr <= 0) { progressRef.current = 0; setProgress(0); resolveMiss('IT GOT AWAY!'); return }
    progressRef.current = pr
    setProgress(pr)
  }

  // ── Phase transitions ──
  function startGame() {
    timers.clearAll()
    if (hookTimerRef.current !== null) { timers.clearTimeout(hookTimerRef.current); hookTimerRef.current = null }
    setBait(START_BAIT); baitRef.current = START_BAIT
    setScore(0); scoreRef.current = 0
    landedRef.current = 0
    savedRef.current = false
    resolvingRef.current = false
    setReward(null)
    setCaught(null)
    beginCast()
  }

  function beginCast() {
    resolvingRef.current = false
    setBobberDip(false)
    setCastMsg('')
    setMissMsg('')
    setHolding(false); holdingRef.current = false
    castMarkerRef.current = 0; castDirRef.current = 1; setCastMarker(0)
    setPhase('cast')
  }

  function lockCast() {
    if (phaseRef.current !== 'cast') return
    const m = castMarkerRef.current
    const quality = 1 - Math.abs(m - 0.5) * 2
    castQualityRef.current = quality
    // spend bait now — the cast is committed
    const nb = baitRef.current - 1
    baitRef.current = nb
    setBait(nb)
    playSound('gf_cast')
    setCastMsg(quality > 0.66 ? 'DEEP CAST!' : quality > 0.33 ? 'GOOD CAST' : 'SHALLOW…')
    setPhase('wait')
    // bobber settles, then a bite after a random beat
    const delay = 750 + Math.random() * 1500
    timers.setTimeout(triggerBite, delay)
  }

  function spookEarly() {
    if (phaseRef.current !== 'wait') return
    resolveMiss('TOO EARLY — SPOOKED IT!')
  }

  function triggerBite() {
    if (phaseRef.current !== 'wait') return
    setBobberDip(true)
    playSound('gf_bite')
    setPhase('hook')
    const win = Math.max(HOOK_MIN, HOOK_BASE - landedRef.current * 16)
    hookTimerRef.current = timers.setTimeout(missHook, win)
  }

  function missHook() {
    // If the tab is hidden, don't punish a window the player can't see — re-arm.
    if (typeof document !== 'undefined' && document.hidden) {
      hookTimerRef.current = timers.setTimeout(missHook, 380)
      return
    }
    if (phaseRef.current !== 'hook') return
    resolveMiss('IT SLIPPED AWAY!')
  }

  function attemptHook() {
    if (phaseRef.current !== 'hook') return
    if (hookTimerRef.current !== null) { timers.clearTimeout(hookTimerRef.current); hookTimerRef.current = null }
    playSound('gf_hook')
    startReel()
  }

  function startReel() {
    const sp = pickSpecies(castQualityRef.current, landedRef.current)
    speciesRef.current = sp
    const bh = RARITY_BAR_H[sp.rarity]
    barHRef.current = bh
    fishYRef.current = 0.5; setFishY(0.5)
    fishTargetRef.current = 0.5; fishTimerRef.current = 0.5
    // start the bar centred on the fish so the player gets a fair grip
    barYRef.current = 0.5 - bh / 2; setBarY(0.5 - bh / 2); barVelRef.current = 0
    progressRef.current = PROGRESS_START; setProgress(PROGRESS_START)
    insideRef.current = true; setInside(true)
    resolvingRef.current = false
    setHolding(false); holdingRef.current = false
    setPhase('reel')
  }

  function landFish() {
    if (resolvingRef.current) return
    resolvingRef.current = true
    const sp = speciesRef.current
    const ns = scoreRef.current + sp.value
    scoreRef.current = ns
    setScore(ns)
    landedRef.current += 1
    // rare+ refunds a bait so a great catch sustains the run
    if (isRarePlus(sp.rarity)) { baitRef.current += 1; setBait(b => b + 1) }
    // fish-dex
    const isNew = !dexRef.current.includes(sp.id)
    if (isNew) {
      const nd = [...dexRef.current, sp.id]
      dexRef.current = nd
      setDex(nd)
      try { localStorage.setItem('gone_fishin_dex', JSON.stringify(nd)) } catch { /* ignore */ }
    }
    playSound('care_splash')
    playSound(isRarePlus(sp.rarity) ? 'gf_big' : 'gf_land')
    setCaught({ s: sp, isNew })
    setPhase('caught')
    timers.setTimeout(nextCastOrEnd, 1700)
  }

  function resolveMiss(msg: string) {
    if (resolvingRef.current) return
    resolvingRef.current = true
    if (hookTimerRef.current !== null) { timers.clearTimeout(hookTimerRef.current); hookTimerRef.current = null }
    setMissMsg(msg)
    setBobberDip(false)
    playSound('gf_escape')
    setPhase('missed')
    timers.setTimeout(nextCastOrEnd, 1050)
  }

  function nextCastOrEnd() {
    if (phaseRef.current !== 'caught' && phaseRef.current !== 'missed') return
    if (baitRef.current <= 0) endGame()
    else beginCast()
  }

  function endGame() {
    const finalScore = scoreRef.current
    setPhase('gameover')
    setBest(b => Math.max(b, finalScore))
    try {
      const prev = parseInt(localStorage.getItem('gone_fishin_best') || '0', 10) || 0
      if (finalScore > prev) localStorage.setItem('gone_fishin_best', String(finalScore))
    } catch { /* ignore */ }
    playSound('gf_gameover')
    if (!savedRef.current && user?.id) {
      savedRef.current = true
      setReward(reportGameResult({ gameType: 'gone_fishin', score: finalScore }))
      if (finalScore > 0) {
        fireMinigameDone('gone_fishin', finalScore)
        completeTask('daily_game')
        if (finalScore >= WEEKLY_HS) completeTask('weekly_high_score')
        applyAction(user.id, 'play')
      }
    }
  }

  // ── Input dispatch ──
  function handlePointerDown() {
    switch (phaseRef.current) {
      case 'cast':   lockCast(); break
      case 'wait':   spookEarly(); break
      case 'hook':   attemptHook(); break
      case 'reel':   holdingRef.current = true; setHolding(true); break
      case 'caught':
      case 'missed': nextCastOrEnd(); break
    }
  }
  function handlePointerUp() {
    if (phaseRef.current === 'reel') { holdingRef.current = false; setHolding(false) }
  }

  const baitLow = bait <= LOW_BAIT
  const caughtCount = dex.length

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell select-none"
      style={{ background: 'linear-gradient(180deg, #0C4A6E 0%, #075985 38%, #0E3A5C 100%)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(3,18,32,0.95) 0%, rgba(3,18,32,0.55) 100%)',
        borderBottom: '2px solid rgba(56,189,248,0.3)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(56,189,248,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-sky-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #0284C7, #38BDF8)', border: '2px solid #075985', borderRadius: 4, fontSize: 8, letterSpacing: 1.5, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          GONE FISHIN&apos;
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#BAE6FD' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* HUD */}
      {phase !== 'idle' && (
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <div className="flex flex-col">
            <span className="font-pixel" style={{ fontSize: 6, color: baitLow ? '#FCA5A5' : '#7DD3FC', letterSpacing: 2 }}>BAIT</span>
            <div className="flex items-center gap-1.5">
              <span key={`bait-${bait}`} className="font-pixel" style={{
                fontSize: 22, color: baitLow ? '#FCA5A5' : '#FDE68A',
                textShadow: baitLow ? '0 0 10px rgba(248,113,113,0.7)' : '2px 2px 0 #0C2A3E',
                animation: baitLow && !reduced ? 'gfPulse 0.5s ease-out' : undefined,
              }}>{bait}</span>
              <IconFish size={14} />
            </div>
          </div>
          <div className="text-center">
            <div className="font-pixel" style={{ fontSize: 6, color: '#7DD3FC', letterSpacing: 2 }}>SCORE</div>
            <div className="font-pixel" style={{ fontSize: 22, color: '#FFFFFF', textShadow: '2px 2px 0 #0C2A3E' }}>{score}</div>
          </div>
          <div className="text-right">
            <div className="font-pixel" style={{ fontSize: 6, color: '#7DD3FC', letterSpacing: 2 }}>DEX</div>
            <div className="font-pixel" style={{ fontSize: 22, color: '#BAE6FD' }}>{caughtCount}/{SPECIES.length}</div>
          </div>
        </div>
      )}

      {/* Play area */}
      <div className="flex-1 relative overflow-hidden"
        onPointerDown={phase !== 'idle' && phase !== 'gameover' ? handlePointerDown : undefined}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}>

        {/* living underwater backdrop — rays, caustics, rising bubbles */}
        <Atmosphere reduced={reduced} />

        {/* ── CAST: sweeping power meter ── */}
        {phase === 'cast' && (
          <>
            {/* angler's rod + line dipping toward the meter */}
            <div className="absolute left-1/2 pointer-events-none" style={{ top: '14%', marginLeft: -70, width: 140, height: '46%' }} aria-hidden>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 96, height: 4, background: 'linear-gradient(90deg,#7C5A33,#C8A36A)', borderRadius: 2, transform: 'rotate(-22deg)', transformOrigin: 'left center', boxShadow: '0 1px 0 rgba(0,0,0,0.4)' }} />
              <div style={{ position: 'absolute', left: 92, top: 18, width: 2, height: '78%', marginLeft: -1, background: 'rgba(226,232,240,0.55)' }} />
              {/* the cast power marker rides up the line as a tension flick */}
              <div style={{ position: 'absolute', left: 92, top: `${18 + castMarker * 16}%`, marginLeft: -3, width: 6, height: 6, borderRadius: '50%', background: '#FDE047', boxShadow: '0 0 8px rgba(253,224,71,0.9)' }} />
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-10 gap-3">
              <p className="font-pixel" style={{ fontSize: 9, color: '#FDE68A', letterSpacing: 2, textShadow: '1px 1px 0 #0C2A3E', animation: reduced ? undefined : 'gfNudge 1.1s ease-in-out infinite' }}>TAP TO CAST</p>
              <div className="relative" style={{ width: 264, height: 28, background: 'rgba(0,0,0,0.45)', border: '2px solid #38BDF8', borderRadius: 5, overflow: 'hidden', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
                {/* depth gradient: dark shallows → bright deep at centre */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #16306B, #0EA5E9 50%, #16306B)' }} />
                {/* depth ladder ticks */}
                <div className="absolute inset-0 flex justify-between px-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} style={{ width: 1, background: 'rgba(186,230,253,0.25)' }} />
                  ))}
                </div>
                {/* sweet spot */}
                <div className="absolute top-0 bottom-0" style={{ left: '42%', width: '16%', background: 'rgba(253,224,71,0.32)', borderLeft: '1px solid #FDE047', borderRight: '1px solid #FDE047', boxShadow: '0 0 12px rgba(253,224,71,0.45)' }} />
                {/* marker */}
                <div className="absolute top-0 bottom-0" style={{ left: `calc(${castMarker * 100}% - 3px)`, width: 6, background: '#FFFFFF', boxShadow: '0 0 8px rgba(255,255,255,0.95)' }} />
              </div>
              {/* depth labels */}
              <div className="flex items-center justify-between font-pixel" style={{ width: 264, fontSize: 5, color: '#7DD3FC', letterSpacing: 1 }}>
                <span>SHALLOW</span>
                <span style={{ color: '#FDE047' }}>DEEP · RARER FISH</span>
                <span>SHALLOW</span>
              </div>
            </div>
          </>
        )}

        {/* ── WAIT / HOOK: bobber ── */}
        {(phase === 'wait' || phase === 'hook') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <div className="relative" style={{ height: 130, width: 80 }}>
              {/* line from above */}
              <div className="absolute left-1/2" style={{ top: 0, width: 2, height: bobberDip ? 84 : 62, marginLeft: -1, background: 'rgba(226,232,240,0.7)', transition: reduced ? undefined : 'height 0.1s' }} />

              {/* concentric surface ripples (idle life) */}
              {phase === 'wait' && !reduced && [0, 1, 2].map(i => (
                <div key={i} className="absolute left-1/2" style={{
                  top: 82, marginLeft: -7, width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(186,230,253,0.5)',
                  animation: `gfRipple 2.4s ease-out ${i * 0.8}s infinite`,
                }} />
              ))}

              {/* hook strike — a bright ring snaps outward */}
              {phase === 'hook' && !reduced && (
                <div className="absolute left-1/2" style={{ top: 86, marginLeft: -10, width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(253,224,71,0.9)', animation: 'gfStrike 0.5s ease-out infinite' }} />
              )}

              {/* bobber */}
              <div className="absolute left-1/2" style={{
                top: bobberDip ? 80 : 60, marginLeft: -9, width: 18, height: 22,
                transition: reduced ? undefined : 'top 0.1s cubic-bezier(0.5,0,0.9,0.4)',
                animation: phase === 'wait' && !reduced ? 'gfBob 1.6s ease-in-out infinite' : undefined,
              }}>
                <div style={{ width: 18, height: 11, background: '#EF4444', borderRadius: '4px 4px 0 0', border: '2px solid #991B1B' }} />
                <div style={{ width: 18, height: 11, background: '#FFFFFF', borderRadius: '0 0 4px 4px', border: '2px solid #991B1B', borderTop: 'none' }} />
                <div style={{ position: 'absolute', top: 2, left: 3, width: 4, height: 3, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
              </div>
            </div>

            {phase === 'wait' && (
              <div className="flex flex-col items-center gap-1">
                <p className="font-pixel" style={{ fontSize: 9, color: '#BAE6FD', letterSpacing: 2 }}>WAIT FOR A BITE…</p>
                {castMsg && <p className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>{castMsg}</p>}
              </div>
            )}
            {phase === 'hook' && (
              <div className="relative flex flex-col items-center gap-1" style={{ animation: reduced ? undefined : 'gfHookPop 0.2s ease-out' }}>
                <p className="font-pixel" style={{ fontSize: 18, color: '#FDE047', letterSpacing: 3, textShadow: '2px 2px 0 #0C2A3E, 0 0 14px rgba(253,224,71,0.9)', animation: reduced ? undefined : 'gfTapPulse 0.36s ease-in-out infinite' }}>TAP!</p>
                <p className="font-pixel" style={{ fontSize: 6, color: '#BAE6FD', letterSpacing: 1 }}>HOOK IT</p>
              </div>
            )}
          </div>
        )}

        {/* ── REEL: fight the fish — steer the bracket over it ── */}
        {phase === 'reel' && (() => {
          const strain = holding && !inside   // over-reeling: the line is under tension
          const rail = inside ? '#34D399' : strain ? '#FB7185' : '#38BDF8'
          return (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-stretch justify-center gap-4">
              {/* vertical water column with the hooked fish */}
              <div className="relative" style={{
                width: 78, height: 330, borderRadius: 12, overflow: 'hidden',
                border: `3px solid ${rail}`,
                background: 'linear-gradient(180deg, rgba(14,60,92,0.75) 0%, rgba(4,22,36,0.9) 100%)',
                boxShadow: inside
                  ? 'inset 0 0 22px rgba(52,211,153,0.4), 0 0 18px rgba(52,211,153,0.45)'
                  : strain
                    ? 'inset 0 0 22px rgba(251,113,133,0.32), 0 0 14px rgba(251,113,133,0.4)'
                    : 'inset 0 0 22px rgba(0,0,0,0.55)',
                transition: reduced ? undefined : 'border-color 0.1s, box-shadow 0.12s',
              }}>
                {/* depth ticks */}
                {[0.2, 0.4, 0.6, 0.8].map(t => (
                  <div key={t} className="absolute inset-x-0" style={{ top: `${t * 100}%`, height: 1, background: 'rgba(186,230,253,0.08)' }} />
                ))}

                {/* taut line running from the rod tip down to the hooked fish */}
                <div className="absolute" style={{
                  left: '50%', top: 0, marginLeft: -1, width: 2, height: `${fishY * 100}%`,
                  background: strain
                    ? 'linear-gradient(180deg, rgba(251,113,133,0.35), rgba(251,113,133,0.85))'
                    : 'linear-gradient(180deg, rgba(226,232,240,0.25), rgba(226,232,240,0.7))',
                }} />

                {/* catch bracket (the zone you steer) */}
                <div className="absolute left-1 right-1" style={{
                  top: `${barY * 100}%`, height: `${barHRef.current * 100}%`,
                  background: inside
                    ? 'linear-gradient(180deg, rgba(110,231,183,0.55), rgba(16,185,129,0.28))'
                    : 'linear-gradient(180deg, rgba(253,224,71,0.5), rgba(251,191,36,0.26))',
                  border: `2px solid ${inside ? '#6EE7B7' : '#FDE047'}`, borderRadius: 6,
                  boxShadow: inside ? '0 0 16px rgba(52,211,153,0.7)' : '0 0 10px rgba(253,224,71,0.4)',
                  transition: reduced ? undefined : 'background 0.1s, border-color 0.1s, box-shadow 0.1s',
                }}>
                  {/* clamp caps top & bottom so it reads as a grip */}
                  <div className="absolute" style={{ left: -2, right: -2, top: -3, height: 3, background: inside ? '#6EE7B7' : '#FDE047', borderRadius: 2 }} />
                  <div className="absolute" style={{ left: -2, right: -2, bottom: -3, height: 3, background: inside ? '#6EE7B7' : '#FDE047', borderRadius: 2 }} />
                  <div className="absolute inset-x-1" style={{ top: '50%', height: 1, background: 'rgba(255,255,255,0.28)' }} />
                </div>

                {/* the fish — swims, glows when bracketed */}
                <div className="absolute left-1/2" style={{
                  top: `${fishY * 100}%`, marginLeft: -17, marginTop: -17, transform: 'scaleX(-1)',
                  filter: inside ? 'drop-shadow(0 0 7px rgba(110,231,183,0.95))' : undefined,
                  transition: reduced ? undefined : 'filter 0.1s',
                }}>
                  <FishSprite s={speciesRef.current} size={34} swim={!reduced} />
                </div>
              </div>

              {/* landing meter */}
              <div className="relative" style={{ width: 22, height: 330, background: 'rgba(3,20,34,0.7)', border: '2px solid #0EA5E9', borderRadius: 7, overflow: 'hidden', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)' }}>
                <div className="absolute inset-x-0 bottom-0" style={{
                  height: `${progress * 100}%`,
                  background: progress > 0.6 ? 'linear-gradient(180deg, #6EE7B7, #16A34A)' : progress > 0.3 ? 'linear-gradient(180deg, #FDE047, #F59E0B)' : 'linear-gradient(180deg, #FB7185, #E11D48)',
                  transition: reduced ? undefined : 'height 0.08s linear',
                  boxShadow: progress > 0.85 ? '0 0 12px rgba(110,231,183,0.85)' : undefined,
                }} />
                {[0.2, 0.4, 0.6, 0.8].map(t => (
                  <div key={t} className="absolute inset-x-0" style={{ bottom: `${t * 100}%`, height: 1, background: 'rgba(3,20,34,0.8)' }} />
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1">
              <p className="font-pixel" style={{ fontSize: 9, color: holding ? '#FDE047' : '#BAE6FD', letterSpacing: 2 }}>HOLD TO REEL</p>
              <p className="font-pixel" style={{ fontSize: 5, color: inside ? '#6EE7B7' : strain ? '#FCA5A5' : '#7DD3FC', letterSpacing: 1 }}>
                {inside ? 'ON THE LINE — KEEP IT!' : strain ? "EASY — DON'T SNAP THE LINE" : 'KEEP THE FISH IN THE BRACKET'}
              </p>
            </div>
          </div>
          )
        })()}

        {/* ── MISSED ── */}
        {phase === 'missed' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-pixel" style={{ fontSize: 12, color: '#FCA5A5', letterSpacing: 2, textShadow: '2px 2px 0 #0C2A3E', animation: reduced ? undefined : 'gfHookPop 0.25s ease-out' }}>{missMsg}</p>
          </div>
        )}

        {/* ── CAUGHT celebration ── */}
        {phase === 'caught' && caught && (
          <CatchCelebration
            s={caught.s}
            name={caught.s.name}
            value={caught.s.value}
            rarityColor={RARITY_COLOR[caught.s.rarity]}
            rarityLabel={RARITY_LABEL[caught.s.rarity]}
            tier={caught.s.rarity === 'legendary' ? 'legendary' : isRarePlus(caught.s.rarity) ? 'rarePlus' : 'normal'}
            isNew={caught.isNew}
            reduced={reduced}
          />
        )}
      </div>

      {/* Idle modal + fish-dex */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="px-5 py-5 flex flex-col items-center gap-3"
            style={{ background: 'rgba(4,28,44,0.95)', border: '3px solid #38BDF8', borderRadius: 8, boxShadow: '0 4px 0 #075985, 0 0 30px rgba(56,189,248,0.5)', maxWidth: 340 }}>
            <p className="font-pixel" style={{ fontSize: 12, letterSpacing: 2, color: '#BAE6FD', filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.5))' }}>GONE FISHIN&apos;</p>
            <div className="font-pixel text-center" style={{ fontSize: 6, color: '#7DD3FC', letterSpacing: 1, lineHeight: 1.9 }}>
              <p>CAST · WAIT · HOOK · REEL</p>
              <p style={{ color: '#FDE68A' }}>EACH CAST SPENDS A BAIT</p>
            </div>
            {/* dex grid */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-pixel" style={{ fontSize: 6, color: '#7DD3FC', letterSpacing: 1 }}>FISH-DEX</span>
                <span className="font-pixel" style={{ fontSize: 6, color: '#BAE6FD' }}>{caughtCount}/{SPECIES.length}</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {SPECIES.map(s => {
                  const have = dex.includes(s.id)
                  return (
                    <div key={s.id} className="flex items-center justify-center" style={{
                      width: 40, height: 32,
                      background: have ? 'rgba(56,189,248,0.12)' : 'rgba(0,0,0,0.35)',
                      border: `1.5px solid ${have ? RARITY_COLOR[s.rarity] : 'rgba(125,211,252,0.18)'}`,
                      borderRadius: 4,
                    }}>
                      {have
                        ? <FishSprite s={s} size={26} />
                        : <span className="font-pixel" style={{ fontSize: 12, color: 'rgba(125,211,252,0.35)' }}>?</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)', border: '2px solid #075985', borderRadius: 3, boxShadow: '0 4px 0 #075985', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5 }}>
              <IconFish size={12} /> CAST OFF
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(3,16,28,0.72)', backdropFilter: 'blur(2px)' }}>
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{
              background: 'linear-gradient(180deg, #0B2A3E 0%, #07202F 100%)',
              border: '3px solid #0284C7', borderRadius: 6,
              boxShadow: '0 6px 0 #075985, 0 0 30px rgba(2,132,199,0.5)',
              animation: reduced ? undefined : 'gfPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 2 }}>OUT OF BAIT</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#A7F3D0', letterSpacing: 1 }}>SCORE</span>
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{score}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#1F4D63' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#1F4D63' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#7DD3FC', letterSpacing: 1 }}>DEX</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#BAE6FD' }}>{caughtCount}/{SPECIES.length}</span>
              </div>
            </div>
            {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => { playSound('ui_tap'); startGame() }}
                className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)', border: '2px solid #075985', borderRadius: 3, boxShadow: '0 4px 0 #075985', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
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
        @keyframes gfPop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes gfHookPop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes gfPulse { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
        @keyframes gfBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
        @keyframes gfNudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes gfTapPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.14); } }
        @keyframes gfRipple { 0% { transform: scale(0.5); opacity: 0.7; } 100% { transform: scale(2.7); opacity: 0; } }
        @keyframes gfStrike { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.3); opacity: 0; } }
        /* sprite tail flick (swim) */
        @keyframes gfFin { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-10deg); } }
        /* atmosphere */
        @keyframes gfRay { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes gfCaustic { 0% { background-position: 0 0; } 100% { background-position: 0 24px; } }
        @keyframes gfBubble {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          14% { opacity: 0.85; }
          85% { opacity: 0.7; }
          100% { transform: translate(var(--drift, 0), -76vh) scale(1); opacity: 0; }
        }
        /* catch celebration */
        @keyframes gfDrop { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx,0), var(--dy,0)) scale(0.3); opacity: 0; } }
        @keyframes gfSplashRing { 0% { transform: scale(0.3); opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes gfTwinkle { 0%, 100% { transform: scale(0.4); opacity: 0; } 50% { transform: scale(1.1); opacity: 1; } }
        @keyframes gfFlash { 0% { opacity: 0; } 22% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes gfShimmer { 0% { transform: translateX(-120%); } 60%, 100% { transform: translateX(120%); } }
        @keyframes gfLeap { 0% { transform: translateY(42px) scale(0.55); opacity: 0; } 60% { transform: translateY(-6px) scale(1.06); } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes gfValuePop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.25); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
      {/* keep imports referenced */}
      <span style={{ display: 'none' }}><IconStar size={1} /></span>
    </div>
  )
}
