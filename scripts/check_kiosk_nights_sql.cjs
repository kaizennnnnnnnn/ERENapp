// Actual migrations in disposable PostgreSQL. Never connects to Supabase.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const db=new PGlite(),read=file=>fs.readFileSync(file,'utf8'),migration=read('supabase/migration_kiosk_nights.sql')
const a=randomUUID(),b=randomUUID(),c=randomUUID(),home=randomUUID(),away=randomUUID()
const gradeNight=require('./lib/load_ts.cjs')()('src/components/kiosk/kioskEconomy.ts').gradeNight
let checks=0
const t=(served=3,extra={})=>({served,wrong:0,walked:0,missedCalls:0,bestStreak:served,base:served*10,tips:served*4,inDark:0,...extra})
const order={wraps:[{toppings:['tomato'],sauce:'garlic',without:null}],sides:['cola']}
const visits=count=>count?{bee:{...order,times:count}}:{}
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0]
const auth=async(id=a)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
const at=async stamp=>db.exec(`create or replace function eren_private.kiosk_server_time() returns timestamptz language sql volatile set search_path='' as $$select '${stamp}'::timestamptz$$;`)
const start=async({actor=a,hh=home,id=randomUUID()}={})=>(await one('select public.start_kiosk_night_atomic($1,$2,$3) r',[id,actor,hh])).r
const close=async({actor=a,hh=home,id=randomUUID(),session,takings=t(),special=0,regulars=visits(takings.served-special),early=false,weather='clear'}={})=>
  (await one('select public.close_kiosk_night_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9) r',[id,actor,hh,session,JSON.stringify(takings),weather,early,JSON.stringify(regulars),special])).r
const claim=async({actor=a,hh=home,id=randomUUID()}={})=>(await one('select public.claim_kiosk_night_bonus_atomic($1,$2,$3) r',[id,actor,hh])).r
const status=async(actor=a,hh=home)=>(await one('select public.get_kiosk_night_status($1,$2) r',[actor,hh])).r
async function snapshot(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)
  out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) row from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function reset(){await db.exec('reset role;');await auth();await db.exec(`delete from eren_private.economy_receipts;delete from public.kiosk_night_shifts;
  delete from eren_private.kiosk_night_sessions;delete from eren_private.kiosk_night_bonuses;delete from public.kiosk_shifts;delete from eren_private.kiosk_sessions;
  delete from eren_private.kiosk_clocks;update public.profiles set coins=1000;update public.eren_stats set energy=80,last_decay_at=null,kiosk_wraps=0,kiosk_regulars='{}';`)
  await db.query("update public.households set tz=case when id=$1 then 'Europe/Budapest' else 'UTC' end",[home]);await at('2026-11-07T22:00:00Z')}
