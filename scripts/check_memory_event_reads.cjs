const assert = require('node:assert/strict')
const load = require('./lib/load_ts.cjs')()
const { createMemoryEventCheck } = load('src/lib/memoryChecks.ts')
const { createMemoryCheckQueue } = load('src/lib/memoryCheckQueue.ts')
const { createMemoryCounterReader } = load('src/lib/memoryCounters.ts')
const { MEMORY_FRAMES } = load('src/lib/memoryCatalogue.ts')
const tick = () => new Promise(setImmediate)
const hold = () => { let release; const promise = new Promise(done => { release = done }); return { promise, release } }
const feed = { type: 'action', actionType: 'feed' }
const wish = { type: 'wish', by: 'partner' }
const pet = { type: 'pet' }

function fixture(existing = ['first-day']) {
  const calls = [], frames = new Map(existing.map(frame_id => [frame_id, { frame_id }]))
  const state = { counts: {}, fail: null, rpc: null, rows: {}, countsByTable: {} }
  const db = {
    rpc(name, args) {
      return { abortSignal: async signal => {
        assert.equal(name, 'read_memory_counters')
        assert.equal(args.p_household_id, 'home')
        assert.equal(signal.aborted, false)
        calls.push({ kind: 'rpc', keys: args.p_keys })
        if (state.rpc) return state.rpc(args.p_keys, signal)
        return { data: Object.fromEntries(args.p_keys.map(k => [k, state.counts[k] ?? 0])), error: null }
      } }
    },
    from(table) {
      const call = { kind: 'read', table, filters: {} }
      const q = {
        select(columns, options) { call.columns = columns; call.count = !!options?.count; return q },
        eq(key, value) { call.filters[key] = value; return q },
        gte(key, value) { call.filters[key] = value; return q },
        in(key, value) { call.filters[key] = value; return q },
        abortSignal(signal) { call.signal = signal; return q },
        insert(row) { call.kind = 'write'; call.row = row; return q },
        maybeSingle() { return q },
        then(resolve, reject) {
          calls.push(call)
          return Promise.resolve().then(async () => {
            if (state.fail) { const result = await state.fail(call); if (result) return result }
            if (call.kind === 'write') {
              if (frames.has(call.row.frame_id)) return { error: {code:'23505'}, data: null }
              frames.set(call.row.frame_id, call.row)
              return { data: { frame_id: call.row.frame_id }, error: null }
            }
            if (table === 'memory_frames') return { data: Array.from(frames.values()), error: null }
            return { data: state.rows[table] ?? [], count: state.countsByTable[table] ?? 0, error: null }
          }).then(resolve, reject)
        },
      }
      return q
    },
  }
  const run = createMemoryEventCheck(db, 'home', 'me')
  return { db, calls, frames, state, run: (events, s = new AbortController().signal) => run(events, s) }
}

