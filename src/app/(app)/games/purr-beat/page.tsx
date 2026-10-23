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
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useErenIdle } from '@/hooks/useErenIdle'
import ErenReact, { useErenReaction } from '@/components/games/ErenReact'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import GameCoinReward from '@/components/games/GameCoinReward'
import PurrBeatStage, { createStage, spawnHit, LANE_HUE, type StageState, type JudgeKind } from '@/components/games/PurrBeatStage'
import { ErenDJ } from '@/components/games/PurrBeatChrome'
import {
  GameTopBar, GameStatRow, GameStat, GAME_STAT_URGENT, GameStartCard, GameArtTile, GameResultCard,
} from '@/components/games/GameChrome'
import { M, MeadowIcon } from '@/components/meadow'
import { playSound, playSynthAt } from '@/lib/sounds'
import { outputLatency } from '@/lib/soundSynth'
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
  perfect: { text: 'Purrfect', color: '#8A5A12' },
  good: { text: 'Good', color: M.leafInk },
  ok: { text: 'OK', color: '#386B96' },
  miss: { text: 'Miss', color: M.danger },
}

/** The results card's judgment breakdown, in tally order. */
const BREAKDOWN: { key: keyof Tally; label: string; dot: string }[] = [
  { key: 'perfect', label: 'Purrfect', dot: M.energy },
  { key: 'good', label: 'Good', dot: M.leaf },
  { key: 'ok', label: 'OK', dot: LANE_HUE[2] },
  { key: 'miss', label: 'Miss', dot: M.danger },
]

function comboMult(combo: number): number {
  return combo >= 50 ? 4 : combo >= 25 ? 3 : combo >= 10 ? 2 : 1
}

interface Tally { perfect: number; good: number; ok: number; miss: number }

type Phase = 'idle' | 'playing' | 'gameover'

