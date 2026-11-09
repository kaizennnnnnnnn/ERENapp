const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const load = require('./lib/load_ts.cjs')()
const { PageSkeleton, SkeletonContent, loadingLayoutForPath } = load('src/components/loading/LoadingSkeleton.tsx')

function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? pages(path.join(dir, e.name)) : e.name === 'page.tsx' ? [path.join(dir, e.name)] : [])
}
const routes = pages(path.join(root, 'src/app'))
for (const page of routes) {
  const route = '/' + path.relative(path.join(root, 'src/app'), path.dirname(page)).split(path.sep).filter(p => !p.startsWith('(')).join('/')
  const fallback = page.replace(/page\.tsx$/, 'loading.tsx')
  assert.ok(fs.existsSync(fallback), `${route} has its own streaming loading boundary`)
  const source = fs.readFileSync(fallback, 'utf8')
  assert.ok(source.includes(`path="${route === '/' ? '/home' : route}"`), `${route} uses the destination, not the outgoing pathname`)
  const markup = renderToStaticMarkup(React.createElement(load(path.relative(root, fallback)).default))
  assert.equal((markup.match(/role="status"/g) || []).length, 1)
  assert.match(markup, /aria-busy="true"/)
  assert.doesNotMatch(markup, /<button|<input|<a\s|<img|<svg|<canvas|gradient|font-pixel/)
  assert.match(markup, /prefers-reduced-motion: reduce/)
  assert.equal(markup, renderToStaticMarkup(React.createElement(load(path.relative(root, fallback)).default)), 'Deterministic SSR, no random hydration mismatch')
}
for (const layout of ['room','arcade','game','machine','counter','kiosk','profile','couple','settings','notes','photos','list','collection','closet','rewards','chat','form','document','rows','parlour','tray']) {
  const html = renderToStaticMarkup(React.createElement(SkeletonContent, { layout }))
  assert.ok((html.match(/eren-skeleton-block"/g) || []).length >= 4, layout)
  assert.match(html, /aria-hidden="true"/)
}
for (const [slug, cells] of [['paw-doku',81],['tic-tac-toe',9],['eren-says',4],['memory-match',16]]) {
  const html = renderToStaticMarkup(React.createElement(PageSkeleton, { path: '/games/' + slug }))
  const board = html.split('eren-skeleton-board')[1].split('</div>')[0]
  assert.equal((board.match(/eren-skeleton-block"/g) || []).length, cells, slug)
}
assert.equal(loadingLayoutForPath('/shawarma?test=1'), 'kiosk')
assert.equal(loadingLayoutForPath('/gacha/collection/'), 'collection')
assert.equal(loadingLayoutForPath('/games/purr-beat'), 'game')
assert.equal(loadingLayoutForPath('/care/reminders'), 'settings')
assert.equal(loadingLayoutForPath('/unknown-future-room'), 'room')

// Exercise the actual boot component's effects with a deterministic clock.
function boot({ readyState = 'complete', pathname = '/home' } = {}) {
  let phase = 'playing', time = 0, next = 0
  const listeners = new Map(), timers = new Map(), effects = [], refs = []
  const window = {
    addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: key => listeners.delete(key),
    setTimeout: (fn, delay) => { const id = ++next; timers.set(id, { at: time + delay, fn }); return id },
    clearTimeout: id => timers.delete(id),
  }
  const mocks = {
    react: { ...React, useState: () => [phase, value => { phase = value }], useRef: value => { const ref = { current: value }; refs.push(ref); return ref }, useEffect: fn => effects.push(fn) },
    'next/navigation': { usePathname: () => pathname },
  }
  const component = require('./lib/load_ts.cjs')(mocks)('src/components/SplashScreen.tsx').default
  global.window = window
  global.document = { readyState }
  const element = component()
  const clean = effects.map(fn => fn()).filter(Boolean)
  function advance(ms) {
    const end = time + ms
    while (true) {
      const entry = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!entry) break
      timers.delete(entry[0]); time = entry[1].at; entry[1].fn()
    }
    time = end
  }
  return { element, advance, emit: event => listeners.get(event)?.(), phase: () => phase, cleanup: () => { clean.forEach(fn => fn()); assert.equal(listeners.size, 0); assert.equal(timers.size, 0) } }
}
let b = boot(); b.emit('eren:app-busy'); b.advance(400); assert.equal(b.phase(), 'playing')
b.emit('eren:app-ready'); assert.equal(b.phase(), 'fading', 'Ready pages no longer pay a 1.2-second forced delay'); b.cleanup()
b = boot(); b.advance(399); assert.equal(b.phase(), 'playing'); b.advance(1); assert.equal(b.phase(), 'fading'); b.cleanup()
b = boot(); b.emit('eren:app-busy'); b.advance(8000); assert.equal(b.phase(), 'fading', 'Safety exit remains'); b.cleanup()
b = boot({ readyState: 'loading' }); b.advance(500); assert.equal(b.phase(), 'playing'); b.emit('load'); b.advance(400); assert.equal(b.phase(), 'fading'); b.cleanup()
b = boot({ pathname: '/privacy' }); assert.equal(b.element, null); b.cleanup()
const splash = fs.readFileSync(path.join(root, 'src/components/SplashScreen.tsx'), 'utf8')
const ast = ts.createSourceFile('SplashScreen.tsx', splash, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let fadeEffect
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[1]?.getText(ast) === '[phase]') fadeEffect = node.arguments[0].getText(ast)
  ts.forEachChild(node, visit)
}
visit(ast)
let finished = false, cancelled = false, delay, callback
const cleanupFade = new Function('phase', 'window', 'setPhase', `return (${fadeEffect})()`)(
  'fading', { setTimeout: (fn, ms) => { callback = fn; delay = ms; return 1 }, clearTimeout: () => { cancelled = true } }, value => { finished = value === 'done' },
)
assert.equal(delay, 180); callback(); assert.equal(finished, true); cleanupFade(); assert.equal(cancelled, true)
delete global.window; delete global.document

const read = file => fs.readFileSync(path.join(root, file), 'utf8')
for (const route of ['profile','settings','couple']) {
  assert.match(read(`src/app/(app)/${route}/page.tsx`), new RegExp(`return <PageSkeleton path="/${route}"`))
}
assert.match(read('src/app/(app)/memories/page.tsx'), /loading && memories\.length === 0 && <SkeletonContent/)
assert.match(read('src/app/(app)/care/reminders/page.tsx'), /loading && reminders\.length === 0 && <SkeletonContent/)
assert.match(read('src/components/talk/TalkSurface.tsx'), /loading && messages\.length === 0/)
assert.match(read('src/components/Leaderboard.tsx'), /loading && loadFailed \?/)
assert.match(read('src/components/care/CareSceneHost.tsx'), /!ready && !loadError &&/)
assert.match(read('src/components/care/CareSceneHost.tsx'), /loadError &&/)
// TypeScript also verifies every route import; these checks cover rendering and guards, not browser layout.
console.log(`Loading skeletons passed: ${routes.length} destination boundaries, 21 layouts, 4 game boards, 5 boot lifecycle cases, cached-data/error guards.`)
