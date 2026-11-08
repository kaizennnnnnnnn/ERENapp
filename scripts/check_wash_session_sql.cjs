// Production SQL, disposable PostgreSQL. No hosted washer writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')(),{ACTION_CONFIGS}=load('src/types/index.ts'),{computeErenMood,shouldBecomeSick}=load('src/lib/utils.ts')
const db=new PGlite(),read=f=>fs.readFileSync(f,'utf8'),sql=read('supabase/migration_wash_session_saves.sql')
const a=randomUUID(),b=randomUUID(),c=randomUUID(),home=randomUUID(),away=randomUUID();let checks=0
const one=async(q,args=[])=>(await db.query(q,args)).rows[0],auth=async(uid=a)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
const wash=async({id=randomUUID(),actor=a,hh=home}={})=>(await one('select public.complete_wash_session_atomic($1,$2,$3) r',[id,actor,hh])).r
async function snap(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) r from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function reset(){await db.exec('reset role');await auth();await db.exec('delete from eren_private.economy_receipts;delete from public.interactions;')
  await db.query('update public.profiles set household_id=case when id=$1 then $2::uuid else $3::uuid end,coins=1000',[c,away,home])
  await db.exec("update public.eren_stats set hunger=50,happiness=50,energy=50,sleep_quality=50,cleanliness=50,weight=4.5,is_sick=true,is_sleeping=false,mood='idle',last_decay_at=null")}
async function refused(opts,reason){const before=await snap(),r=await wash(opts);assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snap(),before);checks++}
function expected(before,r){const hours=before.last_decay_at?Math.min(12,Math.max(0,(new Date(r.saved_at).getTime()-new Date(before.last_decay_at).getTime())/3600000)):0,delta=ACTION_CONFIGS.wash.deltas
  const out={};for(const[key,rate]of Object.entries({hunger:10,happiness:7,energy:8,sleep_quality:7,cleanliness:4})){
    const n=Math.min(100,Math.max(0,Math.max(0,Number(before[key])-rate*hours)+(delta[key]??0)));out[key]=key==='cleanliness'?n:Math.round(n)}
  out.weight=Math.round(Math.min(10,Math.max(2,Number(before.weight)+(delta.weight??0)))*100)/100
  out.is_sick=shouldBecomeSick(out);out.mood=computeErenMood(out);out.useful=Math.max(0,Number(before.cleanliness)-4*hours)<90;return out}
