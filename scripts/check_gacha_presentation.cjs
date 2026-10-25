// Run with: node scripts/check_gacha_presentation.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(relative, imports = {}) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  new Function('require', 'module', 'exports', outputText)(id => {
    assert.ok(imports[id], 'Unexpected runtime import ' + id)
    return imports[id]
  }, module, module.exports)
  return module.exports
}
const presentation = load('src/lib/gachaPresentation.ts')
const timeline = load('src/lib/gachaTreatOpening.ts')
const art = load('src/components/gacha/treatOpeningArt.ts', {
  '@/lib/gachaPresentation': presentation, '@/lib/gachaTreatOpening': timeline,
})
const bounds = require('../src/lib/gachaFoodBounds.json')
const machines = Object.keys(presentation.GACHA_SCENES)
assert.deepEqual(machines, ['food', 'animal', 'foodsuits', 'creatures'])
assert.equal(new Set(machines.map(id => presentation.GACHA_SCENES[id].src)).size, 4)
for (const scene of Object.values(presentation.GACHA_SCENES)) {
  assert.ok(fs.statSync(path.join(root, 'public', scene.src.split('?')[0])).size > 0)
  assert.equal(new Set(Object.values(scene.grounds)).size, 4)
}
for (const atlas of Object.values(presentation.PRESENTATION_ATLASES)) {
  assert.ok(fs.statSync(path.join(root, 'public', atlas.src.split('?')[0])).size > 0)
  for (const rect of [atlas.body, atlas.lid]) {
    const [x,y,w,h] = rect
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x+w <= 1254 && y+h <= 1254)
  }
  assert.ok(atlas.lid[1]+atlas.lid[3] < atlas.body[1])
}
assert.equal(Object.keys(bounds).length, 13)
for (const [id, box] of Object.entries(bounds)) {
  const filename = path.join(root, 'public/food', id.slice(5) + '.png')
  const png = fs.readFileSync(filename)
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)], box.size)
  const [x,y,w,h] = box.rect
  assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x+w <= box.size[0] && y+h <= box.size[1])
}
const atlasImage = {complete:true,naturalWidth:1254,naturalHeight:1254}
const rewardImage = {complete:true,naturalWidth:128,naturalHeight:128}
for (const kind of ['parcel','chef']) for (const rarity of ['common','rare','epic','legendary']) {
  for (const reduced of [false,true]) for (const open of [0,.02,.15,.3,.5,.7,.9,1]) {
    const calls = []
    const context = new Proxy({}, {
      get: (_target,key) => key === 'globalAlpha' ? 1 : (...args) => {calls.push([key,...args])},
      set: () => true,
    })
    art.drawTreatOpening(context,kind,{arrival:1,wind:1,open,fade:0,done:false,phase:'opening'},390,844,rarity,reduced,rewardImage,atlasImage)
    const images = calls.filter(c => c[0] === 'drawImage')
    assert.ok(images.length > 0)
    for (const image of images) {
      assert.ok(image.slice(2).every(Number.isFinite), 'Non-finite source or destination geometry')
      if (image.length === 10) assert.ok(image[4] > 0 && image[5] > 0 && image[8] > 0 && image[9] > 0)
    }
    if (kind === 'chef') assert.ok(!images.some(c => c[1] === rewardImage), 'Never put the cat under the lid')
    else {
      const body = presentation.getTreatAtlas(kind,rarity).body
      const draw = images.find(c => c.slice(2,6).every((n,i) => n === body[i]))
      assert.ok(draw)
      assert.equal(draw[8],256)
      assert.equal(draw[9],256*body[3]/body[2], 'The body must stay rigid during opening')
    }
  }
}
const reveal = fs.readFileSync(path.join(root,'src/components/gacha/PullAnimation.tsx'),'utf8')
assert.ok(!reveal.includes('pull-rays') && !reveal.includes('CanFx') && !reveal.includes('<Stage '))
console.log('Gacha presentation checks passed: four scenes, five illustrated atlases, thirteen food anchors, rigid box geometry, no cat under lid, no rays or shared flower stage.')