async function refused(fn,reason){const before=await snapshot(),result=await fn();assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.deepEqual(await snapshot(),before);checks++}
async function earn(){await auth();const first=await start();await close({session:first.session_id,takings:t(12)});await auth(b);const second=await start({actor:b});const result=await close({actor:b,session:second.session_id,takings:t(10)});await auth();return result}
async function main(){
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;create publication supabase_realtime;set timezone='UTC';`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql',
    'migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql','migration_interactions_useful.sql','migration_battle_results.sql',
    'migration_trophy_battle.sql','migration_economy_reliability.sql','migration_kiosk_shifts.sql','migration_kiosk_reliability.sql','migration_kiosk_rollout_compat.sql'])await db.exec(read('supabase/'+file))
  // This hosted column is owned by migration_phase3_spine.sql, not this feature.
  await db.exec("alter table public.households add column if not exists tz text not null default 'UTC';")
  await db.exec(migration)
  await db.query('insert into public.households(id) values($1),($2)',[home,away])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[a,b,c,'night-a@test.invalid','night-b@test.invalid','night-c@test.invalid'])
  await db.query('update public.profiles set household_id=case when id=$1 then $3::uuid else $2::uuid end',[c,home,away])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,away]);await reset()
  const opened=await start();assert.equal(opened.version,2);assert.equal(opened.time_zone,'Europe/Budapest');assert.equal(opened.shift_date,'2026-11-07')
  assert.equal(opened.resets_at,'2026-11-08T03:00:00+00:00');assert.equal(opened.paid,true);checks++
  const id=randomUUID(),paid=await close({id,session:opened.session_id});assert.equal(paid.awarded,42);assert.equal(paid.night_bonus,0)
  assert.equal((await status()).bonus_due,0);assert.equal((await claim()).awarded,0)
  assert.equal((await one('select earned_at from eren_private.kiosk_night_bonuses where user_id=$1',[a])).earned_at,null);checks++
  let before=await snapshot();assert.deepEqual(await close({id,session:opened.session_id}),paid);assert.deepEqual(await snapshot(),before);checks++
  await refused(()=>close({id,session:opened.session_id,special:1}),'request_mismatch')
  await refused(()=>close({session:opened.session_id}),'already_closed')
  assert.equal((await status()).worked,true);assert.equal((await start()).paid,false);checks++
  await at('2026-11-08T02:59:59Z');assert.equal((await start()).paid,false);assert.equal((await status()).night_date,'2026-11-07');checks++
  await at('2026-11-08T03:00:00Z');assert.equal((await start()).paid,true);assert.equal((await status()).night_date,'2026-11-08');checks++
  await db.query("update public.households set tz='America/Los_Angeles' where id=$1",[home]);assert.equal((await status()).time_zone,'Europe/Budapest');checks++
  // Wall-clock 4 AM is correct on both 23-hour and 25-hour nights.
  for(const [stamp,zone,day,startAt,resetAt,hours] of [
    ['2026-03-29T01:30:00Z','Europe/Budapest','2026-03-28','2026-03-28T03:00:00Z','2026-03-29T02:00:00Z',23],
    ['2026-10-25T01:30:00Z','Europe/Budapest','2026-10-24','2026-10-24T02:00:00Z','2026-10-25T03:00:00Z',25],
    ['2026-11-08T08:00:00Z','America/New_York','2026-11-07','2026-11-07T09:00:00Z','2026-11-08T09:00:00Z',24],
  ]){const n=await one('select * from eren_private.kiosk_night_bounds($1,$2)',[stamp,zone]);assert.equal(n.night_date.toISOString().slice(0,10),day)
    assert.equal(n.starts_at.toISOString(),new Date(startAt).toISOString());assert.equal(n.resets_at.toISOString(),new Date(resetAt).toISOString())
    assert.equal((n.resets_at-n.starts_at)/3600000,hours);checks++}
  await reset();const earlySession=await start();await at('2026-11-08T04:00:00Z');const earlyPaid=await close({session:earlySession.session_id})
  assert.equal(earlyPaid.shift_date,'2026-11-07');assert.equal((await start()).paid,true);checks++
  // Two open tabs still share only one paid slot.
  await reset();const s1=await start(),s2=await start();await close({session:s1.session_id});assert.equal((await close({session:s2.session_id})).awarded,0);checks++
  // A daily special counts as served but never overwrites a guest's usual.
  await reset();const special=await start(),specialDone=await close({session:special.session_id,takings:t(1),special:1})
  assert.equal(specialDone.ok,true);assert.deepEqual((await one('select kiosk_regulars from public.eren_stats where household_id=$1',[home])).kiosk_regulars,{})
  const invalidSpecial=await start();await refused(()=>close({session:invalidSpecial.session_id,takings:t(3),special:1,regulars:{}}),'bad_result');checks++
  // No close may insert an FK-backed bonus row for another player: their
  // profile may already be locked by a shift waiting on our shared stats row.
  await reset();await db.exec(`create function public.bonus_owner_test() returns trigger language plpgsql as $$begin
    if new.user_id is distinct from auth.uid() then raise exception 'partner FK insert';end if;return new;end$$;
    create trigger bonus_owner_test before insert on eren_private.kiosk_night_bonuses for each row execute function public.bonus_owner_test();`)
  const goal=await earn();assert.equal(goal.night_total,22);assert.equal(goal.night_bonus,40);assert.equal(goal.awarded,180)
  await db.exec('drop trigger bonus_owner_test on eren_private.kiosk_night_bonuses;drop function public.bonus_owner_test();');checks++
  assert.equal((await status()).bonus_due,40);await auth(b);assert.equal((await status(b)).bonus_due,0);await auth();checks++
  const bonusId=randomUUID(),bonus=await claim({id:bonusId});assert.equal(bonus.awarded,40);assert.equal(bonus.nights.length,1);assert.equal(bonus.coins,1208)
  before=await snapshot();assert.deepEqual(await claim({id:bonusId}),bonus);assert.deepEqual(await snapshot(),before);checks++
  assert.equal((await claim()).awarded,0);assert.equal((await status()).bonus_due,0);checks++
  await db.query('update public.profiles set coins=7 where id=$1',[a]);assert.equal((await claim({id:bonusId})).coins,7);checks++
  // Earned bonuses remain collectable on a later night; a practice close cannot pay one.
  await reset();await earn();const practice=await start();assert.equal(practice.paid,false);assert.equal((await close({session:practice.session_id})).awarded,0)
  await at('2026-11-12T22:00:00Z');assert.equal((await claim()).awarded,40);checks++
  for(const energy of [0,29,30,100]){await reset();await db.query('update public.eren_stats set energy=$1',[energy]);const s=await start();assert.equal(s.paid,energy>=30)
    assert.equal((await close({session:s.session_id})).awarded,energy>=30?42:0);checks++}
  await reset();const empty=await start();await refused(()=>close({session:empty.session_id,takings:t(0)}),'bad_result')
  for(const takings of [t(3,{served:-1}),t(3,{served:1.5}),t(3,{served:'3'}),t(3,{tips:30001}),t(3,{base:106}),t(3,{bestStreak:4}),t(3,{inDark:4})])
    await refused(()=>close({session:empty.session_id,takings}),'bad_result')
  await refused(()=>close({session:empty.session_id,early:true}),'bad_result');await refused(()=>close({session:empty.session_id,special:2}),'bad_result')
  await refused(()=>close({session:empty.session_id,regulars:{bee:{...order,times:3,wraps:[{toppings:['glass']}]}}}),'bad_result')
  await refused(()=>close({session:empty.session_id,weather:'snow'}),'bad_result')
  await refused(()=>start({actor:b}),'session_changed');await refused(()=>start({hh:away}),'household_changed');await refused(()=>claim({hh:away}),'household_changed')
  await auth(b);await refused(()=>close({actor:b,session:empty.session_id}),'no_session');await auth('');await refused(()=>start(),'unauthenticated');await auth()
  // New and old atomic closers serialize against the same household stats row.
  for(const oldFirst of [true,false]){await reset();const legacyId=randomUUID();await one("select public.start_kiosk_shift_atomic($1,$2,$3,'UTC') r",[legacyId,a,home])
    await db.query("update eren_private.kiosk_sessions set started_at='2026-11-07T22:00:00Z' where id=$1",[legacyId]);const modern=await start()
    const oldClose=async()=>(await one("select public.close_kiosk_shift_atomic($1,$2,$3,$4,$5,'clear',false,$6) r",[randomUUID(),a,home,legacyId,JSON.stringify(t()),JSON.stringify(visits(3))])).r
    const first=oldFirst?await oldClose():await close({session:modern.session_id}),second=oldFirst?await close({session:modern.session_id}):await oldClose()
    assert.equal(first.awarded,42);assert.equal(second.awarded,0);assert.equal((await one('select coins from public.profiles where id=$1',[a])).coins,1042);checks++}
  // A failure at every write site rolls the entire second shift back.
  for(const table of ['public.kiosk_night_shifts','eren_private.kiosk_night_bonuses','public.eren_stats','public.profiles','eren_private.kiosk_night_sessions','eren_private.economy_receipts']){
    await reset();const first=await start();await close({session:first.session_id,takings:t(12)});await auth(b);const second=await start({actor:b});before=await snapshot()
    await db.exec(`create function public.fail_night_test() returns trigger language plpgsql as $$begin raise exception 'injected';end$$;
      create trigger fail_night_test before insert or update on ${table} for each row execute function public.fail_night_test();`)
    await assert.rejects(()=>close({actor:b,session:second.session_id,takings:t(10)}),/injected/);assert.deepEqual(await snapshot(),before);checks++
    await db.exec(`drop trigger fail_night_test on ${table};drop function public.fail_night_test();`)
  }
  for(const table of ['eren_private.kiosk_night_bonuses','public.profiles','eren_private.economy_receipts']){
    await reset();await earn();before=await snapshot();await db.exec(`create function public.fail_bonus_test() returns trigger language plpgsql as $$begin raise exception 'injected';end$$;
      create trigger fail_bonus_test before insert or update on ${table} for each row execute function public.fail_bonus_test();`)
    await assert.rejects(()=>claim(),/injected/);assert.deepEqual(await snapshot(),before);checks++
    await db.exec(`drop trigger fail_bonus_test on ${table};drop function public.fail_bonus_test();`)
  }
  // New paid and practice receipts retain all existing grade boundaries.
  await reset();for(let served=0;served<=12;served++)for(let wrong=0;wrong<=3;wrong++)for(let walked=0;walked<=3;walked++){
    if(served+wrong+walked===0)continue
    const session=await start(),takings=t(served,{wrong,walked}),result=await close({session:session.session_id,takings,special:served>0?1:0})
    assert.equal(result.ok,true);assert.equal(result.grade,gradeNight(takings));checks++
  }
  await reset();const noService=await start();await close({session:noService.session_id,takings:t(0,{wrong:1})});await auth(b)
  const partnerOnly=await start({actor:b});await close({actor:b,session:partnerOnly.session_id,takings:t(22)})
  await auth();assert.equal((await status()).bonus_due,0);checks++
  // Legacy history remains visible but isn't granted historical bonus backpay.
  await reset();await db.query("insert into public.kiosk_shifts(household_id,user_id,shift_date,served,base,tips,paid_coins,closed_at) values($1,$2,'2026-10-01',30,300,120,460,'2026-10-01T22:00:00Z')",[home,a])
  assert.equal((await status()).bonus_due,0);assert.equal((await status()).rows[0].shift_date,'2026-10-01');assert.equal((await claim()).awarded,0);checks++
  await reset();await earn();before=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),before);checks++
  await db.exec('set role authenticated;');await auth()
  assert.equal((await one("select has_table_privilege(current_user,'public.kiosk_night_shifts','INSERT') allowed")).allowed,false)
  assert.equal((await one("select has_function_privilege('anon','public.claim_kiosk_night_bonus_atomic(uuid,uuid,uuid)','EXECUTE') allowed")).allowed,false)
  await assert.rejects(()=>one("select eren_private.kiosk_night_bounds(now(),'UTC')"),/permission denied/)
  assert.equal((await status()).ok,true);const noteSession=(await one('select session_id from public.kiosk_night_shifts where user_id=$1',[a])).session_id
  assert.equal((await one("select public.pin_kiosk_night_note($1,$2,$3,'Fresh onions') r",[a,home,noteSession])).r.ok,true);checks++
  await auth(b);assert.equal((await one("select public.pin_kiosk_night_note($1,$2,$3,'wrong owner') r",[b,home,noteSession])).r.ok,false);checks++
  await auth(c);assert.equal((await one('select count(*)::int n from public.kiosk_night_shifts')).n,0)
  assert.equal((await claim({actor:c,hh:home})).reason,'household_changed');checks++
  await reset();await db.exec('set role authenticated;');await auth();const roleA=await start()
  await close({session:roleA.session_id,takings:t(12)});await auth(b);const roleB=await start({actor:b})
  assert.equal((await close({actor:b,session:roleB.session_id,takings:t(10)})).night_bonus,40)
  await auth();assert.equal((await claim()).awarded,40);checks++
  await reset();await earn();await db.query('delete from auth.users where id=$1',[b]);assert.equal((await claim()).awarded,40);checks++
  await db.close();console.log(`Kiosk nights SQL: ${checks} scenarios passed; 4 AM/DST, special saves, partner bonuses, legacy rollout, failure rollback and RLS.`)
}
main().catch(async error=>{console.error(error);await db.close();process.exitCode=1})