const tests = []
function test(name, run) { tests.push({ name, run }) }
test('a feed plus a wish keeps both firsts and reads just one relevant counter snapshot', async () => {
  const h = fixture()
  h.state.counts = {cares:10,feed:10,wishes:5,'both-care':2}
  await h.run([feed,wish])
  for (const id of ['first-feed','first-wish','cares-10','wishes-5','couple-both-cared']) assert.ok(h.frames.has(id), id)
  assert.equal(h.frames.get('first-wish').unlocked_by,'partner')
  assert.equal(h.frames.get('wishes-5').unlocked_by,'partner')
  assert.deepEqual(h.calls.filter(c => c.kind === 'rpc').map(c => c.keys.sort()), [['both-care','cares','feed','wishes']])
  assert.equal(h.calls.filter(c => c.kind === 'read').length,1)
  const writes = h.calls.filter(c => c.kind === 'write').length
  await h.run([feed,wish])
  assert.equal(h.calls.filter(c => c.kind === 'write').length,writes)
  assert.equal(h.calls.filter(c => c.kind === 'read').length,1)
  assert.equal(h.calls.filter(c => c.kind === 'rpc').length,2)
})
test('pet and message only read frame IDs once; repeated completed firsts do no IO', async () => {
  const h = fixture()
  await h.run([pet,{type:'message'}])
  await h.run([pet,{type:'message'}])
  assert.equal(h.calls.length,3)
  assert.ok(h.frames.has('first-pet') && h.frames.has('first-message'))
})
test('delivered notes and gifts keep qualifying for journal totals, not a first nudge', async () => {
  const h = fixture()
  h.state.counts = {nudges:10,traded:10}
  await h.run([{type:'delivery'}])
  assert.ok(h.frames.has('nudges-10') && h.frames.has('couple-nudges-traded-10'))
  assert.ok(!h.frames.has('first-nudge'))
})
test('finished care milestones skip every request for that action', async () => {
  const h = fixture(MEMORY_FRAMES.map(f => f.id))
  await h.run([feed]); await h.run([feed]); await h.run([pet])
  assert.deepEqual(h.calls.map(c => c.table),['memory_frames'])
})
test('missing RPC uses only relevant old-schema reads without reprobing on every event', async () => {
  const h = fixture(['first-day','first-feed'])
  h.state.rpc = () => ({error:{code:'PGRST202'}})
  await h.run([feed]); await h.run([feed])
  assert.equal(h.calls.filter(c=>c.kind === 'rpc').length,1)
  const counts = h.calls.filter(c=>c.table==='interactions')
  assert.equal(counts.length,6)
  assert.equal(counts.filter(c=>c.count).length,4)
  assert.ok(h.calls.every(c=>c.kind==='rpc'||['interactions','memory_frames'].includes(c.table)))
  const read = createMemoryCounterReader(h.db,'home')
  h.state.rows.profiles = [{id:'me'},{id:'partner'}]
  h.state.countsByTable.couple_journal = 10
  h.state.countsByTable.game_scores = 40
  assert.deepEqual(await read(['games','traded'],new AbortController().signal), {games:40,traded:10})
})
test('transient errors and malformed RPC responses do not fan out to the legacy reads', async () => {
  for (const reply of [{error:{code:'57014'}},{error:{code:'42501'}},{error:null,data:{cares:10}}]) {
    const h = fixture()
    h.state.rpc = () => reply
    await assert.rejects(h.run([feed]))
    assert.ok(h.frames.has('first-feed'))
    assert.ok(!h.frames.has('cares-10'))
    assert.ok(!h.calls.some(c=>c.table==='interactions'))
    h.state.counts.cares = 10; h.state.rpc = null
    await h.run([feed])
    assert.ok(h.frames.has('cares-10'))
  }
})
test('read and unlock failures retry without losing the original event or duplicating a committed frame', async () => {
  const h = fixture()
  h.state.fail = c => c.kind === 'read' ? {error:{code:'503'}} : null
  await assert.rejects(h.run([pet]))
  assert.equal(h.calls.length,1)
  h.state.fail = c => {
    if(c.kind !== 'write') return
    h.frames.set(c.row.frame_id,c.row) // committed, but reply lost
    return {error:{code:'503',message:'lost reply'}}
  }
  await assert.rejects(h.run([pet]))
  h.state.fail = null
  await h.run([pet]); await h.run([pet])
  assert.equal(h.calls.filter(c=>c.kind==='write').length,2)
  assert.equal(h.frames.size,2)
})
test('failed legacy sibling waits for the other requests, avoiding overlapping batches', async () => {
  const h = fixture(), slow = hold()
  h.state.rpc = () => ({error:{code:'42883'}})
  h.state.fail = async c => {
    if (c.count) return {error:{code:'503'}}
    if (c.table==='interactions') await slow.promise
  }
  let finished = false
  const p = h.run([feed]).catch(e => e).finally(() => { finished = true })
  await tick(); assert.equal(finished,false)
  slow.release()
  assert.match((await p).message,/count memory/)
})
test('scope abort releases a stuck read without issuing writes', async () => {
  const h = fixture(['first-feed','first-day']), stalled = hold(), scope = new AbortController()
  h.state.rpc = () => stalled.promise
  const p = h.run([feed],scope.signal)
  await tick(); scope.abort()
  await assert.rejects(p,{name:'AbortError'})
  stalled.release({ data:{cares:10,feed:10,'both-care':2},error:null })
  await tick()
  assert.ok(!h.calls.some(c=>c.kind==='write'))
})

