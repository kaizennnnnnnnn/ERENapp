const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const createLoader = require('./lib/load_ts.cjs')
const source = ts.createSourceFile('useErenStats.ts', fs.readFileSync(path.resolve(__dirname, '../src/hooks/useErenStats.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
let initializer
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'mutateFood') initializer = node.initializer.getText(source)
  ts.forEachChild(node, find)
}
find(source)
assert.ok(initializer)
const code = ts.transpileModule('const mutateFood = ' + initializer, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const make = new Function('useCallback', 'householdId', 'statsRef', 'foodQueue', 'setStats', 'supabase', 'savedRpc', code + '\nreturn mutateFood')
const server = { household_id: 'home', food_by_user: { alice: { milk: 1 }, bob: {} }, food_inventory: {} }
const requests = []
const clone = value => JSON.parse(JSON.stringify(value))
let fail = false
function device(actor) {
  const statsRef = { current: clone(server) }
  const queue = { current: Promise.resolve() }
  const rpc = {
    rpc: (name, args) => ({ abortSignal: async () => {
      assert.equal(name, 'mutate_fridge_atomic')
      assert.deepEqual(Object.keys(args).sort(), ['p_action', 'p_foods', 'p_recipient_id', 'p_request_id'])
      requests.push(args)
      if (fail) return { data: { ok: false, reason: 'out_of_stock' }, error: null }
      const pile = server.food_by_user[actor]
      for (const key of args.p_foods) pile[key] = (pile[key] ?? 0) + 1
      return { data: { ok: true, ...clone(server) }, error: null }
    } }),
  }
  const load = createLoader({ '@/lib/supabaseRetry': { writeWithRetry: run => run(new AbortController().signal) } })
  const { savedRpc } = load('src/lib/savedRpc.ts')
  const mutate = make(fn => fn, 'home', statsRef, queue, update => { statsRef.current = update(statsRef.current) }, rpc, savedRpc)
  return { statsRef, mutate }
}
async function main() {
  const alice = device('alice')
  const bob = device('bob') // stale device snapshot: milk=1
  const first = alice.mutate('alice', 'add', ['milk'])
  assert.equal(alice.statsRef.current.food_by_user.alice.milk, 1, 'Do not show optimistic, unsaved stock')
  assert.equal(await first, true)
  assert.equal(await bob.mutate('bob', 'add', ['cake_moonbeam']), true)
  assert.equal(server.food_by_user.alice.milk, 2, 'Stale device must not overwrite partner stock')
  assert.equal(server.food_by_user.bob.cake_moonbeam, 1)
  const two = [alice.mutate('alice', 'add', ['milk']), alice.mutate('alice', 'add', ['milk'])]
  assert.deepEqual(await Promise.all(two), [true, true])
  assert.equal(server.food_by_user.alice.milk, 4)
  assert.equal(new Set(requests.map(r => r.p_request_id)).size, 4, 'Separate queued actions must not share a receipt')
  const before = clone(alice.statsRef.current)
  fail = true
  assert.equal(await alice.mutate('alice', 'consume', ['milk']), false)
  assert.deepEqual(alice.statsRef.current, before, 'Failed save must not change local stock')
  console.log('Fridge client checks passed: actual mutation callback, stale device snapshots, same-tick queue, saved-only counts and failure preservation.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
