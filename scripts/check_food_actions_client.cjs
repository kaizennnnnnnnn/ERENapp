const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const createLoader = require('./lib/load_ts.cjs')

const USER = 'food-user'
const HOME = 'food-home'
const OTHER_HOME = 'other-home'
const PROFILE_UPDATED_EVENT = 'eren:profile-updated'
const clone = value => JSON.parse(JSON.stringify(value))
const cases = [
  { action: { kind: 'buy', foodKey: 'milk', source: 'kitchen' }, name: 'purchase_food_atomic', args: { p_food_key: 'milk', p_source: 'kitchen' } },
  { action: { kind: 'buy', foodKey: 'donut_honey', source: 'bakery' }, name: 'purchase_food_atomic', args: { p_food_key: 'donut_honey', p_source: 'bakery' } },
  { action: { kind: 'feed', foodKey: 'milk' }, name: 'feed_food_atomic', args: { p_food_key: 'milk' } },
  { action: { kind: 'spin', useFree: false }, name: 'spin_donut_atomic', args: { p_use_free: false } },
  { action: { kind: 'spin', useFree: true }, name: 'spin_donut_atomic', args: { p_use_free: true } },
]

function browser() {
  const storage = new Map()
  const events = []
  const listeners = new Map()
  global.sessionStorage = {
    get length() { return storage.size },
    key: index => Array.from(storage.keys())[index] ?? null,
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  }
  global.CustomEvent = class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail }
  }
  global.window = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(listener)
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    dispatchEvent(event) {
      events.push(event)
      for (const listener of listeners.get(event.type) ?? []) listener(event)
      return true
    },
  }
  return { storage, events, listeners }
}

function initialStats(householdId = HOME) {
  return {
    household_id: householdId, hunger: 20, happiness: 30, energy: 40,
    food_by_user: { [USER]: { milk: 1 }, partner: { fish: 2 } },
    food_inventory: {}, last_fed_at: null, is_sleeping: false,
  }
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

// This fake only models receipt replay and resource exhaustion, not SQL food rules.
function server() {
  const houses = new Map([HOME, OTHER_HOME].map(id => [id, {
    coins: 10, stats: initialStats(id), freeUsed: false, mutations: 0,
  }]))
  const receipts = new Map()
  const requests = []
  const fixture = {
    houses, receipts, requests, mode: 'success', hold: null, response: null,
    client: {
      from() { throw new Error('Food actions must never write tables directly') },
      rpc: (name, args) => ({ abortSignal: async signal => {
        assert.ok(signal instanceof AbortSignal, 'Each actual retry must attach an AbortSignal')
        requests.push({ name, args: clone(args), signal })
        if (fixture.hold) await fixture.hold.promise
        if (fixture.mode === 'throw') throw new Error('offline before response')
        if (fixture.mode === 'missing') return { data: null, error: { code: fixture.missingCode ?? 'PGRST202' } }
        if (fixture.response) return clone(fixture.response)
        const house = houses.get(args.p_household_id)
        assert.ok(house, 'Every food RPC must specify its household')
        let receipt = receipts.get(args.p_request_id)
        if (receipt) {
          assert.equal(name, receipt.name)
          assert.deepEqual(args, receipt.args, 'A saved receipt must replay its exact original arguments')
        } else {
          let reason
          const pile = house.stats.food_by_user[USER]
          if (name === 'purchase_food_atomic') {
            if (house.coins < 10) reason = 'insufficient'
            else { house.coins -= 10; pile[args.p_food_key] = (pile[args.p_food_key] ?? 0) + 1 }
          } else if (name === 'feed_food_atomic') {
            if (!pile[args.p_food_key]) reason = 'out_of_stock'
            else {
              pile[args.p_food_key]--
              house.stats.hunger += 20
              house.stats.last_fed_at = '2026-11-02T12:00:00.000Z'
              house.coins += 7
            }
          } else {
            assert.equal(name, 'spin_donut_atomic')
            if (args.p_use_free && house.freeUsed) reason = 'cooldown'
            else if (!args.p_use_free && house.coins < 10) reason = 'insufficient'
            else {
              if (args.p_use_free) house.freeUsed = true
              else house.coins -= 10
              pile.donut = (pile.donut ?? 0) + 1
            }
          }
          const data = reason ? { ok: false, reason } : {
            ok: true, household_id: args.p_household_id, coins: house.coins, stats: clone(house.stats),
            ...(name === 'spin_donut_atomic' ? { food_key: 'donut', new_skin: null, was_free: args.p_use_free, last_free_donut: house.freeUsed ? '2026-11-02' : null } : {}),
          }
          if (data.ok) house.mutations++
          receipt = { name, args: clone(args), data }
          receipts.set(args.p_request_id, receipt)
        }
        if (fixture.mode === 'lost-response') return { data: null, error: { message: 'Connection lost after commit' } }
        return { data: clone(receipt.data), error: null }
      } }),
    },
  }
  return fixture
}

function modules(mocks) {
  const load = createLoader(mocks)
  return { load, food: load('src/lib/foodActions.ts'), journal: load('src/lib/savedRpc.ts') }
}

function sourceBody(relative, owner) {
  const file = path.resolve(__dirname, '..', relative)
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  let body
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === owner) body = node.body
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(body, `Find actual ${owner} source`)
  return { source, statements: Array.from(body.statements) }
}

