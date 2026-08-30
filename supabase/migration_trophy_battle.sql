-- ============================================================
-- TROPHY BATTLE — the daily care battle stops paying 30 coins
-- and starts paying trophies.
--
-- Why: coins are everywhere (a single arcade round pays 30-55,
-- the weekly champion pays 100, level rewards pay hundreds), so
-- "win the whole day, get 30 coins" was worth less than one game
-- of Purr Beat and nothing about the house changed when you won.
-- Trophies are minted by exactly one thing — winning a day — and
-- buy things coins cannot.
--
-- SAFE TO RE-RUN. Every statement is if-not-exists / or-replace.
--
-- Contents:
--   1. profiles.trophies + prestige equips
--   2. daily_battle_results settlement columns
--   3. settle_daily_battle()     — scores the day from `interactions`
--                                and mints its trophy, exactly once
--   3b. a trigger locking the settlement columns
--   4. trophy_shop_items         — server-side price list
--   5. user_trophy_items         — what you own
--   6. purchase_trophy_item()    — atomic spend
--   7. eren_stats room_decor + equipped_accessory (household)
--   8. trophy_effects            — the timed / one-shot privileges
-- ============================================================

-- ── 1. Currency + prestige equips ───────────────────────────

alter table public.profiles
  add column if not exists trophies int not null default 0;

alter table public.profiles
  add column if not exists equipped_title text;

alter table public.profiles
  add column if not exists equipped_frame text;

-- HONEST NOTE ON THIS COLUMN. A client may update its own profile row
-- under the existing RLS, so `trophies` is writable the same way `coins`
-- already is. What the settlement below guarantees is narrower and worth
-- stating exactly: it will never MINT more than the day earned, because
-- it scores the day itself from `interactions` and CASes a flag the
-- guard trigger will not let a client clear. Someone determined to edit
-- their own balance by hand still can — that is a property of the whole
-- app's trust model, not of this feature, and closing it means moving
-- coins server-side too.

-- ── 2. Settlement columns on the daily snapshot ─────────────

alter table public.daily_battle_results
  add column if not exists twist_id text;

alter table public.daily_battle_results
  add column if not exists trophy_tier text
    check (trophy_tier in ('bronze','silver','gold'));

alter table public.daily_battle_results
  add column if not exists trophies_awarded int not null default 0;

alter table public.daily_battle_results
  add column if not exists trophy_claimed boolean not null default false;

alter table public.daily_battle_results
  add column if not exists verdict_seen boolean not null default false;

-- ── 3. Settlement ───────────────────────────────────────────
-- Closes ONE finished day and mints its trophies, at most once.
--
-- The server does the SCORING. The first cut of this read `score` and
-- `partner_score` straight off the snapshot row and derived the tier
-- from them, which was worthless: daily_battle_results is
-- client-writable, so anyone could insert a 99-0 row for an arbitrary
-- past date and claim gold, or reset trophy_claimed and mint the same
-- day forever. The numbers now come from `interactions`, which only a
-- real care action writes.
--
-- The DAY WINDOW comes from the client, because the household's
-- timezone is stored nowhere and "yesterday" is a local idea. The
-- client may choose a window; it cannot choose what happened inside
-- one. It is bounded below (a real 23-25h day, allowing for DST) and
-- above (it must already be over).
--
-- THIS FUNCTION IS A TWIN of src/lib/dailyTwist.ts. TWIST_ORDER, the
-- per-action point tables, SPRINT_WINDOW, trophyTier(), TROPHY_VALUE,
-- streakBonus() and consolationTrophies() all appear in both places.
-- Change one, change the other.

-- Which twist a date runs. Mirrors twistForDate(): a plain rotation
-- over a fixed order, chosen over a seeded shuffle precisely so that it
-- ports to one line of SQL.
create or replace function public.eren_twist_for_date(p_date date)
returns text
language sql
immutable
set search_path = public
as $fn$
  select (array[
    'bath_day','feast','playday','nap_day','nurse','double','full_house','sprint'
  ])[ (((p_date - date '1970-01-01') % 8) + 8) % 8 + 1 ];
