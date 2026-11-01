const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const mocks = { 'next/link': ({ children, ...props }) => React.createElement('a', props, children) }
const load = require('./lib/load_ts.cjs')(mocks)
mocks['@/components/meadow'] = { ...load('src/components/meadow/tokens.ts'), ...load('src/components/meadow/Buttons.tsx'), MeadowIcon: load('src/components/PixelIcons.tsx').MeadowIcon }
const { M } = mocks['@/components/meadow']
const DoneButton = load('src/components/playroom/DonePlayingButton.tsx').default
for (const state of ['locked', 'ready', 'saving', 'done']) {
  const html = renderToStaticMarkup(React.createElement(DoneButton, { state, onClick() {} }))
  assert.equal(/ disabled=""/.test(html), state !== 'ready')
  assert.doesNotMatch(html, /Press Start|font-pixel|text-shadow/)
  assert.match(html, /prefers-reduced-motion/)
  assert.match(html, /playBounce/)
  if (state === 'saving') assert.match(html, /aria-busy="true"/)
  if (state === 'done') assert.match(html, /Great session!/)
}
const file = 'src/components/care/PlayScene.tsx', text = fs.readFileSync(file, 'utf8')
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const wanted = ['floorY', 'animateBall', 'handleThrow', 'handleDone'], functions = new Map()
let energyExpression
function visit(node) {
  if (ts.isFunctionDeclaration(node) && wanted.includes(node.name?.text)) functions.set(node.name.text, node.getText(source))
  if (ts.isVariableDeclaration(node)) {
    if (wanted.includes(node.name.getText(source))) functions.set(node.name.getText(source), 'const ' + node.getText(source))
    if (node.name.getText(source) === 'energyColor') energyExpression = node.initializer.getText(source)
  }
  ts.forEachChild(node, visit)
}
visit(source); assert.equal(functions.size, 4)
const js = ts.transpileModule([...functions.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const color = new Function('energy', 'M', `return ${energyExpression}`)
assert.equal(color(90, M), M.leaf); assert.equal(color(35, M), M.energy); assert.equal(color(12, M), M.danger)
assert.doesNotMatch(text, /font-pixel|Press Start|SegmentMeter|ENERGY_TRACK/)
assert.match(text, /Playroom energy/); assert.match(text, /ErenBell_tail/); assert.match(text, /RoomWeather room="play"/)
const ref = current => ({ current }), frames = new Map(), timers = new Map()
let nextFrame = 0, nextTimer = 0, calls = 0, rewards = 0, resolveSave
const env = {
  user: { id: 'tester' }, done: false, saving: false, throwCount: 0, isSleeping: false, ballPos: { x: 50, y: 84 }, trailDots: [],
  sceneRef: ref({ getBoundingClientRect: () => ({ left: 100, top: 0, width: 360, height: 740 }) }),
  footerRef: ref({ getBoundingClientRect: () => ({ top: 585 }) }), animRef: ref(null), trailId: ref(0), lastPounceRef: ref(0),
  reactionRef: ref({ play() {} }), reaction: { play() {} }, saveLock: ref(false), toastTimer: ref(null),
  useCallback: fn => fn, playSound() {}, happyFinisherBeats: () => [], completeTask() { rewards++ },
  requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame }, cancelAnimationFrame(id) { frames.delete(id) },
  setTimeout(fn, ms) { timers.set(++nextTimer, { fn, ms }); return nextTimer }, clearTimeout(id) { timers.delete(id) },
  applyAction() { calls++; return new Promise(resolve => { resolveSave = resolve }) },
}
for (const name of ['BallPos', 'TrailDots', 'BallMoving', 'LookDir', 'ThrowCount', 'Saving', 'Done', 'Toast', 'ToastGood']) {
  const key = name[0].toLowerCase() + name.slice(1)
  env['set' + name] = value => { env[key] = typeof value === 'function' ? value(env[key]) : value }
}
const api = new Function('env', `with (env) { ${js}; return {${wanted.join(',')}} }`)(env)
env.floorY = api.floorY; env.animateBall = api.animateBall
async function main() {
  const floor = api.floorY(); assert.ok(floor > 70 && floor < 80)
  env.ballPos = { x: 50, y: floor }
  api.handleThrow({ clientX: 280, clientY: floor / 100 * 740 })
  assert.equal(env.throwCount, 0, 'Tapping exactly on the ball must not create NaN velocity')
  api.handleThrow({ clientX: 380, clientY: 320 }); assert.equal(env.throwCount, 1)
  for (let i = 0; frames.size && i < 500; i++) {
    const [id, fn] = frames.entries().next().value; frames.delete(id); fn()
    assert.ok(Number.isFinite(env.ballPos.x) && Number.isFinite(env.ballPos.y))
    assert.ok(env.ballPos.y <= floor && env.ballPos.x >= 3 && env.ballPos.x <= 97)
  }
  assert.equal(frames.size, 0, 'The ball must settle above the controls')
  const saving = api.handleDone(); await api.handleDone(); assert.equal(calls, 1); assert.equal(env.saving, true)
  resolveSave({ success: false, message: 'Try again' }); await saving
  assert.equal(env.done, false); assert.equal(env.saving, false); assert.equal(rewards, 0)
  const retry = api.handleDone(); resolveSave({ success: true, message: 'Saved' }); await retry
  assert.equal(calls, 2); assert.equal(env.done, true); assert.equal(rewards, 1)
  await api.handleDone(); assert.equal(calls, 2, 'Completed sessions cannot be saved twice')
  env.done = false; env.applyAction = async () => { throw Error('Offline') }
  await api.handleDone(); assert.equal(env.done, false); assert.equal(env.saving, false); assert.match(env.toast, /try again/)
  env.isSleeping = true; const throws = env.throwCount; api.handleThrow({ clientX: 380, clientY: 320 }); assert.equal(env.throwCount, throws)
  await api.handleDone(); assert.equal(env.saveLock.current, false)
  console.log('Playroom checks passed: Meadow button states, energy colours, retained animation/art, finite throws, footer-safe ball bounds, single save, failure/exception retry, successful completion and sleeping guards.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
