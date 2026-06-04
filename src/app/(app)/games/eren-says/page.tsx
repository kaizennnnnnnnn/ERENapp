'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'
import { IconPaw, IconStar } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'

// Each pad has its own colour AND audio frequency so the round literally plays
// a tune. Frequencies are a triad-ish set so wrong sequences sound dissonant.
const PADS = [
  { color: '#FF6B9D', glow: 'rgba(255,107,157,0.85)', tone: 392.0, name: 'pink'   }, // G4
  { color: '#FBBF24', glow: 'rgba(251,191,36,0.85)',  tone: 523.3, name: 'yellow' }, // C5
  { color: '#34D399', glow: 'rgba(52,211,153,0.85)',  tone: 659.3, name: 'green'  }, // E5
  { color: '#7C3AED', glow: 'rgba(124,58,237,0.85)',  tone: 784.0, name: 'purple' }, // G5
] as const

// Base timings — show speed now ramps up with sequence length so longer rounds
// actually feel tense instead of metronomic.
const FLASH_MS_BASE = 420
const GAP_MS_BASE   = 130
const FLASH_MS_MIN  = 200
const GAP_MS_MIN    = 60
const FAIL_MS   = 700
const PRE_SHOW_MS = 600
const COIN_CAP = 40

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

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

type Particle = { id: number; x: number; y: number; dx: number; dy: number; color: string }
type ScorePop = { id: number; text: string; color: string }

