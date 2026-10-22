'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useCat } from '@/hooks/useCat'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useErenIdle } from '@/hooks/useErenIdle'
import ErenReact, { useErenReaction } from '@/components/games/ErenReact'
import GameCoinReward from '@/components/games/GameCoinReward'
import { playSound } from '@/lib/sounds'
import {
  GameTopBar, GameStatRow, GameStat, GameStartCard, GameArtTile, GameResultCard, GAME_BOARD_TOP,
} from '@/components/games/GameChrome'
import { GAME_TINT, M, MeadowIcon, RADIUS, Tag, TINT } from '@/components/meadow'
import { fireMinigameDone } from '@/lib/minigames'

// Each pad has its own colour AND audio frequency so the round literally plays
// a tune. Frequencies are a triad-ish set so wrong sequences sound dissonant.
const PADS = [
  { color: M.love,    tint: TINT.love,  icon: 'heart', tone: 392.0, name: 'pink'   }, // G4
  { color: M.coinRim, tint: TINT.amber, icon: 'star',  tone: 523.3, name: 'yellow' }, // C5
  { color: M.leaf,    tint: TINT.leaf,  icon: 'leaf',  tone: 659.3, name: 'green'  }, // E5
  { color: '#9478B4', tint: TINT.lilac, icon: 'moon',  tone: 784.0, name: 'purple' }, // G5
] as const

// Base timings — show speed now ramps up with sequence length so longer rounds
// actually feel tense instead of metronomic.
const FLASH_MS_BASE = 420
const GAP_MS_BASE   = 130
const FLASH_MS_MIN  = 200
const GAP_MS_MIN    = 60
const FAIL_MS   = 700
const PRE_SHOW_MS = 600

function showTimings(seqLen: number) {
  // Smooth ramp: full speed by ~round 18. Each round shaves a small step.
  const t = Math.min(1, (seqLen - 1) / 17)
  const flash = Math.round(FLASH_MS_BASE - (FLASH_MS_BASE - FLASH_MS_MIN) * t)
  const gap   = Math.round(GAP_MS_BASE   - (GAP_MS_BASE   - GAP_MS_MIN)   * t)
  return { flash, gap }
}

