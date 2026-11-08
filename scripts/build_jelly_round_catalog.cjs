const fs=require('node:fs'),path=require('node:path'),load=require('./lib/load_ts.cjs')()
function catalog(){const{JELLIES,JELLY_THRESHOLDS,JELLY_NEW_BIAS}=load('src/lib/jellies.ts'),{ACTION_CONFIGS}=load('src/types/index.ts')
  return{thresholds:JELLY_THRESHOLDS,new_bias:JELLY_NEW_BIAS,play:ACTION_CONFIGS.play.deltas,flavours:JELLIES.map(j=>({id:j.id,effects:j.effects.map(e=>e.buff)}))}}
module.exports=catalog
if(require.main===module){const file=path.resolve(__dirname,'../supabase/migration_jelly_rounds.sql'),old=fs.readFileSync(file,'utf8')
  if(!old.includes('$jelly_round_catalog$'))throw Error('Missing Jelly catalogue block')
  const next=old.replace(/\$jelly_round_catalog\$[\s\S]*?\$jelly_round_catalog\$/,()=>'$jelly_round_catalog$'+JSON.stringify(catalog(),null,2)+'$jelly_round_catalog$')
  if(process.argv.includes('--write'))fs.writeFileSync(file,next)
  else if(next!==old)throw Error('Jelly catalogue drift: run node scripts/build_jelly_round_catalog.cjs --write')
  console.log('Jelly round catalogue: 2 games, 5 flavours, 15 effects and unchanged play deltas.')}
