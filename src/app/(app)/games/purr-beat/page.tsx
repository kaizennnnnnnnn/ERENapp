'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PURR BEAT — a 4-lane rhythm game, themed for the Eren app.
// ────────────────────────────────────────────────────────────────────────
// Notes fall down 4 lanes toward a hit line; tap a lane when its note lands.
// Timing is judged PERFECT / GOOD / OK; misses break the combo and drain the
// GROOVE meter. The run ends when groove hits 0. Score = timed-hit points ×
// the combo multiplier.
//
// There are no music files — the beat is synthesised: a single beat grid
// (BPM ramping with time) is traversed by two pointers, one that SPAWNS notes
// TRAVEL seconds ahead so they arrive on-beat, and one that plays the KICK as
// each beat passes. Both read the same grid, so the notes always reach the
// line exactly when the kick thumps. The melody is the player's — each lane is
// a scale tone (C-E-G-C), so good play sounds like a tune over the pulse.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import GameCoinReward from '@/components/games/GameCoinReward'
import { playSound, type SoundName } from '@/lib/sounds'
import { IconStar } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'

// ─── Tunables ───────────────────────────────────────────────────────────────
const LANES = 4
const TRAVEL = 1.5            // seconds a note takes to fall to the hit line
const HIT_LINE_PCT = 82       // notes fall from 0% → this % of the field
const LEAD_IN = TRAVEL + 0.6  // first beat time (gives a ~2s run-up)
// timing windows (seconds)
const W_PERFECT = 0.06
const W_GOOD    = 0.11
const W_OK      = 0.17
// groove meter
const GROOVE_START = 50
const GROOVE_MAX   = 100
const GAIN = { perfect: 3, good: 2, ok: 1 }
const MISS_PEN = 8
// points
const PTS = { perfect: 50, good: 30, ok: 10 }
// difficulty
const BPM_BASE = 95, BPM_MAX = 155, BPM_RAMP = 0.7
const WEEKLY_HS = 5000

const LANE_COLOR = ['#EC4899', '#A78BFA', '#22D3EE', '#FBBF24']
const LANE_DARK  = ['#831843', '#4C1D95', '#155E75', '#92400E']
const LANE_TONE: SoundName[] = ['pr_n1', 'pr_n2', 'pr_n3', 'pr_n4']

function bpmAt(t: number): number { return Math.min(BPM_MAX, BPM_BASE + t * BPM_RAMP) }
function comboMult(combo: number): number { return combo >= 50 ? 4 : combo >= 25 ? 3 : combo >= 10 ? 2 : 1 }

interface Note { id: number; lane: number; target: number }

// ─── Component ──────────────────────────────────────────────────────────────
type Phase = 'idle' | 'playing' | 'gameover'

