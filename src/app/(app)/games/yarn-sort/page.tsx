'use client'

// ═══════════════════════════════════════════════════════════════════════════
// YARN SORT — water/ball-sort puzzle, themed for the Eren app.
// ────────────────────────────────────────────────────────────────────────
// Tap a jar to lift its top run of same-coloured yarn, tap another to drop
// it on (must be empty, or same colour on top with room). Sort every jar to
// a single colour to clear the level. Difficulty climbs (more colours) each
// couple of levels.
//
// Scoring axis = EFFICIENCY via a shared MOVE BANK. Each pour costs one move;
// solving a level refills the bank. As the colour count climbs, levels cost
// more pours than the refill grants, so the bank trends down and the run ends
// — a clean, skill-based game-over with no timer. SCORE = levels solved.
//
// Levels are generated solvable-by-construction: a random deal is DFS-verified
// before it's dealt, and the verifier is PESSIMISTIC (an unproven board is
// rejected, never shipped), so you can never be handed an impossible board.
//
// You also can't trap yourself: a pour that would freeze the board (no legal move
// left, unsolved) is blocked, and if you wander into an unsolvable corner anyway,
// UNDO is always available to back out. The run only ends when the move bank empties.
//
// Open holders keep each yarn ball visible. The held run lifts above its
// stack, and a leaf-green outline marks every legal destination.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useErenIdle } from '@/hooks/useErenIdle'
import ErenReact, { useErenReaction } from '@/components/games/ErenReact'
import GameCoinReward from '@/components/games/GameCoinReward'
import PixelEren, { type ErenPose } from '@/components/games/PixelEren'
import { playSound } from '@/lib/sounds'
import {
  GameTopBar, GameStatRow, GameStat, GAME_STAT_URGENT, GAME_BOARD_TOP, GameFootnote, GameStartCard, GameArtTile, GameResultCard,
} from '@/components/games/GameChrome'
import { FONT_ROUNDED, M, MeadowIcon, TextButton } from '@/components/meadow'
import { fireMinigameDone } from '@/lib/minigames'
import { readPuzzle, writePuzzle, clearPuzzle, type YarnSortSave } from '@/lib/puzzleSaves'

// ─── Tunables ───────────────────────────────────────────────────────────────
const SEG          = 4    // segments per colour = jar capacity
const EMPTIES      = 2    // spare empty jars (≥2 keeps random deals solvable)
const START_MOVES  = 30   // starting move bank
const REFILL_BASE  = 7    // a solve grants REFILL_BASE + colours moves
const UNDO_LIMIT   = 3    // undos per run (each refunds its pour)
const LOW_MOVES    = 6    // bank warning threshold
const WEEKLY_HS    = 8    // levels solved that completes the weekly high-score task

// Five holders and their gaps fit inside a 360px phone's 16px side gutters.
const TUBE_W    = 52                    // outer holder width
const SEG_W     = 40                    // yarn ball width
const SEG_H     = 36                    // yarn ball height
const TUBE_H    = SEG * SEG_H + 12      // jar body height
const HOLD_LIFT = 16                    // px the held run rises above the rest
const ROW_MAX   = 5                     // holders per row
const JAR_GAP   = 12                    // px between holders

// Up to 8 distinct yarn colours; palettes match the app's pink/gold/mint set.
interface Palette { main: string; dark: string; light: string }
const COLORS: Palette[] = [
  { main: M.love, dark: '#AF5276', light: M.loveLight },
  { main: M.coin, dark: M.coinRim, light: M.coinShine },
  { main: '#78AE83', dark: M.leaf, light: '#BDDABD' },
  { main: '#6FA3D2', dark: '#386B96', light: '#B9D8F0' },
  { main: '#AA8BC7', dark: '#785B94', light: '#D7C7E6' },
  { main: '#DF8171', dark: '#A34F42', light: '#F2BDB2' },
  { main: M.flame, dark: '#AC6029', light: '#F7C79D' },
  { main: '#65BABB', dark: '#397F86', light: '#B2E1DE' },
]

// Solve-burst particle directions — fixed so they don't reshuffle every render.
const SPARKS = [
  { dx: -18, dy: -22 }, { dx: -6, dy: -30 }, { dx: 8, dy: -28 },
  { dx: 20, dy: -18 },  { dx: -26, dy: -8 }, { dx: 26, dy: -6 },
]

// ─── Pure helpers ───────────────────────────────────────────────────────────
// A jar is a bottom→top stack of colour indices. Board = jar[].

