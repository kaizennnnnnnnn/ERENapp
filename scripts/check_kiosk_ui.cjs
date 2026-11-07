const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const createLoader = require('./lib/load_ts.cjs')
const mocks = {}
const load = createLoader(mocks)
const tokens = load('src/components/meadow/tokens.ts')
const icons = load('src/components/PixelIcons.tsx')
mocks['@/components/meadow'] = {
  ...tokens, MeadowIcon: icons.MeadowIcon,
  ...load('src/components/meadow/Buttons.tsx'), ...load('src/components/meadow/Controls.tsx'),
}
const Report = load('src/components/kiosk/ShiftReport.tsx').default
const Stations = load('src/components/kiosk/KioskStations.tsx').default
const Front = load('src/components/kiosk/KioskFrontControls.tsx').default
const { KIOSK: K } = load('src/components/kiosk/kioskTheme.ts')
const html = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const report = {
  takings: { served: 3, wrong: 1, walked: 2, missedCalls: 1, bestStreak: 3, base: 30, tips: 12, inDark: 1 },
  grade: 'B', coins: 42, paid: true, weather: 'rain', early: false, nightTotal: 3, goalMet: false, unlock: null,
}
const props = { report, practiceReason: null, banked: true, saving: false, saveError: null,
  onRetry() {}, canNote: true, onSaveNote: async () => true, onDone() {} }
const paid = html(Report, props)
for (const text of ['Shift complete', 'Taken home', '42 coins received', 'Together tonight', 'Leave a note at the till', 'Back to the street', 'Orders served', 'Missed calls']) assert.ok(paid.includes(text), text)
assert.match(paid, /role="dialog" aria-modal="true"/)
assert.match(paid, /aria-label="Pin note" disabled=""/)
assert.doesNotMatch(paid, /font-pixel|repeating-linear-gradient|text-shadow/)
const pending = html(Report, { ...props, banked: false, saving: true, canNote: false })
assert.match(pending, /Earnings awaiting confirmation/)
assert.doesNotMatch(pending, /42 coins received|Leave a note at the till/)
const offline = html(Report, { ...props, banked: false, saving: false, saveError: 'Connection lost', canNote: false })
assert.match(offline, /Connection lost/)
assert.match(offline, /Retry save/)
const practice = html(Report, { ...props, report: { ...report, paid: false, coins: 0 }, canNote: false, practiceReason: 'Practice shift' })
assert.match(practice, /0 coins received/)
assert.doesNotMatch(practice, /Leave a note at the till/)
const goal = html(Report, { ...props, report: { ...report, goalMet: true, nightTotal: 25 } })
assert.match(goal, /Nightly goal complete/)
assert.match(goal, /aria-valuenow="22"/)
for (const value of ['window', 'meat', 'fridge', 'toppings']) {
  const rendered = html(Stations, { value, onChange() {} })
  assert.equal((rendered.match(/role="radio"/g) || []).length, 4)
  assert.equal((rendered.match(/aria-checked="true"/g) || []).length, 1)
  for (const name of ['Window', 'Grill', 'Fridge', 'Prep']) assert.ok(rendered.includes(name))
}
const front = html(Front, { record: { loaded: true, pending: 0, starting: false, lastShift: { served: 3, grade: 'B', note: 'More onions tomorrow' }, tonight: 3, week: { mine: 3, theirs: 2 } },
  mine: true, practiceReason: 'Paid shift already complete.', disabled: false, onEnter() {} })
assert.match(front, /<details/)
assert.match(front, /More onions tomorrow/)
assert.match(front, /Start practice shift/)

// Keyboard holds must keep the same duration, cancellation and one-shot completion as touch.
let now = 0, raf = null, calls = 0
global.requestAnimationFrame = fn => { raf = fn; return 1 }
global.cancelAnimationFrame = () => { raf = null }
const originalPerformance = global.performance
global.performance = { now: () => now }
const advance = time => { now = time; const callback = raf; raf = null; callback(now) }
const hookMocks = { useState: initial => [initial, () => {}], useRef: current => ({ current }),
  useCallback: fn => fn, useEffect() {} }
const holdLoad = createLoader({ react: hookMocks, '@/lib/sounds': { playSound() {} } })
const Hold = holdLoad('src/components/kiosk/HoldTarget.tsx').default
const button = Hold({ duration: 2200, onComplete: () => calls++, 'aria-label': 'Refill tomato' }).props
const key = (name, repeat = false) => ({ key: name, repeat, preventDefault() {} })
button.onKeyDown(key(' ')); advance(1000)
assert.equal(calls, 0)
button.onKeyUp(key(' ')); assert.equal(raf, null)
now = 3000; button.onKeyDown(key('Enter')); advance(5199)
assert.equal(calls, 0)
advance(5200); assert.equal(calls, 1)
button.onKeyDown(key('Enter', true)); assert.equal(raf, null)
button.onKeyUp(key('Enter')); assert.equal(calls, 1)
button.onPointerDown(); button.onBlur(); assert.equal(raf, null)
const disabled = Hold({ disabled: true, onComplete: () => calls++ }).props
disabled.onKeyDown(key(' ')); assert.equal(raf, null)
global.performance = originalPerformance

const coverLoad = createLoader({ react: { useState: initial => [initial(), () => {}], useEffect() {} } })
global.window = { innerWidth: 1280, innerHeight: 1000 }
const useCoverBox = coverLoad('src/components/kiosk/useCoverBox.ts').useCoverBox
const cover = useCoverBox(768, 1376, { current: { clientWidth: 430, clientHeight: 932 } })
assert.equal(cover.height, 932)
assert.ok(Math.abs(cover.left + cover.width / 2 - 215) < .001)
delete global.window

function luminance(hex) {
  const c = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
}
for (const foreground of [K.text, K.muted, K.faint, K.leaf, K.coin, K.danger]) {
  for (const background of [K.ground, K.surface, K.raised]) {
    const contrast = (luminance(foreground) + .05) / (luminance(background) + .05)
    assert.ok(contrast >= 4.5, `${foreground} on ${background}: ${contrast}`)
  }
}
console.log('Kiosk UI passed: paid/pending/offline/practice/goal receipts, four stations, last shift, keyboard holds and 18 AA text contrasts.')
