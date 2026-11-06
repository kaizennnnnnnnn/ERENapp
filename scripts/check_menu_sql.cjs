// Disposable PostgreSQL only; never connects to the live project.
const assert=require('node:assert/strict'),fs=require('node:fs')
const {randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')(),catalog=require('./build_menu_catalog.cjs')()
const {dailyMenu}=load('src/lib/foodMenu.ts'),db=new PGlite()
const read=f=>fs.readFileSync(f,'utf8'),migration=read('supabase/migration_menu_bonus.sql')
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003'
const home='00000000-0000-4000-8000-000000000010',elsewhere='00000000-0000-4000-8000-000000000020'
let day,checks=0
async function one(sql,args=[]){return (await db.query(sql,args)).rows[0]}
async function auth(id=alice){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
async function claim(id=randomUUID(),d=day,hh=home,actor=alice,zone='UTC'){
  return (await one('select public.claim_menu_bonus_atomic($1,$2,$3,$4,$5) as r',[id,actor,hh,d,zone])).r
}
async function feed(key,actor=alice,hh=home){
  await auth(actor);const r=(await one('select public.feed_food_atomic($1,$2,$3) as r',[randomUUID(),hh,key])).r
  assert.equal(r.ok,true,key);return r
}
async function reset(){
  await auth()
  await db.exec(`delete from eren_private.economy_receipts;delete from eren_private.menu_claims;delete from public.interactions;
    delete from public.user_inventory;update public.profiles set coins=1000;
    update public.eren_stats set menu_state=null,hunger=50,happiness=50,energy=50,sleep_quality=50,cleanliness=50,
      weight=4,is_sick=false,is_sleeping=false,last_decay_at=null,food_inventory='{}';`)
  const stock=Object.fromEntries(catalog.pool.map(k=>[k,10]))
  await db.query('update public.eren_stats set food_by_user=$1',[JSON.stringify({[alice]:stock,[bob]:stock,[other]:stock})])
}
async function snapshot(){const out={};for(const {schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)
  out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) as row from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function refuses(run,reason){const before=await snapshot(),r=await run();assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snapshot(),before);checks++}
async function fullMenu(){for(const key of dailyMenu(day,home))await feed(key);await auth()}
async function main(){
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;create publication supabase_realtime;set timezone='UTC';`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql',
    'migration_user_food_and_gifts.sql','migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql',
    'migration_interactions_useful.sql','migration_battle_results.sql','migration_trophy_battle.sql','migration_economy_reliability.sql','migration_food_actions.sql'])await db.exec(read('supabase/'+file))
  await db.exec(migration)
  assert.deepEqual(JSON.parse(migration.match(/\$menu_catalog\$([\s\S]*?)\$menu_catalog\$/)[1]),catalog)
  await db.query('insert into public.households(id) values($1),($2)',[home,elsewhere])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[alice,bob,other,'menu-a@test.invalid','menu-b@test.invalid','menu-c@test.invalid'])
  await db.query('update public.profiles set household_id=case when id=$1 then $3::uuid else $2::uuid end',[other,home,elsewhere])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,elsewhere])
  day=(await one("select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') as d")).d
  await reset();const installed=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),installed);checks++
  const dates=['2024-02-29','2025-12-29','2026-01-01','2026-03-29','2026-10-25','2026-11-06','2027-01-01']
  for(const hh of [null,home,elsewhere,...Array.from({length:40},()=>randomUUID())])for(const d of dates){
    const menu=(await one('select eren_private.menu_for_day($1,$2) as menu',[d,hh])).menu
    assert.deepEqual(menu,dailyMenu(d,hh),d+':'+hh);checks++
  }
  await auth('');await refuses(()=>claim(),'unauthenticated');await auth()
  await refuses(()=>claim(randomUUID(),day,home,bob),'session_changed')
  await refuses(()=>claim(randomUUID(),day,elsewhere),'household_changed')
  await refuses(()=>claim(randomUUID(),'2000-01-01'),'period_changed')
  await refuses(()=>claim(randomUUID(),day,home,alice,'Bad/Zone'),'bad_request')
  await refuses(()=>claim(null),'bad_request')
  let r=await claim();assert.equal(r.awarded,0);assert.deepEqual(r.menu_state.done,[]);assert.equal(r.menu_state.claimed_at,null)
  assert.equal((await one('select count(*)::int as n from eren_private.menu_claims')).n,0);checks++
  const menu=dailyMenu(day,home)
  await feed(menu[0]);await feed(menu[0]);r=await claim();assert.deepEqual(r.menu_state.done,[menu[0]]);assert.equal(r.awarded,0);checks++
  await feed(menu[1],bob);await auth();r=await claim();assert.deepEqual(r.menu_state.done,menu.slice(0,2));assert.equal(r.awarded,0);checks++
  await feed(menu[2],bob);await auth()
  const wallet=(await one('select coins from public.profiles where id=$1',[alice])).coins,id=randomUUID()
  r=await claim(id);assert.equal(r.awarded,30);assert.equal(r.coins,wallet+30);assert.deepEqual(r.menu_state.done,menu);assert.ok(r.menu_state.claimed_at)
  const paid=await snapshot();assert.deepEqual(await claim(id),r);assert.deepEqual(await snapshot(),paid)
  assert.equal((await claim()).awarded,0);await auth(bob);assert.equal((await claim(randomUUID(),day,home,bob)).awarded,0);await auth();checks++
  await refuses(()=>claim(id,day,home,alice,'Europe/Budapest'),'request_mismatch')
  // The private claim survives an old client's stale public-marker overwrite.
  await db.query("update public.eren_stats set menu_state=null where household_id=$1",[home])
  r=await claim();assert.equal(r.awarded,0);assert.ok(r.menu_state.claimed_at);assert.deepEqual(r.menu_state.done,menu);checks++
  // Committed receipts are recoverable after a rollover and with coins exhausted.
  await db.query('update public.profiles set coins=0 where id=$1',[alice])
  await db.query("update eren_private.economy_receipts set input=jsonb_set(input,'{day}','\"2000-01-01\"'),result=jsonb_set(result,'{day}','\"2000-01-01\"') where request_id=$1",[id])
  r=await claim(id,'2000-01-01');assert.equal(r.awarded,30);assert.equal(r.coins,0);checks++
  await reset();await fullMenu();await db.query("update eren_private.economy_receipts set created_at='2000-01-01Z'")
  assert.deepEqual((await claim()).menu_state.done,[],'Old meals cannot complete today');checks++
  await reset();for(const key of menu)await feed(key,other,elsewhere);await auth()
  assert.deepEqual((await claim()).menu_state.done,[],'Another household cannot supply proof');checks++
  await reset();await db.query('update public.eren_stats set menu_state=$2 where household_id=$1',[home,JSON.stringify({day,done:menu,claimed_at:null})])
  assert.equal((await claim()).awarded,30,'Existing unpaid progress remains usable');checks++
  await reset();await db.query('update public.eren_stats set menu_state=$2 where household_id=$1',[home,JSON.stringify({day,done:menu,claimed_at:new Date().toISOString()})])
  assert.equal((await claim()).awarded,0,'Never guess whether historical split payments landed');assert.equal((await one('select coins from eren_private.menu_claims')).coins,0);checks++
  await reset();await db.query('delete from public.eren_stats where household_id=$1',[home]);await refuses(()=>claim(),'no_fridge')
  await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  for(const table of ['public.profiles','public.eren_stats','eren_private.menu_claims','eren_private.economy_receipts']){
    await reset();await fullMenu();const before=await snapshot()
    await db.exec(`create function public.fail_menu_test() returns trigger language plpgsql as $$begin raise exception 'injected menu failure';end$$;
      create trigger fail_menu_test before insert or update on ${table} for each row execute function public.fail_menu_test();`)
    await assert.rejects(()=>claim(),/injected menu failure/)
    await db.exec(`drop trigger fail_menu_test on ${table};drop function public.fail_menu_test();`)
    assert.deepEqual(await snapshot(),before,table+' must roll back bonus and marker together');checks++
  }
  assert.equal((await one("select has_function_privilege('anon','public.claim_menu_bonus_atomic(uuid,uuid,uuid,text,text)','execute') as yes")).yes,false)
  assert.equal((await one("select has_function_privilege('authenticated','eren_private.menu_for_day(date,uuid)','execute') as yes")).yes,false)
  assert.equal((await one("select has_schema_privilege('authenticated','eren_private','usage') as yes")).yes,false)
  await reset();await fullMenu();await db.exec('set role authenticated');assert.equal((await claim()).awarded,30);await db.exec('reset role');checks++
  console.log(`Menu SQL: ${checks} scenarios passed; deterministic menus, real meals, shared claims, replay, rollback and roles`)
}
main().catch(error=>{console.error(error.message,error.where??'');process.exitCode=1}).finally(()=>db.close())
