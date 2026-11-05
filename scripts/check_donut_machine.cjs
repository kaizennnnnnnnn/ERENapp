const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const createLoader = require('./lib/load_ts.cjs')

const USER = 'donut-user'
const OTHER_USER = 'other-user'
const NOW = Date.parse('2026-11-02T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const recent = new Date(NOW - HOUR).toISOString()
const expired = new Date(NOW - 25 * HOUR).toISOString()
const future = new Date(NOW + HOUR).toISOString()
const success = stamp => ({ data: { last_free_donut: stamp }, error: null })
const failure = { data: null, error: { message: 'Service unavailable', code: '503' } }

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function reactFixture() {
  const states = []
  const refs = []
  const callbacks = []
  const effects = []
  let stateIndex, refIndex, callbackIndex, effectIndex, scheduled
  let mounted = true
  let lateUpdates = 0
  const changed = (previous, deps) => !previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))
  return {
    useState(initial) {
      const index = stateIndex++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => {
        if (!mounted) lateUpdates++
        states[index] = typeof value === 'function' ? value(states[index]) : value
      }]
    },
    useRef(initial) {
      const index = refIndex++
      return refs[index] ?? (refs[index] = { current: initial })
    },
    useCallback(callback, deps) {
      const index = callbackIndex++
      if (changed(callbacks[index], deps)) callbacks[index] = { deps, callback }
      return callbacks[index].callback
    },
    useEffect(setup, deps) {
      const index = effectIndex++
      const previous = effects[index]
      if (changed(previous, deps)) scheduled.push(() => {
        previous?.cleanup?.()
        effects[index] = { deps, cleanup: setup() }
      })
    },
    render(run) {
      stateIndex = refIndex = callbackIndex = effectIndex = 0
      scheduled = []
      const result = run()
      for (const effect of scheduled) effect()
      return result
    },
    unmount() {
      for (const effect of effects) effect?.cleanup?.()
      mounted = false
    },
    get lateUpdates() { return lateUpdates },
  }
}

function fixture(options = {}) {
  const { response = success(null), blockedStorage = false } = options
  const userId = Object.prototype.hasOwnProperty.call(options, 'userId') ? options.userId : USER
  const react = reactFixture()
  const storage = new Map()
  const cacheCalls = []
  const reads = []
  const retries = []
  const foreground = new Set()
  const pending = []
  const scripted = []
  const state = { userId, response }
  global.localStorage = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (...args) => {
    cacheCalls.push({ method, args })
    if (blockedStorage) throw new Error('Storage is blocked')
    if (method === 'getItem') return storage.get(args[0]) ?? null
    if (method === 'setItem') storage.set(args[0], args[1])
    else if (method === 'removeItem') storage.delete(args[0])
  }]))
  const client = {
    from(table) {
      assert.equal(table, 'user_gacha_state')
      const request = {}
      const query = {
        select(columns) { assert.equal(columns, 'last_free_donut'); return query },
        eq(column, value) { assert.equal(column, 'user_id'); request.userId = value; return query },
        abortSignal(signal) { assert.ok(signal instanceof AbortSignal); request.signal = signal; return query },
        async maybeSingle() {
          assert.ok(request.signal, 'Every read must attach the bounded retry signal')
          reads.push(request)
          const next = scripted.length ? scripted.shift() : state.response
          if (next instanceof Error) throw next
          return await next
        },
        upsert() { throw new Error('The donut cooldown hook must not write') },
        update() { throw new Error('The donut cooldown hook must not write') },
        insert() { throw new Error('The donut cooldown hook must not write') },
      }
      return query
    },
  }
  // Use the real hook and cooldown math, with only immediate bounded retries mocked.
  const writeWithRetry = (run, count = 2, shouldRetry = () => true) => {
    retries.push({ count })
    const task = (async () => {
      let result
      for (let attempt = 0; attempt <= count; attempt++) {
        try { result = await run(new AbortController().signal) }
        catch (error) { result = { data: null, error: { message: error.message } } }
        if (!result.error || !shouldRetry(result.error)) break
      }
      return result
    })()
    pending.push(task)
    return task
  }
  const load = createLoader({
    react,
    '@/lib/supabase/client': { createClient: () => client },
    '@/lib/supabaseRetry': { writeWithRetry, withRetry() { throw new Error('Cooldown reads need bounded writeWithRetry, not an unbounded read') } },
    '@/lib/onForeground': { onForeground: callback => { foreground.add(callback); return () => foreground.delete(callback) } },
  })
  const { useDonutMachine } = load('src/hooks/useDonutMachine.ts')
  const harness = {
    state, storage, cacheCalls, reads, retries, foreground, scripted,
    render(nextUser = state.userId) {
      state.userId = nextUser
      return react.render(() => useDonutMachine(nextUser))
    },
    async drain() {
      while (pending.length) await Promise.all(pending.splice(0))
      await Promise.resolve()
    },
    async settle() {
      await harness.drain()
      return harness.render()
    },
    unmount: () => react.unmount(),
    get lateUpdates() { return react.lateUpdates },
  }
  return harness
}

