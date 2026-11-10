const assert = require('node:assert/strict')
const fs = require('node:fs')
const createLoader = require('./lib/load_ts.cjs')
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }

function fixture() {
  const states = [], refs = [], memos = [], effects = [], images = []
  let si, ri, mi, ei, pending, dirty = false, live = true, late = 0, tree
  const state = { scene: null, dark: false, hold: false }
  const changed = (old, deps) => !old || deps.some((d, i) => !Object.is(d, old.deps[i]))
  const react = {
    useState(initial) { const i = si++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
      return [states[i], value => { if (!live) late++; const next = typeof value === 'function' ? value(states[i]) : value; if (!Object.is(next, states[i])) { states[i] = next; dirty = true } }] },
    useRef(initial) { const i = ri++; return refs[i] ?? (refs[i] = { current: initial }) },
    useMemo(fn, deps) { const i = mi++; if (changed(memos[i], deps)) memos[i] = { value: fn(), deps }; return memos[i].value },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps) },
    useEffect(fn, deps) { const i = ei++, old = effects[i]; if (changed(old, deps)) pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() } }) },
  }
  react.useLayoutEffect = react.useEffect
  const openScene = scene => { state.scene = scene }, closeScene = () => { state.scene = null }
  const components = Object.fromEntries(['feed', 'play', 'sleep', 'wash', 'chemistry', 'vet', 'garden', 'talk', 'hospital'].map(scene => [scene, function Scene() {}]))
  const sceneFiles = { FeedScene: 'feed', PlayScene: 'play', SleepScene: 'sleep', WashScene: 'wash', ChemistryScene: 'chemistry', VetScene: 'vet', GardenScene: 'garden', TalkScene: 'talk', HospitalScene: 'hospital' }
  const load = createLoader({ react,
    '@/contexts/CareContext': { useCare: () => ({ activeScene: state.scene, openScene, closeScene }) },
    '@/hooks/useErenStats': { useErenStats: () => ({ stats: null }) },
    '@/hooks/useIsDark': { useIsDark: () => state.dark }, '@/lib/skins': { resolveRoomSkin: () => null },
    '@/lib/sounds': { playSound() {} }, '@/components/AnimatedEren': { default() {} },
    '@/components/CurtainGlitter': { default() {} }, '@/components/meadow': { M: {}, PrimaryButton() {}, TextButton() {} },
    ...Object.fromEntries(Object.entries(sceneFiles).map(([file, scene]) => ['./' + file, { default: components[scene] }])),
  })
  global.window = { innerWidth: 390, Image: class {
    decode() { const hold = deferred(); images.push({ src: this.src, ...hold }); if (!state.hold) hold.resolve(); return hold.promise }
  } }
  const Host = load('src/components/care/CareSceneHost.tsx').default
  function walk(value, visit) { if (Array.isArray(value)) return value.forEach(v => walk(v, visit)); if (!value?.props) return; visit(value); walk(value.props.children, visit) }
  const h = {
    state, images, components,
    render() { si = ri = mi = ei = 0; pending = []; dirty = false; tree = Host(); walk(tree, n => { if (n.ref && typeof n.ref === 'object' && !n.ref.current) n.ref.current = {} }); pending.forEach(fn => fn()); return tree },
    async settle() { for (let i = 0; i < 15; i++) { h.render(); await flush(); if (!dirty) return tree } throw Error('Host did not settle') },
    all(test) { const result = []; walk(tree, n => { if (test(n)) result.push(n) }); return result },
    room() { return h.all(n => Object.values(components).includes(n.type))[0] },
    stage() { return h.all(n => typeof n.props.onTouchStart === 'function')[0] },
    async open(scene) { state.scene = scene; await h.settle() },
    async release() { for (const image of images) image.resolve(); await h.settle() },
    async swipe(dir) { const stage = h.stage(); assert.ok(stage); const from = dir === 'left' ? 320 : 50, to = dir === 'left' ? 50 : 320
      stage.props.onTouchStart({ touches: [{ clientX: from, clientY: 200 }] }); stage.props.onTouchMove({ touches: [{ clientX: to, clientY: 200 }] }); stage.props.onTouchEnd({ changedTouches: [{ clientX: to, clientY: 200 }] }); await h.settle() },
    unmount() { effects.forEach(e => e?.cleanup?.()); live = false }, get late() { return late },
  }
  h.render()
  return h
}

