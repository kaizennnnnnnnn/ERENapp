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
import { useErenIdle } from '@/hooks/useErenIdle'
import GameCoinReward from '@/components/games/GameCoinReward'
import {
  THEMES, GROUND_H, TILE, CLOUD_TILE, GROUND_TILE, FAR_H, NEAR_H,
  ParallaxRow, FarRidge, NearRidge, CloudBand, GroundBand,
  SkyLayers, StarField, OrbLayer, HazeBand, Atmosphere,
  type Theme,
} from '@/components/games/FizzyErenScenery'
import { playSound } from '@/lib/sounds'
import { fireMinigameDone } from '@/lib/minigames'

// ─── Tuning ───────────────────────────────────────────────────────────────────
const GRAVITY        = 1700
const FLAP_V         = -440
const PIPE_W         = 60
const PIPE_GAP_MAX   = 175
const PIPE_GAP_MIN   = 135   // gap floor — shrinks 1px per pipe until here
const PIPE_INTERVAL  = 1500
const SPEED_BASE     = 200
const SPEED_MAX      = 360
// Speed ramp: per-second time pressure + small per-pipe bonus.
const TIME_ACCEL     = 1.7   // px/s added per second elapsed
const SCORE_ACCEL    = 1.2   // px/s added per pipe passed
const EREN_W         = 44
const EREN_H         = 64
const PLAYER_X       = 80
const FIZZ_INTERVAL  = 60
const THEME_EVERY    = 8     // pipes between environment swaps
const BEST_KEY       = 'flappy_eren_best'
const MILESTONES     = [10, 25, 50, 100]

// Parallax rates, as a fraction of the world's scroll speed. Stars sit at 0 —
// held perfectly still, they're what the four moving layers read as distance
// against.
const RATE_CLOUD = 0.09
const RATE_FAR   = 0.16
const RATE_NEAR  = 0.40
const RATE_GROUND = 1.0

interface Pipe { id: number; x: number; gapY: number; gap: number; passed: boolean }
interface Particle { id: number; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; alpha: number; color: string }
interface ThemeBanner { id: number; name: string; born: number; theme: Theme }

let _pid = 0
const newId = () => ++_pid

