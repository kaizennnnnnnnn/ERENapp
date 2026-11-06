const fs=require('node:fs'),ts=require('typescript')
const load=require('./lib/load_ts.cjs')()
function catalog(){
  const source=ts.createSourceFile('gameRewards.ts',fs.readFileSync('src/lib/gameRewards.ts','utf8'),ts.ScriptTarget.Latest,true)
  let curve
  for(const statement of source.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)
    if(d.name.getText(source)==='COIN_CURVE')curve=d.initializer.getText(source)
  if(!curve)throw Error('Missing game coin curves')
  const rewards=load('src/lib/gameRewards.ts'),{PLAYABLE_MINIGAME_IDS}=load('src/lib/minigames.ts')
  const curves=new Function('TTT_WIN_COINS','return ('+curve+')')(rewards.coinsForGame('tic_tac_toe',1,true))
  return {floor:rewards.PARTICIPATION_COINS,energy:rewards.EXHAUSTED_ENERGY,curves:Object.fromEntries(PLAYABLE_MINIGAME_IDS.map(id=>[id,curves[id]]))}
}
module.exports=catalog
if(require.main===module){
  const file='supabase/migration_game_results.sql',before=fs.readFileSync(file,'utf8'),marker=/\$game_catalog\$[\s\S]*?\$game_catalog\$/
  if(!marker.test(before))throw Error('Missing game catalogue marker')
  const after=before.replace(marker,'$game_catalog$'+JSON.stringify(catalog())+'$game_catalog$')
  if(process.argv.includes('--write'))fs.writeFileSync(file,after)
  else if(before!==after)throw Error('Game catalogue is stale: run with --write')
  console.log('Game catalogue: 11 playable games; existing curves and energy threshold')
}
