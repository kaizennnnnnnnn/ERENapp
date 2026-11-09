const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), createLoader = require('./lib/load_ts.cjs')
const A = 'item-user', H = 'item-home', I = 'cons_donut_neon', J = 'cons_monsta_white', tests = []
const test = (name, run) => tests.push({ name, run }), clone = v => JSON.parse(JSON.stringify(v))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
function browser() {
  const storage = new Map()
  global.sessionStorage = { get length() { return storage.size }, key: i => [...storage.keys()][i] ?? null, getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) }
  return storage
}
const row = (quantity = 2) => ({ id: 'inventory-row', user_id: A, item_id: I, quantity, equipped: false, obtained_at: '2026-11-09T12:00:00Z' })
const stats = () => ({ household_id: H, energy: 42, happiness: 20, updated_at: '2026-11-09T12:00:00Z', hunger: 9, room_skins: { sleep: 'bee' } })
function server() {
  const s = { mode: 'ok', hold: null, readHold: null, reads: 0, requests: [], receipts: new Map(), consumed: 0, stock: 2, stats: stats() }
  s.client = {
    from(table) {
      assert.equal(table, 'user_inventory'); return { select: columns => { assert.equal(columns, '*'); return { eq: async (key, actor) => {
        s.reads++; assert.equal(key, 'user_id'); const data = s.stock ? [{ ...row(s.stock), user_id: actor }] : [], hold = s.readHold
        if (hold) await hold.promise
        return { data, error: null }
      } } } }
    },
    rpc: (name, args) => ({ abortSignal: async signal => {
      assert.ok(signal instanceof AbortSignal); s.requests.push({ name, args: clone(args) }); const hold = s.hold; if (hold) await hold.promise
      if (s.mode === 'missing') return { data: null, error: { code: 'PGRST202' } }
      if (s.mode === 'offline') throw Error('offline')
      if (s.mode === 'malformed') return { data: { ok: true }, error: null }
      if (s.mode === 'reject') return { data: { ok: false, reason: 'no_stock' }, error: null }
      let r = s.receipts.get(args.p_request_id)
      if (!r) {
        s.stock--; s.consumed++; s.stats.happiness = Math.min(100, s.stats.happiness + 40); s.stats.updated_at = '2026-11-09T12:01:00Z'
        r = { ok: true, version: 1, request_id: args.p_request_id, user_id: args.p_expected_user, household_id: args.p_household_id, item_id: args.p_item_id, saved_at: s.stats.updated_at }
        s.receipts.set(args.p_request_id, r)
      }
      if (s.mode === 'lost') return { data: null, error: { message: 'lost after commit' } }
      return { data: { ...r, inventory_item: s.stock ? { ...row(s.stock), user_id: args.p_expected_user, item_id: args.p_item_id } : null, stats: { ...s.stats, household_id: args.p_household_id } }, error: null }
    } }),
  }
  return s
}
function fixture() {
  const slots = []; let cursor = 0, scheduled = [], alive = true, late = 0
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const r = {
    get late() { return late },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { if (!alive) late++; slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }) },
    useCallback(cb, deps) { const i = cursor++, old = slots[i]; if (!old || !same(old.deps, deps)) slots[i] = { cb, deps }; return slots[i].cb },
    useEffect(setup, deps) { const i = cursor++, old = slots[i]; if (!old || !same(old.deps, deps)) scheduled.push(() => { old?.cleanup?.(); slots[i] = { deps, setup, cleanup: setup() } }) },
    render(run, commit = true) { cursor = 0; scheduled = []; const result = run(); if (commit) scheduled.forEach(f => f()); return result },
    unmount() { slots.forEach(s => s?.cleanup?.()); alive = false },
    strict() { slots.forEach(s => { if (s?.setup) { s.cleanup?.(); s.cleanup = s.setup() } }) },
  }
  return r
}
function harness(s) {
  const react = fixture(), scope = { actor: A, home: H }, patches = []; let foreground
  const load = createLoader({ react, '@/lib/supabase/client': { createClient: () => s.client }, '@/hooks/useAuth': { useAuth: () => ({ user: { id: scope.actor }, profile: { household_id: scope.home } }) },
    './useAuth': { useAuth: () => ({ user: { id: scope.actor }, profile: { household_id: scope.home } }) },
    './useErenStats': { useErenStats: () => ({ acceptInventoryItemSave: saved => patches.push(saved) }) },
    '@/lib/onForeground': { onForeground: cb => { foreground = cb; return () => { foreground = null } } },
  })
  const { useInventory } = load('src/hooks/useInventory.ts')
  const h = { react, scope, patches, render: (commit = true) => react.render(useInventory, commit), foreground: () => foreground?.() }
  h.render(); return h
}
const modules = () => createLoader()('src/lib/inventoryItemSaves.ts')
test('one RPC, exact actor/item contract and strict confirmation validation', async () => {
  browser(); const lib = modules(), s = server(), r = await lib.saveInventoryItem(s.client, A, H, I)
  assert.equal(r.ok, true); assert.equal(s.requests.length, 1); assert.equal(s.requests[0].name, lib.INVENTORY_ITEM_RPC)
  assert.deepEqual(s.requests[0].args, { p_expected_user: A, p_household_id: H, p_item_id: I, p_request_id: r.request_id })
  for (const bad of [{ version: 2 }, { request_id: 'bad' }, { user_id: 'bad' }, { household_id: 'bad' }, { item_id: J }, { saved_at: 'bad' }, { inventory_item: undefined }, { inventory_item: { ...r.inventory_item, user_id: 'bad' } }, { inventory_item: { ...r.inventory_item, quantity: 0 } }, { stats: { ...r.stats, energy: 101 } }, { stats: { ...r.stats, happiness: '20' } }, { stats: { ...r.stats, updated_at: 'bad' } }]) assert.equal(lib.validInventoryItem({ ...r, ...bad }, A, H, r.request_id, I), false)
})
test('lost replies survive reload; recovery uses the original snack and receipt', async () => {
  const storage = browser(), s = server(); let lib = modules(); s.mode = 'lost'
  assert.equal((await lib.saveInventoryItem(s.client, A, H, I)).ok, false); assert.equal(s.consumed, 1); assert.equal(s.requests.length, 3); assert.equal(storage.size, 1)
  const args = s.requests[0].args; lib = modules(); assert.equal(lib.pendingInventoryItem(A, H).itemId, I)
  assert.equal((await lib.saveInventoryItem(s.client, A, H, J)).reason, 'pending'); s.mode = 'ok'; s.stock = 5; s.stats.happiness = 97
  const r = await lib.saveInventoryItem(s.client, A, H, J, true); assert.equal(r.ok, true); assert.equal(r.item_id, I); assert.equal(r.inventory_item.quantity, 5); assert.equal(r.stats.happiness, 97); assert.deepEqual(s.requests.at(-1).args, args); assert.equal(s.consumed, 1); assert.equal(storage.size, 0)
  assert.equal((await lib.saveInventoryItem(s.client, A, H, I, true)).reason, 'nothing_pending')
})
test('offline/malformed keeps recovery; missing SQL safely refuses without legacy writes', async () => {
  for (const mode of ['offline', 'malformed', 'missing']) {
    browser(); const s = server(), lib = modules(); s.mode = mode
    assert.equal((await lib.saveInventoryItem(s.client, A, H, I)).reason, mode === 'missing' ? 'not_ready' : 'connection'); assert.equal(s.consumed, 0)
    assert.equal(Boolean(lib.pendingInventoryItem(A, H)), mode !== 'missing')
  }
})
test('pending intents never cross actor/household boundaries', async () => {
  browser(); const s = server(), lib = modules(); s.mode = 'lost'; await lib.saveInventoryItem(s.client, A, H, I)
  for (const [actor, home] of [['other', H], [A, 'away']]) { assert.equal(lib.pendingInventoryItem(actor, home), null); assert.equal((await lib.saveInventoryItem(s.client, actor, home, I, true)).reason, 'nothing_pending') }
  assert.equal(s.requests.length, 3)
})
test('actual hook locks double taps, stays saved-only and adopts stock without refetch', async () => {
  browser(); const s = server(), h = harness(s); await tick(); const view = h.render(), reads = s.reads
  s.hold = deferred(); const running = view.useItem(I); assert.equal(h.render().usingItemId, I); assert.equal(h.render().getQuantity(I), 2); assert.equal(h.patches.length, 0)
  assert.equal((await view.useItem(I)).success, false); assert.equal(s.requests.length, 1)
  s.hold.resolve(); assert.equal((await running).success, true); assert.equal(h.render().usingItemId, null); assert.equal(h.render().getQuantity(I), 1); assert.equal(h.patches.length, 1); assert.equal(s.reads, reads)
})
test('stale inventory read cannot restore a consumed item', async () => {
  browser(); const s = server(), h = harness(s); await tick(); s.readHold = deferred(); const reading = h.render().refetch(); const running = h.render().useItem(I)
  await running; assert.equal(h.render().getQuantity(I), 1); s.readHold.resolve(); await reading; assert.equal(h.render().getQuantity(I), 1)
})
test('last-snack recovery works after remount even when inventory is now empty', async () => {
  browser(); const s = server(); s.stock = 1; s.mode = 'lost'; const h = harness(s); await tick()
  assert.equal((await h.render().useItem(I)).success, false); assert.equal(h.render().pendingItemId, I); h.react.unmount()
  const next = harness(s); await tick(); assert.equal(next.render().getQuantity(I), 0); assert.equal(next.render().pendingItemId, I)
  s.mode = 'ok'; assert.equal((await next.render().useItem(J, true)).success, true); assert.equal(s.consumed, 1); assert.equal(next.render().pendingItemId, null)
})
test('early recovery replaces a still-loading read without holding the save open', async () => {
  browser(); const s = server(); s.mode = 'lost'; await modules().saveInventoryItem(s.client, A, H, I)
  s.mode = 'ok'; s.readHold = deferred(); const oldRead = s.readHold, h = harness(s)
  assert.equal(h.render().loaded, false); s.readHold = null
  assert.equal((await h.render().useItem(I, true)).success, true); await tick()
  assert.equal(h.render().loaded, true); assert.equal(h.render().loading, false); assert.equal(h.render().getQuantity(I), 1)
  oldRead.resolve(); await tick(); assert.equal(h.render().getQuantity(I), 1)
})
test('confirmed no-stock rejection clears intent, displays error and refreshes stock', async () => {
  browser(); const s = server(), h = harness(s); await tick(); const reads = s.reads; s.mode = 'reject'; s.stock = 0
  assert.equal((await h.render().useItem(I)).success, false); await tick(); assert.match(h.render().useError, /no longer/); assert.equal(h.render().pendingItemId, null); assert.equal(h.render().getQuantity(I), 0); assert.equal(s.reads, reads + 1)
})
test('account/home/ABA/render-gap/unmount discard late responses and patches', async () => {
  for (const mode of ['account', 'home', 'aba', 'gap', 'unmount']) {
    browser(); const s = server(), h = harness(s); await tick(); s.hold = deferred(); const running = h.render().useItem(I)
    if (mode === 'unmount') h.react.unmount()
    else { if (mode === 'home') h.scope.home = 'away'; else h.scope.actor = 'other'; h.render(mode !== 'gap'); if (mode === 'aba') { h.scope.actor = A; h.render() } }
    s.hold.resolve(); assert.equal((await running).success, false, mode); assert.equal(h.patches.length, 0, mode); assert.equal(h.react.late, 0, mode)
  }
})
test('old finally cannot unlock a new account save; captured callbacks stay invalid after ABA', async () => {
  browser(); const s = server(), h = harness(s); await tick(); const old = h.render().useItem
  s.hold = deferred(); const hold = s.hold, first = old(I); h.scope.actor = 'other'; h.render(); await tick(); s.hold = deferred(); const second = h.render().useItem(I)
  hold.resolve(); await first; assert.equal(h.render().usingItemId, I); const count = s.requests.length; await h.render().useItem(I); assert.equal(s.requests.length, count)
  s.hold.resolve(); await second; h.scope.actor = A; h.render(); assert.equal((await old(I)).success, false)
})
test('foreground finds a saved intent; StrictMode cleanup/setup remains usable', async () => {
  browser(); const s = server(), h = harness(s); await tick(); h.react.strict(); await tick(); s.mode = 'lost'; await modules().saveInventoryItem(s.client, A, H, I)
  h.foreground(); assert.equal(h.render().pendingItemId, I); s.mode = 'ok'; assert.equal((await h.render().useItem(I, true)).success, true); assert.equal(h.render().pendingItemId, null)
})
test('stats merge cannot rewind a newer patch or touch cosmetics/other care values', async () => {
  const lib = modules(), current = stats(), patch = { household_id: H, energy: 100, happiness: 60, updated_at: '2026-11-09T12:01:00Z', hunger: 100, room_skins: {} }
  const merged = lib.mergeInventoryStats(current, patch); assert.equal(merged.energy, 100); assert.equal(merged.hunger, 9); assert.deepEqual(merged.room_skins, current.room_skins)
  assert.equal(lib.mergeInventoryStats({ ...current, updated_at: '2026-11-09T12:02:00Z' }, patch).energy, 42); assert.equal(lib.mergeInventoryStats({ ...current, household_id: 'away' }, patch).energy, 42); assert.equal(lib.mergeInventoryStats(null, patch), null)
})
test('actual shared-stats acceptance rejects a different actor/home and captured ABA callback', async () => {
  const file = 'src/hooks/useErenStats.ts', source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  let declaration
  function walk(n) { if (ts.isVariableDeclaration(n) && n.name.getText(source) === 'acceptInventoryItemSave') declaration = n; ts.forEachChild(n, walk) }
  walk(source); assert.ok(declaration)
  const code = ts.transpileModule('const ' + declaration.getText(source) + ';return acceptInventoryItemSave', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  const currentPlayScope = {}, playScope = { current: currentPlayScope }, statsRef = { current: stats() }; let current = stats(), writes = 0
  const accept = new Function('useCallback', 'playScope', 'currentPlayScope', 'userId', 'householdId', 'statsRef', 'mergeInventoryStats', 'setStats', code)(cb => cb, playScope, currentPlayScope, A, H, statsRef, modules().mergeInventoryStats, fn => { writes++; current = fn(current) })
  const saved = { user_id: A, household_id: H, stats: { ...stats(), energy: 100, updated_at: '2026-11-09T12:01:00Z' } }
  accept({ ...saved, user_id: 'other' }); accept({ ...saved, household_id: 'away' }); assert.equal(writes, 0)
  accept(saved); assert.equal(current.energy, 100); assert.equal(statsRef.current.energy, 100); assert.equal(current.hunger, 9)
  playScope.current = {}; accept(saved); assert.equal(writes, 1)
})
async function main() {
  const original = global.setTimeout; global.setTimeout = (cb, ms, ...args) => original(cb, ms === 800 || ms === 1600 ? 0 : ms, ...args)
  let failed = 0
  try { for (const t of tests) try { await t.run(); console.log('PASS ' + t.name) } catch (e) { failed++; console.error('FAIL ' + t.name, e) } } finally { global.setTimeout = original }
  console.log(`Collection snack client: ${tests.length - failed}/${tests.length} passed (real journal/helper/hook, mocked transport).`); if (failed) process.exitCode = 1
}
main().catch(e => { console.error(e); process.exitCode = 1 })
