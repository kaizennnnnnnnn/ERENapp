// Disposable PostgreSQL; never connects to the hosted game.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')(),{gradeNight}=load('src/components/kiosk/kioskEconomy.ts'),db=new PGlite(),read=f=>fs.readFileSync(f,'utf8')
const migration=read('supabase/migration_kiosk_reliability.sql'),a=randomUUID(),b=randomUUID(),c=randomUUID(),home=randomUUID(),away=randomUUID()
let checks=0
async function one(sql,args=[]){return(await db.query(sql,args)).rows[0]}
async function auth(id=a){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
const order={wraps:[{toppings:['tomato'],sauce:'garlic',without:null}],sides:['cola']}
const takings=(served=3,extra={})=>({served,wrong:0,walked:0,missedCalls:0,bestStreak:served,base:served*10,tips:served*4,inDark:0,...extra})
const regulars=n=>n?{bee:{...order,times:n}}:{}
async function start({id=randomUUID(),actor=a,hh=home,zone='UTC'}={}){return(await one('select public.start_kiosk_shift_atomic($1,$2,$3,$4) r',[id,actor,hh,zone])).r}
async function close({id=randomUUID(),actor=a,hh=home,session,t=takings(),weather='clear',early=false,r=regulars(t.served)}={}){
  return(await one('select public.close_kiosk_shift_atomic($1,$2,$3,$4,$5,$6,$7,$8) r',[id,actor,hh,session,JSON.stringify(t),weather,early,JSON.stringify(r)])).r
}
async function snapshot(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)
  out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) row from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function reset(){await auth();await db.exec('delete from eren_private.economy_receipts;delete from eren_private.kiosk_sessions;delete from public.kiosk_shifts;update public.profiles set coins=1000;update public.eren_stats set energy=80,last_decay_at=null,kiosk_wraps=0,kiosk_regulars=\'{}\';')}
