// Disposable PostgreSQL only. No hosted accounts or network connections.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite'),load=require('./lib/load_ts.cjs')(),catalog=require('./build_game_catalog.cjs')()
const {coinsForGame}=load('src/lib/gameRewards.ts'),db=new PGlite(),read=f=>fs.readFileSync(f,'utf8')
const migration=read('supabase/migration_game_results.sql')
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003'
const home='00000000-0000-4000-8000-000000000010',elsewhere='00000000-0000-4000-8000-000000000020'
let checks=0
async function one(sql,args=[]){return(await db.query(sql,args)).rows[0]}
async function auth(id=alice){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
async function save({id=randomUUID(),actor=alice,hh=home,game='memory_match',score=100,won=false,keep=true}={}){
  return(await one('select public.save_game_result_atomic($1,$2,$3,$4,$5,$6,$7) as r',[id,actor,hh,game,score,won,keep])).r
}
async function snapshot(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)
  out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) as row from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function refuses(args,reason){const before=await snapshot(),r=await save(args);assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snapshot(),before);checks++}
async function reset(){await auth();await db.exec(`delete from eren_private.economy_receipts;delete from public.game_scores;update public.profiles set coins=1000;
  update public.eren_stats set energy=80,last_decay_at=null;`)}
async function main(){
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;create publication supabase_realtime;set timezone='UTC';`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql',
    'migration_user_food_and_gifts.sql','migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql',
    'migration_interactions_useful.sql','migration_battle_results.sql','migration_trophy_battle.sql','migration_economy_reliability.sql',
    'migration_purr_beat.sql','migration_game_best_scores.sql'])await db.exec(read('supabase/'+file))
  await db.exec(migration);assert.deepEqual(JSON.parse(migration.match(/\$game_catalog\$([\s\S]*?)\$game_catalog\$/)[1]),catalog)
  await db.query('insert into public.households(id) values($1),($2)',[home,elsewhere])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[alice,bob,other,'game-a@test.invalid','game-b@test.invalid','game-c@test.invalid'])
  await db.query('update public.profiles set household_id=case when id=$1 then $3::uuid else $2::uuid end',[other,home,elsewhere])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,elsewhere]);await reset()
  // Full curve parity, not just one happy path per game.
  for(const[game,curve]of Object.entries(catalog.curves)){
    const scores=new Set([0,1,2147483647,...Array.from({length:51},(_,i)=>Math.round(curve.greatScore*i/40))])
    for(const score of scores)for(const won of game==='tic_tac_toe'?[false,true]:[false]){
      const count=(await one('select count(*)::int as n from public.game_scores')).n,prior=(await one('select coins from public.profiles where id=$1',[alice])).coins
      const keep=game!=='tic_tac_toe'||won,r=await save({game,score,won,keep})
      assert.equal(r.ok,true);assert.equal(r.awarded,coinsForGame(game,score,won));assert.equal(r.coins,prior+r.awarded);assert.equal(r.energy,80)
      assert.equal(r.blocked,false);assert.equal(Boolean(r.score_id),keep&&score>0)
      assert.equal((await one('select count(*)::int as n from public.game_scores')).n,count+(keep&&score>0?1:0));checks++
    }
  }
  await reset();const id=randomUUID(),r=await save({id}),before=await snapshot()
  assert.deepEqual(await save({id}),r);assert.deepEqual(await snapshot(),before);checks++
  await refuses({id,score:101},'request_mismatch');await refuses({id,hh:elsewhere},'request_mismatch')
  await refuses({id,keep:false},'request_mismatch');await refuses({id,won:true},'request_mismatch')
  await db.query('update public.profiles set coins=0 where id=$1',[alice]);await db.exec('update public.eren_stats set energy=0')
  const replay=await save({id});assert.equal(replay.coins,0);assert.equal(replay.awarded,r.awarded);assert.equal(replay.energy,80);checks++
  // First confirmation fixes the energy decision; resting later cannot pay a blocked run.
  await reset();await db.exec('update public.eren_stats set energy=29');const tiredId=randomUUID(),tired=await save({id:tiredId})
  assert.equal(tired.blocked,true);assert.equal(tired.awarded,0);assert.ok(tired.score_id);assert.equal(tired.coins,1000)
  await db.exec('update public.eren_stats set energy=100');assert.equal((await save({id:tiredId})).awarded,0);checks++
  await db.exec('update public.eren_stats set energy=30');assert.ok((await save()).awarded>0);checks++
  await db.exec("update public.eren_stats set energy=100,last_decay_at=clock_timestamp()-interval '24 hours'")
  assert.equal((await save()).energy,4);checks++
  await db.exec("update public.eren_stats set energy=80,last_decay_at=clock_timestamp()+interval '1 hour'")
  assert.equal((await save()).energy,80);checks++
  await reset();const statsBefore=(await one('select to_jsonb(s) as s from public.eren_stats s where household_id=$1',[home])).s
  await save();assert.deepEqual((await one('select to_jsonb(s) as s from public.eren_stats s where household_id=$1',[home])).s,statsBefore);checks++
  // Same score in a genuinely new round is a second valid run, not a dedup key.
  await reset();await save();await save();assert.equal((await one('select count(*)::int as n from public.game_scores')).n,2);checks++
  await auth(bob);assert.equal((await save({actor:bob,id})).ok,true);await auth();checks++
  await auth('');await refuses({},'unauthenticated');await auth()
  await refuses({actor:bob},'session_changed');await refuses({hh:elsewhere},'household_changed');await refuses({id:null},'bad_request')
  for(const score of [-1,1.5,2147483648,null,'NaN','Infinity','-Infinity'])await refuses({score},'bad_result')
  for(const game of ['missing','catch_mouse','paw_tap','gone_fishin','defend_bowl',null])await refuses({game},'bad_result')
  await db.query('delete from public.eren_stats where household_id=$1',[home]);await refuses({},'no_stats');await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  // Atomicity: failure in any part leaves every public/private row unchanged.
  for(const table of ['public.profiles','public.game_scores','eren_private.economy_receipts']){
    await reset();const before=await snapshot()
    await db.exec(`create function public.fail_game_test() returns trigger language plpgsql as $$begin raise exception 'injected game failure';end$$;
      create trigger fail_game_test before insert or update on ${table} for each row execute function public.fail_game_test();`)
    await assert.rejects(()=>save(),/injected game failure/)
    await db.exec(`drop trigger fail_game_test on ${table};drop function public.fail_game_test();`)
    assert.deepEqual(await snapshot(),before,table+' rollback');checks++
  }
  await reset();await save();await db.query("insert into public.game_scores(user_id,game_type,score) values($1,'catch_mouse',27)",[alice])
  const installed=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),installed);checks++
  assert.equal((await one("select has_function_privilege('anon','public.save_game_result_atomic(uuid,uuid,uuid,text,numeric,boolean,boolean)','execute') as yes")).yes,false)
  assert.equal((await one("select has_schema_privilege('authenticated','eren_private','usage') as yes")).yes,false)
  await db.exec('set role authenticated');assert.equal((await save()).ok,true);await db.exec('reset role');checks++
  const best=(await one("select score from public.game_best_scores where user_id=$1 and game_type='memory_match'",[alice])).score
  assert.equal(best,100);checks++
  console.log(`Game SQL: ${checks} scenarios passed; 11 curves, tired scores, replay, rollback and roles`)
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close())
