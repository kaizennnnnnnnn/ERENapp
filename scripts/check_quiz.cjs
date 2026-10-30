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
const today = dateStr()
const cardId = n => `el-${n}`
let active, api, rated, finished, missionSignals
mocks['@/lib/chemistry/store'] = { elementCardId: cardId, useChemistryStore: () => api }
mocks['@/lib/chemistry/missions'] = { useChemistryMissions: signal => missionSignals.push(signal) }
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
  useEffect: (callback, deps) => {
    const h = active, i = h.cursor++, old = h.slots[i]
    if (!old || changed(old.deps, deps)) {
      h.slots[i] = { deps, cleanup: old?.cleanup }
      h.effects.push(() => { old?.cleanup?.(); h.slots[i].cleanup = callback() })
    }
  },
}
const { default: Quiz, pickQueue, makeQuestion } = load('src/components/chemistry/Quiz.tsx')
const allMastered = Object.fromEntries(elements.map(el => [cardId(el.atomicNumber), { box: 6, lastReviewed: '2099-01-01', reviews: 6, correct: 6, lapses: 0 }]))
const dueCards = { 'el-1': grade(undefined, true, '2020-01-03'), 'el-2': grade(undefined, true, '2020-01-01'), 'el-3': grade(undefined, true, '2020-01-02') }
assert.equal(pickQueue({}, today).length, 10)
assert.equal(new Set(pickQueue({}, today).map(el => el.atomicNumber)).size, 10)
assert.deepEqual(pickQueue(dueCards, today).slice(0, 3).map(el => el.atomicNumber), [2, 3, 1])
assert.deepEqual(pickQueue(allMastered, today), [])
const learning = { ...allMastered, 'el-1': { ...grade(undefined, true, today), box: 3 }, 'el-2': grade(undefined, true, today) }
assert.deepEqual(pickQueue(learning, today).map(el => el.atomicNumber), [2, 1])
const manyDue = Object.fromEntries(elements.slice(0, 14).map(el => [cardId(el.atomicNumber), grade(undefined, true, '2020-01-01')]))
assert.deepEqual(pickQueue(manyDue, today).map(el => el.atomicNumber), [1,2,3,4,5,6,7,8,9,10])
const random = Math.random
try {
  for (const [value, type] of [[0.01, 'name-from-symbol'], [0.99, 'symbol-from-name']]) {
    Math.random = () => value
    for (const el of elements) {
      const q = makeQuestion(el)
      assert.equal(q.type, type)
      assert.equal(q.options.length, 4)
      assert.equal(new Set(q.options).size, 4)
      assert.equal(q.options[q.correctIdx], type === 'name-from-symbol' ? el.name : el.symbol)
    }
  }
} finally { Math.random = random }

const timers = new Map()
let timerId = 0
const nativeTimeout = global.setTimeout, nativeClear = global.clearTimeout
global.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id }
global.clearTimeout = id => timers.delete(id)
function tick() {
  assert.equal(timers.size, 1, 'One answer schedules exactly one advance')
  const [id, timer] = timers.entries().next().value
  assert.equal(timer.delay, 1000, 'Keep the existing one-second feedback')
  timers.delete(id); timer.callback()
}
function harness(cards = dueCards, hydrated = true) {
  assert.equal(timers.size, 0)
  rated = []; finished = []; missionSignals = []
  api = { hydrated, today, state: { cards: { ...cards }, streak: { current: 0 } },
    rateCard(id, right) { rated.push([id, right]); api.state.cards = { ...api.state.cards, [id]: grade(api.state.cards[id], right, today) } },
    finishDeck(best) { finished.push(best); api.state.streak.current = 1 },
  }
  const h = { slots: [], effects: [], cursor: 0, dirty: false, tree: null }
  h.render = () => {
    for (let n = 0; n < 20; n++) {
      active = h; h.cursor = 0; h.dirty = false; h.tree = Quiz()
      h.effects.splice(0).forEach(run => run())
      if (!h.dirty) return h.tree
    }
    assert.fail('Effects must settle, including the empty-queue case')
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
const options = h => findAll(h.tree, node => /^[A-D]\. /.test(node.props.ariaLabel ?? ''))
const html = h => renderToStaticMarkup(h.tree)
const current = h => h.slots[0].value[h.slots[1].value]
function answer(h, right) {
  const q = current(h), index = right ? q.correctIdx : (q.correctIdx + 1) % 4
  const pick = options(h)[index].props.onClick
  pick(); pick(); h.render()
  assert.equal(options(h).every(option => option.props.disabled), true)
  assert.match(html(h), /correct answer/)
  tick(); h.render()
}
try {
  let h = harness({}, false); h.render()
  assert.match(html(h), /Getting your quiz/)
  assert.equal(options(h).length, 0)
  api.hydrated = true; h.render()
  assert.equal(options(h).length, 4)
  h.unmount()
  h = harness(allMastered); h.render()
  assert.match(html(h), /All caught up/)
  button(h, 'Check again').props.onClick(); h.render()
  assert.match(html(h), /All caught up/)
  assert.equal(finished.length, 0)
  h.unmount()

  h = harness(); h.render()
  const originalQuestions = h.slots[0].value
  assert.equal(current(h).el.atomicNumber, 2)
  answer(h, false)
  assert.deepEqual(rated, [['el-2', false]])
  assert.equal(current(h).el.atomicNumber, 3, 'Duplicate taps cannot skip a question')
  assert.equal(h.slots[0].value, originalQuestions, 'Store writes cannot regenerate questions or options')
  for (let i = 1; i < 10; i++) answer(h, true)
  assert.equal(rated.length, 10)
  assert.deepEqual(finished, [9])
  h.render(); assert.deepEqual(finished, [9])
  assert.match(html(h), /90%/)
  assert.match(html(h), /9 of 10 correct/)
  assert.match(html(h), /Great run/)
  assert.ok(missionSignals.some(signal => signal.streak >= 5))
  assert.ok(missionSignals.some(signal => signal.done))
  button(h, 'New quiz').props.onClick(); h.render()
  assert.equal(h.slots[1].value, 0)
  assert.equal(h.slots[2].value, null)
  for (let i = 0; i < 10; i++) answer(h, true)
  assert.deepEqual(finished, [9, 10])
  assert.match(html(h), /100%/)
  assert.match(html(h), /Perfect!/)
  h.unmount()

  h = harness({ ...allMastered, 'el-59': grade(undefined, true, '2020-01-01') }); h.render()
  assert.equal(h.slots[0].value.length, 1)
  answer(h, true)
  assert.deepEqual(finished, [1])
  assert.match(html(h), /1 of 1 correct/)
  assert.match(html(h), /100%/)
  h.unmount()

  h = harness(); h.render()
  const initialHTML = html(h)
  assert.match(initialHTML, /aria-label="Answers"/)
  assert.doesNotMatch(initialHTML, /neoShadow|linear-gradient|Press Start|font-pixel/)
  assert.doesNotMatch(initialHTML, /correct answer/)
  options(h)[0].props.onClick(); h.render()
  assert.equal(timers.size, 1)
  h.unmount()
  assert.equal(timers.size, 0, 'Leaving during feedback must cancel the pending advance')
} finally { global.setTimeout = nativeTimeout; global.clearTimeout = nativeClear }
console.log('Quiz checks passed: all 118 question variants, due/new/learning ordering, hydration vs caught-up, fixed questions, single grading/timer/completion, feedback, scoring, restart, missions and unmount cleanup.')