function bindingNames(name) {
  return ts.isIdentifier(name) ? [name.text] : name.elements.flatMap(element => ts.isBindingElement(element) ? bindingNames(element.name) : [])
}

function declarations(body, names) {
  const found = new Set()
  const selected = body.statements.filter(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => {
    const matches = bindingNames(declaration.name).filter(name => names.includes(name))
    matches.forEach(name => found.add(name))
    return matches.length > 0
  }))
  for (const name of names) assert.ok(found.has(name), `Find actual declaration ${name}`)
  return selected
}

function effects(body, token) {
  const selected = body.statements.filter(statement => ts.isExpressionStatement(statement)
    && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(body.source) === 'useEffect'
    && statement.getText(body.source).includes(token))
  assert.ok(selected.length, `Find actual effect containing ${token}`)
  return selected
}

function evaluate(body, statements, result, bindings) {
  const source = statements.map(statement => statement.getText(body.source)).join('\n') + `\nreturn ${result}`
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } })
  return new Function(...Object.keys(bindings), outputText)(...Object.values(bindings))
}

function reactFixture() {
  const states = []
  const refs = []
  const effects = []
  let stateIndex, refIndex, effectIndex, scheduled
  return {
    useState(initial) {
      const index = stateIndex++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
    useRef(initial) {
      const index = refIndex++
      return refs[index] ?? (refs[index] = { current: initial })
    },
    useCallback: callback => callback,
    useEffect(setup, deps) {
      const index = effectIndex++
      const previous = effects[index]
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        scheduled.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: setup() } })
      }
    },
    render(run) {
      stateIndex = refIndex = effectIndex = 0
      scheduled = []
      const result = run()
      for (const effect of scheduled) effect()
      return result
    },
    unmount() { for (const effect of effects) effect?.cleanup?.() },
  }
}

const hookBody = sourceBody('src/hooks/useErenStats.ts', 'useErenStatsImpl')
const hookDeclarations = declarations(hookBody, ['foodActionLock', 'foodActionBusy', 'foodActionRetry', 'foodScope', 'runFoodAction'])
const scopeAssignments = hookBody.statements.filter(statement => ts.isExpressionStatement(statement)
  && ts.isBinaryExpression(statement.expression) && statement.expression.left.getText(hookBody.source) === 'foodScope.current')
assert.equal(scopeAssignments.length, 1, 'Run the actual render-time scope update')
const hookStatements = [...hookDeclarations, ...scopeAssignments, ...effects(hookBody, 'pendingFoodAction')].sort((a, b) => a.pos - b.pos)

function hook(food, fixture, initial = initialStats()) {
  const react = reactFixture()
  const state = { stats: clone(initial), writes: [], scope: { householdId: HOME, userId: USER } }
  const statsRef = { current: clone(initial) }
  const harness = {
    state, statsRef,
    render() {
      return react.render(() => evaluate(hookBody, hookStatements, '{ runFoodAction, foodActionBusy, foodActionRetry }', {
        ...react, ...food, ...state.scope, statsRef, supabase: fixture.client, window, CustomEvent, PROFILE_UPDATED_EVENT,
        setStats: update => { state.stats = update(state.stats); state.writes.push(clone(state.stats)) },
      }))
    },
  }
  harness.render()
  return harness
}

