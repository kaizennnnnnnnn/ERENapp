const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const mocks = {
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  '@/hooks/useCat': { useCat: () => ({ t: text => text.replace('{name}', 'Mochi') }) },
}
const load = require('./lib/load_ts.cjs')(mocks)
mocks['@/components/meadow'] = {
  ...load('src/components/meadow/tokens.ts'), ...load('src/components/meadow/Buttons.tsx'),
  ...load('src/components/meadow/Card.tsx'), ...load('src/components/meadow/Chips.tsx'),
  MeadowIcon: load('src/components/PixelIcons.tsx').MeadowIcon,
}
const Controls = load('src/components/vet/ClinicControls.tsx').default
const props = { reasons: ['Needs a bath', 'Needs more sleep', 'Lighter meals'], weight: 8.2, onGive() {}, onClose() {} }
for (const phase of ['loading', 'sick', 'giving', 'treated', 'healthy']) {
  const html = renderToStaticMarkup(React.createElement(Controls, { ...props, phase }))
  const finished = phase === 'treated' || phase === 'healthy'
  assert.equal((html.match(/<button/g) ?? []).length, finished ? 1 : 2)
  assert.equal(/ disabled=""/.test(html), phase === 'loading' || phase === 'giving')
  assert.match(html, /Back home/)
  assert.doesNotMatch(html, /Press Start|font-pixel|gradient|text-shadow/)
  if (phase === 'giving') assert.match(html, /aria-busy="true"/)
  if (!finished) assert.match(html, /Give Mochi medicine/)
  if (phase === 'sick' || phase === 'healthy') assert.match(html, /Mochi is feeling/)
  if (phase !== 'loading') { assert.match(html, /Care needs/); assert.match(html, /Weight: 8.2 kg/) }
  else assert.doesNotMatch(html, /Care needs|Weight:/)
  if (finished) assert.doesNotMatch(html, /Give Mochi medicine/)
}
const cured = renderToStaticMarkup(React.createElement(Controls, { ...props, phase: 'treated', reasons: [], weight: 4 }))
assert.match(cured, /Mochi is feeling better/); assert.doesNotMatch(cured, /needs below|Weight:/)

