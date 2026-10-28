const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const load = require('./lib/load_ts.cjs')()
const { readPuzzle, writePuzzle, clearPuzzle } = load('src/lib/puzzleSaves.ts')
const { M } = load('src/components/meadow/tokens.ts')
const storage = new Map()
global.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
const copy = v => JSON.parse(JSON.stringify(v))

// Run the actual page handlers without a DOM or any live account writes.
function handlers(file, names, env) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found = new Map()
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText(source))
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(source))) {
      found.set(node.name.getText(source), 'const ' + node.getText(source))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  names.forEach(name => assert.ok(found.has(name), `Missing ${name}`))
  const js = ts.transpileModule(names.map(name => found.get(name)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  return new Function('env', `with (env) { ${js}; return {${names.join(',')}} }`)(env)
}

function environment() {
  const pending = []
  const env = {
    M, user: { id: 'alice' }, readPuzzle, writePuzzle, clearPuzzle,
    timers: { jobs: [], setTimeout(fn) { this.jobs.push(fn) }, clearAll() { this.jobs = [] } },
    savedRef: { current: false }, scoreRef: { current: 0 },
    playSound() {}, rx: { good() {} }, reduced: true,
    flush() { while (pending.length) pending.shift()() },
  }
  for (const field of ['Grid', 'Tray', 'Score', 'DisplayScore', 'Combo', 'Streak', 'StreakMisses',
    'Phase', 'Reward', 'DraggedIdx', 'Particles', 'TrayRefillKey', 'ScorePulse', 'SavedGame',
    'Tubes', 'Solved', 'MovesLeft', 'UndosLeft', 'History', 'Selected', 'Celebrating',
    'LastRefill', 'PourFx', 'Notice', 'SolveFx']) {
    const key = field[0].toLowerCase() + field.slice(1)
    env['set' + field] = next => pending.push(() => { env[key] = typeof next === 'function' ? next(env[key] ?? 0) : next })
  }
  return env
}

const paw = environment()
Object.assign(paw, { GRID_SIZE: 9, SUB_SIZE: 3, STREAK_GRACE: 3, SCORE_PER_CELL: 10, SCORE_PER_LINE: 100,
  score: 0, streak: 0, streakMisses: 0, draggedIdx: 0, dragPosRef: { current: {} },
  hoverCell: () => ({ r: 0, c: 0 }), reactEren() {}, flashFloater() {},
})
const pd = handlers('src/app/(app)/games/paw-doku/page.tsx', [
  'SHAPES', 'PALETTES', 'makeEmptyGrid', 'gridCopy', 'shapeBox', 'canPlace', 'placeBlock',
  'findClearedLines', 'findClearedSubBlocks', 'markClearing', 'clearLines', 'clearSubBlocks',
  'canPlaceAnywhere', 'checkpoint', 'continueGame', 'startGame', 'handleDrop', 'afterPlace',
], paw)
let id = 0
paw._bid = 10
paw.nextTray = () => Array.from({ length: 3 }, () => ({ id: ++id, shape: [[1]], color: pd.PALETTES[0] }))
paw.grid = pd.makeEmptyGrid()
paw.tray = paw.nextTray()
pd.startGame()
paw.flush()
let saved = readPuzzle('paw_doku', 'alice')
assert.equal(saved.score, 0)
assert.equal(readPuzzle('paw_doku', 'bob'), null, 'Saves must not cross players')

// Complete a row, leave before the 280ms clear callback, then restore.
paw.grid[0] = [null, ...Array.from({ length: 8 }, () => ({ color: pd.PALETTES[3] }))]
paw.draggedIdx = 0
pd.handleDrop()
paw.flush()
saved = readPuzzle('paw_doku', 'alice')
assert.deepEqual(saved.grid[0], Array(9).fill(null), 'Checkpoint must already contain the cleared board')
assert.equal(saved.score, 110, 'Points must be saved before the clear animation completes')
assert.equal(saved.streak, 1)
assert.equal(saved.tray[0], null)
paw.resumable = saved
pd.continueGame()
paw.flush()
assert.equal(paw.phase, 'playing')
assert.equal(paw.score, 110)
assert.equal(paw.scoreRef.current, 110)
assert.equal(paw.grid[0].every(c => c === null), true)
assert.equal(paw.tray.filter(Boolean).length, 2)
assert.notEqual(paw.tray[1].id, paw.tray[2].id)
assert.equal(paw.timers.jobs.length, 0, 'Resume must cancel stale clear callbacks')

// Invalid data, future versions, malformed JSON and unavailable storage fail safely.
const key = 'eren:puzzle:v1:paw_doku:alice'
for (const bad of [{ ...saved, grid: [[]] }, { ...saved, tray: [null, null, null] },
  { ...saved, score: -1 }, { ...saved, tray: [{ shape: [[1], [1, 1]], color: 0 }, null, null] }]) {
  storage.set(key, JSON.stringify({ version: 1, data: bad }))
  assert.equal(readPuzzle('paw_doku', 'alice'), null)
}
storage.set(key, JSON.stringify({ version: 99, data: saved }))
assert.equal(readPuzzle('paw_doku', 'alice'), null)
storage.set(key, '{broken')
assert.equal(readPuzzle('paw_doku', 'alice'), null)

const yarn = environment()
Object.assign(yarn, { SEG: 4, EMPTIES: 2, START_MOVES: 30, REFILL_BASE: 7, UNDO_LIMIT: 3, LOW_MOVES: 6,
  COLORS: Array(8), solved: 0, movesLeft: 30, undosLeft: 3, history: [], phase: 'playing', celebrating: false,
  fxKey: { current: 0 }, stuck: false, scheduleEnd() { this.ended = true },
})
const ys = handlers('src/app/(app)/games/yarn-sort/page.tsx', [
  'colorsForLevel', 'refillForLevel', 'isSolved', 'applyPour', 'checkpoint',
  'continueGame', 'handleSolved', 'attemptPour', 'undo',
], yarn)
yarn.genLevel = (level = 1) => {
  const colors = ys.colorsForLevel(level)
  return [...Array.from({ length: colors }, (_, i) => Array.from({ length: 4 }, (_, j) => (i + j) % colors)), [], []]
}
yarn.tubes = yarn.genLevel()
const before = copy(yarn.tubes)
ys.attemptPour(0, 3)
yarn.flush()
saved = readPuzzle('yarn_sort', 'alice')
assert.equal(saved.movesLeft, 29)
assert.deepEqual(saved.history, [before])
yarn.resumable = saved
ys.continueGame()
yarn.flush()
assert.deepEqual(yarn.tubes, saved.tubes)
assert.equal(yarn.movesLeft, 29)
ys.undo()
yarn.flush()
saved = readPuzzle('yarn_sort', 'alice')
assert.deepEqual(saved.tubes, before)
assert.equal(saved.movesLeft, 30)
assert.equal(saved.undosLeft, 2)
assert.deepEqual(saved.history, [])

// Last pour of a level saves the next board before the celebration timeout.
yarn.tubes = [[0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [0], []]
ys.attemptPour(3, 0)
yarn.flush()
saved = readPuzzle('yarn_sort', 'alice')
assert.equal(saved.solved, 1)
assert.equal(saved.movesLeft, 39)
assert.deepEqual(saved.tubes, yarn.genLevel())
assert.equal(saved.history.length, 0)
assert.equal(yarn.celebrating, true)
const nextBoard = copy(saved.tubes)
yarn.timers.jobs.shift()()
yarn.flush()
assert.deepEqual(yarn.tubes, nextBoard, 'Visual next deal and saved next deal must be identical')

yarn.tubes = [[0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [0], []]
ys.attemptPour(3, 0)
yarn.flush()
saved = readPuzzle('yarn_sort', 'alice')
assert.equal(saved.solved, 2)
assert.equal(saved.tubes.length, 6, 'The saved next level must include its increased color count')
assert.equal(saved.movesLeft, 48)

ys.checkpoint({ ...saved, movesLeft: 0 })
assert.equal(readPuzzle('yarn_sort', 'alice'), null, 'Finished rounds must not offer Continue')
clearPuzzle('paw_doku', 'alice')
assert.equal(readPuzzle('paw_doku', 'alice'), null)
global.localStorage = { getItem() { throw Error('blocked') }, setItem() { throw Error('full') }, removeItem() { throw Error('blocked') } }
assert.equal(readPuzzle('yarn_sort', 'alice'), null)
assert.doesNotThrow(() => writePuzzle('paw_doku', 'alice', saved))
assert.doesNotThrow(() => clearPuzzle('yarn_sort', 'alice'))
console.log('Puzzle save checks passed: actual move/resume handlers, mid-clear and mid-celebration reload, undo, player isolation, invalid saves and blocked storage.')