function assertUnchanged(harness, before, events, count = 0) {
  assert.deepEqual(harness.state.stats, before, 'Local stats must stay saved-only')
  assert.deepEqual(harness.statsRef.current, before, 'The synchronous stats ref must stay saved-only')
  assert.equal(harness.state.writes.length, 0, 'Do not issue even an optimistic setStats')
  assert.equal(events.length, count, 'Unconfirmed food actions must not emit profile/coin changes')
}

const tests = []
function test(name, run) { tests.push({ name, run }) }

test('RPC names, exact household/request arguments, and successful result fields', async () => {
  browser()
  const { food, journal } = modules()
  const fixture = server()
  for (const entry of cases) {
    const result = await food.saveFoodAction(fixture.client, USER, HOME, entry.action)
    assert.equal(result.ok, true)
    const request = fixture.requests.at(-1)
    assert.equal(request.name, entry.name)
    assert.match(request.args.p_request_id, /^[0-9a-f-]{36}$/i)
    assert.deepEqual(request.args, { p_household_id: HOME, ...entry.args, p_request_id: request.args.p_request_id })
    assert.equal(result.household_id, HOME)
    assert.equal(result.coins, fixture.houses.get(HOME).coins)
    assert.deepEqual(result.stats, fixture.houses.get(HOME).stats)
    if (entry.action.kind === 'spin') {
      assert.equal(result.was_free, entry.action.useFree)
      assert.equal(result.food_key, 'donut')
    }
    assert.deepEqual(journal.pendingSavedRpcs(USER, entry.name), [])
    // Refill the deliberately tiny wallet between independent contract cases.
    fixture.houses.get(HOME).coins = 10
  }
  assert.equal(new Set(fixture.requests.map(request => request.args.p_request_id)).size, cases.length)
})

test('lost responses survive fresh modules and replay once with last coins/food/free spin exhausted', async () => {
  for (const entry of cases) {
    const { storage } = browser()
    const fixture = server()
    let { food, journal } = modules()
    fixture.mode = 'lost-response'
    assert.deepEqual(await food.saveFoodAction(fixture.client, USER, HOME, entry.action), { ok: false, reason: 'connection' })
    assert.equal(fixture.requests.length, 3, 'Exercise all attempts in the real writeWithRetry')
    const original = fixture.requests[0]
    for (const request of fixture.requests) assert.deepEqual(request.args, original.args)
    assert.equal(new Set(fixture.requests.map(request => request.signal)).size, 3, 'Build a fresh request/signal on each attempt')
    assert.equal(storage.size, 1)
    const key = `eren:saved-rpc:v1:${USER}:${entry.name}:${HOME}`
    const saved = JSON.parse(storage.get(key))
    assert.deepEqual(saved, { id: original.args.p_request_id, args: { p_household_id: HOME, ...entry.args } })
    assert.deepEqual(journal.pendingSavedRpcs(USER, entry.name), [{ ...saved, slot: HOME }])
    const afterCommit = clone(fixture.houses.get(HOME))
    assert.equal(afterCommit.mutations, 1)
    if (entry.action.kind === 'feed') assert.equal(afterCommit.stats.food_by_user[USER].milk, 0, 'The last food has already been consumed')
    else if (entry.action.kind === 'spin' && entry.action.useFree) assert.equal(afterCommit.freeUsed, true)
    else assert.equal(afterCommit.coins, 0, 'The last coins have already been spent')

    ;({ food, journal } = modules()) // Fresh savedRpc map; only browser storage survives.
    assert.deepEqual(food.pendingFoodAction(USER, HOME), entry.action, 'Read the original intent from storage after reload')
    const attempts = fixture.requests.length
    for (const other of cases) {
      assert.deepEqual(await food.saveFoodAction(fixture.client, USER, HOME, other.action), { ok: false, reason: 'pending' })
    }
    assert.equal(fixture.requests.length, attempts, 'Pending intent blocks its own and every other food action kind')
    fixture.mode = 'success'
    const changedIntent = entry.action.kind === 'spin' ? { kind: 'spin', useFree: !entry.action.useFree } : { kind: 'buy', foodKey: 'fish', source: 'bakery' }
    const recovered = await food.saveFoodAction(fixture.client, USER, HOME, changedIntent, true)
    assert.equal(recovered.ok, true)
    assert.deepEqual(fixture.requests.at(-1).args, original.args, 'Recovery ignores changed food/source/payment availability')
    assert.equal(fixture.requests.at(-1).name, original.name)
    assert.deepEqual(fixture.houses.get(HOME), afterCommit, 'Recovery must not charge, consume, grant, or roll again')
    assert.equal(storage.size, 0)
    assert.deepEqual(journal.pendingSavedRpcs(USER, entry.name), [])
    assert.equal(food.pendingFoodAction(USER, HOME), null)
    const recoveredAttempts = fixture.requests.length
    assert.deepEqual(await food.saveFoodAction(fixture.client, USER, HOME, entry.action, true), { ok: false, reason: 'nothing_pending' })
    assert.equal(fixture.requests.length, recoveredAttempts)
  }
})

