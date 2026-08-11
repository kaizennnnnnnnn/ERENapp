'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PURR BEAT — a 4-lane rhythm game.
// ────────────────────────────────────────────────────────────────────────
// Notes rush up a perspective highway toward a hit line; tap a lane as its
// note lands. Timing is judged PERFECT / GOOD / OK; a missed note costs a
// heart, and the run ends at zero. Score = timed-hit points x combo
// multiplier.
//
// THE CLOCK IS THE AUDIO CLOCK. Everything here — note positions, judgment
// windows, effect ages — is measured against AudioContext.currentTime by way
// of the conductor in purrBeatMusic.ts, never against a rAF accumulator.
// A rhythm game whose visuals and audio run on different clocks is a rhythm
// game the player cannot trust, and a 60 ms PERFECT window has no room for
// the drift a hand-integrated `time += dt` picks up over a three-minute run.
//
// The clock is additionally shifted back by the output latency the browser
// reports, so on Bluetooth headphones — where the sound leaves the speaker up
// to a third of a second after Web Audio emits it — what you SEE touch the
// line is what you HEAR, and playing by ear is not punished.
//
// Rendering splits in two. The 60fps half (lanes, notes, particles, the beat
// throb) is one canvas in PurrBeatStage. The React half (score, combo, hearts,
// panels) re-renders only when one of those numbers actually changes — a few
// times a second, not sixty.
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
import PurrBeatStage, { createStage, spawnHit, LANE_HUE, type StageState, type JudgeKind } from '@/components/games/PurrBeatStage'
import { Panel, Stat, Divider, ErenDJ } from '@/components/games/PurrBeatChrome'
import { playSound, playSynthAt } from '@/lib/sounds'
import { outputLatency } from '@/lib/soundSynth'
import { IconStar, IconHeart, IconTrophy } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'
import {
  createConductor, intensityAt, laneTone, perfectSting, missTone, multiplierTone,
  type Conductor,
} from '@/lib/purrBeatMusic'

// ─── Tunables ───────────────────────────────────────────────────────────────
const LANES = 4
const TRAVEL = 1.45           // seconds a note takes to reach the hit line
const LEAD_IN = TRAVEL + 1.1  // first beat, so the run-up is a full bar of air
// Timing windows, seconds either side of the note's target.
const W_PERFECT = 0.055
const W_GOOD = 0.105
const W_OK = 0.165
const START_LIVES = 5
const MAX_LIVES = 5
const PTS: Record<Exclude<JudgeKind, 'miss'>, number> = { perfect: 50, good: 30, ok: 10 }
const WEEKLY_HS = 5000
/** Two notes in one lane closer than this are physically untappable. */
const MIN_LANE_GAP = 0.13

const JUDGE_STYLE: Record<JudgeKind, { text: string; color: string }> = {
  perfect: { text: 'PURRFECT', color: '#FDE047' },
  good: { text: 'GOOD', color: '#A7F3D0' },
  ok: { text: 'OK', color: '#BAE6FD' },
  miss: { text: 'MISS', color: '#FCA5A5' },
}

function comboMult(combo: number): number {
  return combo >= 50 ? 4 : combo >= 25 ? 3 : combo >= 10 ? 2 : 1
}

