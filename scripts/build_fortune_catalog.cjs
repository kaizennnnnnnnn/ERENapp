const fs = require('node:fs')
const path = require('node:path')
const load = require('./lib/load_ts.cjs')()
function fortuneCatalog() {
  const { FORTUNE_GIFTS, FORTUNE_WEIGHTS } = load('src/lib/fortune.ts')
  return { weights: FORTUNE_WEIGHTS, gifts: FORTUNE_GIFTS.map(gift => ({
    id: gift.id, rarity: gift.rarity, coins: gift.coinValue ?? 0,
    dust: gift.stardustValue ?? 0, tickets: gift.gachaTickets ?? 0,
  })) }
}
module.exports = fortuneCatalog
if (require.main === module) {
  const file = path.resolve(__dirname, '../supabase/migration_fortune_claims.sql')
  const before = fs.readFileSync(file, 'utf8'), catalog = fortuneCatalog()
  const marker = /\$fortune_catalog\$[\s\S]*?\$fortune_catalog\$/
  if (!marker.test(before)) throw Error('Missing fortune catalogue marker')
  const after = before.replace(marker, '$fortune_catalog$' + JSON.stringify(catalog) + '$fortune_catalog$')
  if (process.argv.includes('--write')) fs.writeFileSync(file, after)
  else if (after !== before) throw Error('Fortune catalogue is stale: run with --write')
  console.log(`Fortune catalogue: ${catalog.gifts.length} gifts, original rarity weights`)
}