test('journal scopes both household and user, and never recovers another scope', async () => {
  const { storage } = browser()
  const fixture = server()
  let { food } = modules()
  fixture.mode = 'lost-response'
  await food.saveFoodAction(fixture.client, USER, HOME, cases[0].action)
  const original = clone(fixture.requests[0].args)
  ;({ food } = modules())
  assert.equal(food.pendingFoodAction(USER, OTHER_HOME), null)
  assert.equal(food.pendingFoodAction('another-user', HOME), null)
  fixture.mode = 'success'
  const count = fixture.requests.length
  assert.deepEqual(await food.saveFoodAction(fixture.client, USER, OTHER_HOME, cases[0].action, true), { ok: false, reason: 'nothing_pending' })
  assert.deepEqual(await food.saveFoodAction(fixture.client, 'another-user', HOME, cases[0].action, true), { ok: false, reason: 'nothing_pending' })
  assert.equal(fixture.requests.length, count)
  assert.equal((await food.saveFoodAction(fixture.client, USER, OTHER_HOME, cases[0].action)).ok, true)
  assert.equal(fixture.requests.at(-1).args.p_household_id, OTHER_HOME)
  assert.notEqual(fixture.requests.at(-1).args.p_request_id, original.p_request_id)
  assert.equal(storage.size, 1, 'A different household cannot clear the original journal')
  assert.equal((await food.saveFoodAction(fixture.client, USER, HOME, cases[0].action, true)).ok, true)
  assert.deepEqual(fixture.requests.at(-1).args, original)
  assert.equal(storage.size, 0)
})

test('actual hook applies only confirmed patches and profile events, never optimistic feeding', async () => {
  const { events } = browser()
  const { food } = modules()
  const fixture = server()
  fixture.hold = deferred()
  const harness = hook(food, fixture)
  const before = clone(harness.state.stats)
  const running = harness.render().runFoodAction(cases[2].action)
  assert.equal(harness.render().foodActionBusy, true)
  assertUnchanged(harness, before, events)
  fixture.hold.resolve()
  const result = await running
  assert.equal(result.ok, true)
  assert.deepEqual(harness.state.stats, { ...before, ...result.stats })
  assert.deepEqual(harness.statsRef.current, harness.state.stats)
  assert.equal(harness.state.writes.length, 1)
  assert.equal(harness.state.stats.food_by_user[USER].milk, 0)
  assert.deepEqual(harness.state.stats.food_by_user.partner, before.food_by_user.partner)
  assert.deepEqual(events.map(event => ({ type: event.type, detail: event.detail })), [
    { type: PROFILE_UPDATED_EVENT, detail: { id: USER, patch: { coins: 17 } } },
  ])
  assert.equal(harness.render().foodActionBusy, false)
  assert.equal(harness.render().foodActionRetry, null)
})

