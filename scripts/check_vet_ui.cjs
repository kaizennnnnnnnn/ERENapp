const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
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

// Exercise the real async treatment handlers against failed/successful saves.
const source = ts.createSourceFile('VetScene.tsx', fs.readFileSync('src/components/care/VetScene.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const names = ['giveMedicine', 'giveLolipop', 'formatWait', 'lolipopReadyAt', 'markLolipopNow']
const found = []
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node.getText(source))
  ts.forEachChild(node, visit)
}
visit(source)
assert.equal(found.length, names.length)
const js = ts.transpileModule(found.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
let result = { success: false, message: 'Could not save this treatment.' }
const store = new Map()
const env = {
  user: { id: 'tester' }, giving: false, medGiven: false, isSleeping: false, lolBusy: false, lolWait: 0,
  reaction: { play() {} }, happyFinisherBeats: () => [], playSound() {}, completeTask() {}, pickEatPose: () => 0,
  applyAction: async () => result,
  setTimeout: (fn, ms) => { if (ms < 1200) fn() },
  LOLIPOP_AT_KEY: 'test-lollipop', LOLIPOP_COOLDOWN_MS: 30 * 60 * 1000, CELEBRATE_MS: 7000,
  localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }, window: {},
}
for (const field of ['Giving', 'MedGiven', 'Toast', 'TreatFlow', 'LolBusy', 'EatIdx', 'Now', 'ReadyAt', 'LolJustGiven']) {
  env['set' + field] = value => { env[field[0].toLowerCase() + field.slice(1)] = value }
}
const api = new Function('env', `with (env) { ${js}; return {${names.join(',')}} }`)(env)
async function main() {
  await api.giveMedicine()
  assert.equal(env.medGiven, false, 'A failed save must leave the medicine action available')
  assert.equal(env.giving, false)
  assert.equal(env.toast.ok, false)
  await api.giveLolipop()
  assert.equal(store.size, 0, 'A failed treat must not start its cooldown')
  result = { success: true, message: 'Feeling better!' }
  await api.giveMedicine()
  assert.equal(env.medGiven, true)
  assert.equal(env.toast.ok, true)
  await api.giveLolipop()
  assert.equal(store.size, 1)
  assert.ok(api.lolipopReadyAt() > Date.now())
  assert.equal(api.formatWait(45000), '45s')
  assert.equal(api.formatWait(60001), '2m')
  console.log('Vet checks passed: Meadow buttons, busy/sleep states, renamed cat, full report, treatment failure retry and saved-only lollipop cooldown.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