$fn$;

create or replace function public.settle_daily_battle(
  p_date  date,
  p_start timestamptz,
  p_end   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid      uuid := auth.uid();
  v_hh       uuid;
  v_partner  uuid;
  v_twist    text;
  v_me       int := 0;
  v_them     int := 0;
  v_outcome  text;
  v_margin   int;
  v_tier     text;
  v_amount   int := 0;
  v_streak   int := 0;
  v_updated  int;
  v_balance  int;
  v_cursor   date;
  v_prev     text;
  v_claimed  boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  -- ── Window sanity ──
  if p_start is null or p_end is null or p_end <= p_start then
    return jsonb_build_object('ok', false, 'reason', 'bad_window');
  end if;
  -- A calendar day, give or take a DST hour.
  if (p_end - p_start) < interval '23 hours'
     or (p_end - p_start) > interval '25 hours' then
    return jsonb_build_object('ok', false, 'reason', 'bad_window');
  end if;
  -- The day must be OVER. This replaces an earlier `p_date >=
  -- current_date` test that compared a client-LOCAL date against the
  -- server's UTC one, and so refused legitimate claims during the first
  -- hours of the local day east of Greenwich.
  if p_end > now() then
    return jsonb_build_object('ok', false, 'reason', 'not_finished');
  end if;
  -- And the window must sit on the date it claims, so it cannot be slid
  -- over a busier day.
  if abs(extract(epoch from (p_start - p_date::timestamptz))) > 86400 then
    return jsonb_build_object('ok', false, 'reason', 'bad_window');
  end if;
  -- Nothing older than the backfill window is settleable, so a fresh
  -- account cannot walk backwards through history minting trophies.
  if p_date < current_date - 40 then
    return jsonb_build_object('ok', false, 'reason', 'too_old');
  end if;

  select household_id into v_hh from public.profiles where id = v_uid;
  if v_hh is null then
    return jsonb_build_object('ok', false, 'reason', 'no_household');
  end if;

  select id into v_partner
  from public.profiles
  where household_id = v_hh and id <> v_uid
  limit 1;

  v_twist := public.eren_twist_for_date(p_date);

  -- ── Score the day from what actually happened ──
  --
  -- Mirrors scoreDaily(): useful care actions only, in order, with a
  -- DOUBLE HOUR duplicating a row rather than doubling a subtotal —
  -- which is what keeps SPRINT and FULL HOUSE right, since their value
  -- depends on an action's position in the sequence.
  with acts as (
    select i.user_id, i.action_type, i.created_at
    from public.interactions i
    where i.household_id = v_hh
      and i.created_at >= p_start
      and i.created_at <  p_end
      and coalesce(i.useful, true)
      and i.action_type in ('feed','play','sleep','wash','medicine')
      and i.user_id in (v_uid, coalesce(v_partner, v_uid))
  ),
  expanded as (
    select a.user_id, a.action_type, a.created_at, g.n
    from acts a
    cross join lateral generate_series(
      1,
      case when exists (
        select 1 from public.trophy_effects e
        where e.household_id = v_hh
          and e.kind = 'double_hour'
          and e.user_id = a.user_id
          and e.active_until is not null
          and a.created_at >= e.created_at
          and a.created_at <  e.active_until
      ) then 2 else 1 end
    ) as g(n)
  ),
  ranked as (
    select user_id, action_type,
      row_number() over (partition by user_id order by created_at, n) as idx,
      row_number() over (partition by user_id, action_type order by created_at, n) as type_idx
    from expanded
  ),
  scored as (
    select user_id, sum(
      case v_twist
        when 'bath_day'   then case when action_type = 'wash'     then 3 else 1 end
        when 'feast'      then case when action_type = 'feed'     then 3 else 1 end
        when 'playday'    then case when action_type = 'play'     then 3 else 1 end
        when 'nap_day'    then case when action_type = 'sleep'    then 3 else 1 end
        when 'nurse'      then case when action_type = 'medicine' then 5 else 1 end
        when 'double'     then 2
        when 'full_house' then case when type_idx = 1 then 4 else 1 end
        when 'sprint'     then case when idx <= 6    then 3 else 1 end
        else 1
      end
    )::int as pts
    from ranked
    group by user_id
  )
  select
    coalesce(max(pts) filter (where user_id = v_uid), 0),
    coalesce(max(pts) filter (where user_id = v_partner), 0)
  into v_me, v_them
  from scored;

  -- POINT STEAL: one point off the named target, floored at zero.
  v_me := greatest(0, v_me - (
    select count(*) from public.trophy_effects e
    where e.household_id = v_hh and e.kind = 'point_steal'
      and e.created_at >= p_start and e.created_at < p_end
      and e.payload->>'target' = v_uid::text));
  if v_partner is not null then
    v_them := greatest(0, v_them - (
      select count(*) from public.trophy_effects e
      where e.household_id = v_hh and e.kind = 'point_steal'
        and e.created_at >= p_start and e.created_at < p_end
        and e.payload->>'target' = v_partner::text));
  end if;

  v_outcome := case when v_me > v_them then 'win'
                    when v_them > v_me then 'loss'
                    else 'tie' end;

  -- ── Write the truth back ──
  -- The row is a cache for the history views, so it is corrected here
  -- whatever the client had put in it. `verdict_seen` and
  -- `comeback_claimed` are left alone — those are the client's to set.
  -- The flag tells the guard trigger below that this write is ours.
  perform set_config('eren.settling', 'on', true);

  insert into public.daily_battle_results
    (household_id, user_id, date, score, partner_score, outcome,
     comeback_claimed, twist_id)
  values (v_hh, v_uid, p_date, v_me, v_them, v_outcome, false, v_twist)
  on conflict (household_id, user_id, date) do update
    set score         = excluded.score,
        partner_score = excluded.partner_score,
        outcome       = excluded.outcome,
        twist_id      = excluded.twist_id;

  select trophy_claimed into v_claimed
  from public.daily_battle_results
  where household_id = v_hh and user_id = v_uid and date = p_date
  for update;

  if v_claimed then
    select trophies into v_balance from public.profiles where id = v_uid;
    return jsonb_build_object(
      'ok', false, 'reason', 'already_claimed',
      'score', v_me, 'partner_score', v_them, 'outcome', v_outcome,
      'trophies', 0, 'balance', coalesce(v_balance, 0));
  end if;

  -- ── The prize ──
  v_margin := v_me - v_them;

  -- Tier by margin — identical to trophyTier().
  v_tier := case
    when v_margin >= 6 then 'gold'
    when v_margin >= 3 then 'silver'
    when v_margin >= 1 then 'bronze'
    else null
  end;

  -- Base value — identical to TROPHY_VALUE.
  v_amount := case v_tier
    when 'gold'   then 3
    when 'silver' then 2
    when 'bronze' then 1
    else 0
  end;

  if v_tier is not null then
    -- Consecutive wins ending on this date. Walked one calendar day at
    -- a time because the rule is "no gap": a day with no row at all
    -- (nobody played) breaks the streak. 365 is a guard, not a rule.
    v_cursor := p_date;
    loop
      select outcome into v_prev
      from public.daily_battle_results
      where user_id = v_uid and date = v_cursor;
      exit when v_prev is null or v_prev <> 'win';
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
      exit when v_streak >= 365;
    end loop;

    -- Identical to streakBonus().
    if v_streak > 0 and v_streak % 3 = 0 then
      v_amount := v_amount + 2;
    end if;
  else
    -- Identical to consolationTrophies().
    if (v_them - v_me) between 1 and 2 and v_me >= 3 then
      v_amount := 1;
    end if;
  end if;

  -- CAS. Only the first caller for this (user, date) gets rowcount 1.
  update public.daily_battle_results
     set trophy_claimed   = true,
         trophy_tier      = v_tier,
         trophies_awarded = v_amount
   where household_id = v_hh
     and user_id = v_uid
     and date = p_date
     and trophy_claimed = false;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    select trophies into v_balance from public.profiles where id = v_uid;
    return jsonb_build_object(
      'ok', false, 'reason', 'already_claimed',
      'score', v_me, 'partner_score', v_them, 'outcome', v_outcome,
      'trophies', 0, 'balance', coalesce(v_balance, 0));
  end if;

  update public.profiles
     set trophies = trophies + v_amount
   where id = v_uid
  returning trophies into v_balance;

  return jsonb_build_object(
    'ok', true,
    'score', v_me, 'partner_score', v_them, 'outcome', v_outcome,
    'twist_id', v_twist,
    'tier', v_tier,
    'trophies', v_amount,
    'streak', v_streak,
    'balance', coalesce(v_balance, 0));
end;
$fn$;

grant execute on function public.settle_daily_battle(date, timestamptz, timestamptz) to authenticated;
grant execute on function public.eren_twist_for_date(date) to authenticated;

-- The first cut took only p_date and trusted the snapshot row. Drop it
-- so nothing can keep calling the forgeable version.
drop function if exists public.claim_daily_trophy(date);

-- ── 3b. Lock the settlement columns ─────────────────────────
--
-- Defence in depth behind the rewrite above. daily_battle_results has
-- to stay client-writable (the backfill fills in history; verdict_seen
-- and comeback_claimed are the client's), but the columns that decide a
-- PAYOUT must not be. A BEFORE UPDATE trigger puts them back, so a
-- direct UPDATE that tries to reset trophy_claimed silently achieves
-- nothing and the CAS keeps its meaning.
--
-- settle_daily_battle sets a transaction-local flag to say "this write
-- is mine"; set_config(..., true) means it dies with the transaction,
-- so it cannot leak into a later statement on a pooled connection.

create or replace function public.guard_battle_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if coalesce(current_setting('eren.settling', true), '') = 'on' then
    return new;
  end if;
  new.trophy_claimed   := old.trophy_claimed;
  new.trophies_awarded := old.trophies_awarded;
  new.trophy_tier      := old.trophy_tier;
  new.score            := old.score;
  new.partner_score    := old.partner_score;
  new.outcome          := old.outcome;
  return new;
end;
$fn$;

drop trigger if exists trg_guard_battle_settlement on public.daily_battle_results;
create trigger trg_guard_battle_settlement
  before update on public.daily_battle_results
  for each row execute function public.guard_battle_settlement();

-- ── 4. The price list ───────────────────────────────────────
-- Server-side, so a client cannot name its own price. The TS
-- catalogue (src/lib/trophyShop.ts) mirrors these ids; a row missing
-- here fails the purchase loudly instead of selling for nothing.

create table if not exists public.trophy_shop_items (
  item_id text primary key,
  kind    text not null check (kind in ('decor','accessory','privilege','prestige')),
  price   int  not null check (price > 0),
  -- Privileges are consumables and may be bought again; everything else
  -- is owned once.
  stackable boolean not null default false
);

alter table public.trophy_shop_items enable row level security;

drop policy if exists "anyone signed in reads the price list" on public.trophy_shop_items;
create policy "anyone signed in reads the price list"
  on public.trophy_shop_items for select
  using (auth.uid() is not null);

-- ── 5. Ownership ────────────────────────────────────────────

create table if not exists public.user_trophy_items (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    text not null references public.trophy_shop_items(item_id) on delete cascade,
  quantity   int  not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists idx_uti_user on public.user_trophy_items(user_id);

alter table public.user_trophy_items enable row level security;

drop policy if exists "household reads trophy items"  on public.user_trophy_items;
drop policy if exists "users read own trophy items"   on public.user_trophy_items;
drop policy if exists "users update own trophy items" on public.user_trophy_items;

-- Both partners can see what the other owns — the whole point of a
-- crown is that it is visible.
create policy "household reads trophy items"
  on public.user_trophy_items for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = user_trophy_items.user_id
        and p.household_id = public.my_household_id()
    )
  );

-- No INSERT policy on purpose: buying goes through the RPC.
-- WITH CHECK matters as much as USING here: without it a client could
-- UPDATE a cheap owned row's item_id into an expensive one, or set
-- quantity to a thousand. Both sides are pinned, and quantity may only
-- go DOWN (spending a consumable) — never up outside the RPC.
create policy "users spend own trophy items"
  on public.user_trophy_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.guard_trophy_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.item_id  := old.item_id;
  new.user_id  := old.user_id;
  -- Only ever down, and never below zero.
  if new.quantity > old.quantity then new.quantity := old.quantity; end if;
  if new.quantity < 0 then new.quantity := 0; end if;
  return new;
end;
$fn$;

drop trigger if exists trg_guard_trophy_item_update on public.user_trophy_items;
create trigger trg_guard_trophy_item_update
  before update on public.user_trophy_items
  for each row execute function public.guard_trophy_item_update();

-- ── 6. purchase_trophy_item ─────────────────────────────────

create or replace function public.purchase_trophy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_price     int;
  v_stackable boolean;
  v_balance   int;
  v_inserted  int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select price, stackable into v_price, v_stackable
  from public.trophy_shop_items
  where item_id = p_item_id;

  if v_price is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_item');
  end if;

  -- Lock my profile row so two taps cannot both pass the balance check.
  select trophies into v_balance
  from public.profiles
  where id = v_uid
  for update;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  if v_balance < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance);
  end if;

  -- Grant FIRST; only charge if the row actually landed. Same order as
  -- purchase_skin_with_stardust — a crash between the two costs the
  -- house an item, never the player their trophies.
  if v_stackable then
    insert into public.user_trophy_items (user_id, item_id, quantity)
    values (v_uid, p_item_id, 1)
    on conflict (user_id, item_id)
      do update set quantity = public.user_trophy_items.quantity + 1;
    v_inserted := 1;
  else
    insert into public.user_trophy_items (user_id, item_id, quantity)
    values (v_uid, p_item_id, 1)
    on conflict (user_id, item_id) do nothing;
    get diagnostics v_inserted = row_count;
  end if;

  if v_inserted = 0 then
    return jsonb_build_object('ok', false, 'reason', 'already_owned', 'balance', v_balance);
  end if;

  update public.profiles set trophies = trophies - v_price where id = v_uid;

  return jsonb_build_object('ok', true, 'balance', v_balance - v_price, 'item_id', p_item_id);
