'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PAW DOKU — Block Doku / Block Blast clone, themed for the Eren app.
// ────────────────────────────────────────────────────────────────────────
// 9×9 grid. Three pre-shaped blocks live in a tray at the bottom; drag any
// of them onto the grid. Full rows, columns and 3×3 squares clear. Multi-line
// clears chain into a combo for bonus points. When all three tray blocks
// are placed, the tray refills. Game over fires the moment none of the
// remaining blocks fits anywhere on the board.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
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
  GameTopBar, GameStatRow, GameStat, GameStartCard, GameArtTile, GameResultCard,
} from '@/components/games/GameChrome'
import { M, MeadowIcon, TextButton } from '@/components/meadow'
import { fireMinigameDone } from '@/lib/minigames'
import { readPuzzle, writePuzzle, clearPuzzle, type PawDokuSave } from '@/lib/puzzleSaves'

// ─── Tunables ───────────────────────────────────────────────────────────────
const GRID_SIZE       = 9        // 9×9 sudoku-style grid
const SUB_SIZE        = 3        // 3×3 sub-blocks clear when fully filled
const CELL_PX         = 34       // grid cell pixel size (drives container width)
const CELL_GAP        = 3
const TRAY_CELL_PX    = 18       // smaller cells while sitting in the tray
const TRAY_CELL_GAP   = 2
const DRAG_LIFT       = 56       // px the dragged block floats above the finger
const SCORE_PER_CELL  = 10
const SCORE_PER_LINE  = 100      // base for any cleared row / col / sub-block
                                 // multi-clear earns combo bonus

// Width/height of the grid (in CSS px)
const GRID_PX = GRID_SIZE * CELL_PX + (GRID_SIZE - 1) * CELL_GAP

// The top bar and stat row float over the shell; the board starts under them.
// The shell already pads the safe area, so this is GAME_BOARD_TOP minus it.
const CHROME_CLEARANCE = 104
// Combo + streak can share the stat row with Score and Best, so they pack a
// little tighter to keep four pills inside a 375px screen.
const STAT_TIGHT = { padding: '0 10px 0 6px', gap: 4 } as const

// ─── Block shape templates ──────────────────────────────────────────────────
// Each template is a 2-D matrix of 0/1 indicating filled cells. The shape is
// rendered at whatever cell size the host wants (tray vs grid vs drag ghost).
// Shape pool. The 3×3 square has been removed (too big — would fill an
// entire sub-block in one move). The 1×1 single is duplicated 3× so it
// spawns reliably as a rescue piece. Vertical lines are duplicated 2× —
// the original pool had 1 entry per length and players reported never
// seeing them, so they now match horizontals on weight. 2×3 + 3×2 full
// rectangles added per feedback ("almost-3×3").
const SHAPES: number[][][] = [
  // Singles (3 entries)
  [[1]], [[1]], [[1]],

  // Horizontal lines (one entry each)
  [[1,1]],
  [[1,1,1]],
  [[1,1,1,1]],
  [[1,1,1,1,1]],

  // Vertical lines (two entries each — bumped weight)
  [[1],[1]],             [[1],[1]],
  [[1],[1],[1]],         [[1],[1],[1]],
  [[1],[1],[1],[1]],     [[1],[1],[1],[1]],
  [[1],[1],[1],[1],[1]], [[1],[1],[1],[1],[1]],

  // Squares & rectangles (the new 2×3 + 3×2 are the "almost-3×3" pieces)
  [[1,1],[1,1]],
  [[1,1,1],[1,1,1]],
  [[1,1],[1,1],[1,1]],

  // L / J corners (small 2×2 with one corner empty)
  [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]],

  // L / J (3×2)
  [[1,0],[1,0],[1,1]],
  [[0,1],[0,1],[1,1]],
  [[1,1],[1,0],[1,0]],
  [[1,1],[0,1],[0,1]],
  [[1,1,1],[1,0,0]],
  [[1,1,1],[0,0,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],

  // T pieces
  [[1,1,1],[0,1,0]],
  [[0,1,0],[1,1,1]],
  [[0,1],[1,1],[0,1]],
  [[1,0],[1,1],[1,0]],

  // S / Z
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],
  [[1,0],[1,1],[0,1]],
  [[0,1],[1,1],[1,0]],
]

// Six themed colour palettes for the cells. Mapped at random when a new
// block is generated; the set sits well together visually and matches the
// rest of the app's pink/purple/gold/mint palette.
interface Palette { main: string; dark: string; light: string }
const PALETTES: Palette[] = [
  { main: M.love, dark: '#AF5276', light: M.loveLight },
  { main: '#AA8BC7', dark: '#785B94', light: '#D7C7E6' },
  { main: M.coin, dark: M.coinRim, light: M.coinShine },
  { main: '#78AE83', dark: M.leaf, light: '#BDDABD' },
  { main: '#6FA3D2', dark: '#386B96', light: '#B9D8F0' },
  { main: '#DF8171', dark: '#A34F42', light: '#F2BDB2' },
]

// A few of the game's own pieces for the start card's art row.
const ART_PIECES: Array<{ shape: number[][]; color: Palette }> = [
  { shape: [[1,1,1],[0,1,0]],     color: PALETTES[0] },
  { shape: [[1,1],[1,1]],         color: PALETTES[3] },
  { shape: [[1,0],[1,0],[1,1]],   color: PALETTES[2] },
  { shape: [[0,1,1],[1,1,0]],     color: PALETTES[4] },
]