test('same-tick shared buy/feed/spin lock blocks every second action and recovery', async () => {
  for (const entry of [cases[0], cases[2], cases[3]]) {
    browser()
    const { food } = modules()
    const fixture = server()
    fixture.hold = deferred()
    const harness = hook(food, fixture)
    const view = harness.render()
    const first = view.runFoodAction(entry.action)
    for (const other of [cases[0], cases[2], cases[4]]) {
      assert.deepEqual(await view.runFoodAction(other.action), { ok: false, reason: 'busy' })
    }
    assert.deepEqual(await view.runFoodAction(entry.action, true), { ok: false, reason: 'busy' })
    assert.equal(fixture.requests.length, 1, 'No React rerender is needed for the shared lock')
    fixture.hold.resolve()
    assert.equal((await first).ok, true)
    assert.equal(harness.render().foodActionBusy, false)
    assert.equal((await harness.render().runFoodAction(cases[4].action)).ok, true, 'Success must release the lock')
  }
})

test('hook restores recovery state on reload and recovers without optimistic stats/coins', async () => {
  for (const entry of [cases[0], cases[2], cases[4]]) {
    const { events } = browser()
    const fixture = server()
    let { food } = modules()
    let harness = hook(food, fixture)
    const before = clone(harness.state.stats)
    fixture.mode = 'lost-response'
    assert.deepEqual(await harness.render().runFoodAction(entry.action), { ok: false, reason: 'connection' })
    assertUnchanged(harness, before, events)
    assert.equal(harness.render().foodActionBusy, false)
    assert.deepEqual(harness.render().foodActionRetry, entry.action)
    ;({ food } = modules())
    // A reload can already see exhausted server resources; recovery must still run.
    harness = hook(food, fixture, fixture.houses.get(HOME).stats)
    assert.deepEqual(harness.render().foodActionRetry, entry.action, 'Actual mount effect reads recovery from the persisted journal')
    const count = fixture.requests.length
    assert.deepEqual(await harness.render().runFoodAction(cases[3].action), { ok: false, reason: 'pending' })
    assert.equal(fixture.requests.length, count)
    fixture.mode = 'success'
    assert.equal((await harness.render().runFoodAction(cases[3].action, true)).ok, true)
    assert.equal(fixture.houses.get(HOME).mutations, 1)
    assert.equal(harness.render().foodActionRetry, null)
    assert.equal(events.length, 1)
    assert.equal(events[0].detail.patch.coins, fixture.houses.get(HOME).coins)
  }
})

test('late household/user responses and mismatched/malformed results cannot patch or emit coins', async () => {
  for (const change of [{ householdId: OTHER_HOME }, { userId: 'another-user' }, { userId: null }]) {
    const { events } = browser()
    const { food } = modules()
    const fixture = server()
    const harness = hook(food, fixture)
    const captured = harness.render().runFoodAction
    Object.assign(harness.state.scope, change)
    harness.render()
    const before = clone(harness.state.stats)
    assert.deepEqual(await captured(cases[2].action), { ok: false, reason: 'household_changed' })
    assert.equal(fixture.requests.length, 0, 'A callback captured before a session switch must not send an old intent')
    assertUnchanged(harness, before, events)
  }
  for (const change of [{ householdId: OTHER_HOME }, { userId: 'another-user' }, { userId: null }]) {
    const { events } = browser()
    const { food } = modules()
    const fixture = server()
    fixture.hold = deferred()
    const harness = hook(food, fixture)
    const running = harness.render().runFoodAction(cases[2].action)
    Object.assign(harness.state.scope, change)
    harness.state.stats = initialStats(OTHER_HOME)
    harness.statsRef.current = clone(harness.state.stats)
    const before = clone(harness.state.stats)
    harness.render()
    fixture.hold.resolve()
    assert.deepEqual(await running, { ok: false, reason: 'household_changed' })
    assertUnchanged(harness, before, events)
    assert.equal(harness.render().foodActionBusy, false)
    assert.equal(harness.render().foodActionRetry, null)
  }
  for (const patch of [{ household_id: OTHER_HOME }, { stats: null }, { coins: '17' }, { coins: undefined }]) {
    const { events } = browser()
    const { food } = modules()
    const fixture = server()
    fixture.response = { data: { ok: true, household_id: HOME, coins: 17, stats: { hunger: 99 }, ...patch }, error: null }
    const harness = hook(food, fixture)
    const before = clone(harness.state.stats)
    assert.deepEqual(await harness.render().runFoodAction(cases[2].action), { ok: false, reason: 'connection' })
    assertUnchanged(harness, before, events)
    assert.equal(harness.render().foodActionBusy, false)
  }
})

