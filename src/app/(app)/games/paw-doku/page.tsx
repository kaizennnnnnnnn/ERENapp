'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PAW DOKU — Block Doku / Block Blast clone, themed for the Eren app.
// ────────────────────────────────────────────────────────────────────────
// 8×8 grid. Three pre-shaped blocks live in a tray at the bottom; drag any
// of them onto the grid. Filling a row OR a column clears it. Multi-line
// clears chain into a combo for bonus points. When all three tray blocks
// are placed, the tray refills. Game over fires the moment none of the
// remaining blocks fits anywhere on the board.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import GameCoinReward from '@/components/games/GameCoinReward'
import { playSound } from '@/lib/sounds'
import { IconStar, IconSparkles } from '@/components/PixelIcons'
import { fireMinigameDone } from '@/lib/minigames'

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
  { main: '#EC4899', dark: '#831843', light: '#FBCFE8' }, // pink
  { main: '#A78BFA', dark: '#4C1D95', light: '#DDD6FE' }, // purple
  { main: '#FBBF24', dark: '#92400E', light: '#FDE68A' }, // gold
  { main: '#34D399', dark: '#047857', light: '#A7F3D0' }, // mint
  { main: '#60A5FA', dark: '#1E40AF', light: '#BFDBFE' }, // blue
  { main: '#FB7185', dark: '#9F1239', light: '#FECDD3' }, // coral
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
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

  const [phase,     setPhase]     = useState<Phase>('idle')
  const [grid,      setGrid]      = useState<Grid>(makeEmptyGrid)
  const [tray,      setTray]      = useState<(Block | null)[]>(() => [null, null, null])
  const [score,     setScore]     = useState(0)
  const [displayScore, setDisplayScore] = useState(0)      // count-up score for game-over panel
  const [scorePulse, setScorePulse] = useState(0)          // re-keys score pulse animation on increment
  const [bestScore, setBest]      = useState(0)
  const [combo,     setCombo]     = useState(0)            // # of clears in this placement
  const [streak,    setStreak]    = useState(0)            // # of consecutive placements that cleared
  // Grace period: a placement that doesn't clear costs ONE grace.
  // Streak only resets after 3 consecutive no-clear placements.
  const [streakMisses, setStreakMisses] = useState(0)
  const [gridFlash, setGridFlash] = useState(0)            // re-keys the grid-wide flash overlay
  const [gridShake, setGridShake] = useState(0)            // re-keys the invalid-drop grid shake
  const [trayRefillKey, setTrayRefillKey] = useState(0)    // re-keys tray-refill stagger animation
  const [vignette, setVignette] = useState(0)              // re-keys the game-over red vignette
  const [floater,   setFloater]   = useState<{ id: number; text: string; color: string } | null>(null)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number }>>([])
  const [reward,    setReward]    = useState<GameRewardResult | null>(null)
  const savedRef = useRef(false)
  const STREAK_GRACE = 3

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

  // Build a quick lookup of preview cells (the cells that would be filled)
  const previewSet: Set<string> = (() => {
    const s = new Set<string>()
    if (!previewCell || draggedIdx === null) return s
    const block = tray[draggedIdx]
    if (!block) return s
    for (let dr = 0; dr < block.shape.length; dr++) {
      for (let dc = 0; dc < block.shape[0].length; dc++) {
        if (block.shape[dr][dc] === 1) s.add(`${previewCell.r + dr},${previewCell.c + dc}`)
      }
    }
    return s
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
    window.addEventListener('pointermove',   onMove)
    window.addEventListener('pointerup',     onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove',   onMove)
      window.removeEventListener('pointerup',     onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [draggedIdx])

  function startGame() {
    timers.clearAll()
    setGrid(makeEmptyGrid())
    setTray(nextTray())
    setTrayRefillKey(k => k + 1)
    setScore(0)
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
    setPhase('gameover')
    setBest(b => Math.max(b, finalScore))
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
    if (phase !== 'playing') return
    if (!tray[idx]) return
    e.preventDefault()
    playSound('pd_pickup')
    setDraggedIdx(idx)
    setDragPos({ x: e.clientX, y: e.clientY })
    dragPosRef.current = { x: e.clientX, y: e.clientY }
  }

  // Spawn ~10-14 small pixel-square particles per cleared cell, flying
  // outward with gravity. Particles are scheduled to despawn together
  // after their 600ms animation completes.
  function spawnClearParticles(cells: Array<{ r: number; c: number; color: string }>) {
    if (!gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    const newParticles: Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number }> = []
    cells.forEach(({ r, c, color }) => {
      const cx = c * (CELL_PX + CELL_GAP) + CELL_PX / 2
      const cy = r * (CELL_PX + CELL_GAP) + CELL_PX / 2
      const count = 4 + Math.floor(Math.random() * 3) // 4-6 per cell — keeps total counts sane on big clears
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 28 + Math.random() * 38
        newParticles.push({
          id: ++_bid,
          x: cx, y: cy,
          color,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed - 18, // small upward bias before gravity
        })
      }
    })
    // Cap the particle array so back-to-back clears don't compound a thousand DOM nodes
    setParticles(prev => [...prev, ...newParticles].slice(-180))
    const ids = new Set(newParticles.map(p => p.id))
    timers.setTimeout(() => {
      setParticles(prev => prev.filter(p => !ids.has(p.id)))
    }, 650)
    // Keep `rect` referenced so linters don't flag the unused capture; we use
    // grid-relative coords above (particles are absolute children of the grid).
    void rect
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
      playSound('pd_invalid')
      return
    }

    // Place
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

      // Auditory escalation — streak takes priority over combo size.
      if (newStreak >= 2) playSound('pd_streak')
      else if (totalClears >= 2) playSound('pd_combo')
      else playSound('pd_line_clear')

      // Spawn cleared-cell particles (uses each cell's palette color).
      // Skipped entirely when reduced-motion is on — this is the worst
      // offender (up to 180 pixel squares fireworking per clear).
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

      // Show clearing flash, then nuke the cells next frame
      g = markClearing(g, rows, cols, subs)
      setGrid(g)
      setCombo(totalClears)
      // Skip the hue-cycling grid washes + expanding shockwave when reduced.
      if (!reduced) setGridFlash(f => f + 1)
      timers.setTimeout(() => setCombo(0), 850)

      // Floater colour: gold for x3+ clears, pink for streaks ≥ 2,
      // mint for the regular case.
      const floaterColor = totalClears >= 3 ? '#FBBF24'
                         : newStreak >= 2   ? '#FF9EC8'
                         : totalClears >= 2 ? '#FBCFE8'
                                            : '#A3F0C0'
      const floaterText = totalClears >= 2 && newStreak >= 2
                          ? `${gained}  x${totalClears} · STREAK x${newStreak}!`
                          : totalClears >= 2
                            ? `${gained}  COMBO x${totalClears}!`
                            : newStreak >= 2
                              ? `${gained}  STREAK x${newStreak}!`
                              : `+${gained}`
      flashFloater(floaterText, floaterColor)

      timers.setTimeout(() => {
        let cleared = clearLines(g, rows, cols)
        cleared = clearSubBlocks(cleared, subs)
        setGrid(cleared)
        afterPlace(cleared, draggedIdx, gained)
      }, 280)
    } else {
      // No clear. Use up one of the streak's grace placements before
      // actually resetting — gives the player some breathing room
      // (place 1-2 setup pieces without losing the multiplier).
      playSound('pd_place')
      const newMisses = streakMisses + 1
      if (newMisses >= STREAK_GRACE) {
        setStreak(0)
        setStreakMisses(0)
      } else {
        setStreakMisses(newMisses)
      }
      setGrid(g)
      flashFloater(`+${gained}`, '#A3F0C0')
      afterPlace(g, draggedIdx, gained)
    }
  }

  function afterPlace(latestGrid: Grid, idx: number, gained: number) {
    setScore(s => s + gained)
    setScorePulse(p => p + 1) // re-key the SCORE digit pulse on every increment

    // Strip the placed block from the tray; if every slot is now empty,
    // refill from a fresh batch of three (and re-key the refill stagger).
    const stripped = [...tray]
    stripped[idx] = null
    const isRefill = stripped.every(b => b === null)
    const next = isRefill ? nextTray() : stripped
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

  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell"
      style={{ background: 'radial-gradient(ellipse at top, #2D1659 0%, #1A0A33 55%, #0F0620 100%)' }}>

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
          style={{ background: 'linear-gradient(135deg, #DB2777, #EC4899)', border: '2px solid #831843', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          PAW DOKU
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* Score / combo */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div>
          <div className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 2 }}>SCORE</div>
          <div key={`score-${scorePulse}`} className="font-pixel" style={{
            fontSize: 22, color: '#FFFFFF',
            textShadow: '2px 2px 0 #2E0F5C',
            letterSpacing: 1,
            display: 'inline-block',
            transformOrigin: 'left center',
            animation: scorePulse > 0 ? 'pdScorePulse 0.45s ease-out' : undefined,
          }}>{score}</div>
        </div>
        {/* Combo / streak HUD pill — combo (multi-clear in one drop) takes
            precedence; streak shows when the player has chained clears
            across multiple drops. */}
        {(combo > 1 || streak > 1) && (
          <div className="flex items-center gap-1.5">
            {combo > 1 && (
              <div key={`combo-${combo}`} className="font-pixel" style={{
                background: 'rgba(0,0,0,0.5)',
                border: '2px solid #FBBF24',
                borderRadius: 3,
                padding: '4px 10px',
                fontSize: 9, color: '#FBBF24', letterSpacing: 2,
                boxShadow: '0 0 14px rgba(251,191,36,0.5)',
                animation: 'pdCombo 0.6s ease-out',
              }}>
                COMBO x{combo}
              </div>
            )}
            {streak > 1 && (
              <div key={`streak-${streak}`} className="font-pixel inline-flex items-center gap-1.5" style={{
                background: 'linear-gradient(135deg, #DB2777, #831843)',
                border: '2px solid #FFD700',
                borderRadius: 3,
                padding: '4px 10px',
                fontSize: 9, color: '#FFFFFF', letterSpacing: 2,
                boxShadow: '0 0 14px rgba(236,72,153,0.55), 0 0 20px rgba(255,215,0,0.35)',
                animation: 'pdStreak 0.55s ease-out',
              }}>
                <span>STREAK x{streak}</span>
                {/* Grace pips — fills empty as the player burns no-clear
                    placements. 3 pips for 3 grace slots. When all dim,
                    next no-clear placement breaks the streak. */}
                <span className="inline-flex items-center gap-[3px]" aria-hidden>
                  {[0, 1, 2].map(i => {
                    const remaining = STREAK_GRACE - streakMisses
                    const lit = i < remaining
                    return (
                      <span key={i} style={{
                        width: 4, height: 4,
                        background: lit ? '#FDE68A' : 'rgba(253,230,138,0.18)',
                        boxShadow: lit ? '0 0 4px rgba(253,230,138,0.9)' : 'none',
                        borderRadius: 0,
                      }} />
                    )
                  })}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="text-right">
          <div className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 2 }}>BEST</div>
          <div className="font-pixel" style={{ fontSize: 22, color: '#FDE68A', textShadow: '2px 2px 0 #2E0F5C', letterSpacing: 1 }}>{bestScore}</div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 pb-2 select-none">
        <div key={`shake-wrap-${gridShake}`} style={{
          animation: gridShake > 0 ? 'pdGridShake 0.28s steps(6, end)' : undefined,
        }}>
        <div ref={gridRef}
          className="relative"
          style={{
            width: GRID_PX,
            height: GRID_PX,
            background: 'linear-gradient(135deg, #1F0F3A 0%, #15081E 100%)',
            border: '3px solid #4C1D95',
            borderRadius: 6,
            boxShadow: '0 4px 0 #2E0F5C, inset 0 1px 0 rgba(255,255,255,0.05), 0 0 28px rgba(167,139,250,0.3)',
          }}>
          {/* Cell grid */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const r = Math.floor(i / GRID_SIZE)
            const c = i % GRID_SIZE
            const cell = grid[r][c]
            const isPreview = previewSet.has(`${r},${c}`)
            return (
              <div key={i} className="absolute"
                style={{
                  left: c * (CELL_PX + CELL_GAP),
                  top:  r * (CELL_PX + CELL_GAP),
                  width: CELL_PX, height: CELL_PX,
                  borderRadius: 4,
                  background: cell
                    ? `linear-gradient(135deg, ${cell.color.light}, ${cell.color.main})`
                    : isPreview
                      ? 'rgba(255,255,255,0.16)'
                      : 'rgba(255,255,255,0.04)',
                  border: cell ? `2px solid ${cell.color.dark}` : isPreview ? '1.5px solid rgba(255,255,255,0.5)' : '1px solid rgba(167,139,250,0.18)',
                  boxShadow: cell
                    ? 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.25), 0 1px 0 rgba(0,0,0,0.3)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  // Clearing animation: scale + fade. Reduced-motion gets a
                  // plain fade-out instead of the rainbow hue-cycle spin.
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
              background: 'rgba(251,191,36,0.55)',
              boxShadow: '0 0 6px rgba(251,191,36,0.5)',
              zIndex: 2,
            }} />
          ))}
          {[1, 2].map(i => (
            <div key={`v-${i}`} className="absolute pointer-events-none" style={{
              top: 0, bottom: 0,
              left: i * SUB_SIZE * (CELL_PX + CELL_GAP) - CELL_GAP - 0.5,
              width: 2,
              background: 'rgba(251,191,36,0.55)',
              boxShadow: '0 0 6px rgba(251,191,36,0.5)',
              zIndex: 2,
            }} />
          ))}

          {/* Tiny gold rivet corners on the grid frame */}
          <div style={{ position: 'absolute', top: 4, left: 4, width: 4, height: 4, background: '#FBBF24' }} />
          <div style={{ position: 'absolute', top: 4, right: 4, width: 4, height: 4, background: '#FBBF24' }} />
          <div style={{ position: 'absolute', bottom: 4, left: 4, width: 4, height: 4, background: '#FBBF24' }} />
          <div style={{ position: 'absolute', bottom: 4, right: 4, width: 4, height: 4, background: '#FBBF24' }} />

          {/* Invalid-drop red border pulse — re-keyed off gridShake so
              it co-fires with the wrapper shake. Sits above cells but
              below particles/flash. */}
          {gridShake > 0 && (
            <div key={`red-${gridShake}`} className="absolute inset-0 pointer-events-none" style={{
              border: '3px solid #F87171',
              borderRadius: 6,
              boxShadow: 'inset 0 0 18px rgba(248,113,113,0.55)',
              animation: 'pdRedPulse 0.32s ease-out forwards',
              zIndex: 7,
            }} />
          )}

          {/* Cleared-cell particles — small pixel squares radiating
              outward with gravity. Coloured by their source cell's
              palette `main` so a row of mixed colours fireworks in
              its own hues. */}
          {particles.map(p => (
            <div key={p.id} className="absolute pointer-events-none" style={{
              left: p.x - 2, top: p.y - 2,
              width: 4, height: 4,
              background: p.color,
              boxShadow: `1px 1px 0 rgba(0,0,0,0.4), 0 0 4px ${p.color}`,
              imageRendering: 'pixelated',
              // CSS custom properties so the keyframe can read the per-particle vector
              ['--pdx' as keyof React.CSSProperties as string]: `${p.dx}px`,
              ['--pdy' as keyof React.CSSProperties as string]: `${p.dy}px`,
              animation: 'pdParticle 0.6s cubic-bezier(0.16,0.7,0.4,1) forwards',
              zIndex: 8,
            } as React.CSSProperties} />
          ))}

          {/* Grid-wide clear effects — re-keyed on every clear so the
              animations re-fire for back-to-back placements. Three
              layered effects: a hue-cycling radial wash, an expanding
              shockwave ring, and a counter-rotating second wash for
              extra chaos. */}
          {gridFlash > 0 && (
            <>
              <div key={`flash-${gridFlash}`} className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at center, rgba(253,230,138,0.65) 0%, rgba(244,114,182,0.32) 40%, transparent 75%)',
                animation: 'pdGridFlash 0.55s ease-out forwards',
                zIndex: 5,
                borderRadius: 6,
                mixBlendMode: 'screen',
              }} />
              <div key={`flash2-${gridFlash}`} className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.5) 0%, rgba(96,165,250,0.2) 40%, transparent 80%)',
                animation: 'pdGridFlash2 0.55s ease-out forwards',
                zIndex: 5,
                borderRadius: 6,
                mixBlendMode: 'screen',
              }} />
              <div key={`shock-${gridFlash}`} className="absolute pointer-events-none" style={{
                left: '50%', top: '50%',
                transform: 'translate(-50%, -50%)',
                animation: 'pdShockwave 0.55s ease-out forwards',
                zIndex: 6,
                borderRadius: '50%',
              }} />
            </>
          )}
        </div>
        </div>

        {/* Floater */}
        {floater && (
          <div className="font-pixel pointer-events-none absolute" style={{
            top: '52%',
            transform: 'translateY(-50%)',
            fontSize: 12, color: floater.color,
            letterSpacing: 1.5,
            textShadow: '2px 2px 0 rgba(0,0,0,0.6), 0 0 10px rgba(255,255,255,0.4)',
            animation: 'pdFloater 0.9s ease-out forwards',
            zIndex: 5,
          }}>
            {floater.text}
          </div>
        )}
      </div>

      {/* Tray — pointerDown sits on the WHOLE slot div so the player can
          tap anywhere in the 1/3-screen-wide cell, not just on a filled
          pixel of the small block sprite. Big mobile-friendly grab zone. */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2 flex items-center justify-around" style={{ minHeight: 120 }}>
        {tray.map((block, idx) => (
          <div key={idx}
            onPointerDown={block ? e => handleBlockPointerDown(e, idx) : undefined}
            className="flex items-center justify-center relative"
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
                border: '2px dashed rgba(167,139,250,0.25)',
                borderRadius: 4,
                opacity: 0.7,
              }} />
            )}
            {block && (
              <div
                key={`tray-${idx}-${trayRefillKey}-${block.id}`}
                style={{
                  opacity: draggedIdx === idx ? 0.25 : 1,
                  transition: 'opacity 0.15s, transform 0.15s',
                  transform: draggedIdx === idx ? 'scale(0.9)' : 'scale(1)',
                  filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.4))',
                  pointerEvents: 'none',
                  animation: `pdTrayRefill 0.32s cubic-bezier(0.34,1.56,0.64,1) ${idx * 60}ms both`,
                }}>
                <BlockSprite shape={block.shape} color={block.color} cellSize={TRAY_CELL_PX} cellGap={TRAY_CELL_GAP} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating drag ghost — fixed-position, follows pointer */}
      {draggedBlock && draggedBox && (
        <div className="fixed pointer-events-none z-50" style={{
          left: dragPos.x - (draggedBox.cols * CELL_PX + (draggedBox.cols - 1) * CELL_GAP) / 2,
          top:  dragPos.y - (draggedBox.rows * CELL_PX + (draggedBox.rows - 1) * CELL_GAP) - DRAG_LIFT,
          filter: previewCell ? 'drop-shadow(0 6px 0 rgba(0,0,0,0.4))' : 'drop-shadow(0 0 12px rgba(248,113,113,0.6))',
          opacity: 0.95,
        }}>
          <BlockSprite shape={draggedBlock.shape} color={draggedBlock.color} cellSize={CELL_PX} cellGap={CELL_GAP} />
        </div>
      )}

      {/* Idle modal */}
      {phase === 'idle' && (
        // pointer-events-none on the full-screen root so this idle overlay
        // (absolute inset-0, z-10) doesn't sit on top of the header's back
        // button and swallow taps. The START button re-enables pointer events.
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4 pointer-events-none">
          <div className="px-6 py-5 flex flex-col items-center gap-3 pointer-events-auto"
            style={{ background: 'rgba(15,10,30,0.92)', border: '3px solid #A78BFA', borderRadius: 6, boxShadow: '0 4px 0 #4C1D95, 0 0 30px rgba(167,139,250,0.5)' }}>
            <p className="font-pixel" style={{ fontSize: 11, letterSpacing: 2.5, color: '#FDE68A',
              filter: 'drop-shadow(0 0 6px rgba(253,230,138,0.5))' }}>PAW DOKU</p>
            <div className="font-pixel text-center" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 1, lineHeight: 1.8 }}>
              <p>DRAG BLOCKS ONTO THE GRID</p>
              <p>FILL A ROW · COL · OR 3X3 BLOCK</p>
              <p style={{ color: '#FBBF24' }}>MULTI-CLEARS = COMBO BONUS</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
                border: '2px solid #4C1D95',
                borderRadius: 3,
                boxShadow: '0 4px 0 #4C1D95',
                fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5,
              }}>
              <IconSparkles size={12} /> START
            </button>
          </div>
        </div>
      )}

      {/* Game over — full-screen red vignette + panel pop. Vignette is a
          radial-gradient overlay that fades over 600ms, timed with the
          panel mount so "NO MOVES LEFT" reads as catastrophic. */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
          {vignette > 0 && (
            <div key={`vig-${vignette}`} className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(220,38,38,0.55) 100%)',
              animation: 'pdVignette 0.6s ease-out forwards',
              mixBlendMode: 'multiply',
            }} />
          )}
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{
              background: 'linear-gradient(180deg, #15122A 0%, #0F0A1E 100%)',
              border: '3px solid #4F46E5',
              borderRadius: 6,
              boxShadow: '0 6px 0 #1E1B4B, 0 0 30px rgba(79,70,229,0.5)',
              animation: 'pdPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 3 }}>NO MOVES LEFT</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#A3F0C0', letterSpacing: 1 }}>SCORE</span>
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{displayScore}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
              </div>
            </div>
            {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => { playSound('ui_tap'); startGame() }}
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
        @keyframes pdPop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes pdCombo {
          0%   { transform: scale(0.6); opacity: 0; }
          50%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes pdFloater {
          0%   { opacity: 0; transform: translateY(0)   scale(0.8); }
          25%  { opacity: 1; transform: translateY(-6px) scale(1.1); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.95); }
        }
        /* Cell destruction — over-the-top. Cells flash to ultra-bright,
           hue-cycle through the entire spectrum, scale up to 1.55× while
           rotating ±18°, then collapse to scale-0 with a 5-px blur and a
           45° spin. With six possible block colours this looks like a
           rainbow firework when a row clears. */
        @keyframes pdClear {
          0%   { transform: scale(1)    rotate(0deg);   opacity: 1;    filter: brightness(1.0) hue-rotate(0deg)   blur(0); }
          18%  { transform: scale(1.45) rotate(-14deg); opacity: 1;    filter: brightness(3.0) hue-rotate(60deg)  blur(0); }
          40%  { transform: scale(1.55) rotate(18deg);  opacity: 1;    filter: brightness(2.8) hue-rotate(180deg) blur(1px); }
          65%  { transform: scale(1.05) rotate(-10deg); opacity: 0.7;  filter: brightness(2.4) hue-rotate(280deg) blur(3px); }
          100% { transform: scale(0)    rotate(45deg);  opacity: 0;    filter: brightness(4.0) hue-rotate(360deg) blur(5px); }
        }
        /* Reduced-motion clear: a plain collapse + fade, no hue-cycle,
           no spin, no blur — keeps the meaning-bearing "cell cleared"
           cue without the spectacle. */
        @keyframes pdClearReduced {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.6); opacity: 0; }
        }
        /* Primary grid-wide flash — gold/pink wash that hue-cycles. */
        @keyframes pdGridFlash {
          0%   { opacity: 0;   transform: scale(0.86); filter: hue-rotate(0deg)   brightness(1); }
          22%  { opacity: 1;   transform: scale(1.06); filter: hue-rotate(60deg)  brightness(1.6); }
          55%  { opacity: 0.7; transform: scale(1.14); filter: hue-rotate(200deg) brightness(1.7); }
          100% { opacity: 0;   transform: scale(1.28); filter: hue-rotate(360deg) brightness(2); }
        }
        /* Counter-rotating second flash for layered chaos */
        @keyframes pdGridFlash2 {
          0%   { opacity: 0;   transform: scale(1.20) rotate(0deg);    }
          30%  { opacity: 0.8; transform: scale(1.04) rotate(-15deg);  }
          70%  { opacity: 0.4; transform: scale(0.98) rotate(10deg);   }
          100% { opacity: 0;   transform: scale(0.85) rotate(-5deg);   }
        }
        /* Expanding shockwave ring radiating from the centre of the grid */
        @keyframes pdShockwave {
          0%   { width: 0;     height: 0;     opacity: 1;
                 border: 4px solid rgba(255,215,0,0.9);
                 box-shadow: 0 0 24px rgba(255,215,0,0.7), inset 0 0 12px rgba(255,255,255,0.6); }
          60%  { width: 280px; height: 280px; opacity: 0.65;
                 border: 3px solid rgba(244,114,182,0.7);
                 box-shadow: 0 0 32px rgba(244,114,182,0.5), inset 0 0 8px rgba(255,255,255,0.3); }
          100% { width: 460px; height: 460px; opacity: 0;
                 border: 1px solid rgba(167,139,250,0.0);
                 box-shadow: 0 0 0 rgba(167,139,250,0.0); }
        }
        /* Streak HUD pill bounce-in */
        @keyframes pdStreak {
          0%   { transform: scale(0.6) rotate(-4deg); opacity: 0; }
          45%  { transform: scale(1.25) rotate(3deg); opacity: 1; }
          100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
        }
        /* SCORE digits pulse on increment — quick scale + gold textShadow
           flare so a big combo gain visually pops vs a small placement. */
        @keyframes pdScorePulse {
          0%   { transform: scale(1);    text-shadow: 2px 2px 0 #2E0F5C; color: #FFFFFF; }
          40%  { transform: scale(1.25); text-shadow: 2px 2px 0 #2E0F5C, 0 0 12px rgba(253,230,138,0.95); color: #FDE68A; }
          100% { transform: scale(1);    text-shadow: 2px 2px 0 #2E0F5C; color: #FFFFFF; }
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
          100% { transform: translate(var(--pdx, 0), calc(var(--pdy, 0) + 40px)) scale(0.4); opacity: 0; }
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
      {/* keep imports referenced */}
      <span style={{ display: 'none' }}><IconStar size={1} /></span>
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
            background: `linear-gradient(135deg, ${color.light}, ${color.main})`,
            border: `${cellSize >= 30 ? 2 : 1.5}px solid ${color.dark}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.25)',
          }} />
        ) : null)
      )}
    </div>
  )
}
