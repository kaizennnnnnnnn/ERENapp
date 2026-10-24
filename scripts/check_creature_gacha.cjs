// Run with: node scripts/check_creature_gacha.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const cache = new Map()

// Load the pure catalogue modules with the project's existing TypeScript compiler.
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const localRequire = id => {
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id)
    const target = id.startsWith('@/')
      ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
    return load(target + '.ts')
  }
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports)
  return module.exports
}

const gacha = load(path.join(root, 'src/lib/gacha.ts'))
const skins = load(path.join(root, 'src/lib/skins.ts'))
const manifest = require('./skins_manifest.json')
const ids = ['bee', 'lobster', 'crystaldragon', 'snail', 'butterfly', 'turtle', 'octopus', 'peacock']
const creatures = gacha.GACHA_ITEMS.filter(item => item.skinSet === 'creatures')
assert.deepEqual(gacha.GACHA_BANNERS.map(banner => banner.id), ['food', 'animal', 'foodsuits', 'creatures'])
assert.equal(new Set(gacha.GACHA_ITEMS.map(item => item.id)).size, gacha.GACHA_ITEMS.length)
assert.deepEqual(creatures.map(item => item.skinId), ids)
assert.deepEqual(gacha.bannerOdds('creatures'), [
  { rarity: 'legendary', chance: 3, items: 2 },
  { rarity: 'epic', chance: 12, items: 3 },
  { rarity: 'rare', chance: 85, items: 3 },
])

for (const [banner, count] of [['food', 13], ['animal', 21], ['foodsuits', 20], ['creatures', 8]]) {
  assert.equal(gacha.bannerOdds(banner).reduce((sum, tier) => sum + tier.items, 0), count)
  for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
    for (let i = 0; i < 100; i++) {
      const item = gacha.rollItem(rarity, banner)
      assert.ok(!item.unlock, 'Earned skins must never be pulled')
      if (banner === 'food') assert.equal(item.category, 'consumable')
      else assert.equal(item.skinSet, { animal: 'animal', foodsuits: 'food', creatures: 'creatures' }[banner])
    }
  }
}
assert.equal(gacha.rollRarity(29, 0), 'epic')
assert.equal(gacha.rollRarity(29, 99), 'legendary')
assert.equal(gacha.PULL_COST_SINGLE, 50)
assert.equal(gacha.PULL_COST_TEN, 450)
assert.equal(gacha.DUPLICATE_STARDUST.legendary, 200)

for (const id of ids) {
  const skin = skins.getSkin(id)
  const entry = manifest.find(row => row.id === id)
  assert.equal(skin.set, 'creatures')
  assert.equal(skin.unlock, undefined)
  assert.equal(entry.hasTail, true)
  assert.ok(skin.tailOrigin && skin.eyes)
  for (const value of Object.values(skin.eyes)) assert.ok(Number.isFinite(parseFloat(value)))
  for (const asset of [skin.src, skin.tailSrc, skin.thumb]) {
    assert.ok(asset)
    assert.ok(fs.statSync(path.join(root, 'public', asset.split('?')[0])).size > 0)
  }
  for (const room of skins.SKINNABLE_ROOMS) {
    const fit = skins.skinRoomFit(skin, room.id)
    assert.ok(fit && Number.isFinite(fit.size) && fit.size > 0 && Number.isFinite(fit.lift))
    assert.equal(skins.resolveRoomSkin({ [room.id]: id }, room.id).id, id)
  }
}
assert.ok(fs.statSync(path.join(root, 'public/gacha_creatures.webp')).size > 0)
console.log('Creature gacha checks passed: four isolated pools, eight wearable skins, odds, pity and assets.')
