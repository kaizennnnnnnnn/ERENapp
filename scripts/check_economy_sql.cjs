// Runs the actual migration and RPCs in disposable, in-memory PostgreSQL.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { PGlite } = require('@electric-sql/pglite')
const load = require('./lib/load_ts.cjs')()
const { GACHA_ITEMS, GACHA_BANNERS, GACHA_FOOD_GRANT, DUPLICATE_STARDUST } = load('src/lib/gacha.ts')
const root = path.resolve(__dirname, '..')
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const outsider = '00000000-0000-4000-8000-000000000003'
const home = '00000000-0000-4000-8000-000000000010'
const otherHome = '00000000-0000-4000-8000-000000000020'
const db = new PGlite()
let checks = 0
async function one(sql, args = []) { return (await db.query(sql, args)).rows[0] }
async function pull(banner = 'food', count = 1, ticket = false, id = randomUUID()) {
  return (await one('select public.pull_gacha_atomic($1,$2,$3,$4) as result', [id, banner, count, ticket])).result
}
async function food(action, keys, recipient = null, id = randomUUID()) {
  return (await one('select public.mutate_fridge_atomic($1,$2,$3,$4) as result', [id, action, JSON.stringify(keys), recipient])).result
}
async function auth(id = alice) { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]) }
async function reset() {
  await auth()
  await db.exec(`delete from eren_private.economy_receipts; delete from public.user_inventory;
    delete from public.gacha_pull_log; delete from public.user_gacha_state;
    update public.profiles set coins=10000;
    update public.eren_stats set food_by_user='{}', food_inventory='{}';`)
  await db.query('insert into public.user_gacha_state(user_id) values ($1)', [alice])
}
async function snapshot() {
  const result = {}
  for (const table of ['profiles', 'user_gacha_state', 'user_inventory', 'gacha_pull_log', 'eren_stats', 'eren_private.economy_receipts']) {
    const qualified = table.includes('.') ? table : 'public.' + table
    result[table] = (await db.query(`select to_jsonb(t) as row from ${qualified} t order by to_jsonb(t)::text`)).rows
  }
  return result
}
async function failAt(table, count = 1) {
  await reset()
  const before = await snapshot()
  // A trigger throws only inside the actual RPC, after earlier writes ran.
  await db.exec(`create or replace function public.test_fail() returns trigger language plpgsql as $$
    begin raise exception 'injected save failure'; end; $$;
    create trigger injected_failure before insert or update on ${table}
    for each row execute function public.test_fail();`)
  await assert.rejects(() => pull('food', count), /injected save failure/)
  assert.deepEqual(await snapshot(), before, `${table} failure must roll back the entire purchase`)
  await db.exec(`drop trigger injected_failure on ${table}`)
  checks++
}
async function main() {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key, household_id uuid, coins integer);
    create table public.eren_stats(household_id uuid primary key, food_by_user jsonb not null default '{}', food_inventory jsonb not null default '{}');`)
  const old = fs.readFileSync(path.join(root, 'supabase/migration_gacha_couple_fortune.sql'), 'utf8')
  await db.exec(old.slice(0, old.indexOf('-- 4. COUPLE JOURNAL')))
  await db.query('insert into public.profiles values ($1,$4,10000),($2,$4,10000),($3,$5,10000)', [alice, bob, outsider, home, otherHome])
  await db.query('insert into public.eren_stats(household_id) values ($1),($2)', [home, otherHome])
  const migration = fs.readFileSync(path.join(root, 'supabase/migration_economy_reliability.sql'), 'utf8')
  await db.exec(migration)
  await db.exec(migration) // rerunning must preserve the schema and work
  await reset()

  for (const banner of GACHA_BANNERS) {
    const result = await pull(banner.id, 10)
    assert.equal(result.ok, true)
    assert.equal(result.results.length, 10)
    assert.notEqual(GACHA_ITEMS.find(i => i.id === result.results[9].itemId).rarity, 'common')
    for (const reward of result.results) {
      const item = GACHA_ITEMS.find(i => i.id === reward.itemId)
      assert.ok(item && !item.unlock)
      assert.ok(banner.categories.includes(item.category))
      if (banner.skinSet) assert.equal(item.skinSet, banner.skinSet)
    }
    checks++
  }
  assert.equal((await one('select coins from public.profiles where id=$1', [alice])).coins, 10000 - 450 * 4)

  await reset()
  const id = randomUUID()
  const first = await pull('food', 10, false, id)
  const after = await snapshot()
  const again = await pull('food', 10, false, id)
  assert.deepEqual(again, first)
  assert.deepEqual(await snapshot(), after, 'Lost-response retry must not charge, roll or grant twice')
  assert.equal((await pull('animal', 10, false, id)).reason, 'request_mismatch')
  const fridge = await one('select food_by_user from public.eren_stats where household_id=$1', [home])
  const expected = {}
  for (const reward of first.results) {
    const key = GACHA_FOOD_GRANT[reward.itemId]
    expected[key] = (expected[key] ?? 0) + 1
    assert.equal(reward.stardustGained, 0)
  }
  assert.deepEqual(fridge.food_by_user[alice], expected)
  checks += 3

  await reset()
  for (const item of GACHA_ITEMS.filter(i => i.category === 'skin')) {
    await db.query('insert into public.user_inventory(user_id,item_id,quantity) values ($1,$2,1)', [alice, item.id])
  }
  const duplicates = await pull('creatures', 10)
  for (const reward of duplicates.results) {
    const item = GACHA_ITEMS.find(i => i.id === reward.itemId)
    assert.equal(reward.isNew, false)
    assert.equal(reward.stardustGained, DUPLICATE_STARDUST[item.rarity])
  }
  assert.equal(duplicates.state.stardust, duplicates.results.reduce((n, r) => n + r.stardustGained, 0))
  checks++

  await reset()
  for (const item of GACHA_ITEMS.filter(i => i.category === 'consumable')) {
    await db.query('insert into public.user_inventory(user_id,item_id,quantity) values ($1,$2,0)', [alice, item.id])
  }
  const collected = await pull('food', 10)
  assert.ok(collected.results.every(reward => !reward.isNew && reward.stardustGained === 0), 'A depleted consumable is still previously collected')
  checks++

  await reset()
  await db.exec('update public.user_gacha_state set gacha_tickets=1, pulls_since_epic=29')
  const ticket = await pull('foodsuits', 1, true)
  assert.equal(ticket.coins, 10000)
  assert.equal(ticket.state.gacha_tickets, 0)
  assert.equal(ticket.results[0].isPity, true)
  assert.equal(GACHA_ITEMS.find(i => i.id === ticket.results[0].itemId).rarity, 'epic')
  assert.equal((await pull('foodsuits', 1, true)).reason, 'no_ticket')
  await db.exec('update public.user_gacha_state set pulls_since_legendary=99')
  const pity = await pull('animal')
  assert.equal(pity.results[0].isPity, true)
  assert.equal(GACHA_ITEMS.find(i => i.id === pity.results[0].itemId).rarity, 'legendary')
  checks += 2

  await reset()
  await db.exec('update public.profiles set coins=49')
  const beforePoor = await snapshot()
  assert.equal((await pull()).reason, 'insufficient')
  assert.deepEqual(await snapshot(), beforePoor)
  assert.equal((await pull('food', 2)).reason, 'bad_request')
  assert.equal((await pull('missing')).reason, 'bad_banner')
  checks++

  for (const table of ['public.user_inventory', 'public.gacha_pull_log', 'public.eren_stats', 'public.profiles', 'public.user_gacha_state', 'eren_private.economy_receipts']) {
    await failAt(table)
    await failAt(table, 10)
  }
  // Failure in the middle of a batch must also undo its earlier rewards.
  await reset()
  const beforeBatch = await snapshot()
  await db.exec(`create or replace function public.test_fail() returns trigger language plpgsql as $$
    begin if new.pull_number=6 then raise exception 'sixth pull failed'; end if; return new; end; $$;
    create trigger injected_failure before insert on public.gacha_pull_log for each row execute function public.test_fail();`)
  await assert.rejects(() => pull('food', 10), /sixth pull failed/)
  assert.deepEqual(await snapshot(), beforeBatch)
  await db.exec('drop trigger injected_failure on public.gacha_pull_log')
  checks++

  await reset()
  // Device A and B have stale UI snapshots. Neither sends those snapshots.
  await food('add', ['cake_strawberry', 'cake_strawberry'])
  await auth(bob)
  await food('add', ['cake_moonbeam'])
  await auth(alice)
  const twoDevices = await food('add', ['cake_strawberry'])
  assert.equal(twoDevices.food_by_user[alice].cake_strawberry, 3)
  assert.equal(twoDevices.food_by_user[bob].cake_moonbeam, 1)
  const giftId = randomUUID()
  const gift = await food('gift', ['cake_strawberry'], bob, giftId)
  assert.equal(gift.food_by_user[alice].cake_strawberry, 2)
  assert.equal(gift.food_by_user[bob].cake_strawberry, 1)
  assert.deepEqual(await food('gift', ['cake_strawberry'], bob, giftId), gift)
  assert.equal((await food('gift', ['cake_strawberry'], outsider)).reason, 'bad_recipient')
  assert.equal((await food('gift', ['cake_strawberry'], alice)).reason, 'bad_recipient')
  assert.equal((await food('add', ['not_food'])).reason, 'bad_food')
  assert.equal((await food('consume', ['sardine'])).reason, 'out_of_stock')
  assert.equal((await food('add', ['milk'], null, giftId)).reason, 'request_mismatch')
  checks += 5

  const consumeId = randomUUID()
  const consumed = await food('consume', ['cake_strawberry'], null, consumeId)
  assert.equal(consumed.food_by_user[alice].cake_strawberry, 1)
  assert.deepEqual(await food('consume', ['cake_strawberry'], null, consumeId), consumed)
  await db.query('update public.eren_stats set food_inventory=$2 where household_id=$1', [home, JSON.stringify({ fish: 1 })])
  const legacy = await food('consume', ['fish'])
  assert.equal(legacy.food_inventory.fish, 0)
  assert.equal((await food('consume', ['fish'])).reason, 'out_of_stock')
  checks += 2

  const beforeFailFood = await snapshot()
  await db.exec(`create trigger injected_failure before insert on eren_private.economy_receipts for each row execute function public.test_fail();`)
  // Reinstall the unconditional fault used above.
  await db.exec(`create or replace function public.test_fail() returns trigger language plpgsql as $$ begin raise exception 'fridge failed'; end; $$;`)
  await assert.rejects(() => food('gift', ['cake_strawberry'], bob), /fridge failed/)
  assert.deepEqual(await snapshot(), beforeFailFood, 'A failed gift must change neither fridge')
  await db.exec('drop trigger injected_failure on eren_private.economy_receipts')
  checks++

  await auth('')
  assert.equal((await pull()).reason, 'unauthenticated')
  assert.equal((await food('add', ['milk'])).reason, 'unauthenticated')
  const privileges = await one(`select
    has_function_privilege('anon','public.pull_gacha_atomic(uuid,text,integer,boolean)','execute') as anon_pull,
    has_function_privilege('authenticated','public.pull_gacha_atomic(uuid,text,integer,boolean)','execute') as auth_pull,
    has_schema_privilege('authenticated','eren_private','usage') as private_access`)
  assert.deepEqual(privileges, { anon_pull: false, auth_pull: true, private_access: false })
  checks++
  console.log(`Economy SQL checks passed: ${checks} scenarios; real transactions, injected failures, replay safety, all four banners, tickets, pity, fridge/gifts, legacy stock and permissions.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.close())
