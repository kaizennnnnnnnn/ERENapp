'use client'

import { memo, useEffect, useReducer, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import GameCoinReward from '@/components/games/GameCoinReward'
import { playSound } from '@/lib/sounds'
import { IconCrown, IconStar } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'

const PIECE_HEIGHT   = 36
const PERFECT_TOL    = 4    // px tolerance for "perfect"
const STARTING_WIDTH = 0.55 // % of field width
const BASE_SWING_SPEED = 1.6
const SWING_SPEED_RAMP = 0.04 // +4% per piece
const SWING_SPEED_MAX  = 4.5

interface Block {
  id: number
  x: number
  width: number
  y: number      // top of piece in world coords
  hue: number    // colour rotation index
  texture: number // 0..3, picks a pixel-pattern variant
}

let _bid = 0
const newId = () => ++_bid

// Cycle of saturated palettes for tower blocks (kept readable on any sky bg).
const PALETTES = [
  { fill: '#A78BFA', edge: '#4C1D95', light: '#DDD6FE' }, // violet
  { fill: '#34D399', edge: '#065F46', light: '#A7F3D0' }, // emerald
  { fill: '#FBBF24', edge: '#92400E', light: '#FDE68A' }, // amber
  { fill: '#F472B6', edge: '#9D174D', light: '#FBCFE8' }, // pink
  { fill: '#60A5FA', edge: '#1E40AF', light: '#BFDBFE' }, // blue
  { fill: '#FB923C', edge: '#9A3412', light: '#FED7AA' }, // orange
] as const

// Sky gradient tiers — every 12 pieces we crossfade to the next; mirrors the
// progression in Fizzy Eren but here it's height-driven, not score-driven.
const SKIES = [
  'linear-gradient(180deg, #5BACEC 0%, #B5D9F5 60%, #FCE7B4 100%)',  // day
  'linear-gradient(180deg, #FF7E47 0%, #FFB888 50%, #FFE5C0 100%)',  // sunset
  'linear-gradient(180deg, #1A1A4E 0%, #2D1B5E 60%, #4C1D95 100%)',  // dusk
  'linear-gradient(180deg, #0A0F2A 0%, #15082E 60%, #2E0F5C 100%)',  // night
  'linear-gradient(180deg, #000000 0%, #0A0628 50%, #1F0A4F 100%)',  // space
] as const

export default function ErenStackGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()

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

  const [phase, setPhase]         = useState<'idle' | 'running' | 'gameover'>('idle')
  const [score, setScore]         = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [perfectStreak, setPerfectStreak] = useState(0)
  const [floater, setFloater]     = useState<{ id: number; text: string; x: number; y: number; color: string } | null>(null)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; dx: number; dy: number; color: string; kind: 'star' | 'dust' }>>([])
  const [shakeKey, setShakeKey]   = useState(0)
  const [missFlash, setMissFlash] = useState(false)
  const [scorePulse, setScorePulse] = useState<{ id: number; perfect: boolean } | null>(null)
  const [streakBreak, setStreakBreak] = useState(0)
  const [reward, setReward] = useState<GameRewardResult | null>(null)

  const stateRef       = useRef<'idle' | 'running' | 'gameover'>('idle')
  const towerRef       = useRef<Block[]>([])
  const currentRef     = useRef<Block | null>(null)
  const swingStartRef  = useRef(0)
  const swingSpeedRef  = useRef(BASE_SWING_SPEED)
  const cameraYRef     = useRef(0)
  const cameraTargetRef= useRef(0)
  const lastFrameRef   = useRef(0)
  const rafRef         = useRef<number>(0)
  const savedRef       = useRef(false)
  const fallingRef     = useRef<Block[]>([])  // trimmed pieces falling off
  const scoreRefVal    = useRef(0)            // authoritative score (includes perfect bonus)
  const prevSkyIdxRef  = useRef(0)
  const milestonesHitRef = useRef<Set<number>>(new Set())
  const perfectStreakRef = useRef(0)
  const cameraOvershootRef = useRef(0)

  const [, force] = useReducer((n: number) => n + 1, 0)

  function spawnNext(prevWidth: number, prevX: number, prevY: number) {
    const tex = Math.floor(Math.random() * 4)
    const palette = PALETTES[towerRef.current.length % PALETTES.length]
    void palette
    currentRef.current = {
      id: newId(),
      x: 0,
      width: prevWidth,
      y: prevY - PIECE_HEIGHT,
      hue: towerRef.current.length,
      texture: tex,
    }
    swingStartRef.current = performance.now()
    void prevX
  }

  function startGame() {
    towerRef.current = []
    fallingRef.current = []
    swingSpeedRef.current = BASE_SWING_SPEED
    setScore(0)
    setPerfectStreak(0)
    perfectStreakRef.current = 0
    scoreRefVal.current = 0
    prevSkyIdxRef.current = 0
    milestonesHitRef.current = new Set()
    setParticles([])
    setMissFlash(false)
    setScorePulse(null)
    setReward(null)
    savedRef.current = false

    const baseW = fieldDims.w * STARTING_WIDTH
    const baseX = (fieldDims.w - baseW) / 2
    const baseY = fieldDims.h - 100  // above ground line
    towerRef.current.push({ id: newId(), x: baseX, width: baseW, y: baseY, hue: 0, texture: 0 })

    cameraYRef.current = 0
    cameraTargetRef.current = 0
    spawnNext(baseW, baseX, baseY)

    stateRef.current = 'running'
    setPhase('running')
    lastFrameRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }

  function loop(now: number) {
    if (stateRef.current !== 'running') return
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000)
    lastFrameRef.current = now

    // Swing the active piece using a sine, so it eases at extremes.
    if (currentRef.current) {
      const elapsed = (now - swingStartRef.current) / 1000
      const phase = elapsed * swingSpeedRef.current
      const range = fieldDims.w - currentRef.current.width
      const t = (Math.sin(phase) + 1) / 2  // 0..1
      currentRef.current.x = t * range
    }

    // Smoothly lerp camera toward target with a tiny spring on perfect drops.
    // Overshoot pulls the camera 6px past the target, then decays — gives that
    // satisfying "earned" bounce when stacking a perfect.
    const overshoot = cameraOvershootRef.current
    const cdiff = (cameraTargetRef.current - overshoot) - cameraYRef.current
    cameraYRef.current += cdiff * Math.min(1, dt * (overshoot > 0 ? 6 : 4))
    if (overshoot > 0) cameraOvershootRef.current = Math.max(0, overshoot - dt * 22)

    // Update falling trimmed pieces
    for (const f of fallingRef.current) f.y += 600 * dt
    fallingRef.current = fallingRef.current.filter(f => f.y < fieldDims.h + 200)

    force()
    rafRef.current = requestAnimationFrame(loop)
  }

  function dropPiece() {
    // Idle: tapping anywhere on the field starts the game (the "TAP TO START"
    // overlay has pointer-events:none so it forwards taps here).
    if (stateRef.current === 'idle') { startGame(); return }
    if (stateRef.current !== 'running' || !currentRef.current) return
    const top = towerRef.current[towerRef.current.length - 1]
    const cur = currentRef.current

    const overlapL = Math.max(top.x, cur.x)
    const overlapR = Math.min(top.x + top.width, cur.x + cur.width)
    const overlap = overlapR - overlapL

    if (overlap <= 4) {
      // Total miss — game over. Send the whole piece tumbling.
      fallingRef.current.push({ ...cur })
      currentRef.current = null
      playSound('es_miss')
      setShakeKey(k => k + 1)
      setMissFlash(true)
      setTimeout(() => setMissFlash(false), 200)
      endGame()
      return
    }

    const offset = Math.abs(cur.x - top.x)
    const perfect = offset < PERFECT_TOL

    let lockedX = cur.x, lockedW = cur.width

    if (perfect) {
      // Perfect — no trim. Inherit top's exact width + position.
      lockedX = top.x
      lockedW = top.width
      const nextStreak = perfectStreakRef.current + 1
      perfectStreakRef.current = nextStreak
      setPerfectStreak(nextStreak)
      // Escalating chime on odd streaks 3,5,7…, regular perfect ding otherwise.
      if (nextStreak >= 3 && nextStreak % 2 === 1) playSound('es_perfect_streak')
      else playSound('es_perfect')
      flashFloater('PERFECT!', cur.x + cur.width / 2, cur.y + 18, '#FDE68A')
      spawnStarBurst(cur.x + cur.width / 2, cur.y + PIECE_HEIGHT / 2)
      // Tiny camera overshoot on perfects — makes height feel earned.
      cameraOvershootRef.current = 7
    } else {
      // Trim to overlap; tumble the cut-off chunk.
      const cutSide: 'left' | 'right' = cur.x > top.x ? 'left' : 'right'
      lockedX = overlapL
      lockedW = overlap

      const cutW = cur.width - overlap
      const cutX = cutSide === 'left' ? cur.x : overlapR
      fallingRef.current.push({ ...cur, x: cutX, width: cutW, id: newId() })
      // Streak-broken feedback: if we were on a real streak (>=2), shake the
      // badge before it fades out so the loss is acknowledged.
      if (perfectStreakRef.current >= 2) setStreakBreak(k => k + 1)
      perfectStreakRef.current = 0
      setPerfectStreak(0)
      playSound('es_place')
      // Soft trim whoosh sound + dust puffs at the cut edge.
      setTimeout(() => playSound('es_trim'), 60)
      const dustX = cutSide === 'left' ? overlapL : overlapR
      spawnDustPuff(dustX, cur.y + PIECE_HEIGHT / 2)
    }

    const locked: Block = { ...cur, x: lockedX, width: lockedW, y: top.y - PIECE_HEIGHT }
    towerRef.current.push(locked)

    const gained = perfect ? 5 : 1
    scoreRefVal.current += gained
    const newScore = scoreRefVal.current
    setScore(newScore)
    // Score-number pulse on every placement (gold tint on perfect).
    setScorePulse({ id: newId(), perfect })

    // Height milestones — triumphant chiptune fanfare at 10/25/50.
    for (const m of [10, 25, 50]) {
      if (newScore >= m && !milestonesHitRef.current.has(m)) {
        milestonesHitRef.current.add(m)
        setTimeout(() => playSound('es_height_milestone'), 120)
        break
      }
    }

    // Sky-tier change cue (escalates every 12 pieces).
    const newSkyIdx = Math.min(SKIES.length - 1, Math.floor(newScore / 12))
    if (newSkyIdx !== prevSkyIdxRef.current) {
      prevSkyIdxRef.current = newSkyIdx
      playSound('es_sky_change')
    }

    // Update camera target so the new top sits in upper-third of the screen.
    const desiredScreenY = fieldDims.h * 0.45
    cameraTargetRef.current = locked.y - desiredScreenY

    // Speed up the swing for the next piece.
    swingSpeedRef.current = Math.min(SWING_SPEED_MAX, swingSpeedRef.current * (1 + SWING_SPEED_RAMP))

    // Spawn next — same width as locked (or wider if perfect bonus).
    // Non-perfect drops apply a tiny per-piece width decay so a player can't
    // mathematically stay alive forever via slow attrition. ~1% bleed.
    const nextW = perfect
      ? Math.min(fieldDims.w * 0.7, lockedW * 1.04)
      : Math.max(20, lockedW * 0.99)
    spawnNext(nextW, lockedX, locked.y)

    if (nextW < 22) {
      // Pieces are too thin to play with — game over.
      setTimeout(endGame, 250)
    }
  }

  // ─── Particle helpers (gold star burst on perfect, dust puff on trim) ────
  function spawnStarBurst(x: number, y: number) {
    const next: Array<{ id: number; x: number; y: number; dx: number; dy: number; color: string; kind: 'star' | 'dust' }> = []
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
      const speed = 30 + Math.random() * 28
      next.push({
        id: newId(),
        x, y,
        dx: Math.cos(ang) * speed,
        dy: Math.sin(ang) * speed,
        color: i % 2 === 0 ? '#FDE68A' : '#FFFFFF',
        kind: 'star',
      })
    }
    setParticles(p => [...p, ...next])
    const ids = next.map(n => n.id)
    setTimeout(() => setParticles(p => p.filter(q => !ids.includes(q.id))), 520)
  }

  function spawnDustPuff(x: number, y: number) {
    const next: Array<{ id: number; x: number; y: number; dx: number; dy: number; color: string; kind: 'star' | 'dust' }> = []
    for (let i = 0; i < 3; i++) {
      next.push({
        id: newId(),
        x, y,
        dx: (Math.random() - 0.5) * 24,
        dy: -8 - Math.random() * 14,
        color: '#E5E7EB',
        kind: 'dust',
      })
    }
    setParticles(p => [...p, ...next])
    const ids = next.map(n => n.id)
    setTimeout(() => setParticles(p => p.filter(q => !ids.includes(q.id))), 420)
  }

  function flashFloater(text: string, x: number, y: number, color: string) {
    const id = newId()
    setFloater({ id, text, x, y, color })
    setTimeout(() => setFloater(f => f && f.id === id ? null : f), 800)
  }

  function endGame() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'gameover'
    setPhase('gameover')
    const finalScore = scoreRef()
    setBestScore(b => Math.max(b, finalScore))

    if (!savedRef.current && user?.id) {
      savedRef.current = true
      setReward(reportGameResult({ gameType: 'eren_stack', score: finalScore }))
      if (finalScore > 0) {
        fireMinigameDone('eren_stack', finalScore)
        completeTask('daily_game')
        if (finalScore >= 25) completeTask('weekly_high_score')
        applyAction(user.id, 'play')
      }
    }
  }

  function scoreRef(): number {
    // Authoritative score, including +5 perfect bonuses. Tracked in a ref so it
    // survives React state batching at endGame time.
    return scoreRefVal.current
  }

  function reset() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = 'idle'
    setPhase('idle')
    towerRef.current = []
    fallingRef.current = []
    currentRef.current = null
    setScore(0)
    setPerfectStreak(0)
    perfectStreakRef.current = 0
    scoreRefVal.current = 0
    prevSkyIdxRef.current = 0
    milestonesHitRef.current = new Set()
    setParticles([])
    setMissFlash(false)
    setScorePulse(null)
    cameraYRef.current = 0
    cameraTargetRef.current = 0
    cameraOvershootRef.current = 0
  }

  useEffect(() => () => { cancelAnimationFrame(rafRef.current) }, [])

  // Sky tier — every 12 placed pieces escalates one step.
  const skyIdx = Math.min(SKIES.length - 1, Math.floor(score / 12))

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
          style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', border: '2px solid #1E3A8A', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          EREN STACK
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* Field. Inner shake host re-keys on miss to retrigger CSS shake without
          remounting the field (fieldRef stays attached so measure() values
          survive). */}
      <div ref={fieldRef} onPointerDown={dropPiece}
        className="relative flex-1 overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: 'pointer' }}>
      <div key={`shake-${shakeKey}`} style={{
        position: 'absolute', inset: 0,
        animation: shakeKey > 0 ? 'stk-shake 220ms steps(6, end)' : undefined,
      }}>

        {/* Sky layers — crossfade */}
        {SKIES.map((sky, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, background: sky,
            opacity: i === skyIdx ? 1 : 0,
            transition: 'opacity 1.2s ease',
            pointerEvents: 'none',
          }} />
        ))}

        {/* Stars (only for dusk + night + space tiers) */}
        {skyIdx >= 2 && (
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: skyIdx >= 2 ? 1 : 0, transition: 'opacity 1.2s' }}>
            {STAR_POSITIONS.map((s, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: s.left, top: s.top,
                width: s.size, height: s.size,
                background: '#FFFFFF',
                borderRadius: '50%',
                opacity: 0.8,
                animation: `stk-twinkle 2.6s ease-in-out ${s.delay} infinite`,
              }} />
            ))}
          </div>
        )}

        {/* Tower layer — translated by camera. Pieces below ground are still
            drawn so the trimming feels grounded. */}
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-cameraYRef.current}px)`, willChange: 'transform' }}>
          {/* Ground line */}
          <div style={{
            position: 'absolute', left: -50, right: -50,
            top: fieldDims.h - 30,
            height: 30,
            background: 'repeating-linear-gradient(90deg, #16a34a 0 8px, #15803d 8px 16px)',
            borderTop: '3px solid #052e16',
          }} />

          {/* Tower */}
          {towerRef.current.map(b => <MemoPiece key={b.id} block={b} />)}

          {/* Active piece (above tower) */}
          {currentRef.current && phase === 'running' && (
            <Piece block={currentRef.current} active />
          )}

          {/* Falling trimmed bits */}
          {fallingRef.current.map(f => <Piece key={`f-${f.id}`} block={f} falling />)}
        </div>

        {/* Score (in viewport space, above the tower). Pulses on every drop;
            tints gold on perfect. Key re-trigger plays the keyframe. */}
        {phase !== 'idle' && (
          <div
            key={`score-${scorePulse?.id ?? 0}`}
            className="absolute font-pixel pointer-events-none"
            style={{
              top: 18, left: '50%', transform: 'translateX(-50%)',
              fontSize: 36,
              color: scorePulse?.perfect ? '#FDE68A' : 'white',
              textShadow: scorePulse?.perfect
                ? '3px 3px 0 #000, 0 0 12px rgba(253,224,71,0.6)'
                : '3px 3px 0 #000, 0 0 10px rgba(255,255,255,0.4)',
              letterSpacing: 2,
              animation: scorePulse ? 'stk-score-pulse 180ms cubic-bezier(0.34,1.56,0.64,1)' : undefined,
              transition: 'color 220ms',
            }}>
            {score}
          </div>
        )}

        {/* Perfect streak badge — pops in on entry, shakes red on break. */}
        {phase !== 'idle' && perfectStreak >= 2 && (
          <div
            key={`streak-${perfectStreak}`}
            className="absolute font-pixel pointer-events-none" style={{
              top: 64, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.5)',
              border: '2px solid #FDE68A',
              borderRadius: 3,
              padding: '4px 10px',
              fontSize: 8, color: '#FDE68A', letterSpacing: 2,
              boxShadow: '0 0 12px rgba(253,224,71,0.5)',
              animation: 'stk-streak-in 220ms cubic-bezier(0.34,1.56,0.64,1)',
            }}>
            x{perfectStreak} PERFECT
          </div>
        )}
        {/* Streak-broken ghost — brief red flash where the badge was. */}
        {phase !== 'idle' && streakBreak > 0 && (
          <div
            key={`streakbreak-${streakBreak}`}
            className="absolute font-pixel pointer-events-none" style={{
              top: 64, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.5)',
              border: '2px solid #FCA5A5',
              borderRadius: 3,
              padding: '4px 10px',
              fontSize: 8, color: '#FCA5A5', letterSpacing: 2,
              boxShadow: '0 0 12px rgba(252,165,165,0.5)',
              animation: 'stk-streak-break 420ms steps(8, end) forwards',
            }}>
            STREAK BROKEN
          </div>
        )}

        {/* Floater */}
        {floater && (
          <div className="absolute pointer-events-none font-pixel" style={{
            left: floater.x, top: floater.y - cameraYRef.current,
            transform: 'translateX(-50%)',
            color: floater.color,
            fontSize: 10,
            letterSpacing: 2,
            textShadow: '2px 2px 0 #000',
            animation: 'stk-float 0.8s ease-out forwards',
          }}>
            {floater.text}
          </div>
        )}

        {/* Particles (perfect star bursts + trim dust puffs) — drawn in world
            space so they ride the camera transform like the tower. */}
        {particles.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-cameraYRef.current}px)`, pointerEvents: 'none' }}>
            {particles.map(p => (
              <div key={p.id} style={{
                position: 'absolute',
                left: p.x, top: p.y,
                width: p.kind === 'star' ? 3 : 2,
                height: p.kind === 'star' ? 3 : 2,
                background: p.color,
                borderRadius: 1,
                boxShadow: p.kind === 'star' ? `0 0 0 1px ${p.color}` : undefined,
                imageRendering: 'pixelated',
                animation: p.kind === 'star'
                  ? `stk-burst 500ms steps(10, end) forwards`
                  : `stk-dust 400ms steps(8, end) forwards`,
                ['--dx' as string]: `${p.dx}px`,
                ['--dy' as string]: `${p.dy}px`,
              } as React.CSSProperties} />
            ))}
          </div>
        )}

        {/* Miss flash — brief red full-screen tint right when endGame fires,
            so failure registers before the modal arrives. */}
        {missFlash && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'rgba(220, 38, 38, 0.35)',
            animation: 'stk-miss-flash 200ms steps(4, end) forwards',
          }} />
        )}

        {/* Idle */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div style={{
              padding: '14px 22px',
              background: 'rgba(0,0,0,0.55)',
              border: '3px solid rgba(255,255,255,0.5)',
              borderRadius: 6,
              boxShadow: '0 4px 0 rgba(0,0,0,0.4)',
            }}>
              <p className="font-pixel text-white text-center" style={{ fontSize: 9, letterSpacing: 2 }}>TAP TO START</p>
              <p className="font-pixel text-center mt-2" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>TAP AGAIN TO DROP · STACK HIGH</p>
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
                border: '3px solid #3B82F6',
                borderRadius: 6,
                boxShadow: '0 6px 0 #1E3A8A, 0 0 24px rgba(59,130,246,0.4)',
                animation: 'stk-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>
              <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 3 }}>GAME OVER</p>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex flex-col items-center">
                  <span className="font-pixel" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>HEIGHT</span>
                  <span className="font-pixel text-white" style={{ fontSize: 22 }}>{score}</span>
                </div>
                <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
                <div className="flex flex-col items-center">
                  <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                  <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
                </div>
              </div>
              {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => { playSound('ui_tap'); reset() }}
                  className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                    border: '2px solid #1E3A8A',
                    borderRadius: 3,
                    boxShadow: '0 4px 0 #1E3A8A',
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
      </div>

      <style jsx global>{`
        @keyframes stk-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes stk-float {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-26px); }
        }
        @keyframes stk-twinkle {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
        /* 220ms field shake on total miss — chunky steps(), no easing, sells
           the impact without smearing the pixel art. */
        @keyframes stk-shake {
          0%   { transform: translate(0, 0); }
          15%  { transform: translate(-4px, 2px); }
          30%  { transform: translate(4px, -2px); }
          45%  { transform: translate(-3px, 0); }
          60%  { transform: translate(3px, 1px); }
          80%  { transform: translate(-2px, -1px); }
          100% { transform: translate(0, 0); }
        }
        /* Score number — quick scale-up + snap-back on every placement. */
        @keyframes stk-score-pulse {
          0%   { transform: translateX(-50%) scale(1); }
          45%  { transform: translateX(-50%) scale(1.18); }
          100% { transform: translateX(-50%) scale(1); }
        }
        /* Streak badge entrance — overshoot pop. */
        @keyframes stk-streak-in {
          0%   { transform: translateX(-50%) scale(0.6); opacity: 0; }
          60%  { transform: translateX(-50%) scale(1.15); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        /* Streak-broken ghost — shake then fade. */
        @keyframes stk-streak-break {
          0%   { transform: translateX(-50%) translateX(0); opacity: 1; }
          25%  { transform: translateX(-50%) translateX(-3px); opacity: 1; }
          50%  { transform: translateX(-50%) translateX(3px); opacity: 1; }
          75%  { transform: translateX(-50%) translateX(-2px); opacity: 0.6; }
          100% { transform: translateX(-50%) translateX(0); opacity: 0; }
        }
        /* Star burst on perfect drops — radiate outward, fade out. */
        @keyframes stk-burst {
          0%   { transform: translate(0, 0); opacity: 1; }
          100% { transform: translate(var(--dx, 0), var(--dy, 0)); opacity: 0; }
        }
        /* Dust puff on imperfect drops — small upward drift + fade. */
        @keyframes stk-dust {
          0%   { transform: translate(0, 0); opacity: 0.9; }
          100% { transform: translate(var(--dx, 0), var(--dy, 0)); opacity: 0; }
        }
        /* Falling trimmed chunk — fade out in the back half of its descent. */
        @keyframes stk-fall-fade {
          0%   { opacity: 1; }
          55%  { opacity: 1; }
          100% { opacity: 0; }
        }
        /* Brief red full-screen tint on game-over. */
        @keyframes stk-miss-flash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

const STAR_POSITIONS = Array.from({ length: 28 }, () => ({
  left: `${Math.random() * 100}%`,
  top:  `${Math.random() * 70}%`,
  size: 1 + Math.random() * 2,
  delay: `${Math.random() * 2.5}s`,
}))

// ─── A single tower piece. Rendered as a chunky pixel block with a texture. ─
function Piece({ block, active = false, falling = false }: { block: Block; active?: boolean; falling?: boolean }) {
  const palette = PALETTES[block.hue % PALETTES.length]
  return (
    <div style={{
      position: 'absolute',
      left: block.x,
      top: block.y,
      width: block.width,
      height: PIECE_HEIGHT,
      background: `linear-gradient(180deg, ${palette.light} 0%, ${palette.fill} 50%, ${palette.edge} 100%)`,
      border: `2px solid ${palette.edge}`,
      borderRadius: 3,
      boxShadow: active
        ? `inset 0 1px 0 rgba(255,255,255,0.45), 0 0 14px ${palette.fill}99, 0 4px 0 ${palette.edge}`
        : `inset 0 1px 0 rgba(255,255,255,0.4), 0 3px 0 ${palette.edge}`,
      transform: falling ? `rotate(${(block.id * 31) % 90 - 45}deg)` : undefined,
      transition: falling ? 'transform 0.2s' : undefined,
      // Falling chunks fade out so they feel like they "disintegrate" rather
      // than coldly slide off the bottom of the field.
      animation: falling ? 'stk-fall-fade 700ms ease-in forwards' : undefined,
    }}>
      {/* Pixel-art texture rivets/strands per variant */}
      <PieceTexture variant={block.texture} edge={palette.edge} />
    </div>
  )
}

// Tower blocks are immutable after push (dropPiece replaces, never mutates), so a
// shallow-equal bailout skips re-rendering the whole tower every rAF frame.
const MemoPiece = memo(Piece)

function PieceTexture({ variant, edge }: { variant: number; edge: string }) {
  const dot = (left: string, top: string, color = edge) => (
    <div style={{ position: 'absolute', left, top, width: 3, height: 3, background: color, borderRadius: 1 }} />
  )
  if (variant === 0) {  // 4 corner rivets — like a metal box
    return <>{dot('4px', '4px')}{dot('calc(100% - 7px)', '4px')}{dot('4px', 'calc(100% - 7px)')}{dot('calc(100% - 7px)', 'calc(100% - 7px)')}</>
  }
  if (variant === 1) {  // central diamond — like a present
    return (
      <>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: 10, height: 10, border: `2px solid ${edge}`, borderRadius: 1 }} />
      </>
    )
  }
  if (variant === 2) {  // dashed band — like a yarn ball wrap
    return (
      <div style={{
        position: 'absolute', left: 4, right: 4, top: '50%', height: 2, transform: 'translateY(-50%)',
        background: `repeating-linear-gradient(90deg, ${edge} 0 4px, transparent 4px 8px)`,
      }} />
    )
  }
  // variant 3: scratch lines — like a kitty post
  return (
    <>
      <div style={{ position: 'absolute', left: 6, top: 6, width: 14, height: 1, background: edge, opacity: 0.5 }} />
      <div style={{ position: 'absolute', left: 8, top: 14, width: 12, height: 1, background: edge, opacity: 0.5 }} />
      <div style={{ position: 'absolute', left: 5, top: 22, width: 10, height: 1, background: edge, opacity: 0.5 }} />
    </>
  )
}

// Avoid unused import warning — IconCrown / IconStar aren't shown but we keep
// them imported in case we want decorative chips later.
void IconCrown; void IconStar
