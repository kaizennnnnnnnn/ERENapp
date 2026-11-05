const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const load = require('./lib/load_ts.cjs')()

// Use the actual room catalogue, including spreads, rather than copying prices or perks.
function foodActionCatalog() {
  const file = path.resolve(__dirname, '../src/components/care/FeedScene.tsx')
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = new Set(['MONSTA_PRICE', 'SHOP_ITEMS', 'ALL_DONUT_IDS', 'BAKERY_CAKE_IDS', 'KITCHEN_SHELF', 'SHELF_ITEMS'])
  const declarations = source.statements.filter(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && names.has(decl.name.text)))
  if (declarations.length !== names.size) throw new Error('Kitchen catalogue declarations changed; update the generator')
  const { DONUTS, KITCHEN_DONUTS, MACHINE_DONUTS, TASTE_JOY } = load('src/lib/donuts.ts')
  const { CAKES } = load('src/lib/cakes.ts')
  const { FOOD_META, RETIRED_SHOP_FOODS } = load('src/lib/foodMeta.ts')
  const { monstaBuff } = load('src/lib/monstaBuffs.ts')
  const { DONUT_EFFECTS } = load('src/lib/donutEffects.ts')
  const { DRINK_UNLOCK_SKINS } = load('src/lib/skins.ts')
  const code = ts.transpileModule(declarations.map(node => node.getText(source)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText
  const { SHOP_ITEMS, SHELF_ITEMS } = new Function('DONUTS', 'KITCHEN_DONUTS', 'FOOD_META', 'RETIRED_SHOP_FOODS', 'CAKES',
    code + '\nreturn { SHOP_ITEMS, SHELF_ITEMS }')(DONUTS, KITCHEN_DONUTS, FOOD_META, RETIRED_SHOP_FOODS, CAKES)
  return SHOP_ITEMS.map(item => {
    const donut = DONUTS.find(d => d.id === item.id)
    const buff = monstaBuff(item.id) ?? donut?.perk
    const effect = donut?.effect ? DONUT_EFFECTS[donut.effect] : null
    return {
      food_key: item.id, price: item.price,
      kitchen: SHELF_ITEMS.some(food => food.id === item.id),
      bakery: CAKES.some(cake => cake.foodId === item.id) || !!donut && donut.source !== 'gacha',
      machine: MACHINE_DONUTS.some(food => food.id === item.id),
      hunger: item.hungerD + (buff?.hunger ?? 0),
      happiness: (donut ? Math.round(item.happyD * TASTE_JOY[donut.taste]) : item.happyD) + (buff?.happiness ?? 0),
      weight: Number((item.weightD + (buff?.weight ?? 0)).toFixed(4)),
      energy: buff?.energy ?? null, sleep_quality: buff?.sleep_quality ?? 0,
      cleanliness: buff?.cleanliness ?? 0, cure: buff?.cure ?? false, coins: buff?.coins ?? 0,
      donut: !!donut, effect: effect?.id ?? null, effect_ms: effect?.ms ?? null,
      skin: DRINK_UNLOCK_SKINS[item.id] ?? null,
    }
  })
}

module.exports = foodActionCatalog
if (require.main === module) {
  const rows = foodActionCatalog()
  const file = path.resolve(__dirname, '../supabase/migration_food_actions.sql')
  const old = fs.readFileSync(file, 'utf8')
  if (!/\$food_action_catalog\$[\s\S]*?\$food_action_catalog\$/.test(old)) throw new Error('Missing SQL catalogue block')
  const next = old.replace(/\$food_action_catalog\$[\s\S]*?\$food_action_catalog\$/, '$food_action_catalog$' + JSON.stringify(rows, null, 2) + '$food_action_catalog$')
  if (process.argv.includes('--write')) fs.writeFileSync(file, next)
  else if (next !== old) throw new Error('Food action catalogue is stale. Run node scripts/build_food_action_catalog.cjs --write')
  console.log(`Food action catalogue: ${rows.length} foods, ${rows.filter(r => r.kitchen).length} kitchen foods, ${rows.filter(r => r.machine).length} machine donuts`)
}
