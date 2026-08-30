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
--   3. claim_daily_trophy()      — one-shot mint, server-derived
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

-- A client may update its own profile row (existing RLS), so it could
-- in principle write `trophies` directly. That is no worse than the
-- coins column it already writes, but the mint path below never trusts
-- the client for the AMOUNT: the tier and the streak bonus are derived
-- server-side from rows the client cannot forge into a different shape
-- without also lying about the scoreboard both partners can see.

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

-- ── 3. claim_daily_trophy ───────────────────────────────────
-- Mints the trophies for ONE finished day, at most once.
--
-- The client says only WHICH day. Everything that decides the payout —
-- the margin, the tier, the win streak — is read back off rows already
-- in the table. Mirrors purchase_skin_with_stardust, where the price is
-- likewise server-side, and claimComebackBonus, whose false→true CAS on
-- a boolean is what makes it exactly-once.
--
-- Tier table MUST match trophyTier() / TROPHY_VALUE in
-- src/lib/dailyTwist.ts.

create or replace function public.claim_daily_trophy(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_row      public.daily_battle_results%rowtype;
  v_margin   int;
  v_tier     text;
  v_amount   int := 0;
  v_streak   int := 0;
  v_updated  int;
  v_balance  int;
  v_cursor   date;
  v_outcome  text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  -- Today is not over. Settling it early would pay for a lead that can
  -- still evaporate, and would burn the one-shot.
  if p_date >= current_date then
    return jsonb_build_object('ok', false, 'reason', 'not_finished');
  end if;

  select * into v_row
  from public.daily_battle_results
  where user_id = v_uid and date = p_date
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_row');
  end if;

  if v_row.trophy_claimed then
    select trophies into v_balance from public.profiles where id = v_uid;
    return jsonb_build_object(
      'ok', false, 'reason', 'already_claimed',
      'tier', v_row.trophy_tier, 'trophies', 0,
      'balance', coalesce(v_balance, 0));
  end if;

  v_margin := v_row.score - v_row.partner_score;

  -- Tier by margin — keep identical to trophyTier() in dailyTwist.ts.
  v_tier := case
    when v_margin >= 6 then 'gold'
    when v_margin >= 3 then 'silver'
    when v_margin >= 1 then 'bronze'
    else null
  end;

  -- Base value — keep identical to TROPHY_VALUE.
  v_amount := case v_tier
    when 'gold'   then 3
    when 'silver' then 2
    when 'bronze' then 1
    else 0
  end;

  -- Win streak ending on this date, counted backwards over consecutive
  -- CALENDAR days. A gap day (nobody played) ends the streak, which is
  -- the same rule the care streak uses.
  if v_tier is not null then
    -- Walked one calendar day at a time rather than done with a window
    -- function, because the rule is "no gap": a day with no row at all
    -- (nobody played) breaks the streak, and a set-based version has to
    -- reconstruct that absence anyway. 365 is a guard, not a rule.
    v_cursor := p_date;
    loop
      select outcome into v_outcome
      from public.daily_battle_results
      where user_id = v_uid and date = v_cursor;

      exit when v_outcome is null or v_outcome <> 'win';
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
      exit when v_streak >= 365;
    end loop;

    -- Every third win in a row pays a bonus. Keep identical to
    -- streakBonus() in dailyTwist.ts.
    if v_streak > 0 and v_streak % 3 = 0 then
      v_amount := v_amount + 2;
    end if;
  else
    -- Consolation: lost by 2 or less, having actually shown up.
    -- Keep identical to consolationTrophies().
    if (v_row.partner_score - v_row.score) between 1 and 2
       and v_row.score >= 3 then
      v_amount := 1;
    end if;
  end if;

  -- CAS. Only the first caller for this (user, date) gets rowcount 1.
  update public.daily_battle_results
     set trophy_claimed   = true,
         trophy_tier      = v_tier,
         trophies_awarded = v_amount
   where user_id = v_uid
     and date = p_date
     and trophy_claimed = false;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    select trophies into v_balance from public.profiles where id = v_uid;
    return jsonb_build_object(
      'ok', false, 'reason', 'already_claimed',
      'tier', v_tier, 'trophies', 0, 'balance', coalesce(v_balance, 0));
  end if;

  update public.profiles
     set trophies = trophies + v_amount
   where id = v_uid
  returning trophies into v_balance;

  return jsonb_build_object(
    'ok', true,
    'tier', v_tier,
    'trophies', v_amount,
    'streak', v_streak,
    'balance', coalesce(v_balance, 0));
end;
$$;

grant execute on function public.claim_daily_trophy(date) to authenticated;

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
create policy "users update own trophy items"
  on public.user_trophy_items for update
  using (user_id = auth.uid());

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
