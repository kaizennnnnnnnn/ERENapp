// Disposable PostgreSQL only. Run: node scripts/check_food_actions_sql.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')
const load = require('./lib/load_ts.cjs')()
const generatedCatalog = require('./build_food_action_catalog.cjs')()
const { FOOD_ORDER } = load('src/lib/foodMeta.ts')
const { DONUTS, MACHINE_DONUTS, TASTE_JOY } = load('src/lib/donuts.ts')
const { monstaBuff } = load('src/lib/monstaBuffs.ts')
const { DONUT_EFFECTS } = load('src/lib/donutEffects.ts')
const { DRINK_UNLOCK_SKINS } = load('src/lib/skins.ts')
const { clampStat, computeErenMood } = load('src/lib/utils.ts')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const migration = read('supabase/migration_food_actions.sql')
const catalogBlock = /\$food_action_catalog\$([\s\S]*?)\$food_action_catalog\$/
const embedded = JSON.parse(migration.match(catalogBlock)[1])
const rendered = migration.replace(catalogBlock, '$food_action_catalog$' + JSON.stringify(generatedCatalog) + '$food_action_catalog$')
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const outsider = '00000000-0000-4000-8000-000000000003'
const home = '00000000-0000-4000-8000-000000000010'
const otherHome = '00000000-0000-4000-8000-000000000020'
const db = new PGlite()
let checks = 0

// Execute the existing computeDecay function against the RPC's server timestamp.
const hook = ts.createSourceFile('useErenStats.ts', read('src/hooks/useErenStats.ts'), ts.ScriptTarget.Latest, true)
const decayNames = new Set(['DECAY_PER_HOUR', 'DECAY_CAP_HOURS'])
const decaySource = hook.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'computeDecay'
  || ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => decayNames.has(decl.name?.text)))
