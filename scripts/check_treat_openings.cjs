// Run with: node scripts/check_treat_openings.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../src/lib/gachaTreatOpening.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
new Function('exports', outputText)(mod.exports)
const { treatOpeningFrame: frame } = mod.exports

for (const kind of ['parcel', 'chef']) {
  for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
    for (const reduced of [false, true]) {
      // No reveal or automatic exit while the paid roll has not resolved.
      const waiting = frame(kind, 120000, null, null, reduced)
      assert.equal(waiting.phase, 'waiting')
      assert.equal(waiting.open, 0)
      assert.equal(waiting.fade, 0)
      assert.equal(waiting.done, false)
      assert.equal(frame(kind, 120000, 0, null, reduced).open, 0)
      assert.equal(frame(kind, 120000, null, rarity, reduced).open, 0)

      for (const readyAt of [0, 1700, 12000]) {
        let lastOpen = 0, lastFade = 0, finishedAt
        const phases = new Set()
        for (let ms = 0; ms <= readyAt + 4000; ms += 10) {
          const f = frame(kind, ms, readyAt, rarity, reduced)
          phases.add(f.phase)
          for (const key of ['arrival', 'wind', 'open', 'fade']) {
            assert.ok(Number.isFinite(f[key]) && f[key] >= 0 && f[key] <= 1)
          }
          assert.ok(f.open >= lastOpen && f.fade >= lastFade)
          if (ms <= readyAt) assert.equal(f.open, 0)
          if (f.fade > 0) assert.equal(f.open, 1)
          if (f.done) { finishedAt = ms; break }
          lastOpen = f.open; lastFade = f.fade
        }
        assert.ok(finishedAt > readyAt)
        assert.ok(finishedAt <= Math.max(readyAt, reduced ? 120 : 760) + (reduced ? 500 : 2400))
        assert.ok(phases.has('opening') && phases.has('presenting') && phases.has('leaving'))
        if (readyAt === 0) assert.ok(finishedAt <= (reduced ? 600 : 3200))
      }
    }
  }
  // The legendary anticipation is longer, not a different reward draw.
  const ordinary = frame(kind, 1500, 0, 'rare', false)
  const special = frame(kind, 1500, 0, 'legendary', false)
  assert.ok(special.open < ordinary.open)
  const lengths = ['common','rare','epic','legendary'].map(rarity => {
    for (let ms = 0; ms < 4000; ms += 10) if (frame(kind,ms,0,rarity,false).done) return ms
  })
  assert.equal(new Set(lengths).size,4,'Each rarity has a distinct opening rhythm')
}
console.log('Treat opening checks passed: both machines, four rarities, delayed rolls, ordered phases and reduced motion.')