const file = 'src/components/care/HospitalScene.tsx', text = fs.readFileSync(file, 'utf8')
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const functions = new Map(), names = ['giveMedicine', 'showResult']
let phaseExpression, setupEffect
const reasonChecks = []
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.set(node.name.text, node.getText(source))
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'phase') phaseExpression = node.initializer.getText(source)
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('mounted.current = true')) setupEffect = node.arguments[0].getText(source)
  if (ts.isIfStatement(node) && node.thenStatement.getText(source).startsWith('reasons.push(')) reasonChecks.push(node.getText(source))
  ts.forEachChild(node, visit)
}
visit(source); assert.equal(functions.size, 2); assert.ok(setupEffect)
const js = ts.transpileModule([...functions.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const setupJs = ts.transpileModule(`const setup = ${setupEffect}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
const phase = new Function('giving', 'medGiven', 'stats', `return ${phaseExpression}`)
assert.equal(phase(true, false, { is_sick: false }), 'giving', 'Optimistic cure must not claim treatment is saved')
assert.equal(phase(false, false, null), 'loading'); assert.equal(phase(false, false, { is_sick: false }), 'healthy')
assert.equal(phase(false, true, { is_sick: false }), 'treated'); assert.equal(phase(false, false, { is_sick: true }), 'sick')
const reasons = new Function('stats', `const reasons = []; ${reasonChecks.join('\n')}; return reasons`)
assert.deepEqual(reasons(null), [])
assert.deepEqual(reasons({ cleanliness: 19, sleep_quality: 14, weight: 7.6 }), props.reasons)
assert.deepEqual(reasons({ cleanliness: 20, sleep_quality: 15, weight: 7.5 }), [], 'Keep existing sickness thresholds')
assert.doesNotMatch(text, /font-pixel|Press Start|setMedGiven\(true\)/)
assert.match(text, /erenGood_notail/); assert.match(text, /erenGood_tail/)
assert.match(text, /roomArt\('hospital', isDark\)/)
assert.doesNotMatch(text, /linear-gradient|radial-gradient|EXAMINATION TABLE|VENETIAN|CONE OF SHAME/)
const { roomArt } = load('src/lib/roomArt.ts')
for (const dark of [false, true]) {
  assert.equal(roomArt('hospital', dark), roomArt('vet', dark), 'Sick care reuses the existing vet-room painting')
  assert.ok(fs.existsSync('public' + roomArt('hospital', dark)))
}

function fixture() {
  const timers = new Map(), pending = [], writes = []
  let timerId = 0
  const env = {
    user: { id: 'tester' }, stats: { is_sick: true }, medGiven: false,
    mounted: { current: true }, saveLock: { current: false }, toastTimer: { current: null },
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId }, clearTimeout(id) { timers.delete(id) },
    applyAction(user, action) { writes.push([user, action]); return new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  }
  for (const name of ['Giving', 'MedGiven', 'Toast', 'ToastGood']) {
    const key = name[0].toLowerCase() + name.slice(1)
    env['set' + name] = value => { assert.equal(env.mounted.current, true, 'No UI writes after leaving'); env[key] = value }
  }
  const api = new Function('env', `with (env) { ${js}; return {${names.join(',')}} }`)(env)
  const cleanup = new Function('env', `with (env) { ${setupJs}; return setup() }`)(env)
  return { env, api, cleanup, writes, pending, timers }
}
async function main() {
  for (const state of ['no-user', 'no-stats', 'healthy', 'completed']) {
    const f = fixture()
    if (state === 'no-user') f.env.user = null
    if (state === 'no-stats') f.env.stats = null
    if (state === 'healthy') f.env.stats.is_sick = false
    if (state === 'completed') f.env.medGiven = true
    await f.api.giveMedicine(); assert.equal(f.writes.length, 0)
  }
  const f = fixture(), first = f.api.giveMedicine()
  assert.deepEqual(f.writes, [['tester', 'medicine']], 'Write starts immediately, with no artificial wait')
  await f.api.giveMedicine(); assert.equal(f.writes.length, 1); assert.equal(f.env.giving, true); assert.equal(f.env.medGiven, false)
  f.pending.shift().resolve({ success: false, message: 'Try again' }); await first
  assert.equal(f.env.medGiven, false); assert.equal(f.env.giving, false); assert.equal(f.env.saveLock.current, false); assert.equal(f.env.toastGood, false)
  const retry = f.api.giveMedicine(); assert.equal(f.env.toast, null); assert.equal(f.timers.size, 0)
  f.pending.shift().resolve({ success: true, message: 'Saved' }); await retry
  assert.equal(f.env.medGiven, true); assert.equal(f.env.toastGood, true); assert.equal(f.env.giving, false)
  await f.api.giveMedicine(); assert.equal(f.writes.length, 2, 'Do not give another dose after confirmation')
  assert.equal(f.timers.size, 1, 'A newer message replaces the old dismissal timer'); f.cleanup(); assert.equal(f.timers.size, 0)
  const rejected = fixture(); rejected.env.applyAction = async () => { throw Error('Offline') }
  await rejected.api.giveMedicine(); assert.equal(rejected.env.medGiven, false); assert.equal(rejected.env.giving, false); assert.equal(rejected.env.saveLock.current, false)
  assert.equal(rejected.env.toastGood, false); assert.match(rejected.env.toast, /try again/)
  const leaving = fixture(), save = leaving.api.giveMedicine(); leaving.cleanup()
  leaving.pending.shift().resolve({ success: true, message: 'Saved after leaving' }); await save
  assert.equal(leaving.timers.size, 0); assert.equal(leaving.env.saveLock.current, false)
  console.log('Clinic checks passed: Meadow states, renamed cat, visible care needs/weight, loading/healthy guards, immediate single write, slow-save pending, failed/rejected retry, confirmed-only recovery and unmount cleanup.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
