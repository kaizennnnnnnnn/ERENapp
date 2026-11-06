// Disposable PostgreSQL only; no hosted players or network calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')(),{getItemById}=load('src/lib/gacha.ts'),db=new PGlite(),read=f=>fs.readFileSync(f,'utf8')
const migration=read('supabase/migration_free_food_gacha.sql')
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003'
const home='00000000-0000-4000-8000-000000000010',elsewhere='00000000-0000-4000-8000-000000000020'
let checks=0
async function one(sql,args=[]){return(await db.query(sql,args)).rows[0]}
async function auth(id=alice){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
async function claim(id=randomUUID(),actor=alice){return(await one('select public.claim_free_food_gacha_atomic($1,$2) as r',[id,actor])).r}
async function status(actor=alice){return(await one('select public.read_reward_indicators($1) as r',[actor])).r}
async function state(){return(await one('select to_jsonb(s) as s from public.user_gacha_state s where user_id=$1',[alice])).s}
async function snapshot(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)
  out[schemaname+'.'+tablename]=(await db.query('select to_jsonb(t) as row from "'+schemaname+'"."'+tablename+'" t order by to_jsonb(t)::text')).rows;return out}
async function reset(){await auth();await db.exec("delete from eren_private.economy_receipts;delete from public.user_inventory;delete from public.gacha_pull_log;delete from public.user_gacha_state;update public.profiles set coins=1000;update public.eren_stats set food_by_user='{}',food_inventory='{}';")}
async function refuses(id,actor,reason){const before=await snapshot(),r=await claim(id,actor);assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snapshot(),before);checks++}
async function main(){
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create publication supabase_realtime;")
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql','migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql','migration_interactions_useful.sql','migration_battle_results.sql','migration_trophy_battle.sql','migration_economy_reliability.sql','migration_jelly_progress.sql','migration_weekly_game_results.sql'])await db.exec(read('supabase/'+file))
  await db.exec(migration)
  await db.query('insert into public.households(id) values($1),($2)',[home,elsewhere])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[alice,bob,other,'free-a@test.invalid','free-b@test.invalid','free-c@test.invalid'])
  await db.query('update public.profiles set household_id=case when id=$1 then $3::uuid else $2::uuid end',[other,home,elsewhere])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,elsewhere]);await reset()
  const untouched=await snapshot(),initial=await status();assert.equal(initial.ok,true);assert.equal(initial.gacha.last_free_food_gacha,null);assert.equal(initial.gacha.last_free_donut,null);assert.equal(initial.supers,0);assert.equal(initial.weekly,0);assert.deepEqual(await snapshot(),untouched);checks++
  for(const tickets of [0,1,7,2147483647])for(const coins of [0,49,1000])for(const pity of [[0,0],[29,0],[0,99]]){
    await reset();await db.query("update public.profiles set coins=$1 where id=$2",[coins,alice])
    await db.query("insert into public.user_gacha_state(user_id,gacha_tickets,pulls_since_epic,pulls_since_legendary,last_free_donut,last_free_fortune) values($1,$2,$3,$4,'2026-11-01Z','2026-11-02Z')",[alice,tickets,...pity])
    const r=await claim();assert.equal(r.ok,true);assert.equal(r.coins,coins);assert.equal(r.state.gacha_tickets,tickets);assert.equal(r.results.length,1);assert.equal(r.state.total_pulls,1);assert.ok(r.state.last_free_food_gacha)
    const item=getItemById(r.results[0].itemId);assert.equal(item.category,'consumable');assert.equal(r.state.last_free_donut,'2026-11-01T00:00:00+00:00');assert.equal(r.state.last_free_fortune,'2026-11-02T00:00:00+00:00')
    if(pity[1]===99)assert.equal(item.rarity,'legendary');else if(pity[0]===29)assert.ok(['epic','legendary'].includes(item.rarity))
    const fridge=(await one('select food_by_user from public.eren_stats where household_id=$1',[home])).food_by_user
    assert.equal(Object.values(fridge[alice]).reduce((a,b)=>a+b,0),1);checks++
  }
  await reset();const id=randomUUID(),first=await claim(id),saved=await snapshot();assert.deepEqual(await claim(id),first);assert.deepEqual(await snapshot(),saved);checks++
  await refuses(randomUUID(),alice,'cooldown')
  await db.query('update public.profiles set coins=0 where id=$1',[alice]);const replay=await claim(id);assert.equal(replay.coins,0);assert.equal(replay.results[0].itemId,first.results[0].itemId);assert.equal((await state()).total_pulls,1);checks++
  // Boundary is rolling 24h, not midnight; future clocks do not grant extra pulls.
  await db.query("update public.user_gacha_state set last_free_food_gacha=clock_timestamp()-interval '23 hours 59 minutes' where user_id=$1",[alice]);await refuses(randomUUID(),alice,'cooldown')
  await db.query("update public.user_gacha_state set last_free_food_gacha=clock_timestamp()-interval '24 hours' where user_id=$1",[alice]);assert.equal((await claim()).ok,true);checks++
  await db.query("update public.user_gacha_state set last_free_food_gacha=clock_timestamp()+interval '1 hour' where user_id=$1",[alice]);await refuses(randomUUID(),alice,'cooldown')
  await auth(bob);assert.equal((await claim(randomUUID(),bob)).ok,true);await auth();checks++
  await auth('');await refuses(randomUUID(),alice,'unauthenticated');await auth();await refuses(randomUUID(),bob,'session_changed');await refuses(null,alice,'bad_request')
  await reset();const collision=randomUUID();await db.query("insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values($1,$2,'other','{}','{}')",[alice,collision]);await refuses(collision,alice,'request_mismatch')
  // Refusals from the existing gacha undo the temporary ticket and state creation.
  await reset();await db.query('delete from public.eren_stats where household_id=$1',[home]);await refuses(randomUUID(),alice,'no_fridge');await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  for(const table of ['public.profiles','public.user_inventory','public.gacha_pull_log','public.eren_stats','eren_private.economy_receipts']){
    await reset();const before=await snapshot()
    await db.exec("create function public.fail_free_test() returns trigger language plpgsql as $$begin raise exception 'injected free failure';end$$;create trigger fail_free_test before insert or update on "+table+" for each row execute function public.fail_free_test();")
    await assert.rejects(()=>claim(),/injected free failure/)
    await db.exec('drop trigger fail_free_test on '+table+';drop function public.fail_free_test();');assert.deepEqual(await snapshot(),before);checks++
  }
  await reset();await db.query('insert into public.user_gacha_state(user_id,gacha_tickets) values($1,3)',[alice]);await claim();const clock=(await state()).last_free_food_gacha
  let r=(await one("select public.pull_gacha_atomic($1,'food',1,true) as r",[randomUUID()])).r;assert.equal(r.state.gacha_tickets,2);assert.equal(r.coins,1000);assert.equal(r.state.last_free_food_gacha,clock);checks++
  r=(await one("select public.pull_gacha_atomic($1,'food',1,false) as r",[randomUUID()])).r;assert.equal(r.coins,950);assert.equal(r.state.gacha_tickets,2);assert.equal(r.state.last_free_food_gacha,clock);checks++
  const before=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),before);checks++
  await db.query('insert into public.jelly_progress(user_id,supers) values($1,2),($2,7)',[alice,other])
  await db.query("insert into public.weekly_game_results(household_id,user_id,iso_week,outcome,payout_coins,payout_paid) values($1,$2,'2026-W42','win',100,false),($1,$3,'2026-W42','win',100,false),($1,$2,'2026-W41','win',100,true)",[home,alice,bob])
  // Supabase's existing default client SELECT grants, with real migration RLS.
  await db.exec('grant select on all tables in schema public to authenticated;grant update,insert on public.user_gacha_state to authenticated;set role authenticated')
  const badges=await status();assert.equal(badges.supers,2);assert.equal(badges.weekly,1);assert.equal(badges.gacha.user_id,alice);assert.equal((await status(bob)).ok,false);checks++
  await assert.rejects(()=>db.query("update public.user_gacha_state set last_free_food_gacha=null where user_id=$1",[alice]),/server managed/);checks++
  await db.query('update public.user_gacha_state set gacha_tickets=gacha_tickets where user_id=$1',[alice]);await db.exec('reset role')
  assert.equal((await one("select has_function_privilege('anon','public.claim_free_food_gacha_atomic(uuid,uuid)','execute') as yes")).yes,false)
  assert.equal((await one("select has_function_privilege('anon','public.read_reward_indicators(uuid)','execute') as yes")).yes,false)
  assert.equal((await one("select prosecdef from pg_proc where oid='public.read_reward_indicators(uuid)'::regprocedure")).prosecdef,false);checks++
  console.log('Free food SQL: '+checks+' scenarios passed; preserved tickets/coins/pity, 24h clock, rollback, replay and badge RLS')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close())
