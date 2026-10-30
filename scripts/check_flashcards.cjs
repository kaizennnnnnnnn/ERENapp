const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
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
const { grade, isDue, isNew, dateStr } = load('src/lib/chemistry/srs.ts')
const today = dateStr()
const cardId = n => `el-${n}`
const storeFile = 'src/lib/chemistry/store.tsx'
const source = ts.createSourceFile(storeFile, fs.readFileSync(storeFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let deriveText
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.name.getText(source).includes('dueCount')) deriveText = node.initializer.arguments[0].getText(source)
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(deriveText)
const derivedJS = ts.transpileModule('const derive = ' + deriveText, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const derive = new Function('state', 'today', 'elements', 'elementCardId', 'isDue', 'isNew', derivedJS + '\nreturn derive()')
const counts = cards => derive({ cards }, today, elements, cardId, isDue, isNew)
assert.deepEqual(counts({}), { dueCount: 0, newCount: 118 })
assert.equal(counts({ 'el-1': grade(undefined, true, today) }).newCount, 117)
assert.equal(counts({ 'el-1': { box: 0, lastReviewed: null } }).newCount, 118)
assert.equal(counts({ 'el-1': grade(undefined, true, '2020-01-01') }).dueCount, 1)

let active, api, rated, finished, missionSignals
mocks['@/lib/chemistry/store'] = { elementCardId: cardId, useChemistryStore: () => ({ ...api, ...counts(api.state.cards) }) }
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
  useEffect: (callback, deps) => {
    const h = active, i = h.cursor++, old = h.slots[i]
    if (!old || changed(old.deps, deps)) {
      h.slots[i] = { deps, cleanup: old?.cleanup }
      h.effects.push(() => { old?.cleanup?.(); h.slots[i].cleanup = callback() })
    }
  },
}
const { default: Flashcards, buildDeck } = load('src/components/chemistry/Flashcards.tsx')
const allMastered = Object.fromEntries(elements.map(el => [cardId(el.atomicNumber), { box: 6, lastReviewed: '2099-01-01', reviews: 6, correct: 6, lapses: 0 }]))
assert.equal(buildDeck({}, today).length, 10)
assert.equal(new Set(buildDeck({}, today).map(el => el.atomicNumber)).size, 10)
assert.equal(buildDeck(allMastered, today).length, 0)
const future = { ...allMastered, 'el-1': { ...grade(undefined, true, today), box: 2 } }
assert.deepEqual(buildDeck(future, today).map(el => el.atomicNumber), [1])
const dueCards = { 'el-1': grade(undefined, true, '2020-01-01'), 'el-2': grade(undefined, true, '2020-01-02'), 'el-3': grade(undefined, true, '2020-01-03') }
assert.deepEqual(buildDeck(dueCards, today).slice(0, 3).map(el => el.atomicNumber), [1, 2, 3])
const manyDue = Object.fromEntries(elements.slice(0, 14).map(el => [cardId(el.atomicNumber), grade(undefined, true, '2020-01-01')]))
assert.deepEqual(buildDeck(manyDue, today).map(el => el.atomicNumber), [1,2,3,4,5,6,7,8,9,10])
function harness(cards = dueCards, hydrated = true) {
  rated = []; finished = []; missionSignals = []
  api = { hydrated, today, state: { cards: { ...cards }, streak: { current: 0 } },
    rateCard(id, right) { rated.push([id, right]); api.state.cards = { ...api.state.cards, [id]: grade(api.state.cards[id], right, today) } },
    finishDeck(best) { finished.push(best); api.state.streak.current = 1 },
  }
  const h = { slots: [], effects: [], cursor: 0, dirty: false, tree: null }
  h.render = () => {
    active = h; h.cursor = 0; h.dirty = false; h.tree = Flashcards()
    for (let n = 0; n < 20; n++) {
      h.effects.splice(0).forEach(run => run())
      if (!h.dirty) break
      active = h; h.cursor = 0; h.dirty = false; h.tree = Flashcards()
      assert.ok(n < 19, 'Effects must settle, including the empty-deck case')
    }
    return h.tree
  }
  return h
}
function find(tree, predicate) {
  if (!React.isValidElement(tree)) return null
  if (predicate(tree)) return tree
  if (tree.type.name === 'DeckSummary') return find(tree.type(tree.props), predicate)
  for (const child of React.Children.toArray(tree.props.children)) { const result = find(child, predicate); if (result) return result }
  return null
}
const button = (h, label) => find(h.tree, node => node.props.children === label && typeof node.props.onClick === 'function')
const flipCard = h => find(h.tree, node => node.type.name === 'FlipCard')
const html = h => renderToStaticMarkup(h.tree)
let h = harness({}, false); h.render()
assert.match(html(h), /Getting your cards/)
api.hydrated = true; h.render()
assert.match(html(h), /118<!-- --> new|118 new/)
assert.ok(flipCard(h))
h = harness(allMastered); h.render()
assert.match(html(h), /All caught up/)
assert.doesNotMatch(html(h), /Getting your cards/)
button(h, 'Check again').props.onClick(); h.render()
assert.match(html(h), /All caught up/)
assert.equal(finished.length, 0)

h = harness(); h.render()
assert.equal(flipCard(h).props.el.atomicNumber, 1)
button(h, 'Reveal answer').props.onClick(); h.render()
assert.equal(flipCard(h).props.flipped, true)
flipCard(h).props.onFlip(); h.render()
assert.equal(flipCard(h).props.flipped, false)
assert.equal(rated.length, 0, 'Hiding the answer is not a rating')
button(h, 'Reveal answer').props.onClick(); h.render()
const originalDeck = h.slots[0].value
const again = button(h, 'Again').props.onClick
again(); again(); h.render()
assert.deepEqual(rated, [['el-1', false]])
assert.equal(flipCard(h).props.el.atomicNumber, 2, 'Duplicate taps cannot skip the next card')
assert.equal(flipCard(h).props.flipped, false)
assert.equal(h.slots[0].value, originalDeck, 'Rating must not rebuild the remaining deck')
for (let i = 1; i < 10; i++) {
  button(h, 'Reveal answer').props.onClick(); h.render()
  const right = button(h, 'Got it').props.onClick
  right(); right(); h.render()
}
assert.equal(rated.length, 10)
assert.deepEqual(finished, [9])
h.render(); assert.deepEqual(finished, [9])
assert.match(html(h), /90%/)
assert.match(html(h), /9 of 10 correct/)
assert.match(html(h), /Great run/)
assert.ok(missionSignals.some(signal => signal.streak >= 5))
assert.ok(missionSignals.some(signal => signal.done))
button(h, 'New deck').props.onClick(); h.render()
assert.equal(flipCard(h).props.flipped, false)
for (let i = 0; i < 10; i++) { button(h, 'Reveal answer').props.onClick(); h.render(); button(h, 'Got it').props.onClick(); h.render() }
assert.deepEqual(finished, [9, 10])
assert.match(html(h), /Perfect!/)

h = harness({}); h.render()
const initialHTML = html(h)
assert.match(initialHTML, /aria-pressed="false"/)
assert.match(initialHTML, /prefers-reduced-motion: reduce/)
assert.match(initialHTML, /aria-hidden="true"/)
assert.doesNotMatch(initialHTML, /neoShadow|linear-gradient|Press Start|font-pixel/)
console.log('Flashcard checks passed: catalogue-based unseen count, due/new/future ordering, loading vs caught-up, stable deck, one rating per card, single completion, missed/perfect results, restart, flip state and reduced motion.')
