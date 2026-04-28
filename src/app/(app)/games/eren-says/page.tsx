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

// Each pad has its own colour AND audio frequency so the round literally plays
// a tune. Frequencies are a triad-ish set so wrong sequences sound dissonant.
const PADS = [
  { color: '#FF6B9D', glow: 'rgba(255,107,157,0.85)', tone: 392.0, name: 'pink'   }, // G4
  { color: '#FBBF24', glow: 'rgba(251,191,36,0.85)',  tone: 523.3, name: 'yellow' }, // C5
  { color: '#34D399', glow: 'rgba(52,211,153,0.85)',  tone: 659.3, name: 'green'  }, // E5
  { color: '#7C3AED', glow: 'rgba(124,58,237,0.85)',  tone: 784.0, name: 'purple' }, // G5
] as const

const FLASH_MS  = 420
const GAP_MS    = 130
const FAIL_MS   = 700
const PRE_SHOW_MS = 600

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
function buzz() {
  if (typeof window === 'undefined') return
  type WebkitAW = Window & { webkitAudioContext?: typeof AudioContext }
  if (!_ac) _ac = new (window.AudioContext || (window as unknown as WebkitAW).webkitAudioContext!)()
  const ac = _ac
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(180, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.5)
  osc.connect(gain).connect(ac.destination)
  gain.gain.setValueAtTime(0.18, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5)
  osc.start()
  osc.stop(ac.currentTime + 0.55)
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export default function ErenSaysGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [phase, setPhase]         = useState<'idle' | 'showing' | 'awaiting' | 'fail' | 'gameover'>('idle')
  const [round, setRound]         = useState(0)
  const [bestRound, setBestRound] = useState(0)
  const [activePad, setActivePad] = useState<number | null>(null)
  const [flashFail, setFlashFail] = useState(false)

  const seqRef     = useRef<number[]>([])
  const userIdxRef = useRef(0)
  const cancelledRef = useRef(false)
  const savedRef   = useRef(false)

  useEffect(() => () => { cancelledRef.current = true }, [])

  async function showSequence(seq: number[]) {
    setPhase('showing')
    await sleep(PRE_SHOW_MS)
    for (const idx of seq) {
      if (cancelledRef.current) return
      setActivePad(idx)
      tone(PADS[idx].tone)
      await sleep(FLASH_MS)
      if (cancelledRef.current) return
      setActivePad(null)
      await sleep(GAP_MS)
    }
    if (cancelledRef.current) return
    userIdxRef.current = 0
    setPhase('awaiting')
  }

  function startGame() {
    cancelledRef.current = false
    savedRef.current = false
    seqRef.current = [Math.floor(Math.random() * 4)]
    userIdxRef.current = 0
    setRound(1)
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
    tone(PADS[idx].tone, 0.18)
    setTimeout(() => setActivePad(null), 180)

    const expected = seqRef.current[userIdxRef.current]
    if (idx !== expected) {
      buzz()
      setFlashFail(true)
      setPhase('fail')
      const reached = seqRef.current.length - 1   // longest *complete* round before fail
      saveScore(reached)
      setTimeout(() => {
        setFlashFail(false)
        setPhase('gameover')
      }, FAIL_MS)
      return
    }
    userIdxRef.current++
    if (userIdxRef.current >= seqRef.current.length) {
      setBestRound(b => Math.max(b, seqRef.current.length))
      setTimeout(nextRound, 600)
    }
  }

  function saveScore(reached: number) {
    if (savedRef.current || !user?.id || reached <= 0) return
    savedRef.current = true
    supabase.from('game_scores').insert({ user_id: user.id, game_type: 'eren_says', score: reached })
      .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('eren_says save:', error) })
    addCoins(Math.min(40, reached * 2))
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
      seqRef.current = []
      userIdxRef.current = 0
    }, 50)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{
      background: 'radial-gradient(ellipse at top, #2D1659 0%, #1A0A33 55%, #0F0620 100%)',
      paddingTop: 100,
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
      <div className="flex flex-col items-center pt-4 pb-2 flex-shrink-0">
        <div className="font-pixel" style={{ fontSize: 6, color: '#A78BFA', letterSpacing: 2 }}>ROUND</div>
        <div className="font-pixel" style={{
          fontSize: 28,
          color: phase === 'fail' ? '#FCA5A5' : '#FFFFFF',
          textShadow: '2px 2px 0 #2E0F5C',
          transform: phase === 'fail' ? 'scale(0.9)' : 'scale(1)',
          transition: 'transform 0.2s, color 0.2s',
        }}>{round || '—'}</div>
        <div className="font-pixel mt-1" style={{ fontSize: 7, color: '#C4B5FD', letterSpacing: 1.5 }}>
          {phase === 'showing'  ? 'WATCH…' :
           phase === 'awaiting' ? `YOUR TURN — ${userIdxRef.current + 1}/${seqRef.current.length}` :
           phase === 'fail'     ? 'OOPS!' :
           phase === 'gameover' ? 'GAME OVER' :
                                  'TAP A PAD TO START'}
        </div>
      </div>

      {/* Pads + Eren */}
      <div className="flex-1 flex items-center justify-center px-6 pb-4">
        <div className="relative" style={{ width: 'min(90vw, 360px)', aspectRatio: '1 / 1' }}>
          <div className="absolute inset-0 grid"
            style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
            {PADS.map((p, i) => {
              const isActive = activePad === i
              const isFail = phase === 'fail' && activePad === i
              return (
                <button key={i}
                  onClick={() => handlePad(i)}
                  disabled={phase !== 'awaiting' && phase !== 'idle'}
                  className="relative active:scale-95 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${p.color}, ${p.color}AA)`,
                    border: '4px solid rgba(0,0,0,0.45)',
                    borderRadius: i === 0 ? '40% 8px 8px 8px' : i === 1 ? '8px 40% 8px 8px' : i === 2 ? '8px 8px 8px 40%' : '8px 8px 40% 8px',
                    boxShadow: isActive
                      ? `0 0 28px 6px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 0 rgba(0,0,0,0.4)`
                      : `inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 0 rgba(0,0,0,0.4)`,
                    transform: isActive ? 'scale(1.05) translateY(-3px)' : 'scale(1)',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                    filter: phase === 'showing' && !isActive ? 'brightness(0.55)' : isFail ? 'brightness(0.5) saturate(0)' : 'none',
                    cursor: phase === 'awaiting' ? 'pointer' : 'default',
                  }}>
                  {/* Decorative paw print on each pad */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ opacity: isActive ? 0.7 : 0.25 }}>
                    <IconPaw size={Math.min(72, 80)} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Eren chibi at center */}
          <div className="absolute pointer-events-none"
            style={{
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              animation: phase === 'awaiting' ? 'eyDance 1s ease-in-out infinite' : 'none',
            }}>
            <ErenChibi size={68} blink={phase === 'showing'} fail={flashFail} />
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
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{Math.max(0, seqRef.current.length - 1)}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestRound}</span>
              </div>
            </div>
            <button onClick={() => { playSound('ui_tap'); reset() }}
              className="mt-3 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
                border: '2px solid #4C1D95',
                borderRadius: 3,
                boxShadow: '0 4px 0 #4C1D95',
                fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5,
              }}>
              <RefreshCw size={11} /> AGAIN
            </button>
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
      `}</style>
    </div>
  )
}

// ─── Eren chibi (forward-gaze, smile, cheeks) ───────────────────────────────
function ErenChibi({ size = 68, blink = false, fail = false }: { size?: number; blink?: boolean; fail?: boolean }) {
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
      {/* eyes */}
      {blink ? (
        <>
          <rect x="6" y="8" width="2" height="1" fill="#4A2E1A" />
          <rect x="14" y="8" width="2" height="1" fill="#4A2E1A" />
        </>
      ) : (
        <>
          <rect x="6" y="7" width="2" height="2" fill="#6BAED6" />
          <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
          <rect x="6" y="7" width="1" height="1" fill="#FFFFFF" />
          <rect x="15" y="7" width="1" height="1" fill="#FFFFFF" />
          <rect x="7" y="8" width="1" height="1" fill="#1A1A2E" />
          <rect x="14" y="8" width="1" height="1" fill="#1A1A2E" />
        </>
      )}
      {/* cheeks */}
      <rect x="4" y="10" width="2" height="1" fill="#FFB6C8" />
      <rect x="16" y="10" width="2" height="1" fill="#FFB6C8" />
      {/* nose */}
      <rect x="10" y="9"  width="2" height="1" fill="#F48B9B" />
      <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
      {/* mouth — smile or frown */}
      {fail ? (
        <>
          <rect x="9" y="12" width="1" height="1" fill="#4A2E1A" />
          <rect x="12" y="12" width="1" height="1" fill="#4A2E1A" />
          <rect x="10" y="11" width="2" height="1" fill="#4A2E1A" />
        </>
      ) : (
        <>
          <rect x="9" y="11" width="1" height="1" fill="#4A2E1A" />
          <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
        </>
      )}
      <rect x="4" y="12" width="14" height="1" fill="#4A2E1A" />
      <rect x="5" y="12" width="12" height="1" fill="#F9EDD5" />
      {!fail && <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />}
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
