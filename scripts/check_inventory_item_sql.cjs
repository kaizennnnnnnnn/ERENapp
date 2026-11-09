// Run the real migration in disposable PostgreSQL, never the hosted project.
const assert = require('node:assert/strict'), fs = require('node:fs'), { randomUUID } = require('node:crypto')
const { PGlite } = require('@electric-sql/pglite'), load = require('./lib/load_ts.cjs')()
const { GACHA_ITEMS } = load('src/lib/gacha.ts'), db = new PGlite(), read = f => fs.readFileSync(f, 'utf8')
const sql = read('supabase/migration_inventory_item_saves.sql'), a = randomUUID(), b = randomUUID(), c = randomUUID(), home = randomUUID(), away = randomUUID()
const snacks = GACHA_ITEMS.filter(i => i.category === 'consumable'), first = snacks[0].id
let checks = 0
const one = async (q, args = []) => (await db.query(q, args)).rows[0]
const auth = (id = a) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
const use = async ({ id = randomUUID(), actor = a, hh = home, item = first } = {}) => (await one('select public.use_inventory_item_atomic($1,$2,$3,$4) r', [id, actor, hh, item])).r
async function snap() {
  const out = {}
  for (const { schemaname: s, tablename: t } of (await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','eren_private') order by 1,2")).rows)
    out[s + '.' + t] = (await db.query(`select to_jsonb(t) r from "${s}"."${t}" t order by to_jsonb(t)::text`)).rows
  return out
}
async function reset(qty = 2) {
  await db.exec('reset role'); await auth()
  await db.exec('delete from eren_private.economy_receipts;delete from public.user_inventory;')
  await db.query('update public.profiles set household_id=case when id=$1 then $2::uuid else $3::uuid end,coins=1000', [c, away, home])
  await db.exec("update public.eren_stats set energy=17,happiness=21,hunger=39,sleep_quality=45,cleanliness=67.25,weight=4.5,is_sick=true,is_sleeping=true,mood='sleepy',last_decay_at=now()-interval '2 hours'")
  for (const item of snacks) await db.query('insert into public.user_inventory(user_id,item_id,quantity) values($1,$3,$4),($2,$3,7)', [a, b, item.id, qty])
}
async function refused(opts, reason) {
  const before = await snap(), r = await use(opts)
  assert.equal(r.ok, false); assert.equal(r.reason, reason); assert.deepEqual(await snap(), before); checks++
}
async function main() {
  const buffs = JSON.parse(sql.match(/\$inventory_buffs\$([\s\S]*?)\$inventory_buffs\$/)[1])
  assert.deepEqual(buffs, Object.fromEntries(snacks.map(i => [i.id, i.buff])), 'Every live collection buff must match the SQL allowlist')
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create publication supabase_realtime;`)
  await db.exec(read('supabase/schema.sql').replace('create extension if not exists "pgcrypto";', ''))
  for (const f of ['migration_v2.sql', 'migration_v3.sql', 'migration_sleeping.sql', 'migration_gacha_couple_fortune.sql', 'migration_user_food_and_gifts.sql', 'migration_donut_machine.sql', 'migration_donut_case_and_menu.sql', 'migration_donut_effects.sql', 'migration_interactions_useful.sql', 'migration_battle_results.sql', 'migration_trophy_battle.sql', 'migration_economy_reliability.sql']) await db.exec(read('supabase/' + f))
  await db.exec(sql)
  await db.query('insert into public.households(id) values($1),($2)', [home, away])
  await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)', [a, b, c, 'item-a@test.invalid', 'item-b@test.invalid', 'item-c@test.invalid'])
  await db.query('insert into public.eren_stats(household_id) values($1),($2)', [home, away])
  for (const item of snacks) for (const qty of [1, 2, 8]) for (const stat of [0, 43, 99, 100]) {
    await reset(qty)
    await db.query('update public.eren_stats set energy=$1,happiness=$1', [stat])
    const before = await snap(), old = await one('select * from public.eren_stats where household_id=$1', [home]), id = randomUUID()
    const r = await use({ id, item: item.id }), after = await one('select * from public.eren_stats where household_id=$1', [home])
    assert.equal(r.ok, true); assert.equal(r.version, 1); assert.equal(r.request_id, id); assert.equal(r.user_id, a); assert.equal(r.household_id, home); assert.equal(r.item_id, item.id)
    for (const k of Object.keys(old)) if (k !== item.buff.stat && k !== 'updated_at') assert.deepEqual(after[k], old[k], k + ' stays unchanged')
    assert.equal(after[item.buff.stat], Math.min(100, stat + item.buff.amount)); assert.equal(new Date(after.updated_at).getTime(), Date.parse(r.saved_at))
    assert.equal(r.inventory_item?.quantity ?? 0, qty - 1); assert.equal(r.stats.energy, after.energy); assert.equal(r.stats.happiness, after.happiness)
    const saved = await snap(); assert.deepEqual(await use({ id, item: item.id }), r); assert.deepEqual(await snap(), saved)
    // No changes to coins, fridge, taste effects, history, pity, partner stock, or any other table.
    for (const table of Object.keys(before)) if (!['public.user_inventory', 'public.eren_stats', 'eren_private.economy_receipts'].includes(table)) assert.deepEqual(saved[table], before[table], table)
    assert.equal((await one('select quantity from public.user_inventory where user_id=$1 and item_id=$2', [b, item.id])).quantity, 7)
    checks++
  }
  await reset(1); const id = randomUUID(), original = await use({ id })
  await db.query("update public.eren_stats set energy=32,happiness=94,updated_at=clock_timestamp(),food_by_user=$2 where household_id=$1", [home, JSON.stringify({ [b]: { milk: 9 } })])
  await db.query('insert into public.user_inventory(user_id,item_id,quantity) values($1,$2,5)', [a, first])
  const beforeReplay = await snap(), replay = await use({ id })
  assert.equal(replay.saved_at, original.saved_at); assert.equal(replay.inventory_item.quantity, 5); assert.equal(replay.stats.energy, 32); assert.equal(replay.stats.happiness, 94); assert.deepEqual(await snap(), beforeReplay); checks++
  await reset(1); await use(); await refused({}, 'no_stock')
  await reset(0); await refused({}, 'no_stock')
  await reset(); await refused({ actor: b }, 'session_changed'); await refused({ hh: away }, 'household_changed'); await refused({ id: null }, 'bad_request'); await refused({ hh: null }, 'bad_request')
  for (const item of [null, '', 'classic', 'cons_donut_neon;delete from profiles', 'unknown']) await refused({ item }, 'bad_item')
  await auth(''); await refused({}, 'unauthenticated'); await auth(c); await refused({ actor: c }, 'household_changed'); await auth()
  await use({ id }); await refused({ id, item: snacks[1].id }, 'request_mismatch')
  await db.query('update public.profiles set household_id=$1 where id=$2', [away, a]); await refused({ id }, 'household_changed')
  await reset(); await db.query("insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values($1,$2,'other','{}','{}')", [a, id]); await refused({ id }, 'request_mismatch')
  await reset(); await db.query('delete from public.eren_stats where household_id=$1', [home]); await refused({}, 'no_stats'); await db.query('insert into public.eren_stats(household_id) values($1)', [home])
  for (const [table, operation, qty] of [['public.eren_stats','update',2], ['public.user_inventory','update',2], ['public.user_inventory','delete',1], ['eren_private.economy_receipts','insert',2]]) {
    await reset(qty)
    await db.exec(`create function public.fail_item_test() returns trigger language plpgsql as $$begin raise exception 'item injected';end$$;create trigger fail_item_test before ${operation} on ${table} for each row execute function public.fail_item_test();`)
    const before = await snap(); await assert.rejects(() => use(), /item injected/); assert.deepEqual(await snap(), before); checks++
    await db.exec(`drop trigger fail_item_test on ${table};drop function public.fail_item_test();`)
  }
  await reset(); await auth(b); assert.equal((await use({ actor: b })).ok, true); assert.equal((await one('select quantity from public.user_inventory where user_id=$1 and item_id=$2', [a, first])).quantity, 2); checks++
  const saved = await snap(); await db.exec(sql); assert.deepEqual(await snap(), saved); checks++
  assert.equal((await one("select has_function_privilege('anon','public.use_inventory_item_atomic(uuid,uuid,uuid,text)','execute') allowed")).allowed, false)
  assert.equal((await one("select has_function_privilege('authenticated','public.use_inventory_item_atomic(uuid,uuid,uuid,text)','execute') allowed")).allowed, true)
  await db.exec('set role authenticated'); await auth(); assert.equal((await use()).ok, true); await assert.rejects(() => db.query('select * from eren_private.economy_receipts'), /permission denied/); checks++
  await db.close(); console.log(`Collection snack SQL: ${checks} scenarios passed (all 13 buffs, caps, replay, partner stock, rollback, scope and grants).`)
}
main().catch(async e => { console.error(e); await db.close(); process.exitCode = 1 })