assert.equal(decaySource.length, 3, 'Keep the parity oracle tied to the existing client computeDecay')
const decayCode = ts.transpileModule(decaySource.map(node => node.getText(hook)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText
function decayed(stats, now) {
  class ServerDate extends Date { static now() { return new Date(now).getTime() } }
  return new Function('clampStat', 'Date', decayCode + '\nreturn computeDecay')(clampStat, ServerDate)(stats)
}
async function one(sql, args = []) { return (await db.query(sql, args)).rows[0] }
async function auth(id = alice) { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]) }
async function buy(key = 'kibble', source = 'kitchen', id = randomUUID(), household = home) {
  return (await one('select public.purchase_food_atomic($1,$2,$3,$4) as result', [id, household, key, source])).result
}
async function spin(free = false, id = randomUUID(), household = home) {
  return (await one('select public.spin_donut_atomic($1,$2,$3) as result', [id, household, free])).result
}
async function feed(key = 'kibble', id = randomUUID(), household = home) {
  return (await one('select public.feed_food_atomic($1,$2,$3) as result', [id, household, key])).result
}
async function stats() {
  const row = await one('select * from public.eren_stats where household_id=$1', [home])
  return { ...row, weight: Number(row.weight), cleanliness: Number(row.cleanliness) }
}
async function state() { return one('select to_jsonb(s) as data from public.user_gacha_state s where user_id=$1', [alice]) }
async function reset() {
  await auth()
  await db.exec(`delete from eren_private.economy_receipts; delete from public.interactions;
    delete from public.user_inventory; delete from public.gacha_pull_log; delete from public.user_gacha_state;
    delete from public.daily_battle_results; delete from public.trophy_effects;
    update public.profiles set coins=10000, trophies=0;
    update public.eren_stats set food_by_user='{}', food_inventory='{}', hunger=50, happiness=50,
      energy=50, sleep_quality=50, cleanliness=50, weight=4.5, is_sick=true, is_sleeping=false,
      mood='idle', last_decay_at=null, updated_at='2026-01-01Z', donuts_tasted='[]', donut_effect=null;`)
  await db.query('update public.profiles set household_id=case when id=$1 then $3::uuid else $2::uuid end', [outsider, home, otherHome])
}
async function stock(key, count = 2) {
  await db.query('update public.eren_stats set food_by_user=$2 where household_id=$1', [home, JSON.stringify({
    [alice]: { [key]: count }, [bob]: { milk: 4, [key]: 7 },
  })])
}
async function snapshot() {
  const result = {}
  const tables = (await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by schemaname,tablename")).rows
  for (const { schemaname, tablename } of tables) {
    result[schemaname + '.' + tablename] = (await db.query(`select to_jsonb(t) as row from "${schemaname}"."${tablename}" t order by to_jsonb(t)::text`)).rows
  }
  return result
}
async function refuses(call, reason) {
  const before = await snapshot()
  const result = await call()
  assert.equal(result.ok, false)
  assert.equal(result.reason, reason)
  assert.ok('household_id' in result && 'coins' in result && 'stats' in result && 'food_key' in result)
  assert.deepEqual(await snapshot(), before, `${reason} must preserve every application table`)
  checks++
  return result
}
function checkPatch(result, feeding = false) {
  const fields = ['food_by_user', 'food_inventory']
  if (feeding) fields.push('happiness', 'hunger', 'energy', 'sleep_quality', 'cleanliness', 'weight',
    'is_sick', 'mood', 'last_decay_at', 'updated_at', 'donuts_tasted', 'donut_effect')
  assert.deepEqual(Object.keys(result.stats).sort(), fields.sort(), 'Only the exact current stats patch may be exposed')
}
function oracle(before, row, now) {
  const base = { ...before, ...decayed(before, now) }
  const after = {
    hunger: Math.round(clampStat(base.hunger + row.hunger)),
    happiness: Math.round(clampStat(base.happiness + row.happiness)),
    energy: Math.round(clampStat(row.energy ?? base.energy)),
    sleep_quality: Math.round(clampStat(base.sleep_quality + row.sleep_quality)),
    cleanliness: Math.round(clampStat((base.cleanliness ?? 100) + row.cleanliness)),
    weight: Math.round(Math.max(2, Math.min(10, base.weight + row.weight)) * 100) / 100,
    is_sick: row.cure ? false : base.is_sick,
  }
  after.mood = computeErenMood(after)
  const interaction = {
    happiness_delta: Math.round(after.happiness - base.happiness), hunger_delta: Math.round(after.hunger - base.hunger),
    energy_delta: Math.round(after.energy - base.energy), sleep_delta: Math.round(after.sleep_quality - base.sleep_quality),
    weight_delta: Math.round((after.weight - base.weight) * 100) / 100,
    useful: base.hunger < 90 || row.energy != null && base.energy < 90,
  }
  return { after, interaction }
}
async function checkFeed(key, id = randomUUID()) {
  const before = await stats()
  const wallet = (await one('select coins from public.profiles where id=$1', [alice])).coins
  const row = generatedCatalog.find(food => food.food_key === key)
  const result = await feed(key, id)
  assert.equal(result.ok, true, key)
  assert.equal(result.food_key, key)
  assert.equal(result.household_id, home)
  checkPatch(result, true)
  const { after, interaction } = oracle(before, row, result.stats.updated_at)
  for (const [field, expected] of Object.entries(after)) assert.equal(Number.isFinite(expected) ? Number(result.stats[field]) : result.stats[field], expected, `${key}: ${field}`)
  const ledger = await one('select * from public.interactions where user_id=$1 order by created_at desc limit 1', [alice])
  for (const [field, expected] of Object.entries(interaction)) {
    assert.equal(typeof expected === 'number' ? Number(ledger[field]) : ledger[field], Object.is(expected, -0) ? 0 : expected, `${key}: interactions.${field}`)
  }
  assert.equal(ledger.user_id, alice)
  assert.equal(ledger.household_id, home)
  assert.equal(ledger.action_type, 'feed')
  assert.equal(new Date(ledger.created_at).getTime(), new Date(result.stats.updated_at).getTime())
  assert.equal(new Date(result.stats.last_decay_at).getTime(), new Date(result.stats.updated_at).getTime())
  assert.equal(result.coins, wallet + row.coins)
  if (row.donut) assert.ok(result.stats.donuts_tasted.includes(key))
  if (row.effect) {
    assert.equal(result.stats.donut_effect.id, row.effect)
    assert.equal(new Date(result.stats.donut_effect.until) - new Date(result.stats.updated_at), row.effect_ms)
  } else assert.deepEqual(result.stats.donut_effect, before.donut_effect)
  checks++
  return result
}
async function failAt(table, call, setup = async () => {}) {
  await reset()
  await setup()
  const before = await snapshot()
  await db.exec(`create or replace function public.test_food_failure() returns trigger language plpgsql as $$
    begin raise exception 'injected food save failure'; end; $$;
    create trigger injected_food_failure before insert or update on ${table}
    for each row execute function public.test_food_failure();`)
  try {
    await assert.rejects(call, /injected food save failure/)
    assert.deepEqual(await snapshot(), before, `${table}: all preceding effects must roll back`)
  } finally { await db.exec(`drop trigger injected_food_failure on ${table}`) }
  checks++
}

async function setup() {
  await assert.rejects(() => db.exec(rendered), /Food actions require existing migrations; missing:/)
  await db.exec('rollback')
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    create publication supabase_realtime;`)
  // PGlite has core gen_random_uuid(), but does not ship the pgcrypto extension.
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";', ''))
  for (const file of ['migration_v2.sql', 'migration_v3.sql', 'migration_sleeping.sql',
    'migration_gacha_couple_fortune.sql', 'migration_user_food_and_gifts.sql',
    'migration_donut_machine.sql', 'migration_donut_case_and_menu.sql', 'migration_donut_effects.sql',
    'migration_interactions_useful.sql', 'migration_battle_results.sql', 'migration_trophy_battle.sql',
    'migration_economy_reliability.sql']) await db.exec(read('supabase/' + file))
  await db.query('insert into public.households(id) values ($1),($2)', [home, otherHome])
  await db.query('insert into auth.users(id,email) values ($1,$4),($2,$5),($3,$6)', [alice, bob, outsider, 'alice@test.invalid', 'bob@test.invalid', 'other@test.invalid'])
  await db.query('insert into public.eren_stats(household_id) values ($1),($2)', [home, otherHome])
  const before = await snapshot()
  const empty = migration.replace(catalogBlock, '$food_action_catalog$[]$food_action_catalog$')
  await assert.rejects(() => db.exec(empty), /Food action catalog incomplete/)
  await db.exec('rollback')
  assert.deepEqual(await snapshot(), before, 'Unpopulated catalogue must fail transactionally')
  await db.exec(rendered)
  await reset()
  const installed = await snapshot()
  await db.exec(rendered)
  assert.deepEqual(await snapshot(), installed, 'Rerunning migration must not reset any game state')
  assert.equal(generatedCatalog.length, 89)
  assert.deepEqual(new Set(generatedCatalog.map(row => row.food_key)), new Set(FOOD_ORDER))
  if (embedded.length) assert.deepEqual(embedded, generatedCatalog, 'Generated SQL catalogue is stale')
  const stored = (await db.query('select * from eren_private.food_action_catalog order by food_key')).rows
  for (const row of generatedCatalog) {
    const actual = stored.find(food => food.food_key === row.food_key)
    for (const [field, expected] of Object.entries(row)) assert.equal(typeof expected === 'number' ? Number(actual[field]) : actual[field], expected, `${row.food_key}: catalogue ${field}`)
    const donut = DONUTS.find(food => food.id === row.food_key)
    const perk = monstaBuff(row.food_key) ?? donut?.perk
    assert.equal(row.energy, perk?.energy ?? null)
    assert.equal(row.coins, perk?.coins ?? 0)
    assert.equal(row.skin, DRINK_UNLOCK_SKINS[row.food_key] ?? null)
    if (donut) {
      assert.equal(row.happiness, Math.round(donut.happyD * TASTE_JOY[donut.taste]) + (donut.perk.happiness ?? 0))
      assert.equal(row.machine, MACHINE_DONUTS.some(food => food.id === row.food_key))
      assert.equal(row.effect_ms, donut.effect ? DONUT_EFFECTS[donut.effect].ms : null)
    }
  }
  checks += 4
}

async function catalogAndFeeding() {
  for (const row of generatedCatalog) {
    await reset()
    for (const source of ['kitchen', 'bakery']) {
      if (!row[source]) await refuses(() => buy(row.food_key, source), 'not_for_sale')
      else {
        const wallet = (await one('select coins from public.profiles where id=$1', [alice])).coins
        const result = await buy(row.food_key, source)
        assert.equal(result.ok, true)
        assert.equal(result.coins, wallet - row.price)
        checkPatch(result)
        checks++
      }
    }
    await stock(row.food_key)
    const id = randomUUID()
    const result = await checkFeed(row.food_key, id)
    assert.equal(result.stats.food_by_user[alice][row.food_key], 1)
    assert.equal(result.stats.food_by_user[bob][row.food_key], 7)
    assert.equal(result.new_skin, row.skin)
    const saved = await snapshot()
    assert.deepEqual(await feed(row.food_key, id), result, `${row.food_key}: identical retry result`)
    assert.deepEqual(await snapshot(), saved, `${row.food_key}: replay must not consume, pay, taste, log or extend effects`)
    if (row.skin || row.donut) {
      const twice = await checkFeed(row.food_key)
      assert.equal(twice.new_skin, null)
      if (row.donut) assert.equal(twice.stats.donuts_tasted.filter(key => key === row.food_key).length, 1)
      if (row.skin) assert.equal((await one('select quantity from public.user_inventory where user_id=$1 and item_id=$2', [alice, 'skin_' + row.skin])).quantity, 1)
    }
  }
}

async function replayAndIntent() {
  await reset()
  const id = randomUUID()
  const first = await buy('kibble', 'kitchen', id)
  assert.deepEqual(await buy('kibble', 'kitchen', id), first)
  await refuses(() => buy('milk', 'kitchen', id), 'request_mismatch')
  await refuses(() => buy('kibble', 'bakery', id), 'request_mismatch')
  await refuses(() => feed('kibble', id), 'request_mismatch')
  await refuses(() => spin(false, id), 'request_mismatch')
  await db.query('update public.profiles set coins=1234 where id=$1', [alice])
  await stock('milk', 8)
  const saved = await snapshot()
  const replay = await buy('kibble', 'kitchen', id)
  assert.equal(replay.food_key, 'kibble')
  assert.equal(replay.coins, 1234)
  assert.deepEqual(replay.stats.food_by_user, (await stats()).food_by_user)
  assert.deepEqual(await snapshot(), saved)
  await auth(bob)
  assert.equal((await buy('kibble', 'kitchen', id)).ok, true, 'Request IDs are scoped to users')
  await auth(outsider)
  await refuses(() => buy('kibble', 'kitchen', id), 'household_changed')
  assert.equal((await buy('kibble', 'kitchen', id, otherHome)).ok, true)
  await auth()
  const pending = randomUUID()
  await db.query('update public.profiles set household_id=$2 where id=$1', [alice, otherHome])
  for (const request of [id, pending]) {
    await refuses(() => buy('kibble', 'kitchen', request), 'household_changed')
    await refuses(() => feed('kibble', request), 'household_changed')
    await refuses(() => spin(false, request), 'household_changed')
  }
  await refuses(() => buy('kibble', 'kitchen', id, otherHome), 'request_mismatch')

  await reset()
  const gachaId = randomUUID()
  await one('select public.pull_gacha_atomic($1,$2,$3,$4)', [gachaId, 'food', 1, false])
  await refuses(() => buy('kibble', 'kitchen', gachaId), 'request_mismatch')
  await refuses(() => spin(false, gachaId), 'request_mismatch')
  await refuses(() => feed('kibble', gachaId), 'request_mismatch')
  const fridgeId = randomUUID()
  await one('select public.mutate_fridge_atomic($1,$2,$3,$4)', [fridgeId, 'add', '["milk"]', null])
  await refuses(() => feed('milk', fridgeId), 'request_mismatch')

  await reset()
  await stock('monsta_rainbow')
  const feedId = randomUUID()
  const fed = await checkFeed('monsta_rainbow', feedId)
  await stock('milk', 3)
  await feed('milk')
  await db.query('update public.profiles set coins=321 where id=$1', [alice])
  const current = await stats()
  const after = await snapshot()
  const fedAgain = await feed('monsta_rainbow', feedId)
  assert.equal(fedAgain.new_skin, fed.new_skin)
  assert.equal(fedAgain.new_skin, 'rainbow')
  assert.equal(fedAgain.coins, 321)
  for (const [field, value] of Object.entries(fedAgain.stats)) {
    if (field === 'updated_at' || field === 'last_decay_at') assert.equal(new Date(value).getTime(), new Date(current[field]).getTime())
    else assert.deepEqual(value, current[field], `replay ${field}`)
  }
  assert.deepEqual(await snapshot(), after)
  checks += 4
}

async function rejectionsAndLegacy() {
  await reset()
  await auth('')
  for (const call of [() => buy(), () => spin(), () => feed()]) await refuses(call, 'unauthenticated')
  await auth(randomUUID())
  await refuses(() => buy(), 'no_profile')
  await auth()
  for (const call of [() => buy('milk', 'other'), () => buy(null), () => spin(null),
    () => feed(null), () => buy('milk', null), () => feed('milk', null), () => spin(false, null),
    () => buy('milk', 'kitchen', randomUUID(), null)]) await refuses(call, 'bad_request')
  await refuses(() => buy('not_food'), 'bad_food')
  await refuses(() => feed('not_food'), 'bad_food')
  await refuses(() => feed(), 'out_of_stock')
  await db.query('update public.profiles set coins=5 where id=$1', [alice])
  assert.equal((await buy()).coins, 0)
  await refuses(() => buy(), 'insufficient')
  await db.exec('update public.eren_stats set is_sleeping=true')
  await refuses(() => feed(), 'sleeping')
  await db.exec('update public.eren_stats set is_sleeping=false')
  await checkFeed('kibble')
  await db.query('update public.profiles set household_id=null where id=$1', [alice])
  await refuses(() => spin(), 'no_household')
  await reset()
  await db.query('delete from public.eren_stats where household_id=$1', [home])
  for (const call of [() => buy(), () => spin(), () => feed()]) await refuses(call, 'no_fridge')
  await db.query('insert into public.eren_stats(household_id) values ($1)', [home])
  await reset()
  await stock('fish', 1)
  await db.query('update public.eren_stats set food_inventory=$2 where household_id=$1', [home, JSON.stringify({ fish: 2, sushi: 1, milk: 4 })])
  let result = await checkFeed('fish')
  assert.equal(result.stats.food_inventory.fish, 2, 'Personal stock is consumed before legacy stock')
  result = await checkFeed('fish')
  assert.equal(result.stats.food_inventory.fish, 1)
  assert.equal(result.stats.food_inventory.milk, 4)
  assert.equal(result.stats.food_by_user[bob].fish, 7)
  await checkFeed('sushi')
  await checkFeed('fish')
  await refuses(() => feed('fish'), 'out_of_stock')
}

async function decayAndPerks() {
  for (const { key, age, hunger = 85, energy = 85, weight = 4.5, sick = true } of [
    { key: 'kibble', age: 0.5 }, { key: 'monsta_rainbow', age: 2 },
    { key: 'milk', age: 96 }, { key: 'donut_matcha', age: 1.25 },
    { key: 'milk', age: -3 }, { key: 'milk', age: null },
    { key: 'monsta_white', age: null, weight: 2 }, { key: 'steak', age: null, weight: 10 },
    { key: 'monsta_gold', age: null, hunger: 100, energy: 89 },
    { key: 'monsta_gold', age: null, hunger: 100, energy: 90 },
    { key: 'donut', age: null, hunger: 100, energy: 10 },
    { key: 'kibble', age: null, hunger: 90 }, { key: 'kibble', age: null, hunger: 89 },
    { key: 'donut_lattice', age: null, sick: true },
  ]) {
    await reset()
    await stock(key)
    await db.query(`update public.eren_stats set hunger=$2,energy=$3,weight=$4,is_sick=$5,
      last_decay_at=case when $6::numeric is null then null else clock_timestamp()-$6::numeric*interval '1 hour' end
      where household_id=$1`, [home, hunger, energy, weight, sick, age])
    await checkFeed(key)
  }
  // Preserve a previous effect when the next meal has no visible effect.
  await reset()
  await stock('donut_neon')
  await checkFeed('donut_neon')
  await stock('milk')
  await checkFeed('milk')
  await stock('donut_tiger')
  await checkFeed('donut_tiger')
  assert.equal((await stats()).donut_effect.id, 'zoomies')
  // Feed does not add sickness or lose weight through the cron's separate rules.
  await reset()
  await stock('milk')
  await db.query(`update public.eren_stats set happiness=1,hunger=1,energy=1,sleep_quality=1,
    cleanliness=1,weight=9,is_sick=false,last_decay_at=clock_timestamp()-interval '3 hours' where household_id=$1`, [home])
  const poor = await checkFeed('milk')
  assert.equal(poor.stats.is_sick, false)
  assert.equal(Number(poor.stats.weight), 9.02)
}

async function spinning() {
  await reset()
  await db.query(`insert into public.user_gacha_state(user_id,stardust,pulls_since_epic,pulls_since_legendary,
    total_pulls,gacha_tickets,last_free_fortune) values ($1,73,23,77,88,4,'2026-01-02Z')`, [alice])
  await db.query('update public.profiles set coins=0 where id=$1', [alice])
  const initial = await state()
  const id = randomUUID()
  const first = await spin(false, id)
  assert.equal(first.ok, true)
  assert.equal(first.was_free, true, 'Paid intent must still use an available free spin first')
  assert.equal(first.coins, 0)
  assert.ok(MACHINE_DONUTS.some(food => food.id === first.food_key))
  assert.equal(first.stats.food_by_user[alice][first.food_key], 1)
  checkPatch(first)
  assert.deepEqual((await state()).data, { ...initial.data, last_free_donut: first.last_free_donut })
  const after = await snapshot()
  assert.deepEqual(await spin(false, id), first)
  assert.deepEqual(await snapshot(), after)
  await refuses(() => spin(true, id), 'request_mismatch')
  await refuses(() => spin(true), 'cooldown')
  await refuses(() => spin(false), 'insufficient')
  await db.query('update public.profiles set coins=100 where id=$1', [alice])
  const stamped = await state()
  const paid = await spin(false)
  assert.equal(paid.was_free, false)
  assert.equal(paid.coins, 50)
  assert.deepEqual(await state(), stamped, 'Paid spins must leave all gacha state untouched')
  assert.equal((await spin(false, id)).coins, 50, 'Replay returns current wallet')
  await db.query("update public.user_gacha_state set last_free_donut=clock_timestamp()-interval '23 hours 59 minutes' where user_id=$1", [alice])
  await refuses(() => spin(true), 'cooldown')
  await db.query("update public.user_gacha_state set last_free_donut=clock_timestamp()-interval '24 hours' where user_id=$1", [alice])
  assert.equal((await spin(true)).was_free, true)
  const currentStamp = (await state()).data.last_free_donut
  const replay = await spin(false, id)
  assert.equal(replay.food_key, first.food_key)
  assert.equal(replay.was_free, true)
  assert.equal(replay.last_free_donut, currentStamp, 'Replay returns current cooldown, never the old receipt stamp')
  assert.deepEqual(replay.stats.food_by_user, (await stats()).food_by_user)
  await db.query("update public.user_gacha_state set last_free_donut=clock_timestamp()+interval '2 hours' where user_id=$1", [alice])
  await refuses(() => spin(true), 'cooldown')
  await auth(bob)
  const partner = await spin(true, id)
  assert.equal(partner.was_free, true, 'Partners have independent cooldowns and receipts')
  assert.equal(partner.coins, 10000)
  await auth()
  checks += 8

  await reset()
  await db.query('update public.profiles set coins=100000 where id=$1', [alice])
  await db.exec('select setseed(0.2718)')
  const counts = new Map(MACHINE_DONUTS.map(food => [food.id, 0]))
  for (let n = 0; n < 480; n++) {
    const result = await spin(false)
    assert.equal(result.ok, true)
    assert.ok(counts.has(result.food_key), 'Only machine=true foods can be rolled')
    counts.set(result.food_key, counts.get(result.food_key) + 1)
  }
  assert.ok([...counts.values()].every(count => count > 0 && count < 50), 'Seeded uniform pool should reach every machine donut without rarity weights')
  assert.equal((await one('select coins from public.profiles where id=$1', [alice])).coins, 100000 - 479 * 50)
  const before = await snapshot()
  await db.exec(read('supabase/migration_economy_reliability.sql'))
  assert.deepEqual(await snapshot(), before, 'The economy migration must remain rerunnable after food actions are installed')
  await db.exec(rendered)
  assert.deepEqual(await snapshot(), before, 'Migration rerun preserves actual purchases, stamps and receipts')
  checks++
}

async function rollbacks() {
  for (const table of ['public.profiles', 'public.eren_stats', 'eren_private.economy_receipts']) await failAt(table, () => buy())
  const paid = async () => { await db.query("insert into public.user_gacha_state(user_id,last_free_donut) values ($1,now())", [alice]) }
  for (const table of ['public.profiles', 'public.eren_stats', 'eren_private.economy_receipts']) await failAt(table, () => spin(false), paid)
  // Both lazy state creation and stamping an existing row are transactional.
  await failAt('public.user_gacha_state', () => spin(true))
  await failAt('public.user_gacha_state', () => spin(true), async () => {
    await db.query('insert into public.user_gacha_state(user_id) values ($1)', [alice])
  })
  await failAt('public.eren_stats', () => spin(true))
  await failAt('eren_private.economy_receipts', () => spin(true))
  for (const table of ['public.profiles', 'public.eren_stats', 'public.user_inventory', 'public.interactions', 'eren_private.economy_receipts']) {
    await failAt(table, () => feed('monsta_rainbow'), () => stock('monsta_rainbow'))
  }
}

async function battleAndPermissions() {
  await reset()
  await stock('kibble')
  await db.exec('update public.eren_stats set hunger=89')
  await feed('kibble')
  await feed('kibble')
  const day = await one("select (current_date-1)::text as day, (current_date-1)::timestamptz as start, current_date::timestamptz as finish, public.eren_twist_for_date(current_date-1) as twist")
  await db.query("update public.interactions set created_at=$1::timestamptz+interval '1 hour'", [day.start])
  const battle = (await one('select public.settle_daily_battle($1,$2,$3) as result', [day.day, day.start, day.finish])).result
  const points = { feast: 3, double: 2, full_house: 4, sprint: 3 }
  assert.equal(battle.score, points[day.twist] ?? 1, 'Production battle scoring sees exactly the useful feed')
  const battleRow = await one('select * from public.daily_battle_results where user_id=$1', [alice])
  await db.query('update public.daily_battle_results set score=999,trophy_claimed=false where user_id=$1', [alice])
  assert.deepEqual(await one('select * from public.daily_battle_results where user_id=$1', [alice]), battleRow, 'Production battle guard stays active')
  const signatures = ['purchase_food_atomic(uuid,uuid,text,text)', 'feed_food_atomic(uuid,uuid,text)', 'spin_donut_atomic(uuid,uuid,boolean)']
  for (const signature of signatures) {
    const grants = await one(`select has_function_privilege('anon',$1,'execute') as anon,
      has_function_privilege('authenticated',$1,'execute') as authenticated,
      p.prosecdef as definer,p.proconfig as config from pg_proc p where p.oid=$1::regprocedure`, ['public.' + signature])
    assert.equal(grants.anon, false)
    assert.equal(grants.authenticated, true)
    assert.equal(grants.definer, true)
    assert.ok(grants.config.includes('search_path=""'))
  }
  const privateGrants = await one(`select has_schema_privilege('authenticated','eren_private','usage') as auth_schema,
    has_schema_privilege('anon','eren_private','usage') as anon_schema,
    has_table_privilege('authenticated','eren_private.food_action_catalog','select,insert,update,delete') as catalog,
    has_table_privilege('authenticated','eren_private.economy_receipts','select,insert,update,delete') as receipts,
    has_function_privilege('authenticated','eren_private.food_action_atomic(text,uuid,uuid,text,text,boolean)','execute') as helper,
    (select relrowsecurity from pg_class where oid='eren_private.food_action_catalog'::regclass) as rls`)
  assert.deepEqual(privateGrants, { auth_schema: false, anon_schema: false, catalog: false, receipts: false, helper: false, rls: true })
  await db.exec('set role authenticated')
  try {
    assert.equal((await buy()).ok, true, 'The authenticated role can call the actual security-definer API')
    assert.equal((await feed()).ok, true)
    assert.equal((await spin()).ok, true)
    await assert.rejects(() => db.query('select * from eren_private.food_action_catalog'), /permission denied/)
    await assert.rejects(() => db.query('select * from eren_private.economy_receipts'), /permission denied/)
    await assert.rejects(() => db.query("select eren_private.food_action_atomic('feed_food',null,null,null,null,null)"), /permission denied/)
  } finally { await db.exec('reset role') }
  await db.exec('set role anon')
  try {
    for (const call of [() => buy(), () => feed(), () => spin()]) await assert.rejects(call, /permission denied/)
  } finally { await db.exec('reset role') }
  checks += 6
}

async function main() {
  await setup()
  await catalogAndFeeding()
  await replayAndIntent()
  await rejectionsAndLegacy()
  await decayAndPerks()
  await spinning()
  await rollbacks()
  await battleAndPermissions()
  console.log(`Food SQL checks passed: ${checks} scenarios; 89-food parity, 480 seeded spins, production schema/battle guards, current-state replay, household intent, full-table rollback snapshots and role permissions.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.close())