const tests = [], test = (name, run) => tests.push({ name, run })
test('first entry leaves the real home underneath until artwork is decoded', async () => {
  const h = fixture(); try { h.state.hold = true; await h.open('feed'); assert.equal(h.room(), undefined); assert.equal(h.all(n => n.props.role === 'status').length, 1)
    assert.equal(h.all(n => n.props.className === 'fixed inset-0 z-40 overflow-hidden').length, 0, 'No empty between-room backdrop over home')
    await h.release(); assert.equal(h.room().type, h.components.feed); assert.equal(h.all(n => n.props.role === 'status').length, 0)
  } finally { h.unmount() }
})
test('a slow swipe retains the exact outgoing scene and blocks its controls', async () => {
  const h = fixture(); try { await h.open('feed'); const room = h.room(), key = h.stage().key; h.state.hold = true; await h.swipe('left')
    assert.equal(h.state.scene, 'play'); assert.equal(h.room(), room); assert.equal(h.stage().key, key); assert.equal(h.stage().props['aria-busy'], true); assert.equal(h.stage().ref.current.inert, true)
    assert.equal(h.all(n => n.props.role === 'status')[0].props['aria-label'], 'Opening Playroom')
    await h.release(); assert.equal(h.room().type, h.components.play); assert.notEqual(h.stage().key, key); assert.equal(h.stage().ref.current.inert, false)
    assert.match(h.stage().props.style.animation, /slideInRight/)
  } finally { h.unmount() }
})
test('all rooms swipe both ways without a skeleton, and edge swipes return home', async () => {
  const h = fixture(); try { await h.open('feed'); const rooms = ['feed', 'play', 'sleep', 'wash', 'chemistry', 'vet', 'garden', 'talk']
    for (const room of rooms.slice(1)) { await h.swipe('left'); assert.equal(h.room().type, h.components[room]) }
    await h.swipe('right'); assert.equal(h.room().type, h.components.garden); assert.match(h.stage().props.style.animation, /slideInLeft/)
    await h.open('talk'); await h.swipe('left'); assert.equal(h.state.scene, null); assert.equal(h.room(), undefined)
    await h.open('feed'); await h.swipe('right'); assert.equal(h.state.scene, null)
  } finally { h.unmount() }
})
test('failed incoming assets keep the outgoing room and show working retry/home choices', async () => {
  const h = fixture(); try { await h.open('feed'); h.state.hold = true; await h.swipe('left'); h.images.at(-1).reject(Error('offline')); await h.settle()
    assert.equal(h.room().type, h.components.feed); assert.equal(h.all(n => n.props.role === 'alert').length, 1); assert.equal(h.all(n => n.props.role === 'status').length, 0)
    const retry = h.all(n => n.props.children === 'Try again')[0]; h.state.hold = false; retry.props.onClick(); await h.settle()
    assert.equal(h.room().type, h.components.play); assert.equal(h.all(n => n.props.role === 'alert').length, 0)
  } finally { h.unmount() }
})
test('late images cannot reopen a closed room or replace a newer navigation', async () => {
  for (const mode of ['home', 'newer', 'unmount']) { const h = fixture(); try { await h.open('feed'); h.state.hold = true; await h.open('play'); const old = [...h.images]
    if (mode === 'unmount') h.unmount(); else if (mode === 'home') await h.open(null); else { h.state.hold = false; await h.open('sleep') }
    old.forEach(image => image.resolve()); await flush(); if (mode !== 'unmount') await h.settle()
    assert.equal(h.late, 0); if (mode === 'home') assert.equal(h.room(), undefined); if (mode === 'newer') assert.equal(h.room().type, h.components.sleep)
  } finally { if (mode !== 'unmount') h.unmount() } }
})
test('room-only change preserves startup/page skeletons and asset failure handling', () => {
  const host = fs.readFileSync('src/components/care/CareSceneHost.tsx', 'utf8')
  assert.doesNotMatch(host, /PageSkeleton/); assert.match(host, /img\.decode\(\)/); assert.match(host, /cancelled = true/)
  assert.match(fs.readFileSync('src/app/(app)/home/page.tsx', 'utf8'), /PageLoader/)
  assert.match(fs.readFileSync('src/components/PageLoader.tsx', 'utf8'), /PageSkeleton/)
  assert.match(fs.readFileSync('src/app/(app)/home/loading.tsx', 'utf8'), /LoadingSkeleton/)
})

async function main() {
  const original = { setTimeout, clearTimeout, window: global.window }
  global.setTimeout = () => 1; global.clearTimeout = () => {}
  let failed = 0
  try { for (const { name, run } of tests) { try { await run(); console.log('PASS ' + name) } catch (error) { failed++; console.error('FAIL ' + name, error) } } }
  finally { global.setTimeout = original.setTimeout; global.clearTimeout = original.clearTimeout; if (original.window === undefined) delete global.window; else global.window = original.window }
  console.log(`Room swipes: ${tests.length - failed}/${tests.length} passed (actual host, controlled image decoding)`); if (failed) process.exitCode = 1
}
main().catch(error => { console.error(error); process.exitCode = 1 })
