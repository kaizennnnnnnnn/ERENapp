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
const rooms = load('src/components/gacha/pixelRoomArt.ts')
const effects = load('src/components/gacha/gachaRarityArt.ts', {
  '@/lib/gachaPresentation': presentation, '@/lib/gachaTreatOpening': timeline,
})
const art = load('src/components/gacha/treatOpeningArt.ts', {
  '@/lib/gachaPresentation': presentation, '@/lib/gachaTreatOpening': timeline,
  './gachaRarityArt': effects,
})
const bounds = require('../src/lib/gachaFoodBounds.json')
const machines = Object.keys(presentation.GACHA_REVEAL_THEMES)
assert.deepEqual(machines, ['food', 'animal', 'foodsuits', 'creatures'])
assert.equal(new Set(machines.map(id => presentation.GACHA_REVEAL_THEMES[id].motif)).size, 4)
assert.equal(new Set(Object.values(presentation.RARITY_MOTION).map(m => m.sequence)).size, 4)
assert.ok(!Object.values(presentation.GACHA_REVEAL_THEMES).some(theme => 'src' in theme))
assert.equal(new Set(['rare','epic','legendary'].map(rarity=>presentation.getTreatAtlas('chef',rarity).src)).size,3,'Serving sets must have different artwork, not recoloured stamps')
const costumeMachines = ['animal','foodsuits','creatures']
const costumeRarities = ['rare','epic','legendary']
const allRooms = costumeMachines.flatMap(machine => costumeRarities.flatMap(rarity => presentation.getSkinRoomPool(machine,rarity)))
assert.equal(allRooms.length,27)
assert.equal(new Set(allRooms.map(room=>room.id)).size,27,'Machine, rarity and variation need unique room IDs')
assert.equal(new Set(allRooms.map(room=>room.name)).size,27,'Every room needs its own theme')
assert.ok(allRooms.every(room=>!('src' in room)),'Room metadata must not point at background pictures')
for(const rarity of ['common',...costumeRarities]) {
  assert.deepEqual(presentation.getSkinRoomPool('food',rarity),[])
  assert.equal(presentation.getSkinRewardRoom('food',rarity),null)
  assert.equal(presentation.pickSkinRewardRoom('food',rarity,.5),null)
}
for(const machine of costumeMachines) for(const rarity of costumeRarities) {
  const pool=presentation.getSkinRoomPool(machine,rarity)
  assert.deepEqual(pool.map(room=>room.variant),[0,1,2])
  for(const room of pool) {
    assert.equal(presentation.getSkinRewardRoom(machine,rarity,room.variant),room)
    for(const sample of [-1,0,.2,.5,.8,1,2]) {
      const picked=presentation.pickSkinRewardRoom(machine,rarity,sample,room.id)
      assert.ok(pool.includes(picked),'Room choices stay inside their machine and rarity')
      assert.notEqual(picked.id,room.id,'Consecutive reveals must not repeat a room')
    }
    const otherMachine=costumeMachines.find(id=>id!==machine)
    assert.equal(presentation.pickSkinRewardRoom(machine,rarity,0,`${otherMachine}-${rarity}-0`),pool[0],'Other machines do not affect this pool')
  }
  assert.equal(new Set([0,.4,.8].map(sample=>presentation.pickSkinRewardRoom(machine,rarity,sample).id)).size,3)
  assert.equal(presentation.getSkinRoomPool(machine,'common'),presentation.getSkinRoomPool(machine,'rare'))
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
function trace(recordStyles=false) {
  const calls = []
  const context = new Proxy({globalAlpha:1}, {
    get: (target,key) => key in target ? target[key] : (...args) => {calls.push([key,...args])},
    set: (target,key,value) => {target[key]=value;if(recordStyles)calls.push(['set',key,value]);return true},
  })
  return {calls,context}
}
const roomStyles=[]
for(const machine of costumeMachines) for(const rarity of costumeRarities) for(const variant of [0,1,2]) {
  const early=trace(true),late=trace(true),quiet=trace(true),quietLater=trace(true)
  rooms.drawPixelRoom(early.context,machine,rarity,variant,0,false)
  rooms.drawPixelRoom(late.context,machine,rarity,variant,1800,false)
  rooms.drawPixelRoom(quiet.context,machine,rarity,variant,0,true)
  rooms.drawPixelRoom(quietLater.context,machine,rarity,variant,1800,true)
  assert.notDeepEqual(early.calls,late.calls,'A live room must animate')
  assert.deepEqual(quiet.calls,quietLater.calls,'Reduced motion keeps room geometry still')
  assert.ok(early.calls.filter(call=>call[0]==='fillRect').length>100,'Rooms need furniture and floor detail')
  for(const call of [...early.calls,...late.calls]) {
    assert.notEqual(call[0],'drawImage','The room painter must draw shapes, not load a room picture')
    for(const arg of call.slice(1))if(typeof arg==='number')assert.ok(Number.isFinite(arg))
  }
  roomStyles.push(JSON.stringify(early.calls.filter(call=>call[0]!=='set')))
}
assert.equal(new Set(roomStyles).size,27,'Each room needs a distinct layout, not just a recolour')
const foodRoom=trace(true)
rooms.drawPixelRoom(foodRoom.context,'food','legendary',2,1800,false)
assert.deepEqual(foodRoom.calls,[],'Snacks and drinks must not be placed in costume rooms')
for (const kind of ['parcel','chef']) for (const rarity of ['common','rare','epic','legendary'])
for (const variant of kind === 'chef' ? timeline.chefOpeningPool(rarity) : ['original']) {
  for (const reduced of [false,true]) for (const open of [0,.02,.15,.3,.5,.7,.9,1]) {
    const {calls,context} = trace()
    const releaseAt=timeline.CHEF_OPENINGS[variant].releaseAt
    const release=timeline.clampOpening((open-releaseAt)/(1-releaseAt))
    art.drawTreatOpening(context,kind,{arrival:1,wind:1,open,release,burstMs:open*1600,releaseMs:Math.max(0,open-releaseAt)*1600,fade:0,done:false,phase:'opening'},390,844,rarity,reduced,atlasImage,variant)
    for (const call of calls) for (const arg of call.slice(1)) if (typeof arg === 'number') assert.ok(Number.isFinite(arg),'All variation geometry stays finite')
    const images = calls.filter(c => c[0] === 'drawImage')
    assert.ok(images.length > 0)
    for (const image of images) {
      assert.ok(image.slice(2).every(Number.isFinite), 'Non-finite source or destination geometry')
      if (image.length === 10) assert.ok(image[4] > 0 && image[5] > 0 && image[8] > 0 && image[9] > 0)
    }
    assert.ok(images.every(c => c[1] === atlasImage), 'No miniature reward or cat can appear inside either opening')
    if (kind === 'parcel') {
      const body = presentation.getTreatAtlas(kind,rarity).body
      const draw = images.find(c => c.slice(2,6).every((n,i) => n === body[i]))
      assert.ok(draw)
      assert.equal(draw[8],256)
      assert.equal(draw[9],256*body[3]/body[2], 'The body must stay rigid during opening')
    }
  }
}
for (const machine of machines) {
  const sequences = []
  for (const rarity of ['common','rare','epic','legendary']) {
    const phases = []
    for (const elapsed of [0,200,500,900,1500,2200,4000,6500]) {
      const {calls,context} = trace()
      effects.drawRarityEffects(context,machine,rarity,elapsed,false)
      for (const call of calls) for (const arg of call.slice(1)) if (typeof arg === 'number') assert.ok(Number.isFinite(arg))
      assert.ok(!calls.some(c => c[0] === 'drawImage'), 'Reward effects are animated geometry, not room pictures')
      phases.push(JSON.stringify(calls))
    }
    assert.ok(new Set(phases).size > 1, 'The effect must actually change over time')
    sequences.push(phases.join('|'))
    const early = trace(), late = trace()
    effects.drawRarityEffects(early.context,machine,rarity,200,true)
    effects.drawRarityEffects(late.context,machine,rarity,4000,true)
    assert.deepEqual(early.calls,late.calls,'Reduced motion has no traveling particles or pulses')
  }
  assert.equal(new Set(sequences).size,4,'Each rarity has a different choreography')
}
const reveal = fs.readFileSync(path.join(root,'src/components/gacha/PullAnimation.tsx'),'utf8')
assert.ok(!reveal.includes('pull-rays') && !reveal.includes('CanFx') && !reveal.includes('<Stage '))
const stage = fs.readFileSync(path.join(root,'src/components/gacha/GachaRewardStage.tsx'),'utf8')
assert.ok(!stage.includes('scene-') && !stage.includes('plinth') && !stage.includes('Dressing'))
assert.ok(stage.includes('const room = skin ? getSkinRewardRoom(machine, item.rarity, roomVariant) : null'),'Room artwork must only be used for skins, not drinks')
assert.ok(stage.includes('data-room-renderer="code"')&&!stage.includes('<img data-room-art'),'Room backgrounds must be rendered by code')
console.log('Gacha presentation checks passed: opening props retained; 27 distinct animated code-drawn rooms; machine/rarity isolation; no consecutive repeats; reduced-motion fallback; consumables unchanged.')
