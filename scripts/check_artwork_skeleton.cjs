const assert = require('node:assert/strict')
const React = require('react')
const tick = () => new Promise(resolve => setImmediate(resolve))

async function fixture() {
  let settled = null, effect, cleanup, cached = false
  const images = [], updates = []
  global.Image = class {
    complete = cached
    naturalWidth = cached ? 500 : 0
    decode = () => Promise.resolve()
    constructor() { images.push(this) }
  }
  const mocks = { react: { ...React,
    useState: () => [settled, value => { settled = value; updates.push(value) }],
    useEffect: fn => { effect = fn },
  } }
  const Component = require('./lib/load_ts.cjs')(mocks)('src/components/loading/ArtworkSkeleton.tsx').default
  return {
    images, updates, get settled() { return settled },
    render(src) { return Component({ src, path: '/gacha' }) },
    mount() { cleanup = effect() }, unmount() { cleanup() }, cached() { cached = true },
  }
}

async function main() {
  let f = await fixture()
  assert.ok(f.render('/one.webp')); f.mount(); assert.equal(f.images[0].src, '/one.webp')
  f.images[0].onload(); await tick(); assert.equal(f.settled, '/one.webp'); assert.equal(f.render('/one.webp'), null); f.unmount()
  f = await fixture(); f.render('/bad.webp'); f.mount(); f.images[0].onerror(); assert.equal(f.render('/bad.webp'), null, 'Error cannot leave an endless skeleton'); f.unmount()
  f = await fixture(); f.render('/one.webp'); f.mount(); const oldLoad = f.images[0].onload; f.unmount(); f.render('/two.webp'); f.mount(); oldLoad(); await tick()
  assert.equal(f.settled, null, 'An old URL cannot dismiss the next image skeleton'); f.images[1].onload(); await tick(); assert.equal(f.render('/two.webp'), null); f.unmount()
  f = await fixture(); f.cached(); f.render('/cached.webp'); f.mount(); await tick(); assert.equal(f.render('/cached.webp'), null, 'Cached image needs no extra loading delay'); f.unmount()
  f = await fixture(); f.render('/slow.webp'); f.mount(); f.unmount(); assert.equal(f.images[0].onload, null); assert.equal(f.images[0].onerror, null); assert.equal(f.updates.length, 0)
  delete global.Image
  console.log('Artwork skeletons: 5 lifecycle checks passed (load, error, URL change, cache, unmount).')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
