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
const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))
mocks.react = {
  ...React,
  useState: initial => {
    const h = active, i = h.cursor++
    if (!h.slots[i]) h.slots[i] = { value: typeof initial === 'function' ? initial() : initial }
    return [h.slots[i].value, next => { const value = typeof next === 'function' ? next(h.slots[i].value) : next; if (!Object.is(value, h.slots[i].value)) { h.slots[i].value = value; h.dirty = true } }]
  },
  useRef: current => { const h = active, i = h.cursor++; return (h.slots[i] ??= { current }) },
  useEffect: (callback, deps) => {
    const h = active, i = h.cursor++, old = h.slots[i]
    if (!old || changed(old.deps, deps)) { h.slots[i] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { old?.cleanup?.(); h.slots[i].cleanup = callback() }) }
  },
}
const { default: Locate } = load('src/components/chemistry/Locate.tsx')
const { elements } = load('src/lib/chemistry/elements.ts')
const native = { timeout: global.setTimeout, clear: global.clearTimeout, storage: global.localStorage }
const timers = new Map(); let id = 0, saved, writes, failWrite
global.setTimeout = (callback, ms) => { timers.set(++id, { callback, ms }); return id }
global.clearTimeout = id => timers.delete(id)
global.localStorage = { getItem: key => { assert.equal(key, 'eren_chem_locate_best'); return saved }, setItem: (key, value) => { assert.equal(key, 'eren_chem_locate_best'); if (failWrite) throw Error('Quota'); writes.push(value); saved = value } }
function harness(best = null, hydrated = true, failure = false) {
  assert.equal(timers.size, 0); saved = best; writes = []; rated = []; exits = 0; failWrite = failure
  api = { hydrated, rateCard: (id, right) => rated.push([id, right]) }
  const h = { slots: [], cursor: 0, effects: [], dirty: false }
  h.render = () => { for (let n = 0; n < 20; n++) { active = h; h.cursor = 0; h.dirty = false; h.tree = Locate({ onExit: () => exits++ }); h.effects.splice(0).forEach(fn => fn()); if (!h.dirty) return }; assert.fail('Effects did not settle') }
  h.unmount = () => h.slots.forEach(slot => slot.cleanup?.())
  return h
}
function find(tree, predicate) { if (!React.isValidElement(tree)) return []; return [...(predicate(tree) ? [tree] : []), ...React.Children.toArray(tree.props.children).flatMap(child => find(child, predicate))] }
const button = (h, text) => find(h.tree, n => n.props.children === text && typeof n.props.onClick === 'function')[0]
const cells = h => find(h.tree, n => n.type === 'button' && n.props.style?.gridColumn)
const html = h => renderToStaticMarkup(h.tree)
const target = h => h.slots[1].value[h.slots[2].value]
const cell = (h, el) => cells(h).find(n => n.props.style.gridColumn === el.xpos && n.props.style.gridRow === el.ypos)
function settle() { assert.equal(timers.size, 1); const [id, timer] = timers.entries().next().value; assert.equal(timer.ms, 950); timers.delete(id); timer.callback() }
try {
  let h = harness(null, false); h.render(); assert.match(html(h), /Getting your table/); api.hydrated = true; h.render(); assert.ok(button(h, 'Start')); h.unmount()
  h = harness('8'); h.render(); const start = button(h, 'Start').props.onClick; start(); start(); h.render()
  assert.equal(h.slots[1].value.length, 10); assert.equal(new Set(h.slots[1].value.map(el => el.atomicNumber)).size, 10)
  assert.equal(cells(h).length, 118)
  assert.equal(cells(h).filter(n => n.props.tabIndex === 0).length, 1)
  for (const el of elements) { const n = cell(h, el); assert.ok(n); assert.equal(n.props.style.height, 30); assert.equal(n.props.style.width, 30); assert.doesNotMatch(n.props['aria-label'], new RegExp(el.name)) }
  assert.ok(cells(h).some(n => n.props.style.gridRow === 9)); assert.ok(cells(h).some(n => n.props.style.gridRow === 10)); assert.ok(cells(h).every(n => n.props.style.gridRow <= 10))
  const first = target(h), wrong = elements.find(el => el.atomicNumber !== first.atomicNumber)
  const pick = cell(h, wrong).props.onClick; pick(); pick(); h.render()
  assert.deepEqual(rated, [[`el-${first.atomicNumber}`, false]])
  assert.ok(cells(h).every(n => n.props.disabled)); assert.match(html(h), /correct location/)
  settle(); pick(); assert.equal(rated.length, 1, 'Do not unlock before the next question commits'); h.render()
  for (let i = 1; i < 10; i++) { const pick = cell(h, target(h)).props.onClick; pick(); pick(); h.render(); settle(); h.render() }
  assert.equal(rated.length, 10); assert.equal(h.slots[3].value, 9); assert.equal(h.slots[5].value, 9); assert.deepEqual(writes, ['9']); assert.match(html(h), /Locate results/)
  button(h, 'Play again').props.onClick(); h.render()
  for (let i = 0; i < 10; i++) { cell(h, target(h)).props.onClick(); h.render(); settle(); h.render() }
  assert.match(html(h), /Perfect!/); assert.deepEqual(writes, ['9', '10'])
  button(h, 'Back to lab').props.onClick(); assert.equal(exits, 1); h.unmount()
  h = harness(null, true, true); h.render(); button(h, 'Start').props.onClick(); h.render()
  for (let i = 0; i < 10; i++) { cell(h, target(h)).props.onClick(); h.render(); settle(); h.render() }
  assert.equal(h.slots[5].value, 10, 'Keep best score when storage fails'); h.unmount()
  h = harness('-1'); h.render(); assert.equal(h.slots[5].value, 0); button(h, 'Start').props.onClick(); h.render(); cell(h, target(h)).props.onClick(); h.render(); h.unmount(); assert.equal(timers.size, 0)
} finally { global.setTimeout = native.timeout; global.clearTimeout = native.clear; if (native.storage === undefined) delete global.localStorage; else global.localStorage = native.storage }
console.log('Locate checks passed: 118 fixed cells and correct f-block rows, blank labels, roving focus, 10 unique targets, single grading, feedback locks, scoring, restart, storage failure and unmount cleanup.')
