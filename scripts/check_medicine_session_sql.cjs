// Real migration in disposable PostgreSQL; never writes to the hosted project.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')(),{ACTION_CONFIGS}=load('src/types/index.ts'),{computeErenMood}=load('src/lib/utils.ts')
const db=new PGlite(),read=f=>fs.readFileSync(f,'utf8'),sql=read('supabase/migration_medicine_session_saves.sql')
const a=randomUUID(),b=randomUUID(),c=randomUUID(),home=randomUUID(),away=randomUUID();let checks=0
const one=async(q,args=[])=>(await db.query(q,args)).rows[0],auth=async(uid=a)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
const dose=async({id=randomUUID(),actor=a,hh=home}={})=>(await one('select public.complete_medicine_session_atomic($1,$2,$3) r',[id,actor,hh])).r
async function snap(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) r from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function reset(){await db.exec('reset role');await auth();await db.exec('delete from eren_private.economy_receipts;delete from public.interactions;')
  await db.query('update public.profiles set household_id=case when id=$1 then $2::uuid else $3::uuid end,coins=1000',[c,away,home])
  await db.exec("update public.eren_stats set hunger=50,happiness=50,energy=50,sleep_quality=50,cleanliness=50,weight=4.5,is_sick=true,is_sleeping=false,mood='idle',last_decay_at=null")}
async function refused(opts,reason){const before=await snap(),r=await dose(opts);assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snap(),before);checks++}
function expected(before,r){const hours=before.last_decay_at?Math.min(12,Math.max(0,(new Date(r.saved_at).getTime()-new Date(before.last_decay_at).getTime())/3600000)):0,delta=ACTION_CONFIGS.medicine.deltas
  const out={};for(const[key,rate]of Object.entries({hunger:10,happiness:7,energy:8,sleep_quality:7,cleanliness:4})){
    const n=Math.min(100,Math.max(0,Math.max(0,Number(before[key])-rate*hours)+(delta[key]??0)));out[key]=key==='cleanliness'?n:Math.round(n)}
  out.weight=Math.round(Math.min(10,Math.max(2,Number(before.weight)+(delta.weight??0)))*100)/100
  out.is_sick=false;out.mood=computeErenMood(out);return out}
