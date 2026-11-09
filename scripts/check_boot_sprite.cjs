const assert = require('node:assert/strict')
const React = require('react')

function sprite(props) {
  let frame = 4, effect, next = 0
  const timers = new Map(), originals = { setTimeout, clearTimeout }
  const mocks = { react: { ...React,
    useState: () => [frame, value => { frame = typeof value === 'function' ? value(frame) : value }],
    useRef: value => ({ current: value }), useEffect: fn => { effect = fn },
  } }
  const Component = require('./lib/load_ts.cjs')(mocks)('src/components/AnimatedEren.tsx').default
  const tree = Component(props)
  global.setTimeout = fn => { const id = ++next; timers.set(id, fn); return id }
  global.clearTimeout = id => timers.delete(id)
  try {
    const cleanup = effect()
    if (props.animate === false) {
      assert.equal(timers.size, 0, 'Reduced-motion pose must schedule no sprite animation')
      assert.equal(tree.props.children.props.frame[0], '.KK..........KK.......')
      assert.equal(cleanup, undefined)
    } else {
      assert.equal(timers.size, 1, 'Existing callers still animate by default')
      const [id, tick] = [...timers][0]
      timers.delete(id); tick()
      assert.equal(frame, 5)
      assert.equal(timers.size, 1)
      cleanup()
      assert.equal(timers.size, 0, 'Unmount clears the next sprite frame')
    }
    if (props.glow === false) assert.equal(tree.props.style, undefined)
    else assert.match(tree.props.style.filter, /drop-shadow/)
    assert.equal(tree.props.children.props.px, props.px ?? 5)
  } finally {
    global.setTimeout = originals.setTimeout
    global.clearTimeout = originals.clearTimeout
  }
}

sprite({})
sprite({ px: 6, glow: false, animate: true })
sprite({ px: 6, glow: false, animate: false })
console.log('Boot sprite checks passed: default animation, larger glow-free startup, reduced-motion idle pose and timer cleanup.')
