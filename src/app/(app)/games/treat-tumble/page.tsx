'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useCat } from '@/hooks/useCat'
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
import { IconFish, IconHeart, IconStar } from '@/components/PixelIcons'
import {
  GameTopBar, GameStatRow, GameStat, GAME_STAT_URGENT, GameStartCard, GameResultCard,
} from '@/components/games/GameChrome'
import { FONT_ROUNDED, M, MeadowIcon } from '@/components/meadow'
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

// ── Component ────────────────────────────────────────────────────────────────
export default function TreatTumbleGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const cat = useCat()
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

      {/* Header + stats — the shared Meadow game chrome. */}
      <GameTopBar title="Treat Tumble" onBack={() => { playSound('ui_back'); router.back() }} />

      {gameState !== 'idle' && (
        <GameStatRow>
          {/* Score — pops up on a gain, shrinks red and shakes on a loss. */}
          <GameStat
            icon={<MemoIconStar size={16} />}
            value={Math.max(0, score)}
            tone={scoreBump === -1 ? 'warn' : 'plain'}
            ariaLabel={`Score ${Math.max(0, score)}`}
            style={{
              transform: scoreBump === 1 ? 'scale(1.12)' : scoreBump === -1 ? 'scale(0.92)' : 'scale(1)',
              transition: 'transform 0.16s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease, color 0.18s ease',
              animation: scoreBump === -1 ? 'ttScoreShake 0.26s linear' : undefined,
            }}
          />

          {/* Combo — on screen from the first catch, so breaking a streak is
              something you watch happen rather than deduce. */}
          <GameStat
            value={
              <span className="inline-flex items-center" style={{ gap: 6 }}>
                <span aria-hidden className="inline-flex items-center" style={{ gap: 2 }}>
                  {Array.from({ length: PIPS }).map((_, i) => (
                    <span key={i} style={{
                      width: 5, height: 14, borderRadius: 2,
                      background: i < pipsLit ? (mult === 3 ? '#E08A1E' : M.energy) : M.softLip,
                      transition: 'background 0.16s',
                    }} />
                  ))}
                </span>
                {mult > 1 ? `×${mult}` : combo}
              </span>
            }
            tone={mult > 1 ? 'hot' : 'plain'}
            pulse={comboFlash}
            ariaLabel={`Combo ${combo}, times ${mult}`}
          />

          <GameStat
            icon={<MeadowIcon name="clock" size={18} />}
            value={`${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
            tone={timeWarning ? 'warn' : 'plain'}
            style={timeWarning && gameState === 'running' && !reduced ? GAME_STAT_URGENT : undefined}
          />

          {/* Lives — right-most, where the heart shards burst from. */}
          <GameStat
            icon={
              <span style={{
                display: 'inline-flex',
                animation: lowLives && gameState === 'running' && !reduced ? 'ttHeartBeat 0.55s ease-in-out infinite' : undefined,
              }}>
                <MemoIconHeart size={16} />
              </span>
            }
            value={lives}
            tone={lowLives ? 'warn' : 'plain'}
            ariaLabel={`Lives ${lives} of ${MAX_LIVES}`}
          />
        </GameStatRow>
      )}

      {/* ── TREAT RAIN banner ───────────────────────────────────────────────── */}
      {raining && (
        <div className="absolute inset-x-0 z-30 flex justify-center pointer-events-none" style={{ top: '34%' }}>
          <div className="px-4 py-2.5 inline-flex items-center gap-2" style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)',
            border: '3px solid #7C2D12',
            borderRadius: 5,
            boxShadow: '0 5px 0 #5A1A0A, 0 0 26px rgba(251,191,36,0.85)',
            fontFamily: FONT_ROUNDED, fontWeight: 800, fontSize: 18, letterSpacing: 0.3, color: '#7C2D12',
            textShadow: '0 1px 0 rgba(255,255,255,0.7)',
            animation: reduced ? 'none' : 'ttRainBanner 3.4s ease-out both',
          }}>
            <IconStar size={14} />
            Treat rain!
            <IconStar size={14} />
          </div>
        </div>
      )}

      {/* ── Idle intro ──────────────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <GameStartCard
          title="Treat Tumble"
          art={<TreatTumbleEren pose="ready" size={56} reduced={reduced} />}
          extra={
            <div className="flex flex-col" style={{ gap: 8 }}>
              <LegendGroup title="Catch" caption="Fish and stars drift, so lead them." tint={M.leafTint} ink={M.leafInk} cols={7}>
                <LegendTile Icon={KibbleIcon} pts="+1" ink={M.leafInk} />
                <LegendTile Icon={CookieIcon} pts="+2" ink={M.leafInk} />
                <LegendTile Icon={MilkIcon}   pts="+2" ink={M.leafInk} />
                <LegendTile Icon={IconFish}   pts="+3" ink={M.leafInk} />
                <LegendTile Icon={CreamIcon}  pts="+5" ink={M.leafInk} />
                <LegendTile Icon={IconStar}   pts="+10" ink={M.leafInk} />
                <LegendTile Icon={IconHeart}  pts="Life" ink={M.leafInk} />
              </LegendGroup>
              <LegendGroup title="Dodge" caption="Boxed in red. The knife comes fast." tint={M.dangerTint} ink={M.danger} cols={5}>
                <LegendTile Icon={TrapIcon}   pts="-5" ink={M.danger} />
                <LegendTile Icon={KnifeIcon}  pts="-5" ink={M.danger} />
                <LegendTile Icon={SpiderIcon} pts="-5" ink={M.danger} />
                <LegendTile Icon={BombIcon}   pts="-6" ink={M.danger} />
                <LegendTile Icon={SkullIcon}  pts="-8" ink={M.danger} />
              </LegendGroup>
            </div>
          }
          onStart={() => { playSound('ui_tap'); start() }}
        >
          {cat.t('Drag to move {name}. Catch the treats and dodge the dangers; getting hit ends your streak.')}{' '}
          {cat.t('5 in a row is ×2, 10 is ×3, and at ×3 {name} reaches further. It gets faster every second.')}
        </GameStartCard>
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
        <GameResultCard
          headline={lives > 0 ? "Time's up" : 'Game over'}
          score={displayedScore}
          stats={[
            { label: 'Best streak', value: bestCombo },
            { label: 'Top bonus', value: `×${multFor(bestCombo)}` },
            { label: 'Lives left', value: lives },
          ]}
          reward={reward && <GameCoinReward coins={reward.coins} blocked={reward.blocked} />}
          onAgain={() => { playSound('ui_tap'); start() }}
          onBack={() => { playSound('ui_back'); router.back() }}
        >
          {lives === 0 && (
            <div className="flex items-center justify-center" style={{
              gap: 10, padding: '8px 12px', borderRadius: 16, background: M.soft,
            }}>
              <div style={{ animation: reduced ? 'none' : 'ttSadBob 1.8s ease-in-out infinite' }}>
                <TreatTumbleEren pose="sad" size={44} reduced={reduced} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: M.text2, textAlign: 'left' }}>
                {cat.t('{name} took one hit too many.')}
              </p>
            </div>
          )}
        </GameResultCard>
      )}
    </div>
  )
}

// ── Legend used in the start card ───────────────────────────────────────────
function LegendGroup({ title, caption, tint, ink, cols, children }: {
  title: string
  caption: string
  tint: string
  ink: string
  cols: number
  children: React.ReactNode
}) {
  return (
    <div style={{ padding: '8px 8px 7px', borderRadius: 16, background: tint }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: ink }}>{title}</p>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 4 }}>
        {children}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: M.text2 }}>{caption}</p>
    </div>
  )
}

function LegendTile({ Icon, pts, ink }: { Icon: React.FC<{ size?: number }>, pts: string, ink: string }) {
  return (
    <div className="flex flex-col items-center" style={{
      gap: 2, padding: '5px 0 4px', borderRadius: 10, background: '#FFFFFF',
    }}>
      <Icon size={20} />
      <span style={{ fontSize: 11, fontWeight: 800, color: ink, fontVariantNumeric: 'tabular-nums' }}>{pts}</span>
    </div>
  )
}
