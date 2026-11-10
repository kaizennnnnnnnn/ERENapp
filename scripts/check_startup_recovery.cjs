const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), createLoader = require('./lib/load_ts.cjs')
const tests = [], test = (name, run) => tests.push({ name, run }), deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function clock() {
  const native = { Date, setTimeout, clearTimeout }; let now = Date.parse('2026-11-10T10:00:00Z'), next = 0; const timers = new Map()
  global.Date = class extends native.Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  global.setTimeout = (fn, delay = 0) => { const id = ++next; timers.set(id, { fn, at: now + delay }); return id }
  global.clearTimeout = id => timers.delete(id)
  return { async advance(ms) { await flush(); const end = now + ms; for (;;) { const row = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!row) break; timers.delete(row[0]); now = row[1].at; row[1].fn(); await flush() } now = end; await flush() }, restore() { Object.assign(global, native) } }
}
function browser() { global.window = new EventTarget(); global.document = Object.assign(new EventTarget(), { visibilityState: 'visible' }); global.CustomEvent = class extends Event { constructor(type, options) { super(type); this.detail = options?.detail } } }
function server() {
  const s = { user: { id: 'alice' }, userError: null, profileError: null, missing: false, authHold: null, profileHold: null, users: 0, profiles: [], subscriptions: 0, cb: null }
  s.client = { auth: {
    async getUser() { s.users++; const user = s.user, error = s.userError, hold = s.authHold; if (hold) await hold.promise; return { data: { user }, error } },
    onAuthStateChange(cb) { s.cb = cb; s.subscriptions++; return { data: { subscription: { unsubscribe() { s.cb = null } } } } },
    async signOut() { s.cb?.('SIGNED_OUT', null); return { error: null } },
  }, from(table) { assert.equal(table, 'profiles'); let actor, signal; return { select(c) { assert.equal(c, '*'); return this }, eq(k, v) { assert.equal(k, 'id'); actor = v; return this }, abortSignal(v) { signal = v; return this }, async maybeSingle() {
    s.profiles.push({ actor, signal }); const hold = s.profileHold, error = s.profileError, missing = s.missing
    if (hold) await hold.promise
    return { data: error || missing ? null : { id: actor, household_id: actor + '-home', name: actor, coins: 100, achievements: { existing: true } }, error }
  } } } }
  s.emit = (event, actor) => s.cb?.(event, actor ? { user: { id: actor } } : null)
  return s
}
function setup() { browser(); const c = clock(), s = server(), lib = createLoader()('src/lib/authState.ts'), state = lib.createAuthState(s.client); return { c, s, lib, state } }