interface Tally { perfect: number; good: number; ok: number; miss: number }

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
  const [judge, setJudge] = useState<{ kind: JudgeKind; lane: number; points: number; key: number } | null>(null)
  // The HUD's own copy of the numbers. Written on hits and misses only — the
  // engine's source of truth is in refs, so the 60fps loop never re-renders.
  const [hud, setHud] = useState({ score: 0, combo: 0, mult: 1, lives: START_LIVES })

  const stageRef = useRef<StageState>(createStage())
  const conductorRef = useRef<Conductor | null>(null)
  const latencyRef = useRef(0)
  const drawRef = useRef<(() => void) | null>(null)
  // `reduced` is the one reactive value the loop reads, and the loop's closure
  // is frozen for the run — mirror it into a ref so toggling the OS setting
  // mid-run reaches Eren's bop too, not just the canvas.
  const reducedRef = useRef(reduced)
  useEffect(() => { reducedRef.current = reduced }, [reduced])

  const notesRef = useRef(stageRef.current.notes)
  const spawnIdxRef = useRef(0)
  const lastInLaneRef = useRef<number[]>([-9, -9, -9, -9])
  const livesRef = useRef(START_LIVES)
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const multRef = useRef(1)
  const idRef = useRef(0)
  const tallyRef = useRef<Tally>({ perfect: 0, good: 0, ok: 0, miss: 0 })
  // The finished run, snapshotted at game over. Refs are the engine's truth
  // while playing, but reading them during render is off-contract — the
  // results panel renders from state.
  const [result, setResult] = useState<{ score: number; maxCombo: number; tally: Tally } | null>(null)
  const beatCursorRef = useRef(0)
  const savedRef = useRef(false)
  const phaseRef = useRef<Phase>('idle')
  const pausedRef = useRef(false)
  const judgeKeyRef = useRef(0)
  // Eren's bop is written straight to the DOM: it changes every frame and must
  // not drag a React render along with it.
  const erenRef = useRef<HTMLDivElement>(null)

  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem('purr_beat_best') || '', 10)
      if (Number.isFinite(n) && n > 0) setBest(n)
    } catch { /* localStorage unavailable */ }
  }, [])

  useVisibilityPause(
    () => { pausedRef.current = true; conductorRef.current?.pause() },
    () => { pausedRef.current = false; conductorRef.current?.resume() },
  )

  // Make sure the music can never outlive the screen.
  useEffect(() => () => { conductorRef.current?.stop() }, [])

  // ── The loop ──────────────────────────────────────────────────────────────
  // ONE requestAnimationFrame for the whole screen: simulate, then draw, in
  // that order, in the same callback. When the canvas owned a second loop it
  // was registered first (child effects run before parent effects), so it drew
  // the state the simulation had written on the previous frame — a permanent
  // ~17 ms lag between the picture the player times against and the clock that
  // judges them.
  //
  // It runs in every phase, not just 'playing', so the stage stays lit behind
  // the menu and the results panel. Only `tick` is gated.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const c = conductorRef.current
      if (c && !pausedRef.current && phaseRef.current === 'playing') {
        c.pump(comboRef.current)
        tick(c)
      }
      drawRef.current?.()
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Game time as the PLAYER experiences it — the audio clock, rolled back by
   *  however long the browser says sound takes to reach the speaker. */
  function perceivedNow(c: Conductor): number {
    return c.now() - latencyRef.current
  }

  function spawnForBeat(beats: number[], i: number, now: number) {
    const bt = beats[i]
    const density = Math.min(0.93, 0.52 + bt * 0.0055)
    const place = (lane: number, at: number) => {
      // Two notes in the same lane inside a thumb's reach of each other are not
      // difficulty, they are a dropped input. The chart refuses to author them.
      if (at - lastInLaneRef.current[lane] < MIN_LANE_GAP) return false
      lastInLaneRef.current[lane] = at
      notesRef.current.push({ id: ++idRef.current, lane, target: at })
      return true
    }

    if (Math.random() < density) {
      const lane = Math.floor(Math.random() * LANES)
      place(lane, bt)
      // Two-lane chords creep in once the player has found their footing.
      if (bt > 32 && Math.random() < Math.min(0.24, (bt - 32) * 0.004)) {
        place((lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES, bt)
      }
    }
    // Off-beat eighths, weighted by how far the tempo has climbed.
    const next = beats[i + 1]
    if (next !== undefined) {
      const eighthOdds = Math.min(0.5, Math.max(0, (bt - 18) * 0.011))
      if (Math.random() < eighthOdds) place(Math.floor(Math.random() * LANES), (bt + next) / 2)
    }
    void now
  }

  function tick(c: Conductor) {
    // Chromium reports outputLatency as 0 until the audio thread has actually
    // rendered, so the reading taken at startGame() — one statement after the
    // context was first exercised — is the useless one, and a Bluetooth player
    // would get no compensation at all on their first run of a session.
    // Re-read until the first note is about to spawn, then freeze: shifting the
    // offset while a note is in flight would visibly jump it down the lane.
    if (c.now() < LEAD_IN - TRAVEL) latencyRef.current = outputLatency()

    const now = perceivedNow(c)
    const beats = c.beats
    const stage = stageRef.current

    // Spawn notes exactly TRAVEL ahead of their beat, so they touch the line on
    // the beat rather than near it.
    while (spawnIdxRef.current < beats.length - 1 && now >= beats[spawnIdxRef.current] - TRAVEL) {
      spawnForBeat(beats, spawnIdxRef.current, now)
      spawnIdxRef.current++
    }

    // Sweep notes that fell past the OK window.
    let missed = 0
    let missLane = 0
    for (let i = notesRef.current.length - 1; i >= 0; i--) {
      const n = notesRef.current[i]
      if (now > n.target + W_OK) {
        missed++
        missLane = n.lane
        notesRef.current.splice(i, 1)
      }
    }
    if (missed > 0) registerMiss(missLane, missed, now)

    // Beat throb — find the most recent beat that has sounded.
    while (beatCursorRef.current < beats.length - 1 && beats[beatCursorRef.current + 1] <= now) {
      beatCursorRef.current++
    }
    const bi = beatCursorRef.current
    if (beats[bi] !== undefined && beats[bi] <= now) {
      stage.beatAt = beats[bi]
      stage.beatLen = Math.max(0.2, (beats[bi + 1] ?? beats[bi] + 0.5) - beats[bi])
    }

    // Publish this frame's world to the canvas.
    stage.time = now
    stage.travel = TRAVEL
    stage.beatGrid = beats
    stage.intensity = intensityAt(Math.max(0, now))
    stage.combo = comboRef.current
    stage.mult = multRef.current
    stage.playing = true

    // Eren bops on the beat. Written imperatively — a transform is not worth a
    // render, and this is the codebase's established pattern for 60fps sprites.
    const el = erenRef.current
    if (el) {
      const low = reducedRef.current
      const throb = low ? 0 : Math.max(0, 1 - (now - stage.beatAt) / (stage.beatLen * 0.55))
      const lean = low ? 0 : Math.sin(now * 2.2) * 3
      el.style.transform = `translateY(${throb * -6}px) rotate(${lean}deg) scale(${1 + throb * 0.14})`
    }

    if (livesRef.current <= 0) endGame()
  }

  function registerMiss(lane: number, count: number, now: number) {
    const stage = stageRef.current
    comboRef.current = 0
    multRef.current = 1
    livesRef.current = Math.max(0, livesRef.current - count)
    tallyRef.current.miss += count
    stage.missAt = now
    spawnHit(stage, lane, 'miss', now)
    playSynthAt(missTone(), 0, 0.5)
    showJudge('miss', lane, 0)
    syncHud()
  }

  // `tally` is deliberately NOT synced here — it is only read on the results
  // panel, so publishing it per hit would schedule a second render several
  // times a second for a tree that is not mounted.
  function syncHud() {
    setHud({ score: scoreRef.current, combo: comboRef.current, mult: multRef.current, lives: livesRef.current })
  }

  function showJudge(kind: JudgeKind, lane: number, points: number) {
    judgeKeyRef.current += 1
    setJudge({ kind, lane, points, key: judgeKeyRef.current })
  }

  function judgeLane(lane: number) {
    const c = conductorRef.current
    if (phaseRef.current !== 'playing' || !c) return
    // Read the clock HERE, not from whatever the last frame left in a ref. A
    // frame-stale timestamp throws away up to 17 ms — a third of the PERFECT
    // window — before the player's accuracy is even measured.
    const now = perceivedNow(c)
    const stage = stageRef.current
    stage.laneTap[lane] = now

    let bestIdx = -1
    let bestD = Infinity
    for (let i = 0; i < notesRef.current.length; i++) {
      const n = notesRef.current[i]
      if (n.lane !== lane) continue
      const d = Math.abs(n.target - now)
      if (d < bestD) { bestD = d; bestIdx = i }
    }
    // An empty or early tap costs nothing but the pad flash — punishing it
    // would make the game feel like it is fighting the player.
    if (bestIdx < 0 || bestD > W_OK) return
    notesRef.current.splice(bestIdx, 1)

    const kind: Exclude<JudgeKind, 'miss'> =
      bestD <= W_PERFECT ? 'perfect' : bestD <= W_GOOD ? 'good' : 'ok'

    comboRef.current += 1
    maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
    tallyRef.current[kind] += 1

    const prevMult = multRef.current
    const mult = comboMult(comboRef.current)
    multRef.current = mult
    const points = PTS[kind] * mult
    scoreRef.current += points

    playSynthAt(laneTone(lane, mult), 0, 0.55)
    if (kind === 'perfect') playSynthAt(perfectSting(lane), 0, 0.45)
    if (mult > prevMult) {
      playSynthAt(multiplierTone(mult), 0, 0.5)
      stage.flareAt = now
    }
    spawnHit(stage, lane, kind, now)
    showJudge(kind, lane, points)
    syncHud()
  }

  function startGame() {
    const c = conductorRef.current ?? createConductor()
    conductorRef.current = c

    const stage = createStage()
    stageRef.current = stage
    notesRef.current = stage.notes

    spawnIdxRef.current = 0
    lastInLaneRef.current = [-9, -9, -9, -9]
    beatCursorRef.current = 0
    livesRef.current = START_LIVES
    scoreRef.current = 0
    comboRef.current = 0
    maxComboRef.current = 0
    multRef.current = 1
    tallyRef.current = { perfect: 0, good: 0, ok: 0, miss: 0 }
    savedRef.current = false
    setReward(null)
    setJudge(null)
    setHud({ score: 0, combo: 0, mult: 1, lives: START_LIVES })
    setResult(null)

    c.start(LEAD_IN)
    latencyRef.current = outputLatency()
    setPhase('playing')
  }

  /** Freeze the run and hand off to the results effect. Deliberately does NOT
   *  do the persistence itself: endGame is only ever reached from inside the
   *  rAF callback, whose closure was captured when the run STARTED. A run lasts
   *  minutes, and `applyAction` computes absolute stat columns from the
   *  `stats` snapshot it closed over — writing that at the end of a long run
   *  would stomp anything the other person in the household did meanwhile. */
  function endGame() {
    if (phaseRef.current === 'gameover') return
    phaseRef.current = 'gameover'
    conductorRef.current?.stop()
    stageRef.current.playing = false
    setResult({
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      tally: { ...tallyRef.current },
    })
    setPhase('gameover')
    syncHud()
  }

  // Everything that outlives the run. Runs from a fresh render, so `user`,
  // `applyAction`, `reportGameResult` and `completeTask` are current.
  useEffect(() => {
    if (phase !== 'gameover' || !result || savedRef.current) return
    savedRef.current = true
    const finalScore = result.score

    setBest(b => Math.max(b, finalScore))
    try {
      const prev = parseInt(localStorage.getItem('purr_beat_best') || '0', 10) || 0
      if (finalScore > prev) localStorage.setItem('purr_beat_best', String(finalScore))
    } catch { /* ignore */ }
    playSound('pr_gameover')

    if (!user?.id) return
    setReward(reportGameResult({ gameType: 'purr_beat', score: finalScore }))
    if (finalScore > 0) {
      fireMinigameDone('purr_beat', finalScore)
      completeTask('daily_game')
      if (finalScore >= WEEKLY_HS) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }, [phase, result, user, reportGameResult, completeTask, applyAction])

  // ─── Render ───────────────────────────────────────────────────────────────
  const tally = result?.tally ?? { perfect: 0, good: 0, ok: 0, miss: 0 }
  const hit = tally.perfect + tally.good + tally.ok
  const accuracy = hit + tally.miss > 0 ? Math.round((hit / (hit + tally.miss)) * 100) : 0
  const isNewBest = !!result && result.score > 0 && result.score >= bestScore

  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell select-none"
      style={{ background: '#160529' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(20,4,40,0.97) 0%, rgba(20,4,40,0.6) 100%)',
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

      {/* HUD */}
      {phase !== 'idle' && (
        <div className="px-4 py-2 flex-shrink-0 relative z-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-pixel" style={{ fontSize: 6, color: '#E9A8FB', letterSpacing: 2 }}>SCORE</div>
              <div className="font-pixel" style={{ fontSize: 22, color: '#FFFFFF', textShadow: '2px 2px 0 #2E0A52' }}>{hud.score}</div>
            </div>

            {/* Combo — the number punches on every increment via a keyed remount,
                and the multiplier badge only exists once it is worth something. */}
            {hud.combo >= 2 && (
              <div key={hud.combo} className="flex items-center gap-2 pb-0.5"
                style={{ animation: reduced ? undefined : 'pbComboPunch 260ms cubic-bezier(0.34,1.56,0.64,1)' }}>
                <div className="text-right">
                  <div className="font-pixel" style={{ fontSize: 6, color: '#E9A8FB', letterSpacing: 2 }}>COMBO</div>
                  <div className="font-pixel" style={{
                    fontSize: 20,
                    color: hud.mult > 1 ? '#FDE047' : '#F5D0FE',
                    textShadow: hud.mult > 1 ? '0 0 10px rgba(253,224,71,0.7), 2px 2px 0 #2E0A52' : '2px 2px 0 #2E0A52',
                  }}>{hud.combo}</div>
                </div>
                {hud.mult > 1 && (
                  <div className="font-pixel flex items-center justify-center" style={{
                    fontSize: 11, color: '#3B0764', minWidth: 30, padding: '5px 6px',
                    background: 'linear-gradient(135deg, #FDE047, #F59E0B)',
                    border: '2px solid #92400E', borderRadius: 4,
                    boxShadow: '0 3px 0 #78350F, 0 0 14px rgba(253,224,71,0.55)',
                  }}>x{hud.mult}</div>
                )}
              </div>
            )}
          </div>

          {/* Lives */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-pixel" style={{ fontSize: 6, color: '#E9A8FB', letterSpacing: 2 }}>LIVES</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: MAX_LIVES }).map((_, i) => {
                const filled = i < hud.lives
                const critical = filled && hud.lives <= 1 && !reduced
                return (
                  <div key={i} style={{
                    opacity: filled ? 1 : 0.18,
                    transform: filled ? 'scale(1)' : 'scale(0.75)',
                    transition: reduced ? undefined : 'opacity 0.2s, transform 0.2s',
                    filter: critical ? 'drop-shadow(0 0 6px rgba(232,121,249,0.95))' : 'none',
                    animation: critical ? 'pbHeartBeat 0.5s ease-in-out infinite' : undefined,
                  }}>
                    <IconHeart size={16} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Field */}
      <div className="flex-1 relative overflow-hidden">
        <PurrBeatStage stage={stageRef} reduced={reduced} drawRef={drawRef} />

        {/* Eren at the decks. Sits above the canvas but below the tap layer. */}
        {phase !== 'idle' && (
          <div className="absolute left-1/2 pointer-events-none" style={{ top: 2, marginLeft: -26, zIndex: 2 }}>
            <div ref={erenRef} style={{ transformOrigin: 'center bottom', willChange: 'transform' }}>
              <ErenDJ size={52} hyped={hud.mult > 1} worried={hud.lives <= 1} />
            </div>
          </div>
        )}

        {/* Tap targets. A transparent overlay rather than the lanes themselves,
            so the canvas never has to care about pointer events. */}
        {phase === 'playing' && (
          <div className="absolute inset-0 flex" style={{ zIndex: 3, touchAction: 'none' }}>
            {Array.from({ length: LANES }).map((_, lane) => (
              <div key={lane} className="flex-1" onPointerDown={() => judgeLane(lane)} />
            ))}
          </div>
        )}

        {/* Judgment floater */}
        {judge && phase === 'playing' && (
          <div key={judge.key} className="absolute pointer-events-none flex flex-col items-center" style={{
            left: `${((judge.lane + 0.5) / LANES) * 100}%`,
            top: '58%', transform: 'translateX(-50%)', zIndex: 4,
            animation: reduced ? undefined : 'pbJudge 0.62s cubic-bezier(0.22,1,0.36,1) forwards',
          }}>
            <span className="font-pixel" style={{
              fontSize: judge.kind === 'perfect' ? 13 : 11,
              color: JUDGE_STYLE[judge.kind].color, letterSpacing: 2, whiteSpace: 'nowrap',
              textShadow: '2px 2px 0 rgba(0,0,0,0.6), 0 0 14px currentColor',
            }}>{JUDGE_STYLE[judge.kind].text}</span>
            {judge.points > 0 && (
              <span className="font-pixel" style={{ fontSize: 8, marginTop: 3, color: '#FFFFFF', textShadow: '1px 1px 0 rgba(0,0,0,0.7)' }}>
                +{judge.points}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
          <Panel>
            <div style={{ animation: reduced ? undefined : 'pbIdleBop 1.1s ease-in-out infinite' }}>
              <ErenDJ size={62} hyped />
            </div>
            <p className="font-pixel" style={{ fontSize: 13, letterSpacing: 3, color: '#F5D0FE', textShadow: '0 0 14px rgba(232,121,249,0.8)' }}>PURR BEAT</p>

            {/* Lane key — teaches the control in one glance instead of a
                paragraph telling the player there are four lanes. */}
            <div className="flex items-center gap-2 mt-0.5">
              {LANE_HUE.map((hue, i) => (
                <div key={i} style={{
                  width: 30, height: 11, borderRadius: 3,
                  background: `linear-gradient(180deg, ${hue}, ${hue}99)`,
                  border: '2px solid rgba(0,0,0,0.45)',
                  boxShadow: `0 2px 0 rgba(0,0,0,0.4)`,
                  animation: reduced ? undefined : `pbKeyPulse 1.2s ease-in-out ${i * 0.14}s infinite`,
                }} />
              ))}
            </div>

            <div className="font-pixel text-center" style={{ fontSize: 6, color: '#E9A8FB', letterSpacing: 1, lineHeight: 2 }}>
              <p>TAP A LANE AS ITS NOTE</p>
              <p>REACHES THE LINE</p>
              <p style={{ color: '#FDE047' }}>KEEP THE STREAK FOR A BIGGER x</p>
            </div>

            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #E879F9 0%, #C026D3 100%)', border: '2px solid #701A75', borderRadius: 3, boxShadow: '0 4px 0 #701A75', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5 }}>
              <IconStar size={12} /> PLAY
            </button>
          </Panel>
        </div>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-4" style={{ background: 'rgba(14,4,28,0.78)' }}>
          <Panel animate={!reduced}>
            {isNewBest ? (
              <p className="font-pixel flex items-center gap-2" style={{ fontSize: 11, color: '#FDE047', letterSpacing: 2, textShadow: '0 0 12px rgba(253,224,71,0.8)' }}>
                <IconTrophy size={14} /> NEW BEST
              </p>
            ) : (
              <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 2 }}>OUT OF LIVES</p>
            )}

            <div className="flex items-center gap-4 mt-1">
              <Stat label="SCORE" value={result?.score ?? 0} color="#FFFFFF" />
              <Divider />
              <Stat label="MAX COMBO" value={result?.maxCombo ?? 0} color="#FDE047" />
              <Divider />
              <Stat label="ACCURACY" value={`${accuracy}%`} color="#A7F3D0" />
            </div>

            {/* Judgment breakdown — the number a rhythm player actually wants,
                and the reason to run it back. */}
            <div className="flex items-center gap-1 mt-1">
              {([['PURRFECT', tally.perfect, '#FDE047'], ['GOOD', tally.good, '#A7F3D0'], ['OK', tally.ok, '#BAE6FD'], ['MISS', tally.miss, '#FCA5A5']] as const).map(([label, n, color]) => (
                <div key={label} className="flex flex-col items-center px-2 py-1.5" style={{
                  background: 'rgba(0,0,0,0.35)', border: `2px solid ${color}44`, borderRadius: 4, minWidth: 54,
                }}>
                  <span className="font-pixel" style={{ fontSize: 5, color, letterSpacing: 0.5 }}>{label}</span>
                  <span className="font-pixel" style={{ fontSize: 12, color: '#FFFFFF', marginTop: 3 }}>{n}</span>
                </div>
              ))}
            </div>

            {reward && (<div className="mt-1"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}

            <div className="flex items-center gap-2 mt-2">
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
          </Panel>
        </div>
      )}

      <style jsx global>{`
        @keyframes pbPop { 0% { transform: scale(0.72); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pbJudge {
          0%   { transform: translate(-50%, 6px) scale(0.7); opacity: 0; }
          22%  { transform: translate(-50%, -6px) scale(1.12); opacity: 1; }
          70%  { transform: translate(-50%, -22px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -40px) scale(0.92); opacity: 0; }
        }
        @keyframes pbHeartBeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.22); } }
        @keyframes pbComboPunch { 0% { transform: scale(1.32); } 100% { transform: scale(1); } }
        @keyframes pbIdleBop { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-5px) rotate(2deg); } }
        @keyframes pbKeyPulse { 0%, 100% { transform: translateY(0); filter: brightness(1); } 50% { transform: translateY(-3px); filter: brightness(1.45); } }
      `}</style>
    </div>
  )
}
