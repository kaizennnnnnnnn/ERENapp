const assert = require('node:assert/strict')
const createLoader = require('./lib/load_ts.cjs')
const storage = new Map()
const events = []
global.sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
global.window = { dispatchEvent: event => events.push(event) }
global.CustomEvent = class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail } }
const user = { id: 'test-user' }
let mode = 'success'
let attempts = []
let balance = 500
let grants = 0
let fridgeRefreshes = 0
const receipts = new Map()
const fastRetry = async (run, retries = 2, shouldRetry = () => true) => {
  let result
  for (let i = 0; i <= retries; i++) {
    try { result = await run(new AbortController().signal) }
    catch (e) { result = { data: null, error: { message: e.message } } }
    if (!result.error || !shouldRetry(result.error)) break
  }
  return result
}
const client = {
  from: () => { throw new Error('Pulls must not write client-side tables') },
  rpc: (name, args) => ({ abortSignal: async () => {
    attempts.push({ name, args })
    if (mode === 'throw') throw new Error('offline')
    if (mode === 'missing') return { data: null, error: { code: 'PGRST202' } }
    if (mode === 'insufficient') return { data: { ok: false, reason: 'insufficient' }, error: null }
    let result = receipts.get(args.p_request_id)
    if (!result) {
      balance -= args.p_count === 10 ? 450 : args.p_use_ticket ? 0 : 50
      grants += args.p_count
      result = {
        ok: true, coins: balance,
        state: { user_id: user.id, stardust: 0, total_pulls: grants, pulls_since_epic: grants, pulls_since_legendary: grants },
        results: Array.from({ length: args.p_count }, () => ({ itemId: 'cons_monsta_white', isNew: true, stardustGained: 0, isPity: false })),
      }
      receipts.set(args.p_request_id, result)
    }
    if (mode === 'lost-response') return { data: null, error: { message: 'Connection lost after commit' } }
    return { data: result, error: null }
  } }),
}
function makeHook() {
  const state = []
  const refs = []
  let stateIndex = 0
  let refIndex = 0
  const load = createLoader({
    react: {
      useState: initial => {
        const index = stateIndex++
        if (!(index in state)) state[index] = initial
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
      },
      useRef: initial => {
        const index = refIndex++
        return refs[index] ?? (refs[index] = { current: initial })
      },
      useEffect: () => {}, useCallback: fn => fn,
    },
    '@/lib/supabase/client': { createClient: () => client },
    '@/lib/supabaseRetry': { writeWithRetry: fastRetry, withRetry: async run => run() },
    '@/hooks/useAuth': { useAuth: () => ({ user }), PROFILE_UPDATED_EVENT: 'eren:profile-updated' },
    '@/hooks/useErenStats': { useErenStats: () => ({ refetch: async () => { fridgeRefreshes++ } }) },
    '@/contexts/TaskContext': { useTasks: () => ({ coins: balance, spendCoins: () => { throw new Error('Client must not charge') } }) },
  })
  // The hook uses relative imports for its neighbouring hooks too.
  const fs = require('node:fs')
  const path = require('node:path')
  const ts = require('typescript')
  const file = path.resolve(__dirname, '../src/hooks/useGacha.ts')
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  const hookRequire = id => {
    if (id === './useAuth') return { useAuth: () => ({ user }), PROFILE_UPDATED_EVENT: 'eren:profile-updated' }
    if (id === './useErenStats') return { useErenStats: () => ({ refetch: async () => { fridgeRefreshes++ } }) }
    if (id === 'react') return {
      useState: initial => { const i = stateIndex++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
      useRef: initial => { const i = refIndex++; return refs[i] ?? (refs[i] = { current: initial }) },
      useEffect: () => {}, useCallback: fn => fn,
    }
    if (id === '@/lib/supabase/client') return { createClient: () => client }
    if (id === '@/lib/supabaseRetry') return { writeWithRetry: fastRetry, withRetry: async run => run() }
    if (id === '@/contexts/TaskContext') return { useTasks: () => ({ coins: balance }) }
    if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
    return require(id)
  }
  new Function('require', 'module', 'exports', output)(hookRequire, module, module.exports)
  return () => { stateIndex = 0; refIndex = 0; return module.exports.useGacha() }
}
async function main() {
  let render = makeHook()
  mode = 'missing'
  assert.equal(await render().pullSingle('food'), null)
  assert.match(render().pullError, /saving update/)
  assert.equal(balance, 500)
  assert.equal(attempts.length, 1, 'Missing migration must fail safely without repeated requests')

  attempts = []
  mode = 'lost-response'
  assert.equal(await render().pullSingle('food'), null)
  assert.equal(balance, 450)
  assert.equal(grants, 1)
  assert.equal(new Set(attempts.map(a => a.args.p_request_id)).size, 1)
  assert.equal(storage.size, 1, 'Keep unconfirmed request across tab reload')
  assert.match(render().pullError, /without paying twice/)
  mode = 'success'
  render = makeHook() // Reset module memory, keeping browser session storage.
  const recovered = await render().pullSingle('food', true)
  assert.equal(recovered.item.id, 'cons_monsta_white')
  assert.equal(balance, 450)
  assert.equal(grants, 1)
  assert.equal(attempts.at(-1).args.p_use_ticket, false, 'Replay original payment, not changed ticket availability')
  assert.equal(storage.size, 0)
  assert.equal(fridgeRefreshes, 1)
  assert.equal(events.at(-1).detail.patch.coins, 450)

  const hook = render()
  const first = hook.pullSingle('food')
  assert.equal(await hook.pullSingle('food'), null, 'Same-tick double tap must not start a second request')
  assert.ok(await first)
  assert.equal(balance, 400)

  mode = 'throw'
  assert.equal(await render().pullSingle('animal'), null)
  assert.equal(render().pulling, false, 'Thrown requests must always release busy state')
  assert.equal(balance, 400)
  mode = 'insufficient'
  assert.equal(await render().pullTen('food'), null)
  assert.match(render().pullError, /Not enough coins/)
  assert.equal(render().pulling, false)

  const load = createLoader()
  const { purchaseFridgeFood } = load('src/lib/foodPurchase.ts')
  let paid = false
  let removed = false
  assert.equal(await purchaseFridgeFood('milk', 10, {
    addFood: async () => false,
    spendCoins: async () => { paid = true; return true },
    removeFood: async () => { removed = true; return true },
  }), false)
  assert.equal(paid, false)
  assert.equal(removed, false, 'A failed grant must not remove food already owned')
  console.log('Economy client checks passed: missing migration, lost response/reload recovery, same-tick double taps, original payment replay, busy cleanup, profile/fridge sync and failed-stock checkout.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