test('missing RPCs fail not_ready once, without changing stats, coins, or a pending journal', async () => {
  for (const code of ['PGRST202', '42883']) for (const entry of cases) {
    const { storage, events } = browser()
    const { food } = modules()
    const fixture = server()
    fixture.mode = 'missing'
    fixture.missingCode = code
    const harness = hook(food, fixture)
    const before = clone(harness.state.stats)
    assert.deepEqual(await harness.render().runFoodAction(entry.action), { ok: false, reason: 'not_ready' })
    assertUnchanged(harness, before, events)
    assert.equal(fixture.requests.length, 1, 'Missing migrations must not retry or use a legacy mutation fallback')
    assert.equal(fixture.houses.get(HOME).coins, 10)
    assert.equal(fixture.houses.get(HOME).mutations, 0)
    assert.equal(storage.size, 0)
    assert.equal(harness.render().foodActionRetry, null)
    assert.equal(harness.render().foodActionBusy, false)
    fixture.mode = 'success'
    assert.equal((await harness.render().runFoodAction(entry.action)).ok, true, 'Missing RPC failure must release the lock')
  }
})

test('business failures, real transport throws, and unexpected helper throws always unlock', async () => {
  for (const reason of ['insufficient', 'out_of_stock', 'sleeping', 'cooldown', 'household_changed']) {
    const { events } = browser()
    const { food } = modules()
    const fixture = server()
    fixture.response = { data: { ok: false, reason }, error: null }
    const harness = hook(food, fixture)
    const before = clone(harness.state.stats)
    assert.deepEqual(await harness.render().runFoodAction(cases[2].action), { ok: false, reason })
    assertUnchanged(harness, before, events)
    assert.equal(harness.render().foodActionBusy, false)
    assert.equal(harness.render().foodActionRetry, null)
    fixture.response = null
    assert.equal((await harness.render().runFoodAction(cases[2].action)).ok, true)
  }
  for (const unexpected of [false, true]) {
    const { events } = browser()
    const { food } = modules()
    const fixture = server()
    fixture.mode = 'throw'
    let throwHelper = unexpected
    const harness = hook({ ...food, saveFoodAction: (...args) => {
      if (throwHelper) throw new Error('Unexpected helper failure')
      return food.saveFoodAction(...args)
    } }, fixture)
    const before = clone(harness.state.stats)
    assert.deepEqual(await harness.render().runFoodAction(cases[2].action), { ok: false, reason: 'connection' })
    assertUnchanged(harness, before, events)
    assert.equal(harness.render().foodActionBusy, false)
    assert.equal(fixture.requests.length, unexpected ? 0 : 3)
    throwHelper = false
    fixture.mode = 'success'
    assert.equal((await harness.render().runFoodAction(cases[2].action, !unexpected)).ok, true, 'Thrown failure must release the lock for recovery or a new action')
  }
})

test('missing hook scope/stats cannot start any food request', async () => {
  for (const unavailable of ['householdId', 'userId', 'stats', 'wrongHouseholdStats']) {
    const { events } = browser()
    const { food } = modules()
    const fixture = server()
    const harness = hook(food, fixture)
    if (unavailable === 'stats') harness.statsRef.current = null
    else if (unavailable === 'wrongHouseholdStats') harness.statsRef.current = initialStats(OTHER_HOME)
    else harness.state.scope[unavailable] = null
    for (const entry of cases) assert.deepEqual(await harness.render().runFoodAction(entry.action), { ok: false, reason: 'not_ready' })
    assert.equal(fixture.requests.length, 0)
    assert.equal(events.length, 0)
    assert.equal(harness.state.writes.length, 0)
    assert.equal(harness.render().foodActionBusy, false)
  }
})

