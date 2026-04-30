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
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'
import { IconStar, IconSparkles } from '@/components/PixelIcons'

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
// entire sub-block in one move). The 1×1 single is duplicated three times
// so it spawns more often (it's the most useful "rescue" piece for filling
// awkward gaps). The 2×2 square is the biggest pure square here.
const SHAPES: number[][][] = [
  // Singles (weighted higher — 3 entries)
  [[1]],
  [[1]],
  [[1]],
  // Lines
  [[1,1]], [[1],[1]],
  [[1,1,1]], [[1],[1],[1]],
  [[1,1,1,1]], [[1],[1],[1],[1]],
  [[1,1,1,1,1]], [[1],[1],[1],[1],[1]],
  // Squares (only 2×2 — 3×3 was removed per design)
  [[1,1],[1,1]],
  // L / J corners (small)
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
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [phase,     setPhase]     = useState<Phase>('idle')
  const [grid,      setGrid]      = useState<Grid>(makeEmptyGrid)
  const [tray,      setTray]      = useState<(Block | null)[]>(() => [null, null, null])
  const [score,     setScore]     = useState(0)
  const [bestScore, setBest]      = useState(0)
  const [combo,     setCombo]     = useState(0)
  const [floater,   setFloater]   = useState<{ id: number; text: string; color: string } | null>(null)
  const savedRef = useRef(false)

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
    setGrid(makeEmptyGrid())
    setTray(nextTray())
    setScore(0)
    setCombo(0)
    setPhase('playing')
    savedRef.current = false
    setDraggedIdx(null)
  }

  function endGame() {
    setPhase('gameover')
    setBest(b => Math.max(b, score))
    if (!savedRef.current && user?.id && score > 0) {
      savedRef.current = true
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'paw_doku', score })
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('paw_doku save:', error) })
      addCoins(Math.min(80, Math.floor(score / 60)))
      completeTask('daily_game')
      if (score >= 1500) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function handleBlockPointerDown(e: React.PointerEvent, idx: number) {
    if (phase !== 'playing') return
    if (!tray[idx]) return
    e.preventDefault()
    setDraggedIdx(idx)
    setDragPos({ x: e.clientX, y: e.clientY })
    dragPosRef.current = { x: e.clientX, y: e.clientY }
  }

  function flashFloater(text: string, color: string) {
    const id = ++_bid
    setFloater({ id, text, color })
    setTimeout(() => setFloater(f => f && f.id === id ? null : f), 900)
  }

  function handleDrop() {
    if (draggedIdx === null) { setDraggedIdx(null); return }
    const block = tray[draggedIdx]
    if (!block) { setDraggedIdx(null); return }
    // Use the ref so we read the LATEST pointer position, not a stale
    // closure value from when the window listener was registered.
    const target = hoverCell(dragPosRef.current)
    if (!target || !canPlace(grid, block.shape, target.r, target.c)) {
      // Bounce back
      setDraggedIdx(null)
      playSound('ui_modal_open')
      return
    }

    // Place
    let g = placeBlock(grid, block, target.r, target.c)
    const placedCells = shapeBox(block.shape).cells
    let gained = placedCells * SCORE_PER_CELL
    playSound('ui_modal_close')

    // Detect every kind of clear: full rows, full columns, full 3×3
    // sub-blocks. They're all batched and counted together for combo.
    const { rows, cols } = findClearedLines(g)
    const subs = findClearedSubBlocks(g)
    const totalClears = rows.length + cols.length + subs.length

    if (totalClears > 0) {
      // Show clearing flash, then nuke the cells next frame
      g = markClearing(g, rows, cols, subs)
      setGrid(g)
      // Score: base + escalating bonus per simultaneous clear
      const lineBonus = totalClears * SCORE_PER_LINE
      const comboMult = totalClears >= 2 ? totalClears : 1
      gained += lineBonus * comboMult
      setCombo(totalClears)
      setTimeout(() => setCombo(0), 850)

      flashFloater(
        totalClears >= 2 ? `${gained}  COMBO x${totalClears}!` : `+${gained}`,
        totalClears >= 3 ? '#FBBF24' : totalClears === 2 ? '#FBCFE8' : '#A3F0C0'
      )

      setTimeout(() => {
        let cleared = clearLines(g, rows, cols)
        cleared = clearSubBlocks(cleared, subs)
        setGrid(cleared)
        afterPlace(cleared, draggedIdx, gained)
      }, 280)
    } else {
      setGrid(g)
      flashFloater(`+${gained}`, '#A3F0C0')
      afterPlace(g, draggedIdx, gained)
    }
  }

  function afterPlace(latestGrid: Grid, idx: number, gained: number) {
    setScore(s => s + gained)

    // Strip the placed block from the tray; if every slot is now empty,
    // refill from a fresh batch of three.
    const stripped = [...tray]
    stripped[idx] = null
    const next = stripped.every(b => b === null) ? nextTray() : stripped
    setTray(next)
    setDraggedIdx(null)

    // Game-over check runs against the FINAL post-clear grid + the FINAL
    // tray (post-strip / post-refill). We do it inline here instead of
    // reactively in a useEffect to avoid intermediate-state false
    // positives during the line-clear timeout.
    const remaining = next.filter(b => b !== null) as Block[]
    if (remaining.length > 0 && remaining.every(b => !canPlaceAnywhere(latestGrid, b.shape))) {
      setTimeout(endGame, 280)
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
          <div className="font-pixel" style={{ fontSize: 22, color: '#FFFFFF', textShadow: '2px 2px 0 #2E0F5C', letterSpacing: 1 }}>{score}</div>
        </div>
        {combo > 1 && (
          <div className="font-pixel" style={{
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
        <div className="text-right">
          <div className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 2 }}>BEST</div>
          <div className="font-pixel" style={{ fontSize: 22, color: '#FDE68A', textShadow: '2px 2px 0 #2E0F5C', letterSpacing: 1 }}>{bestScore}</div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 pb-2 select-none">
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
                  // Clearing animation: scale + fade
                  animation: cell?.clearing ? 'pdClear 0.28s ease-out forwards' : undefined,
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

      {/* Tray */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2 flex items-center justify-around" style={{ minHeight: 120 }}>
        {tray.map((block, idx) => (
          <div key={idx} className="flex items-center justify-center"
            style={{ flex: 1, minHeight: 110 }}>
            {block && (
              <div onPointerDown={e => handleBlockPointerDown(e, idx)}
                className="cursor-grab"
                style={{
                  touchAction: 'none',
                  opacity: draggedIdx === idx ? 0.25 : 1,
                  transition: 'opacity 0.15s, transform 0.15s',
                  transform: draggedIdx === idx ? 'scale(0.9)' : 'scale(1)',
                  filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.4))',
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
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="px-6 py-5 flex flex-col items-center gap-3"
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

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
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
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{score}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#3A2A60' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
              </div>
            </div>
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
        @keyframes pdClear {
          0%   { transform: scale(1);    opacity: 1; filter: brightness(1.0); }
          40%  { transform: scale(1.18); opacity: 1; filter: brightness(1.6); }
          100% { transform: scale(0);    opacity: 0; filter: brightness(2.0); }
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