test('30 auth readers share one verification, one profile request and one listener', async () => {
  const { c, s, state } = setup(); try { const off = Array.from({ length: 30 }, () => state.subscribe(() => {})); await flush(); assert.equal(s.users, 1); assert.equal(s.profiles.length, 1); assert.equal(s.subscriptions, 1); assert.equal(state.getSnapshot().profile.id, 'alice'); assert.equal(state.getSnapshot().loading, false)
    const before = state.getSnapshot(); assert.equal(state.getSnapshot(), before); off.forEach(fn => fn()); state.subscribe(() => {}); await flush(); assert.equal(s.users, 1); assert.equal(s.profiles.length, 1)
  } finally { state.dispose(); c.restore() }
})
test('auth timeout is recoverable, never signed out; late response cannot replace retry', async () => {
  const { c, s, state } = setup(); try { s.authHold = deferred(); const old = s.authHold; state.subscribe(() => {}); await c.advance(10000)
    assert.equal(state.getSnapshot().error, 'connection'); assert.equal(state.getSnapshot().loading, true); assert.equal(state.getSnapshot().retrying, false)
    s.authHold = null; s.user = { id: 'bob' }; const retry = state.retry(); assert.equal(state.retry(), retry); await retry; assert.equal(state.getSnapshot().profile.id, 'bob')
    old.resolve(); await flush(); assert.equal(state.getSnapshot().profile.id, 'bob'); assert.equal(s.profiles.length, 1)
  } finally { state.dispose(); c.restore() }
})
test('profile timeout aborts transport and refocus retries only the failed profile', async () => {
  const { c, s, state } = setup(); try { s.profileHold = deferred(); const old = s.profileHold; state.subscribe(() => {}); await c.advance(10000)
    assert.equal(state.getSnapshot().user.id, 'alice'); assert.equal(state.getSnapshot().profile, null); assert.equal(state.getSnapshot().loading, true); assert.equal(s.profiles[0].signal.aborted, true)
    s.profileHold = null; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(state.getSnapshot().profile.id, 'alice'); assert.equal(s.users, 1); assert.equal(s.profiles.length, 2)
    old.resolve(); await flush(); assert.equal(state.getSnapshot().profile.id, 'alice')
  } finally { state.dispose(); c.restore() }
})
test('HTTP failures and missing profile never mean no account/household or initialize data', async () => {
  for (const mode of ['auth', 'authApi', 'profile', 'missing']) { const { c, s, state } = setup(); try {
    if (mode === 'auth') { s.user = null; s.userError = { name: 'AuthRetryableFetchError', status: 503 } }
    if (mode === 'authApi') { s.user = null; s.userError = { name: 'AuthApiError', status: 500 } }
    if (mode === 'profile') s.profileError = { code: '500', message: 'server busy' }
    if (mode === 'missing') s.missing = true
    state.subscribe(() => {}); await flush(); assert.equal(state.getSnapshot().loading, true); assert.equal(state.getSnapshot().error, mode === 'missing' ? 'profile_missing' : 'connection')
  } finally { state.dispose(); c.restore() } }
})
test('definitively absent session still resolves signed out without reading a profile', async () => {
  for (const error of [null, { name: 'AuthSessionMissingError' }, { status: 401 }]) { const { c, s, state } = setup(); try { s.user = null; s.userError = error; state.subscribe(() => {}); await flush(); assert.equal(state.getSnapshot().loading, false); assert.equal(state.getSnapshot().error, null); assert.equal(s.profiles.length, 0) } finally { state.dispose(); c.restore() } }
})
test('account changes, sign-out and ABA return discard the previous in-flight profile', async () => {
  for (const mode of ['other', 'out', 'aba']) { const { c, s, state } = setup(); try { s.profileHold = deferred(); const old = s.profileHold; state.subscribe(() => {}); await flush()
    s.profileHold = null; s.emit('SIGNED_OUT'); if (mode !== 'out') { s.emit('SIGNED_IN', 'bob'); await c.advance(0); if (mode === 'aba') { s.emit('SIGNED_OUT'); s.emit('SIGNED_IN', 'alice'); await c.advance(0) } }
    const before = state.getSnapshot(); old.resolve(); await flush(); assert.equal(state.getSnapshot(), before); assert.equal(state.getSnapshot().user?.id ?? null, mode === 'out' ? null : mode === 'aba' ? 'alice' : 'bob')
  } finally { state.dispose(); c.restore() } }
})
test('saved profile patches update every reader once, with no wallet/streak refetch', async () => {
  const { c, s, lib, state } = setup(); try { const seen = []; state.subscribe(() => { seen.push(state.getSnapshot()) }); await flush(); const achievements = state.getSnapshot().profile.achievements
    window.dispatchEvent(new CustomEvent(lib.PROFILE_UPDATED_EVENT, { detail: { id: 'other', patch: { coins: 999 } } })); assert.equal(state.getSnapshot().profile.coins, 100)
    window.dispatchEvent(new CustomEvent(lib.PROFILE_UPDATED_EVENT, { detail: { id: 'alice', patch: { coins: 150, name: 'New name' } } })); assert.equal(state.getSnapshot().profile.coins, 150); assert.equal(state.getSnapshot().profile.achievements, achievements); assert.equal(s.profiles.length, 1)
    s.emit('TOKEN_REFRESHED', 'alice'); window.dispatchEvent(new Event('focus')); await c.advance(1000); assert.equal(s.profiles.length, 1); assert.equal(state.getSnapshot().profile.coins, 150)
  } finally { state.dispose(); c.restore() }
})
test('online recovery and dispose clear timers/listeners and reject stale results', async () => {
  const { c, s, state } = setup(); try { s.profileError = { message: 'outage' }; state.subscribe(() => {}); await flush(); s.profileError = null; window.dispatchEvent(new Event('online')); await flush(); assert.equal(state.getSnapshot().error, null)
    s.profileHold = deferred(); const run = state.retry(); await flush(); const before = state.getSnapshot(); state.dispose(); s.profileHold.resolve(); await run; assert.equal(state.getSnapshot(), before); assert.equal(s.cb, null)
  } finally { state.dispose(); c.restore() }
})
test('onboarding home/rename patches survive an already-running profile read', async () => {
  const { c, s, lib, state } = setup(); try { s.profileHold = deferred(); state.subscribe(() => {}); await flush()
    window.dispatchEvent(new CustomEvent(lib.PROFILE_UPDATED_EVENT, { detail: { id: 'alice', patch: { household_id: 'new-home', name: 'New name' } } })); s.profileHold.resolve(); await flush()
    assert.equal(state.getSnapshot().profile.household_id, 'new-home'); assert.equal(state.getSnapshot().profile.name, 'New name')
    s.profileHold = null; await state.retry(); assert.equal(state.getSnapshot().profile.household_id, 'alice-home', 'a new explicit read can observe a later household move')
  } finally { state.dispose(); c.restore() }
})
test('server rendering does not instantiate a browser client or share browser identity', async () => {
  const React = require('react'), { renderToString } = require('react-dom/server'); let clients = 0
  const { useAuth } = createLoader({ '@/lib/supabase/client': { createClient() { clients++; throw Error('browser client on server') } } })('src/hooks/useAuth.ts')
  function View() { const auth = useAuth(); return React.createElement('p', null, auth.loading ? 'Loading' : auth.user?.id) }
  assert.equal(renderToString(React.createElement(View)), '<p>Loading</p>'); assert.equal(clients, 0)
})
test('deadline also settles an SDK lock that ignores AbortSignal', async () => {
  const c = clock(), { boundedRequest } = createLoader()('src/lib/boundedRequest.ts'); try { let signal; const hold = deferred(), r = boundedRequest(s => { signal = s; return hold.promise }).catch(e => e)
    await c.advance(8000); assert.match((await r).message, /timed out/); assert.equal(signal.aborted, true); hold.resolve('late'); await flush()
    const parent = new AbortController(); parent.abort(); let started = false; await assert.rejects(() => boundedRequest(() => { started = true; return Promise.resolve() }, { signal: parent.signal }), /cancelled/); assert.equal(started, false)
  } finally { c.restore() }
})
test('auth transport timeouts apply only to own user reads/refresh, preserving caller abort', async () => {
  const c = clock(), { createAuthFetch } = createLoader()('src/lib/boundedRequest.ts'); try { const calls = [], holds = [], fake = (input, init) => { calls.push({ input, init }); const hold = deferred(); holds.push(hold); return hold.promise }, fetcher = createAuthFetch(fake, 'https://project.test')
    const r = fetcher('https://project.test/auth/v1/user').catch(e => e); await c.advance(10000); assert.match((await r).message, /timed out/); assert.equal(calls[0].init.signal.aborted, true)
    const parent = new AbortController(), refresh = fetcher(new Request('https://project.test/auth/v1/token?grant_type=refresh_token', { method: 'POST', signal: parent.signal })).catch(e => e); await flush(); parent.abort(); assert.equal((await refresh).name, 'AbortError')
    const input = { signal: new AbortController().signal, method: 'POST', body: '{}' }
    const buy = fetcher('https://project.test/rest/v1/rpc/buy_food', input); assert.equal(calls.at(-1).init, input); holds.at(-1).resolve(new Response('{}')); await buy
    const signup = fetcher('https://project.test/auth/v1/signup', input); assert.equal(calls.at(-1).init, input); holds.at(-1).resolve(new Response('{}')); await signup
    const external = fetcher('https://other.test/auth/v1/user', input); assert.equal(calls.at(-1).init, input); holds.at(-1).resolve(new Response('{}')); await external
  } finally { c.restore() }
})