async function main(){
  assert.deepEqual(JSON.parse(sql.match(/\$wash_session_config\$([\s\S]*?)\$wash_session_config\$/)[1]),ACTION_CONFIGS.wash.deltas,'SQL must match the existing wash configuration')
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create publication supabase_realtime;`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql','migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql','migration_interactions_useful.sql','migration_battle_results.sql','migration_trophy_battle.sql','migration_economy_reliability.sql'])await db.exec(read('supabase/'+file))
  await db.exec(read('supabase/migration_play_session_saves.sql'));await db.exec(sql);await db.query('insert into public.households(id) values($1),($2)',[home,away])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[a,b,c,'wash-a@test.invalid','wash-b@test.invalid','wash-c@test.invalid'])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,away]);await reset()
  for(const value of [0,1,4,5,24,29,49,71,89,90,99,100])for(const hours of [null,-1,0,0.125,1.1,11.9,12,24]){
    await reset();await db.query(`update public.eren_stats set hunger=$2::int,happiness=$2::int,energy=$2::int,sleep_quality=$2::int,cleanliness=$2::int,weight=$3,last_decay_at=case when $4::numeric is null then null else clock_timestamp()-$4::numeric*interval '1 hour' end where household_id=$1`,[home,value,value===99?8.5:value===1?2:4.5,hours])
    const before=await one('select * from public.eren_stats where household_id=$1',[home]),id=randomUUID(),r=await wash({id}),after=await one('select * from public.eren_stats where household_id=$1',[home]),want=expected(before,r)
    assert.equal(r.ok,true);assert.equal(r.version,1);assert.equal(r.request_id,id);assert.equal(r.user_id,a);assert.equal(r.household_id,home);assert.equal(r.action,'wash');assert.equal(r.useful,want.useful)
    for(const[k,v]of Object.entries(want))if(k!=='useful')typeof v==='number'?assert.ok(Math.abs(Number(after[k])-v)<0.00001,`${k}, ${value}, ${hours}: ${after[k]} vs ${v}`):assert.equal(after[k],v)
    assert.equal(new Date(after.last_decay_at).getTime(),Date.parse(r.saved_at));assert.equal(new Date(after.updated_at).getTime(),Date.parse(r.saved_at))
    const history=await one('select * from public.interactions where id=$1',[r.interaction_id]);assert.equal(history.action_type,'wash');assert.equal(history.user_id,a);assert.equal(history.useful,want.useful)
    assert.equal(history.happiness_delta,5);assert.equal(history.hunger_delta,0);assert.equal(history.energy_delta,0);assert.equal(Number(history.weight_delta),0);assert.equal(history.sleep_delta,0)
    for(const field of Object.keys(before))if(!['hunger','happiness','energy','sleep_quality','cleanliness','weight','is_sick','mood','last_decay_at','updated_at'].includes(field))assert.deepEqual(after[field],before[field],field+' untouched')
    const saved=await snap();assert.deepEqual(await wash({id}),r);assert.deepEqual(await snap(),saved);checks++
  }
  await reset();const id=randomUUID(),first=await wash({id});await auth(b);const second=await wash({actor:b});assert.notEqual(first.interaction_id,second.interaction_id);assert.equal((await one('select count(*)::int n from public.interactions')).n,2);checks++
  // The partner's newer feed/play/sleep/cosmetic state must survive a lost-response replay.
  await db.query("update public.eren_stats set hunger=95,cleanliness=99.25,is_sleeping=true,weight=4.8,mood='sleepy',food_by_user=$2,updated_at=clock_timestamp() where household_id=$1",[home,JSON.stringify({[b]:{milk:7}})])
  await auth();const saved=await snap(),r=await wash({id});assert.equal(r.interaction_id,first.interaction_id);assert.equal(r.saved_at,first.saved_at);assert.equal(r.stats.hunger,95);assert.equal(r.stats.is_sleeping,true);assert.equal(r.stats.cleanliness,99.25);assert.deepEqual(await snap(),saved);checks++
  await refused({},'sleeping');await db.query('update public.eren_stats set is_sleeping=false where household_id=$1',[home]);await wash();assert.equal((await one('select hunger from public.eren_stats where household_id=$1',[home])).hunger,95);checks++
  for(const table of ['public.eren_stats','public.interactions','eren_private.economy_receipts']){
    await reset();await db.exec(`create function public.fail_wash_test() returns trigger language plpgsql as $$begin raise exception 'wash injected';end$$;create trigger fail_wash_test before insert or update on ${table} for each row execute function public.fail_wash_test();`)
    const before=await snap();await assert.rejects(()=>wash(),/wash injected/);assert.deepEqual(await snap(),before);checks++
    await db.exec(`drop trigger fail_wash_test on ${table};drop function public.fail_wash_test();`)
  }
  for(const [clean,joy,useful]of [[20,100,true],[99,0,false]]){await reset();await db.query('update public.eren_stats set cleanliness=$2,happiness=$3 where household_id=$1',[home,clean,joy]);assert.equal((await wash()).useful,useful);checks++}
  await reset();const mixedId=randomUUID(),washed=await wash({id:mixedId});await auth(b)
  const played=(await one('select public.complete_play_session_atomic($1,$2,$3) r',[randomUUID(),b,home])).r;assert.equal(played.ok,true)
  const mixedBefore=await snap();await auth();const replay=await wash({id:mixedId});assert.equal(replay.interaction_id,washed.interaction_id);assert.deepEqual(replay.stats,played.stats);assert.deepEqual(await snap(),mixedBefore);checks++
  await reset();await refused({actor:b},'session_changed');await refused({hh:away},'household_changed');await refused({id:null},'bad_request');await refused({hh:null},'bad_request');await auth('');await refused({},'unauthenticated');await auth()
  await db.query('delete from public.eren_stats where household_id=$1',[home]);await refused({},'no_stats');await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  await reset();await wash({id});await db.query('update public.profiles set household_id=$1 where id=$2',[away,a]);await refused({id},'household_changed')
  await reset();await db.query("insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values($1,$2,'other','{}','{}')",[a,id]);await refused({id},'request_mismatch')
  await db.query("update eren_private.economy_receipts set operation='wash_session',input=$2 where request_id=$1",[id,JSON.stringify({household_id:away,action:'wash'})]);await refused({id},'request_mismatch')
  await reset();await wash();const before=await snap();await db.exec(sql);assert.deepEqual(await snap(),before);checks++
  assert.equal((await one("select has_function_privilege('anon','public.complete_wash_session_atomic(uuid,uuid,uuid)','execute') allowed")).allowed,false)
  assert.equal((await one("select has_function_privilege('authenticated','public.complete_wash_session_atomic(uuid,uuid,uuid)','execute') allowed")).allowed,true)
  await db.exec('set role authenticated');await auth();assert.equal((await wash()).ok,true);await assert.rejects(()=>db.query('select * from eren_private.economy_receipts'),/permission denied/);checks++
  await db.close();console.log(`Wash session SQL: ${checks} scenarios passed (decay, care math, partner updates, replay, rollback, scope, rerun and grants).`)
}
main().catch(async e=>{console.error(e);await db.close();process.exitCode=1})