end;
$$;

grant execute on function public.purchase_trophy_item(text) to authenticated;

-- ── 7. Household cosmetics ──────────────────────────────────
-- Decor and the worn accessory live on eren_stats, next to room_skins,
-- because there is one Eren and one house: if she puts a crown on him
-- you should find it there too.

alter table public.eren_stats
  add column if not exists room_decor jsonb not null default '{}'::jsonb;

alter table public.eren_stats
  add column if not exists equipped_accessory text;

-- ── 8. Privileges ───────────────────────────────────────────
-- The bought powers. One row per use; `active_until` null means a
-- one-shot that has already been applied (kept for the log).

create table if not exists public.trophy_effects (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references public.profiles(id)   on delete cascade,
  kind         text not null check (kind in
                 ('eren_says','double_hour','point_steal','streak_shield','decay_freeze')),
  payload      jsonb not null default '{}'::jsonb,
  active_until timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_trophy_effects_household
  on public.trophy_effects(household_id, created_at desc);

alter table public.trophy_effects enable row level security;

drop policy if exists "household reads trophy effects"  on public.trophy_effects;
drop policy if exists "users insert own trophy effects" on public.trophy_effects;
drop policy if exists "users update own trophy effects" on public.trophy_effects;

create policy "household reads trophy effects"
  on public.trophy_effects for select
  using (household_id = public.my_household_id());

create policy "users insert own trophy effects"
  on public.trophy_effects for insert
  with check (household_id = public.my_household_id() and user_id = auth.uid());

create policy "users update own trophy effects"
  on public.trophy_effects for update
  using (household_id = public.my_household_id() and user_id = auth.uid());

-- A privilege is a plain client INSERT, which is fine for what it is —
-- but the row is read by the SCORER, so its shape has to be bounded or a
-- hand-rolled request could grant itself a hundred-year Double Hour, or
-- a novel-length Eren Says line. Clamped here rather than trusted from
-- the client, and the author is pinned to the caller so nobody can
-- attribute an effect to their partner.
create or replace function public.guard_trophy_effect()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.user_id := auth.uid();
  -- Longest privilege is Eren Says at 24h; give it a little slack and cap.
  if new.active_until is not null then
    new.active_until := least(new.active_until, now() + interval '25 hours');
    if new.active_until <= now() then new.active_until := null; end if;
  end if;
  -- Same 120-character limit the client shows a counter for.
  if new.payload ? 'text' then
    new.payload := jsonb_set(new.payload, '{text}',
      to_jsonb(left(coalesce(new.payload->>'text', ''), 120)));
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_guard_trophy_effect on public.trophy_effects;
create trigger trg_guard_trophy_effect
  before insert on public.trophy_effects
  for each row execute function public.guard_trophy_effect();

-- Realtime, so a crown or a decor change lands on the other phone
-- without a reload. eren_stats is already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'trophy_effects'
  ) then
    alter publication supabase_realtime add table public.trophy_effects;
  end if;