function statsFixture() {
  const source = ts.createSourceFile('stats.ts', fs.readFileSync('src/hooks/useErenStats.ts', 'utf8'), ts.ScriptTarget.Latest, true); let declaration
  function walk(n) { if (ts.isVariableDeclaration(n) && n.name.getText(source) === 'fetchStats') declaration = n; ts.forEachChild(n, walk) } walk(source); assert.ok(declaration)
  const code = ts.transpileModule('const ' + declaration.getText(source) + ';return fetchStats', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  const h = { row: { household_id: 'home', energy: 60, hunger: 70, happiness: 80, cleanliness: 90, is_sick: false, last_decay_at: new Date().toISOString(), updated_at: new Date().toISOString() }, stats: null, error: null, loading: false, hold: null, writeHold: null, fail: false, signals: [], writes: 0, frozen: false, decay: null }
  const statsRef = { current: null }, hasStatsRef = { current: false }, statsRead = { current: null }, currentStatsScope = { householdId: 'home', userId: 'alice' }, statsScope = { current: currentStatsScope }
  const client = { from(table) { assert.equal(table, 'eren_stats'); let mode = 'read', signal; return { select() { return this }, update() { mode = 'write'; return this }, eq() { return this }, is() { return this }, abortSignal(s) { signal = s; return this }, single() { return this.run() }, maybeSingle() { return this.run() }, async run() {
    if (mode === 'write') { h.writes++; if (h.writeHold) await h.writeHold.promise; return { data: { last_decay_at: new Date().toISOString(), updated_at: new Date().toISOString() }, error: null } }
    h.signals.push(signal); const row = { ...h.row }, hold = h.hold, fail = h.fail; if (hold) await hold.promise; return { data: fail ? null : row, error: fail ? { message: 'server failure' } : null }
  } } } }
  const bindings = { useCallback: cb => cb, householdId: 'home', currentStatsScope, statsScope, statsRead, statsRef, hasStatsRef, supabase: client,
    boundedRequest: createLoader()('src/lib/boundedRequest.ts').boundedRequest,
    setLoading: v => { h.loading = v }, setError: v => { h.error = v }, setStats: v => { h.stats = typeof v === 'function' ? v(h.stats) : v },
    computeDecay: () => h.decay, decayFrozen: () => h.frozen, DECAY_MIN_SAVE_HOURS: 0.25,
    computeErenMood: () => 'idle', shouldBecomeSick: () => false, maybeFireBackgroundPush: () => {}, writeWithRetry: async () => ({ data: null, error: null }) }
  h.read = new Function(...Object.keys(bindings), code)(...Object.values(bindings)); h.statsRef = statsRef; h.statsRead = statsRead; h.scope = statsScope
  return h
}
test('actual home read deduplicates focus/tick callers and releases stalled requests at 8 seconds', async () => {
  const c = clock(); try { const h = statsFixture(); h.hold = deferred(); const run = h.read(); assert.equal(h.read(), run); await flush(); assert.equal(h.signals.length, 1); assert.equal(h.loading, true)
    await c.advance(8000); await run; assert.equal(h.loading, false); assert.match(h.error, /could not/); assert.equal(h.signals[0].aborted, true); assert.equal(h.stats, null)
    const old = h.hold; h.hold = null; await h.read(); assert.equal(h.error, null); assert.equal(h.stats.energy, 60); h.stats.energy = 99; h.statsRef.current = h.stats
    old.resolve(); await flush(); assert.equal(h.stats.energy, 99)
  } finally { c.restore() }
})
test('actual home read preserves loaded data on failure and rejects a stale care snapshot', async () => {
  const c = clock(); try { const h = statsFixture(); await h.read(); const current = h.stats; h.fail = true; await h.read(); assert.equal(h.stats, current); assert.ok(h.error)
    h.fail = false; h.hold = deferred(); const run = h.read(); await flush(); h.stats = { ...current, energy: 99, updated_at: new Date(Date.now() + 1000).toISOString() }; h.statsRef.current = h.stats
    h.hold.resolve(); await run; assert.equal(h.stats.energy, 99); assert.equal(h.error, null)
  } finally { c.restore() }
})
test('actual home read cannot paint another household or complete after cleanup', async () => {
  const c = clock(); try { const h = statsFixture(); h.hold = deferred(); const run = h.read(); await flush(); h.scope.current = { householdId: 'away', userId: 'bob' }; h.statsRead.current.controller.abort(); h.statsRead.current = null
    h.stats = null; h.error = null; h.hold.resolve(); await run; assert.equal(h.stats, null); assert.equal(h.error, null); const calls = h.signals.length; await h.read(); assert.equal(h.signals.length, calls)
  } finally { c.restore() }
})
test('clock initialization and freeze housekeeping never block an already-read room', async () => {
  for (const mode of ['init', 'freeze']) { const c = clock(); try { const h = statsFixture(); if (mode === 'init') h.row.last_decay_at = null; else { h.frozen = true; h.decay = { hours: 1 } }
    h.writeHold = deferred(); const run = h.read(); await flush(); assert.equal(h.stats.energy, 60); assert.equal(h.loading, false); assert.equal(h.writes, 1)
    await c.advance(6000); await run; assert.equal(h.loading, false); assert.equal(h.error, null); h.writeHold.resolve(); await flush()
  } finally { c.restore() } }
})
test('root document, home retry and hidden-page timers keep startup independent of stalled auth', async () => {
  const root = fs.readFileSync('src/app/page.tsx', 'utf8'), home = fs.readFileSync('src/app/(app)/home/page.tsx', 'utf8'), stats = fs.readFileSync('src/hooks/useErenStats.ts', 'utf8')
  assert.ok(root.includes("redirect('/home')")); assert.ok(!root.includes('getUser()')); assert.ok(home.includes('authError || (!stats && statsError)'))
  assert.ok(home.includes('authError ? retryAuth() : retryStats()')); assert.ok(!home.includes('window.location.reload()'))
  assert.match(stats, /const tick = setInterval\(\(\) => \{ if \(document.visibilityState === 'visible'\)/)
})

async function main() { let failed = 0; for (const t of tests) try { await t.run(); console.log('PASS ' + t.name) } catch (e) { failed++; console.error('FAIL ' + t.name, e) } console.log(`Startup recovery: ${tests.length - failed}/${tests.length} passed (real auth store, hooks, transport and fake clock).`); if (failed) process.exitCode = 1 }
main().catch(e => { console.error(e); process.exitCode = 1 })
