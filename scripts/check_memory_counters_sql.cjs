const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

const home = '10000000-0000-4000-a000-000000000001'
const other = '10000000-0000-4000-a000-000000000002'
const me = '20000000-0000-4000-a000-000000000001'
const partner = '20000000-0000-4000-a000-000000000002'
const stranger = '20000000-0000-4000-a000-000000000003'
const db = new PGlite()
const migration = fs.readFileSync('supabase/migration_memory_counters.sql', 'utf8')

async function main() {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated, anon;
    create table public.profiles(id uuid primary key, household_id uuid);
    create table public.interactions(household_id uuid, user_id uuid, action_type text, created_at timestamptz, useful boolean);
    create table public.couple_journal(household_id uuid, sender_id uuid, via_eren boolean);
    create table public.game_scores(user_id uuid);
    create table public.households(id uuid primary key, wishes_granted_count int);
    create function public.my_household_id() returns uuid language sql stable security definer set search_path=''
      as $$select household_id from public.profiles where id = auth.uid()$$;
    grant select on public.profiles,public.interactions,public.couple_journal,public.game_scores,public.households to authenticated;
    alter table public.profiles enable row level security;
    alter table public.interactions enable row level security;
    alter table public.couple_journal enable row level security;
    alter table public.game_scores enable row level security;
    alter table public.households enable row level security;
    create policy members on public.profiles for select to authenticated using (household_id=(select public.my_household_id()));
    create policy members on public.interactions for select to authenticated using (household_id=(select public.my_household_id()));
    create policy members on public.couple_journal for select to authenticated using (household_id=(select public.my_household_id()));
    create policy members on public.game_scores for select to authenticated
      using (user_id in(select id from public.profiles));
    create policy members on public.households for select to authenticated using (id=(select public.my_household_id()));
    insert into public.profiles values ('${me}','${home}'),('${partner}','${home}'),('${stranger}','${other}');
    insert into public.households values ('${home}',5),('${other}',100);
    insert into public.interactions values
      ('${home}','${me}','feed',now(),false),
      ('${home}','${partner}','wash',now(),true),
      ('${home}','${me}','play',date_trunc('day',now(),'UTC')-interval '1 second',true),
      ('${other}','${stranger}','feed',now(),true);
    insert into public.couple_journal values
      ('${home}','${me}',true),('${home}','${me}',true),('${home}','${partner}',true),
      ('${home}','${partner}',false),('${home}','${me}',null),('${home}','${stranger}',true),
      ('${other}','${stranger}',true);
    insert into public.game_scores values ('${me}'),('${partner}'),('${partner}'),('${stranger}');
  `)
  await db.exec(migration)
  await db.exec(migration)
  const read = async (keys, id = home) => (await db.query('select public.read_memory_counters($1, $2) as counters', [id, keys])).rows[0].counters
  const as = async (role, id) => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ''])
    await db.exec('set role ' + role)
  }
  await as('authenticated',me)
  assert.deepEqual(await read(['cares','both-care','feed','play','sleep','wash','medicine','nudges','traded','games','wishes']),
    { cares:3,'both-care':2,feed:1,play:1,sleep:0,wash:1,medicine:0,nudges:4,traded:1,games:3,wishes:5 })
  assert.deepEqual(await read(['play','both-care']), {play:1,'both-care':2})
  assert.deepEqual(await read(['feed']), {feed:1})
  assert.deepEqual(await read(['both-care']), {'both-care':2})
  assert.deepEqual(await read([]), {})
  await assert.rejects(read(['cares'],other), {code:'42501'})
  await assert.rejects(read(['cares'],null), {code:'42501'})
  for (const invalid of [null,['nope'],[null],Array(12).fill('cares')]) {
    await assert.rejects(read(invalid), {code:'22023'})
  }
  await as('authenticated',partner)
  assert.deepEqual(await read(['wishes','traded']), {wishes:5,traded:1})
  await as('authenticated',stranger)
  assert.deepEqual(await read(['cares','both-care','games','nudges','traded','wishes'],other),
    {cares:1,'both-care':1,games:1,nudges:1,traded:0,wishes:100})
  await as('authenticated')
  await assert.rejects(read(['feed']), {code:'42501'})
  await as('anon')
  await assert.rejects(read(['feed']), {code:'42501'})
  await db.exec('reset role; drop policy members on public.game_scores')
  await as('authenticated',me)
  assert.deepEqual(await read(['games']), {games:0}, 'Invoker still obeys table RLS')
  console.log('PASS memory counter SQL: idempotent, exact totals, selective reads, UTC day, solo, partner, foreign household, anonymous, invalid keys and RLS')
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => db.close())