async function main(){
  assert.deepEqual(JSON.parse(sql.match(/\$medicine_session_config\$([\s\S]*?)\$medicine_session_config\$/)[1]),ACTION_CONFIGS.medicine.deltas)
  assert.ok(sql.indexOf('from public.profiles')<sql.indexOf('from public.eren_stats'),'Consistent profile -> stats lock order')
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create publication supabase_realtime;`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql','migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql','migration_interactions_useful.sql','migration_battle_results.sql','migration_trophy_battle.sql','migration_economy_reliability.sql','migration_play_session_saves.sql','migration_sleep_session_saves.sql'])await db.exec(read('supabase/'+file))
  await db.exec(sql);await db.query('insert into public.households(id) values($1),($2)',[home,away])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[a,b,c,'medicine-a@test.invalid','medicine-b@test.invalid','medicine-c@test.invalid'])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,away]);await reset()
  for(const value of [0,1,4,5,24,29,49,71,89,90,99,100])for(const hours of [null,-1,0,0.125,1.1,11.9,12,24]){
    await reset();await db.query(`update public.eren_stats set hunger=$2::int,happiness=$2::int,energy=$2::int,sleep_quality=$2::int,cleanliness=$2::int,weight=$3,is_sleeping=$5,last_decay_at=case when $4::numeric is null then null else clock_timestamp()-$4::numeric*interval '1 hour' end where household_id=$1`,[home,value,value===99?8.5:value===1?2:4.5,hours,value%2===0])
    const before=await one('select * from public.eren_stats where household_id=$1',[home]),id=randomUUID(),r=await dose({id}),after=await one('select * from public.eren_stats where household_id=$1',[home]),want=expected(before,r)
    assert.equal(r.ok,true);assert.equal(r.changed,true);assert.equal(r.version,1);assert.equal(r.request_id,id);assert.equal(r.user_id,a);assert.equal(r.household_id,home);assert.equal(r.useful,true)
    for(const[k,v]of Object.entries(want))typeof v==='number'?assert.ok(Math.abs(Number(after[k])-v)<0.00001,`${k}, ${value}, ${hours}: ${after[k]} vs ${v}`):assert.equal(after[k],v)
    assert.equal(new Date(after.last_decay_at).getTime(),Date.parse(r.saved_at));assert.equal(new Date(after.updated_at).getTime(),Date.parse(r.saved_at))
    const history=await one('select * from public.interactions where id=$1',[r.interaction_id]);assert.equal(history.action_type,'medicine');assert.equal(history.user_id,a);assert.equal(history.useful,true)
    assert.equal(history.happiness_delta,10);assert.equal(history.hunger_delta,0);assert.equal(history.energy_delta,15);assert.equal(Number(history.weight_delta),0);assert.equal(history.sleep_delta,0)
    for(const field of Object.keys(before))if(!['hunger','happiness','energy','sleep_quality','cleanliness','weight','is_sick','mood','last_decay_at','updated_at'].includes(field))assert.deepEqual(after[field],before[field],field+' untouched')
    const saved=await snap();assert.deepEqual(await dose({id}),r);assert.deepEqual(await snap(),saved);checks++
  }
  // All original vet care reasons, their boundaries and no-op history/decay preservation.
  for(const [field,value,changed]of [['cleanliness',29.99,true],['cleanliness',30,false],['sleep_quality',29,true],['sleep_quality',30,false],['energy',19,true],['energy',20,false],['weight',7.01,true],['weight',7,false],['is_sick',true,true]]){
    await reset();await db.exec('update public.eren_stats set hunger=100,happiness=100,energy=100,sleep_quality=100,cleanliness=100,is_sick=false')
    await db.query(`update public.eren_stats set ${field}=$2 where household_id=$1`,[home,value]);const before=await one('select * from public.eren_stats where household_id=$1',[home]),r=await dose()
    assert.equal(r.changed,changed);assert.equal(r.useful,field==='is_sick');assert.equal((await one('select count(*)::int n from public.interactions')).n,changed?1:0)
    if(!changed){assert.equal(r.interaction_id,null);assert.deepEqual(await one('select * from public.eren_stats where household_id=$1',[home]),before)}checks++
  }
  await reset();await db.exec('update public.eren_stats set is_sick=false,cleanliness=31,last_decay_at=clock_timestamp()-interval \'1 hour\'');assert.equal((await dose()).changed,true);checks++
  await reset();const id=randomUUID(),first=await dose({id});await auth(b);const second=await dose({actor:b});assert.equal(second.changed,false);assert.equal((await one('select count(*)::int n from public.interactions')).n,1);checks++
  // Replaying a lost response must not cure a new illness or overwrite a newer meal/cosmetic.
  await db.query("update public.eren_stats set hunger=95,cleanliness=99.25,is_sick=true,is_sleeping=true,weight=4.8,mood='sleepy',food_by_user=$2,updated_at=clock_timestamp() where household_id=$1",[home,JSON.stringify({[b]:{milk:7}})])
  await auth();const beforeReplay=await snap(),r=await dose({id});assert.equal(r.interaction_id,first.interaction_id);assert.equal(r.saved_at,first.saved_at);assert.equal(r.stats.hunger,95);assert.equal(r.stats.is_sick,true);assert.equal(r.stats.is_sleeping,true);assert.equal(r.stats.cleanliness,99.25);assert.deepEqual(await snap(),beforeReplay);checks++
  await reset();await db.exec('update public.eren_stats set is_sick=false');const noopId=randomUUID(),noop=await dose({id:noopId});assert.equal(noop.changed,false)
  await db.exec('update public.eren_stats set is_sick=true');const beforeNoop=await snap();assert.equal((await dose({id:noopId})).changed,false);assert.deepEqual(await snap(),beforeNoop);checks++
  for(const table of ['public.eren_stats','public.interactions','eren_private.economy_receipts']){
    await reset();await db.exec(`create function public.fail_medicine_test() returns trigger language plpgsql as $$begin raise exception 'medicine injected';end$$;create trigger fail_medicine_test before insert or update on ${table} for each row execute function public.fail_medicine_test();`)
    const before=await snap();await assert.rejects(()=>dose(),/medicine injected/);assert.deepEqual(await snap(),before);checks++
    await db.exec(`drop trigger fail_medicine_test on ${table};drop function public.fail_medicine_test();`)
  }
  await reset();const mixedId=randomUUID(),treated=await dose({id:mixedId});await auth(b)
  const slept=(await one('select public.complete_sleep_session_atomic($1,$2,$3,$4) r',[randomUUID(),b,home,'tuck'])).r;assert.equal(slept.ok,true)
  const mixedBefore=await snap();await auth();const replay=await dose({id:mixedId});assert.equal(replay.interaction_id,treated.interaction_id);assert.deepEqual(replay.stats,slept.stats);assert.deepEqual(await snap(),mixedBefore);checks++
  await reset();await refused({actor:b},'session_changed');await refused({hh:away},'household_changed');await refused({id:null},'bad_request');await refused({hh:null},'bad_request');await auth('');await refused({},'unauthenticated');await auth()
  await db.query('delete from public.eren_stats where household_id=$1',[home]);await refused({},'no_stats');await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  await reset();await dose({id});await db.query('update public.profiles set household_id=$1 where id=$2',[away,a]);await refused({id},'household_changed')
  await reset();await db.query("insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values($1,$2,'sleep_session','{}','{}')",[a,id]);await refused({id},'request_mismatch')
  await db.query("update eren_private.economy_receipts set operation='medicine_session',input=$2 where request_id=$1",[id,JSON.stringify({household_id:away})]);await refused({id},'request_mismatch')
  await auth(randomUUID());await refused({actor:(await one('select auth.uid() id')).id},'no_profile');await auth()
  await reset();await dose();const before=await snap();await db.exec(sql);assert.deepEqual(await snap(),before);checks++
  const definition=await one("select prosecdef,proconfig from pg_proc where oid='public.complete_medicine_session_atomic(uuid,uuid,uuid)'::regprocedure");assert.equal(definition.prosecdef,true);assert.deepEqual(definition.proconfig,['search_path=""'])
  assert.equal((await one("select has_function_privilege('anon','public.complete_medicine_session_atomic(uuid,uuid,uuid)','execute') allowed")).allowed,false)
  assert.equal((await one("select has_function_privilege('authenticated','public.complete_medicine_session_atomic(uuid,uuid,uuid)','execute') allowed")).allowed,true)
  await db.exec('set role authenticated');await auth();assert.equal((await dose()).ok,true);await assert.rejects(()=>db.query('select * from eren_private.economy_receipts'),/permission denied/);checks++
  await db.close();console.log(`Medicine SQL: ${checks} scenarios passed (care math, eligibility, replay, partner interleavings, rollback, scope, rerun and grants; single-connection PostgreSQL).`)
}
main().catch(async e=>{console.error(e);await db.close();process.exitCode=1})