export default function ErenSaysGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [phase, setPhase]         = useState<'idle' | 'showing' | 'awaiting' | 'fail' | 'gameover'>('idle')
  const [round, setRound]         = useState(0)
  const [bestRound, setBestRound] = useState(0)
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
  const [coinsAwarded, setCoinsAwarded] = useState(0)
  const [userStep, setUserStep]   = useState(0)           // mirrors userIdxRef for render

  const seqRef     = useRef<number[]>([])
  const userIdxRef = useRef(0)
  const cancelledRef = useRef(false)
  const savedRef   = useRef(false)
  const particleIdRef = useRef(0)
  const popIdRef = useRef(0)

  useEffect(() => () => { cancelledRef.current = true }, [])

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
    setTimeout(() => setParticles(p => p.filter(x => !ids.includes(x.id))), 800)
  }

  function pushScorePop(text: string, color = '#FDE68A') {
    const id = ++popIdRef.current
    setScorePops(p => [...p, { id, text, color }])
    setTimeout(() => setScorePops(p => p.filter(x => x.id !== id)), 850)
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
    setCoinsAwarded(0)
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
    setTimeout(() => setActivePad(null), 180)

    const expected = seqRef.current[userIdxRef.current]
    if (idx !== expected) {
      playSound('ey_miss')
      setFlashFail(true)
      setPhase('fail')
      setShake(true)
      setTimeout(() => setShake(false), 240)
      const reached = seqRef.current.length - 1   // longest *complete* round before fail
      saveScore(reached)
      setTimeout(() => {
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
      playSound('ey_round_clear')
      setRoundPulse(p => p + 1)
      pushScorePop(`+${completed}`, '#A3F0C0')
      // particle burst from center
      burstParticles(50, 50, PADS[idx].color, 6)
      // streak milestone every 5 rounds
      if (completed > 0 && completed % 5 === 0) {
        playSound('ey_streak_milestone')
        setStreakBadge(completed)
        // extra confetti
        burstParticles(50, 50, '#FDE68A', 8)
        setTimeout(() => setStreakBadge(null), 1400)
      }
      setTimeout(nextRound, 600)
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
      if (i < steps) setTimeout(tick, stepMs)
    }
    setTimeout(tick, 180)
  }

  function saveScore(reached: number) {
    if (savedRef.current || !user?.id || reached <= 0) return
    savedRef.current = true
    supabase.from('game_scores').insert({ user_id: user.id, game_type: 'eren_says', score: reached })
      .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('eren_says save:', error) })
    fireMinigameDone('eren_says', reached)
    const coins = Math.min(COIN_CAP, reached * 2)
    setCoinsAwarded(coins)
    addCoins(coins)
    completeTask('daily_game')
    if (reached >= 8) completeTask('weekly_high_score')
    applyAction(user.id, 'play')
  }

  function reset() {
    cancelledRef.current = true
    setTimeout(() => {
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
      setCoinsAwarded(0)
    }, 50)
  }

  const reachedScore = Math.max(0, seqRef.current.length - 1)
  const coinsCap = reachedScore * 2 >= COIN_CAP

  return (
    <div className={`fixed inset-0 z-40 flex flex-col game-shell${shake ? ' shake' : ''}`} style={{
      background: 'radial-gradient(ellipse at top, #2D1659 0%, #1A0A33 55%, #0F0620 100%)',
    }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(12,6,26,0.95) 0%, rgba(12,6,26,0.6) 100%)',
        borderBottom: '2px solid rgba(167,139,250,0.3)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(167,139,250,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-purple-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', border: '2px solid #4C1D95', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          EREN SAYS
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestRound}
        </div>
      </div>

      {/* Round status */}
      <div className="flex flex-col items-center pt-4 pb-2 flex-shrink-0 relative">
        <div className="font-pixel" style={{ fontSize: 6, color: '#A78BFA', letterSpacing: 2 }}>ROUND</div>
        <div
          key={roundPulse}
          className="font-pixel"
          style={{
            fontSize: 28,
            color: phase === 'fail' ? '#FCA5A5' : '#FFFFFF',
            textShadow: '2px 2px 0 #2E0F5C',
            transform: phase === 'fail' ? 'scale(0.9)' : 'scale(1)',
            transition: 'transform 0.2s, color 0.2s',
            animation: roundPulse > 0 && phase !== 'fail' ? 'roundBump 0.4s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
          }}>{round || '—'}</div>
        <div className="font-pixel mt-1" style={{ fontSize: 7, color: '#C4B5FD', letterSpacing: 1.5 }}>
          {phase === 'showing'  ? 'WATCH…' :
           phase === 'awaiting' ? `YOUR TURN — ${Math.min(userStep + 1, seqRef.current.length)}/${seqRef.current.length}` :
           phase === 'fail'     ? 'OOPS!' :
           phase === 'gameover' ? 'GAME OVER' :
                                  'WATCH EREN, THEN REPEAT'}
        </div>

        {/* floating score popups */}
        <div className="absolute pointer-events-none" style={{ top: 6, left: '50%' }}>
          {scorePops.map(p => (
            <div key={p.id} className="font-pixel" style={{
              position: 'absolute',
              left: 0,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: p.color,
              textShadow: '1px 1px 0 #0F0620',
              animation: 'scorePop 0.85s cubic-bezier(0.22,1,0.36,1) forwards',
              whiteSpace: 'nowrap',
            }}>{p.text}</div>
          ))}
        </div>

        {/* streak milestone badge */}
        {streakBadge !== null && (
          <div className="absolute pointer-events-none font-pixel" style={{
            top: -2,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 10px',
            background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
            border: '2px solid #78350F',
            borderRadius: 4,
            boxShadow: '0 4px 0 #78350F, 0 0 18px rgba(251,191,36,0.6)',
            color: '#1F1100',
            fontSize: 9,
            letterSpacing: 2,
            animation: 'streakIn 0.4s cubic-bezier(0.34,1.56,0.64,1), streakOut 0.3s ease-in 1.1s forwards',
            zIndex: 5,
          }}>STREAK x{streakBadge}</div>
        )}
      </div>

      {/* Pads + Eren */}
      <div className="flex-1 flex items-center justify-center px-6 pb-4">
        <div className="relative" style={{ width: 'min(90vw, 360px)', aspectRatio: '1 / 1' }}>
          <div className="absolute inset-0 grid"
            style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
            {PADS.map((p, i) => {
              const isActive = activePad === i
              const isFail = phase === 'fail' && activePad === i
              const isTelegraph = telegraphPad === i
              const isTrail = trailPad === i
              return (
                <button key={i}
                  onClick={() => handlePad(i)}
                  disabled={phase !== 'awaiting'}
                  className="relative active:scale-95 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${p.color}, ${p.color}AA)`,
                    border: '4px solid rgba(0,0,0,0.45)',
                    borderRadius: i === 0 ? '40% 8px 8px 8px' : i === 1 ? '8px 40% 8px 8px' : i === 2 ? '8px 8px 8px 40%' : '8px 8px 40% 8px',
                    boxShadow: isActive
                      ? `0 0 28px 6px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 0 rgba(0,0,0,0.4)`
                      : isTrail
                      ? `0 0 14px 2px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 0 rgba(0,0,0,0.4)`
                      : `inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 0 rgba(0,0,0,0.4)`,
                    transform: isActive ? 'scale(1.05) translateY(-3px)' : 'scale(1)',
                    transition: 'transform 0.12s, box-shadow 0.18s steps(3, end)',
                    filter: phase === 'showing' && !isActive && !isTrail && !isTelegraph ? 'brightness(0.55)' : isFail ? 'brightness(0.5) saturate(0)' : 'none',
                    cursor: phase === 'awaiting' ? 'pointer' : 'default',
                  }}>
                  {/* Decorative paw print on each pad */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ opacity: isActive ? 0.7 : 0.25 }}>
                    <IconPaw size={Math.min(72, 80)} />
                  </div>
                  {/* anticipatory concentric ring telegraph */}
                  {isTelegraph && (
                    <div className="absolute pointer-events-none" style={{
                      inset: 8,
                      borderRadius: 'inherit',
                      border: `3px solid ${p.color}`,
                      boxShadow: `0 0 0 2px rgba(255,255,255,0.4)`,
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
              transform: 'translate(-50%, -50%)',
              animation: phase === 'awaiting'
                ? 'eyDance 1s ease-in-out infinite'
                : (roundPulse > 0 && phase === 'showing' ? 'eyCheer 0.5s cubic-bezier(0.34,1.56,0.64,1)' : 'none'),
            }}>
            <ErenChibi size={68} blink={phase === 'showing'} fail={flashFail} cheer={streakBadge !== null} />
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
                imageRendering: 'pixelated',
                boxShadow: `0 0 0 1px rgba(0,0,0,0.5)`,
                // custom property used by keyframe
                ['--dx' as string]: `${pt.dx}px`,
                ['--dy' as string]: `${pt.dy}px`,
                animation: 'particleFly 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
              }} />
            ))}
          </div>

          {/* Failure red wash */}
          {flashFail && (
            <div className="absolute inset-0 pointer-events-none rounded-lg"
              style={{ background: 'rgba(220,38,38,0.25)', animation: 'failPulse 0.7s ease-out' }} />
          )}
        </div>
      </div>

      {/* Idle / gameover overlay */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto px-6 py-5 flex flex-col items-center gap-3"
            style={{ background: 'rgba(15,6,32,0.85)', border: '3px solid #A78BFA', borderRadius: 6, boxShadow: '0 4px 0 #4C1D95, 0 0 24px rgba(167,139,250,0.4)' }}>
            <p className="font-pixel" style={{ fontSize: 10, letterSpacing: 2, color: '#FDE68A' }}>EREN SAYS</p>
            <p className="font-pixel text-center" style={{ fontSize: 7, color: '#C4B5FD', letterSpacing: 1, lineHeight: 1.6 }}>
              WATCH HIS SEQUENCE.<br />REPEAT IT BACK.
            </p>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)',
                border: '2px solid #2E0F5C',
                borderRadius: 3,
                boxShadow: '0 4px 0 #2E0F5C',
                fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5,
              }}>
              <IconStar size={12} /> START
            </button>
          </div>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
          <div className="px-6 py-5 flex flex-col items-center gap-3"
            style={{
              background: 'linear-gradient(180deg, #15122A 0%, #0F0A1E 100%)',
              border: '3px solid #FCA5A5',
              borderRadius: 6,
              boxShadow: '0 6px 0 #831843, 0 0 24px rgba(252,165,165,0.4)',
              animation: 'goPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 3 }}>GAME OVER</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>SCORE</span>
                <span className="font-pixel text-white" style={{
                  fontSize: 22,
                  transition: 'transform 0.15s',
                  transform: displayedScore < reachedScore ? 'scale(1.06)' : 'scale(1)',
                }}>{displayedScore}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestRound}</span>
              </div>
            </div>
            {coinsAwarded > 0 && (
              <div className="font-pixel mt-1 px-2 py-1" style={{
                fontSize: 7,
                letterSpacing: 1.5,
                color: coinsCap ? '#1F1100' : '#FDE68A',
                background: coinsCap ? 'linear-gradient(135deg, #FBBF24, #F59E0B)' : 'rgba(0,0,0,0.4)',
                border: coinsCap ? '2px solid #78350F' : '2px solid rgba(253,230,138,0.4)',
                borderRadius: 3,
                boxShadow: coinsCap ? '0 2px 0 #78350F' : 'none',
              }}>+{coinsAwarded} COINS{coinsCap ? ' — MAX!' : ''}</div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => { playSound('ui_tap'); reset() }}
                className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
                  border: '2px solid #4C1D95',
                  borderRadius: 3,
                  boxShadow: '0 4px 0 #4C1D95',
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

      <style jsx global>{`
        @keyframes goPop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
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
        @keyframes roundBump {
          0%   { transform: scale(1);    color: #FFFFFF; }
          40%  { transform: scale(1.35); color: #FDE68A; text-shadow: 2px 2px 0 #78350F; }
          100% { transform: scale(1);    color: #FFFFFF; }
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
        .game-shell.shake { animation: shellShake 0.24s steps(7, end); }
      `}</style>
    </div>
  )
}

// ─── Eren chibi (forward-gaze, smile, cheeks) ───────────────────────────────
function ErenChibi({ size = 68, blink = false, fail = false, cheer = false }: { size?: number; blink?: boolean; fail?: boolean; cheer?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="3" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="4" y="4" width="1" height="1" fill="#F4B0B8" />
      <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
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
          <rect x="6"  y="7" width="1" height="1" fill="#FFFFFF" />
          <rect x="15" y="7" width="1" height="1" fill="#FFFFFF" />
          <rect x="7"  y="8" width="1" height="1" fill="#1A1A2E" />
          <rect x="14" y="8" width="1" height="1" fill="#1A1A2E" />
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
