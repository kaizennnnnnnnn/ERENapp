// Refresh the SQL's trusted catalogue after changing gacha pools or food keys.
const fs = require('node:fs')
const path = require('node:path')
const load = require('./lib/load_ts.cjs')()
const { GACHA_ITEMS, GACHA_BANNERS, GACHA_FOOD_GRANT } = load('src/lib/gacha.ts')
const { FOOD_ORDER } = load('src/lib/foodMeta.ts')
if (GACHA_BANNERS.some(banner => banner.featuredItems.length)) throw new Error('Add server featured-item support before enabling a featured pool')
const rows = GACHA_BANNERS.flatMap(banner => GACHA_ITEMS
  .filter(item => !item.unlock && banner.categories.includes(item.category) && (!banner.skinSet || item.skinSet === banner.skinSet))
  .map(item => ({ banner_id: banner.id, item_id: item.id, rarity: item.rarity, food_key: GACHA_FOOD_GRANT[item.id] ?? null })))
const file = path.resolve(__dirname, '../supabase/migration_economy_reliability.sql')
const old = fs.readFileSync(file, 'utf8')
const next = old
  .replace(/\$gacha_catalog\$[\s\S]*?\$gacha_catalog\$/, '$gacha_catalog$' + JSON.stringify(rows, null, 2) + '$gacha_catalog$')
  .replace(/\$food_keys\$[\s\S]*?\$food_keys\$/, '$food_keys$' + JSON.stringify(FOOD_ORDER) + '$food_keys$')
if (process.argv.includes('--write')) fs.writeFileSync(file, next)
else if (next !== old) throw new Error('SQL catalogue is stale. Run node scripts/build_economy_catalog.cjs --write')
console.log(`Economy catalogue: ${rows.length} drops, ${FOOD_ORDER.length} food keys`)