// ─── Types ──────────────────────────────────────────────────────────────────
interface Block {
  id:    number
  shape: number[][]
  color: Palette
}

type CellState =
  | null
  | { color: Palette; clearing?: boolean }

type Grid = CellState[][]

// ─── Pure helpers ───────────────────────────────────────────────────────────
let _bid = 0
function makeBlock(): Block {
  const shape   = SHAPES   [Math.floor(Math.random() * SHAPES.length)]
  const color   = PALETTES [Math.floor(Math.random() * PALETTES.length)]
  return { id: ++_bid, shape, color }
}

function makeEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null as CellState)
  )
}

function gridCopy(g: Grid): Grid {
  return g.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

function shapeBox(shape: number[][]): { rows: number; cols: number; cells: number } {
  const rows = shape.length
  const cols = shape[0]?.length ?? 0
  let cells = 0
  shape.forEach(row => row.forEach(v => { if (v === 1) cells++ }))
  return { rows, cols, cells }
}

function canPlace(grid: Grid, shape: number[][], r: number, c: number): boolean {
  for (let dr = 0; dr < shape.length; dr++) {
    for (let dc = 0; dc < shape[0].length; dc++) {
      if (shape[dr][dc] !== 1) continue
      const rr = r + dr, cc = c + dc
      if (rr < 0 || rr >= GRID_SIZE || cc < 0 || cc >= GRID_SIZE) return false
      if (grid[rr][cc] !== null) return false
    }
  }
  return true
}

function placeBlock(grid: Grid, block: Block, r: number, c: number): Grid {
  const ng = gridCopy(grid)
  for (let dr = 0; dr < block.shape.length; dr++) {
    for (let dc = 0; dc < block.shape[0].length; dc++) {
      if (block.shape[dr][dc] === 1) ng[r + dr][c + dc] = { color: block.color }
    }
  }
  return ng
}

function findClearedLines(grid: Grid): { rows: number[]; cols: number[] } {
  const rows: number[] = []
  const cols: number[] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    if (grid[r].every(cell => cell !== null)) rows.push(r)
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    if (grid.every(row => row[c] !== null)) cols.push(c)
  }
  return { rows, cols }
}

// Sudoku-style: find any 3×3 sub-block whose every cell is filled.
function findClearedSubBlocks(grid: Grid): Array<{ r: number; c: number }> {
  const blocks: Array<{ r: number; c: number }> = []
  for (let br = 0; br < GRID_SIZE; br += SUB_SIZE) {
    for (let bc = 0; bc < GRID_SIZE; bc += SUB_SIZE) {
      let full = true
      for (let r = br; r < br + SUB_SIZE && full; r++) {
        for (let c = bc; c < bc + SUB_SIZE && full; c++) {
          if (grid[r][c] === null) full = false
        }
      }
      if (full) blocks.push({ r: br, c: bc })
    }
  }
  return blocks
}

function markClearing(
  grid: Grid,
  rows: number[],
  cols: number[],
  subs: Array<{ r: number; c: number }>,
): Grid {
  const ng = gridCopy(grid)
  rows.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) if (ng[r][c]) ng[r][c]!.clearing = true })
  cols.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) if (ng[r][c]) ng[r][c]!.clearing = true })
  subs.forEach(({ r, c }) => {
    for (let dr = 0; dr < SUB_SIZE; dr++) {
      for (let dc = 0; dc < SUB_SIZE; dc++) {
        if (ng[r + dr][c + dc]) ng[r + dr][c + dc]!.clearing = true
      }
    }
  })
  return ng
}

function clearLines(grid: Grid, rows: number[], cols: number[]): Grid {
  const ng = gridCopy(grid)
  rows.forEach(r => { ng[r] = Array(GRID_SIZE).fill(null) })
  cols.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) ng[r][c] = null })
  return ng
}

function clearSubBlocks(grid: Grid, subs: Array<{ r: number; c: number }>): Grid {
  const ng = gridCopy(grid)
  subs.forEach(({ r, c }) => {
    for (let dr = 0; dr < SUB_SIZE; dr++) {
      for (let dc = 0; dc < SUB_SIZE; dc++) {
        ng[r + dr][c + dc] = null
      }
    }
  })
  return ng
}

function canPlaceAnywhere(grid: Grid, shape: number[][]): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlace(grid, shape, r, c)) return true
    }
  }
  return false
}

function nextTray(): (Block | null)[] {
  return [makeBlock(), makeBlock(), makeBlock()]
}

// ─── Component ──────────────────────────────────────────────────────────────
type Phase = 'idle' | 'playing' | 'gameover'

