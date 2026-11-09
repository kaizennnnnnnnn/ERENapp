const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const mocks = {
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  '@/hooks/useCat': { useCat: () => ({ t: text => text.replace('{name}', 'Mochi') }) },
}
const load = require('./lib/load_ts.cjs')(mocks)
mocks['@/components/meadow'] = {
  ...load('src/components/meadow/tokens.ts'), ...load('src/components/meadow/Buttons.tsx'),
  ...load('src/components/meadow/Card.tsx'), MeadowIcon: load('src/components/PixelIcons.tsx').MeadowIcon,
}
const { M } = mocks['@/components/meadow']
const SleepButton = load('src/components/bedroom/SleepButton.tsx').default
const CareToast = load('src/components/care/CareToast.tsx').default
for (const state of ['tuck', 'tucking', 'wake', 'waking', 'recover', 'recovering']) {
  const html = renderToStaticMarkup(React.createElement(SleepButton, { state, onClick() {} }))
  assert.equal(/ disabled=""/.test(html), ['tucking', 'waking', 'recovering'].includes(state))
  assert.match(html, state.startsWith('recover') ? /Recover bedroom save/ : /Mochi/)
  assert.match(html, /prefers-reduced-motion/)
  assert.doesNotMatch(html, /Press Start|font-pixel|gradient|text-shadow/)
  if (state.endsWith('ing')) assert.match(html, /aria-busy="true"/)
}
assert.match(renderToStaticMarkup(React.createElement(SleepButton, { state: 'tuck', disabled: true, onClick() {} })), / disabled=""/)
for (const ok of [true, false]) {
  const html = renderToStaticMarkup(React.createElement(CareToast, { msg: '<Retry> ' + 'Long message '.repeat(20), ok, top: 180 }))
  assert.match(html, ok ? /role="status"/ : /role="alert"/)
  assert.match(html, /&lt;Retry&gt;/)
  assert.match(html, /overflow-wrap:anywhere/)
  assert.match(html, /top:180px/)
  assert.match(html, /prefers-reduced-motion/)
  assert.doesNotMatch(html, /Press Start|font-pixel|gradient|text-shadow/)
  assert.doesNotMatch(html, /opacity:\s*0/, 'Messages remain readable when entrance animations are paused')
}

