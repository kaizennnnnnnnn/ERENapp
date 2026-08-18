'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useErenIdle } from '@/hooks/useErenIdle'
import GameCoinReward from '@/components/games/GameCoinReward'
import TreatTumbleWorld, { GROUND_H, FLOOR_OFFSET } from '@/components/games/TreatTumbleScenery'
import TreatTumbleEren, { type TumblePose } from '@/components/games/TreatTumbleEren'
import {
  ITEMS, pickKind, fallDriftX, type ItemKind,
  KibbleIcon, CookieIcon, MilkIcon, CreamIcon, SpiderIcon, BombIcon, KnifeIcon, TrapIcon, SkullIcon,
} from '@/components/games/TreatTumbleItems'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { IconMeat, IconFish, IconHeart, IconStar, IconCrown } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { fireMinigameDone } from '@/lib/minigames'

// ── Config ───────────────────────────────────────────────────────────────────
const GAME_DURATION = 45
const START_LIVES   = 3
const MAX_LIVES     = 5
const START_SPAWN_MS = 760
const MIN_SPAWN_MS   = 170
const SPAWN_RAMP_PER_SEC = 24
const ITEM_BASE_SPEED = 175
const ITEM_SPEED_PER_SEC = 12
const EREN_WIDTH  = 72
const ITEM_SIZE   = 34
/** Eren's feet, measured from the bottom of the screen. Puts him on the rug. */
const EREN_BOTTOM = GROUND_H - 34

// ── Combo ────────────────────────────────────────────────────────────────────
// The multiplier used to be invisible below x2, so five catches in a row felt
// like nothing at all and breaking a streak you never knew you had felt like a
// bug. It is on screen from the first catch now.
const TIER_2 = 5
const TIER_3 = 10
const PIPS = 5
/** At x3 Eren's reach widens by this much each side. The streak buys a real
 *  mechanical advantage, not just a bigger number — and the ring that appears
 *  around him is the honest drawing of it. */
const CATCH_BONUS = 15

const multFor = (combo: number) => (combo >= TIER_3 ? 3 : combo >= TIER_2 ? 2 : 1)
/** How far from Eren's centre an item's centre can be and still be caught.
 *  The loop and the ring that advertises it both read this, so the drawing
 *  cannot drift away from the hitbox it is claiming to show. */
const reachFor = (mult: number) => EREN_WIDTH / 2 + ITEM_SIZE / 2 - 4 + (mult === 3 ? CATCH_BONUS : 0)

// ── Treat rain ───────────────────────────────────────────────────────────────
// Two goods-only windows per round. A 45-second ramp with no shape to it is
// just a line going up; this gives the round two peaks to play toward and two
// moments where building a streak is actually possible.
const RAIN_STARTS = [13, 30]
const RAIN_LEN = 3.4
const RAIN_SPAWN_SCALE = 0.55

interface FallingItem {
  id: number
  /** Spawn column. Drift is an offset from this, never a walk, so a swaying
   *  item can't wander off the edge over a long fall. */
  bx: number
  x: number
  y: number
  kind: ItemKind
  phase: number
  t0: number
  /** 0→1, how close to the floor. Drives the landing shadow. */
  prox: number
}

interface FloatText { id: number; x: number; y: number; text: string; color: string; t0: number }
interface Particle { id: number; x: number; y: number; dx: number; dy: number; color: string; t0: number; size: number }
interface Shard { id: number; x: number; y: number; dx: number; dy: number; t0: number }
interface Puff { id: number; x: number; y: number; t0: number }

const MemoIconHeart = memo(IconHeart)
const MemoIconStar = memo(IconStar)
const MemoIconMeat = memo(IconMeat)