end $$;

-- ── Price list seed ─────────────────────────────────────────
-- Generated from src/lib/trophyShop.ts. Re-run that generator (see the
-- header of this file) rather than hand-editing, so the card price and
-- the charged price cannot drift apart.

insert into public.trophy_shop_items (item_id, kind, price, stackable) values
  ('decor_trophy_shelf', 'decor', 40, false),
  ('decor_neon_champ', 'decor', 30, false),
  ('decor_string_lights', 'decor', 18, false),
  ('decor_rosette', 'decor', 16, false),
  ('decor_pennants', 'decor', 10, false),
  ('acc_crown', 'accessory', 35, false),
  ('acc_party_hat', 'accessory', 8, false),
  ('acc_tophat', 'accessory', 14, false),
  ('acc_flowers', 'accessory', 14, false),
  ('acc_cans', 'accessory', 22, false),
  ('acc_shades', 'accessory', 22, false),
  ('acc_medal', 'accessory', 26, false),
  ('acc_bow', 'accessory', 8, true),
  ('priv_eren_says', 'privilege', 20, true),
  ('priv_double_hour', 'privilege', 15, true),
  ('priv_point_steal', 'privilege', 18, true),
  ('priv_streak_shield', 'privilege', 12, true),
  ('priv_decay_freeze', 'privilege', 10, true),
  ('title_bath_boss', 'prestige', 9, false),
  ('title_night_shift', 'prestige', 9, false),
  ('title_head_chef', 'prestige', 9, false),
  ('title_the_menace', 'prestige', 13, false),
  ('title_undefeated', 'prestige', 45, false),
  ('frame_bronze', 'prestige', 8, false),
  ('frame_silver', 'prestige', 16, false),
  ('frame_gold', 'prestige', 28, false),
  ('frame_champion', 'prestige', 50, false)
on conflict (item_id) do update
  set kind = excluded.kind,
      price = excluded.price,
      stackable = excluded.stackable;