let _ac: AudioContext | null = null
function tone(freq: number, dur = 0.32) {
  if (typeof window === 'undefined') return
  type WebkitAW = Window & { webkitAudioContext?: typeof AudioContext }
  if (!_ac) _ac = new (window.AudioContext || (window as unknown as WebkitAW).webkitAudioContext!)()
  const ac = _ac
  if (ac.state === 'suspended') void ac.resume()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.value = freq
  osc.connect(gain).connect(ac.destination)
  gain.gain.setValueAtTime(0.0001, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.22, ac.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
  osc.start()
  osc.stop(ac.currentTime + dur + 0.05)
}

type Particle = { id: number; x: number; y: number; dx: number; dy: number; color: string }
type ScorePop = { id: number; text: string; color: string }

export default function ErenSaysGame() {
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

  const [phase, setPhase]         = useState<'idle' | 'showing' | 'awaiting' | 'fail' | 'gameover'>('idle')
  // No involuntary blinking while he's demonstrating the sequence — that face
  // is information the player is trying to read.
  const idle = useErenIdle(phase !== 'showing')
  const rx = useErenReaction()
  const [round, setRound]         = useState(0)
  const [bestRound, setBestRound] = useState(0)
  // Persist BEST across visits (matches flappy/lane).
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem('eren_says_best') || '', 10)
      if (Number.isFinite(n) && n > 0) setBestRound(n)
    } catch { /* localStorage unavailable */ }
  }, [])
  const [activePad, setActivePad] = useState<number | null>(null)
  const [telegraphPad, setTelegraphPad] = useState<number | null>(null) // anticipatory ring
  const [trailPad, setTrailPad]   = useState<number | null>(null)        // afterglow trail
  const [flashFail, setFlashFail] = useState(false)
  const [shake, setShake]         = useState(false)
  const [roundPulse, setRoundPulse] = useState(0)        // bumped on successful round
  const [streakBadge, setStreakBadge] = useState<number | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [scorePops, setScorePops] = useState<ScorePop[]>([])
  const [displayedScore, setDisplayedScore] = useState(0) // count-up score on gameover
  const [reward, setReward]       = useState<GameRewardResult | null>(null)
  const [userStep, setUserStep]   = useState(0)           // mirrors userIdxRef for render

  const seqRef     = useRef<number[]>([])
  const userIdxRef = useRef(0)
  const cancelledRef = useRef(false)
  const savedRef   = useRef(false)
  const particleIdRef = useRef(0)
  const popIdRef = useRef(0)

  useEffect(() => () => { cancelledRef.current = true }, [])

  // Sequence sleep routed through tracked timers so a pending playback step is
  // flushed on unmount (back button) and on clearAll() at restart.
  const sleep = (ms: number) => new Promise<void>(r => { timers.setTimeout(r, ms) })

  function burstParticles(centerX: number, centerY: number, color: string, count = 6) {
    const fresh: Particle[] = []
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4
      const r = 30 + Math.random() * 22
      fresh.push({
        id: ++particleIdRef.current,
        x: centerX,
        y: centerY,
        dx: Math.cos(a) * r,
        dy: Math.sin(a) * r,
        color,
      })
    }
    setParticles(p => [...p, ...fresh])
    const ids = fresh.map(f => f.id)
    timers.setTimeout(() => setParticles(p => p.filter(x => !ids.includes(x.id))), 800)
  }

  function pushScorePop(text: string, color = '#FDE68A') {
    const id = ++popIdRef.current
    setScorePops(p => [...p, { id, text, color }])
    timers.setTimeout(() => setScorePops(p => p.filter(x => x.id !== id)), 850)
  }

  async function showSequence(seq: number[]) {
    setPhase('showing')
    setTrailPad(null)
    setTelegraphPad(null)
    const { flash, gap } = showTimings(seq.length)
    await sleep(PRE_SHOW_MS)
    for (let i = 0; i < seq.length; i++) {
      const idx = seq[i]
      if (cancelledRef.current) return
      // anticipatory ring telegraph
      setTelegraphPad(idx)
      await sleep(Math.min(80, Math.floor(gap / 2)))
      if (cancelledRef.current) return
      setTelegraphPad(null)
      setActivePad(idx)
      playSound('ey_sequence_show')
      tone(PADS[idx].tone, Math.max(0.18, flash / 1000))
      await sleep(flash)
      if (cancelledRef.current) return
      setActivePad(null)
      setTrailPad(idx)             // afterglow
      await sleep(gap)
      setTrailPad(null)
    }
    if (cancelledRef.current) return
    userIdxRef.current = 0
    setUserStep(0)
    setPhase('awaiting')
  }

  function startGame() {
    timers.clearAll()
    cancelledRef.current = false
    savedRef.current = false
    seqRef.current = [Math.floor(Math.random() * 4)]
    userIdxRef.current = 0
    setUserStep(0)
    setRound(1)
    setRoundPulse(0)
    setStreakBadge(null)
    setParticles([])
    setScorePops([])
    setDisplayedScore(0)
    setReward(null)
    showSequence(seqRef.current)
  }

  function nextRound() {
    seqRef.current = [...seqRef.current, Math.floor(Math.random() * 4)]
    setRound(seqRef.current.length)
    showSequence(seqRef.current)
  }

  function handlePad(idx: number) {
    if (phase !== 'awaiting') return
    setActivePad(idx)
    timers.setTimeout(() => setActivePad(null), 180)

    const expected = seqRef.current[userIdxRef.current]
    if (idx !== expected) {
      playSound('ey_miss')
      setFlashFail(true)
      rx.bad()
      setPhase('fail')
      if (!reduced) {
        setShake(true)
        timers.setTimeout(() => setShake(false), 240)
      }
      const reached = seqRef.current.length - 1   // longest *complete* round before fail
      saveScore(reached)
      timers.setTimeout(() => {
        setFlashFail(false)
        setPhase('gameover')
        playSound('ey_gameover')
        // start count-up animation for displayed score
        animateScoreCountUp(reached)
      }, FAIL_MS)
      return
    }
    // correct tap
    playSound('ey_pad_press')
    tone(PADS[idx].tone, 0.18)
    userIdxRef.current++
    setUserStep(userIdxRef.current)
    if (userIdxRef.current >= seqRef.current.length) {
      const completed = seqRef.current.length
      setBestRound(b => Math.max(b, completed))
      try {
        const prev = parseInt(localStorage.getItem('eren_says_best') || '0', 10) || 0
        if (completed > prev) localStorage.setItem('eren_says_best', String(completed))
      } catch { /* ignore */ }
      playSound('ey_round_clear')
      setRoundPulse(p => p + 1)
      rx.good()
      pushScorePop(`+${completed}`, '#A3F0C0')
      // particle burst from center
      if (!reduced) burstParticles(50, 50, PADS[idx].color, 6)
      // streak milestone every 5 rounds
      if (completed > 0 && completed % 5 === 0) {
        playSound('ey_streak_milestone')
        setStreakBadge(completed)
        // extra confetti
        if (!reduced) burstParticles(50, 50, '#FDE68A', 8)
        timers.setTimeout(() => setStreakBadge(null), 1400)
      }
      timers.setTimeout(nextRound, 600)
    }
  }

  function animateScoreCountUp(target: number) {
    if (target <= 0) { setDisplayedScore(0); return }
    setDisplayedScore(0)
    const steps = target
    const stepMs = Math.max(40, Math.min(120, Math.floor(900 / Math.max(1, steps))))
    let i = 0
    const tick = () => {
      i++
      setDisplayedScore(i)
      // soft tick on each increment
      tone(440 + i * 18, 0.05)
      if (i < steps) timers.setTimeout(tick, stepMs)
    }
    timers.setTimeout(tick, 180)
  }

  function saveScore(reached: number) {
    if (savedRef.current || !user?.id) return
    savedRef.current = true
    setReward(reportGameResult({ gameType: 'eren_says', score: reached }))
    if (reached > 0) {
      fireMinigameDone('eren_says', reached)
      completeTask('daily_game')
      if (reached >= 8) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function reset() {
    cancelledRef.current = true
    timers.clearAll()
    timers.setTimeout(() => {
      cancelledRef.current = false
      setPhase('idle')
      setRound(0)
      setActivePad(null)
      setTelegraphPad(null)
      setTrailPad(null)
      seqRef.current = []
      userIdxRef.current = 0
      setUserStep(0)
      setRoundPulse(0)
      setStreakBadge(null)
      setParticles([])
      setScorePops([])
      setDisplayedScore(0)
      setReward(null)
    }, 50)
  }

  const reachedScore = Math.max(0, seqRef.current.length - 1)

  return (
    <div className={`meadow-root says-game fixed inset-0 z-40 flex flex-col overflow-hidden game-shell${shake ? ' shake' : ''}`} style={{
      background: GAME_TINT.eren_says,
    }}>
      {/* Header + stats — the shared Meadow game chrome. */}
      <GameTopBar title={cat.t('{name} Says')} onBack={() => { playSound('ui_back'); router.push('/games') }} />

      <GameStatRow style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <GameStat label="Round" value={round || '—'} tone={phase === 'fail' ? 'warn' : 'plain'}
          pulse={roundPulse} ariaLabel={`Round ${round}`} style={{ justifyContent: 'center' }} />
        <GameStat icon={<MeadowIcon name="trophy" size={18} />} label="Best" value={bestRound}
          style={{ justifyContent: 'center' }} />
      </GameStatRow>

      {/* Clears the absolutely-placed top bar + stat row above. */}
      <div aria-hidden className="flex-shrink-0" style={{ height: 104 }} />

      {/* Round status */}
      <div className="flex flex-col items-center pt-2 pb-2 flex-shrink-0 relative">
        <div role="status" style={{ maxWidth: '100%', padding: '0 16px' }}>
        <Tag tone={phase === 'showing' ? 'amber' : 'leaf'} style={{
          minHeight: 36, height: 'auto', maxWidth: '100%', padding: '8px 16px', fontSize: 15,
          whiteSpace: 'normal', textAlign: 'center',
          ...(phase === 'fail' ? { color: M.danger, background: M.dangerTint } : {}),
        }}>
          {phase === 'showing'  ? 'Watch…' :
           phase === 'awaiting' ? `Your turn ${Math.min(userStep + 1, seqRef.current.length)}/${seqRef.current.length}` :
           phase === 'fail'     ? 'Oops!' :
           phase === 'gameover' ? 'Game over' :
                                  cat.t('Watch {name}, then repeat')}
        </Tag>
        </div>

        {/* floating score popups */}
        <div className="absolute pointer-events-none" style={{ top: 6, left: '50%' }}>
          {scorePops.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: 0,
              transform: 'translateX(-50%)',
              fontSize: 16, fontWeight: 800,
              color: M.leafInk, background: M.ground,
              padding: '4px 10px', borderRadius: RADIUS.pill,
              boxShadow: `0 3px 0 ${M.groundLip}`,
              animation: 'scorePop 0.85s cubic-bezier(0.22,1,0.36,1) forwards',
              whiteSpace: 'nowrap',
            }}>{p.text}</div>
          ))}
        </div>

        {/* streak milestone badge */}
        {streakBadge !== null && (
          <div className="absolute pointer-events-none" style={{
            top: -2,
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'streakIn 0.4s cubic-bezier(0.34,1.56,0.64,1), streakOut 0.3s ease-in 1.1s forwards',
            zIndex: 5,
          }}><Tag tone="amber" style={{ height: 36, fontSize: 15 }}>Streak x{streakBadge}</Tag></div>
        )}
      </div>

      {/* Pads + Eren */}
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{
        margin: '12px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)', containerType: 'size',
        visibility: phase === 'idle' ? 'hidden' : undefined,
      }}>
        <div className="says-board relative" role="group" aria-label="Sequence pads"
          style={{ width: 'min(100cqw, 100cqh, 348px)', aspectRatio: '1 / 1' }}>
          <div className="absolute inset-0 grid"
            style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
            {PADS.map((p, i) => {
              const isActive = activePad === i
              const isFail = phase === 'fail' && activePad === i
              const isTelegraph = telegraphPad === i
              const isTrail = trailPad === i
              return (
                <button type="button" key={i}
                  onClick={() => handlePad(i)}
                  disabled={phase !== 'awaiting'}
                  aria-label={`${p.name} pad`}
                  aria-pressed={isActive}
                  className="says-pad m-focus relative"
                  style={{
                    touchAction: 'manipulation',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    background: isFail ? M.dangerTint : isActive ? p.color : p.tint,
                    border: `3px solid ${isFail ? M.danger : isActive || isTrail ? p.color : M.ground}`,
                    borderRadius: RADIUS.card,
                    boxShadow: `0 ${isActive ? 2 : 4}px 0 ${M.groundLip}`,
                    transform: isActive && !reduced ? 'translateY(2px)' : undefined,
                    transition: 'transform 0.12s, background 0.12s, border-color 0.12s',
                    cursor: phase === 'awaiting' ? 'pointer' : 'default',
                  }}>
                  <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <MeadowIcon name={p.icon} size={44} mono color={isActive && !isFail ? M.ground : p.color} />
                  </div>
                  {/* anticipatory concentric ring telegraph */}
                  {isTelegraph && (
                    <div className="absolute pointer-events-none" style={{
                      inset: 8,
                      borderRadius: 'inherit',
                      border: `3px solid ${p.color}`,
                      animation: 'padTelegraph 220ms steps(4, end) forwards',
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Eren chibi at center */}
          <div className="absolute pointer-events-none"
            style={{
              left: '50%', top: '50%',
              width: 88, height: 88, borderRadius: RADIUS.pill,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: M.ground, boxShadow: `0 3px 0 ${M.groundLip}`,
              transform: 'translate(-50%, -50%)',
              animation: phase === 'awaiting'
                ? (reduced ? 'none' : 'eyDance 1s ease-in-out infinite')
                : (roundPulse > 0 && phase === 'showing' ? 'eyCheer 0.5s cubic-bezier(0.34,1.56,0.64,1)' : 'none'),
            }}>
            <ErenReact reaction={rx.reaction} size={68} origin="center">
              <ErenChibi size={68} blink={phase === 'showing' || idle.blink} fail={flashFail}
                cheer={streakBadge !== null} twitch={idle.twitch} glance={idle.glance} />
            </ErenReact>
          </div>

          {/* particle burst overlay (percent-based so it scales with pad area) */}
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {particles.map(pt => (
              <span key={pt.id} style={{
                position: 'absolute',
                left: `${pt.x}%`,
                top: `${pt.y}%`,
                width: 5,
                height: 5,
                background: pt.color,
                borderRadius: 2,
                // custom property used by keyframe
                ['--dx' as string]: `${pt.dx}px`,
                ['--dy' as string]: `${pt.dy}px`,
                animation: 'particleFly 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
              }} />
            ))}
          </div>

          {/* Failure red wash */}
          {flashFail && !reduced && (
            <div className="absolute inset-0 pointer-events-none rounded-lg"
              style={{ background: 'rgba(220,38,38,0.25)', animation: 'failPulse 0.7s ease-out' }} />
          )}
        </div>
      </div>

      {/* Idle / gameover overlay */}
      {phase === 'idle' && (
        <GameStartCard
          title={cat.t('{name} Says')}
          art={PADS.map(p => (
            <GameArtTile key={p.name} size={38} tint={p.tint}>
              <MeadowIcon name={p.icon} size={22} mono color={p.color} />
            </GameArtTile>
          ))}
          best={bestRound}
          onStart={() => { playSound('ui_tap'); startGame() }}
          style={{ top: GAME_BOARD_TOP, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', overflowY: 'auto' }}
        >
          {cat.t('Watch {his} sequence of pads, then repeat it back. Every round adds one more and plays a little faster.')}
        </GameStartCard>
      )}

      {phase === 'gameover' && (
        <GameResultCard
          headline="Game over"
          score={
            <span style={{
              display: 'inline-block',
              transition: 'transform 0.15s',
              transform: displayedScore < reachedScore ? 'scale(1.06)' : 'scale(1)',
            }}>{displayedScore}</span>
          }
          scoreLabel={reachedScore === 1 ? 'round cleared' : 'rounds cleared'}
          best={bestRound}
          reward={reward && <GameCoinReward coins={reward.coins} blocked={reward.blocked} />}
          onAgain={() => { playSound('ui_tap'); reset() }}
          onBack={() => { playSound('ui_back'); router.push('/games') }}
        />
      )}

      <style>{`
        @keyframes failPulse {
          0%   { opacity: 0.6; }
          100% { opacity: 0; }
        }
        @keyframes eyDance {
          0%, 100% { transform: translate(-50%, -50%); }
          50%      { transform: translate(-50%, calc(-50% - 4px)); }
        }
        @keyframes eyCheer {
          0%   { transform: translate(-50%, -50%) scale(1); }
          50%  { transform: translate(-50%, calc(-50% - 8px)) scale(1.12); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes scorePop {
          0%   { transform: translate(-50%, 0)     scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -8px)  scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -34px) scale(1);   opacity: 0; }
        }
        @keyframes streakIn {
          0%   { transform: translate(-50%, -20px) scale(0.4); opacity: 0; }
          100% { transform: translate(-50%, 0)     scale(1);   opacity: 1; }
        }
        @keyframes streakOut {
          0%   { opacity: 1; }
          100% { transform: translate(-50%, -10px) scale(0.9); opacity: 0; }
        }
        @keyframes padTelegraph {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.05); opacity: 0; }
        }
        @keyframes particleFly {
          0%   { transform: translate(-50%, -50%) translate(0, 0)            scale(1);   opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; }
        }
        @keyframes shellShake {
          0%   { transform: translate(0, 0); }
          15%  { transform: translate(-5px, 2px); }
          30%  { transform: translate(5px, -2px); }
          45%  { transform: translate(-4px, 3px); }
          60%  { transform: translate(4px, -1px); }
          75%  { transform: translate(-2px, 2px); }
          100% { transform: translate(0, 0); }
        }
        .says-game.shake { animation: shellShake 0.24s steps(7, end); }
        @media (prefers-reduced-motion: reduce) {
          .says-game *, .says-game *::before, .says-game *::after {
            animation: none !important;
            transition: none !important;
          }
          .says-game { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Eren chibi (forward-gaze, smile, cheeks) ───────────────────────────────
function ErenChibi({ size = 68, blink = false, fail = false, cheer = false, twitch = false, glance = 0 }:
  { size?: number; blink?: boolean; fail?: boolean; cheer?: boolean; twitch?: boolean; glance?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="3" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="4" y="4" width="1" height="1" fill="#F4B0B8" />
      {/* right ear flicks a pixel on an idle twitch */}
      <g transform={twitch ? 'translate(0,1)' : undefined}>
        <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
      </g>
      <rect x="5" y="3" width="12" height="1" fill="#4A2E1A" />
      <rect x="4" y="4" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="5" width="16" height="1" fill="#4A2E1A" />
      <rect x="3" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="18" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="4" y="5" width="14" height="1" fill="#F9EDD5" />
      <rect x="4" y="6" width="14" height="6" fill="#F9EDD5" />
      {/* eyes — three distinct states. Earlier the "fail" face still drew
          normal eyes which clashed with the frown; now fail switches to a
          squinted >_< pair which reads cleanly as "oh no" at this resolution. */}
      {fail ? (
        <>
          {/* left eye \ */}
          <rect x="6" y="7" width="1" height="1" fill="#4A2E1A" />
          <rect x="7" y="8" width="1" height="1" fill="#4A2E1A" />
          {/* right eye / */}
          <rect x="14" y="8" width="1" height="1" fill="#4A2E1A" />
          <rect x="15" y="7" width="1" height="1" fill="#4A2E1A" />
        </>
      ) : blink ? (
        <>
          <rect x="6"  y="8" width="2" height="1" fill="#4A2E1A" />
          <rect x="14" y="8" width="2" height="1" fill="#4A2E1A" />
        </>
      ) : cheer ? (
        // happy ^_^ eyes during streak cheer
        <>
          <rect x="6"  y="7" width="1" height="1" fill="#4A2E1A" />
          <rect x="7"  y="8" width="1" height="1" fill="#4A2E1A" />
          <rect x="8"  y="7" width="1" height="1" fill="#4A2E1A" />
          <rect x="13" y="7" width="1" height="1" fill="#4A2E1A" />
          <rect x="14" y="8" width="1" height="1" fill="#4A2E1A" />
          <rect x="15" y="7" width="1" height="1" fill="#4A2E1A" />
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

      {/* cheeks — moved up to y=9 so they sit beside the eyes (where actual
          cheeks are) instead of clashing with the dark nose-bottom on y=10. */}
      <rect x="5"  y="9" width="1" height="1" fill="#FFB6C8" />
      <rect x="16" y="9" width="1" height="1" fill="#FFB6C8" />

      {/* nose */}
      <rect x="10" y="9"  width="2" height="1" fill="#F48B9B" />
      <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />

      {/* mouth corners (only on the happy face) */}
      {!fail && (
        <>
          <rect x="9"  y="11" width="1" height="1" fill="#4A2E1A" />
          <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
        </>
      )}

      {/* chin */}
      <rect x="4" y="12" width="14" height="1" fill="#4A2E1A" />
      <rect x="5" y="12" width="12" height="1" fill="#F9EDD5" />

      {/* mouth bottom — drawn AFTER the chin so it actually shows on the cream.
          Old code put fail-frown corners at y=12 underneath the chin where
          they got overwritten; this draws either the smile V or the gasp "o"
          on top, so the expression is visible. */}
      {fail ? (
        // small "o" gasp — 2×2 dark square
        <>
          <rect x="10" y="11" width="2" height="1" fill="#4A2E1A" />
          <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />
        </>
      ) : (
        <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />
      )}
      {/* body */}
      <rect x="6" y="13" width="10" height="1" fill="#4A2E1A" />
      <rect x="5" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="16" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="6" y="14" width="10" height="5" fill="#F9EDD5" />
      <rect x="6" y="19" width="10" height="1" fill="#4A2E1A" />
      <rect x="6" y="20" width="3" height="1" fill="#4A2E1A" />
      <rect x="13" y="20" width="3" height="1" fill="#4A2E1A" />
    </svg>
  )
}
