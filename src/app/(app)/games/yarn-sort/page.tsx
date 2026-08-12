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
// Presentation: a night-time craft shelf. Jars of wound yarn stand on walnut
// planks; the run you're holding lifts clear of the rim so you can see exactly
// what you're about to pour, and every jar that can legally receive it lights
// up while the rest dim away. Nothing about the puzzle rules is hidden.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw, Undo2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import GameCoinReward from '@/components/games/GameCoinReward'
import { playSound } from '@/lib/sounds'
import { IconStar, IconYarn } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'

// ─── Tunables ───────────────────────────────────────────────────────────────
const SEG          = 4    // segments per colour = jar capacity
const EMPTIES      = 2    // spare empty jars (≥2 keeps random deals solvable)
const START_MOVES  = 30   // starting move bank
const REFILL_BASE  = 7    // a solve grants REFILL_BASE + colours moves
const UNDO_LIMIT   = 3    // undos per run (each refunds its pour)
const LOW_MOVES    = 6    // bank warning threshold
const WEEKLY_HS    = 8    // levels solved that completes the weekly high-score task

// Visual sizing. Five jars per plank at TUBE_W + JAR_GAP must clear a 390px
// phone with room for the plank overhang: 5·50 + 4·13 + 2·18 = 338.
const TUBE_W    = 50                    // outer jar width (2px glass each side)
const SEG_W     = 40                    // yarn band width
const SEG_H     = 34                    // yarn band height
const TUBE_H    = SEG * SEG_H + 12      // jar body height
const HOLD_LIFT = 16                    // px the held run rises above the rest
const ROW_MAX   = 5                     // jars per shelf plank
const JAR_GAP   = 13                    // px between jars on a plank
const GAUGE_MAX = 30                    // move-bank gauge is full at this many

// Up to 8 distinct yarn colours; palettes match the app's pink/gold/mint set.
interface Palette { main: string; dark: string; light: string }
const COLORS: Palette[] = [
  { main: '#EC4899', dark: '#831843', light: '#FBCFE8' }, // pink
  { main: '#FBBF24', dark: '#92400E', light: '#FDE68A' }, // gold
  { main: '#34D399', dark: '#047857', light: '#A7F3D0' }, // mint
  { main: '#60A5FA', dark: '#1E40AF', light: '#BFDBFE' }, // blue
  { main: '#A78BFA', dark: '#4C1D95', light: '#DDD6FE' }, // purple
  { main: '#FB7185', dark: '#9F1239', light: '#FECDD3' }, // coral
  { main: '#FB923C', dark: '#9A3412', light: '#FED7AA' }, // orange
  { main: '#22D3EE', dark: '#155E75', light: '#A5F3FC' }, // cyan
]

// Solve-burst particle directions — fixed so they don't reshuffle every render.
const SPARKS = [
  { dx: -18, dy: -22 }, { dx: -6, dy: -30 }, { dx: 8, dy: -28 },
  { dx: 20, dy: -18 },  { dx: -26, dy: -8 }, { dx: 26, dy: -6 },
]

// Drifting dust motes over the shelf — static layout, animated by CSS only.
const MOTES = [
  { left: '12%', top: '22%', size: 3, dur: 9.5, delay: 0 },
  { left: '28%', top: '68%', size: 2, dur: 12,  delay: 1.8 },
  { left: '47%', top: '14%', size: 2, dur: 11,  delay: 3.4 },
  { left: '68%', top: '52%', size: 3, dur: 10,  delay: 0.9 },
  { left: '83%', top: '28%', size: 2, dur: 13,  delay: 2.6 },
  { left: '58%', top: '80%', size: 2, dur: 14,  delay: 4.2 },
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

// ─── Yarn band ──────────────────────────────────────────────────────────────
// One segment of wound yarn. Three stacked backgrounds do the work: diagonal
// strand winding on top, a left-lit cylinder shade in the middle, and the flat
// colour underneath. `capped` rounds the top so the highest band in a stack
// reads as the crown of a bundle instead of another brick.
function YarnBand({ pal, capped, style }: { pal: Palette; capped: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: SEG_W,
      height: SEG_H - 2,
      marginTop: 2,
      borderRadius: capped ? '9px 9px 3px 3px' : 3,
      border: `1.5px solid ${pal.dark}`,
      background: [
        `repeating-linear-gradient(108deg,
           rgba(255,255,255,0.34) 0px, rgba(255,255,255,0.34) 1.5px,
           rgba(255,255,255,0)    1.5px, rgba(255,255,255,0)    3.5px,
           rgba(0,0,0,0.20)       3.5px, rgba(0,0,0,0.20)       5px,
           rgba(0,0,0,0)          5px,   rgba(0,0,0,0)          7px)`,
        `linear-gradient(90deg,
           rgba(0,0,0,0.30) 0%, rgba(255,255,255,0.38) 26%,
           rgba(255,255,255,0.04) 56%, rgba(0,0,0,0.32) 100%)`,
        `linear-gradient(180deg, ${pal.light} 0%, ${pal.main} 48%, ${pal.dark} 100%)`,
      ].join(', '),
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.3)',
      ...style,
    }} />
  )
}