export default function FlappyErenGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const reduced = useReducedMotion()
  const idle = useErenIdle()
  // The rAF loop is self-perpetuating from one render's closure, so it would
  // capture a stale `reduced`. Mirror it into a ref the loop-bound functions read.
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  const fieldRef = useRef<HTMLDivElement>(null)
  const [fieldDims, setFieldDims] = useState({ w: 360, h: 600 })
  // Mirror dims into a ref. The rAF loop chain is self-perpetuating and
  // captures fieldDims from the render that started it, so a resize / rotation
  // / mobile URL-bar collapse would drift collision + pipe spawning away from
  // what's drawn. The ref always holds the latest measured size.
  const fieldDimsRef = useRef({ w: 360, h: 600 })

  useEffect(() => {
    function measure() {
      const r = fieldRef.current?.getBoundingClientRect()
      if (r && r.width && r.height) {
        fieldDimsRef.current = { w: r.width, h: r.height }
        setFieldDims({ w: r.width, h: r.height })
        // Park the can mid-field until a run starts. yRef is only centred by
        // startGame, so before the first tap it sat at 0 — pinned to the top
        // edge for the whole title screen.
        if (stateRef.current === 'idle') yRef.current = r.height / 2 - EREN_H / 2
      }
    }
    measure()
    const t = setTimeout(measure, 50)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [])

  const [state, setState]         = useState<'idle' | 'running' | 'gameover'>('idle')
  const [score, setScore]         = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [displayBest, setDisplayBest] = useState(0)  // counter for animated BEST number on game over
  const [isNewBest, setIsNewBest] = useState(false)
  const [scorePulseKey, setScorePulseKey] = useState(0)   // bumped each pipe pass to retrigger CSS animation
  const [shakeKey, setShakeKey]   = useState(0)
  const [redFlashKey, setRedFlashKey] = useState(0)
  const [banner, setBanner]       = useState<ThemeBanner | null>(null)
  const [milestoneKey, setMilestoneKey] = useState<number | null>(null)
  const [reward, setReward]       = useState<GameRewardResult | null>(null)
  const lastThemeIndexRef = useRef(0)
  const milestonesHitRef  = useRef<Set<number>>(new Set())
  const prevBestRef = useRef(0)

  // Hydrate persisted best on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_KEY)
      if (stored) {
        const n = parseInt(stored, 10)
        if (Number.isFinite(n) && n > 0) {
          setBestScore(n)
          setDisplayBest(n)
          prevBestRef.current = n
        }
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  // Theme is derived from score so the crossfade is automatic when score
  // crosses a multiple of THEME_EVERY.
  const themeIndex   = Math.floor(score / THEME_EVERY) % THEMES.length
  const currentTheme = THEMES[themeIndex]

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
  const startTimeRef = useRef(0)
  const flapTimeRef  = useRef<number>(-Infinity)
  const rafRef       = useRef<number>(0)
  const pausedRef    = useRef(false)
  const hideAtRef    = useRef(0)
  // Parallax scroll, each wrapped to its own tile width so the number never
  // grows without bound over a long run.
  const cloudOffRef  = useRef(0)
  const farOffRef    = useRef(0)
  const nearOffRef   = useRef(0)
  const groundOffRef = useRef(0)

  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  function spawnPipe() {
    // Gap shrinks ~1px per pipe down to PIPE_GAP_MIN — increases pressure even
    // after speed caps out.
    const gap = Math.max(PIPE_GAP_MIN, PIPE_GAP_MAX - scoreRef.current)
    const minMargin = 70
    const dims = fieldDimsRef.current
    // Playable height excludes the ground, so a gap can never open below it.
    const playH = dims.h - GROUND_H
    const range = Math.max(60, playH - gap - minMargin * 2)
    const gapY = minMargin + Math.random() * range
    pipesRef.current.push({ id: newId(), x: dims.w + 20, gapY, gap, passed: false })
  }

  function spawnScoreBurst(cx: number, cy: number) {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.4
      const speed = 80 + Math.random() * 90
      particlesRef.current.push({
        id: newId(),
        x: cx, y: cy,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 30,
        life: 0, max: 0.4,
        size: 4 + (i % 2) * 2,
        alpha: 1,
        color: i % 2 === 0 ? '#A3F0C0' : '#FFFFFF',
      })
    }
  }

  function spawnFizzPuff() {
    const px = PLAYER_X + EREN_W / 2 - 4 + (Math.random() - 0.5) * 8
    const py = yRef.current + EREN_H - 4
    particlesRef.current.push({
      id: newId(),
      x: px, y: py,
      vx: -120 - Math.random() * 80,
      vy: 50 + Math.random() * 100,
      life: 0, max: 0.45 + Math.random() * 0.4,
      size: 2 + Math.floor(Math.random() * 3) * 2,
      alpha: 0.9,
      color: Math.random() < 0.4 ? '#A3F0C0' : '#FFFFFF',
    })
  }

  function spawnFlapBurst() {
    for (let i = 0; i < 14; i++) {
      const px = PLAYER_X + EREN_W / 2 - 4 + (Math.random() - 0.5) * 14
      const py = yRef.current + EREN_H - 4
      particlesRef.current.push({
        id: newId(),
        x: px, y: py,
        vx: -50 - Math.random() * 230,
        vy: 80 + Math.random() * 240,
        life: 0, max: 0.55 + Math.random() * 0.55,
        size: 3 + Math.floor(Math.random() * 3) * 2,
        alpha: 1,
        color: i % 3 === 0 ? '#10B981' : i % 3 === 1 ? '#A3F0C0' : '#FFFFFF',
      })
    }
  }

  function flap() {
    if (stateRef.current === 'idle') { startGame(); return }
    if (stateRef.current !== 'running') return
    vyRef.current = FLAP_V
    flapTimeRef.current = performance.now()
    if (!reducedRef.current) spawnFlapBurst()
    playSound('fe_flap')
  }

  // ─── Squash/stretch + swing on each flap. Returns instantaneous scale and a
  // small extra rotation kick on top of the vy-based tilt; combines with the
  // outer rotation so the can+Eren feel like they got punched upward by the
  // can's explosion. 0 → 1 over 360 ms after a flap; outside that range the
  // sprite renders at its natural pose.
  function getFlapImpact(now: number): { sx: number; sy: number; r: number } {
    const t = (now - flapTimeRef.current) / 360
    if (!isFinite(t) || t <= 0 || t >= 1) return { sx: 1, sy: 1, r: 0 }
    let sx = 1, sy = 1, r = 0
    if (t < 0.35) {
      const u = t / 0.35
      sx = 0.82 + 0.30 * u   // narrow on impact, then snap back
      sy = 1.22 - 0.32 * u
      r  = -14 + 20 * u
    } else if (t < 0.7) {
      const u = (t - 0.35) / 0.35
      sx = 1.12 - 0.16 * u
      sy = 0.90 + 0.14 * u
      r  = 6 - 9 * u
    } else {
      const u = (t - 0.7) / 0.3
      sx = 0.96 + 0.04 * u
      sy = 1.04 - 0.04 * u
      r  = -3 + 3 * u
    }
    return { sx, sy, r }
  }

  function aabbHits(): boolean {
    const ex = PLAYER_X
    const ey = yRef.current
    if (ey < -8) return true
    if (ey + EREN_H > fieldDimsRef.current.h - GROUND_H) return true

    const hbX = ex + 6
    const hbW = EREN_W - 12
    const hbY = ey + 6
    const hbH = EREN_H - 12

    for (const p of pipesRef.current) {
      if (hbX + hbW < p.x || hbX > p.x + PIPE_W) continue
      if (hbY < p.gapY) return true
      if (hbY + hbH > p.gapY + p.gap) return true
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

    // Time-based speed ramp + small score bonus, clamped to MAX.
    const elapsed = (now - startTimeRef.current) / 1000
    speedRef.current = Math.min(
      SPEED_MAX,
      SPEED_BASE + elapsed * TIME_ACCEL + scoreRef.current * SCORE_ACCEL,
    )
    // One world movement, four different fractions of it. Each wraps to its own
    // tile so the transforms stay in a small numeric range forever.
    const move = speedRef.current * dt
    for (const p of pipesRef.current) p.x -= move
    cloudOffRef.current  = (cloudOffRef.current  + move * RATE_CLOUD)  % CLOUD_TILE
    farOffRef.current    = (farOffRef.current    + move * RATE_FAR)    % TILE
    nearOffRef.current   = (nearOffRef.current   + move * RATE_NEAR)   % TILE
    groundOffRef.current = (groundOffRef.current + move * RATE_GROUND) % GROUND_TILE

    if (now - lastPipeRef.current > PIPE_INTERVAL) {
      spawnPipe()
      lastPipeRef.current = now
    }

    pipesRef.current = pipesRef.current.filter(p => p.x > -PIPE_W - 5)

    if (now - lastFizzRef.current > FIZZ_INTERVAL) {
      if (!reducedRef.current) spawnFizzPuff()
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
        setScorePulseKey(k => k + 1)
        // particle burst at gap center for visible reward
        if (!reducedRef.current) spawnScoreBurst(p.x + PIPE_W / 2, p.gapY + p.gap / 2)
        playSound('fe_pipe_pass')

        // Theme shift announcement — fires on the pipe that crossed the boundary.
        const newThemeIndex = Math.floor(scoreRef.current / THEME_EVERY) % THEMES.length
        if (newThemeIndex !== lastThemeIndexRef.current) {
          lastThemeIndexRef.current = newThemeIndex
          const t = THEMES[newThemeIndex]
          setBanner({ id: newId(), name: t.name, born: performance.now(), theme: t })
          playSound('fe_theme_shift')
        }

        // Milestones — sub-fanfare on first crossing of 10/25/50/100.
        if (MILESTONES.includes(scoreRef.current) && !milestonesHitRef.current.has(scoreRef.current)) {
          milestonesHitRef.current.add(scoreRef.current)
          setMilestoneKey(scoreRef.current)
          playSound('fe_milestone_10')
        }
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
    lastThemeIndexRef.current = 0
    milestonesHitRef.current = new Set()
    const now = performance.now()
    lastPipeRef.current = now - PIPE_INTERVAL + 500
    lastFizzRef.current = now
    lastFrameRef.current = now
    startTimeRef.current = now
    setScore(0)
    setBanner(null)
    setMilestoneKey(null)
    setIsNewBest(false)
    setReward(null)
    stateRef.current = 'running'
    setState('running')
    rafRef.current = requestAnimationFrame(loop)
  }

  function endGame() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'gameover'
    setState('gameover')

    const finalScore = scoreRef.current
    const oldBest = prevBestRef.current
    const beatBest = finalScore > oldBest
    setBestScore(b => Math.max(b, finalScore))

    // Crash feedback — screen shake + red vignette stab. Spectacle only; skip
    // both when the player asked for reduced motion.
    if (!reducedRef.current) {
      setShakeKey(k => k + 1)
      setRedFlashKey(k => k + 1)
    }
    playSound('fe_crash')

    if (beatBest) {
      setIsNewBest(true)
      prevBestRef.current = finalScore
      try { localStorage.setItem(BEST_KEY, String(finalScore)) } catch { /* ignore */ }
      // Animate BEST number counting up from oldBest → finalScore over ~600ms.
      const startMs = performance.now()
      const dur = 600
      const tick = () => {
        const t = Math.min(1, (performance.now() - startMs) / dur)
        const eased = 1 - Math.pow(1 - t, 3)
        const v = Math.round(oldBest + (finalScore - oldBest) * eased)
        setDisplayBest(v)
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      playSound('fe_new_best')
    } else {
      setDisplayBest(oldBest)
    }

    // Coins + high-score save run on EVERY finished run via the shared reward
    // hook — the participation floor pays even on a 0-pipe crash.
    setReward(reportGameResult({ gameType: 'flappy_eren', score: finalScore }))

    if (user?.id) {
      // Daily-game credit fires on ANY finished run — even a 0-score one counts
      // as having played the game today.
      completeTask('daily_game')
      applyAction(user.id, 'play')
      if (finalScore > 0) {
        fireMinigameDone('flappy_eren', finalScore)
        if (finalScore >= 15) completeTask('weekly_high_score')
      }
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

  // Pause on background. A hidden tab keeps no rAF, but its wall-clock speed
  // ramp (now - startTimeRef) would otherwise jump straight to SPEED_MAX on
  // return and the player would die instantly. Freeze on hide, then rebase
  // every wall-clock anchor by the hidden duration so the run continues
  // exactly where it left off.
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
    startTimeRef.current += delta
    lastPipeRef.current  += delta
    lastFizzRef.current  += delta
    if (isFinite(flapTimeRef.current)) flapTimeRef.current += delta
    lastFrameRef.current = now
    rafRef.current = requestAnimationFrame(loop)
  }
  useVisibilityPause(handleHide, handleShow)

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
          style={{ background: 'linear-gradient(135deg, #047857, #10B981)', border: '2px solid #064e3b', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          FIZZY EREN
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
        <div className="ml-1 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 4, fontSize: 6, color: '#A3F0C0', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {currentTheme.name}
        </div>
      </div>

      {/* Field — wrapper key cycles to retrigger the crash shake animation. */}
      <div ref={fieldRef} onPointerDown={flap}
        key={`fe-field-${shakeKey}`}
        className="relative flex-1 overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: 'pointer', animation: shakeKey > 0 ? 'feShake 240ms steps(8, end)' : undefined }}>

        {/* ── World, back to front. Each layer crossfades on theme change and
               scrolls at its own rate; only the stars hold still. ── */}
        <SkyLayers themeIndex={themeIndex} />
        <OrbLayer themeIndex={themeIndex} />
        <StarField starOpacity={currentTheme.starOpacity} reduced={reduced} />

        <ParallaxRow offset={farOffRef.current} drift="feDriftFar" driftMs={70000}
          reduced={reduced} bottom={GROUND_H} height={FAR_H}>
          <FarRidge themeIndex={themeIndex} fieldW={fieldDims.w} />
        </ParallaxRow>

        {/* Clouds sit between the two ridges — a cloud passing in front of the
            far skyline but behind the near one is a depth cue you get free. */}
        <ParallaxRow offset={cloudOffRef.current} drift="feDriftCloud" driftMs={110000}
          reduced={reduced} top={0} height={Math.max(200, fieldDims.h * 0.55)}>
          <CloudBand themeIndex={themeIndex} fieldW={fieldDims.w} />
        </ParallaxRow>

        <HazeBand themeIndex={themeIndex} />

        <ParallaxRow offset={nearOffRef.current} drift="feDriftNear" driftMs={30000}
          reduced={reduced} bottom={GROUND_H} height={NEAR_H}>
          <NearRidge themeIndex={themeIndex} fieldW={fieldDims.w} />
        </ParallaxRow>

        {/* Pipes */}
        {pipesRef.current.map(p => (
          <PipePair key={p.id} pipe={p} fieldH={fieldDims.h} theme={currentTheme} />
        ))}

        {/* Eren on can — outer wrapper handles position, inner wrapper applies
            the flap squash/stretch + swing kick on top of the vy-based tilt.
            Ghosts trail behind once the world is moving fast enough to warrant
            them; the thrust plume fires on every flap. */}
        {(() => {
          const now = performance.now()
          const impact = getFlapImpact(now)
          const spin = `rotate(${angleRef.current + impact.r}deg) scale(${impact.sx}, ${impact.sy})`
          // 0 at base speed, 1 at cap — ghosts fade in as the run gets faster.
          const rush = reduced || state !== 'running' ? 0
            : Math.max(0, Math.min(1, (speedRef.current - SPEED_BASE - 30) / (SPEED_MAX - SPEED_BASE - 30)))
          const plume = reduced ? 0 : Math.max(0, 1 - (now - flapTimeRef.current) / 420)
          return (
            <>
              {rush > 0.02 && [1, 2].map(k => (
                <div key={k} style={{
                  position: 'absolute',
                  left: PLAYER_X - k * 13,
                  top: yRef.current,
                  width: EREN_W, height: EREN_H,
                  opacity: rush * (k === 1 ? 0.26 : 0.13),
                  transform: spin,
                  transformOrigin: '50% 70%',
                  pointerEvents: 'none',
                }}>
                  <ErenOnCanMemo blink={idle.blink} twitch={idle.twitch} glance={idle.glance} />
                </div>
              ))}
              <div style={{
                position: 'absolute',
                left: PLAYER_X,
                top: yRef.current,
                width: EREN_W,
                height: EREN_H,
                willChange: 'transform, top',
                animation: state === 'idle' && !reduced ? 'feIdleBob 1800ms ease-in-out infinite' : undefined,
              }}>
                <div style={{
                  width: '100%', height: '100%',
                  transform: spin,
                  transformOrigin: '50% 70%',
                }}>
                  <ErenOnCanMemo blink={idle.blink} twitch={idle.twitch} glance={idle.glance} />
                  {plume > 0 && <ThrustPlume power={plume} />}
                </div>
              </div>
            </>
          )
        })()}

        {/* Fizz — square chunks on whole pixels, no blur. Round divs with a
            blurred glow read as generic CSS particles next to the can's art. */}
        {particlesRef.current.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            left: Math.round(p.x), top: Math.round(p.y),
            width: p.size, height: p.size,
            background: p.color,
            opacity: p.alpha,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Ground — scrolls at full world speed, so it's the layer that sells
            how fast you're actually going. */}
        <ParallaxRow offset={groundOffRef.current} drift="feDriftGround" driftMs={2600}
          reduced={reduced} bottom={0} height={GROUND_H}>
          <GroundBand themeIndex={themeIndex} />
        </ParallaxRow>

        <Atmosphere />

        {/* Score — outer div handles centering, inner div pulses on each pass. */}
        {state !== 'idle' && (
          <div className="absolute pointer-events-none" style={{
            top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center',
          }}>
            <div
              key={`fe-score-${scorePulseKey}`}
              className="font-pixel"
              style={{
                fontSize: 36,
                color: 'white',
                // Eight-direction outline, not a single offset shadow — the
                // score sits over five different skies and has to stay legible
                // against every one of them.
                textShadow:
                  '2px 0 0 #08301F, -2px 0 0 #08301F, 0 2px 0 #08301F, 0 -2px 0 #08301F,' +
                  '2px 2px 0 #08301F, -2px 2px 0 #08301F, 2px -2px 0 #08301F, -2px -2px 0 #08301F,' +
                  '0 5px 0 rgba(0,0,0,0.32)',
                letterSpacing: 2,
                transformOrigin: 'center center',
                animation: scorePulseKey > 0 ? 'feScorePulse 220ms cubic-bezier(0.34,1.56,0.64,1)' : undefined,
              }}>
              {score}
            </div>
          </div>
        )}

        {/* Theme-shift banner — slides in from the top for ~1.2s. */}
        {banner && state === 'running' && (
          <div className="absolute pointer-events-none" style={{
            top: 76, left: 0, right: 0, display: 'flex', justifyContent: 'center',
          }}>
            <div
              key={`fe-banner-${banner.id}`}
              className="font-pixel"
              style={{
                padding: '6px 14px',
                background: 'rgba(0,0,0,0.65)',
                border: `2px solid ${banner.theme.pipeColor3}`,
                borderRadius: 4,
                boxShadow: `0 3px 0 ${banner.theme.pipeShadow}, 0 0 14px ${banner.theme.pipeColor3}55`,
                fontSize: 9,
                letterSpacing: 3,
                color: banner.theme.pipeColor3,
                textTransform: 'uppercase',
                animation: 'feBannerIn 1200ms cubic-bezier(0.22,1,0.36,1) forwards',
                whiteSpace: 'nowrap',
              }}
              onAnimationEnd={() => setBanner(null)}>
              {banner.name}
            </div>
          </div>
        )}

        {/* Milestone celebration — large arpeggio number flash. */}
        {milestoneKey && state === 'running' && (
          <div className="absolute pointer-events-none" style={{
            top: '32%', left: 0, right: 0, display: 'flex', justifyContent: 'center',
          }}>
            <div
              key={`fe-ms-${milestoneKey}`}
              className="font-pixel"
              style={{
                fontSize: 22,
                color: '#FDE68A',
                textShadow: '3px 3px 0 #7C3AED, -1px -1px 0 #064e3b',
                letterSpacing: 3,
                animation: 'feMilestone 1100ms cubic-bezier(0.34,1.56,0.64,1) forwards',
              }}
              onAnimationEnd={() => setMilestoneKey(null)}
            >
              +{milestoneKey}!
            </div>
          </div>
        )}

        {/* Red crash vignette — instant inset glow stab that fades over 240ms. */}
        {redFlashKey > 0 && (
          <div
            key={`fe-red-${redFlashKey}`}
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: 'inset 0 0 80px 12px rgba(220,38,38,0.85)',
              background: 'radial-gradient(circle at center, transparent 40%, rgba(220,38,38,0.3) 100%)',
              animation: 'feRedFlash 240ms ease-out forwards',
              zIndex: 25,
            }}
          />
        )}

        {/* Idle overlay */}
        {state === 'idle' && (
          // Sits in the lower third, not dead centre — the can idles at mid-field
          // and a centred panel lands right on top of it.
          <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none"
            style={{ paddingBottom: '26%' }}>
            <div style={{
              padding: '14px 22px',
              background: 'linear-gradient(180deg, #15122A 0%, #0F0A1E 100%)',
              border: '3px solid #10B981',
              borderRadius: 6,
              boxShadow: '0 4px 0 #064e3b, 0 0 20px rgba(16,185,129,0.35)',
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
              {isNewBest && (
                <div className="font-pixel" style={{
                  padding: '4px 10px',
                  background: 'linear-gradient(90deg, #F59E0B, #FCD34D, #F59E0B)',
                  border: '2px solid #78350F',
                  borderRadius: 3,
                  boxShadow: '0 3px 0 #78350F',
                  fontSize: 8,
                  letterSpacing: 2,
                  color: '#451A03',
                  animation: 'feNewBestRibbon 900ms cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  NEW BEST!
                </div>
              )}
              <div className="flex items-center gap-4 mt-1">
                <div className="flex flex-col items-center">
                  <span className="font-pixel" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>SCORE</span>
                  <span className="font-pixel text-white" style={{ fontSize: 22 }}>{score}</span>
                </div>
                <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
                <div className="flex flex-col items-center">
                  <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                  <span className="font-pixel" style={{
                    fontSize: 22,
                    color: '#FDE68A',
                    textShadow: isNewBest ? '0 0 8px rgba(253,230,138,0.7)' : undefined,
                  }}>{displayBest}</span>
                </div>
              </div>
              {reward && (
                <div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => { playSound('ui_tap'); reset() }}
                  className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
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
        @keyframes goPop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
        /* Idle drift. These run in every state and compose with the game's own
           scroll offset (nested wrappers), so the title screen breathes and
           tapping to start adds motion instead of snapping a layer back. Each
           translation is exactly one tile, so the loop point is invisible. */
        @keyframes feDriftCloud  { from { transform: translate3d(0,0,0); } to { transform: translate3d(-320px,0,0); } }
        @keyframes feDriftFar    { from { transform: translate3d(0,0,0); } to { transform: translate3d(-256px,0,0); } }
        @keyframes feDriftNear   { from { transform: translate3d(0,0,0); } to { transform: translate3d(-256px,0,0); } }
        @keyframes feDriftGround { from { transform: translate3d(0,0,0); } to { transform: translate3d(-32px,0,0); } }
        @keyframes feIdleBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-7px); }
        }
        @keyframes feScorePulse {
          0%   { transform: scale(1);    color: #FFFFFF; }
          45%  { transform: scale(1.35); color: #A3F0C0; }
          100% { transform: scale(1);    color: #FFFFFF; }
        }
        @keyframes feShake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-8px); }
          30%  { transform: translateX(7px); }
          45%  { transform: translateX(-6px); }
          60%  { transform: translateX(5px); }
          75%  { transform: translateX(-3px); }
          90%  { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        @keyframes feRedFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes feBannerIn {
          0%   { transform: translateY(-32px); opacity: 0; }
          15%  { transform: translateY(0);     opacity: 1; }
          80%  { transform: translateY(0);     opacity: 1; }
          100% { transform: translateY(-12px); opacity: 0; }
        }
        @keyframes feMilestone {
          0%   { transform: scale(0.4); opacity: 0; }
          25%  { transform: scale(1.2); opacity: 1; }
          40%  { transform: scale(1);   opacity: 1; }
          80%  { transform: scale(1);   opacity: 1; }
          100% { transform: scale(1.1) translateY(-20px); opacity: 0; }
        }
        @keyframes feNewBestRibbon {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg);  opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Pipe pair ──────────────────────────────────────────────
// Hard colour stops rather than a smooth gradient. A smooth left-to-right
// blend reads as a CSS rectangle; discrete bands read as a drawn cylinder,
// which is what sits right next to a 120-rect pixel sprite without embarrassing
// it. Ribbing, a lit top edge and rivets on the caps do the rest.

const PIPE_CAP_H = 18

function pipeBody(theme: Theme): string {
  return `linear-gradient(90deg,
    ${theme.pipeShadow} 0 3px,
    ${theme.pipeColor1} 3px 11px,
    ${theme.pipeColor3} 11px 19px,
    ${theme.pipeColor2} 19px 42px,
    ${theme.pipeColor1} 42px 53px,
    ${theme.pipeShadow} 53px ${PIPE_W}px)`
}

/** Horizontal ribbing. Very low alpha — it should register as material, not as
 *  stripes you can count. */
const PIPE_RIBS = 'repeating-linear-gradient(180deg, rgba(255,255,255,0.055) 0 2px, transparent 2px 11px)'

function PipeCap({ x, y, theme }: { x: number; y: number; theme: Theme }) {
  return (
    <div style={{
      position: 'absolute',
      left: x - 6, top: y, width: PIPE_W + 12, height: PIPE_CAP_H,
      background: pipeBody(theme),
      backgroundSize: `${PIPE_W + 12}px 100%`,
      border: `3px solid ${theme.pipeShadow}`,
      boxSizing: 'border-box',
      transition: 'background 1.4s ease, border-color 1.4s ease',
    }}>
      <div style={{ position: 'absolute', left: 3, right: 3, top: 0, height: 2, background: 'rgba(255,255,255,0.34)' }} />
      <div style={{ position: 'absolute', left: 3, right: 3, bottom: 0, height: 2, background: 'rgba(0,0,0,0.30)' }} />
      {/* rivets — the app's "premium surface" tell, reused on the pipe lip */}
      <div style={{ position: 'absolute', left: 6, top: PIPE_CAP_H / 2 - 2, width: 3, height: 3, background: theme.pipeColor3 }} />
      <div style={{ position: 'absolute', right: 6, top: PIPE_CAP_H / 2 - 2, width: 3, height: 3, background: theme.pipeColor3 }} />
    </div>
  )
}

function PipeShaft({ x, y, h, theme, mouth }: { x: number; y: number; h: number; theme: Theme; mouth: 'top' | 'bottom' }) {
  if (h <= 0) return null
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y, width: PIPE_W, height: h,
      background: pipeBody(theme),
      transition: 'background 1.4s ease',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: PIPE_RIBS }} />
      {/* the shaft's open end is darkened so the gap reads as a tunnel mouth
          rather than as two rectangles that happen to stop */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 26,
        [mouth === 'top' ? 'bottom' : 'top']: 0,
        background: `linear-gradient(${mouth === 'top' ? '0deg' : '180deg'}, rgba(0,0,0,0.34), transparent)`,
      }} />
    </div>
  )
}

function PipePair({ pipe, fieldH, theme }: { pipe: Pipe; fieldH: number; theme: Theme }) {
  const lowerY = pipe.gapY + pipe.gap
  return (
    <>
      <PipeShaft x={pipe.x} y={0} h={pipe.gapY - PIPE_CAP_H + 2} theme={theme} mouth="top" />
      <PipeCap   x={pipe.x} y={pipe.gapY - PIPE_CAP_H} theme={theme} />
      <PipeShaft x={pipe.x} y={lowerY + PIPE_CAP_H - 2}
        h={fieldH - lowerY - PIPE_CAP_H - GROUND_H + 2} theme={theme} mouth="bottom" />
      <PipeCap   x={pipe.x} y={lowerY} theme={theme} />
    </>
  )
}

// ─── Thrust plume ────────────────────────────────────────────
/** Three stacked pixel bars under the can, sized by how recently you flapped.
 *  The can was already spitting particles; what it lacked was a visible source
 *  for them. `power` runs 1 -> 0 over 420ms. */
function ThrustPlume({ power }: { power: number }) {
  const bars = [
    { w: 12, h: 7, c: '#FFFFFF' },
    { w: 8,  h: 6, c: '#A3F0C0' },
    { w: 4,  h: 5, c: '#10B981' },
  ]
  let y = EREN_H - 3
  return (
    <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {bars.map((b, i) => {
        const h = Math.round(b.h * power)
        const top = y
        y += h
        return h <= 0 ? null : (
          <div key={i} style={{
            position: 'absolute',
            left: EREN_W / 2 - b.w / 2, top,
            width: b.w, height: h,
            background: b.c,
            opacity: 0.55 + 0.45 * power,
          }} />
        )
      })}
    </div>
  )
}

const ErenOnCanMemo = memo(ErenOnCan)

// ─── Eren on a high-detail energy can ─────────────────────────────────────────
function ErenOnCan({ blink = false, twitch = false, glance = 0 }: { blink?: boolean; twitch?: boolean; glance?: number }) {
  return (
    <svg width={EREN_W} height={EREN_H} viewBox="0 0 44 64" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ═══ EREN CHIBI — clean Ragdoll, forward gaze ═══ */}
      <g transform="translate(11, 0)">
        {/* ears */}
        <rect x="3"  y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="3"  y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="4"  y="4" width="1" height="1" fill="#F4B0B8" />
        {/* right ear flicks a pixel on an idle twitch */}
        <g transform={twitch ? 'translate(0,1)' : undefined}>
          <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
          <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
          <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
        </g>
        {/* head outline */}
        <rect x="5"  y="3" width="12" height="1" fill="#4A2E1A" />
        <rect x="4"  y="4" width="14" height="1" fill="#4A2E1A" />
        <rect x="3"  y="5" width="16" height="1" fill="#4A2E1A" />
        <rect x="3"  y="6" width="1"  height="6" fill="#4A2E1A" />
        <rect x="18" y="6" width="1"  height="6" fill="#4A2E1A" />
        {/* head fill — pure cream */}
        <rect x="4"  y="5" width="14" height="1" fill="#F9EDD5" />
        <rect x="4"  y="6" width="14" height="6" fill="#F9EDD5" />
        {/* eyes — wide and excited (the can is exploding under him) */}
        {blink ? (
          <>
            <rect x="6"  y="8" width="2" height="1" fill="#4A2E1A" />
            <rect x="14" y="8" width="2" height="1" fill="#4A2E1A" />
          </>
        ) : (
          <>
            <rect x="6"  y="7" width="2" height="2" fill="#6BAED6" />
            <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
            {/* pupils + shine slide a pixel when he glances off to one side */}
            <g transform={glance ? `translate(${glance},0)` : undefined}>
              <rect x="6"  y="7" width="1" height="1" fill="#FFFFFF" />
              <rect x="15" y="7" width="1" height="1" fill="#FFFFFF" />
              <rect x="7"  y="8" width="1" height="1" fill="#1A1A2E" />
              <rect x="14" y="8" width="1" height="1" fill="#1A1A2E" />
            </g>
          </>
        )}
        {/* cheeks below eyes */}
        <rect x="4"  y="10" width="2" height="1" fill="#FFB6C8" />
        <rect x="16" y="10" width="2" height="1" fill="#FFB6C8" />
        {/* nose */}
        <rect x="10" y="9"  width="2" height="1" fill="#F48B9B" />
        <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
        {/* open little mouth — wind-in-fur look */}
        <rect x="9"  y="11" width="1" height="1" fill="#4A2E1A" />
        <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
        <rect x="10" y="11" width="2" height="1" fill="#FF6B9D" />
        {/* chin */}
        <rect x="4"  y="12" width="14" height="1" fill="#4A2E1A" />
        <rect x="5"  y="12" width="12" height="1" fill="#F9EDD5" />
        {/* body — narrower than head for chibi proportions */}
        <rect x="6"  y="13" width="10" height="1" fill="#4A2E1A" />
        <rect x="5"  y="14" width="1"  height="6" fill="#4A2E1A" />
        <rect x="16" y="14" width="1"  height="6" fill="#4A2E1A" />
        <rect x="6"  y="14" width="10" height="6" fill="#F9EDD5" />
        <rect x="6"  y="20" width="10" height="1" fill="#4A2E1A" />
        {/* paws gripping the can rim — extend outward + downward */}
        <rect x="3"  y="18" width="3" height="2" fill="#D4B896" />
        <rect x="2"  y="18" width="1" height="2" fill="#4A2E1A" />
        <rect x="3"  y="20" width="3" height="1" fill="#4A2E1A" />
        <rect x="16" y="18" width="3" height="2" fill="#D4B896" />
        <rect x="19" y="18" width="1" height="2" fill="#4A2E1A" />
        <rect x="16" y="20" width="3" height="1" fill="#4A2E1A" />
        {/* wind whiskers (one extra fluff line per cheek for motion) */}
        <rect x="0"  y="9"  width="3" height="1" fill="rgba(255,255,255,0.55)" />
        <rect x="19" y="9"  width="3" height="1" fill="rgba(255,255,255,0.55)" />
      </g>

      {/* ═══ HIGH-DETAIL ENERGY CAN (16w × 30h, centered x=14..30) ═══ */}
      {/* outer rim shadow at top (gives the can a "rolled lip") */}
      <rect x="14" y="21" width="16" height="1" fill="#3A3A3A" />
      {/* black opening line */}
      <rect x="14" y="22" width="16" height="1" fill="#0A0A0A" />
      {/* lid silver wedge — tiny dimple where you'd pull the tab */}
      <rect x="15" y="23" width="14" height="1" fill="#3A3A3A" />
      <rect x="20" y="23" width="4"  height="1" fill="#1A1A1A" />
      <rect x="14" y="23" width="1"  height="1" fill="#0A0A0A" />
      <rect x="29" y="23" width="1"  height="1" fill="#0A0A0A" />

      {/* Top metallic ring (silver highlight + dark line beneath) */}
      <rect x="14" y="24" width="16" height="2" fill="#525252" />
      <rect x="15" y="24" width="14" height="1" fill="#D1D5DB" />
      <rect x="15" y="25" width="14" height="1" fill="#525252" />
      <rect x="14" y="25" width="1"  height="1" fill="#0A0A0A" />
      <rect x="29" y="25" width="1"  height="1" fill="#0A0A0A" />

      {/* dark lip just under the ring */}
      <rect x="14" y="26" width="16" height="1" fill="#000000" />

      {/* Body base black */}
      <rect x="14" y="27" width="16" height="24" fill="#0F0F0F" />

      {/* Left vertical highlight column (sheen) */}
      <rect x="15" y="27" width="2" height="24" fill="#262626" />
      <rect x="15" y="27" width="1" height="24" fill="#3A3A3A" />
      <rect x="16" y="29" width="1" height="14" fill="#525252" />
      {/* tiny moving-light glint */}
      <rect x="17" y="32" width="1" height="2" fill="#7A7A7A" />

      {/* Right vertical shadow column */}
      <rect x="27" y="27" width="2" height="24" fill="#1A1A1A" />
      <rect x="28" y="27" width="1" height="24" fill="#000000" />

      {/* Outer left/right black borders */}
      <rect x="14" y="27" width="1"  height="24" fill="#0A0A0A" />
      <rect x="29" y="27" width="1"  height="24" fill="#0A0A0A" />

      {/* Claw-mark logo — three lime streaks with brighter cores + tip glints */}
      <rect x="18" y="32" width="2"  height="14" fill="#10B981" />
      <rect x="18" y="32" width="1"  height="14" fill="#34D399" />
      <rect x="19" y="33" width="1"  height="3"  fill="#A3F0C0" />
      <rect x="18" y="31" width="2"  height="1"  fill="#A3F0C0" />
      <rect x="18" y="46" width="2"  height="1"  fill="#A3F0C0" />

      <rect x="22" y="34" width="2"  height="11" fill="#10B981" />
      <rect x="22" y="34" width="1"  height="11" fill="#34D399" />
      <rect x="23" y="35" width="1"  height="3"  fill="#A3F0C0" />
      <rect x="22" y="33" width="2"  height="1"  fill="#A3F0C0" />
      <rect x="22" y="45" width="2"  height="1"  fill="#A3F0C0" />

      <rect x="26" y="32" width="2"  height="14" fill="#10B981" />
      <rect x="26" y="32" width="1"  height="14" fill="#34D399" />
      <rect x="27" y="33" width="1"  height="3"  fill="#A3F0C0" />
      <rect x="26" y="31" width="2"  height="1"  fill="#A3F0C0" />
      <rect x="26" y="46" width="2"  height="1"  fill="#A3F0C0" />

      {/* "EE" pixel badge below the claws */}
      <rect x="20" y="48" width="1" height="3" fill="#A3F0C0" />
      <rect x="21" y="48" width="2" height="1" fill="#A3F0C0" />
      <rect x="21" y="49" width="1" height="1" fill="#A3F0C0" />
      <rect x="21" y="50" width="2" height="1" fill="#A3F0C0" />
      <rect x="24" y="48" width="1" height="3" fill="#A3F0C0" />
      <rect x="25" y="48" width="2" height="1" fill="#A3F0C0" />
      <rect x="25" y="49" width="1" height="1" fill="#A3F0C0" />
      <rect x="25" y="50" width="2" height="1" fill="#A3F0C0" />

      {/* Bottom metallic ring */}
      <rect x="14" y="51" width="16" height="2" fill="#525252" />
      <rect x="15" y="51" width="14" height="1" fill="#D1D5DB" />
      <rect x="15" y="52" width="14" height="1" fill="#525252" />
      <rect x="14" y="53" width="16" height="1" fill="#0A0A0A" />

      {/* Fizz mouth — explosive opening at the bottom */}
      <rect x="17" y="54" width="10" height="2" fill="#A3F0C0" />
      <rect x="18" y="55" width="8"  height="1" fill="#FFFFFF" />
      <rect x="18" y="56" width="8"  height="1" fill="#10B981" />
      <rect x="19" y="57" width="6"  height="1" fill="#34D399" opacity="0.85" />
      <rect x="20" y="58" width="4"  height="1" fill="#FFFFFF" opacity="0.6" />
      <rect x="21" y="59" width="2"  height="1" fill="#A3F0C0" opacity="0.6" />
    </svg>
  )
}
