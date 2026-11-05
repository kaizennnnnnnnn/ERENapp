// Disposable PostgreSQL only; never connects to the hosted project.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { PGlite } = require('@electric-sql/pglite')
const load = require('./lib/load_ts.cjs')()
const catalog = require('./build_reward_catalog.cjs')()
const { updateStreak } = load('src/lib/achievements.ts')
const { batchFor } = load('src/lib/rewardClaim.ts')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const migration = read('supabase/migration_reward_reliability.sql')
const db = new PGlite()
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const home = '00000000-0000-4000-8000-000000000010'
let day, checks = 0
async function one(sql, args = []) { return (await db.query(sql, args)).rows[0] }
async function auth(id = alice) { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]) }
async function claim(kind, input, id = randomUUID()) {
  return (await one('select public.claim_reward_atomic($1,$2,$3) as r', [id, kind, JSON.stringify(input)])).r
}
const dated = extra => ({ day, timeZone: 'UTC', ...extra })
const task = (taskId, id) => claim('task', dated({ taskId }), id)
async function profile() { return one('select * from public.profiles where id=$1', [alice]) }
async function reset() {
  await auth()
  await db.exec(`delete from eren_private.economy_receipts; delete from public.user_task_completions;
    delete from public.game_scores; delete from public.daily_moods; delete from public.daily_battle_results;
    delete from public.user_inventory; delete from public.user_gacha_state;
    update public.profiles set coins=1000,xp=0,level=1,claimed_level=0,achievements='{}',streak='{"current":0,"best":0,"lastDate":null}';
    update public.eren_stats set food_by_user='{}',hunger=50,happiness=50,energy=50,sleep_quality=50,cleanliness=50;`)
}
async function snapshot() {
  const result = {}
  for (const { schemaname, tablename } of (await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows) {
    result[schemaname + '.' + tablename] = (await db.query(`select to_jsonb(t) as row from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows
  }
  return result
}
async function refuses(call, reason) {
  const before = await snapshot()
  const result = await call()
  assert.equal(result.ok, false); assert.equal(result.reason, reason)
  assert.deepEqual(await snapshot(), before)
  checks++
}
async function main() {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; create publication supabase_realtime;`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";', ''))
  for (const file of ['migration_v2.sql','migration_v3.sql','migration_sleeping.sql',
    'migration_gacha_couple_fortune.sql','migration_user_food_and_gifts.sql',
    'migration_donut_machine.sql','migration_donut_case_and_menu.sql','migration_donut_effects.sql',
    'migration_interactions_useful.sql','migration_battle_results.sql','migration_trophy_battle.sql',
    'migration_streaks_achievements.sql','migration_level_rewards.sql','migration_purr_beat.sql','migration_economy_reliability.sql']) {
    await db.exec(read('supabase/' + file))
  }
  // This older table predates the checked-in migrations. Definition verified
  // read-only against the hosted catalog; no player data is copied here.
  await db.exec(`create table public.user_task_completions (
    id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
    task_id text not null,period_key text not null,coins_earned integer default 0,xp_earned integer default 0,
    completed_at timestamptz default now(),unique(user_id,task_id,period_key));`)
  await db.exec(migration)
  assert.deepEqual(JSON.parse(migration.match(/\$reward_catalog\$([\s\S]*?)\$reward_catalog\$/)[1]), JSON.parse(JSON.stringify(catalog)))
  await db.query('insert into public.households(id) values($1)', [home])
  await db.query('insert into auth.users(id,email) values($1,$3),($2,$4)', [alice,bob,'a@test.invalid','b@test.invalid'])
  await db.query('update public.profiles set household_id=$1', [home])
  await db.query('insert into public.eren_stats(household_id) values($1)', [home])
  day = (await one("select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') as d")).d
  await reset()
  const installed = await snapshot()
  await db.exec(migration)
  assert.deepEqual(await snapshot(), installed, 'Rerun preserves all game state')
  checks++

  await refuses(() => claim('wallet',{ amount:-1001 }), 'insufficient')
  await refuses(() => claim('wallet',{ amount:1.5 }), 'bad_request')
  await refuses(() => task('not_a_quest'), 'bad_task')
  await refuses(() => task('weekly_all_care'), 'not_eligible')
  await refuses(() => claim('task',{day:'2000-01-01',timeZone:'UTC',taskId:'daily_feed'}), 'period_changed')
  await refuses(() => claim('task',{day,timeZone:'Not/AZone',taskId:'daily_feed'}), 'bad_request')
  await refuses(() => claim('road',{target:2,householdId:home}), 'not_eligible')
  await refuses(() => claim('road',{target:1,householdId:bob}), 'household_changed')
  await auth(''); await refuses(() => task('daily_feed'), 'unauthenticated'); await auth()

  const receipt = randomUUID()
  let result = await claim('wallet',{amount:30},receipt)
  assert.equal(result.profile.coins,1030)
  await claim('wallet',{amount:30})
  result = await claim('wallet',{amount:30},receipt)
  assert.equal(result.profile.coins,1060, 'Replay exposes latest balance, not historical balance')
  await refuses(() => claim('wallet',{amount:40},receipt),'request_mismatch')
  checks++

  await reset()
  result = await task('daily_feed',receipt)
  assert.equal(result.ok,true)
  assert.equal(result.profile.coins,1035, 'Quest and first-care achievement paid together')
  assert.equal(result.profile.xp,20)
  assert.deepEqual(result.outcome.achievements,['first_care'])
  const first = result
  result = await task('daily_feed',receipt)
  assert.deepEqual(result,first)
  result = await task('daily_feed')
  assert.equal(result.profile.coins,1035); assert.deepEqual(result.outcome.tasks,[])
  for (const id of ['daily_play','daily_sleep']) await task(id)
  result = await task('daily_wash')
  assert.deepEqual(result.outcome.tasks.map(t=>t.id),['daily_wash','weekly_all_care'])
  assert.ok(result.outcome.achievements.includes('all_care_day'))
  assert.equal(result.profile.coins,1220); assert.equal(result.profile.xp,180); assert.equal(result.profile.level,2)
  await task('daily_wash'); assert.equal((await profile()).coins,1220)
  checks++

  // SQL streak behavior is tied to the original pure client function, including
  // same-day calls, freeze regeneration, breaks and all milestone boundaries.
  for (const current of [0,1,6,13,29,59,99,100]) for (const gap of [0,1,2,3,20]) for (const tokens of [0,1,2]) {
    const date = new Date(day+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()-gap)
    const state = {current,best:Math.max(current,50),lastDate:date.toISOString().slice(0,10),freezeTokens:tokens,lastFreezeEarnedAt:'2026-01-01'}
    const expected = updateStreak(state,day)
    const actual = (await one('select eren_private.reward_streak($1,$2) as s',[JSON.stringify(state),day])).s
    assert.deepEqual(actual.streak,JSON.parse(JSON.stringify(expected.streak)),JSON.stringify(state))
    assert.equal(actual.milestoneCoins,expected.milestonesHit.reduce((sum,m)=>sum+catalog.milestones[m],0))
    assert.deepEqual(actual.milestones,expected.milestonesHit)
    assert.equal(actual.freezeUsed,expected.freezeUsed)
    checks++
  }

  await reset()
  await db.query("update public.profiles set streak=$2 where id=$1",[alice,JSON.stringify({current:1,best:20,lastDate:day,priorCurrent:19,brokenAt:day,freezeTokens:0})])
  result=await claim('repair',dated({}),receipt)
  assert.equal(result.profile.coins,500); assert.equal(result.profile.streak.current,20)
  assert.equal((await claim('repair',dated({}),receipt)).profile.coins,500)
  await refuses(()=>claim('repair',dated({})),'not_eligible')
  checks++

  // Achievement checks use saved facts and preserve the existing achievement map.
  await reset()
  await db.query("update public.profiles set level=50,achievements='{" + '"first_care":"old"' + "}' where id=$1",[alice])
  result=await claim('achievement',dated({trigger:'mount'}))
  assert.deepEqual(result.outcome.achievements,['level_10','level_25','level_50'])
  assert.equal(result.profile.coins,1450); assert.equal(result.profile.achievements.first_care,'old')
  assert.equal((await claim('achievement',dated({trigger:'mount'}))).profile.coins,1450)
  await db.query('insert into public.game_scores(user_id,game_type,score) values($1,$2,50)',[alice,catalog.gameIds[0]])
  result=await claim('achievement',dated({trigger:'game'}))
  assert.ok(result.outcome.achievements.includes('high_score_50'))
  assert.ok(!result.outcome.achievements.includes('all_games'))
  for (const game of catalog.gameIds.slice(1)) await db.query('insert into public.game_scores(user_id,game_type,score) values($1,$2,1)',[alice,game])
  assert.ok((await claim('achievement',dated({trigger:'mount'}))).outcome.achievements.includes('all_games'))
  checks++

  await reset()
  const yesterday=(await one("select ($1::date-1)::text as d",[day])).d
  await db.query('update public.profiles set streak=$2,xp=90 where id=$1',[alice,JSON.stringify({current:6,best:6,lastDate:yesterday,freezeTokens:1})])
  result=await task('daily_mood',receipt)
  assert.equal(result.profile.coins,1120, '20 quest + 50 milestone + 50 streak achievement')
  assert.equal(result.profile.streak.current,7);assert.equal(result.profile.level,2)
  assert.deepEqual(result.outcome.milestones,[7]);assert.ok(result.outcome.achievements.includes('streak_7'))
  assert.equal((await task('daily_game')).profile.streak.current,7,'A second daily quest cannot advance the streak')
  checks++

  await reset()
  for(const [taskId,count] of [['daily_mood',4],['daily_game',2]]) {
    // Stored completion fixtures within the current ISO week, excluding today.
    await db.query(`insert into public.user_task_completions(user_id,task_id,period_key)
      select $1,$2,'daily:'||d::text from
      (select date_trunc('week',$3::date)::date+i as d from generate_series(0,6) i) days
      where d<>$3::date order by d limit $4`,[alice,taskId,day,count])
    result=await task(taskId)
    assert.ok(result.outcome.tasks.some(t=>t.id===(taskId==='daily_mood'?'weekly_mood_5':'weekly_all_games')))
    checks++
  }

  await reset()
  await db.exec('update public.eren_stats set hunger=90,happiness=90,energy=90,sleep_quality=90,cleanliness=90')
  result=await task('daily_feed');assert.ok(result.outcome.achievements.includes('clean_sweep'))
  for(let i=1;i<=100;i++) await db.query("insert into public.user_task_completions(user_id,task_id,period_key) values($1,'daily_feed','daily:'||($2::date-$3::int)::text)",[alice,day,i])
  result=await claim('achievement',dated({trigger:'mount'}));assert.ok(result.outcome.achievements.includes('care_100'))
  for(let i=0;i<7;i++) await db.query("insert into public.daily_moods(user_id,date,mood) values($1,$2::date-$3::int,'good')",[alice,day,i])
  result=await claim('achievement',dated({trigger:'mood'}));assert.ok(result.outcome.achievements.includes('mood_7'))
  result=await task('daily_nudge');assert.ok(result.outcome.achievements.includes('first_nudge'))
  checks++

  // Every original pack, incremental claims and exact personal-fridge updates.
  await reset()
  await db.exec('update public.profiles set level=100')
  await db.query('update public.eren_stats set food_by_user=$1',[JSON.stringify({[bob]:{milk:7},[alice]:{milk:2}})])
  let paid=0, dust=0, tickets=0, foods={milk:2}
  for (let level=1;level<=100;level++) {
    const batch=batchFor(level,level)
    result=await claim('road',{target:level,householdId:home})
    assert.equal(result.ok,true,'Level '+level)
    const road=result.outcome.road
    assert.equal(road.from,level); assert.equal(road.to,level)
    assert.equal(road.coins,batch.coins); assert.equal(road.stardust,batch.stardust+road.boxDust)
    assert.equal(road.tickets,batch.tickets); assert.deepEqual(road.foods,batch.foods)
    assert.equal(road.skinIds.length+road.converted.length,batch.skinBoxes.length)
    for (const id of road.skinIds) assert.ok(catalog.skins.some(s=>s.id===id))
    paid+=batch.coins; dust+=road.stardust; tickets+=road.tickets
    for (const food of road.foods) foods[food]=(foods[food]??0)+1
    assert.equal(result.profile.coins,1000+paid); assert.equal(result.profile.claimed_level,level)
    checks++
  }
  const fridge=await one('select * from public.eren_stats where household_id=$1',[home])
  assert.deepEqual(fridge.food_by_user,{[bob]:{milk:7},[alice]:foods})
  const gacha=await one('select * from public.user_gacha_state where user_id=$1',[alice])
  assert.equal(gacha.stardust,dust); assert.equal(gacha.gacha_tickets,tickets)
  assert.equal((await claim('road',{target:100,householdId:home})).outcome.road,undefined)
  checks++

  await reset(); await db.exec('update public.profiles set level=100')
  for (const skin of catalog.skins) await db.query('insert into public.user_inventory(user_id,item_id) values($1,$2)',[bob,'skin_'+skin.id])
  result=await claim('road',{target:100,householdId:home},receipt)
  const full=batchFor(1,100)
  assert.equal(result.outcome.road.boxDust,full.skinBoxes.reduce((sum,r)=>sum+catalog.boxDust[r],0))
  assert.deepEqual(result.outcome.road.skinIds,[])
  await claim('wallet',{amount:9})
  const replay=await claim('road',{target:100,householdId:home},receipt)
  assert.deepEqual(replay.outcome,result.outcome); assert.equal(replay.profile.coins,result.profile.coins+9)
  checks++

  await reset();await db.exec('update public.profiles set level=100')
  await db.query('insert into public.user_gacha_state(user_id,stardust,gacha_tickets,pulls_since_epic,pulls_since_legendary,total_pulls) values($1,13,2,19,45,100)',[alice])
  result=await claim('road',{target:10,householdId:home})
  const preserved=await one('select * from public.user_gacha_state where user_id=$1',[alice])
  assert.equal(preserved.pulls_since_epic,19);assert.equal(preserved.pulls_since_legendary,45);assert.equal(preserved.total_pulls,100)
  assert.equal(preserved.stardust,63);assert.equal(preserved.gacha_tickets,6)
  await db.query('delete from public.eren_stats where household_id=$1',[home])
  await refuses(()=>claim('road',{target:20,householdId:home}),'no_fridge')
  await db.query('insert into public.eren_stats(household_id) values($1)',[home])
  checks++

  // Inject failures late in the transaction; no item, payout or mark may remain.
  for (const table of ['public.profiles','public.user_task_completions','public.eren_stats','public.user_inventory','public.user_gacha_state','eren_private.economy_receipts']) {
    await reset(); await db.exec('update public.profiles set level=100')
    const before=await snapshot()
    await db.exec(`create function public.fail_reward_test() returns trigger language plpgsql as $$ begin raise exception 'injected reward failure'; end $$;
      create trigger fail_reward_test before insert or update on ${table} for each row execute function public.fail_reward_test();`)
    await assert.rejects(()=>table.includes('task_completions')?task('daily_feed'):claim('road',{target:100,householdId:home}),/injected reward failure/)
    await db.exec(`drop trigger fail_reward_test on ${table}; drop function public.fail_reward_test();`)
    assert.deepEqual(await snapshot(),before,table+' rollback')
    checks++
  }
  for(const table of ['public.profiles','eren_private.economy_receipts']) {
    await reset();const before=await snapshot()
    await db.exec(`create function public.fail_reward_test() returns trigger language plpgsql as $$ begin raise exception 'injected reward failure'; end $$;
      create trigger fail_reward_test before insert or update on ${table} for each row execute function public.fail_reward_test();`)
    await assert.rejects(()=>task('daily_feed'),/injected reward failure/)
    await db.exec(`drop trigger fail_reward_test on ${table}; drop function public.fail_reward_test();`)
    assert.deepEqual(await snapshot(),before,'Quest completion + XP + achievement must roll back too')
    checks++
  }
  assert.equal((await one("select has_function_privilege('anon','public.claim_reward_atomic(uuid,text,jsonb)','execute') as yes")).yes,false)
  assert.equal((await one("select has_function_privilege('authenticated','public.claim_reward_atomic(uuid,text,jsonb)','execute') as yes")).yes,true)
  assert.equal((await one("select has_schema_privilege('authenticated','eren_private','usage') as yes")).yes,false)
  console.log(`Reward saves: ${checks} SQL scenarios passed (disposable database)`)
}
main().catch(error=>{console.error(error.message,error.where??'');process.exitCode=1}).finally(()=>db.close())