const tests = []
function test(name, run) { tests.push({ name, run }) }

test('actual hook is read-only and exposes only the saved-spin acceptance API', async () => {
  const file = path.resolve(__dirname, '../src/hooks/useDonutMachine.ts')
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isPropertyAccessExpression(node)) assert.ok(!['upsert', 'insert', 'update', 'delete'].includes(node.name.text), 'No client cooldown writes')
    if (ts.isIdentifier(node)) assert.notEqual(node.text, 'consumeFreeSpin', 'No locally stamped consumeFreeSpin API')
    ts.forEachChild(node, visit)
  }
  visit(source)
  const harness = fixture()
  const view = harness.render()
  for (const name of ['loaded', 'readError', 'freeReady', 'lastFree', 'msUntilFree', 'acceptSavedSpin', 'refresh']) assert.ok(name in view)
  assert.equal(view.consumeFreeSpin, undefined)
  assert.equal(view.loaded, false)
  assert.equal(view.lastFree, undefined)
  assert.equal(view.freeReady, false, 'Unknown is not equivalent to never spun')
  assert.equal((await harness.settle()).freeReady, true)
  harness.unmount()
})

test('uncached or stale-cached read failure cannot offer a free spin', async () => {
  for (const cached of [undefined, expired]) {
    const harness = fixture({ response: failure })
    if (cached) harness.storage.set(`eren_donut_free_${USER}`, cached)
    harness.render()
    const view = await harness.settle()
    assert.equal(view.loaded, false)
    assert.equal(view.readError, true)
    assert.equal(view.freeReady, false)
    assert.equal(view.lastFree, undefined)
    assert.equal(harness.reads.length, 3)
    assert.equal(harness.cacheCalls.length, 0, 'A failed read must not cache never-spun or erase a hint')
    harness.unmount()
  }
})

test('rejected queries become readError and refresh can recover without an unhandled rejection', async () => {
  const harness = fixture({ response: new Error('Offline/DNS failure') })
  harness.render()
  let view = await harness.settle()
  assert.equal(view.loaded, false)
  assert.equal(view.readError, true)
  assert.equal(view.freeReady, false)
  assert.equal(harness.reads.length, 3)
  harness.state.response = success(recent)
  await view.refresh()
  view = await harness.settle()
  assert.equal(view.loaded, true)
  assert.equal(view.readError, false)
  assert.equal(view.lastFree, recent)
  assert.equal(view.freeReady, false)
  harness.unmount()
})

test('all reads use bounded writeWithRetry with fresh AbortSignals and a finite attempt count', async () => {
  const harness = fixture({ response: failure })
  harness.render()
  await harness.settle()
  assert.deepEqual(harness.retries, [{ count: 2 }])
  assert.equal(harness.reads.length, 3)
  assert.equal(new Set(harness.reads.map(read => read.signal)).size, 3)
  assert.ok(harness.reads.every(read => read.userId === USER))
  harness.scripted.push(failure, success(null))
  await harness.render().refresh()
  const view = await harness.settle()
  assert.equal(harness.retries.length, 2)
  assert.equal(harness.reads.length, 5, 'Stop retrying immediately after a successful read')
  assert.equal(view.loaded, true)
  assert.equal(view.freeReady, true)
  assert.equal(view.readError, false)
  harness.unmount()
})

