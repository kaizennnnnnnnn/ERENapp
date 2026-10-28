export interface SavedBlock { shape: number[][]; color: number }
export interface PawDokuSave {
  grid: (number | null)[][]
  tray: (SavedBlock | null)[]
  score: number
  streak: number
  streakMisses: number
}
export interface YarnSortSave {
  tubes: number[][]
  solved: number
  movesLeft: number
  undosLeft: number
  history: number[][][]
}

interface PuzzleSaves { paw_doku: PawDokuSave; yarn_sort: YarnSortSave }
type Puzzle = keyof PuzzleSaves
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const color = (v: unknown, max: number): v is number => count(v) && v < max

function validPaw(v: unknown): v is PawDokuSave {
  if (!record(v) || !count(v.score) || !count(v.streak) || !count(v.streakMisses) || v.streakMisses >= 3) return false
  if (!Array.isArray(v.grid) || v.grid.length !== 9 || !v.grid.every(row => Array.isArray(row)
    && row.length === 9 && row.every(c => c === null || color(c, 6)))) return false
  if (!Array.isArray(v.tray) || v.tray.length !== 3 || v.tray.every(b => b === null)) return false
  return v.tray.every(b => b === null || (record(b) && color(b.color, 6) && Array.isArray(b.shape)
    && b.shape.length > 0 && b.shape.length <= 5 && Array.isArray(b.shape[0])
    && b.shape[0].length > 0 && b.shape[0].length <= 5
    && b.shape.every(row => Array.isArray(row) && row.length === (b.shape as number[][])[0].length
      && row.every(c => c === 0 || c === 1))
    && b.shape.some(row => row.some((c: number) => c === 1))))
}

function validYarn(v: unknown): v is YarnSortSave {
  if (!record(v) || !count(v.solved) || !count(v.movesLeft) || v.movesLeft === 0
    || !count(v.undosLeft) || v.undosLeft > 3) return false
  const colors = Math.min(8, 3 + Math.floor(v.solved / 2))
  const board = (value: unknown): value is number[][] => {
    if (!Array.isArray(value) || value.length !== colors + 2) return false
    const counts = Array<number>(colors).fill(0)
    for (const tube of value) {
      if (!Array.isArray(tube) || tube.length > 4) return false
      for (const c of tube) {
        if (!color(c, colors)) return false
        counts[c]++
      }
    }
    return counts.every(n => n === 4)
  }
  return board(v.tubes) && !v.tubes.every(t => t.length === 0 || (t.length === 4 && t.every(c => c === t[0])))
    && Array.isArray(v.history) && v.history.length <= 5000 && v.history.every(board)
}

const validators = { paw_doku: validPaw, yarn_sort: validYarn }
const key = (game: Puzzle, userId: string) => `eren:puzzle:v1:${game}:${userId}`

/** Local to this browser and player; saved moves never claim coins or rewards. */
export function readPuzzle<G extends Puzzle>(game: G, userId: string): PuzzleSaves[G] | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key(game, userId)) ?? 'null')
    if (!record(saved) || saved.version !== 1 || !validators[game](saved.data)) return null
    return saved.data as PuzzleSaves[G]
  } catch { return null }
}

export function writePuzzle<G extends Puzzle>(game: G, userId: string, data: PuzzleSaves[G]): void {
  try { localStorage.setItem(key(game, userId), JSON.stringify({ version: 1, data })) }
  catch { /* Playing still works when browser storage is full or blocked. */ }
}

export function clearPuzzle(game: Puzzle, userId: string): void {
  try { localStorage.removeItem(key(game, userId)) }
  catch { /* Storage can be disabled by the browser. */ }
}
