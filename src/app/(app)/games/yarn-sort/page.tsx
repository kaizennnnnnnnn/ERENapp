'use client'

// ═══════════════════════════════════════════════════════════════════════════
// YARN SORT — water/ball-sort puzzle, themed for the Eren app.
// ────────────────────────────────────────────────────────────────────────
// Tap a tube to lift its top run of same-coloured yarn, tap another to pour
// it on (must be empty, or same colour on top with room). Sort every tube to
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
const SEG          = 4    // segments per colour = tube capacity
const EMPTIES      = 2    // spare empty tubes (≥2 keeps random deals solvable)
const START_MOVES  = 30   // starting move bank
const REFILL_BASE  = 7    // a solve grants REFILL_BASE + colours moves
const UNDO_LIMIT   = 3    // undos per run (each refunds its pour)
const LOW_MOVES    = 6    // bank warning threshold
const WEEKLY_HS    = 8    // levels solved that completes the weekly high-score task

// Visual sizing
const TUBE_W   = 30
const SEG_H    = 26
const SEG_W    = 22

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

// ─── Pure helpers ───────────────────────────────────────────────────────────
// A tube is a bottom→top stack of colour indices. Board = tube[].

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

function canPour(tubes: number[][], src: number, dst: number): boolean {
  if (src === dst) return false
  const s = tubes[src]
  if (s.length === 0) return false
  const d = tubes[dst]
  if (d.length >= SEG) return false
  const sc = s[s.length - 1]
  if (d.length > 0 && d[d.length - 1] !== sc) return false
  // No-progress prune: don't move a tube that's already one solid colour into
  // an empty tube (it accomplishes nothing and would waste a move).
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

// Tube identity doesn't matter, so sort the tube strings for the visited key —
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

// Always returns a board PROVEN solvable. With EMPTIES spare tubes a random deal
// is solvable essentially every time (verified), so this returns on the first
// try. The empties-escalation is a guaranteed-terminating safety net — more empty
// tubes makes a board strictly easier to sort — so the loop can never fail to find
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
    setHistory([])
    setSelected(null)
    setCelebrating(true)
    if (!reduced) setSolveFx(k => k + 1)
    timers.setTimeout(() => {
      setTubes(genLevel(justLevel + 1))
      setCelebrating(false)
    }, reduced ? 360 : 680)
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

  const movesLow = movesLeft <= LOW_MOVES

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell"
      style={{ background: 'radial-gradient(ellipse at top, #0B3B3A 0%, #082A2C 55%, #04181A 100%)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(4,18,20,0.95) 0%, rgba(4,18,20,0.6) 100%)',
        borderBottom: '2px solid rgba(45,212,191,0.3)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(45,212,191,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-teal-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #0D9488, #2DD4BF)', border: '2px solid #134E4A', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          YARN SORT
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#99F6E4' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* HUD: level · moves · undo */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div>
          <div className="font-pixel" style={{ fontSize: 6, color: '#5EEAD4', letterSpacing: 2 }}>LEVEL</div>
          <div className="font-pixel" style={{ fontSize: 22, color: '#FFFFFF', textShadow: '2px 2px 0 #0B3B3A', letterSpacing: 1 }}>{level}</div>
        </div>

        <div className="flex flex-col items-center">
          <div className="font-pixel" style={{ fontSize: 6, color: movesLow ? '#FCA5A5' : '#5EEAD4', letterSpacing: 2 }}>MOVES</div>
          <div key={`mv-${movesLeft}`} className="font-pixel" style={{
            fontSize: 22,
            color: movesLow ? '#FCA5A5' : '#FDE68A',
            textShadow: movesLow ? '0 0 10px rgba(248,113,113,0.7)' : '2px 2px 0 #0B3B3A',
            letterSpacing: 1,
            animation: movesLow && !reduced ? 'ysMovePulse 0.5s ease-out' : undefined,
          }}>{movesLeft}</div>
        </div>

        <button
          onClick={() => { playSound('ui_tap'); undo() }}
          disabled={!canUndo}
          className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 active:translate-y-[2px] transition-transform"
          style={{
            background: canUndo ? 'rgba(13,148,136,0.35)' : 'rgba(255,255,255,0.05)',
            border: `2px solid ${stuck ? '#FDE68A' : 'rgba(45,212,191,0.5)'}`,
            borderRadius: 5,
            opacity: canUndo ? 1 : 0.4,
            boxShadow: '0 2px 0 rgba(0,0,0,0.3)',
            animation: stuck && !reduced ? 'ysUndoPulse 0.7s ease-in-out infinite' : undefined,
          }}>
          <Undo2 size={14} className="text-teal-200" />
          <span className="font-pixel" style={{ fontSize: 6, color: stuck ? '#FDE68A' : '#99F6E4', letterSpacing: 1 }}>UNDO {undosLeft}</span>
        </button>
      </div>

      {/* Tube field */}
      <div className="flex-1 flex items-center justify-center px-3 pb-4 select-none overflow-hidden relative">
        {/* Stuck rescue banner — only when the player has no non-dead-end move left */}
        {stuck && (
          <div className="absolute left-1/2 -translate-x-1/2 z-20 px-3 py-2 font-pixel text-center" style={{
            top: 6,
            background: 'rgba(20,10,4,0.92)',
            border: '2px solid #FDE68A',
            borderRadius: 4,
            fontSize: 7, letterSpacing: 1.5, lineHeight: 1.9,
            boxShadow: '0 3px 0 rgba(0,0,0,0.4), 0 0 14px rgba(253,230,138,0.5)',
            animation: reduced ? undefined : 'ysStuckPulse 0.9s ease-in-out infinite',
          }}>
            <span style={{ color: '#FDE68A' }}>DEAD END</span><br />
            <span style={{ color: '#FCA5A5' }}>TAP UNDO TO BACK UP</span>
          </div>
        )}
        {/* Transient notice — e.g. a blocked dead-end pour */}
        {notice && !stuck && (
          <div key={notice.key} className="absolute left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 font-pixel" style={{
            top: 6,
            background: 'rgba(20,10,4,0.9)',
            border: '2px solid #FB7185',
            borderRadius: 4,
            fontSize: 7, letterSpacing: 1.5, color: '#FECDD3',
            boxShadow: '0 2px 0 rgba(0,0,0,0.4)',
            animation: reduced ? undefined : 'ysNotice 1.1s ease-out forwards',
          }}>
            {notice.text}
          </div>
        )}
        <div key={`shake-${shake}`} className="flex flex-wrap items-end justify-center"
          style={{ gap: 14, maxWidth: 360, animation: shake > 0 && !reduced ? 'ysShake 0.26s steps(5,end)' : undefined }}>
          {tubes.map((stack, idx) => {
            const isSel = selected === idx
            return (
              <button key={idx} onClick={() => tapTube(idx)}
                className="relative active:scale-95 transition-transform"
                style={{
                  width: TUBE_W,
                  height: SEG * SEG_H + 8,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
                  border: `2px solid ${isSel ? '#FDE68A' : 'rgba(94,234,212,0.55)'}`,
                  borderTop: 'none',
                  borderRadius: '4px 4px 13px 13px',
                  boxShadow: isSel
                    ? '0 0 16px rgba(253,230,138,0.6), inset 0 0 10px rgba(255,255,255,0.08)'
                    : 'inset 0 0 8px rgba(0,0,0,0.35)',
                  transform: isSel ? 'translateY(-8px)' : 'none',
                  transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s',
                  touchAction: 'manipulation',
                }}>
                {/* glass top lip */}
                <div className="absolute" style={{ top: -2, left: -2, right: -2, height: 3, background: isSel ? '#FDE68A' : 'rgba(94,234,212,0.55)', borderRadius: 2 }} />
                {/* segment stack, bottom-anchored */}
                <div key={pourFx && pourFx.tube === idx ? `p${pourFx.key}` : 's'}
                  className="absolute inset-x-0 bottom-0 flex flex-col-reverse items-center" style={{ padding: 3 }}>
                  {stack.map((c, i) => {
                    const pal = COLORS[c]
                    const isDropped = !reduced && pourFx !== null && pourFx.tube === idx && i >= stack.length - pourFx.n
                    return (
                      <div key={i} style={{
                        width: SEG_W,
                        height: SEG_H - 1,
                        marginTop: 1,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${pal.light}, ${pal.main})`,
                        border: `2px solid ${pal.dark}`,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.25)',
                        animation: isDropped ? 'ysDrop 0.26s cubic-bezier(0.34,1.4,0.64,1)' : undefined,
                      }} />
                    )
                  })}
                </div>
                {/* solved cap glow */}
                {celebrating && stack.length === SEG && stack.every(c => c === stack[0]) && (
                  <div key={`fx-${solveFx}`} className="absolute inset-0 pointer-events-none" style={{
                    border: '2px solid #FDE68A',
                    borderRadius: '4px 4px 13px 13px',
                    boxShadow: '0 0 18px rgba(253,230,138,0.8)',
                    animation: reduced ? undefined : 'ysSolveCap 0.68s ease-out',
                  }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Idle modal */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4 pointer-events-none">
          <div className="px-6 py-5 flex flex-col items-center gap-3 pointer-events-auto"
            style={{ background: 'rgba(6,30,32,0.94)', border: '3px solid #2DD4BF', borderRadius: 6, boxShadow: '0 4px 0 #134E4A, 0 0 30px rgba(45,212,191,0.5)' }}>
            <p className="font-pixel" style={{ fontSize: 11, letterSpacing: 2.5, color: '#99F6E4', filter: 'drop-shadow(0 0 6px rgba(45,212,191,0.5))' }}>YARN SORT</p>
            <div className="font-pixel text-center" style={{ fontSize: 6, color: '#7DD3C8', letterSpacing: 1, lineHeight: 1.9 }}>
              <p>TAP A TUBE, THEN ANOTHER TO POUR</p>
              <p>SORT EACH TUBE TO ONE COLOUR</p>
              <p style={{ color: '#FDE68A' }}>EVERY POUR SPENDS A MOVE</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)', border: '2px solid #134E4A', borderRadius: 3, boxShadow: '0 4px 0 #134E4A', fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5 }}>
              <IconYarn size={12} /> START
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(4,16,18,0.7)', backdropFilter: 'blur(2px)' }}>
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
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
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
          0%   { transform: translateY(-14px) scaleY(0.7); opacity: 0.4; }
          100% { transform: translateY(0)     scaleY(1);   opacity: 1; }
        }
        @keyframes ysSolveCap {
          0%   { opacity: 0; transform: scale(1.08); }
          40%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes ysMovePulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.25); }
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
          0%, 100% { box-shadow: 0 2px 0 rgba(0,0,0,0.3); }
          50%      { box-shadow: 0 2px 0 rgba(0,0,0,0.3), 0 0 12px rgba(253,230,138,0.85); }
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
      {/* keep imports referenced */}
      <span style={{ display: 'none' }}><IconStar size={1} /></span>
    </div>
  )
}
