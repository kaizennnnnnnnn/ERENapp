const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const file = 'src/components/care/VetScene.tsx', text = fs.readFileSync(file, 'utf8')
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const names = ['doCheckup', 'giveMedicine', 'giveLolipop', 'waitForCare', 'showResult', 'formatWait', 'lolipopReadyAt', 'markLolipopNow']
const found = new Map()
let setupEffect
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText(source))
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('mounted.current = true')) setupEffect = node.arguments[0].getText(source)
  ts.forEachChild(node, visit)
}
visit(source); assert.equal(found.size, names.length); assert.ok(setupEffect)
const js = ts.transpileModule([...found.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const setupJs = ts.transpileModule(`const setup = ${setupEffect}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
assert.doesNotMatch(text, /daily_wash|useTasks/, 'Medicine must not grant the bathing task or its coins/XP')
assert.match(fs.readFileSync('src/components/care/WashScene.tsx', 'utf8'), /completeTask\('daily_wash'\)/)
assert.match(text, /giving \|\| \(!healthy && !medGiven\)/, 'An optimistic cure must not expose the treat button mid-dose')

const COOLDOWN = 30 * 60 * 1000, KEY = 'test-lollipop', EPOCH = 1900000000000
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function fixture({ healthy = false, store = new Map(), checkDone = true } = {}) {
  const timers = new Map(), writes = [], pending = [], reactions = [], events = []
  const windowListeners = new Map(), documentListeners = new Map()
  const clock = { now: EPOCH }
  let timerId = 0, storageBlocked = false, cancelled = 0
  const ref = current => ({ current })
  const env = {
    user: { id: 'tester' }, stats: {}, healthy, checkDone, medGiven: false, isSleeping: false,
    readyAt: 0, now: EPOCH, giving: false, checking: false, lolBusy: false,
    actionLock: ref(false), mounted: ref(true), careDelays: ref(new Map()), toastTimer: ref(null), celebrationTimer: ref(null),
    LOLIPOP_AT_KEY: KEY, LOLIPOP_COOLDOWN_MS: COOLDOWN, CELEBRATE_MS: 7000,
    Date: class extends Date { static now() { return clock.now } }, Event,
    playSound() {}, pickEatPose: () => 0, happyFinisherBeats: () => [{ name: 'finish', ms: 900 }],
    reaction: { play: beats => reactions.push(beats), cancel: () => { cancelled++ } },
    setTimeout(fn, ms) { timers.set(++timerId, { fn, at: clock.now + ms }); return timerId },
    clearTimeout(id) { timers.delete(id) },
    applyAction(user, action) { writes.push([user, action]); return new Promise((resolve, reject) => pending.push({ resolve, reject })) },
    localStorage: {
      getItem(key) { if (storageBlocked) throw Error('Blocked'); return store.get(key) ?? null },
      setItem(key, value) { if (storageBlocked) throw Error('Blocked'); store.set(key, value) },
    },
    window: {
      addEventListener: (name, fn) => windowListeners.set(name, fn), removeEventListener: name => windowListeners.delete(name),
      dispatchEvent: event => events.push(event.type),
    },
    document: { visibilityState: 'visible', addEventListener: (name, fn) => documentListeners.set(name, fn), removeEventListener: name => documentListeners.delete(name) },
  }
  for (const name of ['Giving', 'MedGiven', 'Checking', 'CheckDone', 'Toast', 'TreatFlow', 'LolBusy', 'EatIdx', 'Now', 'ReadyAt', 'LolJustGiven']) {
    const key = name[0].toLowerCase() + name.slice(1)
    env['set' + name] = value => {
      assert.equal(env.mounted.current, true, `No ${key} update after leaving`)
      env[key] = typeof value === 'function' ? value(env[key]) : value
    }
  }
  const api = new Function('env', `with (env) { ${js}; return {${names.join(',')}} }`)(env)
  Object.assign(env, api)
  const cleanup = new Function('env', `with (env) { ${setupJs}; return setup() }`)(env)
  async function advance(ms) {
    const end = clock.now + ms
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      clock.now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush()
    }
    clock.now = end; await flush()
  }
  return { env, api, cleanup, advance, clock, timers, writes, pending, reactions, events, store, windowListeners, documentListeners,
    blockStorage() { storageBlocked = true }, get cancelled() { return cancelled } }
}
const success = { success: true, message: 'Saved' }, failure = { success: false, message: 'Please try again' }
async function main() {
  for (const method of ['doCheckup', 'giveMedicine', 'giveLolipop']) {
    for (const guard of ['no-user', 'no-stats', 'sleeping']) {
      const f = fixture({ healthy: method === 'giveLolipop', checkDone: method !== 'doCheckup' })
      if (guard === 'no-user') f.env.user = null
      if (guard === 'no-stats') f.env.stats = null
      if (guard === 'sleeping') f.env.isSleeping = true
      await f.api[method](); assert.equal(f.writes.length, 0); assert.equal(f.env.actionLock.current, false); assert.equal(f.timers.size, 0)
      f.cleanup()
    }
  }
  const check = fixture({ checkDone: false }), checking = check.api.doCheckup()
  await check.api.doCheckup(); await check.api.giveMedicine(); await check.api.giveLolipop()
  assert.equal(check.env.checking, true); assert.equal(check.writes.length, 0)
  await check.advance(1200); await checking; await check.api.doCheckup()
  assert.deepEqual(check.events, ['eren:vet-checkup']); assert.equal(check.env.checkDone, true); assert.equal(check.env.checking, false); check.cleanup()
  for (const [method, options] of [['giveMedicine', { healthy: true }], ['giveMedicine', { checkDone: false }], ['giveLolipop', { healthy: false }], ['giveLolipop', { healthy: true, checkDone: false }]]) {
    const f = fixture(options); await f.api[method](); assert.equal(f.writes.length, 0); assert.equal(f.env.actionLock.current, false); f.cleanup()
  }

  const medicine = fixture(), dose = medicine.api.giveMedicine()
  assert.deepEqual(medicine.writes, [['tester', 'medicine']], 'Save starts immediately under the gulp')
  await medicine.api.giveMedicine(); medicine.env.healthy = true; await medicine.api.giveLolipop()
  assert.equal(medicine.writes.length, 1)
  await medicine.advance(600)
  assert.equal(medicine.env.giving, true); assert.deepEqual(medicine.reactions.flat().map(b => b.name), ['grimace'])
  medicine.pending.shift().resolve(failure); await dose
  assert.equal(medicine.env.giving, false); assert.equal(medicine.env.medGiven, false); assert.equal(medicine.env.toast.ok, false)
  assert.equal(medicine.env.actionLock.current, false)
  medicine.env.healthy = false
  const retry = medicine.api.giveMedicine(); medicine.pending.shift().resolve(success); await medicine.advance(600)
  assert.equal(medicine.env.medGiven, true); assert.equal(medicine.env.giving, true)
  assert.deepEqual(medicine.reactions.at(-1).map(b => b.name), ['recover', 'finish'])
  medicine.env.healthy = true; await medicine.api.giveLolipop(); assert.equal(medicine.writes.length, 2)
  await medicine.advance(1500); await retry; assert.equal(medicine.env.giving, false); assert.equal(medicine.env.actionLock.current, false)
  await medicine.api.giveMedicine(); assert.equal(medicine.writes.length, 2); medicine.cleanup()

  for (const method of ['giveMedicine', 'giveLolipop']) {
    const f = fixture({ healthy: method === 'giveLolipop' }), attempt = f.api[method]()
    f.pending.shift().reject(Error('Offline'))
    await new Promise(resolve => setImmediate(resolve))
    await f.advance(method === 'giveMedicine' ? 600 : 150); await attempt
    assert.equal(f.env.actionLock.current, false); assert.equal(f.env.giving, false); assert.equal(f.env.lolBusy, false)
    assert.equal(f.env.toast.ok, false); assert.equal(f.store.size, 0)
    assert.ok(!f.reactions.flat().some(b => ['recover', 'lick', 'lick2', 'finish'].includes(b.name)), 'Failed saves never celebrate')
    f.cleanup()
  }
  const lol = fixture({ healthy: true }), treat = lol.api.giveLolipop()
  await lol.api.giveLolipop(); await lol.api.doCheckup(); await lol.api.giveMedicine(); assert.equal(lol.writes.length, 1)
  await lol.advance(150); assert.equal(lol.store.size, 0); assert.equal(lol.env.lolBusy, true)
  assert.deepEqual(lol.reactions.flat().map(b => b.name), ['unwrap'])
  lol.pending.shift().resolve(success); await flush()
  assert.equal(Number(lol.store.get(KEY)), lol.clock.now); assert.equal(lol.env.readyAt, lol.clock.now + COOLDOWN)
  assert.deepEqual(lol.reactions.at(-1).map(b => b.name), ['lick', 'lick2', 'finish'])
  await lol.api.giveLolipop(); assert.equal(lol.writes.length, 1)
  await lol.advance(3550); await treat; assert.equal(lol.env.lolBusy, false); assert.equal(lol.env.lolJustGiven, true)
  await lol.api.giveLolipop(); assert.equal(lol.writes.length, 1, 'Confirmed cooldown prevents another treat')
  await lol.advance(3450); assert.equal(lol.env.lolJustGiven, false); lol.cleanup()

  const failedTreat = fixture({ healthy: true }), failedAttempt = failedTreat.api.giveLolipop()
  failedTreat.pending.shift().resolve(failure); await failedTreat.advance(150); await failedAttempt
  assert.equal(failedTreat.store.size, 0); assert.equal(failedTreat.env.readyAt, 0); assert.equal(failedTreat.env.lolBusy, false)
  const again = failedTreat.api.giveLolipop(); failedTreat.pending.shift().resolve(success)
  await failedTreat.advance(150); await failedTreat.advance(3550); await again; assert.equal(failedTreat.store.size, 1); failedTreat.cleanup()

  for (const method of ['doCheckup', 'giveMedicine', 'giveLolipop']) {
    const f = fixture({ healthy: method === 'giveLolipop', checkDone: method !== 'doCheckup' }), attempt = f.api[method]()
    f.cleanup()
    if (method !== 'doCheckup') f.pending.shift().resolve(success)
    await attempt
    assert.equal(f.timers.size, 0); assert.equal(f.env.actionLock.current, false); assert.equal(f.events.length, 0)
    assert.equal(f.windowListeners.size + f.documentListeners.size, 0)
    if (method === 'giveLolipop') {
      assert.equal(f.store.size, 1, 'A treat saved after leaving still starts the per-device cooldown')
      const reopened = fixture({ healthy: true, store: f.store }); await reopened.api.giveLolipop(); assert.equal(reopened.writes.length, 0); reopened.cleanup()
    }
  }
  const animation = fixture({ healthy: true }), animated = animation.api.giveLolipop()
  animation.pending.shift().resolve(success); await animation.advance(150); animation.cleanup(); await animated
  assert.equal(animation.timers.size, 0, 'Leaving during the lick sequence clears every UI timer')

  const stale = fixture({ healthy: true }); stale.store.set(KEY, String(stale.clock.now)); await stale.api.giveLolipop()
  assert.equal(stale.writes.length, 0, 'Recheck storage at tap time, not only when the room mounted'); stale.cleanup()
  const synced = fixture({ healthy: true }); synced.store.set(KEY, String(synced.clock.now))
  synced.windowListeners.get('storage')({ key: 'another-key' }); assert.equal(synced.env.readyAt, 0)
  synced.windowListeners.get('storage')({ key: KEY }); assert.equal(synced.env.readyAt, synced.clock.now + COOLDOWN)
  synced.documentListeners.get('visibilitychange')(); await synced.api.giveLolipop(); assert.equal(synced.writes.length, 0); synced.cleanup()
  const privateMode = fixture({ healthy: true }); privateMode.blockStorage()
  const privateTreat = privateMode.api.giveLolipop(); privateMode.pending.shift().resolve(success)
  await privateMode.advance(150); await privateMode.advance(3550); await privateTreat
  privateMode.documentListeners.get('visibilitychange')(); await privateMode.api.giveLolipop()
  assert.equal(privateMode.writes.length, 1, 'Blocked storage must retain this mounted room\'s in-memory cooldown'); privateMode.cleanup()

  const helpers = fixture()
  helpers.store.set(KEY, String(EPOCH + 1)); assert.equal(helpers.api.lolipopReadyAt(), 0)
  helpers.store.set(KEY, 'invalid'); assert.equal(helpers.api.lolipopReadyAt(), 0)
  assert.equal(helpers.api.formatWait(45000), '45s'); assert.equal(helpers.api.formatWait(60001), '2m'); helpers.cleanup()
  console.log('Vet action checks passed: loading/sleep/eligibility guards, checkup wish once, immediate single saves, failure/exception retry, confirmed-only full reactions, correct quest attribution, cooldown sync/private storage, saved-after-leaving cooldown and timer/listener cleanup.')
}
const watchdog = setTimeout(() => { console.error('Vet checks stalled on an unresolved fake timer'); process.exitCode = 1 }, 5000)
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => clearTimeout(watchdog))
