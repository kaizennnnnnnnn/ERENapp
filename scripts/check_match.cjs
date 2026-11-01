const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const mocks = { 'next/link': ({ children, ...props }) => React.createElement('a', props, children) }
const load = require('./lib/load_ts.cjs')(mocks)
mocks['@/components/meadow'] = {
  ...load('src/components/meadow/tokens.ts'), ...load('src/components/meadow/Buttons.tsx'),
  ...load('src/components/meadow/Card.tsx'), ...load('src/components/meadow/Chips.tsx'),
  ...load('src/components/meadow/Display.tsx'), MeadowIcon: load('src/components/PixelIcons.tsx').MeadowIcon,
}
const { elements } = load('src/lib/chemistry/elements.ts')
const { grade, dateStr } = load('src/lib/chemistry/srs.ts')
const today = dateStr(), cardId = n => `el-${n}`
let active, api, rated, finished, missionSignals
mocks['@/lib/chemistry/store'] = { elementCardId: cardId, useChemistryStore: () => api }
mocks['@/lib/chemistry/missions'] = { useChemistryMissions: value => missionSignals.push(value) }
mocks['@/lib/sounds'] = { playSound() {} }
const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]))
mocks.react = {
  ...React,
  useState: initial => {
    const h = active, i = h.cursor++
    if (!h.slots[i]) h.slots[i] = { value: typeof initial === 'function' ? initial() : initial }
    return [h.slots[i].value, next => {
      const value = typeof next === 'function' ? next(h.slots[i].value) : next
      if (!Object.is(value, h.slots[i].value)) { h.slots[i].value = value; h.dirty = true }
    }]
  },
  useRef: current => { const h = active, i = h.cursor++; return (h.slots[i] ??= { current }) },
  useCallback: (callback, deps) => {
    const h = active, i = h.cursor++
    if (!h.slots[i] || changed(h.slots[i].deps, deps)) h.slots[i] = { deps, callback }
    return h.slots[i].callback
  },
  useEffect: (callback, deps) => {
    const h = active, i = h.cursor++, old = h.slots[i]
    if (!old || changed(old.deps, deps)) {
      h.slots[i] = { deps, cleanup: old?.cleanup }
      h.effects.push(() => { old?.cleanup?.(); h.slots[i].cleanup = callback() })
    }
  },
}
const { default: Match, pickPairs, makeRound } = load('src/components/chemistry/Match.tsx')
const allMastered = Object.fromEntries(elements.map(el => [cardId(el.atomicNumber), { box: 6, lastReviewed: '2099-01-01', reviews: 6, correct: 6, lapses: 0 }]))
const dueCards = Object.fromEntries(elements.slice(0, 6).map(el => [cardId(el.atomicNumber), grade(undefined, true, '2020-01-01')]))
assert.deepEqual(pickPairs(dueCards, today).map(el => el.atomicNumber), [1,2,3,4,5,6])
for (const cards of [{}, allMastered, dueCards]) {
  const els = pickPairs(cards, today), board = makeRound(els)
  assert.equal(els.length, 6)
  assert.equal(new Set(els.map(el => el.atomicNumber)).size, 6)
  assert.equal(board.length, 12)
  assert.equal(new Set(board.map(tile => tile.id)).size, 12)
  for (const el of els) assert.deepEqual(board.filter(tile => tile.element === el).map(tile => tile.kind).sort(), ['name', 'symbol'])
}
const priority = { ...allMastered, 'el-1': grade(undefined, true, '2020-01-03'), 'el-2': grade(undefined, true, '2020-01-01'), 'el-3': undefined, 'el-4': grade(undefined, true, today) }
assert.deepEqual(pickPairs(priority, today).slice(0, 4).map(el => el.atomicNumber), [2,1,3,4])
for (const el of elements) assert.equal(makeRound([el]).length, 2)