function colorsForLevel(level: number): number {
  return Math.min(COLORS.length, 3 + Math.floor((level - 1) / 2))
}
function refillForLevel(colors: number): number {
  return REFILL_BASE + colors
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isSolved(tubes: number[][]): boolean {
  return tubes.every(t => t.length === 0 || (t.length === SEG && t.every(c => c === t[0])))
}

// A jar is "finished" once it holds a full stack of one colour — it's out of
// play for the rest of the level, and the UI marks it so the eye can skip it.
function isFinished(stack: number[]): boolean {
  return stack.length === SEG && stack.every(c => c === stack[0])
}

// How many same-coloured segments sit on top — exactly what a pour would move.
function topRun(stack: number[]): number {
  if (stack.length === 0) return 0
  const c = stack[stack.length - 1]
  let n = 0
  for (let i = stack.length - 1; i >= 0 && stack[i] === c; i--) n++
  return n
}

function canPour(tubes: number[][], src: number, dst: number): boolean {
  if (src === dst) return false
  const s = tubes[src]
  if (s.length === 0) return false
  const d = tubes[dst]
  if (d.length >= SEG) return false
  const sc = s[s.length - 1]
  if (d.length > 0 && d[d.length - 1] !== sc) return false
  // No-progress prune: don't move a jar that's already one solid colour into
  // an empty jar (it accomplishes nothing and would waste a move).
  if (d.length === 0 && s.every(c => c === sc)) return false
  return true
}

function applyPour(tubes: number[][], src: number, dst: number): { tubes: number[][]; moved: number } {
  const next = tubes.map(t => [...t])
  const s = next[src], d = next[dst]
  const c = s[s.length - 1]
  let moved = 0
  while (s.length > 0 && s[s.length - 1] === c && d.length < SEG) {
    d.push(s.pop() as number)
    moved++
  }
  return { tubes: next, moved }
}

function hasAnyLegalMove(tubes: number[][]): boolean {
  const n = tubes.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (canPour(tubes, i, j)) return true
    }
  }
  return false
}

// A "stranding" pour leaves the board unsolved AND with no legal move left — a
// dead end that can never be part of a solution. We block these so the player
// can never freeze the board into the "every option is wrong" softlock.
function strandsBoard(tubes: number[][], src: number, dst: number): boolean {
  const next = applyPour(tubes, src, dst).tubes
  return !isSolved(next) && !hasAnyLegalMove(next)
}

// True if the board offers a move that is NOT a dead end. A solvable, unsolved
// board ALWAYS has one (verified over 40k+ states), so blocking stranding moves
// can never freeze a still-solvable board. When this is false the player has
// wandered into an unsolvable corner and must undo to back out.
function hasNonStrandingMove(tubes: number[][]): boolean {
  const n = tubes.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (canPour(tubes, i, j) && !strandsBoard(tubes, i, j)) return true
    }
  }
  return false
}

// Jar identity doesn't matter, so sort the jar strings for the visited key —
// this collapses symmetric states and keeps the search small.
function canonical(tubes: number[][]): string {
  return tubes.map(t => t.join(',')).sort().join('|')
}

// DFS reachability to a solved state, bounded so a pathological board can't hang
// generation. The cap is PESSIMISTIC: if we can't PROVE a board solvable within
// the cap we reject it and deal another — we never ship a board we didn't prove
// solvable. (Empirically every solvable deal here verifies in <400 nodes, so the
// cap never bites a real board; flipping it to optimistic is what could hand the
// player an impossible board on hard levels.)
function solvable(start: number[][]): boolean {
  const NODE_CAP = 200000
  const visited = new Set<string>()
  const stack: number[][][] = [start]
  let nodes = 0
  while (stack.length > 0) {
    const cur = stack.pop() as number[][]
    if (isSolved(cur)) return true
    const key = canonical(cur)
    if (visited.has(key)) continue
    visited.add(key)
    if (++nodes > NODE_CAP) return false
    const n = cur.length
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (canPour(cur, i, j)) {
          const nt = applyPour(cur, i, j).tubes
          if (!visited.has(canonical(nt))) stack.push(nt)
        }
      }
    }
  }
  return false
}

function dealRandom(colors: number, empties: number): number[][] {
  const pool: number[] = []
  for (let c = 0; c < colors; c++) for (let k = 0; k < SEG; k++) pool.push(c)
  const dealt = shuffle(pool)
  const tubes: number[][] = []
  for (let c = 0; c < colors; c++) tubes.push(dealt.slice(c * SEG, (c + 1) * SEG))
  for (let e = 0; e < empties; e++) tubes.push([])
  return tubes
}

// Always returns a board PROVEN solvable. With EMPTIES spare jars a random deal
// is solvable essentially every time (verified), so this returns on the first
// try. The empties-escalation is a guaranteed-terminating safety net — more empty
// jars makes a board strictly easier to sort — so the loop can never fail to find
// a solvable board and hand back an impossible one.
function genLevel(level: number): number[][] {
  const colors = colorsForLevel(level)
  for (let empties = EMPTIES; empties <= EMPTIES + colors; empties++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const tubes = dealRandom(colors, empties)
      if (!isSolved(tubes) && solvable(tubes)) return tubes
    }
  }
  return dealRandom(colors, EMPTIES + colors) // unreachable in practice
}