export default function PurrBeatGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const reduced = useReducedMotion()
  const idle = useErenIdle()
  const rx = useErenReaction()

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
    rx.bad()
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
      // Only on a multiplier step, not every hit — notes land far too fast for
      // a per-note hop to read as anything but jitter.
      rx.good()
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
  const goBack = () => { playSound('ui_back'); router.replace('/games') }
  const playRound = () => { playSound('ui_tap'); startGame() }

  return (
    <div className="meadow-root pb-game fixed inset-0 z-40 flex flex-col game-shell select-none"
      style={{ background: M.soft }}>

      {/* Header + stats — the shared Meadow game chrome. */}
      <GameTopBar title="Purr Beat" onBack={goBack} />

      {phase !== 'idle' && (
        <GameStatRow>
          <GameStat icon={<MeadowIcon name="star" size={16} />} value={hud.score} ariaLabel={`Score ${hud.score}`} />
          {/* Combo — punches on every increment via the pulse key, and goes
              amber once the streak is worth a multiplier. */}
          <GameStat
            label="Combo"
            value={<>{hud.combo}{hud.mult > 1 && <span style={{ fontSize: 13 }}>×{hud.mult}</span>}</>}
            tone={hud.mult > 1 ? 'hot' : 'plain'}
            pulse={hud.combo >= 2 && !reduced ? hud.combo : undefined}
          />
          <GameStat
            ariaLabel={`Lives ${hud.lives} of ${MAX_LIVES}`}
            tone={hud.lives <= 1 ? 'warn' : 'plain'}
            style={hud.lives === 1 && !reduced ? GAME_STAT_URGENT : undefined}
            value={
              <span className="flex items-center" style={{ gap: 2 }}>
                {Array.from({ length: MAX_LIVES }).map((_, i) => {
                  const filled = i < hud.lives
                  return (
                    <span key={i} className="flex" style={{
                      opacity: filled ? 1 : 0.18,
                      transform: filled ? 'scale(1)' : 'scale(0.75)',
                      transition: reduced ? undefined : 'opacity 0.2s, transform 0.2s',
                    }}>
                      <MeadowIcon name="heart" size={14} />
                    </span>
                  )
                })}
              </span>
            }
          />
        </GameStatRow>
      )}

      {/* The chrome floats over the screen, so the field starts below it.
          game-shell already pads the safe area; this clears bar + stat row. */}
      <div aria-hidden className="flex-shrink-0" style={{ height: 104 }} />

      {/* Field */}
      <div className="pb-field flex-1 min-h-0 relative overflow-hidden">
        <PurrBeatStage stage={stageRef} reduced={reduced} drawRef={drawRef} />

        {/* Eren at the decks. Sits above the canvas but below the tap layer. */}
        {phase !== 'idle' && (
          <div className="absolute left-1/2 pointer-events-none" style={{ top: 'max(0px, calc(10% - 62px))', marginLeft: -26, zIndex: 2 }}>
            <div ref={erenRef} style={{ transformOrigin: 'center bottom', willChange: 'transform' }}>
              <ErenReact reaction={rx.reaction} size={52} origin="center">
                <ErenDJ size={52} hyped={hud.mult > 1} worried={hud.lives <= 1}
                  blink={idle.blink} twitch={idle.twitch} glance={idle.glance} />
              </ErenReact>
            </div>
          </div>
        )}

        {/* Tap targets. A transparent overlay rather than the lanes themselves,
            so the canvas never has to care about pointer events. */}
        {phase === 'playing' && (
          <div className="absolute inset-0 flex" style={{ zIndex: 3, touchAction: 'none' }}>
            {Array.from({ length: LANES }).map((_, lane) => (
              <button key={lane} type="button" className="pb-lane m-focus flex-1"
                aria-label={`Lane ${lane + 1}`} style={{ background: 'transparent', border: 0, padding: 0 }}
                onPointerDown={event => { event.preventDefault(); judgeLane(lane) }}
                onClick={event => { if (event.detail === 0) judgeLane(lane) }} />
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
            <span style={{
              fontSize: judge.kind === 'perfect' ? 17 : 15, fontWeight: 800,
              color: JUDGE_STYLE[judge.kind].color, whiteSpace: 'nowrap',
              background: M.ground, borderRadius: 999, padding: '4px 10px',
              boxShadow: `0 3px 0 ${M.groundLip}`,
            }}>{JUDGE_STYLE[judge.kind].text}</span>
            {judge.points > 0 && (
              <span style={{ fontSize: 13, fontWeight: 800, marginTop: 5, color: M.text }}>
                +{judge.points}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <GameStartCard
          title="Purr Beat"
          art={<>
            <GameArtTile size={44}><ErenDJ size={34} hyped /></GameArtTile>
            {/* Lane key — teaches the control in one glance: four lanes, four colours. */}
            {LANE_HUE.map((hue, i) => (
              <GameArtTile key={i} size={38} tint={`${hue}26`}>
                <span style={{ width: 22, height: 9, borderRadius: 4, background: hue }} />
              </GameArtTile>
            ))}
          </>}
          best={bestScore}
          onStart={playRound}
        >
          Tap a lane as its note reaches the line. Keep the streak going for a bigger multiplier.
        </GameStartCard>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <GameResultCard
          headline="Out of lives"
          score={result?.score ?? 0}
          newBest={isNewBest}
          best={bestScore}
          stats={[
            { label: 'Max combo', value: result?.maxCombo ?? 0 },
            { label: 'Accuracy', value: `${accuracy}%` },
          ]}
          reward={reward && <GameCoinReward coins={reward.coins} blocked={reward.blocked} />}
          onAgain={playRound}
          onBack={goBack}
        >
          {/* Judgment breakdown — the number a rhythm player actually wants,
              and the reason to run it back. */}
          <div className="grid w-full" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            {BREAKDOWN.map(({ key, label, dot }) => (
              <div key={key} className="flex flex-col items-center" style={{ padding: '8px 4px', borderRadius: 14, background: M.soft }}>
                <span className="flex items-center" style={{ gap: 4, fontSize: 12, fontWeight: 700, color: M.text2 }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />
                  {label}
                </span>
                <span style={{ marginTop: 2, fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: M.text }}>
                  {tally[key]}
                </span>
              </div>
            ))}
          </div>
        </GameResultCard>
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .pb-game *, .pb-game *::before, .pb-game *::after {
            animation: none !important; transition: none !important;
          }
        }
        @keyframes pbJudge {
          0%   { transform: translate(-50%, 6px) scale(0.7); opacity: 0; }
          22%  { transform: translate(-50%, -6px) scale(1.12); opacity: 1; }
          70%  { transform: translate(-50%, -22px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -40px) scale(0.92); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