test('blocked localStorage cannot turn a saved read or accepted spin into failure', async () => {
  for (const stamp of [null, recent]) {
    const harness = fixture({ response: success(stamp), blockedStorage: true })
    harness.render()
    let view = await harness.settle()
    assert.equal(view.loaded, true)
    assert.equal(view.readError, false)
    assert.equal(view.lastFree, stamp)
    assert.equal(view.freeReady, stamp === null)
    view.acceptSavedSpin(recent)
    view = harness.render()
    assert.equal(view.lastFree, recent)
    assert.equal(view.loaded, true)
    assert.equal(view.readError, false)
    assert.equal(view.freeReady, false)
    assert.ok(harness.cacheCalls.some(call => call.method === (stamp === null ? 'removeItem' : 'setItem')))
    harness.unmount()
  }
})

test('only confirmed missing/expired timestamps are free; recent, future, and invalid stamps are not', async () => {
  for (const [stamp, ready] of [[null, true], [expired, true], [recent, false], [future, false], ['not-a-timestamp', false]]) {
    const harness = fixture({ response: success(stamp) })
    harness.render()
    const view = await harness.settle()
    assert.equal(view.loaded, true)
    assert.equal(view.lastFree, stamp)
    assert.equal(view.freeReady, ready, `Unexpected eligibility for ${stamp}`)
    assert.ok(Number.isFinite(view.msUntilFree))
    assert.equal(view.msUntilFree === 0, ready)
    view.acceptSavedSpin(stamp)
    assert.equal(harness.render().freeReady, ready, 'Saved-spin timestamps use the same cooldown rules')
    harness.unmount()
  }
  const harness = fixture({ response: { data: null, error: null } })
  harness.render()
  assert.equal((await harness.settle()).freeReady, true, 'A confirmed missing row means never spun')
  harness.unmount()
})

test('acceptSavedSpin invalidates an older read and caches only the server timestamp', async () => {
  const stale = deferred()
  const harness = fixture({ response: stale.promise })
  let view = harness.render()
  view.acceptSavedSpin(recent)
  view = harness.render()
  assert.equal(view.loaded, true)
  assert.equal(view.readError, false)
  assert.equal(view.lastFree, recent)
  assert.equal(view.freeReady, false)
  assert.equal(harness.storage.get(`eren_donut_free_${USER}`), recent)
  stale.resolve(success(null))
  view = await harness.settle()
  assert.equal(view.lastFree, recent, 'A stale never-spun read must not undo an accepted saved spin')
  assert.equal(view.freeReady, false)
  assert.equal(harness.cacheCalls.length, 1, 'The ignored stale read must not touch the cache')
  harness.unmount()
})

test('only the newest refresh may publish a timestamp or cache entry', async () => {
  const harness = fixture()
  harness.render()
  await harness.settle()
  const older = deferred()
  const newer = deferred()
  harness.scripted.push(older.promise, newer.promise)
  const first = harness.render().refresh()
  const second = harness.render().refresh()
  newer.resolve(success(recent))
  await second
  assert.equal(harness.render().lastFree, recent)
  older.resolve(success(expired))
  await first
  const view = await harness.settle()
  assert.equal(view.lastFree, recent)
  assert.equal(view.freeReady, false)
  assert.equal(harness.storage.get(`eren_donut_free_${USER}`), recent)
  harness.unmount()
})

test('unmount guards pending reads and captured acceptance, and removes foreground listeners', async () => {
  const pendingRead = deferred()
  const harness = fixture({ response: pendingRead.promise })
  const view = harness.render()
  assert.equal(harness.foreground.size, 1)
  harness.unmount()
  assert.equal(harness.foreground.size, 0)
  view.acceptSavedSpin(recent)
  pendingRead.resolve(success(null))
  // Do not rerender an unmounted hook; just drain its pending read.
  await harness.drain()
  assert.equal(harness.lateUpdates, 0)
  assert.equal(harness.cacheCalls.length, 0)
})