// Split jar indices into shelf rows of at most ROW_MAX, balanced so 7 jars read
// as 4+3 rather than a lopsided 5+2.
function shelfRows(count: number): number[][] {
  if (count === 0) return []
  const rowCount = Math.ceil(count / ROW_MAX)
  const per = Math.ceil(count / rowCount)
  const rows: number[][] = []
  for (let i = 0; i < count; i += per) {
    rows.push(Array.from({ length: Math.min(per, count - i) }, (_, k) => i + k))
  }
  return rows
}

// ─── Yarn ball ──────────────────────────────────────────────────────────────
function YarnBall({ pal, size, style }: { pal: Palette; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="ys-ball block flex-shrink-0" style={{
      width: size ?? SEG_W, height: size ?? SEG_H, flexShrink: 0,
      ...style,
    }}>
      <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="21" r="18" fill={pal.dark} />
        <circle cx="20" cy="19" r="18" fill={pal.main} />
        <g stroke={pal.light} strokeWidth="1.8" strokeLinecap="round">
          <path d="M7 7C18 9 28 19 31 31M4 12C15 14 24 24 27 35M3 18C12 20 18 28 21 37" />
          <path d="M14 3C14 14 23 21 36 24M20 1C19 11 27 17 37 18M26 3C26 9 30 12 36 13" />
        </g>
        <path d="M4 25C10 15 19 10 31 8M7 31C15 21 25 17 37 17" stroke={pal.dark} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    </span>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────
type Phase = 'idle' | 'playing' | 'gameover'

export default function YarnSortGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()
  const idle = useErenIdle()
  const rx = useErenReaction()

  const [phase, setPhase]         = useState<Phase>('idle')
  const [tubes, setTubes]         = useState<number[][]>([])
  const [selected, setSelected]   = useState<number | null>(null)
  const [solved, setSolved]       = useState(0)        // = score (levels cleared)
  const [movesLeft, setMovesLeft] = useState(START_MOVES)
  const [undosLeft, setUndosLeft] = useState(UNDO_LIMIT)
  const [history, setHistory]     = useState<number[][][]>([]) // snapshots, this level
  const [bestScore, setBest]      = useState(0)
  const [celebrating, setCelebrating] = useState(false)
  const [lastRefill, setLastRefill]   = useState(0)
  const [solveFx, setSolveFx]     = useState(0)
  const [shake, setShake]         = useState(0)
  const [pourFx, setPourFx]       = useState<{ tube: number; n: number; key: number } | null>(null)
  const [notice, setNotice]       = useState<{ text: string; key: number } | null>(null)
  const [fret, setFret]           = useState<{ key: number } | null>(null)  // Eren startled
  const [reward, setReward]       = useState<GameRewardResult | null>(null)
  const savedRef = useRef(false)
  const fxKey = useRef(0)
  const [savedGame, setSavedGame] = useState<{ owner: string; data: YarnSortSave | null } | null>(null)
  const resumable = savedGame?.owner === user?.id ? savedGame?.data : null
  useEffect(() => {
    const data = user?.id ? readPuzzle('yarn_sort', user.id) : null
    setSavedGame(user ? { owner: user.id, data } : null)
  }, [user?.id])

  function checkpoint(data: YarnSortSave) {
    if (!user) return
    if (data.movesLeft <= 0) { clearPuzzle('yarn_sort', user.id); setSavedGame(null); return }
    writePuzzle('yarn_sort', user.id, data)
  }

  function continueGame() {
    if (!resumable) return
    timers.clearAll()
    setTubes(resumable.tubes)
    setSolved(resumable.solved)
    scoreRef.current = resumable.solved
    setMovesLeft(resumable.movesLeft)
    setUndosLeft(resumable.undosLeft)
    setHistory(resumable.history)
    setSelected(null)
    setPhase('playing')
    savedRef.current = false
  }

  // Mirror score into a ref so endGame (fired via setTimeout) reads the true
  // final total, not a stale closure value (matches the other games).
  const scoreRef = useRef(0)
  useEffect(() => { scoreRef.current = solved }, [solved])

  // Persist BEST across visits (matches the rest of the catalogue).
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem('yarn_sort_best') || '', 10)
      if (Number.isFinite(n) && n > 0) setBest(n)
    } catch { /* localStorage unavailable */ }
  }, [])

  const level = solved + 1

  // The board is "stuck" only when no NON-dead-end move remains — i.e. the player
  // has wandered into an unsolvable corner. (Fresh levels are always solvable, so
  // this is never true at the start of a level.) When stuck, undo is the escape.
  const stuck = useMemo(
    () => phase === 'playing' && !celebrating && tubes.length > 0
      && !isSolved(tubes) && !hasNonStrandingMove(tubes),
    [phase, celebrating, tubes],
  )
  // Undo works for voluntary take-backs (limited) OR to escape a stuck board
  // (unlimited rescue) — so the player can never be permanently frozen.
  const canUndo = phase === 'playing' && !celebrating && movesLeft > 0 && history.length > 0 && (undosLeft > 0 || stuck)

  // Jars the held run can legally land on. Dead-end pours are excluded because
  // tapTube blocks them anyway — highlighting a target we'd then reject would be
  // a lie. Null when nothing is held, which means "don't dim anything".
  const targets = useMemo(() => {
    if (selected === null) return null
    const set = new Set<number>()
    for (let j = 0; j < tubes.length; j++) {
      if (canPour(tubes, selected, j) && !strandsBoard(tubes, selected, j)) set.add(j)
    }
    return set
  }, [tubes, selected])

  const heldRun = selected === null ? 0 : topRun(tubes[selected] ?? [])
  const rows = useMemo(() => shelfRows(tubes.length), [tubes.length])
  const movesLow = movesLeft <= LOW_MOVES
  const nextRefill = refillForLevel(colorsForLevel(level))

  // Eren doubles as feedback: you can read the last thing that happened off his
  // pose without looking away from the jar you're aiming at.
  const erenPose: ErenPose = celebrating ? 'cheer' : (stuck || fret !== null) ? 'wobble' : 'idle'
  // His yarn ball takes the colour of the last thing you poured.
  const ballColor = (() => {
    const landed = pourFx ? tubes[pourFx.tube] : undefined
    return landed && landed.length > 0 ? COLORS[landed[landed.length - 1]] : COLORS[0]
  })()

  function flashNotice(text: string) {
    fxKey.current += 1
    const key = fxKey.current
    setNotice({ text, key })
    timers.setTimeout(() => setNotice(n => (n && n.key === key ? null : n)), 1100)
  }

  // Eren startles on a rejected tap. Keyed so overlapping startles don't let an
  // earlier timer end a later one's reaction.
  function startle() {
    fxKey.current += 1
    const key = fxKey.current
    setFret({ key })
    rx.bad()
    timers.setTimeout(() => setFret(f => (f && f.key === key ? null : f)), 620)
  }

  function startGame() {
    timers.clearAll()
    const board = genLevel(1)
    checkpoint({ tubes: board, solved: 0, movesLeft: START_MOVES, undosLeft: UNDO_LIMIT, history: [] })
    setTubes(board)
    setSelected(null)
    setSolved(0)
    scoreRef.current = 0
    setMovesLeft(START_MOVES)
    setUndosLeft(UNDO_LIMIT)
    setHistory([])
    setCelebrating(false)
    setLastRefill(0)
    setPourFx(null)
    setNotice(null)
    setReward(null)
    savedRef.current = false
    setPhase('playing')
  }

  function scheduleEnd() {
    timers.setTimeout(() => endGame(), 360)
  }

  function endGame() {
    const finalScore = scoreRef.current
    if (user) clearPuzzle('yarn_sort', user.id)
    setSavedGame(null)
    setPhase('gameover')
    setSelected(null)
    setBest(b => Math.max(b, finalScore))
    try {
      const prev = parseInt(localStorage.getItem('yarn_sort_best') || '0', 10) || 0
      if (finalScore > prev) localStorage.setItem('yarn_sort_best', String(finalScore))
    } catch { /* ignore */ }
    playSound('ys_gameover')

    if (!savedRef.current && user?.id) {
      savedRef.current = true
      setReward(reportGameResult({ gameType: 'yarn_sort', score: finalScore }))
      if (finalScore > 0) {
        fireMinigameDone('yarn_sort', finalScore)
        completeTask('daily_game')
        if (finalScore >= WEEKLY_HS) completeTask('weekly_high_score')
        applyAction(user.id, 'play')
      }
    }
  }

  function handleSolved() {
    const justLevel = solved + 1
    const refill = refillForLevel(colorsForLevel(justLevel))
    const nextBoard = genLevel(justLevel + 1)
    // A reload during the celebration resumes the next deal, not a solved board.
    checkpoint({ tubes: nextBoard, solved: justLevel, movesLeft: movesLeft - 1 + refill, undosLeft, history: [] })
    playSound('ys_solve')
    setSolved(s => s + 1)
    setMovesLeft(m => m + refill)
    setLastRefill(refill)
    setHistory([])
    setSelected(null)
    setCelebrating(true)
    rx.good()
    if (!reduced) setSolveFx(k => k + 1)
    timers.setTimeout(() => {
      setTubes(nextBoard)
      setCelebrating(false)
      // Drop the landing FX with the old board — its tube index means nothing
      // on the next deal.
      setPourFx(null)
    }, reduced ? 420 : 900)
  }

  function attemptPour(src: number, dst: number) {
    // assumes canPour already checked by caller
    setHistory(h => [...h, tubes])
    const { tubes: next, moved } = applyPour(tubes, src, dst)
    setTubes(next)
    fxKey.current += 1
    setPourFx({ tube: dst, n: moved, key: fxKey.current })
    playSound('ys_pour')

    const newMoves = movesLeft - 1
    setMovesLeft(newMoves)

    if (isSolved(next)) { handleSolved(); return }
    checkpoint({ tubes: next, solved, movesLeft: newMoves, undosLeft, history: [...history, tubes] })
    if (newMoves <= 0) { scheduleEnd(); return }
    // No 'stuck' end here: tapTube blocks any pour that would dead-end the board,
    // so `next` always has a legal move (or is solved). The run ends only when the
    // move bank empties — the intended skill-based game-over.
    if (newMoves <= LOW_MOVES && movesLeft > LOW_MOVES) playSound('ys_low')
  }

  function tapTube(i: number) {
    if (phase !== 'playing' || celebrating || movesLeft <= 0) return
    if (selected === null) {
      if (tubes[i].length === 0) return
      setSelected(i)
      playSound('ys_pick')
      return
    }
    if (selected === i) { setSelected(null); return }
    if (canPour(tubes, selected, i)) {
      if (strandsBoard(tubes, selected, i)) {
        // Legal pour, but it would freeze the board with no way forward — block it
        // so the player never lands in the "every option is wrong" softlock. Costs
        // no move; there's always a non-dead-end move available instead.
        playSound('ys_invalid')
        setShake(s => s + 1)
        startle()
        flashNotice('Dead end')
        setSelected(null)
        return
      }
      attemptPour(selected, i)
      setSelected(null)
    } else {
      playSound('ys_invalid')
      setShake(s => s + 1)
      startle()
      if (tubes[i].length > 0) { setSelected(i); playSound('ys_pick') }
      else setSelected(null)
    }
  }

  function undo() {
    if (phase !== 'playing' || celebrating || movesLeft <= 0) return
    if (history.length === 0) return
    const voluntary = undosLeft > 0
    if (!voluntary && !stuck) return // out of undos and not a stuck-rescue
    const prev = history[history.length - 1]
    checkpoint({
      tubes: prev, solved, movesLeft: movesLeft + (voluntary ? 1 : 0),
      undosLeft: undosLeft - (voluntary ? 1 : 0), history: history.slice(0, -1),
    })
    setHistory(h => h.slice(0, -1))
    setTubes(prev)
    if (voluntary) {
      setUndosLeft(u => u - 1)
      setMovesLeft(m => m + 1) // a voluntary take-back refunds its pour
    }
    // Rescue undo (stuck, no undos left) reverts the board but neither refunds the
    // move nor consumes an undo: you're never permanently frozen, yet the misplay
    // still cost its move so the run still ends fairly when the bank empties.
    setSelected(null)
    setPourFx(null)
    playSound('ys_undo')
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="meadow-root ys-game fixed inset-0 z-40 flex flex-col game-shell overflow-hidden"
      style={{ background: M.soft }}>

      {/* Header + stats — the shared Meadow game chrome. */}
      <GameTopBar title="Yarn Sort" onBack={() => { playSound('ui_back'); router.replace('/games') }} />

      <GameStatRow>
        <GameStat label="Level" value={level} ariaLabel={`Level ${level}`} />
        <GameStat label="Moves" value={movesLeft} tone={movesLow ? 'warn' : 'plain'}
          pulse={reduced ? undefined : movesLeft} ariaLabel={`${movesLeft} moves left`} />
        <button
          onClick={() => { playSound('ui_tap'); undo() }}
          disabled={!canUndo}
          aria-label="Undo last pour"
          className="active:translate-y-[2px] transition-transform"
          style={{
            pointerEvents: 'auto', padding: 0, border: 0, background: 'none',
            opacity: canUndo ? 1 : 0.5, touchAction: 'manipulation',
          }}>
          <GameStat
            icon={<MeadowIcon name="replay" size={18} />}
            label="Undo"
            value={undosLeft}
            tone={stuck ? 'hot' : 'plain'}
            style={stuck && !reduced ? GAME_STAT_URGENT : undefined}
          />
        </button>
      </GameStatRow>

      {/* Spacer: the chrome above is absolutely positioned, so the shelf starts below it.
          .game-shell already pads the safe area, so this is GAME_BOARD_TOP minus it. */}
      <div aria-hidden className="flex-shrink-0" style={{ height: `calc(${GAME_BOARD_TOP} - var(--safe-top))` }} />

      {/* What a solve pays back, and your best — quiet under the shelf */}
      {phase === 'playing' && (
        <GameFootnote>
          Solve pays +{nextRefill}
          <span aria-hidden>·</span>
          <MeadowIcon name="star" size={12} /> Best {bestScore}
        </GameFootnote>
      )}

      {/* Shelf field */}
      <div className="ys-field relative flex-1 min-h-0 flex flex-col px-4 select-none overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)', paddingTop: 36 }}>

        {/* Stuck rescue banner — only when the player has no non-dead-end move left */}
        {stuck && (
          <div className="absolute left-1/2 -translate-x-1/2 z-30 px-4 py-2 text-center" style={{
            top: 2,
            background: '#FFFFFF',
            borderRadius: 18,
            fontFamily: FONT_ROUNDED, fontWeight: 800, fontSize: 14, lineHeight: 1.3,
            whiteSpace: 'nowrap',
            boxShadow: `0 3px 0 ${M.overArtLip}`,
            animation: reduced ? undefined : 'ysStuckPulse 0.9s ease-in-out infinite',
          }}>
            <span style={{ color: M.text }}>Dead end</span><br />
            <span style={{ color: M.danger, fontSize: 13, fontWeight: 700 }}>Tap undo to back up</span>
          </div>
        )}
        {/* Transient notice — e.g. a blocked dead-end pour */}
        {notice && !stuck && (
          <div key={notice.key} className="absolute left-1/2 -translate-x-1/2 z-30 px-4 py-1.5" style={{
            top: 2,
            background: M.dangerTint,
            borderRadius: 999,
            fontFamily: FONT_ROUNDED, fontWeight: 800, fontSize: 14, color: M.danger,
            whiteSpace: 'nowrap',
            boxShadow: `0 3px 0 ${M.overArtLip}`,
            animation: reduced ? undefined : 'ysNotice 1.1s ease-out forwards',
          }}>
            {notice.text}
          </div>
        )}

        {/* Level-clear banner — states the payout so the move economy is legible */}
        {celebrating && (
          <div key={`clear-${solveFx}`} className="absolute left-1/2 -translate-x-1/2 z-30 px-4 py-2 text-center" style={{
            top: 2,
            background: '#FFFFFF',
            borderRadius: 18,
            fontFamily: FONT_ROUNDED, whiteSpace: 'nowrap',
            boxShadow: `0 3px 0 ${M.overArtLip}`,
            animation: reduced ? undefined : 'ysBanner 0.9s ease-out both',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.text }}>Level {solved} clear</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: M.leafInk, marginTop: 2 }}>+{lastRefill} moves</div>
          </div>
        )}

        {/* Shelf rows */}
        <div key={`shake-${shake}`} className="ys-board flex flex-col items-center"
          style={{ margin: 'auto', flexShrink: 0, gap: 22, animation: shake > 0 && !reduced ? 'ysShake 0.26s steps(5,end)' : undefined }}>
          {rows.map((row, r) => (
            <div key={r} className="relative flex items-end justify-center" style={{ gap: JAR_GAP, paddingTop: 28 }}>
              {row.map(idx => {
                const stack = tubes[idx]
                const isSel = selected === idx
                const isTarget = targets !== null && targets.has(idx)
                const dimmed = targets !== null && !isSel && !isTarget
                const finished = isFinished(stack)
                // Index of the lowest band in the held run. Those bands rise a fixed
                // HOLD_LIFT so the run reads as picked up and pokes over the rim —
                // a fixed lift (rather than floating the run clear of the jar) keeps
                // even a full 4-band hold inside the row's headroom.
                const holdFrom = isSel ? stack.length - heldRun : stack.length

                return (
                  <button type="button" key={idx} onClick={() => tapTube(idx)}
                    aria-label={`Jar ${idx + 1}, ${stack.length} of ${SEG} full`}
                    aria-pressed={isSel} disabled={phase !== 'playing' || celebrating}
                    data-stack={JSON.stringify(stack)} data-target={isTarget} data-finished={finished}
                    className="ys-jar m-focus relative"
                    style={{
                      width: TUBE_W,
                      height: TUBE_H,
                      zIndex: isSel ? 6 : 1,
                      // Dim, don't erase: you still need to read the whole board
                      // to plan while holding a run.
                      opacity: dimmed ? 0.58 : 1,
                      transform: isSel ? 'translateY(-6px)' : isTarget ? 'translateY(-3px)' : 'none',
                      transition: 'transform 0.14s ease-out, opacity 0.16s',
                      border: 0, padding: 0, background: 'transparent',
                      touchAction: 'manipulation',
                      animation: isTarget && !reduced ? 'ysTarget 1s ease-in-out infinite' : undefined,
                    }}>

                    {/* Open holder and empty slots keep the capacity readable. */}
                    <span aria-hidden className="absolute inset-0" style={{
                      background: isTarget || finished ? M.leafTint : M.ground,
                      borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
                      borderStyle: 'solid',
                      borderColor: isSel || isTarget || finished ? M.leaf : M.softLip,
                      borderTopWidth: 0,
                      borderRadius: '6px 6px 18px 18px',
                      boxShadow: `0 4px 0 ${isSel || finished ? M.hillShadow : M.groundLip}`,
                      transition: 'border-color 0.14s, background 0.14s',
                    }} />
                    {Array.from({ length: SEG - stack.length }, (_, i) => (
                      <span key={`empty-${i}`} aria-hidden className="absolute" style={{
                        width: 8, height: 8, borderRadius: '50%',
                        left: (TUBE_W - 8) / 2, bottom: 6 + (stack.length + i) * SEG_H + (SEG_H - 8) / 2,
                        border: `1.5px solid ${M.hairline}`,
                      }} />
                    ))}

                    {/* Yarn stack, bottom-anchored. The key remounts on a pour so the
                        landing animation replays every time. */}
                    <span key={pourFx && pourFx.tube === idx ? `p${pourFx.key}` : 's'}
                      className="absolute inset-x-0 bottom-0 flex flex-col-reverse items-center"
                      style={{
                        padding: '6px 2px',
                        animation: !reduced && pourFx?.tube === idx ? 'ysCatch 0.24s ease-out' : undefined,
                      }}>
                      {stack.map((c, i) => {
                        const isDropped = !reduced && pourFx !== null && pourFx.tube === idx && i >= stack.length - pourFx.n
                        const isHeld = i >= holdFrom
                        return (
                          <YarnBall key={i} pal={COLORS[c]}
                            style={{
                              ['--lift' as string]: `-${HOLD_LIFT}px`,
                              transform: isHeld ? `translateY(-${HOLD_LIFT}px)` : undefined,
                              transition: 'transform 0.14s ease-out',
                              animation: isDropped
                                ? 'ysDrop 0.3s cubic-bezier(0.34,1.45,0.64,1)'
                                : isHeld && !reduced
                                  ? `ysHold 1.3s ease-in-out ${i * 40}ms infinite`
                                  : undefined,
                            } as React.CSSProperties} />
                        )
                      })}
                    </span>

                    {/* Number of balls in the held run. */}
                    {isSel && heldRun > 1 && (
                      <span className="absolute pointer-events-none" style={{
                        right: -5, top: -34,
                        padding: '2px 5px',
                        fontSize: 11, fontWeight: 800, color: M.leafInk,
                        background: M.leafTint,
                        borderRadius: 999,
                      }}>x{heldRun}</span>
                    )}

                    {/* Caret over a legal destination, including an empty holder. */}
                    {isTarget && (
                      <span aria-hidden className="absolute pointer-events-none" style={{
                        left: '50%', top: -15, marginLeft: -6,
                        width: 0, height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: `8px solid ${M.leaf}`,
                        animation: reduced ? undefined : 'ysCaret 0.85s ease-in-out infinite',
                      }} />
                    )}

                    {/* Finished jars get a check above the rim. */}
                    {finished && (
                      <span aria-hidden className="absolute pointer-events-none flex items-center justify-center" style={{
                        left: '50%', marginLeft: -11, top: -24, width: 22, height: 22,
                        background: M.leafTint, borderRadius: '50%',
                      }}><MeadowIcon name="check" size={14} /></span>
                    )}

                    {/* Completion confetti starts above the yarn so it stays visible. */}
                    {celebrating && finished && !reduced && SPARKS.map((s, i) => (
                      <span key={`sp-${solveFx}-${i}`} aria-hidden className="absolute pointer-events-none" style={{
                        left: '50%', top: -2, width: 4, height: 4, borderRadius: '50%', zIndex: 8,
                        background: i % 2 ? M.coin : M.leaf,
                        ['--dx' as string]: `${s.dx}px`,
                        ['--dy' as string]: `${s.dy}px`,
                        animation: `ysSpark 0.75s ease-out ${i * 30}ms both`,
                      } as React.CSSProperties} />
                    ))}
                  </button>
                )
              })}

            </div>
          ))}

          {/* Eren, sitting on the floor in front of the shelf with his ball.
              He fills the dead space under the bottom plank and doubles as
              feedback — cheering a solve, startling at a rejected tap, fretting
              while the board is stuck — all readable without looking away from
              the jar you're aiming at. */}
          {phase !== 'idle' && (
            <div className="relative flex items-end justify-end pointer-events-none"
              style={{ alignSelf: 'stretch', gap: 7, paddingRight: 4, marginTop: 6 }}>
              {/* His yarn ball, wound like the jar segments and coloured by the
                  last pour. It hops when yarn lands. */}
              <YarnBall key={`ball-${pourFx?.key ?? 0}`} pal={ballColor} size={20} style={{
                marginBottom: 1,
                animation: reduced || !pourFx ? undefined : 'ysBallHop 0.42s cubic-bezier(0.34,1.5,0.64,1)',
              }} />

              <span className="relative">
                {/* contact shadow so he sits on the floor rather than floating */}
                <span aria-hidden className="absolute" style={{
                  left: 3, right: 3, bottom: -2, height: 4, borderRadius: '50%',
                  background: M.floorShadow,
                }} />
                <span className="relative block" style={{
                  animation: reduced || erenPose !== 'idle' ? undefined : 'ysBreathe 3.2s ease-in-out infinite',
                  transformOrigin: 'center bottom',
                }}>
                  <ErenReact reaction={rx.reaction} size={38}>
                    <PixelEren pose={erenPose} size={38} blink={idle.blink} twitch={idle.twitch} glance={idle.glance} />
                  </ErenReact>
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Idle — the shared Meadow start card */}
      {phase === 'idle' && (
        <GameStartCard
          title="Yarn Sort"
          art={COLORS.slice(0, 5).map((pal, i) => (
            <GameArtTile key={i} size={40} tint={`${pal.main}26`}>
              <YarnBall pal={pal} size={28} />
            </GameArtTile>
          ))}
          best={bestScore}
          startDisabled={!user || savedGame?.owner !== user.id}
          startLabel={resumable ? 'Continue game' : 'Play'}
          extra={resumable && <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: M.text2 }}>Level {resumable.solved + 1}</span>
            <TextButton onClick={() => { playSound('ui_tap'); startGame() }}>New game</TextButton>
          </div>}
          onStart={() => { playSound('ui_tap'); resumable ? continueGame() : startGame() }}
        >
          Tap a jar to lift its top yarn, then tap a highlighted jar to drop it.
          Sort every jar to one colour. Every pour spends a move, and every solve pays moves back.
        </GameStartCard>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <GameResultCard
          headline="Out of moves"
          score={solved}
          scoreLabel={solved === 1 ? 'level solved' : 'levels solved'}
          best={bestScore}
          reward={reward && <GameCoinReward coins={reward.coins} blocked={reward.blocked} />}
          onAgain={() => { playSound('ui_tap'); startGame() }}
          onBack={() => { playSound('ui_back'); router.replace('/games') }}
        />
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .ys-game *, .ys-game *::before, .ys-game *::after {
            animation: none !important; transition: none !important;
          }
        }
        @keyframes ysDrop {
          0%   { transform: translateY(-18px) scaleY(0.65); opacity: 0.35; }
          60%  { transform: translateY(0)     scaleY(1.12); opacity: 1; }
          100% { transform: translateY(0)     scaleY(1);    opacity: 1; }
        }
        @keyframes ysCatch {
          0%   { transform: translateY(-3px); }
          55%  { transform: translateY(2px); }
          100% { transform: translateY(0); }
        }
        /* Held bands breathe around their lifted rest position (--lift = -HOLD_LIFT) */
        @keyframes ysHold {
          0%, 100% { transform: translateY(var(--lift)); }
          50%      { transform: translateY(calc(var(--lift) - 5px)); }
        }
        /* Eren idling — a slow breath so he isn't a decal */
        @keyframes ysBreathe {
          0%, 100% { transform: scaleY(1)     translateY(0); }
          50%      { transform: scaleY(1.035) translateY(-1px); }
        }
        @keyframes ysBallHop {
          0%   { transform: translateY(0)     scale(1); }
          40%  { transform: translateY(-9px)  scale(1.1, 0.9); }
          100% { transform: translateY(0)     scale(1); }
        }
        @keyframes ysCaret {
          0%, 100% { transform: translateY(0);    opacity: 0.75; }
          50%      { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes ysTarget {
          0%, 100% { transform: translateY(-3px); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes ysSpark {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2); opacity: 0; }
        }
        @keyframes ysBanner {
          0%   { opacity: 0; transform: translate(-50%, -10px) scale(0.85); }
          20%  { opacity: 1; transform: translate(-50%, 0)     scale(1); }
          80%  { opacity: 1; transform: translate(-50%, 0)     scale(1); }
          100% { opacity: 0; transform: translate(-50%, -6px)  scale(0.96); }
        }
        @keyframes ysShake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-6px); }
          40%  { transform: translateX(5px); }
          60%  { transform: translateX(-4px); }
          80%  { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        @keyframes ysStuckPulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50%      { transform: translateX(-50%) scale(1.05); }
        }
        @keyframes ysNotice {
          0%   { opacity: 0; transform: translate(-50%, -6px); }
          15%  { opacity: 1; transform: translate(-50%, 0); }
          80%  { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}
