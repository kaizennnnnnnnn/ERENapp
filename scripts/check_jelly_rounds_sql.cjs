// Real production migrations in disposable PostgreSQL only; never hosted players.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')(),{JELLIES,JELLY_THRESHOLDS}=load('src/lib/jellies.ts'),{ACTION_CONFIGS}=load('src/types/index.ts'),{computeErenMood,shouldBecomeSick}=load('src/lib/utils.ts')
const catalog=require('./build_jelly_round_catalog.cjs')(),db=new PGlite(),read=f=>fs.readFileSync(f,'utf8'),sql=read('supabase/migration_jelly_rounds.sql')
const a=randomUUID(),b=randomUUID(),c=randomUUID(),home=randomUUID(),away=randomUUID();let checks=0
const one=async(q,args=[])=>(await db.query(q,args)).rows[0],auth=async(uid=a)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
const feed=async({id=randomUUID(),actor=a,hh=home,game='run',score=300}={})=>(await one('select public.finish_jelly_round_atomic($1,$2,$3,$4,$5) r',[id,actor,hh,game,score])).r
async function snap(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) r from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function reset(){await db.exec('reset role');await auth();await db.exec('delete from eren_private.economy_receipts;delete from public.interactions;delete from public.jelly_scores;delete from public.jelly_duel_leads;delete from public.jelly_progress;')
  await db.query('update public.profiles set household_id=case when id=$1 then $2::uuid else $3::uuid end,coins=1000',[c,away,home])
  await db.exec("update public.eren_stats set hunger=50,happiness=50,energy=50,sleep_quality=50,cleanliness=50,weight=4.5,is_sick=true,is_sleeping=false,mood='idle',last_decay_at=null")
  await db.query('update eren_private.jelly_round_catalog set data=$1',[JSON.stringify(catalog)])}
async function refused(opts,reason){const before=await snap(),r=await feed(opts);assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snap(),before);checks++}
const clamp=n=>Math.max(0,Math.min(100,n)),round=n=>Math.round(n),weight=n=>round(Math.max(2,Math.min(10,n))*100)/100
function expected(before,result){const hours=before.last_decay_at?Math.min(12,Math.max(0,(Date.parse(result.saved_at)-Date.parse(before.last_decay_at))/3600000)):0
  const out={hunger:clamp(before.hunger-10*hours),happiness:clamp(before.happiness-7*hours),energy:clamp(before.energy-8*hours),sleep_quality:clamp(before.sleep_quality-7*hours),cleanliness:clamp(Number(before.cleanliness)-4*hours),weight:Number(before.weight),is_sick:before.is_sick}
  for(const win of result.wins){const buff=JELLIES.find(j=>j.id===win.flavour).effects[win.effect].buff
    for(const field of ['hunger','happiness','sleep_quality','cleanliness'])out[field]=round(clamp(out[field]+(buff[field]??0)))
    out.energy=round(clamp(buff.energy??out.energy));out.weight=weight(out.weight+(buff.weight??0));if(buff.cure)out.is_sick=false}
  const delta=ACTION_CONFIGS.play.deltas
  if(result.score>0){for(const field of ['hunger','happiness','energy','sleep_quality'])out[field]=round(clamp(out[field]+(delta[field]??0)))
    out.cleanliness=round(clamp(out.cleanliness+(delta.cleanliness??0)));out.weight=weight(out.weight+(delta.weight??0));out.is_sick=shouldBecomeSick(out)}
  out.mood=computeErenMood(out);return out}
