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
const Progress = load('src/components/wash/WashProgress.tsx').default
const html = phase => renderToStaticMarkup(React.createElement(Progress, { phase, value: 42, onRetry() {} }))
assert.match(html('soap'), /aria-label="Soap coverage"/)
assert.match(html('soap'), /aria-valuenow="42"/)
assert.match(html('rinse'), /2 of 2/)
assert.match(html('rinse'), /aria-label="Rinse progress"/)
assert.match(html('saving'), /Saving bath/)
assert.match(html('saving'), /aria-busy="true"/)
assert.doesNotMatch(html('saving') + html('error'), /Squeaky clean/)
assert.match(html('error'), /Try again/)
assert.match(html('done'), /Squeaky clean!/)
assert.match(html('sleeping'), /Sleeping/)
for (const phase of ['soap', 'rinse', 'saving', 'error', 'done', 'sleeping']) {
  assert.doesNotMatch(html(phase), /font-pixel|linear-gradient|text-shadow/)
}

const file = 'src/components/care/WashScene.tsx'
const text = fs.readFileSync(file, 'utf8')
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const names = ['onSoapDown', 'updateCoverage', 'onPointerMove', 'onSoapUp', 'onShowerDown', 'onShowerUp',
  'cancelShower', 'useSoapFromKeyboard', 'useShowerFromKeyboard', 'finishWash']
const found = new Map()
let phaseExpression
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText(source))
  if (ts.isVariableDeclaration(node)) {
    const name = node.name.getText(source)
    if (names.includes(name)) found.set(name, 'const ' + node.getText(source))
    if (name === 'progressPhase') phaseExpression = node.initializer.getText(source)
  }
  ts.forEachChild(node, visit)
}
visit(source)
assert.equal(found.size, names.length)
const js = ts.transpileModule([...found.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const getPhase = new Function('env', `with (env) { return ${phaseExpression} }`)
const ref = current => ({ current })
let calls = 0, rewards = 0, reactions = 0, resolveSave
const env = {
  user: { id: 'tester' }, isSleeping: false, coverage: 0, showShower: false, done: false, saving: false, washSaved: false,
  coverageRef: ref(0), showShowerRef: ref(false), doneRef: ref(false), savingRef: ref(false), savedRef: ref(false),
  dragSoapRef: ref(false), dragShowerRef: ref(false), soapPosRef: ref({}), showerPosRef: ref({}),
  soapRef: ref({ style: {} }), showerRef: ref({ style: {} }),
  sceneRef: ref({ getBoundingClientRect: () => ({ left: 100, top: 0, width: 360, height: 740 }) }),
  isOverEren: (x, y) => x > 200 && y > 400, markScrub() {}, useCallback: fn => fn,
  lastScrubWordRef: ref(0), bubbleId: ref(0), bubbles: [],
  playSound() {}, happyFinisherBeats: () => [], reaction: { play() { reactions++ } },
  applyAction: () => { calls++; return new Promise(resolve => { resolveSave = resolve }) },
  completeTask() { rewards++ },
}
for (const field of ['Coverage', 'ShowShower', 'DragSoap', 'DragShower', 'ScrubWordKey', 'Bubbles', 'Done', 'Saving', 'SaveError', 'WashSaved', 'Scrubbing']) {
  const key = field[0].toLowerCase() + field.slice(1)
  env['set' + field] = value => { env[key] = typeof value === 'function' ? value(env[key]) : value }
}
const api = new Function('env', `with (env) { ${js}; return {${names.join(',')}} }`)(env)
const pointer = { pointerId: 1, isPrimary: true, button: 0, currentTarget: { setPointerCapture() {} } }

async function main() {
  api.onShowerDown(pointer)
  assert.equal(env.dragShowerRef.current, false, 'Shower is locked before lathering')
  api.onSoapDown(pointer)
  api.onPointerMove({ clientX: 120, clientY: 100 })
  assert.equal(env.coverage, 0, 'Scrubbing the wall must not add coverage')
  for (let i = 0; i < 190; i++) api.onPointerMove({ clientX: 280, clientY: 550 })
  api.onSoapUp()
  assert.equal(env.coverage, 95)
  assert.equal(env.showShower, true)
  assert.equal(env.soapRef.current.style.left, '12%', 'Finished soap returns beside the bath')
  api.onShowerDown(pointer)
  for (let i = 0; i < 35; i++) api.onPointerMove({ clientX: 280, clientY: 550 })
  api.onShowerUp()
  assert.ok(env.coverage < 80)
  assert.equal(env.showerRef.current.style.top, '30%', 'Released shower returns beside the bath')
  assert.equal(calls, 0)
  api.onShowerDown(pointer)
  assert.equal(env.dragShowerRef.current, true, 'A partially rinsed shower must remain usable')
  api.updateCoverage(5)
  api.cancelShower()
  api.onShowerUp()
  assert.equal(calls, 0, 'Cancelling capture must not save a bath')

  env.coverageRef.current = 0
  env.showShowerRef.current = false
  for (let i = 0; i < 19; i++) api.useSoapFromKeyboard({ detail: 0 })
  assert.equal(env.coverage, 95)
  for (let i = 0; i < 9; i++) api.useShowerFromKeyboard({ detail: 0 })
  assert.equal(calls, 1)
  assert.equal(getPhase(env), 'saving')
  assert.equal(env.washSaved, false, 'No success banner before save confirmation')
  const duplicate = api.finishWash()
  assert.equal(calls, 1, 'Same-tick finishes must share the busy lock')
  resolveSave({ success: false, message: 'Offline' })
  await duplicate
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(getPhase(env), 'error')
  assert.equal(env.saveError, 'Offline')
  assert.equal(rewards, 0)
  const retry = api.finishWash()
  assert.equal(calls, 2)
  resolveSave({ success: true, message: 'Clean' })
  await retry
  assert.equal(getPhase(env), 'done')
  assert.equal(rewards, 1)
  assert.equal(reactions, 1, 'Retry should save without replaying the physical bath')
  await api.finishWash()
  assert.equal(calls, 2, 'A saved visit must not save or reward twice')

  env.savedRef.current = false
  env.washSaved = false
  env.applyAction = async () => { throw Error('network') }
  await api.finishWash()
  assert.equal(env.savingRef.current, false)
  assert.equal(getPhase(env), 'error')
  env.isSleeping = true
  assert.equal(getPhase(env), 'sleeping')
  assert.match(text, /onPointerCancel=\{cancelShower\}/)
  assert.match(text, /onLostPointerCapture=\{cancelShower\}/)
  assert.doesNotMatch(text, /SegmentMeter|CareToast|font-pixel/)
  console.log('Wash checks passed: Meadow states, real soap/rinse handlers, wall exclusion, resumed rinse below 80%, cancelled capture, keyboard flow, confirmed-only success, failed-save retry and same-tick lock.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