test('user changes ignore old reads, reset eligibility, and replace foreground subscriptions', async () => {
  const oldRead = deferred()
  const harness = fixture({ response: oldRead.promise })
  harness.render()
  harness.state.response = success(null)
  harness.render(OTHER_USER)
  assert.equal(harness.render().loaded, false, 'Do not keep the previous user eligibility while loading')
  assert.equal(harness.render().freeReady, false)
  assert.equal(harness.foreground.size, 1)
  oldRead.resolve(success(recent))
  const view = await harness.settle()
  assert.equal(view.lastFree, null)
  assert.equal(view.loaded, true)
  assert.equal(view.freeReady, true)
  assert.equal(harness.cacheCalls.filter(call => call.args[0] === `eren_donut_free_${USER}`).length, 0)
  assert.ok(harness.cacheCalls.some(call => call.args[0] === `eren_donut_free_${OTHER_USER}`))
  const count = harness.reads.length
  harness.state.response = success(recent)
  for (const foreground of harness.foreground) foreground()
  assert.equal((await harness.settle()).freeReady, false)
  assert.equal(harness.reads.length, count + 1)
  assert.equal(harness.reads.at(-1).userId, OTHER_USER)
  harness.unmount()
})

test('a captured old-user acceptSavedSpin cannot overwrite the active user cooldown', async () => {
  const harness = fixture({ response: success(null) })
  const oldView = harness.render()
  await harness.settle()
  harness.state.response = success(recent)
  harness.render(OTHER_USER)
  let view = await harness.settle()
  assert.equal(view.lastFree, recent)
  assert.equal(view.freeReady, false)
  const count = harness.cacheCalls.length
  oldView.acceptSavedSpin(null)
  view = harness.render()
  assert.equal(view.lastFree, recent, 'A saved spin for the old user cannot change the active user timestamp')
  assert.equal(view.freeReady, false)
  assert.equal(harness.cacheCalls.length, count, 'An ignored old-user callback must not write a cache entry')
  harness.unmount()
})

test('old-user acceptance cannot invalidate a pending read for the active user', async () => {
  const harness = fixture()
  const oldView = harness.render()
  await harness.settle()
  const currentRead = deferred()
  harness.state.response = currentRead.promise
  harness.render(OTHER_USER)
  oldView.acceptSavedSpin(null)
  currentRead.resolve(success(recent))
  const view = await harness.settle()
  assert.equal(view.loaded, true)
  assert.equal(view.lastFree, recent, 'Reject the old-user callback before it increments the current read version')
  assert.equal(view.freeReady, false)
  harness.unmount()
})

test('anonymous users never read or offer a free spin', async () => {
  for (const userId of [null, undefined, '']) {
    const harness = fixture({ userId })
    harness.render(userId)
    const view = await harness.settle()
    assert.equal(harness.reads.length, 0)
    assert.equal(view.loaded, false)
    assert.equal(view.freeReady, false)
    assert.equal(view.readError, false)
    harness.unmount()
  }
})

async function main() {
  const now = Date.now
  const storage = Object.getOwnPropertyDescriptor(global, 'localStorage')
  Date.now = () => NOW
  let failed = 0
  try {
    for (const { name, run } of tests) {
      try { await run(); console.log(`PASS ${name}`) }
      catch (error) { failed++; console.error(`FAIL ${name}`); console.error(error) }
    }
  } finally {
    Date.now = now
    if (storage) Object.defineProperty(global, 'localStorage', storage)
    else delete global.localStorage
  }
  console.log(`Donut machine checks: ${tests.length - failed}/${tests.length} passed (actual hook; mock reads only).`)
  if (failed) process.exitCode = 1
}

main().catch(error => { console.error(error); process.exitCode = 1 })
