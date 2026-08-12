'use client'

import { memo, useEffect, useReducer, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import GameCoinReward from '@/components/games/GameCoinReward'
import ErenRunner, {
  RUN_FRAME_COUNT, RUN_BOX_W, RUN_BOX_H, RUN_BODY_CX, isRunContact,
} from '@/components/games/ErenRunner'
import {
  ZONES, ZONE_EVERY, ZoneSky, ZoneRoad, ZoneGutters, ItemArt,
  HAZARDS, PICKUP_VALUE, HAZARD_SIZE, PICKUP_SIZE, isObstacle,
  type Variant, type Hazard, type Pickup,
} from '@/components/games/LaneRunnerWorld'
import { choosePattern, patternSpan, isPatternSafe } from '@/lib/laneRunnerPatterns'
import { playSound } from '@/lib/sounds'
import { IconCoin, IconStar } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'

const LANES = 3
const SPEED_BASE = 270
const SPEED_RAMP = 14    // px/s² → speed += 14 per second elapsed
const SPEED_MAX = 620
const PLAYER_BOTTOM = 90  // distance from ground line
const ITEM_SIZE = 46          // spawn offset / cleanup margin
/** Hitbox reach, deliberately DECOUPLED from the drawn size. Hazards render
 *  bigger than they used to so they read at speed; feeding that into collision
 *  would have silently made the game harder. This is the old 46/2 + 10, so the
 *  difficulty is byte-for-byte what it was. */
const HIT_SPAN = 33
/** Where the horizon sits — the road starts here. */
const HORIZON = '18%'

const sizeOf = (v: Variant) => (isObstacle(v) ? HAZARD_SIZE : PICKUP_SIZE)
const SPEED_TIERS = [400, 500, SPEED_MAX]
const STRIDE_PX = 34          // ground covered per frame of Eren's run cycle
const STRIDE_SPEED_CAP = 480  // past this his legs would just blur, so cadence stops ramping

interface Item {
  id: number
  lane: 0 | 1 | 2
  y: number
  variant: Variant
  collected?: boolean
  passed?: boolean       // crossed the player row — used for near-miss detection
}

interface Popup {
  id: number
  x: number
  y: number
  text: string
  color: string
  born: number
}

interface Sparkle {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  color: string
  born: number
}

interface SpeedStreak {
  id: number
  side: 'l' | 'r'
  y: number
  vy: number
  life: number
  born: number
}

let _iid = 0
const newId = () => ++_iid

export default function LaneRunnerGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const reduced = useReducedMotion()

  // The rAF loop is self-perpetuating and captures `reduced` from the render
  // that started the run; mirror it into a ref so spawn-time guards stay live.
  const reducedRef = useRef(reduced)
  useEffect(() => { reducedRef.current = reduced }, [reduced])

  const fieldRef = useRef<HTMLDivElement>(null)
  const [fieldDims, setFieldDims] = useState({ w: 360, h: 600 })
  // Mirror dims into a ref — the rAF loop is self-perpetuating and captures
  // fieldDims from the render that started the run, so a resize / rotation /
  // mobile URL-bar collapse would drift the player's collision row (computed
  // from height) away from the CSS bottom-anchored sprite. laneToX reads it
  // too so the lane X mapping stays consistent between loop and render.
  const fieldDimsRef = useRef({ w: 360, h: 600 })

  useEffect(() => {
    function measure() {
      const r = fieldRef.current?.getBoundingClientRect()
      if (r && r.width && r.height) {
        fieldDimsRef.current = { w: r.width, h: r.height }
        setFieldDims({ w: r.width, h: r.height })
      }
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
  const [streak, setStreak] = useState(0)
  const [scorePulse, setScorePulse] = useState(0)
  const [hitFlash, setHitFlash] = useState(0)
  const [shaking, setShaking] = useState(false)
  // Which stretch of the world we're running through. Derived from score so
  // the crossfade is automatic; the banner announces the crossing.
  const [zoneBanner, setZoneBanner] = useState<{ id: number; name: string } | null>(null)
  const zoneIdxRef = useRef(0)
  const [gameOverScore, setGameOverScore] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const [reward, setReward] = useState<GameRewardResult | null>(null)
  // Transient lean into a lane change. `key` restarts the animation on every
  // juke; null means he's simply running straight.
  const [bank, setBank] = useState<{ dir: -1 | 1; key: number } | null>(null)

  const stateRef       = useRef<'idle' | 'running' | 'gameover'>('idle')
  const itemsRef       = useRef<Item[]>([])
  const speedRef       = useRef(SPEED_BASE)
  /** Pixels of road left to travel before the next pattern is due. */
  const spawnCursorRef = useRef(0)
  const lastFrameRef   = useRef(0)
  const startTimeRef   = useRef(0)
  const stripeRef      = useRef(0)
  const rafRef         = useRef<number>(0)
  const distanceRef    = useRef(0)
  const coinsRef       = useRef(0)
  const laneRef        = useRef<0 | 1 | 2>(1)
  const savedRef       = useRef(false)
  const streakRef      = useRef(0)
  const lastScoreRef   = useRef(0)
  const popupsRef      = useRef<Popup[]>([])
  const sparklesRef    = useRef<Sparkle[]>([])
  const streaksRef     = useRef<SpeedStreak[]>([])
  const lastStreakSpawnRef = useRef(0)
  const speedTierRef   = useRef(0)
  const bestRef        = useRef(0)
  const popupIdRef     = useRef(0)
  const sparkleIdRef   = useRef(0)
  const streakIdRef    = useRef(0)
  const pausedRef      = useRef(false)
  const hideAtRef      = useRef(0)
  const strideRef      = useRef(0)
  const runFrameRef    = useRef(0)
  const bankKeyRef     = useRef(0)

  const [, force] = useReducer((n: number) => n + 1, 0)

  // Keep bestRef in sync so endGame can detect new-best without stale state
  useEffect(() => { bestRef.current = bestScore }, [bestScore])

  // Load persisted best from localStorage on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('lr_best')
      if (stored) {
        const n = parseInt(stored, 10)
        if (!isNaN(n) && n > 0) { setBest(n); bestRef.current = n }
      }
    } catch { /* ignore */ }
  }, [])

  function spawnPopup(x: number, y: number, text: string, color: string) {
    popupsRef.current.push({
      id: ++popupIdRef.current,
      x, y, text, color,
      born: performance.now(),
    })
  }

  function spawnSparkles(x: number, y: number, color: string, count = 5) {
    const now = performance.now()
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4
      const speed = 60 + Math.random() * 50
      sparklesRef.current.push({
        id: ++sparkleIdRef.current,
        x, y,
        dx: Math.cos(ang) * speed,
        dy: Math.sin(ang) * speed,
        color,
        born: now,
      })
    }
  }

  // Grit kicked off the road by a landing paw. Reuses the sparkle pool, but
  // thrown down-screen rather than radially so it reads as ground rushing past.
  function spawnDust(x: number, y: number) {
    const now = performance.now()
    for (let i = 0; i < 2; i++) {
      sparklesRef.current.push({
        id: ++sparkleIdRef.current,
        x: x + Math.random() * 20 - 10,
        y,
        dx: Math.random() * 44 - 22,
        dy: 90 + Math.random() * 70,
        color: '#8B94A3',
        born: now,
      })
    }
  }

  function triggerShake() {
    setShaking(true)
    setTimeout(() => setShaking(false), 220)
  }

  function pulseScore() {
    setScorePulse(p => p + 1)
  }

  function laneToX(l: 0 | 1 | 2) {
    return ((l + 0.5) / LANES) * fieldDimsRef.current.w
  }

  /** Gap between one pattern's last row and the next pattern's first, in
   *  PIXELS rather than milliseconds. The old spawner used a time interval,
   *  which quietly meant the road got denser as you sped up — 720ms of travel
   *  at 270px/s is 194px, but 280ms at 620px/s is 173px, and the player reads
   *  distance, not time. Measuring the gap in distance keeps the road's
   *  breathing room honest at every speed. */
  function patternGapPx(difficulty: number): number {
    return 360 - 140 * Math.min(1, Math.max(0, difficulty))
  }

  function spawnPattern() {
    const difficulty = Math.min(1, Math.max(0,
      (speedRef.current - SPEED_BASE) / (SPEED_MAX - SPEED_BASE)))

    const rng = Math.random
    const hazard = (): Hazard => HAZARDS[Math.floor(rng() * HAZARDS.length)]
    const pattern = choosePattern(rng, difficulty)
    const items = pattern.build(rng, hazard)

    // The library is authored to be safe and fuzz-tested, but a shape that
    // somehow has no path through it is an unwinnable death, so it never gets
    // to reach the player: fall back to a bare single hazard.
    const safe = isPatternSafe(items, isObstacle)
      ? items
      : [{ lane: Math.floor(rng() * 3) as 0 | 1 | 2, variant: hazard(), dy: 0 }]

    for (const p of safe) {
      itemsRef.current.push({
        id: newId(),
        lane: p.lane,
        y: -sizeOf(p.variant) - p.dy,
        variant: p.variant,
      })
    }

    spawnCursorRef.current = patternSpan(safe) + patternGapPx(difficulty)
  }

  /** Distance-driven: the cursor counts down the pixels of road left before the
   *  next pattern is due. */
  function spawn(travelled: number) {
    spawnCursorRef.current -= travelled
    if (spawnCursorRef.current > 0) return
    spawnPattern()
  }

  function loop(now: number) {
    if (stateRef.current !== 'running') return
    // Clamped at BOTH ends. The floor is not paranoia: startGame stamps
    // lastFrameRef from performance.now() at the moment of the tap, but the
    // first rAF callback is handed the timestamp of the frame it belongs to,
    // which may have begun BEFORE that tap. That made dt negative on frame one,
    // which drove distance to -0.01, floored the score to -1, and indexed
    // ZONES[-1] — a hard crash into "Application error" about a third of a
    // second after pressing START.
    const dt = Math.max(0, Math.min(0.05, (now - lastFrameRef.current) / 1000))
    lastFrameRef.current = now

    const elapsed = (now - startTimeRef.current) / 1000
    const prevSpeed = speedRef.current
    speedRef.current = Math.min(SPEED_MAX, SPEED_BASE + elapsed * SPEED_RAMP)

    // Speed tier sound — fires when we cross 400 / 500 / SPEED_MAX
    for (let t = speedTierRef.current; t < SPEED_TIERS.length; t++) {
      if (prevSpeed < SPEED_TIERS[t] && speedRef.current >= SPEED_TIERS[t]) {
        playSound('lr_speed_up')
        speedTierRef.current = t + 1
        break
      }
    }

    spawn(speedRef.current * dt)

    // Advance the run cycle off ground covered, not the clock, so his stride
    // rate ramps up exactly as much as the road does.
    strideRef.current += (Math.min(speedRef.current, STRIDE_SPEED_CAP) * dt) / STRIDE_PX
    const runFrame = Math.floor(strideRef.current) % RUN_FRAME_COUNT
    if (runFrame !== runFrameRef.current) {
      runFrameRef.current = runFrame
      if (!reducedRef.current && isRunContact(runFrame)) {
        spawnDust(laneToX(laneRef.current), fieldDimsRef.current.h - PLAYER_BOTTOM + 26)
      }
    }

    // Move items
    for (const it of itemsRef.current) it.y += speedRef.current * dt

    // Scroll lane stripes + parallax skyline
    stripeRef.current = (stripeRef.current + speedRef.current * dt) % 40
    setStripeOffset(stripeRef.current)

    // Spawn speed streaks on the side grass — density scales with speed.
    // Decorative motion; skip entirely when reduced motion is requested.
    const speedRatio = (speedRef.current - SPEED_BASE) / (SPEED_MAX - SPEED_BASE)
    const streakInterval = Math.max(60, 220 - speedRatio * 180)
    if (!reducedRef.current && now - lastStreakSpawnRef.current > streakInterval) {
      lastStreakSpawnRef.current = now
      const side: 'l' | 'r' = Math.random() < 0.5 ? 'l' : 'r'
      streaksRef.current.push({
        id: ++streakIdRef.current,
        side,
        y: -20,
        vy: speedRef.current * 1.4,
        life: 0,
        born: now,
      })
    }
    // Move streaks
    for (const s of streaksRef.current) {
      s.y += s.vy * dt
      s.life += dt
    }
    streaksRef.current = streaksRef.current.filter(s => s.y < fieldDimsRef.current.h + 40 && s.life < 1.5)

    // Move sparkles + popups (lifetime cleanup)
    sparklesRef.current = sparklesRef.current.filter(sp => now - sp.born < 600)
    popupsRef.current = popupsRef.current.filter(p => now - p.born < 800)

    // Update distance
    distanceRef.current += speedRef.current * dt * 0.05  // tuned so 1 unit feels like a meter
    const distScore = Math.floor(distanceRef.current)
    const newScore = distScore + coinsRef.current * 5
    if (newScore !== lastScoreRef.current) {
      // Pulse on every meaningful increment (every 5 points to avoid flutter)
      if (Math.floor(newScore / 5) !== Math.floor(lastScoreRef.current / 5)) {
        pulseScore()
      }
      lastScoreRef.current = newScore
      setScore(newScore)
    }

    // Crossing into a new stretch of the world. Announced, so the change of
    // scenery registers as somewhere you got to rather than as wallpaper.
    // Keyed off distance, not score: coins are worth 5 apiece, so a score-keyed
    // zone would lurch forward every time you grabbed a coin run.
    const zi = Math.floor(distanceRef.current / ZONE_EVERY) % ZONES.length
    if (zi !== zoneIdxRef.current) {
      zoneIdxRef.current = zi
      setZoneBanner({ id: newId(), name: ZONES[zi].name })
      playSound('lr_speed_up')
    }

    // Collision + near-miss check
    const playerY = fieldDimsRef.current.h - PLAYER_BOTTOM
    const playerLane = laneRef.current
    for (const it of itemsRef.current) {
      if (it.collected) continue

      // Near-miss: obstacle in adjacent lane passes player row
      if (
        !it.passed &&
        isObstacle(it.variant) &&
        it.lane !== playerLane &&
        Math.abs(it.lane - playerLane) === 1 &&
        it.y > playerY - HIT_SPAN &&
        it.y < playerY + HIT_SPAN
      ) {
        it.passed = true
        playSound('lr_near_miss')
      }

      if (it.lane !== playerLane) continue
      if (Math.abs(it.y - playerY) > HIT_SPAN) continue
      if (isObstacle(it.variant)) {
        playSound('lr_crash')
        if (!reducedRef.current) {
          triggerShake()
          setHitFlash(f => f + 1)
        }
        // Streak ends on crash
        streakRef.current = 0
        setStreak(0)
        endGame()
        return
      }
      // Pickup
      it.collected = true
      const reward = PICKUP_VALUE[it.variant as Pickup]
      coinsRef.current += reward
      setCoins(coinsRef.current)
      streakRef.current += 1
      setStreak(streakRef.current)
      pulseScore()

      const popupX = laneToX(it.lane)
      const popupY = it.y
      // Each pickup keeps the colour of its own halo, so the burst reads as
      // coming from the thing you grabbed.
      const tint = it.variant === 'fish' ? '#7DD3FC' : it.variant === 'mouse' ? '#C4B5FD' : '#FCD34D'
      playSound(it.variant === 'coin' ? 'lr_coin_pickup' : 'lr_fish_pickup')
      spawnPopup(popupX, popupY, `+${reward}`, tint)
      if (!reducedRef.current) spawnSparkles(popupX, popupY, tint, it.variant === 'coin' ? 5 : 6)
    }

    // Drop offscreen items + collected. Reset streak if an uncollected pickup passes the player.
    const playerRowBelow = fieldDimsRef.current.h - PLAYER_BOTTOM + ITEM_SIZE
    for (const i of itemsRef.current) {
      if (!i.collected && !isObstacle(i.variant) && i.y > playerRowBelow && !i.passed) {
        i.passed = true
        // Missed a pickup — gently reset streak (do not spam if streak was 0)
        if (streakRef.current > 0) {
          streakRef.current = 0
          setStreak(0)
        }
      }
    }
    itemsRef.current = itemsRef.current.filter(i => !i.collected && i.y < fieldDimsRef.current.h + ITEM_SIZE)

    force()
    rafRef.current = requestAnimationFrame(loop)
  }

  function startGame() {
    itemsRef.current = []
    popupsRef.current = []
    sparklesRef.current = []
    streaksRef.current = []
    speedRef.current = SPEED_BASE
    distanceRef.current = 0
    coinsRef.current = 0
    laneRef.current = 1
    savedRef.current = false
    streakRef.current = 0
    lastScoreRef.current = 0
    speedTierRef.current = 0
    strideRef.current = 0
    runFrameRef.current = 0
    setBank(null)
    setLane(1)
    setScore(0)
    setCoins(0)
    setStreak(0)
    setStripeOffset(0)
    zoneIdxRef.current = 0
    setZoneBanner(null)
    setIsNewBest(false)
    setGameOverScore(0)
    setReward(null)
    stripeRef.current = 0

    const now = performance.now()
    startTimeRef.current = now
    lastFrameRef.current = now
    spawnCursorRef.current = 260   // a short run-up before the first shape
    lastStreakSpawnRef.current = now

    stateRef.current = 'running'
    setPhase('running')
    rafRef.current = requestAnimationFrame(loop)
  }

  function endGame() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'gameover'
    setPhase('gameover')
    const finalScore = Math.floor(distanceRef.current) + coinsRef.current * 5
    const prevBest = bestRef.current
    const newBest = Math.max(prevBest, finalScore)
    setBest(newBest)
    bestRef.current = newBest
    setGameOverScore(finalScore)
    const beatBest = finalScore > prevBest && finalScore > 0
    setIsNewBest(beatBest)
    if (beatBest) {
      try { window.localStorage.setItem('lr_best', String(finalScore)) } catch { /* ignore */ }
      // Fire new-best fanfare slightly after the crash sound
      setTimeout(() => playSound('lr_new_best'), 280)
    }
    if (!savedRef.current && user?.id) {
      savedRef.current = true
      setReward(reportGameResult({ gameType: 'lane_runner', score: finalScore }))
      if (finalScore > 0) {
        fireMinigameDone('lane_runner', finalScore)
        completeTask('daily_game')
        if (finalScore >= 200) completeTask('weekly_high_score')
        applyAction(user.id, 'play')
      }
    }
  }

  function reset() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'idle'
    setPhase('idle')
    itemsRef.current = []
    popupsRef.current = []
    sparklesRef.current = []
    streaksRef.current = []
    setScore(0)
    setCoins(0)
    setStreak(0)
    setIsNewBest(false)
  }

  useEffect(() => () => { cancelAnimationFrame(rafRef.current) }, [])

  // Pause on background. A hidden tab would otherwise resume with the wall-clock
  // speed ramp (now - startTimeRef) maxed out and a backlog of spawns. Freeze on
  // hide, rebase the ramp + spawn clocks by the hidden duration on show.
  function handleHide() {
    if (stateRef.current !== 'running') return
    cancelAnimationFrame(rafRef.current)
    pausedRef.current = true
    hideAtRef.current = performance.now()
  }
  function handleShow() {
    if (stateRef.current !== 'running' || !pausedRef.current) return
    pausedRef.current = false
    const now = performance.now()
    const delta = now - hideAtRef.current
    startTimeRef.current       += delta
    lastStreakSpawnRef.current  += delta
    lastFrameRef.current = now
    rafRef.current = requestAnimationFrame(loop)
  }
  useVisibilityPause(handleHide, handleShow)

  // Keep ref in sync with state for collision check + lane bounds
  useEffect(() => { laneRef.current = lane }, [lane])

  // The one way a lane change happens, so swipe and both arrow keys can't drift
  // apart. Writing laneRef here (rather than waiting on the effect above) means
  // the very next collision pass already sees the new lane.
  const changeLaneRef = useRef<(dir: -1 | 1) => void>(() => {})
  function changeLane(dir: -1 | 1) {
    if (stateRef.current !== 'running') return
    const from = laneRef.current
    const to = Math.max(0, Math.min(2, from + dir)) as 0 | 1 | 2
    if (to === from) return
    laneRef.current = to
    setLane(to)
    setBank({ dir, key: ++bankKeyRef.current })
    playSound('lr_lane_swipe')
  }
  useEffect(() => { changeLaneRef.current = changeLane })

  // Touch swipe handling
  const touchStartRef = useRef({ x: 0, y: 0, t: 0 })
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return // tap, not swipe
    if (Math.abs(dx) > Math.abs(dy)) changeLane(dx > 0 ? 1 : -1)
  }

  // Keyboard arrows for desktop
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') changeLaneRef.current(-1)
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') changeLaneRef.current(1)
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
        style={{
          touchAction: 'none',
          transform: shaking ? undefined : 'none',
          animation: shaking ? 'lr-shake 0.22s steps(6, end)' : undefined,
        }}>

        {/* ── World. Four zones crossfade on opacity: kitchen, garden, street,
               rooftops. The hazard roster deliberately does NOT change with
               them — you learn four hazards once and keep that knowledge. ── */}
        <ZoneSky zoneIndex={zoneIdxRef.current} horizon={HORIZON} />

        {/* Horizon line — where the backdrop meets the floor */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: HORIZON, height: 2,
          background: '#000', pointerEvents: 'none', opacity: 0.55,
        }} />

        <ZoneRoad zoneIndex={zoneIdxRef.current} horizon={HORIZON} scrollY={stripeOffset} />
        <ZoneGutters zoneIndex={zoneIdxRef.current} horizon={HORIZON} scrollY={stripeOffset} />

        {/* Speed streaks — pixel lines on side grass that grow denser with speed */}
        {streaksRef.current.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            [s.side === 'l' ? 'left' : 'right']: '1.5%',
            top: s.y,
            width: 3,
            height: 18,
            background: '#FFFFFF',
            opacity: 0.55,
            pointerEvents: 'none',
            imageRendering: 'pixelated',
          } as React.CSSProperties} />
        ))}

        {/* Speed vignette — darkens edges more as you go faster */}
        <div style={{
          position: 'absolute', inset: 0,
          boxShadow: `inset 0 0 ${40 + (speedRef.current - SPEED_BASE) / (SPEED_MAX - SPEED_BASE) * 80}px ${20 + (speedRef.current - SPEED_BASE) / (SPEED_MAX - SPEED_BASE) * 30}px rgba(0,0,0,${0.35 + (speedRef.current - SPEED_BASE) / (SPEED_MAX - SPEED_BASE) * 0.35})`,
          pointerEvents: 'none',
        }} />

        {/* Lane dividers — 2 dashed lines between 3 lanes, scroll downward */}
        {[1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i / LANES) * 100}%`,
            top: HORIZON, bottom: 0, width: 4,
            background: `repeating-linear-gradient(180deg, ${ZONES[zoneIdxRef.current].laneLine} 0 16px, transparent 16px 40px)`,
            transition: 'background 900ms ease',
            backgroundPositionY: `${stripeOffset}px`,
            transform: 'translateX(-50%)',
            opacity: 0.7,
          }} />
        ))}

        {/* Zone banner — names the stretch you just ran into. */}
        {zoneBanner && phase === 'running' && (
          <div className="absolute pointer-events-none" style={{
            top: '22%', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 6,
          }}>
            <div
              key={zoneBanner.id}
              className="font-pixel"
              style={{
                padding: '6px 14px',
                background: 'rgba(0,0,0,0.7)',
                border: `2px solid ${ZONES[zoneIdxRef.current].accent}`,
                borderRadius: 4,
                boxShadow: `0 3px 0 rgba(0,0,0,0.45)`,
                fontSize: 9,
                letterSpacing: 3,
                color: ZONES[zoneIdxRef.current].accent,
                whiteSpace: 'nowrap',
                animation: 'lr-zone-banner 1900ms cubic-bezier(0.22,1,0.36,1) forwards',
              }}
              onAnimationEnd={() => setZoneBanner(null)}>
              {zoneBanner.name}
            </div>
          </div>
        )}

        {/* Score popups (e.g. "+1", "+3") */}
        {popupsRef.current.map(p => {
          const age = (performance.now() - p.born) / 800
          const drift = age * 28
          const opacity = Math.max(0, 1 - age)
          return (
            <div key={p.id} className="absolute pointer-events-none font-pixel"
              style={{
                left: p.x,
                top: p.y - drift,
                transform: 'translate(-50%, -50%)',
                color: p.color,
                fontSize: 10,
                letterSpacing: 1,
                textShadow: '2px 2px 0 #000',
                opacity,
              }}>
              {p.text}
            </div>
          )
        })}

        {/* Sparkle bursts */}
        {sparklesRef.current.map(sp => {
          const age = (performance.now() - sp.born) / 600
          const x = sp.x + sp.dx * age
          const y = sp.y + sp.dy * age
          const opacity = Math.max(0, 1 - age)
          const size = 4 * (1 - age * 0.5)
          return (
            <div key={sp.id} className="absolute pointer-events-none"
              style={{
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                background: sp.color,
                opacity,
                boxShadow: `0 0 0 1px ${sp.color}`,
                imageRendering: 'pixelated',
              }} />
          )
        })}

        {/* Items — obstacles wear a pulsing red hazard aura, pickups a soft
            warm glow + gentle bob, so danger vs. reward reads at a glance. */}
        {itemsRef.current.map(it => (
          <div key={it.id} className="absolute pointer-events-none"
            style={{
              left: laneToX(it.lane) - sizeOf(it.variant) / 2,
              top: it.y - sizeOf(it.variant) / 2,
              width: sizeOf(it.variant), height: sizeOf(it.variant),
            }}>
            <ItemArt variant={it.variant} reduced={reduced} />
          </div>
        ))}

        {/* Eren — back-view gallop. The road runs at the camera, so he runs
            away from it; the contact shadow tightens under each footfall. */}
        {phase !== 'idle' && (
          <>
            <div className="absolute pointer-events-none" style={{
              left: laneToX(lane) - 17,
              bottom: PLAYER_BOTTOM - 36,
              width: 34, height: 8,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
              transform: `scale(${reduced || isRunContact(runFrameRef.current) ? 1 : 0.76})`,
              transition: 'left 0.16s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
            <div className="absolute pointer-events-none" style={{
              left: laneToX(lane) - RUN_BODY_CX,
              bottom: PLAYER_BOTTOM - 32,
              width: RUN_BOX_W, height: RUN_BOX_H,
              transition: 'left 0.16s cubic-bezier(0.34,1.56,0.64,1)',
              filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.45))',
            }}>
              {/* Keyed so each juke restarts the lean. It sits on an inner
                  element because the lane slide lives on the parent, and
                  remounting that would kill the transition mid-flight. */}
              <div key={bank?.key ?? 0} style={{
                width: '100%', height: '100%',
                transformOrigin: 'bottom center',
                animation: bank && !reduced
                  ? `${bank.dir < 0 ? 'lr-bank-l' : 'lr-bank-r'} 0.3s cubic-bezier(0.34,1.56,0.64,1)`
                  : undefined,
              }}>
                <ErenRunner frame={runFrameRef.current} standing={reduced} />
              </div>
            </div>
          </>
        )}

        {/* HUD */}
        {phase !== 'idle' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <span key={scorePulse} className="font-pixel" style={{
              fontSize: 28, color: 'white',
              textShadow: '3px 3px 0 #000', letterSpacing: 2,
              animation: 'lr-score-pulse 0.15s ease-out',
              display: 'inline-block',
            }}>{score}</span>
            <span className="font-pixel mt-1" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1.5 }}>
              {Math.floor(distanceRef.current)}m · ◎ {coins}
            </span>
            {streak >= 3 && (
              <span key={`streak-${streak}`} className="font-pixel mt-1.5 px-2 py-0.5" style={{
                fontSize: 7,
                color: streak >= 8 ? '#FFFFFF' : '#FDE68A',
                letterSpacing: 1.5,
                background: streak >= 8 ? 'linear-gradient(135deg, #DC2626, #F59E0B)' : 'rgba(0,0,0,0.55)',
                border: `2px solid ${streak >= 8 ? '#FBBF24' : '#FCD34D'}`,
                borderRadius: 3,
                boxShadow: `2px 2px 0 rgba(0,0,0,0.4)`,
                animation: 'lr-streak-pop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                x{streak} STREAK
              </span>
            )}
          </div>
        )}

        {/* Hit flash overlay — red wash on crash */}
        {hitFlash > 0 && (
          <div key={`flash-${hitFlash}`} className="absolute inset-0 pointer-events-none" style={{
            background: '#DC2626',
            animation: 'lr-hit-flash 0.22s ease-out forwards',
            mixBlendMode: 'screen',
          }} />
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
                border: `3px solid ${isNewBest ? '#FBBF24' : '#16A34A'}`,
                borderRadius: 6,
                boxShadow: isNewBest
                  ? '0 6px 0 #92400E, 0 0 24px rgba(251,191,36,0.55)'
                  : '0 6px 0 #052e16, 0 0 24px rgba(22,163,74,0.4)',
                animation: 'lr-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>
              <p className="font-pixel" style={{
                fontSize: 11, color: '#FCA5A5', letterSpacing: 3,
                animation: 'lr-shake-text 0.45s steps(8, end)',
              }}>GAME OVER</p>
              {isNewBest && (
                <p className="font-pixel" style={{
                  fontSize: 8, color: '#FBBF24', letterSpacing: 2,
                  textShadow: '2px 2px 0 #92400E',
                  animation: 'lr-new-best-pulse 0.9s ease-in-out infinite',
                }}>* NEW BEST *</p>
              )}
              <div className="flex items-center gap-4 mt-1">
                <div className="flex flex-col items-center">
                  <span className="font-pixel" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>SCORE</span>
                  <CountUp target={gameOverScore} duration={600} style={{
                    fontFamily: '"Press Start 2P"', fontSize: 22, color: '#FFFFFF',
                  }} />
                </div>
                <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
                <div className="flex flex-col items-center">
                  <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}><IconCoin size={8} /> COINS</span>
                  <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{coins}</span>
                </div>
              </div>
              <span className="font-pixel" style={{ fontSize: 6, color: '#9CA3AF', marginTop: 4 }}>BEST {bestScore}</span>
              {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => { playSound('ui_tap'); reset() }}
                  className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #16A34A 0%, #166534 100%)',
                    border: '2px solid #052e16',
                    borderRadius: 3,
                    boxShadow: '0 4px 0 #052e16',
                    fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5,
                  }}>
                  <RefreshCw size={11} /> AGAIN
                </button>
                <button onClick={() => { playSound('ui_back'); router.back() }}
                  className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #475569 0%, #1F2937 100%)',
                    border: '2px solid #0F172A',
                    borderRadius: 3,
                    boxShadow: '0 4px 0 #0F172A',
                    fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5,
                  }}>
                  EXIT
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* Juke — he leans into a lane change and springs back upright. This
           fires on input rather than on a loop, so running straight never
           wobbles; the gait itself lives in the sprite frames. */
        @keyframes lr-bank-l {
          0%   { transform: rotate(0deg)   translateX(0); }
          40%  { transform: rotate(-14deg) translateX(-2px); }
          100% { transform: rotate(0deg)   translateX(0); }
        }
        @keyframes lr-bank-r {
          0%   { transform: rotate(0deg)  translateX(0); }
          40%  { transform: rotate(14deg) translateX(2px); }
          100% { transform: rotate(0deg)  translateX(0); }
        }
        /* Hazard tape under an obstacle. Brightness only — it must not move,
           or it competes with the sprite standing on it. */
        @keyframes lr-hazard-tape {
          0%, 100% { opacity: 0.72; }
          50%      { opacity: 1; }
        }
        /* Pickup treatments — inviting halo + gentle float. The float is the
           tell: pickups hover clear of their shadow, hazards sit on theirs. */
        @keyframes lr-pickup-glow {
          0%, 100% { transform: scale(0.94); opacity: 0.65; }
          50%      { transform: scale(1.1);  opacity: 1; }
        }
        @keyframes lr-pickup-bob {
          0%, 100% { transform: translateY(1px); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes lr-zone-banner {
          0%   { transform: translateY(-24px); opacity: 0; }
          14%  { transform: translateY(0);     opacity: 1; }
          78%  { transform: translateY(0);     opacity: 1; }
          100% { transform: translateY(-10px); opacity: 0; }
        }
        @keyframes lr-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes lr-score-pulse {
          0%   { transform: scale(1);    color: #FFFFFF; }
          50%  { transform: scale(1.18); color: #FCD34D; }
          100% { transform: scale(1);    color: #FFFFFF; }
        }
        @keyframes lr-hit-flash {
          0%   { opacity: 0.7; }
          100% { opacity: 0;   }
        }
        @keyframes lr-shake {
          0%   { transform: translate(0, 0); }
          15%  { transform: translate(-4px, 2px); }
          30%  { transform: translate(4px, -2px); }
          45%  { transform: translate(-3px, -3px); }
          60%  { transform: translate(3px, 3px); }
          75%  { transform: translate(-2px, 1px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes lr-shake-text {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-2px, 1px); }
          40%  { transform: translate(2px, -1px); }
          60%  { transform: translate(-1px, -2px); }
          80%  { transform: translate(1px, 2px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes lr-streak-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes lr-new-best-pulse {
          0%, 100% { transform: scale(1);    text-shadow: 2px 2px 0 #92400E; }
          50%      { transform: scale(1.08); text-shadow: 2px 2px 0 #92400E, 0 0 8px #FBBF24; }
        }
      `}</style>
    </div>
  )
}

// ─── Animated count-up score for the game over panel ──────────────────────────
function CountUp({ target, duration, style }: { target: number; duration: number; style?: React.CSSProperties }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target <= 0) { setValue(0); return }
    const start = performance.now()
    let raf = 0
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.floor(eased * target))
      if (t < 1) raf = requestAnimationFrame(step)
      else setValue(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return <span style={style}>{value}</span>
}

