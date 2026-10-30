const assert = require('node:assert/strict')
const fs = require('node:fs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const mocks = { 'next/link': ({ children, ...props }) => React.createElement('a', props, children) }
const load = require('./lib/load_ts.cjs')(mocks)
let closed = 0, sheetOpen = true, sounds = [], queue, updates, refs
mocks['@/components/meadow'] = {
  ...load('src/components/meadow/tokens.ts'), ...load('src/components/meadow/Buttons.tsx'),
  ...load('src/components/meadow/Card.tsx'), ...load('src/components/meadow/Controls.tsx'),
  Sheet: ({ children, title }) => React.createElement('article', { role: 'dialog', 'aria-label': title }, children),
  useSheetExit: () => [sheetOpen, () => closed++],
}
let hydrated = true
const cards = { 'el-1': { box: 6 }, 'el-2': { box: 2 } }
mocks['@/lib/chemistry/store'] = { elementCardId: n => `el-${n}`, useChemistryStore: () => ({ state: { cards }, hydrated }) }
mocks['@/lib/sounds'] = { playSound: name => sounds.push(name) }
mocks.react = {
  ...React,
  useState: initial => { const i = updates.length; updates.push([]); return [queue.length ? queue.shift() : initial, value => updates[i].push(value)] },
  useRef: current => { const value = { current }; refs.push(value); return value },
}
const { elements, CATEGORY_LABELS } = load('src/lib/chemistry/elements.ts')
const colors = load('src/lib/chemistry/colors.ts')
const { default: Table, tableNeighbor } = load('src/components/chemistry/PeriodicTable.tsx')
const Detail = load('src/components/chemistry/ElementDetail.tsx').default
const el = n => elements.find(element => element.atomicNumber === n)
function all(tree, predicate) {
  if (!React.isValidElement(tree)) return []
  return [...(predicate(tree) ? [tree] : []), ...React.Children.toArray(tree.props.children).flatMap(child => all(child, predicate))]
}
function render(mode = 'category', selected = null, active = 1) {
  queue = [mode, selected, active]; updates = []; refs = []; sounds = []
  const tree = Table()
  return { tree, tiles: all(tree, node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog') }
}
let { tree, tiles } = render()
const tileFor = number => tiles.find(tile => tile.props['aria-label'].includes(`atomic number ${number},`))
assert.equal(tiles.length, 118)
assert.equal(new Set(tiles.map(tile => tile.key)).size, 118)
assert.equal(tiles.filter(tile => tile.props.tabIndex === 0).length, 1)
assert.equal(tiles[0].props.tabIndex, 0)
const grid = all(tree, node => node.props.style?.gridTemplateColumns)[0]
assert.equal(grid.props.style.gridTemplateRows, 'repeat(7, 30px) 8px repeat(2, 30px)')
for (const element of elements) {
  const tile = tileFor(element.atomicNumber)
  assert.equal(tile.props.style.gridRow, element.ypos)
  assert.equal(tile.props.style.gridColumn, element.xpos)
  assert.equal(tile.props.style.width, 30)
  assert.equal(tile.props.style.height, 30)
  assert.equal(tile.props.style.background, colors.CATEGORY_COLORS[element.category])
  assert.ok(tile.props['aria-label'].includes(element.name))
  assert.ok(tile.props['aria-label'].includes(CATEGORY_LABELS[element.category]))
}
assert.equal(tileFor(57).props.style.gridRow, 9)
assert.equal(tileFor(89).props.style.gridRow, 10)
assert.equal(tableNeighbor(el(1), 'ArrowRight'), el(2), 'Skip the gap between Hydrogen and Helium')
assert.equal(tableNeighbor({ ...el(1) }, 'ArrowRight'), el(2))
assert.equal(tableNeighbor(el(2), 'ArrowDown'), el(10))
assert.equal(tableNeighbor(el(1), 'ArrowLeft'), undefined)
assert.equal(tableNeighbor(el(57), 'ArrowDown'), el(89))
assert.equal(tableNeighbor(el(89), 'ArrowUp'), el(57))
assert.equal(tableNeighbor(el(2), 'Home'), el(1))
assert.equal(tableNeighbor(el(1), 'End'), el(2))
assert.equal(tableNeighbor(el(1), 'Enter'), undefined)
let focused = null, prevented = 0
tileFor(2).ref({ focus() { focused = 2 } })
tiles[0].props.onKeyDown({ key: 'ArrowRight', preventDefault() { prevented++ } })
assert.equal(focused, 2); assert.equal(prevented, 1)
focused = null
tiles[0].props.onKeyDown({ key: 'ArrowRight', ctrlKey: true })
assert.equal(focused, null)
tiles[0].props.onClick()
assert.equal(updates[1][0], el(1)); assert.deepEqual(sounds, ['ui_modal_open'])
all(tree, node => node.props.ariaLabel === 'Colour elements by')[0].props.onChange('state')
assert.equal(updates[0][0], 'state')

for (const mode of ['state', 'mastery']) {
  ;({ tree, tiles } = render(mode))
  for (const element of elements) {
    const tile = tileFor(element.atomicNumber)
    assert.equal(tile.props.style.background, mode === 'state' ? colors.STATE_COLORS[element.state] : colors.masteryColor(cards[`el-${element.atomicNumber}`]?.box ?? 0))
  }
  const html = renderToStaticMarkup(tree)
  assert.doesNotMatch(html, /neoShadow|font-pixel|linear-gradient|Press Start/)
  assert.match(html, /aria-label="Colour elements by"/)
}
hydrated = false
;({ tiles } = render('mastery'))
assert.equal(tiles[0].props.style.background, colors.masteryColor(0))
assert.match(tiles[0].props['aria-label'], /Mastery loading/)
hydrated = true

for (const element of elements) {
  const detail = Detail({ element, onClose() {} })
  assert.equal(detail.props.zIndex, 90)
  assert.equal(detail.props.title, element.name)
  const html = renderToStaticMarkup(detail)
  assert.ok(html.includes(element.symbol))
  assert.ok(html.includes(element.atomicMass.toString()))
  assert.doesNotMatch(html, /lucide|neoShadow|linear-gradient|Press Start/)
  if (element.group == null) assert.match(html, /Not assigned/)
  if (!element.mnemonic) assert.doesNotMatch(html, />Mnemonic</)
}
const detail = Detail({ element: el(1), onClose() {} })
detail.props.onClose()
assert.equal(closed, 1)
assert.equal(sounds.at(-1), 'ui_modal_close')
sheetOpen = false
Detail({ element: el(1), onClose() {} }).props.onClose()
assert.equal(closed, 1)
const overlay = fs.readFileSync('src/components/chemistry/PeriodicTableOverlay.tsx', 'utf8')
assert.ok(overlay.includes("document.querySelector('.app-container') ?? document.body"), 'Table and detail sheet must share the app-frame portal host')
console.log('Periodic table checks passed: 118 tiles, exact coordinates and fixed f-block rows, all colour modes, spatial keyboard navigation, one tab stop, all element details and app-frame sheet integration.')