async function fakeTimers(run) {
  const set = global.setTimeout, clear = global.clearTimeout, getNow = Date.now
  let now = 10000, id = 0
  const jobs = new Map()
  global.setTimeout = (fn,ms) => { jobs.set(++id,{fn,at:now+ms}); return id }
  global.clearTimeout = id => jobs.delete(id)
  Date.now = () => now
  async function advance(ms) {
    const end = now + ms
    for (;;) {
      const next = Array.from(jobs.entries()).filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]
      if (!next) break
      const [id, job] = next; jobs.delete(id); now = job.at; job.fn(); await tick()
    }
    now = end
  }
  try { await run(advance) } finally { global.setTimeout=set; global.clearTimeout=clear; Date.now=getNow }
}
test('event bursts dedupe by kind and queue exactly one follow-up while a request is slow', () => fakeTimers(async advance => {
  const slow = hold(), batches = []
  const queue = createMemoryCheckQueue(async events => { batches.push(events); if (batches.length===1) await slow.promise })
  queue.enqueue(feed); queue.enqueue(wish); queue.enqueue(feed)
  await advance(1200)
  assert.deepEqual(batches,[[feed,wish]])
  queue.enqueue(pet); queue.enqueue(pet); queue.resume()
  await advance(6000); assert.equal(batches.length,1)
  slow.release(); await tick(); await advance(1200)
  assert.deepEqual(batches,[[feed,wish],[pet]])
  queue.dispose()
}))
test('offline batches retry on resume, without polling or carrying work to a new user', () => fakeTimers(async advance => {
  const batches = []
  const queue = createMemoryCheckQueue(async events => { batches.push(events); if(batches.length===1) throw Error('offline') })
  queue.enqueue(feed); await advance(1200); await advance(10000); assert.equal(batches.length,1)
  queue.resume(); queue.enqueue(wish); await advance(1200)
  assert.deepEqual(batches,[[feed],[feed,wish]])
  queue.enqueue(pet); queue.dispose(); await advance(10000)
  assert.equal(batches.length,2)
}))
test('the app watcher batches real event names and rejects events from a previous household', () => fakeTimers(async advance => {
  const h = fixture()
  const oldWindow = global.window, oldDoc = global.document
  global.window = new EventTarget()
  global.document = new EventTarget()
  let dispose
  const withMocks = require('./lib/load_ts.cjs')({
    react: { useEffect: effect => { dispose = effect() } },
    '@/hooks/useAuth': { useAuth: () => ({ user: {id:'me'}, profile: {id:'me',household_id:'home'} }) },
    '@/lib/supabase/client': { createClient: () => h.db },
  })
  try {
    withMocks('src/components/memory/MemoryWatcher.tsx').default()
    const emit = (event, detail) => window.dispatchEvent(new CustomEvent(event, {detail}))
    emit('eren:my-action', {action_type:'play',household_id:'old',user_id:'me'})
    emit('eren:wish-granted', {householdId:'old',by:'old-partner'})
    await advance(1200)
    assert.equal(h.calls.length,0)
    emit('eren:my-action', {action_type:'feed',household_id:'home',user_id:'me'})
    emit('eren:wish-granted', {householdId:'home',by:'partner'})
    emit('eren:journal-delivered')
    await advance(1200)
    assert.ok(h.frames.has('first-feed') && h.frames.has('first-wish'))
    assert.equal(h.frames.get('first-wish').unlocked_by,'partner')
    assert.deepEqual(h.calls.filter(c=>c.kind==='rpc').map(c=>c.keys.sort()),
      [['both-care','cares','feed','nudges','traded','wishes']])
    const count = h.calls.length
    dispose()
    emit('eren:pet'); await advance(6000)
    assert.equal(h.calls.length,count)
  } finally { dispose?.(); global.window=oldWindow; global.document=oldDoc }
}))

;(async () => {
  for (const t of tests) { await t.run(); console.log('PASS ' + t.name) }
  console.log('Memory events: ' + tests.length + '/' + tests.length + ' passed')
})().catch(e => { console.error(e); process.exitCode = 1 })