async function refused(call,reason){const before=await snapshot(),r=await call();assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snapshot(),before);checks++}
async function main(){
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;create publication supabase_realtime;set timezone='UTC';`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql',
    'migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql','migration_interactions_useful.sql',
    'migration_battle_results.sql','migration_trophy_battle.sql','migration_economy_reliability.sql','migration_kiosk_shifts.sql'])await db.exec(read('supabase/'+file))
  // The hosted table predates weather. Exercise that actual upgrade path.
  await db.exec('alter table public.kiosk_shifts drop column weather;');await db.exec(migration)
  await db.query('insert into public.households(id) values($1),($2)',[home,away])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[a,b,c,'kiosk-a@test.invalid','kiosk-b@test.invalid','kiosk-c@test.invalid'])
  await db.query('update public.profiles set household_id=case when id=$1 then $3::uuid else $2::uuid end',[c,home,away])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,away]);await reset()
  const opened=await start();assert.equal(opened.ok,true);assert.equal(opened.paid,true);assert.equal(opened.energy,80)
  const id=randomUUID(),first=await close({id,session:opened.session_id});assert.equal(first.awarded,42);assert.equal(first.coins,1042);assert.equal(first.grade,gradeNight(takings()))
  assert.equal((await one('select kiosk_wraps from public.eren_stats where household_id=$1',[home])).kiosk_wraps,3);checks++
  let before=await snapshot();assert.deepEqual(await close({id,session:opened.session_id}),first);assert.deepEqual(await snapshot(),before);checks++
  await db.query('update public.profiles set coins=7 where id=$1',[a]);const replay=await close({id,session:opened.session_id});assert.equal(replay.coins,7);assert.equal(replay.awarded,42);checks++
  await refused(()=>close({id,session:opened.session_id,weather:'rain'}),'request_mismatch')
  await refused(()=>close({session:opened.session_id}),'already_closed')
  const practice=await start();assert.equal(practice.paid,false);const p=await close({session:practice.session_id});assert.equal(p.awarded,0);assert.equal(p.paid,false)
  assert.equal((await one('select count(*)::int n from public.kiosk_shifts')).n,1);assert.equal((await one('select kiosk_wraps from public.eren_stats where household_id=$1',[home])).kiosk_wraps,6);checks++
  // Two tabs can start together; only the first close is a paid daily shift.
  await reset();const s1=await start(),s2=await start();assert.equal(s2.paid,true);await close({session:s1.session_id})
  assert.equal((await close({session:s2.session_id})).awarded,0);assert.equal((await one('select coins from public.profiles where id=$1',[a])).coins,1042);checks++
  // Household memory merges increments, never a stale full snapshot from the other partner.
  await reset();const sa=await start();await auth(b);const sb=await start({actor:b});await close({actor:b,session:sb.session_id,t:takings(5),r:{bee:{...order,times:2},dragon:{...order,times:3}}})
  await auth();await close({session:sa.session_id,t:takings(4),r:{bee:{...order,times:4}}})
  const memory=await one('select kiosk_wraps,kiosk_regulars from public.eren_stats where household_id=$1',[home]);assert.equal(memory.kiosk_wraps,9);assert.equal(memory.kiosk_regulars.bee.times,6);assert.equal(memory.kiosk_regulars.dragon.times,3);checks++
  // Server totals decide the shared bonus, not the client's stale night total or grade.
  await reset();const goalA=await start();await close({session:goalA.session_id,t:takings(12)})
  await auth(b);const goalB=await start({actor:b}),goal=await close({actor:b,session:goalB.session_id,t:takings(10)});assert.equal(goal.night_total,22);assert.equal(goal.goal_met,true);assert.equal(goal.awarded,180);checks++
  // Period belongs to the server-stamped start, even when confirmation is next day.
  await reset();const old=await start();await db.query("update eren_private.kiosk_sessions set shift_date='2026-10-01' where id=$1",[old.session_id])
  const oldDone=await close({session:old.session_id});assert.equal(oldDone.shift_date,'2026-10-01');assert.equal((await start()).paid,true);checks++
  // Full report-grade parity across the thresholds; payouts stay one per daily period.
  await reset();for(let served=0;served<=12;served++)for(let wrong=0;wrong<=3;wrong++)for(let walked=0;walked<=3;walked++){
    if(served+wrong+walked===0)continue
    const s=await start(),t=takings(served,{wrong,walked}),r=await close({session:s.session_id,t});assert.equal(r.ok,true);assert.equal(r.grade,gradeNight(t));checks++
  }
  for(const energy of [0,29,30,100]){await reset();await db.query('update public.eren_stats set energy=$1',[energy]);const s=await start();assert.equal(s.paid,energy>=30)
    const r=await close({session:s.session_id});assert.equal(r.awarded,energy>=30?42:0);assert.equal(r.blocked,energy<30);checks++}
  await reset();await db.exec("update public.eren_stats set energy=40,last_decay_at=clock_timestamp()-interval '2 hours'");assert.equal((await start()).paid,false);checks++
  await reset();const early=await start();const earlyDone=await close({session:early.session_id,t:takings(3,{tips:0}),early:true});assert.equal(earlyDone.awarded,30);checks++
  await reset();const empty=await start();await refused(()=>close({session:empty.session_id,t:takings(0)}),'bad_result')
  for(const t of [takings(3,{served:-1}),takings(3,{served:1.5}),takings(3,{served:'3'}),takings(3,{tips:30001}),takings(3,{base:106}),takings(3,{bestStreak:4}),takings(3,{inDark:4})])
    await refused(()=>close({session:empty.session_id,t}),'bad_result')
  await refused(()=>close({session:empty.session_id,early:true}),'bad_result')
  await refused(()=>close({session:empty.session_id,r:{}}),'bad_result')
  await refused(()=>close({session:empty.session_id,r:{bee:{...order,times:4}}}),'bad_result')
  await refused(()=>close({session:empty.session_id,r:{bee:{...order,times:3,wraps:[{toppings:['glass']} ]}}}),'bad_result')
  await refused(()=>close({session:empty.session_id,weather:'snow'}),'bad_result')
  await refused(()=>close({session:randomUUID()}),'no_session')
  await refused(()=>start({actor:b}),'session_changed');await refused(()=>start({hh:away}),'household_changed');await refused(()=>start({zone:'not/a-zone'}),'bad_time_zone')
  await auth(b);await refused(()=>close({actor:b,session:empty.session_id}),'no_session');await auth('');await refused(()=>start(),'unauthenticated');await auth()
  const startedId=randomUUID(),s=await start({id:startedId});before=await snapshot();assert.deepEqual(await start({id:startedId}),s);assert.deepEqual(await snapshot(),before);checks++
  await refused(()=>start({id:startedId,zone:'Europe/Budapest'}),'request_mismatch')
  // Every write site must roll back the wallet, book, memory and receipt together.
  for(const table of ['public.kiosk_shifts','public.eren_stats','public.profiles','eren_private.kiosk_sessions','eren_private.economy_receipts']){
    await reset();const s=await start(),prior=await snapshot();await db.exec(`create function public.fail_kiosk_test() returns trigger language plpgsql as $$begin raise exception 'injected';end$$;
      create trigger fail_kiosk_test before insert or update on ${table} for each row execute function public.fail_kiosk_test();`)
    await assert.rejects(()=>close({session:s.session_id}),/injected/);assert.deepEqual(await snapshot(),prior);checks++
    await db.exec(`drop trigger fail_kiosk_test on ${table};drop function public.fail_kiosk_test();`)
  }
  await reset();const saved=await start();await close({session:saved.session_id});before=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),before);checks++
  await db.exec('set role authenticated;');await auth()
  assert.equal((await one("select has_table_privilege(current_user,'public.kiosk_shifts','INSERT') allowed")).allowed,true)
  assert.equal((await one("select has_column_privilege(current_user,'public.kiosk_shifts','note','UPDATE') allowed")).allowed,true)
  assert.equal((await one("select has_column_privilege(current_user,'public.kiosk_shifts','served','UPDATE') allowed")).allowed,false)
  assert.equal((await one("select has_function_privilege('anon','public.start_kiosk_shift_atomic(uuid,uuid,uuid,text)','EXECUTE') allowed")).allowed,false)
  assert.equal((await one("select has_function_privilege('anon','public.close_kiosk_shift_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb)','EXECUTE') allowed")).allowed,false)
  await db.query("update public.kiosk_shifts set note='saved note' where user_id=$1",[a]);checks++
  // Old clients can still record their daily row during the staged rollout.
  await db.exec('reset role;');await reset();await db.exec('set role authenticated;');await auth()
  await db.query("insert into public.kiosk_shifts(household_id,user_id,shift_date,served) values($1,$2,to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),3)",[home,a])
  const legacyStart=await start();assert.equal(legacyStart.paid,false);checks++
  await assert.rejects(()=>db.query("insert into public.kiosk_shifts(household_id,user_id,shift_date) values($1,$2,'2026-01-01')",[away,a]),/row-level security/);checks++
  await db.exec('reset role;');before=await snapshot();await db.exec(read('supabase/migration_kiosk_rollout_compat.sql'));assert.deepEqual(await snapshot(),before);checks++
  await db.close();console.log(`Kiosk SQL: ${checks} scenarios passed; atomic pay/book/memory, daily races, recovery, grades and rollout compatibility`)
}
main().catch(async e=>{console.error(e);await db.close();process.exitCode=1})
