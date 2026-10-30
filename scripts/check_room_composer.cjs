const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const mocks = {
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  '@/hooks/useCat': { useCat: () => ({ t: text => text.replace('{name}', 'Eren') }) },
}
const load = require('./lib/load_ts.cjs')(mocks)
mocks['@/components/meadow'] = {
  ...load('src/components/meadow/tokens.ts'), ...load('src/components/meadow/Buttons.tsx'),
  ...load('src/components/meadow/Card.tsx'), ...load('src/components/meadow/Controls.tsx'),
  MeadowIcon: load('src/components/PixelIcons.tsx').MeadowIcon,
}
let chat, stats, queue, effects, updates, sounds, sent, opened
mocks['@/contexts/ErenChatContext'] = { useErenChatContext: () => chat }
mocks['@/hooks/useErenStats'] = { useErenStats: () => ({ stats }) }
mocks['@/lib/sounds'] = { playSound: name => sounds.push(name) }
mocks.react = {
  ...React,
  useState: initial => {
    const index = updates.length
    updates.push([])
    return [queue.length ? queue.shift() : initial, value => updates[index].push(value)]
  },
  useRef: current => ({ current }),
  useCallback: callback => callback,
  useEffect: callback => effects.push(callback),
}
const Composer = load('src/components/talk/RoomComposer.tsx').default
function render({ open = false, draft = '', sending = false, spent = false, energy = 90, keyboard = 0 } = {}) {
  sent = []; sounds = []; opened = 0
  chat = { sending, spent, send: text => sent.push(text) }
  stats = { energy }
  queue = [open, draft, keyboard]; effects = []; updates = []
  const tree = Composer({ onOpenTranscript: () => opened++ })
  return { tree, html: renderToStaticMarkup(tree) }
}
function find(tree, predicate) {
  if (!React.isValidElement(tree)) return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props.children)) {
    const match = find(child, predicate)
    if (match) return match
  }
  return null
}
const byLabel = (tree, label) => find(tree, node => node.props.ariaLabel === label || node.props['aria-label'] === label)

let { tree, html } = render()
assert.match(html, /Talk to Eren/)
assert.match(html, /meadow-root/)
assert.doesNotMatch(html, /linear-gradient|Press Start|text-shadow|font-pixel/)
byLabel(tree, 'Open the whole conversation').props.onClick()
assert.equal(opened, 1)
find(tree, node => node.type.name === 'TalkButton').props.onClick()
assert.deepEqual(updates[0], [true])
assert.deepEqual(sounds, ['ui_tap'])

;({ tree, html } = render({ open: true, draft: '  hello  ' }))
assert.match(html, /maxLength="2000"/)
assert.match(html, /font-size:16px/)
const form = byLabel(tree, 'Send a message')
form.props.onSubmit({ preventDefault() {} })
assert.deepEqual(sent, ['hello'])
assert.deepEqual(updates[1], [''])
assert.equal(byLabel(tree, 'Send message').props.disabled, false)
let prevented = 0
byLabel(tree, 'Message').props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() { prevented++ } })
assert.equal(prevented, 1, 'IME confirmation must not submit the form')
global.requestAnimationFrame = callback => callback()
byLabel(tree, 'Message').props.onKeyDown({ key: 'Escape', nativeEvent: {}, preventDefault() {} })
assert.deepEqual(updates[0], [false])
assert.equal(sounds.at(-1), 'ui_back')

for (const state of [{ draft: '   ' }, { draft: 'hello', sending: true }]) {
  ;({ tree, html } = render({ open: true, ...state }))
  byLabel(tree, 'Send a message').props.onSubmit({ preventDefault() {} })
  assert.equal(sent.length, 0)
  assert.match(html, /disabled=""/)
  if (state.sending) assert.match(html, /aria-busy="true"/)
}
for (const state of [{ energy: 20 }, { spent: true }]) {
  ;({ tree, html } = render({ open: true, draft: 'unsent', ...state }))
  assert.match(html, /Fast asleep/)
  assert.doesNotMatch(html, /<input/)
  byLabel(tree, 'Open the whole conversation').props.onClick()
  assert.equal(opened, 1, 'Tired cats still have a readable transcript')
  effects.at(-1)()
  assert.deepEqual(updates[0], [false])
  assert.deepEqual(updates[1], [''])
}

;({ tree } = render({ open: true, keyboard: 280 }))
assert.match(tree.props.style.bottom, /280px/)
let stops = 0
for (const event of ['onTouchStart', 'onTouchMove', 'onTouchEnd']) tree.props[event]({ stopPropagation() { stops++ } })
assert.equal(stops, 3, 'Editing a message must not swipe to another room')
const listeners = new Map()
global.window = {
  innerHeight: 844,
  visualViewport: {
    height: 544, offsetTop: 20,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  },
}
const cleanup = effects[0]()
assert.deepEqual(updates[2], [280])
window.visualViewport.height = 844; window.visualViewport.offsetTop = 0
listeners.get('resize')()
assert.equal(updates[2].at(-1), 0, 'Closing the keyboard returns the bar to the floor')
cleanup()
assert.equal(listeners.size, 0)
delete global.window
delete global.requestAnimationFrame
console.log('Room composer checks passed: Meadow controls, trimmed sends, blank/busy guards, tired/daily gates, transcript access, IME, Escape, touch isolation and keyboard viewport cleanup.')
