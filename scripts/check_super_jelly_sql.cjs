// Actual migrations, disposable PGlite only. No hosted players or credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),ts=require('typescript'),{PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')(),{SUPER_JELLY_BUFF}=load('src/lib/jellies.ts'),{clampStat,computeErenMood}=load('src/lib/utils.ts')
const db=new PGlite(),read=file=>fs.readFileSync(file,'utf8'),sql=read('supabase/migration_super_jelly_saves.sql')
const a=randomUUID(),b=randomUUID(),c=randomUUID(),home=randomUUID(),away=randomUUID();let checks=0
const one=async(query,args=[])=>(await db.query(query,args)).rows[0]
const auth=async(actor=a)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor])
const feed=async({actor=a,hh=home,id=randomUUID()}={})=>(await one('select public.feed_super_jelly_atomic($1,$2,$3) r',[id,actor,hh])).r
async function snapshot(){const out={};for(const{schemaname,tablename}of(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)
  out[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) r from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows;return out}
async function reset(){await db.exec('reset role');await auth();await db.exec(`delete from eren_private.economy_receipts;delete from public.interactions;delete from public.user_inventory;delete from public.jelly_progress;
  update public.profiles set coins=1000;update public.eren_stats set hunger=50,happiness=50,energy=50,sleep_quality=50,cleanliness=50,weight=4.5,is_sick=true,is_sleeping=false,mood='idle',last_decay_at=null;`)
  await db.query('update public.profiles set household_id=case when id=$1 then $3::uuid else $2::uuid end',[c,home,away])
  await db.query("insert into public.jelly_progress(user_id,supers,fed,day,flavours) values($1,2,4,'2026-01-01','[\"red\",\"green\"]'),($2,1,0,'2026-01-01','[]')",[a,b])}
async function refused(call,reason){const before=await snapshot(),result=await call();assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.deepEqual(await snapshot(),before);checks++}

const source=ts.createSourceFile('useErenStats.ts',read('src/hooks/useErenStats.ts'),ts.ScriptTarget.Latest,true)
const decay=source.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='computeDecay'||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>['DECAY_PER_HOUR','DECAY_CAP_HOURS'].includes(d.name?.text)))
assert.equal(decay.length,3)
const code=ts.transpileModule(decay.map(n=>n.getText(source)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
function expected(before,stamp){class Clock extends Date{static now(){return Date.parse(stamp)}}
  const compute=new Function('Date','clampStat',code+'\nreturn computeDecay')(Clock,clampStat),base={...before,...compute(before)}
  const next={hunger:Math.round(clampStat(base.hunger+SUPER_JELLY_BUFF.hunger)),happiness:Math.round(clampStat(base.happiness+SUPER_JELLY_BUFF.happiness)),
    energy:SUPER_JELLY_BUFF.energy,sleep_quality:Math.round(clampStat(base.sleep_quality+SUPER_JELLY_BUFF.sleep_quality)),
    cleanliness:Math.round(clampStat(base.cleanliness+SUPER_JELLY_BUFF.cleanliness)),weight:Math.round(Math.max(2,Math.min(10,base.weight))*100)/100,is_sick:false}
  next.mood=computeErenMood(next);return{base,next}}
async function main(){
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;create publication supabase_realtime;`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql','migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql',
    'migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql','migration_interactions_useful.sql','migration_battle_results.sql',
    'migration_trophy_battle.sql','migration_economy_reliability.sql','migration_jelly_progress.sql'])await db.exec(read('supabase/'+file))
  await db.exec(sql)
  await db.query('insert into public.households(id) values($1),($2)',[home,away])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)',[a,b,c,'jelly-a@test.invalid','jelly-b@test.invalid','jelly-c@test.invalid'])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)',[home,away]);await reset()
  const id=randomUUID(),saved=await feed({id});assert.equal(saved.ok,true);assert.equal(saved.awarded,SUPER_JELLY_BUFF.coins);assert.equal(saved.coins,1120)
  assert.equal(saved.fed,5);assert.equal(saved.supers,1);assert.equal(saved.skin_granted,true)
  assert.equal((await one("select quantity from public.user_inventory where user_id=$1 and item_id='skin_jelly'",[a])).quantity,1);checks++
  let before=await snapshot();assert.deepEqual(await feed({id}),saved);assert.deepEqual(await snapshot(),before);checks++
  const second=await feed();assert.equal(second.skin_granted,false);assert.equal(second.current_supers,0);assert.equal(second.current_fed,6)
  const replay=await feed({id});assert.equal(replay.coins,1240);assert.equal(replay.supers,1);assert.equal(replay.fed,5);assert.equal(replay.current_supers,0);assert.equal(replay.current_fed,6);checks++
  await refused(()=>feed(),'none');await refused(()=>feed({actor:b}),'session_changed');await refused(()=>feed({hh:away}),'household_changed')
  await auth('');await refused(()=>feed(),'unauthenticated');await auth()
  await refused(()=>feed({id:null}),'bad_request');await refused(()=>feed({hh:null}),'bad_request')
  await db.query('update public.profiles set household_id=$1 where id=$2',[away,a]);await refused(()=>feed({id}),'household_changed')
  await reset();await db.query("insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values($1,$2,'other','{}','{}')",[a,id]);await refused(()=>feed({id}),'request_mismatch')
  await reset();await db.query('delete from public.eren_stats where household_id=$1',[home]);await refused(()=>feed(),'no_stats');await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  await reset();await db.query('delete from public.jelly_progress where user_id=$1',[a]);await refused(()=>feed(),'none')
  for(const table of ['public.jelly_progress','public.user_inventory','public.eren_stats','public.profiles','public.interactions','eren_private.economy_receipts']){
    await reset();before=await snapshot();await db.exec(`create function public.fail_super_test() returns trigger language plpgsql as $$begin raise exception 'injected';end$$;
      create trigger fail_super_test before insert or update on ${table} for each row execute function public.fail_super_test();`)
    await assert.rejects(()=>feed(),/injected/);assert.deepEqual(await snapshot(),before);checks++
    await db.exec(`drop trigger fail_super_test on ${table};drop function public.fail_super_test();`)
  }
  // Existing JS decay/buff code is the oracle, including fractional ledger deltas.
  for(const stat of [0,24,29,50,71,89,90,99,100])for(const hours of [-2,0,0.125,1.1,11.9,12,24])for(const sleeping of [false,true]){
    await reset();await db.query(`update public.eren_stats set hunger=$2::int,happiness=$2::int,energy=$2::int,sleep_quality=$2::int,cleanliness=$2::int,is_sleeping=$3,
      last_decay_at=clock_timestamp()-$4::numeric*interval '1 hour' where household_id=$1`,[home,stat,sleeping,hours])
    const old=await one('select * from public.eren_stats where household_id=$1',[home]),result=await feed(),after=await one('select * from public.eren_stats where household_id=$1',[home])
    const oracle=expected({...old,weight:Number(old.weight),cleanliness:Number(old.cleanliness)},result.saved_at)
    for(const[key,value]of Object.entries(oracle.next))assert.equal(typeof value==='number'?Number(after[key]):after[key],value,key)
    assert.equal(after.is_sleeping,sleeping);const history=await one('select * from public.interactions where user_id=$1',[a])
    for(const[column,field]of [['hunger_delta','hunger'],['happiness_delta','happiness'],['energy_delta','energy'],['sleep_delta','sleep_quality']])assert.equal(history[column],Math.round(oracle.next[field]-oracle.base[field]))
    assert.equal(history.useful,oracle.base.hunger<90||oracle.base.energy<90);checks++
  }
  await reset();const first=await feed();await auth(b);await feed({actor:b});assert.equal((await one('select coins from public.profiles where id=$1',[a])).coins,1120)
  assert.equal((await one('select happiness from public.eren_stats where household_id=$1',[home])).happiness,100);checks++
  // Legacy clients keep only their old progression contract; new clients never call it as fallback.
  for(const oldFirst of [true,false]){await reset();await db.query('update public.jelly_progress set supers=1 where user_id=$1',[a])
    const legacy=async()=>(await one('select public.feed_super_jelly() r')).r
    const x=oldFirst?await legacy():await feed(),y=oldFirst?await feed():await legacy();assert.equal(x.ok,true);assert.equal(y.reason,'none')
    assert.equal((await one('select fed from public.jelly_progress where user_id=$1',[a])).fed,5);checks++}
  await reset();await feed();before=await snapshot();await db.exec(sql);assert.deepEqual(await snapshot(),before);checks++
  await db.exec('set role authenticated');await auth();assert.equal((await feed()).ok,true)
  assert.equal((await one("select has_function_privilege('anon','public.feed_super_jelly_atomic(uuid,uuid,uuid)','execute') allowed")).allowed,false)
  await assert.rejects(()=>one('select eren_private.feed_super_jelly_v1()'),/permission denied/);checks++
  await db.close();console.log(`Super Jelly SQL: ${checks} scenarios passed; complete rollback, original buff/decay parity, fifth skin, replay, mixed clients and permissions.`)
}
main().catch(async error=>{console.error(error);await db.close();process.exitCode=1})
