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
let active, rated = [], finished = [], missions = [], generated = 0, keyHandler
mocks['@/lib/chemistry/store'] = {
  elementCardId: n => `el-${n}`,
  useChemistryStore: () => ({ rateCard: (...args) => rated.push(args), finishDeck: n => finished.push(n) }),
}
mocks['@/lib/chemistry/missions'] = { useChemistryMissions: value => missions.push(value) }
mocks['@/lib/sounds'] = { playSound() {} }
mocks['@/lib/chemistry/questions'] = { makeQuestion: el => {
  generated++
  return { el, type: 'symbol-from-name', prompt: `What is the symbol for ${el.name}?`, answer: el.symbol,
    options: [el.symbol, 'Wrong A', 'Wrong B', 'Wrong C'], correctIdx: 0 }
} }
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
  useMemo: (factory, deps) => {
    const h = active, i = h.cursor++
    if (!h.slots[i] || changed(h.slots[i].deps, deps)) h.slots[i] = { value: factory(), deps }
    return h.slots[i].value
  },
  useEffect: (callback, deps) => {
    const h = active, i = h.cursor++, old = h.slots[i]
    if (!old || changed(old.deps, deps)) {
      h.slots[i] = { deps, cleanup: old?.cleanup }
      h.effects.push(() => { old?.cleanup?.(); h.slots[i].cleanup = callback() })
    }
  },
}
global.window = {
  addEventListener: (name, callback) => { if (name === 'keydown') keyHandler = callback },
  removeEventListener: () => { keyHandler = null },
}
global.HTMLElement = class { constructor(interactive = false) { this.interactive = interactive } closest() { return this.interactive ? this : null } }
const Session = load('src/components/chemistry/SessionRunner.tsx').default
const StudyButton = load('src/components/chemistry/PeriodicTableButton.tsx').default
const cards = [{ atomicNumber: 1, name: 'Hydrogen', symbol: 'H' }, { atomicNumber: 2, name: 'Helium', symbol: 'He' }]
let exits = 0, restarts = 0
const base = { title: 'Learn', cards, emptyTitle: 'Nothing due', emptyBody: 'Come back tomorrow.', restartLabel: 'Next batch', onExit: () => exits++, onRestart: () => restarts++ }
function harness() {
  const h = { slots: [], effects: [], cursor: 0, dirty: false, tree: null }
  h.render = (props = base, flush = true) => {
    active = h; h.cursor = 0; h.dirty = false
    h.tree = Session(props)
    if (flush) for (let n = 0; n < 20; n++) {
      const effects = h.effects.splice(0)
      effects.forEach(run => run())
      if (!h.dirty) break
      active = h; h.cursor = 0; h.dirty = false; h.tree = Session(props)
      assert.ok(n < 19, 'Effects must settle')
    }
    return h.tree
  }
  return h
}
function find(tree, predicate) {
  if (!React.isValidElement(tree)) return null
  if (predicate(tree)) return tree
  if (['DoneCard', 'Empty', 'Loading'].includes(tree.type.name)) return find(tree.type(tree.props), predicate)
  for (const child of React.Children.toArray(tree.props.children)) { const result = find(child, predicate); if (result) return result }
  return null
}
const button = (tree, text) => find(tree, node => node.props.children === text && typeof node.props.onClick === 'function')
const answer = (tree, text) => find(tree, node => node.props.ariaLabel?.startsWith(text))
const markup = h => renderToStaticMarkup(h.tree)
let h = harness()
h.render({ ...base, cards: [], loading: true })
assert.match(markup(h), /Getting your cards/)
assert.doesNotMatch(markup(h), /Nothing due/)
h.render({ ...base, cards }, false)
assert.match(markup(h), /Getting your cards/, 'Arriving cards cannot access an absent question before the deck effect')
h.render()
assert.match(markup(h), /What is the symbol for Hydrogen/)
const generatedAtStart = generated
answer(h.tree, '2. Wrong A').props.onClick()
answer(h.tree, '2. Wrong A').props.onClick()
assert.deepEqual(rated, [['el-1', false]], 'Same-tick answer taps grade only once')
h.render()
assert.equal(generated, generatedAtStart, 'Feedback cannot reshuffle the questions')
assert.match(markup(h), /Correct answer: H/)
assert.equal(answer(h.tree, '1. H').props.disabled, true)
const next = button(h.tree, 'Continue').props.onClick
next(); next(); h.render()
assert.match(markup(h), /What is the symbol for Helium/)
answer(h.tree, '1. He').props.onClick(); h.render()
const finish = button(h.tree, 'See results').props.onClick
finish(); finish(); h.render()
assert.deepEqual(finished, [1], 'Rapid result taps finish a deck once')
assert.match(markup(h), /50%/)
assert.match(markup(h), /Retry missed \(1\)/)
assert.match(markup(h), /You chose/)
button(h.tree, 'Retry missed (1)').props.onClick(); h.render()
assert.match(markup(h), /What is the symbol for Hydrogen/)
assert.doesNotMatch(markup(h), /Helium/)
assert.match(markup(h), /1 \/ 1/)
answer(h.tree, '1. H').props.onClick(); h.render()
button(h.tree, 'See results').props.onClick(); h.render()
assert.match(markup(h), /100%/)
assert.match(markup(h), /Perfect!/)
button(h.tree, 'Done').props.onClick(); button(h.tree, 'Next batch').props.onClick()
assert.equal(exits, 1); assert.equal(restarts, 1)
assert.ok(missions.some(value => value.done))
assert.deepEqual(rated, [['el-1', false], ['el-2', true], ['el-1', true]])

h = harness(); h.render()
const key = (value, extra = {}) => keyHandler({ key: value, target: new HTMLElement(), preventDefault() {}, ...extra })
const ratedBeforeKeys = rated.length
key('1', { repeat: true }); key('1', { isComposing: true }); key('1', { ctrlKey: true }); key('1', { target: new HTMLElement(true) })
assert.equal(rated.length, ratedBeforeKeys)
key('1'); key('1'); h.render()
assert.equal(rated.length, ratedBeforeKeys + 1)
key('Enter', { target: new HTMLElement(true) }); h.render()
assert.match(markup(h), /Hydrogen/, 'A focused Home/Close/Continue control keeps native Enter behavior')
key('Enter'); h.render()
assert.match(markup(h), /Helium/)

h = harness(); h.render({ ...base, cards: [] })
assert.match(markup(h), /Nothing due/)
button(h.tree, 'Back to home').props.onClick()
assert.equal(exits, 2)
for (const html of [markup(h), renderToStaticMarkup(React.createElement(StudyButton, { onClick() {} }))]) {
  assert.doesNotMatch(html, /lucide|linear-gradient|Press Start|font-weight:900/)
}
assert.match(renderToStaticMarkup(React.createElement(StudyButton, { onClick() {} })), />Study</)
delete global.window; delete global.HTMLElement
console.log('Chemistry session checks passed: hydration, locked question order, single grading/completion, correct/missed/perfect results, missed-only retry, native keyboard controls and Meadow states.')
