const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const createLoader = require('./lib/load_ts.cjs')
const calls = []
const sounds = []
const mocks = {
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/components/CloudTransition': { requestCloudNav: (...args) => calls.push(args) },
  '@/lib/sounds': { playSound: sound => sounds.push(sound) },
}
const load = createLoader(mocks)
const { RoundButton } = load('src/components/meadow/Buttons.tsx')
const { MEADOW_ICON_NAMES, MeadowIcon } = load('src/components/PixelIcons.tsx')
const { M } = load('src/components/meadow/tokens.ts')
mocks['@/components/meadow'] = { RoundButton, MeadowIcon, M }
const { default: HomeDock, DOCK_CLEARANCE } = load('src/components/home/DockButtons.tsx')
const tree = HomeDock()
assert.equal(tree.type, 'nav')
assert.equal(tree.props['aria-label'], 'Places')
assert.equal(tree.props.style.gridTemplateColumns, 'repeat(4, minmax(0, 1fr))')
assert.equal(DOCK_CLEARANCE, tree.props.style.bottom + tree.props.style.height + 8)
const expected = [
  ['/gacha', 'Gacha', 'gacha', 'rainbow'],
  ['/bakery', 'Bakery', 'cake', 'pink'],
  ['/shawarma', 'Shawarma', 'shawarma', 'smoke'],
  ['/jelly', 'Jelly', 'jelly', 'mint'],
]
const entries = React.Children.toArray(tree.props.children)
assert.equal(entries.length, expected.length)
entries.forEach((entry, index) => {
  const button = entry.props.children
  const [href, label, iconName, cloud] = expected[index]
  assert.equal(button.type, RoundButton)
  assert.equal(button.props.href, href)
  assert.equal(button.props.ariaLabel, label)
  assert.equal(button.props.surface, 'art')
  assert.ok(button.props.size >= 44)
  const [icon, caption] = button.props.children
  assert.equal(icon.props.name, iconName)
  assert.equal(caption.props.children, label)
  assert.equal(caption.props.style.fontSize, 12)
  assert.equal(caption.props.style.letterSpacing, 0)
  assert.equal(caption.props.style.top + 20, tree.props.style.height)
  let prevented = false
  button.props.onClick({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
  assert.deepEqual(calls.at(-1), [href, cloud])
  const before = calls.length
  button.props.onClick({ ctrlKey: true, preventDefault: () => { throw new Error('Preserve open-in-new-tab') } })
  assert.equal(calls.length, before)
  assert.ok(MEADOW_ICON_NAMES.includes(iconName))
  const markup = renderToStaticMarkup(React.createElement(MeadowIcon, { name: iconName }))
  assert.ok(markup.includes('viewBox="0 0 12 12"'))
})
assert.deepEqual(sounds, Array(4).fill('ui_tap'))
const markup = renderToStaticMarkup(React.createElement(HomeDock))
assert.ok(!/Press Start|text-shadow|dock-fill|gacha-red-btn|font-pixel/.test(markup))
assert.equal((markup.match(/class="m-lip m-focus/g) ?? []).length, 4)

const root = path.resolve(__dirname, '..')
const source = ts.createSourceFile('PixelIcons.tsx', fs.readFileSync(path.join(root, 'src/components/PixelIcons.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let spec
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'MEADOW_ICONS') {
    const code = ts.transpileModule('const icons = ' + node.initializer.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
    spec = new Function(code + ';return icons')()
  }
  ts.forEachChild(node, visit)
}
visit(source)
for (const [, , name] of expected) {
  const { grid, palette } = spec[name]
  assert.equal(grid.length, 12)
  assert.ok(Object.keys(palette).length <= 3)
  for (const row of grid) {
    assert.equal(row.length, 12, `${name}: ${row}`)
    for (const cell of row) assert.ok(cell === '.' || cell in palette)
  }
}
const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8')
assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.home-dock-pop \{ animation: none; \}/)
assert.ok(!/\.home-dock-btn|\.gacha-red-btn|@keyframes dockJelly/.test(css))
console.log('Home dock checks passed: four Meadow links, 44px circles, readable clickable labels, original routes/clouds/sounds, modifier links, valid pixel icons and reduced motion.')
