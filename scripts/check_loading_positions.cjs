const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const load = require('./lib/load_ts.cjs')()
const { PageSkeleton, SkeletonContent } = load('src/components/loading/LoadingSkeleton.tsx')
const { NAV_HEIGHT, NAV_PAGE_PADDING, HEADER_CLEARANCE } = load('src/components/meadow/tokens.ts')
const page = path => renderToStaticMarkup(React.createElement(PageSkeleton, { path }))
const content = layout => renderToStaticMarkup(React.createElement(SkeletonContent, { layout }))

const home = page('/home')
for (const anchor of ['home-stage','home-hud','home-cat','home-places','home-tabs']) assert.match(home, new RegExp(`data-loading-anchor="${anchor}"`))
assert.match(home, new RegExp(`bottom: ${NAV_HEIGHT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
assert.ok(home.includes(`+ ${HEADER_CLEARANCE}px)`))
assert.ok(home.includes(`padding-bottom: ${NAV_PAGE_PADDING}`))
assert.match(home, /eren-home-cat \{[^}]*bottom: 10%;[^}]*width: 200px; height: 200px;/)
assert.match(home, /eren-home-places \{[^}]*bottom: 8px; height: 70px;/)
assert.doesNotMatch(home.split('<style>')[0], /eren-skeleton-room-stage|eren-skeleton-needs/, 'Home must not inherit the expanded care-room header or invented furniture')

function numberConstant(file, name) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let value
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isNumericLiteral(node.initializer)) value = Number(node.initializer.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return value
}
assert.equal(numberConstant('src/components/home/DockButtons.tsx', 'DOCK_BOTTOM'), 8)
assert.equal(numberConstant('src/components/home/DockButtons.tsx', 'DOCK_HEIGHT'), 70)
assert.match(fs.readFileSync('src/components/home/HomeRoomFrame.tsx','utf8'), /bottom: NAV_HEIGHT/)
assert.match(fs.readFileSync('src/app/(app)/home/page.tsx','utf8'), /bottom: '10%'/)

for (const route of ['/settings','/closet','/gacha/collection','/bucket-list','/hallway','/rewards','/jelly','/trophies']) assert.match(page(route), /class="eren-skeleton-back-heading"/)
for (const route of ['/home','/profile','/couple','/games']) assert.match(page(route), /data-nav="true"/)
for (const route of ['/settings','/closet','/gacha/collection','/games/paw-doku']) assert.doesNotMatch(page(route), /data-nav="true"/)
for (const scene of ['feed','sleep','wash']) {
  const html = renderToStaticMarkup(React.createElement(PageSkeleton, { scene }))
  assert.doesNotMatch(html, /data-nav="true"|data-loading-anchor="home-tabs"/, 'Care overlays do not reserve the home tab bar')
}
assert.doesNotMatch(content('portrait').split('<style>')[0], /eren-skeleton-actions/, 'An inline closet loader must not repeat the visible tab row')
assert.match(content('items'), /grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/)
assert.equal((page('/profile').match(/width:60px;height:60px;border-radius:999px/g) || []).length, 2, 'Profile waits for the two real household seats')
console.log('Loading position checks passed: home stage/HUD/cat/dock/nav anchors, page chrome offsets, two profile seats and inline closet/collection sizing.')