const file = 'src/components/care/SleepScene.tsx', text = fs.readFileSync(file, 'utf8')
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const names = ['showResult', 'handleSleepAction', 'handleTuckIn', 'handleWakeUp'], functions = new Map(), expressions = new Map()
let cleanupEffect
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.set(node.name.text, node.getText(source))
  if (ts.isVariableDeclaration(node) && ['sleepColor', 'sleepVal', 'showAsleep'].includes(node.name.getText(source))) expressions.set(node.name.getText(source), node.initializer.getText(source))
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('mounted.current = true')) cleanupEffect = node.arguments[0].getText(source)
  ts.forEachChild(node, visit)
}
visit(source)
assert.equal(functions.size, 4)
assert.ok(cleanupEffect)
const js = ts.transpileModule([...functions.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const cleanupJs = ts.transpileModule(`const setup = ${cleanupEffect}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const color = new Function('sleepVal', 'M', `return ${expressions.get('sleepColor')}`)
assert.equal(color(85, M), M.leaf); assert.equal(color(35, M), M.energy); assert.equal(color(12, M), M.danger)
const pose = new Function('tuckedIn', 'waking', 'holdPose', `return ${expressions.get('showAsleep')}`)
assert.equal(pose(true, false, true), false, 'Optimistic save must not interrupt tuck choreography')
assert.equal(pose(false, true, false), true, 'Pending wake must retain sleeping pose')
assert.equal(pose(false, false, false), false)
assert.equal(new Function('stats', `return ${expressions.get('sleepVal')}`)({ sleep_quality: 0 }), 0)
assert.match(text, /RoomWeather room="sleep"/)
assert.match(text, /erenSleep\$\{sleepIdx \+ 1\}/)
assert.doesNotMatch(text, /SegmentMeter|SLEEP_TRACK/)

const ref = current => ({ current })
function fixture() {
  const timers = new Map(), pending = [], rewards = [], reactions = [], writes = []
  let nextTimer = 0
  const env = {
    user: { id: 'tester' }, profile:{household_id:'home'}, stats: {household_id:'home'}, tuckedIn: false, actionLock: ref(null), mounted: ref(true),
    sleepSaveBusy:false,sleepSavePending:null,saveEpoch:ref(0),saveScope:ref({}),
    poseTimer: ref(null), releasePose: ref(null), toastTimer: ref(null),
    playSound() {}, reaction: { play: beats => reactions.push(beats) }, completeTask: task => rewards.push(task),
    setTimeout(fn, ms) { timers.set(++nextTimer, { fn, ms }); return nextTimer },
    clearTimeout(id) { timers.delete(id) },
    finishSleepSession(action,recover) { writes.push([action,recover]); return new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  }
  env.currentSaveScope=env.saveScope.current
  for (const name of ['Tucking', 'HoldPose', 'SleepIdx', 'Waking', 'Recovering', 'Toast', 'ToastGood']) {
    const key = name[0].toLowerCase() + name.slice(1)
    env['set' + name] = value => { assert.equal(env.mounted.current, true, 'No state writes after unmount'); env[key] = value }
  }
  const api = new Function('env', `with (env) { ${js}; return {${names.join(',')}} }`)(env)
  const cleanup = new Function('env', `with (env) { ${cleanupJs}; return setup() }`)(env)
  return { env, api, cleanup, timers, pending, rewards, reactions, writes,
    finishPose() { const [id, timer] = [...timers].find(([, timer]) => timer.ms === 1150) ?? []; assert.ok(timer); timers.delete(id); timer.fn() },
  }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
async function main() {
  for (const missing of ['user', 'stats']) {
    const f = fixture(); f.env[missing] = null
    await f.api.handleTuckIn(); f.env.tuckedIn = true; await f.api.handleWakeUp(); assert.equal(f.writes.length, 0)
  }
  const f = fixture()
  const saving = f.api.handleTuckIn()
  assert.deepEqual(f.writes, [['tuck', false]], 'Start the write at tap time')
  await f.api.handleTuckIn(); f.env.tuckedIn = true; await f.api.handleWakeUp(); assert.equal(f.writes.length, 1)
  f.finishPose(); await flush()
  assert.equal(f.env.holdPose, false); assert.equal(f.env.tucking, true); assert.ok(f.env.actionLock.current)
  f.pending.shift().resolve({ success: true, changed:true,action:'tuck',isSleeping:true,message: 'Saved' }); await saving
  assert.deepEqual(f.rewards, ['daily_sleep']); assert.equal(f.env.actionLock.current, null); assert.equal(f.env.tucking, false)
  assert.equal(f.env.toastGood, true)
  const wake = f.api.handleWakeUp(); await f.api.handleWakeUp(); assert.equal(f.writes.length, 2)
  assert.equal(f.reactions.length, 1, 'Wake stretch must wait for confirmation')
  f.pending.shift().resolve({ success: false, message: 'Try again' }); await wake
  assert.equal(f.reactions.length, 1); assert.equal(f.env.toastGood, false); assert.equal(f.env.waking, false)
  const retry = f.api.handleWakeUp(); f.pending.shift().resolve({ success: true, changed:true,action:'wake',isSleeping:false,message: 'Awake' }); await retry
  assert.equal(f.reactions[1][0].name, 'wake'); assert.equal(f.rewards.length, 1)
  f.env.finishSleepSession = async () => { throw Error('Offline') }
  await f.api.handleWakeUp(); assert.equal(f.env.actionLock.current, null); assert.equal(f.env.waking, false); assert.match(f.env.toast, /try again/)
  for (const reject of [true, false]) {
    const failed = fixture(), attempt = failed.api.handleTuckIn()
    if (reject) failed.pending.shift().reject(Error('Offline'))
    else failed.pending.shift().resolve({ success: false, message: 'Not saved' })
    await flush(); failed.finishPose(); await attempt
    assert.equal(failed.env.toastGood, false); assert.equal(failed.env.actionLock.current, null); assert.equal(failed.rewards.length, 0)
  }
  for (const action of ['tuck', 'wake']) {
    const leaving = fixture(); leaving.env.tuckedIn = action === 'wake'
    const attempt = action === 'wake' ? leaving.api.handleWakeUp() : leaving.api.handleTuckIn()
    leaving.cleanup(); leaving.pending.shift().resolve({ success: true, message: 'Saved after leaving' }); await attempt
    assert.equal(leaving.timers.size, 0); assert.equal(leaving.env.actionLock.current, null)
  }
  for(const action of ['tuck','wake']){
    const recovery=fixture();recovery.env.sleepSavePending=action
    const pending=recovery.api.handleSleepAction(action,true);assert.equal(recovery.reactions.length,0);assert.equal(recovery.timers.size,0,'Recovery must not wait for tuck choreography')
    recovery.pending.shift().resolve({success:true,changed:true,action,isSleeping:action==='tuck',message:'Recovered'});await pending
    assert.equal(recovery.reactions.length,0);assert.equal(recovery.rewards.length,action==='tuck'?1:0);recovery.cleanup()
  }
  const noop=fixture(),attempt=noop.api.handleTuckIn();noop.finishPose();noop.pending.shift().resolve({success:true,changed:false,action:'tuck',isSleeping:true,message:'Already asleep'});await attempt;assert.equal(noop.rewards.length,0);noop.cleanup()
  for(const mode of ['account','aba','newer']){
    const stale=fixture();stale.env.tuckedIn=true;const attempt=stale.api.handleWakeUp();stale.env.saveScope.current={};if(mode!=='account')stale.env.saveEpoch.current++;if(mode==='newer')stale.env.actionLock.current=Symbol('next')
    stale.pending.shift().resolve({success:true,changed:true,action:'wake',isSleeping:false,message:'Late'});await attempt;assert.equal(stale.env.toast,null);assert.equal(stale.reactions.length,0);if(mode==='newer')assert.ok(stale.env.actionLock.current);stale.cleanup()
  }
  f.cleanup(); assert.equal(f.timers.size, 0)
  console.log('Bedroom checks passed: Meadow controls/toasts, renamed cat, loading and zero-quality states, choreography/write overlap, same-tick locks, slow saves, failed/rejected retry, confirmed-only wake stretch, rewards and unmount cleanup.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
