const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const file = 'src/components/care/FeedScene.tsx'
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const names = ['startFoodDrag', 'moveFoodDrag', 'endFoodDrag', 'handleFeed']
const found = new Map()
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText(source))
  ts.forEachChild(node, visit)
}
visit(source)
assert.equal(found.size, names.length)
const code = ts.transpileModule([...found.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const item = { id: 'kibble', name: 'Kibble', hungerD: 15, happyD: 0, weightD: 0.03 }
let meals = 0, saves = 0, wishes = 0, taps = 0
let release
const env = {
  feedingRef: { current: false }, mounted: { current: true }, stats: {}, foodActionBusy: false, foodActionRetry: null,
  isSleeping: false, reaction: { active: false, play() { meals++ }, cancel() {} }, unlock: null,
  suppressFoodClick: { current: false }, foodDrag: { active: false }, tick() {}, DRAG_ICON: 50,
  dragRef: { current: {} }, ghostRef: { current: { style: {} } }, erenZone: (x, y) => x === 150 && y === 400,
  user: { id: 'alice' }, profile: { household_id: 'home' }, inventory: { kibble: 3 },
  setFeeding(value) { this.feeding = value }, showToast() {},
  runFoodAction(action) { assert.deepEqual(action, { kind: 'feed', foodKey: item.id }); saves++; return new Promise(resolve => { release = resolve }) },
  foodActionError: () => 'Could not save',
  isDrink: () => false, playSound() {}, setFedItem() {}, setEatIdx() {}, pickEatPose: () => 0,
  happyFinisherBeats: () => [], getDonut: () => null, monstaBuff: () => null,
  todayKey: () => 'today', dailyMenu: () => [], noteMenuFed() {}, DRINK_UNLOCK_SKINS: {},
  cat: { t: text => text }, completeTask() {},
  window: { dispatchEvent() { wishes++ } }, CustomEvent: class {},
}
const api = new Function('env', `with (env) { ${code}; return {${names.join(',')}} }`)(env)
const pointer = (x, y, extra = {}) => ({
  clientX: x, clientY: y, isPrimary: true, button: 0, pointerId: 1,
  stopPropagation() {}, currentTarget: { setPointerCapture() {} }, ...extra,
})

async function main() {
  // Same-tick presses share the ref lock even before React can re-render.
  const first = api.handleFeed(item)
  const second = api.handleFeed(item)
  assert.equal(saves, 1)
  assert.equal(meals, 0, 'No eating animation before the meal is confirmed')
  release({ ok: false })
  await Promise.all([first, second])
  assert.equal(meals, 0, 'A failed meal cannot celebrate')
  assert.equal(wishes, 0, 'A failed meal cannot grant a food wish')
  assert.equal(env.feedingRef.current, false)
  assert.equal(env.feeding, null)

  const success = api.handleFeed(item)
  release({ ok: true })
  await success
  assert.equal(meals, 1)
  assert.equal(wishes, 1)
  assert.equal(env.feedingRef.current, false)

  env.runFoodAction = async () => { throw Error('transport') }
  await api.handleFeed(item)
  assert.equal(env.feedingRef.current, false, 'Unexpected failures must release busy state')

  env.handleFeed = () => { taps++ }
  // Rebind only the drag handlers so the drop destination can be counted.
  const dragCode = ts.transpileModule(names.slice(0, 3).map(n => found.get(n)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText
  const drag = new Function('env', `with (env) { ${dragCode}; return {startFoodDrag,moveFoodDrag,endFoodDrag} }`)(env)
  drag.startFoodDrag(pointer(20, 600), item)
  drag.endFoodDrag(pointer(20, 600))
  assert.equal(taps, 0, 'A stationary press is handled only by native click')
  assert.equal(env.suppressFoodClick.current, false)

  drag.startFoodDrag(pointer(20, 600), item)
  drag.moveFoodDrag(pointer(150, 400))
  assert.equal(env.dragRef.current.active, true)
  assert.equal(env.foodDrag.active, true)
  drag.endFoodDrag(pointer(150, 400))
  assert.equal(taps, 1)
  assert.equal(env.suppressFoodClick.current, true, 'A drag must suppress its trailing click')
  assert.equal(env.foodDrag.active, false)

  drag.startFoodDrag(pointer(20, 600), item)
  drag.moveFoodDrag(pointer(150, 400))
  drag.endFoodDrag(pointer(150, 400), true)
  assert.equal(taps, 1, 'Cancellation must not feed')
  assert.equal(env.foodDrag.active, false)
  drag.startFoodDrag(pointer(20, 600), item)
  drag.moveFoodDrag(pointer(200, 300))
  drag.endFoodDrag(pointer(200, 300))
  assert.equal(taps, 1, 'Dropping away from the cat must not feed')
  drag.startFoodDrag(pointer(20, 600, { pointerId: 2, isPrimary: false }), item)
  assert.equal(env.foodDrag.active, false, 'A second finger must not start another meal')

  const text = fs.readFileSync(file, 'utf8')
  assert.match(text, /<button type="button"[^]*?aria-label=\{`Feed/)
  assert.match(text, /onPointerCancel=\{e => endFoodDrag\(e, true\)\}/)
  assert.match(text, /e.detail !== 0 && suppressFoodClick.current/)
  assert.doesNotMatch(text, /addEventListener\('touch(start|end|move)'/)
  console.log('Feed control checks passed: tap/keyboard button, same-tick lock, failed meals, mouse/touch drag, cancelled/outside drops and trailing-click suppression.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
