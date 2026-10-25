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
const { treatOpeningFrame: frame, chefOpeningPool, pickChefOpening, chefLidPose } = mod.exports

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
for (const rarity of ['common','rare','epic','legendary']) {
  const pool = chefOpeningPool(rarity)
  assert.equal(pool.length,rarity === 'epic' || rarity === 'legendary' ? 3 : 1)
  assert.ok(pool.includes('original'),'The approved opening must remain available')
  const selected = new Set()
  let previous
  for (const sample of [0,.1,.3,.6,.8,.999,1,0,.9]) {
    const next = pickChefOpening(rarity,sample,previous)
    assert.ok(pool.includes(next))
    if (pool.length > 1) assert.notEqual(next,previous,'Do not repeat the previous cosmetic opening')
    selected.add(next); previous=next
  }
  assert.equal(selected.size,pool.length)
  const paths = []
  for (const variant of pool) {
    let lastPose, path=[]
    for (let i=0;i<=1000;i++) {
      const p=i/1000, pose=chefLidPose(rarity,p,1,false,variant)
      assert.ok(Object.values(pose).every(Number.isFinite))
      assert.ok(Math.abs(pose.x)<=200 && pose.y>=-200 && Math.abs(pose.angle)<.35)
      if (lastPose) assert.ok(Math.hypot(pose.x-lastPose.x,pose.y-lastPose.y)<4,'Lid motion must stay continuous')
      lastPose=pose
      if (i%100===0)path.push(pose)
      assert.deepEqual(chefLidPose(rarity,p,1,true,variant),chefLidPose(rarity,p,1,true),'Reduced motion keeps the approved gentle fade')
    }
    paths.push(JSON.stringify(path))
    for (const reduced of [false,true]) for (const readyAt of [0,1700,12000]) {
      let doneAt, lastRelease=0
      for (let ms=0;ms<readyAt+5000;ms+=10) {
        const f=frame('chef',ms,readyAt,rarity,reduced,variant)
        assert.ok(f.release>=lastRelease && f.release>=0 && f.release<=1)
        assert.ok(Number.isFinite(f.releaseMs) && f.releaseMs>=0)
        if(ms<readyAt)assert.equal(f.release,0)
        if(f.done){doneAt=ms;break}
        lastRelease=f.release
      }
      assert.ok(doneAt && doneAt<=Math.max(readyAt,reduced?120:760)+(reduced?500:3000))
      assert.equal(frame('chef',120000,null,null,reduced,variant).done,false)
      assert.deepEqual(frame('parcel',1600,0,rarity,reduced,variant),frame('parcel',1600,0,rarity,reduced),'Snack boxes are unchanged')
    }
  }
  assert.equal(new Set(paths).size,pool.length,'Variations need different physical lid paths')
}
console.log('Treat opening checks passed: original paths retained, three Epic and three Legendary serving openings, no immediate repeats, continuous lid motion, delayed rolls and reduced motion.')