export default function PawDokuGame() {
  const router   = useRouter()
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

  const [phase,     setPhase]     = useState<Phase>('idle')
  const [grid,      setGrid]      = useState<Grid>(makeEmptyGrid)
  const [tray,      setTray]      = useState<(Block | null)[]>(() => [null, null, null])
  const [score,     setScore]     = useState(0)
  const [displayScore, setDisplayScore] = useState(0)      // count-up score for game-over panel
  const [scorePulse, setScorePulse] = useState(0)          // re-keys score pulse animation on increment
  const [bestScore, setBest]      = useState(0)
  // Persist BEST across visits (matches flappy/lane).
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem('paw_doku_best') || '', 10)
      if (Number.isFinite(n) && n > 0) setBest(n)
    } catch { /* localStorage unavailable */ }
  }, [])
  const [combo,     setCombo]     = useState(0)            // # of clears in this placement
  const [streak,    setStreak]    = useState(0)            // # of consecutive placements that cleared
  // Grace period: a placement that doesn't clear costs ONE grace.
  // Streak only resets after 3 consecutive no-clear placements.
  const [streakMisses, setStreakMisses] = useState(0)
  const [gridShake, setGridShake] = useState(0)            // re-keys the invalid-drop grid shake
  const [trayRefillKey, setTrayRefillKey] = useState(0)    // re-keys tray-refill stagger animation
  const [vignette, setVignette] = useState(0)              // re-keys the game-over red vignette
  // Eren's reaction to the last drop, cleared on a keyed timer so an earlier
  // reaction can't cut a later one short.
  const [erenFx, setErenFx] = useState<{ pose: ErenPose; key: number } | null>(null)
  const [floater,   setFloater]   = useState<{ id: number; text: string; color: string } | null>(null)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number }>>([])
  const [reward,    setReward]    = useState<GameRewardResult | null>(null)
  const savedRef = useRef(false)
  const STREAK_GRACE = 3
  const [savedGame, setSavedGame] = useState<{ owner: string; data: PawDokuSave | null } | null>(null)
  const resumable = savedGame?.owner === user?.id ? savedGame?.data : null
  useEffect(() => {
    const data = user?.id ? readPuzzle('paw_doku', user.id) : null
    setSavedGame(user ? { owner: user.id, data } : null)
  }, [user?.id])

  function checkpoint(board: Grid, pieces: (Block | null)[], points: number, chain: number, misses: number) {
    if (!user) return
    const playable = pieces.some(b => b && canPlaceAnywhere(board, b.shape))
    if (!playable) { clearPuzzle('paw_doku', user.id); setSavedGame(null); return }
    writePuzzle('paw_doku', user.id, {
      grid: board.map(row => row.map(cell => cell ? PALETTES.indexOf(cell.color) : null)),
      tray: pieces.map(b => b ? { shape: b.shape, color: PALETTES.indexOf(b.color) } : null),
      score: points, streak: chain, streakMisses: misses,
    })
  }

  function continueGame() {
    if (!resumable) return
    timers.clearAll()
    const board = resumable.grid.map(row => row.map(c => c === null ? null : { color: PALETTES[c] }))
    const pieces = resumable.tray.map(b => b ? { id: ++_bid, shape: b.shape, color: PALETTES[b.color] } : null)
    if (!pieces.some(b => b && canPlaceAnywhere(board, b.shape))) {
      startGame()
      return
    }
    setGrid(board)
    setTray(pieces)
    setScore(resumable.score)
    scoreRef.current = resumable.score
    setStreak(resumable.streak)
    setStreakMisses(resumable.streakMisses)
    setPhase('playing')
    savedRef.current = false
  }

  // Eren watches the tray and reacts to the last drop — a clear makes him
  // cheer, a rejected block startles him. Keyed so overlapping reactions
  // don't let an earlier timer end a later one.
  const erenFxKey = useRef(0)
  function reactEren(pose: ErenPose, hold: number) {
    if (pose === 'cheer') rx.good()
    if (pose === 'wobble') rx.bad()
    erenFxKey.current += 1
    const key = erenFxKey.current
    setErenFx({ pose, key })
    timers.setTimeout(() => setErenFx(f => (f && f.key === key ? null : f)), hold)
  }

  // Mirror score into a ref so endGame (fired via setTimeout from afterPlace)
  // reads the TRUE post-placement total, not the stale closure score from the
  // render that scheduled it — otherwise the final move's points (often a big
  // multi-clear) are dropped from BEST, the count-up, the leaderboard, and coins.
  const scoreRef = useRef(0)
  useEffect(() => { scoreRef.current = score }, [score])

  // ── Drag state ──
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragPos,    setDragPos]    = useState({ x: 0, y: 0 })
  const gridRef = useRef<HTMLDivElement>(null)

  // Compute the would-place cell from a given pointer position. Defaults
  // to the live `dragPos` state for render-time previews; the drop handler
  // calls this with `dragPosRef.current` so it sees the latest position
  // even when invoked from a stale-closured event listener.
  function hoverCell(pos: { x: number; y: number } = dragPos): { r: number; c: number } | null {
    if (draggedIdx === null) return null
    const block = tray[draggedIdx]
    if (!block || !gridRef.current) return null
    const rect   = gridRef.current.getBoundingClientRect()
    const stride = CELL_PX + CELL_GAP
    const { rows, cols } = shapeBox(block.shape)
    // Block top-left in viewport coords:
    const blockW = cols * CELL_PX + (cols - 1) * CELL_GAP
    const blockH = rows * CELL_PX + (rows - 1) * CELL_GAP
    const tlX = pos.x - blockW / 2
    const tlY = pos.y - blockH - DRAG_LIFT
    // Snap to nearest grid cell
    const c = Math.round((tlX - rect.left) / stride)
    const r = Math.round((tlY - rect.top)  / stride)
    if (r < 0 || c < 0) return null
    if (r + rows > GRID_SIZE || c + cols > GRID_SIZE) return null
    return { r, c }
  }

  const previewCell = (() => {
    const cell = hoverCell()
    if (!cell || draggedIdx === null) return null
    const block = tray[draggedIdx]
    if (!block) return null
    if (!canPlace(grid, block.shape, cell.r, cell.c)) return null
    return cell
  })()

  // ── Window-level pointer move/up while dragging ──
  // The window listeners are registered ONCE per drag (deps: [draggedIdx])
  // so they don't bind every render. But that means they close over a stale
  // `handleDrop`. We dodge that by storing the always-current handleDrop in
  // a ref and invoking that ref from the listener — `handleDropRef.current`
  // is reassigned on every render so it sees the latest dragPos / tray /
  // grid state. Same goes for the move handler updating the position ref.
  const dragPosRef     = useRef({ x: 0, y: 0 })
  const handleDropRef  = useRef<() => void>(() => {})

  useEffect(() => {
    if (draggedIdx === null) return
    function onMove(e: PointerEvent) {
      dragPosRef.current = { x: e.clientX, y: e.clientY }
      setDragPos({ x: e.clientX, y: e.clientY })
    }
    function onUp() { handleDropRef.current() }
    function onCancel() { setDraggedIdx(null) }
    window.addEventListener('pointermove',   onMove)
    window.addEventListener('pointerup',     onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove',   onMove)
      window.removeEventListener('pointerup',     onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [draggedIdx])

  function startGame() {
    timers.clearAll()
    const board = makeEmptyGrid(), pieces = nextTray()
    checkpoint(board, pieces, 0, 0, 0)
    setGrid(board)
    setParticles([])
    setTray(pieces)
    setTrayRefillKey(k => k + 1)
    setScore(0)
    scoreRef.current = 0
    setDisplayScore(0)
    setCombo(0)
    setStreak(0)
    setStreakMisses(0)
    setPhase('playing')
    savedRef.current = false
    setReward(null)
    setDraggedIdx(null)
  }

  function endGame() {
    const finalScore = scoreRef.current
    if (user) clearPuzzle('paw_doku', user.id)
    setSavedGame(null)
    setPhase('gameover')
    setBest(b => Math.max(b, finalScore))
    try {
      const prev = parseInt(localStorage.getItem('paw_doku_best') || '0', 10) || 0
      if (finalScore > prev) localStorage.setItem('paw_doku_best', String(finalScore))
    } catch { /* ignore */ }
    if (!reduced) setVignette(v => v + 1)
    playSound('pd_gameover')

    // Count-up score animation, 800ms via requestAnimationFrame so the
    // final tally feels earned. Starts from 0, eases to final score.
    setDisplayScore(0)
    const startTs = performance.now()
    const duration = 800
    function step(now: number) {
      const t = Math.min(1, (now - startTs) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplayScore(Math.round(finalScore * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    if (finalScore > 0) requestAnimationFrame(step)
    else setDisplayScore(0)

    if (!savedRef.current && user?.id) {
      savedRef.current = true
      setReward(reportGameResult({ gameType: 'paw_doku', score: finalScore }))
      if (finalScore > 0) {
        fireMinigameDone('paw_doku', finalScore)
        completeTask('daily_game')
        if (finalScore >= 1500) completeTask('weekly_high_score')
        applyAction(user.id, 'play')
      }
    }
  }

  function handleBlockPointerDown(e: React.PointerEvent, idx: number) {
    if (phase !== 'playing' || draggedIdx !== null) return
    if (grid.some(row => row.some(cell => cell?.clearing))) return
    if (!tray[idx]) return
    e.preventDefault()
    playSound('pd_pickup')
    setDraggedIdx(idx)
    setDragPos({ x: e.clientX, y: e.clientY })
    dragPosRef.current = { x: e.clientX, y: e.clientY }
  }

  // A small burst stays within about one cell of each disappearing block.
  function spawnClearParticles(cells: Array<{ r: number; c: number; color: string }>) {
    const newParticles: Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number }> = []
    cells.forEach(({ r, c, color }) => {
      const cx = c * (CELL_PX + CELL_GAP) + CELL_PX / 2
      const cy = r * (CELL_PX + CELL_GAP) + CELL_PX / 2
      const count = 3
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
        const speed = 10 + Math.random() * 6
        newParticles.push({
          id: ++_bid,
          x: cx, y: cy,
          color,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed - 4,
        })
      }
    })
    setParticles(prev => [...prev, ...newParticles].slice(-90))
    const ids = new Set(newParticles.map(p => p.id))
    timers.setTimeout(() => {
      setParticles(prev => prev.filter(p => !ids.has(p.id)))
    }, 420)
  }

  function flashFloater(text: string, color: string) {
    const id = ++_bid
    setFloater({ id, text, color })
    timers.setTimeout(() => setFloater(f => f && f.id === id ? null : f), 900)
  }

  function handleDrop() {
    if (draggedIdx === null) { setDraggedIdx(null); return }
    const block = tray[draggedIdx]
    if (!block) { setDraggedIdx(null); return }
    // Use the ref so we read the LATEST pointer position, not a stale
    // closure value from when the window listener was registered.
    const target = hoverCell(dragPosRef.current)
    if (!target || !canPlace(grid, block.shape, target.r, target.c)) {
      // Bounce back — error buzz + grid shake + brief red border pulse
      setDraggedIdx(null)
      setGridShake(s => s + 1)
      reactEren('wobble', 620)
      playSound('pd_invalid')
      return
    }

    // Place
    setDraggedIdx(null)
    setTray(current => current.map((piece, idx) => idx === draggedIdx ? null : piece))
    let g = placeBlock(grid, block, target.r, target.c)
    const placedCells = shapeBox(block.shape).cells
    let gained = placedCells * SCORE_PER_CELL
    // Sound escalates by event below — pd_place for normal,
    // pd_line_clear for 1 clear, pd_combo for 2+, pd_streak for chained.

    // Detect every kind of clear: full rows, full columns, full 3×3
    // sub-blocks. They're all batched and counted together for combo.
    const { rows, cols } = findClearedLines(g)
    const subs = findClearedSubBlocks(g)
    const totalClears = rows.length + cols.length + subs.length
    const stripped = tray.map((piece, idx) => idx === draggedIdx ? null : piece)
    const isRefill = stripped.every(b => b === null)
    const next = isRefill ? nextTray() : stripped

    if (totalClears > 0) {
      // Score: base + escalating bonus per simultaneous clear
      const lineBonus = totalClears * SCORE_PER_LINE
      const comboMult = totalClears >= 2 ? totalClears : 1
      gained += lineBonus * comboMult

      // Streak bonus — consecutive placements that cleared. The first
      // clear in a streak (newStreak === 1) adds nothing extra; from
      // newStreak === 2 onward we add 50% of the gained-so-far per
      // streak level beyond the first. So x2 streak → +50%, x3 → +100%,
      // x4 → +150%. Hitting a clear ALSO resets the no-clear grace
      // counter back to 0.
      const newStreak = streak + 1
      if (newStreak >= 2) {
        const streakBonus = Math.floor(gained * 0.5 * (newStreak - 1))
        gained += streakBonus
      }
      setStreak(newStreak)
      setStreakMisses(0)
      // Persist the settled move before its visual clear timeout can be interrupted.
      const settled = clearSubBlocks(clearLines(g, rows, cols), subs)
      checkpoint(settled, next, score + gained, newStreak, 0)

      // Auditory escalation — streak takes priority over combo size.
      if (newStreak >= 2) playSound('pd_streak')
      else if (totalClears >= 2) playSound('pd_combo')
      else playSound('pd_line_clear')

      // Only cleared cells emit particles, using their own block colours.
      if (!reduced) {
        const particleCells: Array<{ r: number; c: number; color: string }> = []
        const seen = new Set<string>()
        const addCell = (r: number, c: number) => {
          const key = `${r},${c}`
          if (seen.has(key)) return
          seen.add(key)
          const cell = g[r][c]
          if (cell) particleCells.push({ r, c, color: cell.color.main })
        }
        rows.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) addCell(r, c) })
        cols.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) addCell(r, c) })
        subs.forEach(({ r, c }) => {
          for (let dr = 0; dr < SUB_SIZE; dr++) for (let dc = 0; dc < SUB_SIZE; dc++) addCell(r + dr, c + dc)
        })
        spawnClearParticles(particleCells)
      }

      // Pop the completed cells, then remove them after the short animation.
      g = markClearing(g, rows, cols, subs)
      setGrid(g)
      setCombo(totalClears)
      reactEren('cheer', 900)
      timers.setTimeout(() => setCombo(0), 850)

      // Floater colour: gold for x3+ clears, pink for streaks ≥ 2,
      // mint for the regular case.
      const floaterColor = totalClears >= 3 ? '#FBBF24'
                         : newStreak >= 2   ? '#FF9EC8'
                         : totalClears >= 2 ? '#FBCFE8'
                                            : '#A3F0C0'
      const floaterText = totalClears >= 2 && newStreak >= 2
                          ? `+${gained} · Combo x${totalClears} · Streak x${newStreak}`
                          : totalClears >= 2
                            ? `+${gained} · Combo x${totalClears}`
                            : newStreak >= 2
                              ? `+${gained} · Streak x${newStreak}`
                              : `+${gained}`
      flashFloater(floaterText, floaterColor)

      timers.setTimeout(() => {
        let cleared = clearLines(g, rows, cols)
        cleared = clearSubBlocks(cleared, subs)
        setGrid(cleared)
        afterPlace(cleared, next, isRefill, gained)
      }, 280)
    } else {
      // No clear. Use up one of the streak's grace placements before
      // actually resetting — gives the player some breathing room
      // (place 1-2 setup pieces without losing the multiplier).
      playSound('pd_place')
      const newMisses = streakMisses + 1
      checkpoint(g, next, score + gained, newMisses >= STREAK_GRACE ? 0 : streak,
        newMisses >= STREAK_GRACE ? 0 : newMisses)
      if (newMisses >= STREAK_GRACE) {
        setStreak(0)
        setStreakMisses(0)
      } else {
        setStreakMisses(newMisses)
      }
      setGrid(g)
      flashFloater(`+${gained}`, '#A3F0C0')
      afterPlace(g, next, isRefill, gained)
    }
  }

  function afterPlace(latestGrid: Grid, next: (Block | null)[], isRefill: boolean, gained: number) {
    scoreRef.current += gained
    setScore(scoreRef.current)
    setScorePulse(p => p + 1) // re-key the SCORE digit pulse on every increment

    // Strip the placed block from the tray; if every slot is now empty,
    // refill from a fresh batch of three (and re-key the refill stagger).
    if (isRefill) setTrayRefillKey(k => k + 1)
    setTray(next)
    setDraggedIdx(null)

    // Game-over check runs against the FINAL post-clear grid + the FINAL
    // tray (post-strip / post-refill). We do it inline here instead of
    // reactively in a useEffect to avoid intermediate-state false
    // positives during the line-clear timeout.
    const remaining = next.filter(b => b !== null) as Block[]
    if (remaining.length > 0 && remaining.every(b => !canPlaceAnywhere(latestGrid, b.shape))) {
      timers.setTimeout(endGame, 280)
    }
  }

  // Keep the ref pointed at the latest handleDrop closure on every render
  // so the window-attached pointerup listener calls THIS render's version
  // (which sees current tray, grid, dragPos via dragPosRef).
  handleDropRef.current = handleDrop

  // ─── Render ───────────────────────────────────────────────────────────────
  const draggedBlock = draggedIdx !== null ? tray[draggedIdx] : null
  const draggedBox   = draggedBlock ? shapeBox(draggedBlock.shape) : null
  const dragGridRect = draggedBlock ? gridRef.current?.getBoundingClientRect() : null

  return (
    <div className="meadow-root pd-game fixed inset-0 z-40 flex flex-col game-shell"
      style={{ background: M.soft }}>

      {/* Header + stats — the shared Meadow game chrome. */}
      <GameTopBar title="Paw Doku" onBack={() => { playSound('ui_back'); router.replace('/games') }} />

      {/* Score left, Best right; the combo (multi-clear in one drop) and the
          streak (clears chained across drops) pop in between while they last. */}
      <GameStatRow>
        <GameStat icon={<MeadowIcon name="star" size={16} />} value={score} pulse={reduced ? undefined : scorePulse} ariaLabel={`Score ${score}`} />
        {(combo > 1 || streak > 1) && (
          <span className="flex items-center" style={{ gap: 6 }}>
            {combo > 1 && (
              <GameStat icon={<MeadowIcon name="bolt" size={16} />} value={`×${combo}`} tone="hot" pulse={combo}
                ariaLabel={`Combo x${combo}`} style={STAT_TIGHT} />
            )}
            {streak > 1 && (
              <GameStat icon={<MeadowIcon name="flame" size={16} />} tone="hot" pulse={streak}
                ariaLabel={`Streak x${streak}`} style={STAT_TIGHT}
                value={
                  <>
                    ×{streak}
                    {/* Grace pips — they go out as the player burns no-clear
                        placements. When all are dim, the next no-clear
                        placement breaks the streak. */}
                    <span className="inline-flex items-center" style={{ gap: 3, marginLeft: 2 }} aria-hidden>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{
                          width: 5, height: 5, borderRadius: 999,
                          background: i < STREAK_GRACE - streakMisses ? M.flame : 'rgba(138, 90, 18, 0.2)',
                        }} />
                      ))}
                    </span>
                  </>
                } />
            )}
          </span>
        )}
        <GameStat icon={<MeadowIcon name="trophy" size={18} />} value={bestScore} ariaLabel={`Best ${bestScore}`} />
      </GameStatRow>

      {/* The board starts under the floating bar and stat row. */}
      <div aria-hidden style={{ height: CHROME_CLEARANCE, flexShrink: 0 }} />

      {/* Grid */}
      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-3 pb-2 select-none">
        <div key={`shake-wrap-${gridShake}`} style={{
          animation: gridShake > 0 && !reduced ? 'pdGridShake 0.28s steps(6, end)' : undefined,
        }}>
        <div ref={gridRef}
          className="pd-board relative"
          role="img" aria-label="Paw Doku, 9 by 9 board"
          style={{
            width: GRID_PX,
            height: GRID_PX,
            background: M.ground,
            borderRadius: 8,
            boxShadow: `0 0 0 6px ${M.ground}, 0 4px 0 6px ${M.groundLip}`,
          }}>
          {/* Cell grid */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const r = Math.floor(i / GRID_SIZE)
            const c = i % GRID_SIZE
            const cell = grid[r][c]
            return (
              <div key={i} className="pd-cell absolute" data-row={r} data-col={c} data-filled={!!cell}
                style={{
                  left: c * (CELL_PX + CELL_GAP),
                  top:  r * (CELL_PX + CELL_GAP),
                  width: CELL_PX, height: CELL_PX,
                  borderRadius: 4,
                  background: cell
                    ? cell.color.main
                    : (Math.floor(r / SUB_SIZE) + Math.floor(c / SUB_SIZE)) % 2 === 0 ? M.leafTint : M.soft,
                  border: 'none',
                  boxShadow: cell
                    ? `inset 0 2px 0 ${cell.color.light}, inset 0 -3px 0 ${cell.color.dark}55`
                    : undefined,
                  // Only completed cells pop; the rest of the board stays still.
                  animation: cell?.clearing
                    ? (reduced ? 'pdClearReduced 0.28s ease-out forwards' : 'pdClear 0.28s ease-out forwards')
                    : undefined,
                  transition: cell?.clearing ? undefined : 'background 0.15s, border-color 0.15s',
                }} />
            )
          })}

          {/* Sudoku-style 3×3 sub-block divider lines. Two horizontals at
              row 3 and row 6, two verticals at col 3 and col 6 — sit on top
              of the cells via z-index so the boundaries stay visible even
              when cells are filled. */}
          {[1, 2].map(i => (
            <div key={`h-${i}`} className="absolute pointer-events-none" style={{
              left: 0, right: 0,
              top: i * SUB_SIZE * (CELL_PX + CELL_GAP) - CELL_GAP - 0.5,
              height: 2,
              background: M.softLip,
              zIndex: 2,
            }} />
          ))}
          {[1, 2].map(i => (
            <div key={`v-${i}`} className="absolute pointer-events-none" style={{
              top: 0, bottom: 0,
              left: i * SUB_SIZE * (CELL_PX + CELL_GAP) - CELL_GAP - 0.5,
              width: 2,
              background: M.softLip,
              zIndex: 2,
            }} />
          ))}

          {/* Invalid-drop red border pulse — re-keyed off gridShake so
              it co-fires with the wrapper shake. Sits above cells but
              below particles. */}
          {gridShake > 0 && (
            <div key={`red-${gridShake}`} className="absolute inset-0 pointer-events-none" style={{
              border: `3px solid ${M.danger}`,
              borderRadius: 8,
              opacity: 0,
              animation: 'pdRedPulse 0.32s ease-out forwards',
              zIndex: 7,
            }} />
          )}

          {/* Tiny bursts at the cleared cells, not across the whole board. */}
          {particles.map(p => (
            <div key={p.id} className="pd-clear-particle absolute pointer-events-none" style={{
              left: p.x - 1.5, top: p.y - 1.5,
              width: 3, height: 3,
              background: p.color,
              imageRendering: 'pixelated',
              // CSS custom properties so the keyframe can read the per-particle vector
              ['--pdx' as keyof React.CSSProperties as string]: `${p.dx}px`,
              ['--pdy' as keyof React.CSSProperties as string]: `${p.dy}px`,
              animation: 'pdParticle 0.38s ease-out forwards',
              zIndex: 8,
            } as React.CSSProperties} />
          ))}

          {/* One block, in board coordinates so the desktop phone frame cannot offset it. */}
          {draggedBlock && draggedBox && dragGridRect && (
            <div className="pd-drag absolute pointer-events-none z-50"
              data-valid={!!previewCell} data-row={previewCell?.r} data-col={previewCell?.c}
              style={{
                left: previewCell
                  ? previewCell.c * (CELL_PX + CELL_GAP)
                  : dragPos.x - dragGridRect.left - (draggedBox.cols * CELL_PX + (draggedBox.cols - 1) * CELL_GAP) / 2,
                top: previewCell
                  ? previewCell.r * (CELL_PX + CELL_GAP)
                  : dragPos.y - dragGridRect.top - (draggedBox.rows * CELL_PX + (draggedBox.rows - 1) * CELL_GAP) - DRAG_LIFT,
                filter: `drop-shadow(0 4px 0 ${previewCell ? M.groundLip : M.danger + '55'})`,
                opacity: 0.95,
              }}>
              <BlockSprite shape={draggedBlock.shape} color={draggedBlock.color} cellSize={CELL_PX} cellGap={CELL_GAP} />
            </div>
          )}
        </div>
        </div>

        {/* Floater */}
        {floater && (
          <div className="pointer-events-none absolute" style={{
            top: '52%',
            transform: 'translateY(-50%)',
            fontSize: 15, fontWeight: 800, color: M.leafInk,
            maxWidth: 'calc(100% - 24px)', textAlign: 'center',
            background: M.ground, borderRadius: 999, padding: '6px 12px',
            boxShadow: `0 3px 0 ${M.groundLip}`,
            animation: 'pdFloater 0.9s ease-out forwards',
            zIndex: 5,
          }}>
            {floater.text}
          </div>
        )}

        {/* Eren, sitting under the board between it and the tray. He cheers a
            clear and startles at a block that won't fit, so the last thing that
            happened stays readable while your eyes are on the piece you're
            dragging. Sits in the grid area's slack rather than the header,
            where a COMBO and a STREAK pill together already fill the row. */}
        {phase !== 'idle' && (
          <div className="relative flex justify-end pointer-events-none"
            style={{ width: GRID_PX, marginTop: 8, paddingRight: 2 }}>
            <span className="relative">
              <span aria-hidden className="absolute" style={{
                left: 4, right: 4, bottom: -2, height: 4, borderRadius: '50%',
                background: M.floorShadow,
              }} />
              <span className="relative block" style={{
                animation: reduced || erenFx ? undefined : 'pdErenBreathe 3.4s ease-in-out infinite',
                transformOrigin: 'center bottom',
              }}>
                <ErenReact reaction={rx.reaction} size={36}>
                  <PixelEren pose={erenFx?.pose ?? 'idle'} size={36}
                    blink={idle.blink} twitch={idle.twitch} glance={idle.glance} />
                </ErenReact>
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Tray — pointerDown sits on the WHOLE slot div so the player can
          tap anywhere in the 1/3-screen-wide cell, not just on a filled
          pixel of the small block sprite. Big mobile-friendly grab zone. */}
      <div className="pd-tray flex-shrink-0 px-3 pb-4 pt-2 flex items-center justify-around" style={{ minHeight: 120, background: M.ground, borderRadius: '24px 24px 0 0' }}>
        {tray.map((block, idx) => (
          <div key={idx}
            onPointerDown={block ? e => handleBlockPointerDown(e, idx) : undefined}
            className="pd-tray-slot flex items-center justify-center relative"
            aria-label={block ? `Block ${idx + 1}` : `Empty slot ${idx + 1}`}
            data-shape={block ? JSON.stringify(block.shape) : undefined}
            style={{
              flex: 1, minHeight: 110,
              touchAction: 'none',
              cursor: block ? 'grab' : 'default',
            }}>
            {/* Empty-slot placeholder outline — only visible when slot is empty
                AND any other slot is empty too (mid-round empties). When ALL
                three are empty we're about to refill, so skip it. */}
            {!block && !tray.every(b => b === null) && (
              <div className="pointer-events-none" style={{
                width: 56, height: 56,
                border: `2px dashed ${M.softLip}`,
                borderRadius: 8,
                opacity: 0.7,
              }} />
            )}
            {block && (
              <div
                key={`tray-${idx}-${trayRefillKey}-${block.id}`}
                style={{
                  visibility: draggedIdx === idx ? 'hidden' : undefined,
                  pointerEvents: 'none',
                  animation: reduced ? undefined : `pdTrayRefill 0.32s cubic-bezier(0.34,1.56,0.64,1) ${idx * 60}ms both`,
                }}>
                <BlockSprite shape={block.shape} color={block.color} cellSize={TRAY_CELL_PX} cellGap={TRAY_CELL_GAP} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Idle — the shared start card. */}
      {phase === 'idle' && (
        <GameStartCard
          title="Paw Doku"
          art={ART_PIECES.map((p, i) => (
            <GameArtTile key={i} size={42} tint={`${p.color.main}1F`}>
              <BlockSprite shape={p.shape} color={p.color} cellSize={9} cellGap={2} />
            </GameArtTile>
          ))}
          best={bestScore}
          startDisabled={!user || savedGame?.owner !== user.id}
          startLabel={resumable ? 'Continue game' : 'Play'}
          extra={resumable && <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: M.text2 }}>Score {resumable.score}</span>
            <TextButton onClick={() => { playSound('ui_tap'); startGame() }}>New game</TextButton>
          </div>}
          onStart={() => { playSound('ui_tap'); resumable ? continueGame() : startGame() }}
        >
          Drag blocks onto the grid. Fill a row, a column or a 3×3 square to clear it.
          Clearing several at once earns a combo bonus.
        </GameStartCard>
      )}

      {/* Game over — a red vignette flashes over the board (gameplay FX,
          600ms) under the shared result card. */}
      {phase === 'gameover' && vignette > 0 && (
        <div key={`vig-${vignette}`} className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(220,38,38,0.55) 100%)',
          animation: 'pdVignette 0.6s ease-out forwards',
          mixBlendMode: 'multiply',
          zIndex: 45,
        }} />
      )}
      {phase === 'gameover' && (
        <GameResultCard
          headline="No moves left"
          score={displayScore}
          best={bestScore}
          reward={reward && <GameCoinReward coins={reward.coins} blocked={reward.blocked} />}
          onAgain={() => { playSound('ui_tap'); startGame() }}
          onBack={() => { playSound('ui_back'); router.replace('/games') }}
        />
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .pd-game *, .pd-game *::before, .pd-game *::after {
            animation: none !important; transition: none !important;
          }
        }
        @keyframes pdFloater {
          0%   { opacity: 0; transform: translateY(0)   scale(0.8); }
          25%  { opacity: 1; transform: translateY(-6px) scale(1.1); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.95); }
        }
        @keyframes pdClear {
          0%   { transform: scale(1); opacity: 1; }
          25%  { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(0.25); opacity: 0; }
        }
        @keyframes pdClearReduced {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        /* Eren idling under the board — a slow breath so he isn't a decal */
        @keyframes pdErenBreathe {
          0%, 100% { transform: scaleY(1)     translateY(0); }
          50%      { transform: scaleY(1.04)  translateY(-1px); }
        }
        /* Invalid-drop grid wrapper shake — 6 stepped frames, no easing,
           keeps the retro feel. */
        @keyframes pdGridShake {
          0%   { transform: translateX(0); }
          16%  { transform: translateX(-7px); }
          32%  { transform: translateX(6px); }
          48%  { transform: translateX(-5px); }
          64%  { transform: translateX(4px); }
          80%  { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
        /* Red border pulse on invalid drop — coordinates with the shake. */
        @keyframes pdRedPulse {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          100% { opacity: 0; }
        }
        /* Cleared-cell particle: radiates from origin using per-particle
           CSS vars --pdx / --pdy, with gravity baked into the curve so
           particles arc and fall. */
        @keyframes pdParticle {
          0%   { transform: translate(0, 0) scale(1);   opacity: 1; }
          70%  { opacity: 0.85; }
          100% { transform: translate(var(--pdx, 0), calc(var(--pdy, 0) + 12px)) scale(0.4); opacity: 0; }
        }
        /* Tray refill: each block scales from 0 with a slight overshoot,
           staggered 60ms apart via inline animation-delay. */
        @keyframes pdTrayRefill {
          0%   { transform: scale(0);    opacity: 0; }
          70%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        /* Game-over screen-wide red vignette flash, 600ms ease-out. */
        @keyframes pdVignette {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── Block sprite ───────────────────────────────────────────────────────────
// Cells laid out in absolute positioning so the container has natural width
// equal to (cols*size + (cols-1)*gap), no implicit grid alignment quirks.
function BlockSprite({ shape, color, cellSize, cellGap }: {
  shape: number[][]
  color: Palette
  cellSize: number
  cellGap: number
}) {
  const rows = shape.length
  const cols = shape[0].length
  const w = cols * cellSize + (cols - 1) * cellGap
  const h = rows * cellSize + (rows - 1) * cellGap
  return (
    <div className="relative" style={{ width: w, height: h }}>
      {shape.flatMap((row, r) =>
        row.map((v, c) => v === 1 ? (
          <div key={`${r}-${c}`} className="absolute" style={{
            left: c * (cellSize + cellGap),
            top:  r * (cellSize + cellGap),
            width: cellSize, height: cellSize,
            borderRadius: Math.max(2, cellSize * 0.12),
            background: color.main,
            boxShadow: `inset 0 2px 0 ${color.light}, inset 0 -2px 0 ${color.dark}55`,
          }} />
        ) : null)
      )}
    </div>
  )
}