async function main(){
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create publication supabase_realtime;`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql','migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql','migration_interactions_useful.sql','migration_battle_results.sql','migration_trophy_battle.sql','migration_economy_reliability.sql','migration_jelly_parlour.sql','migration_jelly_run.sql','migration_jelly_progress.sql','migration_super_jelly_saves.sql','migration_super_jelly_snacks.sql'])await db.exec(read('supabase/'+file))
  const legacy=(await one("select pg_get_functiondef('public.collect_jelly(text)'::regprocedure) definition")).definition
  await db.exec(sql)
  assert.equal((await one("select pg_get_functiondef('public.collect_jelly(text)'::regprocedure) definition")).definition,legacy)
  assert.deepEqual((await one('select data from eren_private.jelly_round_catalog')).data,catalog)
  await db.query('insert into public.households(id) values($1),($2)',[home,away])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[a,b,c,'round-a@test.invalid','round-b@test.invalid','round-c@test.invalid'])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,away]);await reset()
  for(const game of ['run','jump'])for(const score of [0,1,JELLY_THRESHOLDS[game]-1,JELLY_THRESHOLDS[game],2147483647]){
    await reset();const before=await one('select * from public.eren_stats where household_id=$1',[home]),id=randomUUID(),r=await feed({game,score,id})
    assert.equal(r.ok,true);assert.equal(r.wins.length,score>=JELLY_THRESHOLDS[game]?1:0);assert.equal(r.best,score);assert.equal(r.bonus_jelly,false)
    assert.equal((await one('select count(*)::int n from public.jelly_scores')).n,score>0?1:0)
    const after=await one('select * from public.eren_stats where household_id=$1',[home])
    if(score>0)for(const[k,v]of Object.entries(expected(before,r)))assert.equal(typeof v==='number'?Number(after[k]):after[k],v,k)
    else assert.deepEqual(after,before)
    const saved=await snap();assert.deepEqual(await feed({game,score,id}),r);assert.deepEqual(await snap(),saved);checks++
  }
  const seen=new Set()
  for(const value of [0,1,4,5,24,29,49,71,89,99,100])for(const hours of [-1,0,0.125,1.1,11.9,12,24])for(const game of ['run','jump']){
    await reset();await db.query('select setseed($1)',[Math.sin(checks)*0.99]);await db.query(`update public.eren_stats set hunger=$2::int,happiness=$2::int,energy=$2::int,sleep_quality=$2::int,cleanliness=$2::int,weight=$3,last_decay_at=clock_timestamp()-$4::numeric*interval '1 hour' where household_id=$1`,[home,value,value===99?8.5:4.5,hours])
    const before=await one('select * from public.eren_stats where household_id=$1',[home]),r=await feed({game}),after=await one('select * from public.eren_stats where household_id=$1',[home])
    for(const[k,v]of Object.entries(expected(before,r)))assert.equal(typeof v==='number'?Number(after[k]):after[k],v,`${k}, ${value}, ${hours}`)
    assert.equal(r.awarded,r.wins.reduce((sum,w)=>sum+(JELLIES.find(j=>j.id===w.flavour).effects[w.effect].buff.coins??0),0))
    assert.equal(r.coins,1000+r.awarded);for(const w of r.wins)seen.add(w.flavour+':'+w.effect);checks++
  }
  assert.equal(seen.size,15,'all fifteen effects exercised against original care math')
  await reset();await db.query("insert into public.jelly_scores(household_id,user_id,game,score) values($1,$2,'run',50)",[home,b])
  let r=await feed({score:100});assert.equal(r.took_lead,true);assert.equal(r.bonus_jelly,false);assert.equal((await one('select count(*)::int n from public.jelly_duel_leads')).n,0);checks++
  r=await feed();assert.equal(r.bonus_jelly,true);assert.equal(r.wins.length,2);r=await feed({score:400});assert.equal(r.bonus_jelly,false);assert.equal(r.wins.length,1);checks++
  await reset();await db.query("insert into public.jelly_scores(household_id,user_id,game,score) values($1,$2,'jump',299)",[home,b])
  r=await feed({game:'jump',score:299});assert.equal(r.took_lead,false);r=await feed({game:'jump',score:300});assert.equal(r.bonus_jelly,true);checks++
  await reset();await db.query("insert into public.jelly_scores(household_id,user_id,game,score) values($1,$2,'run',900),($3,$2,'run',1000),($3,$4,'run',9999)",[home,a,away,c])
  r=await feed();assert.equal(r.best,900);assert.equal(r.is_best,false);assert.equal(r.theirs_today,0);assert.equal(r.their_name,null);assert.equal(r.bonus_jelly,false);checks++
  await reset();await db.query("insert into public.jelly_scores(household_id,user_id,game,score) values($1,$2,'run',50)",[home,a]);await auth(b)
  await db.query("insert into public.jelly_duel_leads(household_id,user_id,game) values($1,$2,'run')",[home,b]);r=await feed({actor:b});assert.equal(r.took_lead,true);assert.equal(r.bonus_jelly,false);checks++
  await auth();await db.query('update public.eren_stats set is_sleeping=true where household_id=$1',[home]);await feed();assert.equal((await one('select is_sleeping from public.eren_stats where household_id=$1',[home])).is_sleeping,true);checks++
  await reset();await db.query("insert into public.jelly_scores(household_id,user_id,game,score) values($1,$2,'run',10)",[home,b]);await db.query("insert into public.jelly_progress(user_id,day,flavours,supers,fed) values($1,(now() at time zone 'utc')::date,'[\"red\",\"green\",\"purple\",\"yellow\"]',2,4)",[a])
  await db.exec("update eren_private.jelly_round_catalog set data=jsonb_set(data,'{new_bias}','1')")
  const id=randomUUID();r=await feed({id});assert.equal(r.wins.length,2);assert.equal(r.wins.filter(w=>w.minted_super).length,1);assert.equal(r.current_supers,3);assert.equal(r.current_fed,4);assert.equal(r.current_flavours.length,5);checks++
  await db.query("update public.jelly_progress set day=day-1,flavours='[\"red\"]',supers=2,fed=5 where user_id=$1",[a]);await db.query('update public.profiles set coins=7 where id=$1',[a])
  const recovered=await feed({id});assert.deepEqual(recovered.wins,r.wins);assert.equal(recovered.coins,7);assert.equal(recovered.current_supers,2);assert.deepEqual(recovered.current_flavours,['red']);checks++
  r=await feed({score:500});assert.ok(r.current_flavours.length<=2);assert.equal(r.current_supers,2);assert.equal(r.current_fed,5);checks++
  for(const table of ['public.jelly_scores','public.jelly_duel_leads','public.jelly_progress','public.interactions','public.eren_stats','public.profiles','eren_private.economy_receipts']){
    await reset();await db.query("insert into public.jelly_scores(household_id,user_id,game,score) values($1,$2,'run',10)",[home,b])
    const forced={...catalog,flavours:[{id:'red',effects:[{label:'test',coins:45}]}]};await db.query('update eren_private.jelly_round_catalog set data=$1',[JSON.stringify(forced)])
    await db.exec(`create function public.fail_round_test() returns trigger language plpgsql as $$begin raise exception 'round injected';end$$;create trigger fail_round_test before insert or update on ${table} for each row execute function public.fail_round_test();`)
    const before=await snap();await assert.rejects(()=>feed(),/round injected/);assert.deepEqual(await snap(),before);checks++
    await db.exec(`drop trigger fail_round_test on ${table};drop function public.fail_round_test();`)
  }
  await reset();await refused({actor:b},'session_changed');await refused({hh:away},'household_changed');await refused({game:'slice'},'bad_result');await refused({game:null},'bad_result')
  for(const score of [-1,1.5,null,'NaN','Infinity',2147483648])await refused({score},'bad_result')
  await refused({id:null},'bad_request');await refused({hh:null},'bad_request');await auth('');await refused({},'unauthenticated');await auth()
  await db.query('delete from public.eren_stats where household_id=$1',[home]);await refused({},'no_stats');await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  await reset();await feed({id});await refused({id,score:301},'request_mismatch');await db.query('update public.profiles set household_id=$1 where id=$2',[away,a]);await refused({id},'household_changed')
  await reset();await db.query("insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values($1,$2,'other','{}','{}')",[a,id]);await refused({id},'request_mismatch')
  await reset();await feed();await auth(b);await feed({actor:b});assert.equal((await one('select count(*)::int n from public.jelly_scores where user_id=$1',[a])).n,1);checks++
  const before=await snap();await db.exec(sql);assert.deepEqual(await snap(),before);checks++
  await db.exec('set role authenticated');await auth();assert.equal((await feed()).ok,true)
  assert.equal((await one("select has_function_privilege('anon','public.finish_jelly_round_atomic(uuid,uuid,uuid,text,numeric)','execute') allowed")).allowed,false)
  await assert.rejects(()=>db.query('select * from eren_private.jelly_round_catalog'),/permission denied/);checks++
  await db.close();console.log(`Jelly round SQL: ${checks} scenarios passed; all 15 effects, both thresholds, bonus, fifth slot, recovery, rollback, scope and permissions.`)
}
main().catch(async e=>{console.error(e);await db.close();process.exitCode=1})