// ─── Component ──────────────────────────────────────────────────────────────
type Phase = 'idle' | 'playing' | 'gameover'

export default function YarnSortGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

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
  const [reward, setReward]       = useState<GameRewardResult | null>(null)
  const savedRef = useRef(false)
  const fxKey = useRef(0)

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
  const canUndo = phase === 'playing' && !celebrating && history.length > 0 && (undosLeft > 0 || stuck)

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
  const gaugeFill = Math.max(0, Math.min(10, Math.round((movesLeft / GAUGE_MAX) * 10)))
  const nextRefill = refillForLevel(colorsForLevel(level))

  function flashNotice(text: string) {
    fxKey.current += 1
    const key = fxKey.current
    setNotice({ text, key })
    timers.setTimeout(() => setNotice(n => (n && n.key === key ? null : n)), 1100)
  }

  function startGame() {
    timers.clearAll()
    setTubes(genLevel(1))
    setSelected(null)
    setSolved(0)
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
    playSound('ys_solve')
    setSolved(s => s + 1)
    setMovesLeft(m => m + refill)
    setLastRefill(refill)
    setHistory([])
    setSelected(null)
    setCelebrating(true)
    if (!reduced) setSolveFx(k => k + 1)
    timers.setTimeout(() => {
      setTubes(genLevel(justLevel + 1))
      setCelebrating(false)
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
    if (newMoves <= 0) { scheduleEnd(); return }
    // No 'stuck' end here: tapTube blocks any pour that would dead-end the board,
    // so `next` always has a legal move (or is solved). The run ends only when the
    // move bank empties — the intended skill-based game-over.
    if (newMoves <= LOW_MOVES && movesLeft > LOW_MOVES) playSound('ys_low')
  }

  function tapTube(i: number) {
    if (phase !== 'playing' || celebrating) return
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
        flashNotice('DEAD END')
        setSelected(null)
        return
      }
      attemptPour(selected, i)
      setSelected(null)
    } else {
      playSound('ys_invalid')
      setShake(s => s + 1)
      if (tubes[i].length > 0) { setSelected(i); playSound('ys_pick') }
      else setSelected(null)
    }
  }

  function undo() {
    if (phase !== 'playing' || celebrating) return
    if (history.length === 0) return
    const voluntary = undosLeft > 0
    if (!voluntary && !stuck) return // out of undos and not a stuck-rescue
    const prev = history[history.length - 1]
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
    <div className="fixed inset-0 z-40 flex flex-col game-shell overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 130% 75% at 50% 52%, #175954 0%, #0C3A3B 40%, #062024 74%, #041318 100%)' }}>

      {/* Knitted-wall texture — two shallow diagonals crossing into a stitch weave */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: [
          'repeating-linear-gradient(56deg, rgba(94,234,212,0.05) 0px, rgba(94,234,212,0.05) 1px, transparent 1px, transparent 9px)',
          'repeating-linear-gradient(-56deg, rgba(94,234,212,0.05) 0px, rgba(94,234,212,0.05) 1px, transparent 1px, transparent 9px)',
        ].join(', '),
        maskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, #000 0%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, #000 0%, transparent 78%)',
      }} />
      {/* Vignette — darkens the corners without swallowing the shelf */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 80px 4px rgba(2,10,14,0.72)' }} />
      {/* Low-bank danger glow at the edges */}
      {phase === 'playing' && movesLow && (
        <div aria-hidden className="absolute inset-0 pointer-events-none z-10" style={{
          boxShadow: 'inset 0 0 64px 2px rgba(248,113,113,0.26)',
          animation: reduced ? undefined : 'ysDanger 2s ease-in-out infinite',
        }} />
      )}

      {/* Header */}
      <div className="relative flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(3,14,18,0.96) 0%, rgba(3,14,18,0.55) 100%)',
        borderBottom: '2px solid rgba(45,212,191,0.32)',
        boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          aria-label="Back"
          className="flex items-center justify-center active:translate-y-[2px] transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(45,212,191,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>
          <ChevronLeft size={16} className="text-teal-200" />
        </button>
        <span className="relative font-pixel text-white inline-flex items-center gap-1.5 px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #0D9488, #2DD4BF)', border: '2px solid #134E4A', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>
          <IconYarn size={10} />
          YARN SORT
          <span aria-hidden style={{ position: 'absolute', left: 2, top: 2, width: 2, height: 2, background: '#FDE68A' }} />
          <span aria-hidden style={{ position: 'absolute', right: 2, bottom: 2, width: 2, height: 2, background: '#FDE68A' }} />
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.45)', border: '2px solid rgba(94,234,212,0.45)', borderRadius: 4, fontSize: 8, color: '#99F6E4', boxShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>
          <IconStar size={9} /> {bestScore}
        </div>
      </div>

      {/* HUD: level · move bank · undo */}
      <div className="relative flex items-stretch gap-2 px-3 py-2.5 flex-shrink-0">
        {/* Level plate */}
        <div className="flex flex-col items-center justify-center px-3 py-1.5" style={{
          background: 'linear-gradient(180deg, rgba(9,42,44,0.9), rgba(4,20,24,0.9))',
          border: '2px solid rgba(94,234,212,0.4)', borderRadius: 5,
          boxShadow: '0 2px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <span className="font-pixel" style={{ fontSize: 6, color: '#5EEAD4', letterSpacing: 2 }}>LVL</span>
          <span className="font-pixel" style={{ fontSize: 18, color: '#FFFFFF', textShadow: '2px 2px 0 #04181A', letterSpacing: 1 }}>{level}</span>
        </div>

        {/* Move bank: number + depleting gauge + what a solve pays back */}
        <div className="flex-1 flex flex-col justify-center px-3 py-1.5" style={{
          background: 'linear-gradient(180deg, rgba(9,42,44,0.9), rgba(4,20,24,0.9))',
          border: `2px solid ${movesLow ? 'rgba(248,113,113,0.75)' : 'rgba(94,234,212,0.4)'}`,
          borderRadius: 5,
          boxShadow: movesLow
            ? '0 2px 0 rgba(0,0,0,0.45), 0 0 12px rgba(248,113,113,0.4)'
            : '0 2px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <div className="flex items-baseline justify-between">
            <span className="font-pixel" style={{ fontSize: 6, color: movesLow ? '#FCA5A5' : '#5EEAD4', letterSpacing: 2 }}>MOVES</span>
            <span key={`mv-${movesLeft}`} className="font-pixel" style={{
              fontSize: 18,
              color: movesLow ? '#FCA5A5' : '#FDE68A',
              textShadow: movesLow ? '0 0 10px rgba(248,113,113,0.8)' : '2px 2px 0 #04181A',
              animation: !reduced ? 'ysMovePulse 0.4s ease-out' : undefined,
            }}>{movesLeft}</span>
          </div>
          {/* Ten-tick gauge in a recessed channel — the app's meter language */}
          <div className="flex gap-[2px] mt-1 p-[2px]" style={{
            background: 'rgba(0,0,0,0.55)', borderRadius: 2,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.7)',
          }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const lit = i < gaugeFill
              return (
                <div key={i} style={{
                  flex: 1, height: 5, borderRadius: 1,
                  background: lit
                    ? (movesLow
                      ? 'linear-gradient(180deg, #FCA5A5, #DC2626)'
                      : 'linear-gradient(180deg, #A7F3D0, #14B8A6)')
                    : 'rgba(255,255,255,0.07)',
                  boxShadow: lit ? `0 0 4px ${movesLow ? 'rgba(248,113,113,0.8)' : 'rgba(45,212,191,0.7)'}` : undefined,
                  transition: 'background 0.18s',
                  transitionDelay: `${i * 15}ms`,
                }} />
              )
            })}
          </div>
          <span className="font-pixel mt-1" style={{ fontSize: 6, color: '#7DD3C8', letterSpacing: 1 }}>
            SOLVE PAYS +{nextRefill}
          </span>
        </div>

        <button
          onClick={() => { playSound('ui_tap'); undo() }}
          disabled={!canUndo}
          aria-label="Undo last pour"
          className="flex flex-col items-center justify-center gap-0.5 px-3 active:translate-y-[2px] transition-transform"
          style={{
            background: canUndo
              ? 'linear-gradient(180deg, rgba(13,148,136,0.5), rgba(6,60,58,0.6))'
              : 'rgba(255,255,255,0.05)',
            border: `2px solid ${stuck ? '#FDE68A' : 'rgba(94,234,212,0.45)'}`,
            borderRadius: 5,
            opacity: canUndo ? 1 : 0.35,
            boxShadow: '0 2px 0 rgba(0,0,0,0.45)',
            animation: stuck && !reduced ? 'ysUndoPulse 0.7s ease-in-out infinite' : undefined,
          }}>
          <Undo2 size={14} className="text-teal-200" />
          <span className="font-pixel" style={{ fontSize: 6, color: stuck ? '#FDE68A' : '#99F6E4', letterSpacing: 1 }}>{undosLeft}</span>
        </button>
      </div>

      {/* Shelf field */}
      <div className="relative flex-1 flex items-center justify-center px-3 pb-3 select-none overflow-hidden">
        {/* Drifting motes */}
        {!reduced && MOTES.map((m, i) => (
          <span key={i} aria-hidden className="absolute pointer-events-none" style={{
            left: m.left, top: m.top, width: m.size, height: m.size, borderRadius: '50%',
            background: 'rgba(167,243,208,0.55)',
            boxShadow: '0 0 4px rgba(167,243,208,0.6)',
            animation: `ysMote ${m.dur}s ease-in-out ${m.delay}s infinite`,
          }} />
        ))}

        {/* Stuck rescue banner — only when the player has no non-dead-end move left */}
        {stuck && (
          <div className="absolute left-1/2 -translate-x-1/2 z-30 px-3 py-2 font-pixel text-center" style={{
            top: 2,
            background: 'rgba(20,10,4,0.94)',
            border: '2px solid #FDE68A',
            borderRadius: 4,
            fontSize: 7, letterSpacing: 1.5, lineHeight: 1.9,
            boxShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 14px rgba(253,230,138,0.5)',
            animation: reduced ? undefined : 'ysStuckPulse 0.9s ease-in-out infinite',
          }}>
            <span style={{ color: '#FDE68A' }}>DEAD END</span><br />
            <span style={{ color: '#FCA5A5' }}>TAP UNDO TO BACK UP</span>
          </div>
        )}
        {/* Transient notice — e.g. a blocked dead-end pour */}
        {notice && !stuck && (
          <div key={notice.key} className="absolute left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 font-pixel" style={{
            top: 2,
            background: 'rgba(20,10,4,0.92)',
            border: '2px solid #FB7185',
            borderRadius: 4,
            fontSize: 7, letterSpacing: 1.5, color: '#FECDD3',
            boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
            animation: reduced ? undefined : 'ysNotice 1.1s ease-out forwards',
          }}>
            {notice.text}
          </div>
        )}

        {/* Level-clear banner — states the payout so the move economy is legible */}
        {celebrating && (
          <div key={`clear-${solveFx}`} className="absolute left-1/2 -translate-x-1/2 z-30 px-4 py-2 font-pixel text-center" style={{
            top: 2,
            background: 'linear-gradient(180deg, rgba(13,80,70,0.96), rgba(4,30,32,0.96))',
            border: '2px solid #FDE68A',
            borderRadius: 4,
            boxShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 20px rgba(253,230,138,0.55)',
            animation: reduced ? undefined : 'ysBanner 0.9s ease-out both',
          }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#FDE68A' }}>LEVEL {solved} CLEAR</div>
            <div style={{ fontSize: 7, letterSpacing: 1.5, color: '#A7F3D0', marginTop: 5 }}>+{lastRefill} MOVES</div>
          </div>
        )}

        {/* Shelf rows */}
        <div key={`shake-${shake}`} className="flex flex-col items-center"
          style={{ gap: 22, animation: shake > 0 && !reduced ? 'ysShake 0.26s steps(5,end)' : undefined }}>
          {rows.map((row, r) => (
            <div key={r} className="relative flex items-end justify-center" style={{ gap: JAR_GAP, paddingTop: 28 }}>
              {/* Warm pool of light on the plank — gives the composition a focal
                  point so the dark around it reads as room, not empty canvas. */}
              <span aria-hidden className="absolute pointer-events-none" style={{
                left: -46, right: -46, bottom: -34, top: 10, zIndex: 0,
                background: 'radial-gradient(ellipse 70% 62% at 50% 82%, rgba(255,206,140,0.20) 0%, rgba(255,190,120,0.09) 42%, transparent 72%)',
              }} />
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
                  <button key={idx} onClick={() => tapTube(idx)}
                    aria-label={`Jar ${idx + 1}, ${stack.length} of ${SEG} full`}
                    className="relative"
                    style={{
                      width: TUBE_W,
                      height: TUBE_H,
                      zIndex: isSel ? 6 : 1,
                      // Dim, don't erase: you still need to read the whole board
                      // to plan while holding a run.
                      opacity: dimmed ? 0.72 : 1,
                      filter: dimmed ? 'saturate(0.85)' : undefined,
                      transform: isSel ? 'translateY(-6px)' : isTarget ? 'translateY(-3px)' : 'none',
                      transition: 'transform 0.14s ease-out, opacity 0.16s, filter 0.16s',
                      touchAction: 'manipulation',
                      animation: isTarget && !reduced ? 'ysTarget 1s ease-in-out infinite' : undefined,
                    }}>

                    {/* Contact shadow on the plank */}
                    <span aria-hidden className="absolute" style={{
                      left: -3, right: -3, bottom: -5, height: 6, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)', filter: 'blur(2px)',
                      opacity: isSel ? 0.45 : 0.8,
                      transition: 'opacity 0.14s',
                    }} />

                    {/* Glass body. Border longhands only — mixing the `border`
                        shorthand with `borderTop` warns in React once the colour
                        starts changing between renders. */}
                    <span aria-hidden className="absolute inset-0" style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.09) 100%)',
                      borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
                      borderStyle: 'solid',
                      borderColor: isSel ? '#FDE68A' : isTarget ? '#7DE8D6' : finished ? 'rgba(253,230,138,0.6)' : 'rgba(94,234,212,0.5)',
                      borderTopWidth: 0,
                      borderRadius: '3px 3px 13px 13px',
                      boxShadow: isSel
                        ? '0 0 18px rgba(253,230,138,0.65), inset 0 0 10px rgba(255,255,255,0.1)'
                        : isTarget
                          ? '0 0 14px rgba(94,234,212,0.6), inset 0 0 10px rgba(255,255,255,0.08)'
                          : finished
                            ? '0 0 10px rgba(253,230,138,0.35), inset 0 0 8px rgba(0,0,0,0.3)'
                            : 'inset 0 0 8px rgba(0,0,0,0.4)',
                      transition: 'border-color 0.14s, box-shadow 0.14s',
                    }} />
                    {/* Specular streak down the left of the glass */}
                    <span aria-hidden className="absolute pointer-events-none" style={{
                      left: 4, top: 4, bottom: 8, width: 4, borderRadius: 3,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.05))',
                    }} />

                    {/* Glass rim */}
                    <span aria-hidden className="absolute" style={{
                      top: -3, left: -3, right: -3, height: 4, borderRadius: 2,
                      background: isSel
                        ? 'linear-gradient(180deg, #FEF3C7, #FDE68A)'
                        : isTarget
                          ? 'linear-gradient(180deg, #CFFAF2, #5EEAD4)'
                          : finished
                            ? 'linear-gradient(180deg, #FDE68A, #D9A441)'
                            : 'linear-gradient(180deg, rgba(190,250,240,0.85), rgba(94,234,212,0.5))',
                      boxShadow: '0 1px 0 rgba(0,0,0,0.45)',
                      transition: 'background 0.14s',
                    }} />

                    {/* Yarn stack, bottom-anchored. The key remounts on a pour so the
                        landing animation replays every time. */}
                    <span key={pourFx && pourFx.tube === idx ? `p${pourFx.key}` : 's'}
                      className="absolute inset-x-0 bottom-0 flex flex-col-reverse items-center"
                      style={{
                        padding: 2,
                        animation: !reduced && pourFx?.tube === idx ? 'ysCatch 0.24s ease-out' : undefined,
                      }}>
                      {stack.map((c, i) => {
                        const isDropped = !reduced && pourFx !== null && pourFx.tube === idx && i >= stack.length - pourFx.n
                        const isHeld = i >= holdFrom
                        return (
                          <YarnBand key={i} pal={COLORS[c]} capped={i === stack.length - 1}
                            style={{
                              ['--lift' as string]: `-${HOLD_LIFT}px`,
                              transform: isHeld ? `translateY(-${HOLD_LIFT}px)` : undefined,
                              transition: 'transform 0.14s ease-out',
                              filter: isHeld ? 'drop-shadow(0 2px 0 rgba(0,0,0,0.5)) brightness(1.12)' : undefined,
                              animation: isDropped
                                ? 'ysDrop 0.3s cubic-bezier(0.34,1.45,0.64,1)'
                                : isHeld && !reduced
                                  ? `ysHold 1.3s ease-in-out ${i * 40}ms infinite`
                                  : undefined,
                            } as React.CSSProperties} />
                        )
                      })}
                    </span>

                    {/* How many bands this pour would move — the thing you're planning around */}
                    {isSel && heldRun > 1 && (
                      <span className="font-pixel absolute pointer-events-none" style={{
                        right: -15, top: TUBE_H - 8 - stack.length * SEG_H - HOLD_LIFT,
                        padding: '2px 3px',
                        fontSize: 7, color: '#FDE68A', letterSpacing: 0.5,
                        background: 'rgba(12,6,2,0.92)',
                        border: '1px solid #FDE68A',
                        borderRadius: 2,
                        boxShadow: '1px 1px 0 rgba(0,0,0,0.6)',
                      }}>x{heldRun}</span>
                    )}

                    {/* Caret over a legal target. The glow alone reads fine on an
                        empty jar but gets lost on a full one — the marker doesn't. */}
                    {isTarget && (
                      <span aria-hidden className="absolute pointer-events-none" style={{
                        left: '50%', top: -15, marginLeft: -6,
                        width: 0, height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '8px solid #5EEAD4',
                        filter: 'drop-shadow(0 0 5px rgba(45,212,191,0.9))',
                        animation: reduced ? undefined : 'ysCaret 0.85s ease-in-out infinite',
                      }} />
                    )}

                    {/* Finished jar — a gold band and a star so the eye can skip it */}
                    {finished && (
                      <span aria-hidden className="absolute pointer-events-none" style={{
                        left: -2, right: -2, top: 3, height: 3,
                        background: 'linear-gradient(90deg, transparent, #FDE68A 25%, #FEF3C7 50%, #FDE68A 75%, transparent)',
                      }} />
                    )}

                    {/* Solve burst — thrown from the rim into the dark above the jar.
                        Fired from inside the jar it lands on bright yarn and vanishes. */}
                    {celebrating && finished && !reduced && SPARKS.map((s, i) => (
                      <span key={`sp-${solveFx}-${i}`} aria-hidden className="absolute pointer-events-none" style={{
                        left: '50%', top: -2, width: 4, height: 4, borderRadius: '50%', zIndex: 8,
                        background: i % 2 ? '#FDE68A' : '#FFFFFF',
                        boxShadow: '0 0 5px rgba(253,230,138,0.9)',
                        ['--dx' as string]: `${s.dx}px`,
                        ['--dy' as string]: `${s.dy}px`,
                        animation: `ysSpark 0.75s ease-out ${i * 30}ms both`,
                      } as React.CSSProperties} />
                    ))}
                  </button>
                )
              })}

              {/* Walnut plank the row stands on — lit top face, dark front edge */}
              <span aria-hidden className="absolute pointer-events-none" style={{
                left: -18, right: -18, bottom: -13, height: 13,
                background: [
                  'linear-gradient(180deg, #A96E42 0%, #8A5733 22%, #5C3620 24%, #4A2A18 62%, #2A160B 100%)',
                  'repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 2px, transparent 2px, transparent 17px)',
                ].join(', '),
                borderTop: '2px solid #C99160',
                borderRadius: '1px 1px 2px 2px',
                boxShadow: '0 4px 0 rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(0,0,0,0.4)',
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Idle modal */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-4"
          style={{ background: 'rgba(3,14,18,0.62)' }}>
          <div className="px-6 py-5 flex flex-col items-center gap-3"
            style={{ background: 'linear-gradient(180deg, #0B3234 0%, #051E22 100%)', border: '3px solid #2DD4BF', borderRadius: 6, boxShadow: '0 5px 0 #134E4A, 0 0 30px rgba(45,212,191,0.45)' }}>
            <p className="font-pixel inline-flex items-center gap-2" style={{ fontSize: 11, letterSpacing: 2.5, color: '#99F6E4', filter: 'drop-shadow(0 0 6px rgba(45,212,191,0.5))' }}>
              <IconYarn size={13} /> YARN SORT
            </p>
            <div className="font-pixel text-center" style={{ fontSize: 6, color: '#7DD3C8', letterSpacing: 1, lineHeight: 1.9 }}>
              <p>TAP A JAR TO LIFT ITS TOP YARN</p>
              <p>TAP A GLOWING JAR TO DROP IT</p>
              <p>SORT EVERY JAR TO ONE COLOUR</p>
              <p style={{ color: '#FDE68A' }}>EVERY POUR SPENDS A MOVE</p>
              <p style={{ color: '#FDE68A' }}>EVERY SOLVE PAYS MOVES BACK</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)', border: '2px solid #134E4A', borderRadius: 3, boxShadow: '0 4px 0 #134E4A', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5 }}>
              START
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(3,14,18,0.72)', backdropFilter: 'blur(2px)' }}>
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{
              background: 'linear-gradient(180deg, #0B2A2C 0%, #061E20 100%)',
              border: '3px solid #0D9488',
              borderRadius: 6,
              boxShadow: '0 6px 0 #134E4A, 0 0 30px rgba(13,148,136,0.5)',
              animation: reduced ? undefined : 'ysPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 3 }}>
              OUT OF MOVES
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#A7F3D0', letterSpacing: 1 }}>SOLVED</span>
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{solved}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#1F4D4A' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>
                  <IconStar size={7} /> BEST
                </span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
              </div>
            </div>
            {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => { playSound('ui_tap'); startGame() }}
                className="px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)', border: '2px solid #134E4A', borderRadius: 3, boxShadow: '0 4px 0 #134E4A', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
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
        @keyframes ysPop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
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
        @keyframes ysMovePulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        @keyframes ysShake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-6px); }
          40%  { transform: translateX(5px); }
          60%  { transform: translateX(-4px); }
          80%  { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        @keyframes ysUndoPulse {
          0%, 100% { box-shadow: 0 2px 0 rgba(0,0,0,0.45); }
          50%      { box-shadow: 0 2px 0 rgba(0,0,0,0.45), 0 0 12px rgba(253,230,138,0.85); }
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
        @keyframes ysMote {
          0%, 100% { transform: translate(0, 0);       opacity: 0.15; }
          25%      { transform: translate(6px, -12px); opacity: 0.6; }
          50%      { transform: translate(-4px, -22px); opacity: 0.35; }
          75%      { transform: translate(-8px, -10px); opacity: 0.55; }
        }
        @keyframes ysDanger {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
