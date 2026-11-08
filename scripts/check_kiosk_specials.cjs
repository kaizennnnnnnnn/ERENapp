const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const createLoader = require('./lib/load_ts.cjs')
const load = createLoader()
const { nightlySpecialFor, specialOrder } = load('src/components/kiosk/kioskSpecials.ts')
const { menuFor, TOPPING_BY_ID, SAUCE_BY_ID } = load('src/components/kiosk/kioskShift.ts')
const { orderBase } = load('src/components/kiosk/kioskEconomy.ts')
const menu = menuFor(0)
let checked = 0
for (let day = 0; day < 366; day++) {
  const date = new Date(Date.UTC(2028, 0, 1 + day)).toISOString().slice(0, 10)
  const special = nightlySpecialFor(date, menu)
  assert.ok(special)
  assert.deepEqual(special, nightlySpecialFor(date, menu))
  for (const count of [25, 50, 95, 170, 300]) assert.deepEqual(special, nightlySpecialFor(date, menuFor(count)))
  assert.equal(special.date, date)
  assert.equal(special.customer.set, 'animal')
  assert.equal(special.wrap.toppings.length, 2)
  for (const id of special.wrap.toppings) assert.ok(TOPPING_BY_ID[id])
  assert.ok(menu.sauces.includes(special.wrap.sauce))
  assert.equal(SAUCE_BY_ID[special.wrap.sauce].unlockAt, 0)
  const order = specialOrder(special)
  assert.equal(orderBase(order), 12)
  assert.equal(order.usual, false)
  assert.equal(order.mood, 'normal')
  assert.equal(order.late, false)
  assert.equal(order.wraps.length, 1)
  assert.deepEqual(order.sides, [])
  assert.equal(order.special.id, special.id)
  assert.ok(fs.existsSync(path.join('public', special.customer.src.split('?')[0])))
  for (const id of order.wraps[0].toppings) assert.ok(fs.existsSync(path.join('public', TOPPING_BY_ID[id].sprite)))
  const snapshot = JSON.stringify(special)
  order.wraps[0].toppings.push('tomato')
  assert.equal(JSON.stringify(special), snapshot)
  checked++
}
const rotation = Array.from({ length: 7 }, (_, i) => nightlySpecialFor(`2026-11-${String(i + 1).padStart(2, '0')}`, menu).name)
assert.equal(new Set(rotation).size, 7)
for (const date of ['', 'tomorrow', '2026-02-29', '2026-13-01', '2026-04-31', '2026-1-1']) assert.equal(nightlySpecialFor(date, menu), null)
assert.ok(nightlySpecialFor('2028-02-29', menu))
assert.equal(nightlySpecialFor('2026-11-08', { sauces: [], sides: [] }), null)

function fixture(special) {
  const states = [], refs = [], effects = [], callbacks = []
  const timeouts = []
  let si = 0, ri = 0, ei = 0, ci = 0, scheduled = [], closed = null
  const changed = (old, deps) => !old || deps.some((value, i) => !Object.is(value, old.deps[i]))
  const react = {
    useState(initial) { const i = si++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(initial) { const i = ri++; return refs[i] || (refs[i] = { current: initial }) },
    useCallback(fn, deps) { const i = ci++; if (changed(callbacks[i], deps)) callbacks[i] = { fn, deps }; return callbacks[i].fn },
    useEffect(fn, deps) { const i = ei++; if (changed(effects[i], deps)) scheduled.push(() => {
      effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }
    }) },
  }
  const originals = { setTimeout, clearTimeout, setInterval, clearInterval, window: global.window }
  global.setTimeout = (fn, delay) => { const job = { fn, delay, active: true }; timeouts.push(job); return job }
  global.clearTimeout = job => { if (job) job.active = false }
  global.setInterval = () => 1
  global.clearInterval = () => {}
  global.window = { Image: class { decode() { return Promise.resolve() } } }
  const shiftLoad = createLoader({ react, '@/lib/sounds': { playSound() {} }, '@/hooks/useVisibilityPause': { useVisibilityPause() {} } })
  const useShift = shiftLoad('src/components/kiosk/useKioskShift.ts').useKioskShift
  const regulars = { [special.customer.id]: { wraps: [{ toppings: ['onion'], sauce: null, without: null }], sides: ['cola'], times: 4 } }
  const initialRegulars = JSON.stringify(regulars)
  const h = { render() {
    si = ri = ei = ci = 0; scheduled = []
    const value = useShift({ special, menu, regulars, lifetimeWraps: 0, nightSoFar: 0, payable: true,
      onClose: (report, visits) => { closed = { report, visits } } })
    scheduled.forEach(run => run()); return value
  }, async arrive(delay) {
    const job = timeouts.find(job => job.active && job.delay === delay)
    assert.ok(job, `No arrival scheduled at ${delay}`); job.active = false; job.fn()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    return h.render()
  }, serveSpecial() {
    h.render().carveMeat()
    for (const id of special.wrap.toppings) h.render().addTopping(id)
    if (special.wrap.sauce) h.render().addSauce(special.wrap.sauce)
    h.render().rollWrap('neat'); h.render().serve()
    return h.render()
  }, dispose() {
    effects.forEach(effect => effect?.cleanup?.())
    assert.equal(JSON.stringify(regulars), initialRegulars)
    Object.assign(global, originals)
  }, get closed() { return closed } }
  h.render(); return h
}

;(async () => {
  const special = nightlySpecialFor('2026-11-08', menu)
  const h = fixture(special)
  try {
    const opened = await h.arrive(1400)
    assert.equal(opened.order.special.id, special.id)
    assert.equal(opened.order.customer.id, special.customer.id)
    assert.equal(opened.order.usual, false)
    assert.deepEqual(opened.order.wraps, [special.wrap])
    const served = h.serveSpecial()
    assert.equal(served.status, 'paid')
    assert.equal(served.till.served, 1)
    assert.equal(served.till.base, 12)
    h.render().closeUp(0)
    assert.equal(h.closed.report.coins, 12)
    assert.deepEqual(h.closed.visits, {})
  } finally { h.dispose() }
  const later = fixture(special)
  try {
    await later.arrive(1400); later.serveSpecial()
    const next = await later.arrive(880 + 1500 + 760 + 700)
    assert.equal(next.order.special, undefined)
  } finally { later.dispose() }
  console.log(`Nightly specials passed: ${checked} calendar days, seven recipes, unlocked ingredients, stable prices, real opening/serving/next-customer hooks and unchanged regulars.`)
})().catch(error => { console.error(error); process.exitCode = 1 })