const native = { timeout: global.setTimeout, clearTimeout: global.clearTimeout, interval: global.setInterval, clearInterval: global.clearInterval, now: Date.now, document: global.document }
const timers = new Map(), intervals = new Map(), listeners = new Set()
let timerId = 0, now = 0
global.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id }
global.clearTimeout = id => timers.delete(id)
global.setInterval = (callback, delay) => { const id = ++timerId; intervals.set(id, { callback, delay }); return id }
global.clearInterval = id => intervals.delete(id)
Date.now = () => now
global.document = { visibilityState: 'visible', addEventListener(name, fn) { assert.equal(name, 'visibilitychange'); listeners.add(fn) }, removeEventListener(name, fn) { listeners.delete(fn) } }
function settle(delay) {
  assert.equal(timers.size, 1)
  const [id, timer] = timers.entries().next().value
  assert.equal(timer.delay, delay)
  timers.delete(id); now += delay; timer.callback()
}
function tick(ms) { now += ms; [...intervals.values()].forEach(timer => timer.callback()) }
function harness(cards = dueCards, hydrated = true) {
  assert.equal(timers.size + intervals.size + listeners.size, 0, 'Previous game must clean up')
  rated = []; finished = []; missionSignals = []; now = 0
  api = { hydrated, today, state: { cards: { ...cards }, streak: { current: 0 } },
    rateCard(id, right) { rated.push([id, right]); api.state.cards = { ...api.state.cards, [id]: grade(api.state.cards[id], right, today) } },
    finishDeck(best) { finished.push(best); api.state.streak.current = 1 },
  }
  const h = { slots: [], effects: [], cursor: 0, dirty: false, tree: null }
  h.render = () => {
    for (let n = 0; n < 20; n++) {
      active = h; h.cursor = 0; h.dirty = false; h.tree = Match()
      h.effects.splice(0).forEach(run => run())
      if (!h.dirty) return h.tree
    }
    assert.fail('Effects must settle')
  }
  h.unmount = () => h.slots.forEach(slot => slot.cleanup?.())
  return h
}
function findAll(tree, predicate) {
  if (!React.isValidElement(tree)) return []
  if (tree.type.name === 'Summary') return findAll(tree.type(tree.props), predicate)
  return [...(predicate(tree) ? [tree] : []), ...React.Children.toArray(tree.props.children).flatMap(child => findAll(child, predicate))]
}
const button = (h, label) => findAll(h.tree, node => node.props.children === label && typeof node.props.onClick === 'function')[0]
const tiles = h => findAll(h.tree, node => /^(Symbol|Name): /.test(node.props.ariaLabel ?? ''))
const html = h => renderToStaticMarkup(h.tree)
const board = h => h.slots[0].value
function pair(h, el) {
  const a = tiles(h).find(tile => tile.props.ariaLabel === `Symbol: ${el.symbol}`)
  const b = tiles(h).find(tile => tile.props.ariaLabel === `Name: ${el.name}`)
  assert.ok(a && b)
  a.props.onClick(); a.props.onClick()
  b.props.onClick(); b.props.onClick()
  h.render()
}
try {
  let h = harness({}, false); h.render()
  assert.match(html(h), /Getting your pairs/)
  assert.equal(tiles(h).length, 0)
  api.hydrated = true; h.render()
  assert.equal(tiles(h).length, 12)
  assert.ok(tiles(h).every(tile => tile.props.disabled))
  const initial = board(h)
  tiles(h)[0].props.onClick(); h.render()
  assert.equal(rated.length, 0)
  tick(90000); h.render()
  assert.equal(h.slots[4].value, 60, 'Clock must not start until Start is pressed')
  button(h, 'Start').props.onClick(); button(h, 'Start').props.onClick(); h.render()
  assert.equal(board(h), initial, 'Starting must retain the board the player saw')
  assert.equal(intervals.size, 1)
  assert.ok(tiles(h).every(tile => !tile.props.disabled))
  tick(12300); h.render()
  assert.equal(h.slots[4].value, 48, 'Use real elapsed time rather than counting interval callbacks')
  h.unmount()

  h = harness(); h.render(); button(h, 'Start').props.onClick(); h.render()
  const a = tiles(h).find(tile => tile.props.ariaLabel === 'Symbol: H')
  const b = tiles(h).find(tile => tile.props.ariaLabel === 'Name: Helium')
  a.props.onClick(); h.render()
  assert.match(html(h), /aria-pressed="true"/)
  b.props.onClick(); h.render()
  assert.equal(rated.length, 0, 'Mismatch must not downgrade either element')
  assert.ok(tiles(h).every(tile => tile.props.disabled))
  assert.match(html(h), /Not a match/)
  const blocked = tiles(h)[0].props.onClick
  blocked(); blocked(); h.render()
  assert.equal(rated.length, 0)
  settle(650); h.render()
  assert.ok(tiles(h).every(tile => !tile.props.disabled))
  const originalBoard = board(h)
  for (const el of elements.slice(0, 6)) pair(h, el)
  assert.equal(rated.length, 6, 'One rating per pair despite same-tick duplicate taps')
  assert.ok(rated.every(([, right]) => right))
  assert.equal(board(h), originalBoard)
  assert.equal(h.slots[5].value, 6)
  assert.equal(h.slots[6].value, 6)
  assert.ok(tiles(h).every(tile => tile.props.disabled))
  settle(200); h.render()
  assert.notEqual(board(h), originalBoard)
  assert.ok(board(h).every(tile => tile.element.atomicNumber > 6), 'Rollover must use the latest graded study pool')
  assert.equal(h.slots[5].value, 6)
  assert.equal(h.slots[6].value, 6)
  assert.ok(tiles(h).every(tile => !tile.props.disabled))
  assert.equal(intervals.size, 1, 'A new board must not restart the timer')
  tick(50000); h.render()
  assert.equal(h.slots[4].value, 10)
  assert.match(html(h), /background:#FBEAE7/)
  now += 10000
  const late = tiles(h)[0].props.onClick
  late(); late(); h.render()
  assert.equal(rated.length, 6, 'A late click must end the game before grading')
  assert.deepEqual(finished, [6])
  assert.match(html(h), /Match results/)
  assert.match(html(h), /6<\/p>/)
  h.render(); assert.deepEqual(finished, [6])
  assert.equal(intervals.size + timers.size + listeners.size, 0)
  assert.ok(missionSignals.some(signal => signal.streak >= 5))
  assert.ok(missionSignals.some(signal => signal.done))
  button(h, 'Play again').props.onClick(); h.render()
  assert.equal(h.slots[4].value, 60)
  assert.equal(h.slots[5].value, 0)
  assert.equal(h.slots[6].value, 0)
  assert.equal(intervals.size, 1)
  now += 61000; [...listeners].forEach(fn => fn()); h.render()
  assert.deepEqual(finished, [6, 0], 'Visibility resume must finish exactly once after the deadline')
  h.unmount()

  h = harness(); h.render(); button(h, 'Start').props.onClick(); h.render()
  for (const el of elements.slice(0, 6)) pair(h, el)
  assert.equal(timers.size, 1)
  tick(60000); h.render()
  assert.equal(timers.size, 0, 'Expiration must cancel a queued board replacement')
  assert.deepEqual(finished, [6])
  h.unmount()

  h = harness(); h.render(); button(h, 'Start').props.onClick(); h.render()
  tiles(h).find(tile => tile.props.ariaLabel === 'Symbol: H').props.onClick(); h.render()
  tiles(h).find(tile => tile.props.ariaLabel === 'Name: Helium').props.onClick(); h.render()
  assert.equal(timers.size, 1)
  h.unmount()
  assert.equal(timers.size + intervals.size + listeners.size, 0, 'Leaving must cancel feedback, countdown and visibility listener')

  h = harness(); h.render(); button(h, 'Start').props.onClick(); h.render()
  pair(h, elements[0])
  tiles(h).find(tile => tile.props.ariaLabel === 'Symbol: He').props.onClick(); h.render()
  tiles(h).find(tile => tile.props.ariaLabel === 'Name: Lithium').props.onClick(); h.render()
  assert.equal(h.slots[6].value, 0, 'A mismatch breaks the current streak')
  assert.equal(h.slots[7].value, 1, 'A mismatch retains the best streak')
  tick(60000); h.render()
  assert.deepEqual(finished, [1])
  assert.equal(timers.size, 0, 'Expiration must cancel mismatch recovery')
  h.unmount()

  h = harness(); h.render(); button(h, 'Start').props.onClick(); h.render()
  for (let round = 0; round < 3; round++) {
    const els = [...new Map(board(h).map(tile => [tile.element.atomicNumber, tile.element])).values()]
    for (const el of els) pair(h, el)
    settle(200); h.render()
  }
  tick(60000); h.render()
  assert.equal(rated.length, 18)
  assert.deepEqual(finished, [18])
  assert.match(html(h), /Great run/)
  h.unmount()

  h = harness(allMastered); h.render()
  assert.equal(tiles(h).length, 12, 'A mastered catalogue still allows practice')
  assert.match(html(h), /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(html(h), /neoShadow|linear-gradient|Press Start|font-pixel/)
  h.unmount()
} finally {
  global.setTimeout = native.timeout; global.clearTimeout = native.clearTimeout
  global.setInterval = native.interval; global.clearInterval = native.clearInterval
  Date.now = native.now
  if (native.document === undefined) delete global.document; else global.document = native.document
}
console.log('Match checks passed: six unique pairs, study priority/fallback, hydration, explicit start, rapid taps, mismatch recovery, single grading, fresh-board rollover, deadline timing, late input, visibility resume, single completion, restart and timer cleanup.')