test('food action error messages explain safe failure and receipt recovery', async () => {
  const { food } = modules()
  const expected = {
    not_ready: 'Food saves are waiting for an update. Nothing was changed.',
    insufficient: 'Not enough coins. Nothing was bought.',
    out_of_stock: 'That food is no longer in your fridge.',
    sleeping: 'Let your cat wake up before feeding.',
    cooldown: 'The free spin was already used. No coins were spent.',
    bad_food: 'That food is not available here.',
    not_for_sale: 'That food is not available here.',
    household_changed: 'Your household changed. Please reopen the room.',
    no_household: 'Your household changed. Please reopen the room.',
  }
  for (const [reason, message] of Object.entries(expected)) assert.equal(food.foodActionError(reason), message)
  for (const reason of [undefined, 'connection', 'pending', 'unrecognized']) {
    assert.equal(food.foodActionError(reason), 'Could not confirm this save. Retry to recover it without spending twice.')
  }
})

test('actual TaskContext listener and captured quest callback preserve confirmed food coin perks', async () => {
  const { events, listeners } = browser()
  const { food, load } = modules()
  const body = sourceBody('src/contexts/TaskContext.tsx', 'TaskProvider')
  const selected = [...declarations(body, ['completeTask']), ...effects(body, 'PROFILE_UPDATED_EVENT')]
    .sort((a,b)=>a.pos-b.pos)
  const react = reactFixture()
  const state = { coins:10 }
  const currentUser = { current:USER }
  const calls=[]
  const bindings = {
    ...react, user:{id:USER}, currentUser, completedRef:{current:new Set()},
    ...load('src/lib/tasks.ts'), ...load('src/lib/rewardSaves.ts'),
    window, CustomEvent, PROFILE_UPDATED_EVENT,
    setCoins: value=>{state.coins=value},
    performReward: async (kind,input,slot)=>{
      calls.push({kind,input,slot})
      assert.equal(state.coins,17,'Food wallet event must already have been adopted')
      const def=load('src/lib/tasks.ts').TASK_DEFS.find(t=>t.id===input.taskId)
      // The server reads its current balance; no captured render computes it.
      const saved={ok:true,profile:{coins:17+def.coins},outcome:{tasks:[def],levelUp:false}}
      state.coins=saved.profile.coins
      return saved
    },
  }
  const task=react.render(()=>evaluate(body,selected,'{ completeTask }',bindings))
  for (const detail of [{id:'partner',patch:{coins:999}},{id:USER,patch:{coins:'999'}},{id:USER,patch:{xp:1}}]) {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT,{detail}))
    assert.equal(state.coins,10)
  }
  const fixture=server(),harness=hook(food,fixture)
  assert.equal((await harness.render().runFoodAction(cases[2].action)).ok,true)
  assert.equal(state.coins,17)
  assert.deepEqual(await task.completeTask('daily_feed'),{coins:25,xp:20,levelUp:false})
  assert.equal(state.coins,42)
  assert.equal(calls.length,1);assert.equal(calls[0].kind,'task')
  assert.equal(calls[0].input.taskId,'daily_feed')
  assert.ok(calls[0].slot.startsWith('task:daily_feed:'))
  assert.ok(!body.statements.some(s=>s.getText(body.source).includes(".from('profiles').update")),
    'TaskProvider must not overwrite a balance from captured render state')
  react.unmount()
  assert.equal(listeners.get(PROFILE_UPDATED_EVENT).size,0)
})
async function main() {
  const originalTimer = global.setTimeout
  const globals = Object.fromEntries(['window', 'sessionStorage', 'CustomEvent'].map(key => [key, Object.getOwnPropertyDescriptor(global, key)]))
  // Keep the real writeWithRetry control flow/signals; only skip its backoff delays.
  global.setTimeout = (callback, delay, ...args) => originalTimer(callback, delay === 800 || delay === 1600 ? 0 : delay, ...args)
  let failed = 0
  try {
    for (const { name, run } of tests) {
      try { await run(); console.log(`PASS ${name}`) }
      catch (error) { failed++; console.error(`FAIL ${name}`); console.error(error) }
    }
  } finally {
    global.setTimeout = originalTimer
    for (const [key, descriptor] of Object.entries(globals)) {
      if (descriptor) Object.defineProperty(global, key, descriptor)
      else delete global[key]
    }
  }
  console.log(`Food action client checks: ${tests.length - failed}/${tests.length} passed (mock RPCs only; no database access).`)
  if (failed) process.exitCode = 1
}

main().catch(error => { console.error(error); process.exitCode = 1 })
