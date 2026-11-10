const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const cat = { name: 'Mochi', t: text => text.replaceAll('{name}', 'Mochi') }
const mocks = { '@/hooks/useCat': { useCat: () => cat }, 'next/link': ({ children, ...props }) => React.createElement('a', props, children) }
const load = require('./lib/load_ts.cjs')(mocks)
const tokens = load('src/components/meadow/tokens.ts')
const icons = load('src/components/PixelIcons.tsx')
mocks['@/components/meadow'] = {
  ...tokens, MeadowIcon: icons.MeadowIcon,
  ...load('src/components/meadow/Buttons.tsx'), ...load('src/components/meadow/Card.tsx'), ...load('src/components/meadow/Chips.tsx'),
}
const Checkup = load('src/components/vet/CheckupButton.tsx').default
const { default: Medicine, MedicineResultBanner } = load('src/components/vet/GiveMedicineButton.tsx')
const { default: Lollipop, LolipopBanner } = load('src/components/vet/GiveLolipopButton.tsx')
const Report = load('src/components/vet/HealthReport.tsx').default
function html(Component, props) { return renderToStaticMarkup(React.createElement(Component, props)) }
for (const Component of [Checkup, Medicine, Lollipop]) {
  const normal = html(Component, { state: Component === Checkup ? 'check' : 'give', onClick() {} })
  assert.match(normal, /Mochi/)
  assert.match(normal, /m-lip m-focus/)
  const busy = html(Component, { state: Component === Checkup ? 'checking' : 'giving', onClick() {}, disabled: true })
  assert.match(busy, /aria-busy="true"/)
  assert.match(busy, /disabled=""/)
  assert.doesNotMatch(normal + busy, /font-pixel|linear-gradient|text-shadow/)
}
const healthy = html(Report, { issues: [], weight: 4.1, energy: 82.3 })
for(const state of ['recover','recovering']){
  const rendered=html(Medicine,{state,onClick(){}});assert.match(rendered,/Retry treatment save/)
  assert.equal(/aria-busy="true"/.test(rendered),state==='recovering');assert.equal(/ disabled=""/.test(rendered),state==='recovering')
}
assert.match(healthy, /Mochi is in great shape!/)
assert.match(healthy, /4.1 kg/)
assert.match(healthy, /82%/)
const issues = ['Feeling sick', 'Needs a bath', 'Sleep deprived', 'Overweight', 'Very tired']
const sick = html(Report, { issues, weight: 8.2, energy: 12 })
issues.forEach(issue => assert.ok(sick.includes(issue)))
assert.match(sick, /Needs care/)
assert.match(sick, /aria-label="Health report"/)
assert.match(html(MedicineResultBanner, { healthy: false }), /Medicine given/)
assert.match(html(LolipopBanner, { waitLabel: '29m' }), /Another in 29m/)
assert.match(html(LolipopBanner, { waitLabel: null }), /Lollipop given/)
for (const name of ['stethoscope', 'pill', 'lollipop']) {
  assert.ok(icons.MEADOW_ICON_NAMES.includes(name))
  const markup = renderToStaticMarkup(React.createElement(icons.MeadowIcon, { name, size: 24 }))
  assert.match(markup, /svg/)
}

console.log('Vet UI checks passed: Meadow buttons, busy/sleep states, renamed cat and complete health reports.')
require('./check_vet_actions.cjs')