// ── Component ────────────────────────────────────────────────────────────────
export default function TreatTumbleGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

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
  const [scoreBump, setScoreBump] = useState<0 | 1 | -1>(0)
  const [erenPop, setErenPop] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const [shards, setShards] = useState<Shard[]>([])
  const [puffs, setPuffs] = useState<Puff[]>([])
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [comboFlash, setComboFlash] = useState(0)
  const [displayedScore, setDisplayedScore] = useState(0)
  const [reward, setReward] = useState<GameRewardResult | null>(null)
  // Eren's state — driven by the loop, but only written when it actually
  // changes, so a 60fps loop doesn't cause 60 pose re-renders a second.
  const [pose, setPose] = useState<TumblePose>('ready')
  const [look, setLook] = useState(0)
  const [dir, setDir] = useState(0)
  const [raining, setRaining] = useState(false)

  const erenIdle = useErenIdle(gameState === 'running')

  const itemsRef = useRef<FallingItem[]>([])
  const itemId  = useRef(0)
  const floatId = useRef(0)
  const particleId = useRef(0)
  const shardId = useRef(0)
  const puffId = useRef(0)
  const lastSpawn = useRef(0)
  const lastTick  = useRef(0)
  const rafId = useRef<number | null>(null)
  const dragging = useRef(false)
  const erenXRef = useRef(50)
  const livesRef = useRef(START_LIVES)
  const comboRef = useRef(0)
  const gameStartRef = useRef(0)
  const pausedRef = useRef(false)
  const hideAtRef = useRef(0)
  const loopRef = useRef<((t: number) => void) | null>(null)
  const poseRef = useRef<TumblePose>('ready')
  const poseHoldRef = useRef(0)
  const lookRef = useRef(0)
  const dirRef = useRef(0)
  const moveUntilRef = useRef(0)
  const rainRef = useRef(false)

  // ── Start ──────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    timers.clearAll()
    setScore(0)
    setLives(START_LIVES)
    livesRef.current = START_LIVES
    setTimeLeft(GAME_DURATION)
    itemsRef.current = []
    setItems([])
    setFloats([])
    setParticles([])
    setShards([])
    setPuffs([])
    setCombo(0)
    comboRef.current = 0
    setBestCombo(0)
    setComboFlash(0)
    setDisplayedScore(0)
    setReward(null)
    setErenX(50)
    erenXRef.current = 50
    setSavedOnce(false)
    setGameState('running')
    lastSpawn.current = 0
    lastTick.current = 0
    gameStartRef.current = performance.now()
    pausedRef.current = false
    hideAtRef.current = 0
    setPose('ready'); poseRef.current = 'ready'; poseHoldRef.current = 0
    setLook(0); lookRef.current = 0
    setDir(0); dirRef.current = 0
    moveUntilRef.current = 0
    setRaining(false); rainRef.current = false
  }, [timers])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'running') return
    const id = timers.setInterval(() => {
      // Freeze the countdown while backgrounded — pairs with the rAF pause so
      // a tab-switch doesn't silently drain the clock.
      if (document.hidden) return
      setTimeLeft(t => {
        if (t <= 1) {
          timers.clearInterval(id)
          setGameState('finished')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => timers.clearInterval(id)
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Round-end jingle when the overlay appears (covers both timeout & 0 HP) ──
  useEffect(() => {
    if (gameState === 'finished') playSound('tt_round_end')
  }, [gameState])

  // ── Count-up tween on final score when overlay opens ───────────────────────
  useEffect(() => {
    if (gameState !== 'finished') return
    const target = Math.max(0, score)
    setDisplayedScore(0)
    const startedAt = performance.now()
    const DURATION = 600
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - startedAt) / DURATION)
      const eased = 1 - Math.pow(1 - p, 3)   // ease-out cubic
      setDisplayedScore(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gameState, score])

  // ── End-of-game save ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'finished' || savedOnce || !user?.id) return
    setSavedOnce(true)
    setReward(reportGameResult({ gameType: 'treat_tumble', score: Math.max(0, score) }))
    ;(async () => {
      fireMinigameDone('treat_tumble', Math.max(0, score))
      await applyAction(user.id, 'play')
      completeTask('daily_game')
      if (score >= 30) completeTask('weekly_high_score')
    })()
  }, [gameState, savedOnce, user?.id, score]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Transient resets ──────────────────────────────────────────────────────
  useEffect(() => {
    if (scoreBump === 0) return
    const id = timers.setTimeout(() => setScoreBump(0), 280)
    return () => timers.clearTimeout(id)
  }, [scoreBump]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!erenPop) return
    const id = timers.setTimeout(() => setErenPop(false), 140)
    return () => timers.clearTimeout(id)
  }, [erenPop]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (comboFlash === 0) return
    const id = timers.setTimeout(() => setComboFlash(0), 380)
    return () => timers.clearTimeout(id)
  }, [comboFlash]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'running') return

    function loop(t: number) {
      const rect = sceneRef.current?.getBoundingClientRect()
      if (!rect) { rafId.current = requestAnimationFrame(loop); return }

      // Clamp per-frame dt so a long frame (or a resume hiccup) can't teleport
      // items across the catch zone in a single step.
      const rawElapsed = lastTick.current === 0 ? 16 : (t - lastTick.current)
      const elapsed = Math.min(50, rawElapsed)
      lastTick.current = t
      const gameElapsedSec = (t - gameStartRef.current) / 1000
      const speed = ITEM_BASE_SPEED + ITEM_SPEED_PER_SEC * gameElapsedSec

      // Treat rain — goods only, spawning roughly twice as fast.
      const isRaining = RAIN_STARTS.some(s => gameElapsedSec >= s && gameElapsedSec < s + RAIN_LEN)
      if (isRaining !== rainRef.current) {
        rainRef.current = isRaining
        setRaining(isRaining)
        if (isRaining) playSound('tt_combo_up')
      }
      const spawnInterval = Math.max(MIN_SPAWN_MS, START_SPAWN_MS - SPAWN_RAMP_PER_SEC * gameElapsedSec)
        * (isRaining ? RAIN_SPAWN_SCALE : 1)

      // Live items for this frame: the ref is the source of truth (state lags
      // because the loop closes over a stale `items`). Everything below is
      // computed SYNCHRONOUSLY so the score/life deltas are populated before
      // the side-effects read them — the loop owns the array, not a deferred
      // setItems updater.
      let working = itemsRef.current

      // Spawn. The margin accounts for the kind's sway amplitude, so a drifting
      // item is placed where its whole arc stays on screen.
      if (t - lastSpawn.current > spawnInterval) {
        lastSpawn.current = t
        const kind = pickKind(isRaining)
        const meta = ITEMS[kind]
        const margin = 12 + ITEM_SIZE / 2 + meta.amp
        const span = Math.max(1, rect.width - margin * 2)
        const bx = margin + Math.random() * span
        working = [...working, {
          id: itemId.current++,
          bx, x: bx, y: -ITEM_SIZE,
          kind,
          phase: Math.random() * Math.PI * 2,
          t0: t,
          prox: 0,
        }]
      }

      const erenCX = (erenXRef.current / 100) * rect.width
      const catchY = rect.height - 108
      const groundY = rect.height - FLOOR_OFFSET
      const mult = multFor(comboRef.current)
      const reach = reachFor(mult)

      let dLives = 0
      let dScore = 0
      let comboDelta = 0   // +N good catches; -1 means the streak broke
      let hadDanger = false
      let hadGolden = false
      let hadHeart = false
      let hadGoodCatch = false
      const newFloats: FloatText[] = []
      const newParticles: Particle[] = []
      const newPuffs: Puff[] = []
      const updated: FallingItem[] = []

      for (const it of working) {
        const meta = ITEMS[it.kind]
        const ny = it.y + speed * meta.speed * (elapsed / 1000)
        const nx = it.bx + fallDriftX(meta, it.phase, (t - it.t0) / 1000)

        const dx = Math.abs(nx - erenCX)
        if (ny >= catchY && ny <= catchY + ITEM_SIZE + 18 && dx <= reach) {
          const isGood = !meta.danger && (meta.points > 0 || meta.life > 0)
          let pointsAwarded = meta.points
          if (meta.points > 0 && mult > 1) pointsAwarded = meta.points * mult
          dScore += pointsAwarded
          if (meta.life !== 0) dLives += meta.life
          if (meta.danger) { hadDanger = true; comboDelta = -1 }
          else {
            hadGoodCatch = true
            if (it.kind === 'golden') hadGolden = true
            if (it.kind === 'heart') hadHeart = true
            if (meta.points > 0) comboDelta = comboDelta < 0 ? comboDelta : comboDelta + 1
          }

          newFloats.push({
            id: floatId.current++,
            x: nx, y: catchY - 10,
            text: pointsAwarded > 0
              ? (mult > 1 ? `+${pointsAwarded} x${mult}` : `+${pointsAwarded}`)
              : pointsAwarded < 0 ? `${pointsAwarded}` : meta.life > 0 ? '+LIFE' : '',
            color: pointsAwarded > 0 ? (mult > 1 ? '#FBBF24' : '#FDE68A') : pointsAwarded < 0 ? '#FCA5A5' : '#FF6B9D',
            t0: t,
          })

          if (isGood && !reduced) {
            const count = it.kind === 'golden' ? 9 : 6
            for (let i = 0; i < count; i++) {
              const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4
              const speedP = 38 + Math.random() * 26
              newParticles.push({
                id: particleId.current++,
                x: nx, y: catchY,
                dx: Math.cos(ang) * speedP,
                dy: Math.sin(ang) * speedP - 18,
                color: meta.tint,
                size: it.kind === 'golden' ? 4 : 3,
                t0: t,
              })
            }
          }
          continue
        }

        // Missed a good treat. It costs the points and nothing else.
        //
        // It used to cost a silent -1 AND the streak. Both were wrong. The -1
        // was invisible next to a small grey puff, so a score that ticked down
        // on its own read as a bug. And breaking the streak on a miss made the
        // streak unwinnable by construction: past about second 25 the spawn
        // rate puts treats in two columns at once, so "miss nothing" is asking
        // the player to be in two places. Getting hit is a mistake. Failing to
        // reach something unreachable is not.
        if (ny >= groundY) {
          if (!meta.danger && (meta.points > 0 || meta.life > 0)) {
            newPuffs.push({ id: puffId.current++, x: nx, y: groundY, t0: t })
          }
          continue
        }

        if (ny > rect.height + 10) continue
        updated.push({ ...it, x: nx, y: ny, prox: Math.min(1, Math.max(0, ny / groundY)) })
      }

      itemsRef.current = updated
      setItems(updated)

      // ── Side-effects (fired once per frame, OUTSIDE the pure updater) ───────
      if (dScore !== 0) {
        setScore(s => Math.max(0, s + dScore))
        setScoreBump(dScore > 0 ? 1 : -1)
      }
      if (dLives !== 0) {
        const before = livesRef.current
        const newLives = Math.max(0, Math.min(MAX_LIVES, before + dLives))
        livesRef.current = newLives
        setLives(newLives)
        if (dLives < 0 && !reduced) {
          setShake(true)
          setHurtFlash(true)
          timers.setTimeout(() => setShake(false), 280)
          timers.setTimeout(() => setHurtFlash(false), 220)
          // Shards fly out of the heart slot that just went dark.
          const shardSlotIndex = Math.max(0, before - 1)
          const shardOriginX = rect.width - 84 + shardSlotIndex * 20
          const burstShards: Shard[] = []
          for (let i = 0; i < 4; i++) {
            const ang = -Math.PI / 2 + (i - 1.5) * 0.55 + (Math.random() - 0.5) * 0.3
            const v = 60 + Math.random() * 30
            burstShards.push({
              id: shardId.current++,
              x: shardOriginX, y: 110,
              dx: Math.cos(ang) * v,
              dy: Math.sin(ang) * v,
              t0: t,
            })
          }
          setShards(prev => [...prev, ...burstShards].slice(-40))
        }
        if (newLives === 0) setGameState('finished')
      }

      if (comboDelta !== 0) {
        if (comboDelta < 0) {
          comboRef.current = 0
          setCombo(0)
        } else {
          const prevC = comboRef.current
          const next = prevC + comboDelta
          comboRef.current = next
          setCombo(next)
          setBestCombo(b => Math.max(b, next))
          const nextMult = multFor(next)
          if (nextMult > multFor(prevC)) {
            playSound('tt_combo_up')
            setComboFlash(nextMult)
          }
        }
      }

      if (hadGoodCatch) setErenPop(true)
      if (hadGolden) playSound('tt_catch_golden')
      else if (hadHeart) playSound('tt_catch_heart')
      else if (hadGoodCatch) playSound('tt_catch_good')
      if (hadDanger) playSound('tt_hit_danger')

      // ── Eren ────────────────────────────────────────────────────────────────
      // A deliberate pose holds for a beat so a catch is still readable at the
      // speeds this reaches; after that he falls back to run / hype / ready.
      let nextPose: TumblePose
      if (hadDanger) { poseHoldRef.current = t + 520; nextPose = 'hurt' }
      else if (hadGoodCatch) { poseHoldRef.current = t + 240; nextPose = 'nom' }
      else if (t < poseHoldRef.current) nextPose = poseRef.current
      else if (t < moveUntilRef.current) nextPose = 'run'
      else nextPose = comboRef.current >= TIER_3 ? 'hype' : 'ready'
      if (nextPose !== poseRef.current) { poseRef.current = nextPose; setPose(nextPose) }
      if (dirRef.current !== 0 && t >= moveUntilRef.current) { dirRef.current = 0; setDir(0) }

      // Eyes track the nearest treat worth having. Cheapest of the six poses
      // and the one that reads most as alive — you catch him looking before
      // you catch him moving.
      let nearest = Infinity
      for (const it of updated) {
        if (ITEMS[it.kind].danger) continue
        const d = it.x - erenCX
        if (Math.abs(d) < Math.abs(nearest)) nearest = d
      }
      const nextLook = !Number.isFinite(nearest) || Math.abs(nearest) < 26 ? 0 : nearest > 0 ? 1 : -1
      if (nextLook !== lookRef.current) { lookRef.current = nextLook; setLook(nextLook) }

      if (newFloats.length > 0) setFloats(prev => [...prev, ...newFloats].slice(-22))
      if (newParticles.length > 0) setParticles(prev => [...prev, ...newParticles].slice(-80))
      if (newPuffs.length > 0) setPuffs(prev => [...prev, ...newPuffs].slice(-20))

      if (gameState === 'running' && !pausedRef.current) {
        rafId.current = requestAnimationFrame(loop)
      }
    }

    loopRef.current = loop
    if (!pausedRef.current) rafId.current = requestAnimationFrame(loop)
    return () => {
      loopRef.current = null
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [gameState, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause on hidden ────────────────────────────────────────────────────────
  // Backgrounding cancels the rAF and records when we left, so the frame clock
  // and wall-clock anchors can be rebased on return. Without this, items
  // teleport across the catch zone and the difficulty ramp spikes on resume.
  const handleHide = useCallback(() => {
    if (gameState !== 'running' || pausedRef.current) return
    pausedRef.current = true
    hideAtRef.current = performance.now()
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [gameState])

  const handleShow = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    const now = performance.now()
    const gap = now - hideAtRef.current
    gameStartRef.current += gap
    if (lastSpawn.current !== 0) lastSpawn.current += gap
    lastTick.current = now
    if (gameState === 'running' && loopRef.current) {
      rafId.current = requestAnimationFrame(loopRef.current)
    }
  }, [gameState])

  useVisibilityPause(handleHide, handleShow)

  // ── Cull expired ephemera ─────────────────────────────────────────────────
  useEffect(() => {
    if (floats.length === 0) return
    const id = setTimeout(() => setFloats(prev => prev.filter(f => performance.now() - f.t0 < 900)), 700)
    return () => clearTimeout(id)
  }, [floats])
  useEffect(() => {
    if (particles.length === 0) return
    const id = setTimeout(() => setParticles(prev => prev.filter(p => performance.now() - p.t0 < 480)), 320)
    return () => clearTimeout(id)
  }, [particles])
  useEffect(() => {
    if (shards.length === 0) return
    const id = setTimeout(() => setShards(prev => prev.filter(s => performance.now() - s.t0 < 700)), 500)
    return () => clearTimeout(id)
  }, [shards])
  useEffect(() => {
    if (puffs.length === 0) return
    const id = setTimeout(() => setPuffs(prev => prev.filter(p => performance.now() - p.t0 < 520)), 380)
    return () => clearTimeout(id)
  }, [puffs])

  // ── Drag / touch input ────────────────────────────────────────────────────
  function updatePos(clientX: number) {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100))
    const delta = pct - erenXRef.current
    // A dead zone here matters: without it, one-pixel jitter on a held finger
    // flips the lean back and forth and he vibrates instead of running.
    if (Math.abs(delta) > 0.35) {
      const d = delta > 0 ? 1 : -1
      moveUntilRef.current = performance.now() + 150
      if (dirRef.current !== d) { dirRef.current = d; setDir(d) }
    }
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
  const mult = multFor(combo)
  const tierFloor = mult === 3 ? TIER_3 : mult === 2 ? TIER_2 : 0
  const tierCeil  = mult === 3 ? TIER_3 : mult === 2 ? TIER_3 : TIER_2
  const pipsLit = mult === 3
    ? PIPS
    : Math.min(PIPS, Math.round(((combo - tierFloor) / (tierCeil - tierFloor)) * PIPS))

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none game-shell"
      style={{
        background: '#FCD34D',
        touchAction: 'none',
        animation: shake ? 'ttSceneShake 0.28s linear' : 'none',
      }}
      ref={sceneRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}>

      <TreatTumbleWorld reduced={reduced} />

      {/* Warm wash over the whole garden while it's raining treats. */}
      {raining && (
        <div className="absolute inset-0 pointer-events-none z-10" style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(253,224,71,0.42) 0%, rgba(251,191,36,0.16) 45%, transparent 75%)',
        }} />
      )}

      {/* Red hurt flash */}
      {hurtFlash && (
        <div className="absolute inset-0 pointer-events-none z-40" style={{
          background: 'radial-gradient(circle at center, rgba(220,38,38,0.35) 0%, rgba(220,38,38,0.08) 55%, transparent 80%)',
          animation: 'ttHurtFade 0.22s ease-out forwards',
        }} />
      )}

      {/* Header */}
      <div className="absolute top-0 inset-x-0 pt-3 px-3 z-30 flex items-center gap-2">
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.9)', borderRadius: 6, border: '2px solid #D97706', boxShadow: '0 2px 0 #B45309' }}>
          <ChevronLeft size={18} className="text-amber-700" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="font-pixel text-amber-900 px-3 py-1.5 inline-flex items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.92)', border: '2px solid #D97706', borderRadius: 4, boxShadow: '0 2px 0 #B45309', fontSize: 7, letterSpacing: 1.5 }}>
            <MemoIconMeat size={12} />
            TREAT TUMBLE
          </span>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* ══ HUD ═════════════════════════════════════════════════════════════ */}
      {gameState !== 'idle' && (
        <div className="absolute top-14 inset-x-0 px-3 z-20">
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
                <MemoIconStar size={14} />
                <span className="font-pixel" style={{ fontSize: 6, color: '#FCD34D', letterSpacing: 2 }}>SCORE</span>
                <span className="font-pixel" style={{
                  fontSize: 16,
                  color: scoreBump === -1 ? '#FCA5A5' : '#FFFFFF',
                  textShadow: scoreBump === -1
                    ? '2px 2px 0 #7F1D1D, 0 0 6px rgba(220,38,38,0.85)'
                    : '2px 2px 0 #92400E, 0 0 6px rgba(251,191,36,0.7)',
                  letterSpacing: 1,
                  transform: scoreBump === 1 ? 'scale(1.22)' : scoreBump === -1 ? 'scale(0.88)' : 'scale(1)',
                  transition: 'transform 0.16s cubic-bezier(0.34,1.56,0.64,1), color 0.18s, text-shadow 0.18s',
                  display: 'inline-block',
                  animation: scoreBump === -1 ? 'ttScoreShake 0.26s linear' : 'none',
                }}>{Math.max(0, score)}</span>
              </div>

              {/* Lives */}
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
                      animation: i < lives && lowLives && gameState === 'running' && !reduced ? 'ttHeartBeat 0.55s ease-in-out infinite' : 'none',
                    }}>
                      <MemoIconHeart size={18} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Combo strip — on screen from the first catch, so breaking a
                streak is something you watch happen rather than deduce. */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1.5, color: '#FCD34D' }}>COMBO</span>
              <div className="flex-1 flex items-center gap-[3px]">
                {Array.from({ length: PIPS }).map((_, i) => {
                  const lit = i < pipsLit
                  return (
                    <div key={i} style={{
                      flex: 1, height: 5,
                      background: lit
                        ? (mult === 3 ? 'linear-gradient(180deg,#FEF3C7,#F59E0B)' : 'linear-gradient(180deg,#FDE68A,#D97706)')
                        : 'rgba(0,0,0,0.45)',
                      border: '1px solid rgba(245,158,11,0.45)',
                      borderRadius: 1,
                      boxShadow: lit ? '0 0 5px rgba(251,191,36,0.8)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                      transition: 'background 0.16s, box-shadow 0.16s',
                    }} />
                  )
                })}
              </div>
              <span className="font-pixel px-1.5 py-0.5" style={{
                fontSize: 7, minWidth: 30, textAlign: 'center',
                color: mult > 1 ? '#451A03' : '#FCD34D',
                background: mult > 1 ? 'linear-gradient(180deg, #FDE68A, #F59E0B)' : 'rgba(0,0,0,0.4)',
                border: `2px solid ${mult > 1 ? '#7C2D12' : 'rgba(245,158,11,0.45)'}`,
                borderRadius: 3,
                boxShadow: mult > 1 ? '0 2px 0 #5A1A0A, 0 0 6px rgba(251,191,36,0.7)' : 'none',
                letterSpacing: 1,
                transform: comboFlash ? 'scale(1.3)' : 'scale(1)',
                transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                display: 'inline-block',
              }}>{mult > 1 ? `x${mult}` : combo}</span>
            </div>

            {/* Time */}
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
                animation: timeWarning && gameState === 'running' && !reduced ? 'ttTimerPulse 0.6s ease-in-out infinite' : 'none',
              }}>{String(Math.floor(timeLeft / 60))}:{String(timeLeft % 60).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TREAT RAIN banner ───────────────────────────────────────────────── */}
      {raining && (
        <div className="absolute inset-x-0 z-30 flex justify-center pointer-events-none" style={{ top: '34%' }}>
          <div className="font-pixel px-4 py-2.5 inline-flex items-center gap-2" style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)',
            border: '3px solid #7C2D12',
            borderRadius: 5,
            boxShadow: '0 5px 0 #5A1A0A, 0 0 26px rgba(251,191,36,0.85)',
            fontSize: 10, letterSpacing: 2.5, color: '#7C2D12',
            textShadow: '0 1px 0 rgba(255,255,255,0.7)',
            animation: reduced ? 'none' : 'ttRainBanner 3.4s ease-out both',
          }}>
            <IconStar size={14} />
            TREAT RAIN
            <IconStar size={14} />
          </div>
        </div>
      )}

      {/* ── Idle intro ──────────────────────────────────────────────────────── */}
      {/* pointer-events-none on the root so this full-screen z-30 overlay doesn't
          swallow taps on the same-z header back button; START re-enables them. */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start z-30 px-4 pt-12 pb-6 overflow-y-auto pointer-events-none">
          <div className="relative px-5 py-5 w-full max-w-[340px] z-10" style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)',
            border: '3px solid #7C2D12',
            borderRadius: 8,
            boxShadow: '0 8px 0 #5A1A0A, 0 0 28px rgba(251,191,36,0.55), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(120,53,15,0.3)',
            overflow: 'hidden',
          }}>
            {/* Gold rivets at all 4 corners */}
            <div style={{ position: 'absolute', top: 6, left: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
            <div style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
            <div style={{ position: 'absolute', bottom: 6, left: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
            <div style={{ position: 'absolute', bottom: 6, right: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />

            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.55) 50%, transparent 62%)',
              animation: reduced ? 'none' : 'ttPlaqueShine 3.6s ease-in-out infinite',
            }} />

            <div className="flex items-center justify-center gap-2 mb-2 relative">
              <div style={{ animation: reduced ? 'none' : 'twinkle 1.5s ease-in-out infinite', filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.7))' }}>
                <IconStar size={16} />
              </div>
              <p className="font-pixel" style={{
                fontSize: 12, letterSpacing: 3, color: '#7C2D12',
                textShadow: '0 1px 0 rgba(255,255,255,0.7), 0 2px 0 rgba(120,53,15,0.4)',
              }}>TREAT TUMBLE</p>
              <div style={{ animation: reduced ? 'none' : 'twinkle 1.5s ease-in-out 0.75s infinite', filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.7))' }}>
                <IconStar size={16} />
              </div>
            </div>

            <div className="mb-3 mx-auto" style={{
              width: '85%', height: 2,
              background: 'linear-gradient(90deg, transparent, #B45309, #FBBF24, #B45309, transparent)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.5)',
            }} />

            <p className="font-pixel text-center mb-3" style={{
              fontSize: 6, lineHeight: 1.9, letterSpacing: 1, color: '#7C2D12',
            }}>
              DRAG TO MOVE EREN<br/>
              CATCH TREATS · DODGE DANGERS<br/>
              GET HIT AND THE STREAK ENDS<br/>
              <span style={{ color: '#B45309' }}>5 IN A ROW = x2 · 10 = x3</span><br/>
              <span style={{ color: '#15803D' }}>AT x3 EREN REACHES FURTHER</span><br/>
              <span style={{ color: '#B91C1C', fontSize: 5 }}>IT GETS FASTER EVERY SECOND</span>
            </p>

            {/* GOODS */}
            <div className="mb-2.5 relative px-2 pt-2 pb-2.5" style={{
              background: 'linear-gradient(180deg, rgba(187,247,208,0.6) 0%, rgba(134,239,172,0.4) 100%)',
              border: '2px solid #15803D',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 0 rgba(21,128,61,0.35)',
            }}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <IconStar size={10} />
                <p className="font-pixel" style={{ fontSize: 7, letterSpacing: 2.5, color: '#14532D', textShadow: '0 1px 0 rgba(255,255,255,0.6)' }}>GOODS</p>
                <IconStar size={10} />
              </div>
              <div className="grid grid-cols-7 gap-1">
                <LegendTile Icon={KibbleIcon} tint="#F5C842" pts="+1" />
                <LegendTile Icon={CookieIcon} tint="#A06030" pts="+2" />
                <LegendTile Icon={MilkIcon}   tint="#FFFFFF" pts="+2" />
                <LegendTile Icon={IconFish}   tint="#6BAED6" pts="+3" />
                <LegendTile Icon={CreamIcon}  tint="#A78BFA" pts="+5" />
                <LegendTile Icon={IconStar}   tint="#FFD700" pts="+10" />
                <LegendTile Icon={IconHeart}  tint="#FF6B9D" pts="LIFE" />
              </div>
              <p className="font-pixel text-center mt-2" style={{ fontSize: 5, letterSpacing: 1, color: '#14532D' }}>
                FISH AND STARS DRIFT — LEAD THEM
              </p>
            </div>

            {/* DANGERS */}
            <div className="relative px-2 pt-2 pb-2.5" style={{
              background: 'linear-gradient(180deg, rgba(254,202,202,0.6) 0%, rgba(248,113,113,0.4) 100%)',
              border: '2px solid #B91C1C',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 0 rgba(185,28,28,0.35)',
            }}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <SkullIcon size={11} />
                <p className="font-pixel" style={{ fontSize: 7, letterSpacing: 2.5, color: '#7F1D1D', textShadow: '0 1px 0 rgba(255,255,255,0.6)' }}>DANGERS</p>
                <SkullIcon size={11} />
              </div>
              <div className="grid grid-cols-5 gap-1">
                <LegendTile Icon={TrapIcon}   tint="#7C2D12" pts="-5" danger />
                <LegendTile Icon={KnifeIcon}  tint="#9CA3AF" pts="-5" danger />
                <LegendTile Icon={SpiderIcon} tint="#4B0082" pts="-5" danger />
                <LegendTile Icon={BombIcon}   tint="#DC2626" pts="-6" danger />
                <LegendTile Icon={SkullIcon}  tint="#E5E7EB" pts="-8" danger />
              </div>
              <p className="font-pixel text-center mt-2" style={{ fontSize: 5, letterSpacing: 1, color: '#7F1D1D' }}>
                BOXED IN RED · THE KNIFE COMES FAST
              </p>
            </div>
          </div>

          <button onClick={() => { playSound('ui_tap'); start() }}
            className="relative mt-5 px-8 py-3 text-white active:translate-y-[2px] transition-transform z-10 overflow-hidden pointer-events-auto"
            style={{
              background: 'linear-gradient(180deg, #F59E0B 0%, #D97706 50%, #B45309 100%)',
              border: '3px solid #7C2D12',
              borderRadius: 4,
              boxShadow: '0 6px 0 #5A1A0A, inset 0 2px 0 rgba(255,255,255,0.4), 0 0 22px rgba(251,191,36,0.65)',
              fontFamily: '"Press Start 2P"', fontSize: 11, letterSpacing: 2,
              textShadow: '0 2px 0 #5A1A0A',
            }}>
            START
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%)',
              animation: reduced ? 'none' : 'ttPlaqueShine 2.4s ease-in-out infinite',
            }} />
          </button>
        </div>
      )}

      {/* ── Landing shadows ── the one addition that helps you aim without
            looking up. A shadow on the rug tells you where a treat is going to
            land while the treat itself is still near the top of the screen. */}
      {gameState !== 'idle' && items.map(it => (
        <div key={`sh-${it.id}`} className="absolute pointer-events-none z-[5]" style={{
          left: it.x, bottom: FLOOR_OFFSET - 6,
          width: 10 + it.prox * 20,
          height: 4 + it.prox * 3,
          marginLeft: -(10 + it.prox * 20) / 2,
          borderRadius: '50%',
          background: ITEMS[it.kind].danger ? '#4A0F0F' : '#0F2A14',
          opacity: 0.18 + it.prox * 0.58,
        }} />
      ))}

      {/* ── Falling items ── goods drift free with a warm halo; dangers are
            boxed in a dark red-bordered plate and tumble end over end. The
            shape and the spin do the telling, so five red auras don't have to
            fight each other and the artwork underneath. */}
      {gameState !== 'idle' && items.map(it => {
        const meta = ITEMS[it.kind]
        return (
          <div key={it.id} className="absolute pointer-events-none z-10"
            style={{
              left: it.x - ITEM_SIZE / 2,
              top: it.y - ITEM_SIZE / 2,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              animation: reduced
                ? 'none'
                : meta.danger
                  ? 'ttTumble 1.1s linear infinite'
                  : 'ttItemSpin 1.4s ease-in-out infinite',
            }}>
            {meta.danger && (
              <div style={{
                position: 'absolute', inset: -3,
                background: 'rgba(28,12,12,0.82)',
                border: '2px solid #EF4444',
                borderRadius: 3,
                boxShadow: '0 0 9px rgba(239,68,68,0.7), inset 0 0 6px rgba(0,0,0,0.6)',
              }} />
            )}
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              filter: meta.danger
                ? 'drop-shadow(0 2px 0 rgba(0,0,0,0.4))'
                : `drop-shadow(0 3px 0 rgba(0,0,0,0.22)) drop-shadow(0 0 7px ${meta.tint}66)`,
            }}>
              <meta.Icon size={ITEM_SIZE} />
            </div>
          </div>
        )
      })}

      {/* ── Particle bursts (positive catches) ──────────────────────────────── */}
      {particles.map(p => (
        <div key={p.id} className="absolute pointer-events-none z-30" style={{
          left: p.x, top: p.y,
          width: p.size, height: p.size,
          background: p.color,
          boxShadow: `0 0 4px ${p.color}`,
          imageRendering: 'pixelated',
          ['--dx' as string]: `${p.dx}px`,
          ['--dy' as string]: `${p.dy}px`,
          animation: 'ttParticle 420ms cubic-bezier(0.22,1,0.36,1) forwards',
        } as React.CSSProperties} />
      ))}

      {/* ── Heart shards when a life is lost ────────────────────────────────── */}
      {shards.map(s => (
        <div key={s.id} className="absolute pointer-events-none z-40" style={{
          left: s.x, top: s.y,
          width: 4, height: 4,
          background: '#DC2626',
          boxShadow: '0 0 3px #FCA5A5',
          imageRendering: 'pixelated',
          ['--dx' as string]: `${s.dx}px`,
          ['--dy' as string]: `${s.dy}px`,
          animation: 'ttShard 650ms cubic-bezier(0.34,1.06,0.64,1) forwards',
        } as React.CSSProperties} />
      ))}

      {/* ── Smoke puffs for missed treats ───────────────────────────────────── */}
      {puffs.map(p => (
        <div key={p.id} className="absolute pointer-events-none z-20" style={{
          left: p.x - 8, top: p.y - 6,
          width: 16, height: 12,
          animation: 'ttPuff 500ms ease-out forwards',
        }}>
          <div style={{ position: 'absolute', left: 2, top: 4, width: 4, height: 4, background: 'rgba(180,180,180,0.85)', boxShadow: '0 0 3px rgba(200,200,200,0.6)' }} />
          <div style={{ position: 'absolute', left: 8, top: 2, width: 4, height: 4, background: 'rgba(210,210,210,0.85)', boxShadow: '0 0 3px rgba(220,220,220,0.6)' }} />
          <div style={{ position: 'absolute', left: 5, top: 7, width: 3, height: 3, background: 'rgba(160,160,160,0.8)' }} />
        </div>
      ))}

      {/* ── Eren ────────────────────────────────────────────────────────────── */}
      {gameState !== 'idle' && (
        <div className="absolute pointer-events-none z-20"
          style={{
            left: `${erenX}%`,
            bottom: EREN_BOTTOM,
            transform: 'translateX(-50%)',
            transition: dragging.current ? 'none' : 'left 0.08s ease-out',
            filter: hurtFlash
              ? 'drop-shadow(0 0 10px rgba(220,38,38,1)) drop-shadow(0 0 16px rgba(220,38,38,0.6))'
              : 'drop-shadow(0 5px 0 rgba(0,0,0,0.22)) drop-shadow(0 0 8px rgba(255,255,255,0.22))',
            animation: reduced || pose === 'run' ? 'none' : 'ttErenBob 0.7s ease-in-out infinite',
          }}>
          {/* Floating HP above his head — your eyes are on Eren, not the HUD. */}
          <div className="flex items-center justify-center gap-0.5 mb-1"
            style={{
              padding: '2px 5px',
              background: 'rgba(0,0,0,0.55)',
              border: lowLives ? '2px solid #FCA5A5' : '2px solid rgba(255,255,255,0.45)',
              borderRadius: 3,
              boxShadow: lowLives ? '0 1px 0 rgba(0,0,0,0.45), 0 0 6px rgba(248,113,113,0.7)' : '0 1px 0 rgba(0,0,0,0.45)',
              animation: lowLives && !reduced ? 'ttHeartBeat 0.5s ease-in-out infinite' : 'none',
            }}>
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <div key={i} style={{
                opacity: i < lives ? 1 : 0.15,
                transform: i < lives ? 'scale(1)' : 'scale(0.7)',
                transition: 'opacity 0.25s, transform 0.25s',
              }}>
                <MemoIconHeart size={10} />
              </div>
            ))}
          </div>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* At x3 the catch really is wider — this ring is that number,
                drawn, so the reward reads as a power and not as luck. */}
            {mult === 3 && gameState === 'running' && (
              <div className="absolute pointer-events-none" style={{
                left: '50%', top: 14,
                width: reachFor(3) * 2, height: 48,
                marginLeft: -reachFor(3),
                borderRadius: 999,
                border: '2px solid rgba(253,224,71,0.85)',
                boxShadow: '0 0 14px rgba(251,191,36,0.7), inset 0 0 12px rgba(253,230,138,0.4)',
                animation: reduced ? 'none' : 'ttReachPulse 1.1s ease-in-out infinite',
              }} />
            )}
            <div style={{
              display: 'inline-block',
              transformOrigin: '50% 100%',
              animation: erenPop ? 'ttErenChomp 140ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            }}>
              <TreatTumbleEren
                pose={lives === 0 ? 'sad' : pose}
                dir={dir}
                look={look}
                size={EREN_WIDTH}
                blink={erenIdle.blink}
                twitch={erenIdle.twitch}
                reduced={reduced}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Float texts ─────────────────────────────────────────────────────── */}
      {floats.map(f => (
        <div key={f.id} className="absolute z-30 pointer-events-none font-pixel" style={{
          left: f.x, top: f.y, transform: 'translateX(-50%)',
          color: f.color, fontSize: 13, letterSpacing: 1,
          textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
          animation: 'ttFloatUp 0.95s ease-out forwards',
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
              {lives > 0 ? (
                <IconCrown size={28} />
              ) : (
                <div style={{ animation: reduced ? 'none' : 'ttSadBob 1.8s ease-in-out infinite' }}>
                  <TreatTumbleEren pose="sad" size={52} reduced={reduced} />
                </div>
              )}
            </div>
            <p className="font-pixel text-amber-800 mb-1" style={{ fontSize: 9, letterSpacing: 2 }}>
              {lives > 0 ? 'TIME UP' : 'GAME OVER'}
            </p>
            <p className="font-pixel text-amber-900 mb-4" style={{
              fontSize: 28,
              textShadow: '2px 2px 0 rgba(180,83,9,0.35)',
              display: 'inline-block',
            }}>
              {displayedScore}
            </p>
            {bestCombo >= TIER_2 && (
              <p className="font-pixel mb-2" style={{ fontSize: 6, color: '#7C2D12', letterSpacing: 2 }}>
                BEST STREAK {bestCombo} — REACHED x{multFor(bestCombo)}
              </p>
            )}
            {reward && (
              <div className="mb-4">
                <GameCoinReward coins={reward.coins} blocked={reward.blocked} />
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={() => { playSound('ui_tap'); start() }}
                className="flex items-center gap-1.5 px-4 py-2 text-white active:translate-y-[2px] transition-transform"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '2px solid #B45309', borderRadius: 3, boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                <RefreshCw size={12} />
                AGAIN
              </button>
              <button onClick={() => { playSound('ui_back'); router.back() }}
                className="px-4 py-2 text-amber-900 active:translate-y-[2px] transition-transform"
                style={{ background: 'rgba(255,255,255,0.9)', border: '2px solid #D97706', borderRadius: 3, boxShadow: '0 3px 0 #B45309', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                BACK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small legend tile used in intro ─────────────────────────────────────────
function LegendTile({ Icon, tint, pts, danger }: { Icon: React.FC<{ size?: number }>, tint: string, pts: string, danger?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1.5 px-1 relative"
      style={{
        background: danger
          ? 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(254,202,202,0.35))'
          : 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.25))',
        border: `1.5px solid ${danger ? '#B91C1C' : tint}`,
        borderRadius: 4,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 0 rgba(0,0,0,0.18)',
      }}>
      <Icon size={20} />
      <span className="font-pixel" style={{
        fontSize: pts.length > 3 ? 4 : 6,
        color: danger ? '#7F1D1D' : '#7C2D12',
        letterSpacing: 0.5,
        textShadow: '0 1px 0 rgba(255,255,255,0.5)',
      }}>{pts}</span>
    </div>
  )
}
