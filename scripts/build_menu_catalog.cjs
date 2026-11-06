const fs=require('node:fs')
const load=require('./lib/load_ts.cjs')()
function catalog(){const {MENU_POOL,MENU_SIZE,MENU_REWARD}=load('src/lib/foodMenu.ts');return {pool:MENU_POOL,size:MENU_SIZE,coins:MENU_REWARD}}
module.exports=catalog
if(require.main===module){
  const file='supabase/migration_menu_bonus.sql',before=fs.readFileSync(file,'utf8')
  const marker=/\$menu_catalog\$[\s\S]*?\$menu_catalog\$/
  if(!marker.test(before))throw Error('Missing menu catalogue marker')
  const after=before.replace(marker,'$menu_catalog$'+JSON.stringify(catalog())+'$menu_catalog$')
  if(process.argv.includes('--write'))fs.writeFileSync(file,after)
  else if(before!==after)throw Error('Menu catalogue is stale: run with --write')
  console.log('Menu catalogue: original food pool, 3 foods, 30 coins')
}
