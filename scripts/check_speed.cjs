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
let active, api, rated, exits
mocks['@/lib/chemistry/store'] = { elementCardId: n => `el-${n}`, useChemistryStore: () => api }
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
const { default: Speed } = load('src/components/chemistry/Speed.tsx')
const { elements } = load('src/lib/chemistry/elements.ts')
const { speedPool, makeQuestion } = load('src/lib/chemistry/questions.ts')
const pool = speedPool()
assert.equal(pool.length, 118)
assert.equal(new Set(pool.map(el => el.atomicNumber)).size, 118)
for (const el of elements) for (const type of ['name-from-symbol', 'symbol-from-name']) {
  const q = makeQuestion(el, type)
  assert.equal(q.options.length, 4)
  assert.equal(new Set(q.options).size, 4)
  assert.equal(q.options[q.correctIdx], q.answer)
}

const native = { interval: global.setInterval, clearInterval: global.clearInterval, now: Date.now, document: global.document, window: global.window, storage: global.localStorage, HTMLElement: global.HTMLElement }
const intervals = new Map(), visibility = new Set(), keys = new Set()
let timerId = 0, now = 0, stored = null, writes = [], storageFailure = ''
global.setInterval = (callback, delay) => { const id = ++timerId; intervals.set(id, { callback, delay }); return id }
global.clearInterval = id => intervals.delete(id)
Date.now = () => now
global.HTMLElement = class { constructor(interactive = false) { this.interactive = interactive } closest() { return this.interactive ? {} : null } }
global.document = { visibilityState: 'visible', addEventListener(name, fn) { assert.equal(name, 'visibilitychange'); visibility.add(fn) }, removeEventListener(name, fn) { visibility.delete(fn) } }
global.window = { addEventListener(name, fn) { assert.equal(name, 'keydown'); keys.add(fn) }, removeEventListener(name, fn) { keys.delete(fn) } }
global.localStorage = {
  getItem(key) { assert.equal(key, 'eren_chem_speed_best'); if (storageFailure === 'read') throw Error('Blocked'); return stored },
  setItem(key, value) { assert.equal(key, 'eren_chem_speed_best'); if (storageFailure === 'write') throw Error('Quota'); stored = value; writes.push(value) },
}
function tick(ms) { now += ms; [...intervals.values()].forEach(timer => timer.callback()) }
function harness(saved = null, hydrated = true, failure = '') {
  assert.equal(intervals.size + visibility.size + keys.size, 0, 'Previous sprint must clean up')
  now = 0; stored = saved; writes = []; rated = []; exits = 0; storageFailure = failure
  api = { hydrated, rateCard(id, correct) { rated.push([id, correct]) } }
  const h = { slots: [], effects: [], cursor: 0, dirty: false, tree: null }
  h.render = () => {
    for (let n = 0; n < 20; n++) {
      active = h; h.cursor = 0; h.dirty = false; h.tree = Speed({ onExit: () => exits++ })
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
  return [...(predicate(tree) ? [tree] : []), ...React.Children.toArray(tree.props.children).flatMap(child => findAll(child, predicate))]
}
const button = (h, label) => findAll(h.tree, node => node.props.children === label && typeof node.props.onClick === 'function')[0]
const options = h => findAll(h.tree, node => /^[1-4]\. /.test(node.props.ariaLabel ?? ''))
const html = h => renderToStaticMarkup(h.tree)
const current = h => h.slots[3].value
function answer(h, correct = true, duplicate = false) {
  const q = current(h), index = correct ? q.correctIdx : (q.correctIdx + 1) % 4
  const pick = options(h)[index].props.onClick
  pick(); if (duplicate) pick(); h.render()
}
function key(h, value, extra = {}) {
  const event = { key: value, target: new global.HTMLElement(), repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true }, ...extra }
  ;[...keys].forEach(fn => fn(event)); h.render()
  return event
}
try {
  let h = harness(null, false); h.render()
  assert.match(html(h), /Getting your sprint/)
  assert.equal(options(h).length, 0)
  assert.equal(intervals.size + keys.size, 0)
  api.hydrated = true; h.render()
  assert.match(html(h), /Speed round/)
  tick(90000); h.render()
  assert.equal(h.slots[1].value, 60)
  button(h, 'Back to lab').props.onClick(); assert.equal(exits, 1)
  h.unmount()

  h = harness('2'); h.render()
  assert.equal(h.slots[5].value, 2)
  const start = button(h, 'Start').props.onClick
  start(); start(); h.render()
  const timer = [...intervals.keys()][0]
  assert.equal(intervals.size, 1)
  assert.equal(keys.size, 1)
  answer(h, true, true)
  assert.equal(rated.length, 1)
  assert.equal(h.slots[2].value, 1)
  assert.equal(h.slots[4].value.correct, true)
  answer(h, false, true)
  assert.equal(rated.length, 2)
  assert.equal(rated[1][1], false, 'Wrong answers still update the same study card')
  assert.equal(h.slots[2].value, 1)
  assert.equal(h.slots[4].value.correct, false)
  const beforeIgnored = rated.length
  for (const extra of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true }, { target: new global.HTMLElement(true) }]) key(h, '1', extra)
  for (const value of ['Enter', ' ', '0', '5', '1junk']) key(h, value)
  assert.equal(rated.length, beforeIgnored, 'Do not hijack native controls, modifiers, IME, held keys or unrelated keys')
  const digit = String(current(h).correctIdx + 1)
  assert.equal(key(h, digit).defaultPrevented, true)
  assert.equal(rated.length, beforeIgnored + 1)
  assert.equal(h.slots[2].value, 2)
  tick(12300); h.render()
  assert.equal(h.slots[1].value, 48)
  assert.equal([...intervals.keys()][0], timer, 'Scoring must not restart the timer')
  tick(47700); h.render()
  assert.match(html(h), /Speed results/)
  assert.equal(h.slots[5].value, 2)
  assert.equal(h.slots[7].value, false, 'Tying a record is not a new personal best')
  assert.deepEqual(writes, [])
  assert.equal(intervals.size + visibility.size + keys.size, 0)
  h.render(); assert.deepEqual(writes, [])
  button(h, 'Play again').props.onClick(); h.render()
  assert.equal(h.slots[2].value, 0)
  assert.equal(h.slots[1].value, 60)
  assert.equal(h.slots[4].value, null)
  for (let i = 0; i < 3; i++) answer(h)
  now += 60000
  const late = options(h)[current(h).correctIdx].props.onClick
  late(); late(); h.render()
  assert.equal(rated.length, beforeIgnored + 4, 'Late answers cannot score or grade')
  assert.equal(h.slots[2].value, 3)
  assert.equal(h.slots[5].value, 3)
  assert.equal(h.slots[7].value, true)
  assert.match(html(h), /New personal best!/)
  assert.deepEqual(writes, ['3'])
  button(h, 'Back to lab').props.onClick(); assert.equal(exits, 1)
  h.unmount()

  h = harness(); h.render(); button(h, 'Start').props.onClick(); h.render()
  const seen = []
  for (let i = 0; i < 118; i++) { seen.push(current(h).el.atomicNumber); now += 250; answer(h) }
  assert.equal(new Set(seen).size, 118, 'The catalogue must refill only after every element was offered')
  assert.ok(current(h))
  assert.equal(rated.length, 118)
  assert.equal(intervals.size, 1)
  tick(500); h.render()
  assert.equal(h.slots[1].value, 30, 'Rapid correct answers cannot extend a sprint')
  now += 31000; [...visibility].forEach(fn => fn()); h.render()
  assert.equal(h.slots[2].value, 118)
  assert.deepEqual(writes, ['118'])
  assert.equal(intervals.size + visibility.size + keys.size, 0)
  h.unmount()

  for (const saved of ['Infinity', '-5', '12garbage', '1.5', '9007199254740992']) {
    h = harness(saved); h.render(); assert.equal(h.slots[5].value, 0); h.unmount()
  }
  h = harness('7', true, 'read'); h.render()
  assert.ok(button(h, 'Start'))
  assert.equal(h.slots[5].value, 0)
  h.unmount()
  h = harness(null, true, 'write'); h.render(); button(h, 'Start').props.onClick(); h.render(); answer(h)
  tick(60000); h.render()
  assert.equal(h.slots[5].value, 1, 'Storage failure must not hide the in-memory record')
  assert.equal(h.slots[7].value, true)
  h.unmount()
  h = harness('4'); h.render(); button(h, 'Start').props.onClick(); h.render()
  tick(60000); h.render()
  assert.equal(h.slots[2].value, 0)
  assert.equal(h.slots[5].value, 4)
  assert.equal(h.slots[7].value, false)
  assert.match(html(h), /0<\/p>/)
  h.unmount()
  h = harness(); h.render(); button(h, 'Start').props.onClick(); h.render(); answer(h)
  const initialHTML = html(h)
  assert.doesNotMatch(initialHTML, /neoShadow|linear-gradient|Press Start|font-pixel/)
  assert.match(initialHTML, /aria-label="Answers"/)
  h.unmount()
  assert.equal(intervals.size + visibility.size + keys.size, 0, 'Leaving cancels every timer and listener')
} finally {
  global.setInterval = native.interval; global.clearInterval = native.clearInterval; Date.now = native.now
  for (const [name, original] of [['document', native.document], ['window', native.window], ['localStorage', native.storage], ['HTMLElement', native.HTMLElement]]) {
    if (original === undefined) delete global[name]; else global[name] = original
  }
}
console.log('Speed checks passed: 118-element refill, both question types, hydration/start, single grading, wrong-answer progress, keyboard guards, fixed deadline, late input, visibility resume, record ties/improvements, storage failures, restart and cleanup.')
