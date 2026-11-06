// Disposable PostgreSQL only; no hosted credentials or player data.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const load=require('./lib/load_ts.cjs')()
const catalog=require('./build_fortune_catalog.cjs')()
const {rollFortuneGift}=load('src/lib/fortune.ts')
const read=file=>fs.readFileSync(file,'utf8')
const migration=read('supabase/migration_fortune_claims.sql')
const db=new PGlite()
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002'
let checks=0
async function one(sql,args=[]){return (await db.query(sql,args)).rows[0]}
async function auth(id=alice){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
async function claim(id=randomUUID(),zone='UTC',expected=alice){return (await one('select public.claim_fortune_atomic($1,$2,$3) as r',[id,expected,zone])).r}
async function reset(){
  await auth()
  await db.exec(`delete from eren_private.economy_receipts;delete from public.user_inventory;delete from public.user_gacha_state;
    update public.profiles set coins=1000;
    insert into public.user_gacha_state(user_id,stardust,gacha_tickets,pulls_since_epic,pulls_since_legendary,total_pulls)
    select id,7,2,19,88,120 from public.profiles;`)
}
async function snapshot(){
  const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows
  const state={}
  for(const {schemaname,tablename} of tables)state[schemaname+'.'+tablename]=(await db.query(`select to_jsonb(t) as row from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows
  return state
}
async function refuses(call,reason){const before=await snapshot(),r=await call();assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.deepEqual(await snapshot(),before);checks++}
async function main(){
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;create publication supabase_realtime;set timezone='UTC';`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";',''))
  for(const file of ['migration_v2.sql','migration_v3.sql','migration_gacha_couple_fortune.sql','migration_economy_reliability.sql'])await db.exec(read('supabase/'+file))
  await db.query('insert into auth.users(id,email) values($1,$3),($2,$4)',[alice,bob,'fortune-a@test.invalid','fortune-b@test.invalid'])
  assert.deepEqual(JSON.parse(migration.match(/\$fortune_catalog\$([\s\S]*?)\$fortune_catalog\$/)[1]),catalog)
  const before=await snapshot()
  await assert.rejects(()=>db.exec(migration.replace(/\$fortune_catalog\$[\s\S]*?\$fortune_catalog\$/,'$fortune_catalog${}$fortune_catalog$')),/catalogue incomplete/)
  await db.exec('rollback');assert.deepEqual(await snapshot(),before)
  await db.exec(migration);await reset()
  const installed=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),installed);checks++

  await auth('');await refuses(()=>claim(),'unauthenticated');await auth()
  await refuses(()=>claim(randomUUID(),'Not/AZone'),'bad_request')
  await refuses(()=>claim(null),'bad_request')
  await refuses(()=>claim(randomUUID(),'UTC',bob),'session_changed')
  const originalRandom=Math.random,seen=new Set()
  try{
    for(const roll of [0,.029999,.03,.149999,.15,.449999,.45,.999999])for(let i=0;i<20;i++){
      const pick=i/20
      let index=0;Math.random=()=>[roll,pick][index++]
      const expected=rollFortuneGift()
      const actual=(await one('select eren_private.roll_fortune($1,$2) as gift',[roll,pick])).gift
      assert.equal(actual.id,expected.id);seen.add(actual.id);checks++
    }
  }finally{Math.random=originalRandom}
  assert.equal(seen.size,18,'Every original gift must be reachable with identical rarity boundaries')
  for(const input of [[-1,0],[1,0],[0,-1],[0,1],[null,0]])await assert.rejects(()=>one('select eren_private.roll_fortune($1,$2)',input),/Invalid fortune roll/)

  // Test-only helper override is rolled back, never part of the migration or RPC.
  // This forces every payout branch without exposing a client gift selector.
  await db.exec('begin')
  await db.exec(`create or replace function eren_private.roll_fortune(p_roll double precision,p_pick double precision)
    returns jsonb language sql stable set search_path='' as $$
    select value from eren_private.fortune_catalog,jsonb_array_elements(data->'gifts') where singleton
      and value->>'id'=current_setting('test.fortune_gift') $$;`)
  const force=gift=>db.query("select set_config('test.fortune_gift',$1,false)",[gift])
  for(const gift of catalog.gifts){
    await reset();await force(gift.id)
    const id=randomUUID(),r=await claim(id)
    assert.equal(r.ok,true);assert.equal(r.user_id,alice);assert.equal(r.gift_id,gift.id)
    assert.equal(r.coins,1000+gift.coins);assert.equal(r.stardust,7+gift.dust);assert.equal(r.gacha_tickets,2+gift.tickets)
    assert.equal(r.claimed_at,r.last_free_fortune)
    const state=await one('select * from public.user_gacha_state where user_id=$1',[alice])
    assert.equal(state.pulls_since_epic,19);assert.equal(state.pulls_since_legendary,88);assert.equal(state.total_pulls,120)
    const items=(await db.query('select * from public.user_inventory where user_id=$1',[alice])).rows
    const keepsake=!gift.coins&&!gift.dust&&!gift.tickets
    assert.equal(items.length,keepsake?1:0)
    if(keepsake){assert.equal(items[0].item_id,gift.id);assert.equal(items[0].quantity,1)}
    const saved=await snapshot()
    assert.deepEqual(await claim(id),r);assert.deepEqual(await snapshot(),saved,'Receipt replay must not mutate anything')
    await refuses(()=>claim(),'cooldown')
    await refuses(()=>claim(id,'Europe/Budapest'),'request_mismatch')
    checks++
  }
  await reset();await force('fortune_golden_bell')
  await db.query('insert into public.user_inventory(user_id,item_id,quantity,equipped) values($1,$2,3,true)',[alice,'fortune_golden_bell'])
  await claim()
  let row=await one('select * from public.user_inventory where user_id=$1',[alice])
  assert.equal(row.quantity,4);assert.equal(row.equipped,true);checks++

  await reset();await force('fortune_coins_250')
  const receipt=randomUUID(),first=await claim(receipt)
  await db.query("update public.profiles set coins=0 where id=$1",[alice])
  await db.query("update public.user_gacha_state set stardust=0,gacha_tickets=0,last_free_fortune=clock_timestamp()+interval '2 day' where user_id=$1",[alice])
  const replay=await claim(receipt)
  assert.equal(replay.gift_id,first.gift_id);assert.equal(replay.claimed_at,first.claimed_at);assert.equal(replay.coins,0)
  assert.equal(replay.stardust,0);assert.equal(replay.gacha_tickets,0)
  await refuses(()=>claim(),'cooldown')
  await auth(bob);await refuses(()=>claim(receipt,'UTC',alice),'session_changed')
  const partner=await claim(receipt,'UTC',bob)
  assert.equal(partner.user_id,bob);assert.equal(partner.coins,1250,'The partner has an independent daily gift')
  checks++

  await reset();await force('fortune_dust_40')
  await db.query('delete from public.user_gacha_state where user_id=$1',[alice])
  row=await claim();assert.equal(row.stardust,40);assert.equal(row.gacha_tickets,0);assert.equal(row.coins,1000);checks++
  for(const zone of ['Pacific/Kiritimati','America/Los_Angeles','Europe/Budapest']){
    await reset();await force('fortune_coins_10')
    await db.query("update public.user_gacha_state set last_free_fortune=((clock_timestamp() at time zone $2)::date)::timestamp at time zone $2 where user_id=$1",[alice,zone])
    await refuses(()=>claim(randomUUID(),zone),'cooldown')
    await db.query("update public.user_gacha_state set last_free_fortune=(((clock_timestamp() at time zone $2)::date-1)::timestamp+interval '23 hour 59 minute') at time zone $2 where user_id=$1",[alice,zone])
    assert.equal((await claim(randomUUID(),zone)).ok,true,'Calendar day, not a 24-hour timer: '+zone)
    checks++
  }
  for(const [table,gift] of [['public.profiles','fortune_coins_250'],['public.user_gacha_state','fortune_coins_250'],['public.user_inventory','fortune_golden_bell'],['eren_private.economy_receipts','fortune_coins_250']]){
    await reset();await force(gift);const before=await snapshot()
    await db.exec(`create function public.fail_fortune_test() returns trigger language plpgsql as $$ begin raise exception 'injected fortune failure';end $$;
      create trigger fail_fortune_test before insert or update on ${table} for each row execute function public.fail_fortune_test();`)
    // A subtransaction permits testing rollback while the helper override is active.
    await db.exec('savepoint failure_test')
    await assert.rejects(()=>claim(),/injected fortune failure/)
    await db.exec('rollback to savepoint failure_test')
    await db.exec(`drop trigger fail_fortune_test on ${table};drop function public.fail_fortune_test();`)
    assert.deepEqual(await snapshot(),before,table+' must roll back cooldown and reward together');checks++
  }
  await db.exec('rollback')
  await reset()
  const real=await claim()
  assert.ok(catalog.gifts.some(g=>g.id===real.gift_id));assert.equal((await claim()).reason,'cooldown');checks++
  assert.equal((await one("select has_function_privilege('anon','public.claim_fortune_atomic(uuid,uuid,text)','execute') as yes")).yes,false)
  assert.equal((await one("select has_function_privilege('authenticated','public.claim_fortune_atomic(uuid,uuid,text)','execute') as yes")).yes,true)
  assert.equal((await one("select has_function_privilege('authenticated','eren_private.roll_fortune(double precision,double precision)','execute') as yes")).yes,false)
  assert.equal((await one("select has_schema_privilege('authenticated','eren_private','usage') as yes")).yes,false)
  await db.exec('set role authenticated');await auth(bob);assert.equal((await claim(randomUUID(),'UTC',bob)).ok,true);await db.exec('reset role');checks++
  console.log(`Fortune SQL: ${checks} scenarios passed; 18 gifts, draw parity, cooldowns, replay, rollback and permissions`)
}
main().catch(error=>{console.error(error.message,error.where??'');process.exitCode=1}).finally(()=>db.close())