export default function PurrBeatGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const reduced = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('idle')
  const [bestScore, setBest] = useState(0)
  const [reward, setReward] = useState<GameRewardResult | null>(null)
  const [judge, setJudge] = useState<{ text: string; color: string; key: number } | null>(null)
  const [, setTick] = useState(0)
  const forceRender = () => setTick(t => (t + 1) % 1000000)

  // Engine state in refs (loop mutates; render reads).
  const notesRef = useRef<Note[]>([])
  const beatsRef = useRef<number[]>([])
  const spawnIdxRef = useRef(0)
  const soundIdxRef = useRef(0)
  const grooveRef = useRef(GROOVE_START)
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const idRef = useRef(0)
  const gameTimeRef = useRef(0)
  const lastKickRef = useRef(-1)
  const laneFlashRef = useRef<number[]>([0, 0, 0, 0])
  const savedRef = useRef(false)
  // loop infra
  const phaseRef = useRef<Phase>('idle')
  const pausedRef = useRef(false)
  const lastFrameRef = useRef(0)
  const judgeKeyRef = useRef(0)

  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem('purr_beat_best') || '', 10)
      if (Number.isFinite(n) && n > 0) setBest(n)
    } catch { /* localStorage unavailable */ }
  }, [])

  useVisibilityPause(
    () => { pausedRef.current = true },
    () => { pausedRef.current = false; lastFrameRef.current = performance.now() },
  )

  // ── rAF loop ──
  useEffect(() => {
    if (phase !== 'playing') return
    let raf = 0
    lastFrameRef.current = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(48, now - lastFrameRef.current) / 1000
      lastFrameRef.current = now
      if (!pausedRef.current) { gameTimeRef.current += dt; tick(); forceRender() }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function ensureBeats(upto: number) {
    const b = beatsRef.current
    while (b[b.length - 1] < upto) b.push(b[b.length - 1] + 60 / bpmAt(b[b.length - 1]))
  }

  function addNote(lane: number, target: number) {
    notesRef.current.push({ id: ++idRef.current, lane, target })
  }

  function spawnForBeat(i: number) {
    const beats = beatsRef.current
    const bt = beats[i]
    const prob = Math.min(0.92, 0.5 + bt * 0.006)
    if (Math.random() < prob) {
      const lane = Math.floor(Math.random() * LANES)
      addNote(lane, bt)
      // doubles creep in late
      if (bt > 35 && Math.random() < Math.min(0.25, (bt - 35) * 0.004)) {
        addNote((lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES, bt)
      }
    }
    // 8th notes once the tempo is up
    const eighth = Math.max(0, (bpmAt(bt) - 115) / 130)
    if (Math.random() < eighth && beats[i + 1] !== undefined) {
      addNote(Math.floor(Math.random() * LANES), (bt + beats[i + 1]) / 2)
    }
  }

  function tick() {
    const now = gameTimeRef.current
    ensureBeats(now + TRAVEL + 1.5)
    const beats = beatsRef.current
    // spawn notes TRAVEL ahead of their beat
    while (spawnIdxRef.current < beats.length && now >= beats[spawnIdxRef.current] - TRAVEL) {
      spawnForBeat(spawnIdxRef.current)
      spawnIdxRef.current++
    }
    // kick on each beat
    while (soundIdxRef.current < beats.length && now >= beats[soundIdxRef.current]) {
      playSound('pr_kick')
      lastKickRef.current = now
      soundIdxRef.current++
    }
    // miss detection — a note that drops past the OK window
    let missed = 0
    const survivors: Note[] = []
    for (const n of notesRef.current) {
      if (now > n.target + W_OK) { missed++; continue }
      survivors.push(n)
    }
    if (missed > 0) {
      notesRef.current = survivors
      comboRef.current = 0
      grooveRef.current = Math.max(0, grooveRef.current - MISS_PEN * missed)
      playSound('pr_miss')
      showJudge('MISS', '#FCA5A5')
    }
    if (grooveRef.current <= 0) endGame()
  }

  function showJudge(text: string, color: string) {
    judgeKeyRef.current += 1
    setJudge({ text, color, key: judgeKeyRef.current })
  }

  function judgeLane(lane: number) {
    if (phaseRef.current !== 'playing') return
    const now = gameTimeRef.current
    laneFlashRef.current[lane] = now
    let best: Note | null = null
    let bestD = Infinity
    for (const n of notesRef.current) {
      if (n.lane !== lane) continue
      const d = Math.abs(n.target - now)
      if (d < bestD) { bestD = d; best = n }
    }
    if (!best || bestD > W_OK) return // empty / early tap — no penalty, just the pad flash
    notesRef.current = notesRef.current.filter(n => n !== best)
    let kind: keyof typeof PTS
    if (bestD <= W_PERFECT) kind = 'perfect'
    else if (bestD <= W_GOOD) kind = 'good'
    else kind = 'ok'
    comboRef.current += 1
    maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
    scoreRef.current += PTS[kind] * comboMult(comboRef.current)
    grooveRef.current = Math.min(GROOVE_MAX, grooveRef.current + GAIN[kind])
    playSound(LANE_TONE[lane])
    if (kind === 'perfect') playSound('pr_perfect')
    showJudge(kind.toUpperCase(), kind === 'perfect' ? '#FDE047' : kind === 'good' ? '#A7F3D0' : '#BAE6FD')
    forceRender()
  }

  function startGame() {
    notesRef.current = []
    beatsRef.current = [LEAD_IN]
    spawnIdxRef.current = 0
    soundIdxRef.current = 0
    grooveRef.current = GROOVE_START
    scoreRef.current = 0
    comboRef.current = 0
    maxComboRef.current = 0
    gameTimeRef.current = 0
    lastKickRef.current = -1
    laneFlashRef.current = [0, 0, 0, 0]
    savedRef.current = false
    setReward(null)
    setJudge(null)
    setPhase('playing')
  }

  function endGame() {
    if (phaseRef.current === 'gameover') return
    const finalScore = scoreRef.current
    setPhase('gameover')
    setBest(b => Math.max(b, finalScore))
    try {
      const prev = parseInt(localStorage.getItem('purr_beat_best') || '0', 10) || 0
      if (finalScore > prev) localStorage.setItem('purr_beat_best', String(finalScore))
    } catch { /* ignore */ }
    playSound('pr_gameover')
    if (!savedRef.current && user?.id) {
      savedRef.current = true
      setReward(reportGameResult({ gameType: 'purr_beat', score: finalScore }))
      if (finalScore > 0) {
        fireMinigameDone('purr_beat', finalScore)
        completeTask('daily_game')
        if (finalScore >= WEEKLY_HS) completeTask('weekly_high_score')
        applyAction(user.id, 'play')
      }
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  const now = gameTimeRef.current
  const groove = grooveRef.current
  const combo = comboRef.current
  const mult = comboMult(combo)
  // Eren bops on the kick
  const kickPulse = lastKickRef.current >= 0 ? Math.max(0, 1 - (now - lastKickRef.current) / 0.18) : 0
  const erenScale = reduced ? 1 : 1 + kickPulse * 0.22

  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell select-none"
      style={{ background: 'radial-gradient(ellipse at top, #3B0764 0%, #2E0A52 55%, #18062E 100%)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(20,4,40,0.95) 0%, rgba(20,4,40,0.55) 100%)',
        borderBottom: '2px solid rgba(232,121,249,0.3)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(232,121,249,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-fuchsia-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #C026D3, #E879F9)', border: '2px solid #701A75', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          PURR BEAT
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#F5D0FE' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* HUD: score + combo + groove */}
      {phase !== 'idle' && (
        <div className="px-4 py-2.5 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-pixel" style={{ fontSize: 6, color: '#E9A8FB', letterSpacing: 2 }}>SCORE</div>
              <div className="font-pixel" style={{ fontSize: 20, color: '#FFFFFF', textShadow: '2px 2px 0 #2E0A52' }}>{scoreRef.current}</div>
            </div>
            {combo >= 2 && (
              <div className="font-pixel text-right" style={{ fontSize: 14, color: mult > 1 ? '#FDE047' : '#F5D0FE', textShadow: '0 0 8px rgba(253,224,71,0.5)' }}>
                {combo} COMBO {mult > 1 && <span style={{ fontSize: 10 }}>×{mult}</span>}
              </div>
            )}
          </div>
          {/* groove meter */}
          <div className="relative" style={{ height: 12, background: 'rgba(0,0,0,0.45)', border: '2px solid rgba(232,121,249,0.5)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${groove}%`,
              background: groove > 60 ? 'linear-gradient(90deg, #C026D3, #E879F9)' : groove > 30 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #DC2626, #F87171)',
              transition: reduced ? undefined : 'width 0.1s linear',
              boxShadow: '0 0 10px rgba(232,121,249,0.5)',
            }} />
            <span className="font-pixel absolute inset-0 flex items-center justify-center" style={{ fontSize: 5, color: '#FFFFFF', letterSpacing: 2, textShadow: '0 1px 0 rgba(0,0,0,0.6)' }}>GROOVE</span>
          </div>
        </div>
      )}

      {/* Field */}
      <div className="flex-1 relative overflow-hidden">
        {/* Eren bopping at the top */}
        {phase !== 'idle' && (
          <div className="absolute left-1/2 z-10 pointer-events-none" style={{ top: 4, marginLeft: -16, transform: `scale(${erenScale})`, transformOrigin: 'center bottom' }}>
            <ErenHead size={32} happy={groove > 30} />
          </div>
        )}

        {/* lanes */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: LANES }).map((_, lane) => {
            const flash = Math.max(0, 1 - (now - laneFlashRef.current[lane]) / 0.15)
            return (
              <div key={lane} onPointerDown={phase === 'playing' ? () => judgeLane(lane) : undefined}
                className="relative flex-1"
                style={{ borderLeft: lane > 0 ? '1px solid rgba(232,121,249,0.12)' : undefined, touchAction: 'none' }}>
                {/* notes in this lane */}
                {notesRef.current.filter(n => n.lane === lane).map(n => {
                  const p = 1 - (n.target - now) / TRAVEL
                  if (p < -0.05) return null
                  return (
                    <div key={n.id} className="absolute" style={{
                      top: `${Math.min(100, p * HIT_LINE_PCT)}%`,
                      left: '14%', right: '14%', height: 18, marginTop: -9,
                      background: `linear-gradient(135deg, ${LANE_COLOR[lane]}, ${LANE_DARK[lane]})`,
                      border: `2px solid ${LANE_DARK[lane]}`,
                      borderRadius: 5,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 8px ${LANE_COLOR[lane]}66`,
                    }} />
                  )
                })}
                {/* hit pad at the line */}
                <div className="absolute" style={{
                  top: `${HIT_LINE_PCT}%`, left: '10%', right: '10%', height: 30, marginTop: -2,
                  background: flash > 0 ? `${LANE_COLOR[lane]}` : 'rgba(255,255,255,0.06)',
                  opacity: flash > 0 ? 0.35 + flash * 0.5 : 1,
                  border: `2px solid ${LANE_COLOR[lane]}`,
                  borderRadius: 6,
                  boxShadow: flash > 0 ? `0 0 16px ${LANE_COLOR[lane]}` : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                  transition: reduced ? undefined : 'opacity 0.08s, background 0.08s',
                }} />
              </div>
            )
          })}
        </div>

        {/* hit line */}
        <div className="absolute pointer-events-none" style={{ top: `${HIT_LINE_PCT}%`, left: 0, right: 0, height: 2, background: 'rgba(245,208,254,0.7)', boxShadow: '0 0 10px rgba(232,121,249,0.6)' }} />

        {/* judgment floater */}
        {judge && (
          <div key={judge.key} className="absolute left-1/2 pointer-events-none font-pixel" style={{
            top: `${HIT_LINE_PCT - 16}%`, transform: 'translateX(-50%)',
            fontSize: 16, color: judge.color, letterSpacing: 2,
            textShadow: '2px 2px 0 rgba(0,0,0,0.5), 0 0 12px currentColor',
            animation: reduced ? undefined : 'pbJudge 0.5s ease-out forwards',
          }}>{judge.text}</div>
        )}
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
          <div className="px-6 py-5 flex flex-col items-center gap-3" style={{ background: 'rgba(24,6,46,0.95)', border: '3px solid #E879F9', borderRadius: 8, boxShadow: '0 4px 0 #701A75, 0 0 30px rgba(232,121,249,0.5)', maxWidth: 320 }}>
            <ErenHead size={40} happy />
            <p className="font-pixel" style={{ fontSize: 12, letterSpacing: 2, color: '#F5D0FE', filter: 'drop-shadow(0 0 6px rgba(232,121,249,0.5))' }}>PURR BEAT</p>
            <div className="font-pixel text-center" style={{ fontSize: 6, color: '#E9A8FB', letterSpacing: 1, lineHeight: 1.9 }}>
              <p>TAP A LANE WHEN ITS NOTE</p>
              <p>HITS THE LINE — STAY ON BEAT</p>
              <p style={{ color: '#FDE047' }}>KEEP THE GROOVE ABOVE ZERO</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #E879F9 0%, #C026D3 100%)', border: '2px solid #701A75', borderRadius: 3, boxShadow: '0 4px 0 #701A75', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5 }}>
              <IconStar size={12} /> PLAY
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(14,4,28,0.74)', backdropFilter: 'blur(2px)' }}>
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{ background: 'linear-gradient(180deg, #2E0A52 0%, #1C0636 100%)', border: '3px solid #C026D3', borderRadius: 6, boxShadow: '0 6px 0 #701A75, 0 0 30px rgba(192,38,211,0.5)', animation: reduced ? undefined : 'pbPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 2 }}>OUT OF GROOVE</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#F0ABFC', letterSpacing: 1 }}>SCORE</span>
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{scoreRef.current}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#5B2178' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE047', letterSpacing: 1 }}>MAX COMBO</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE047' }}>{maxComboRef.current}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#5B2178' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#F0ABFC', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#F5D0FE' }}>{bestScore}</span>
              </div>
            </div>
            {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => { playSound('ui_tap'); startGame() }}
                className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #E879F9 0%, #C026D3 100%)', border: '2px solid #701A75', borderRadius: 3, boxShadow: '0 4px 0 #701A75', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
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
        @keyframes pbPop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pbJudge { 0% { transform: translate(-50%, 0) scale(0.7); opacity: 0; } 30% { transform: translate(-50%, -8px) scale(1.1); opacity: 1; } 100% { transform: translate(-50%, -28px) scale(0.9); opacity: 0; } }
      `}</style>
    </div>
  )
}

// ─── Eren head sprite (bops to the beat) ────────────────────────────────────
function ErenHead({ size, happy }: { size: number; happy?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ears */}
      <rect x="4"  y="3" width="4" height="5" fill="#4A2E1A" />
      <rect x="16" y="3" width="4" height="5" fill="#4A2E1A" />
      <rect x="5"  y="5" width="2" height="2" fill="#F472B6" />
      <rect x="17" y="5" width="2" height="2" fill="#F472B6" />
      {/* head */}
      <rect x="4"  y="7"  width="16" height="13" fill="#F9EDD5" />
      <rect x="4"  y="7"  width="16" height="2"  fill="#FFFFFF" opacity="0.4" />
      <rect x="4"  y="18" width="16" height="2"  fill="#E8D4B0" />
      {/* eyes */}
      <rect x="8"  y="11" width="2" height={happy ? 2 : 3} fill="#1F2937" />
      <rect x="14" y="11" width="2" height={happy ? 2 : 3} fill="#1F2937" />
      {/* blush */}
      <rect x="6"  y="14" width="2" height="2" fill="#F9A8D4" opacity="0.7" />
      <rect x="16" y="14" width="2" height="2" fill="#F9A8D4" opacity="0.7" />
      {/* nose + smile */}
      <rect x="11" y="14" width="2" height="2" fill="#F472B6" />
      {happy
        ? <><rect x="9" y="16" width="2" height="1" fill="#9A3412" /><rect x="13" y="16" width="2" height="1" fill="#9A3412" /><rect x="11" y="17" width="2" height="1" fill="#9A3412" /></>
        : <rect x="10" y="16" width="4" height="1" fill="#9A3412" />}
    </svg>
  )
}
