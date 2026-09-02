-- ============================================================
--  THE WEATHER MACHINE  —  four parts instead of ten skies
--
--  Skies used to be sold one at a time (wx_rain 8 ... wx_aurora 40, from
--  migration_room_weather.sql). Ten cards and a picker full of padlocks made
--  the sky a wardrobe. What the household actually wants to own is the MACHINE
--  in the Lab, so the shelf now sells the four parts it is missing, and the
--  moment the last one goes in every sky in the game is theirs forever.
--
--  Paste this whole file into the Supabase SQL editor. Safe to re-run.
--
--    1. eren_stats.room_weather   re-asserted (this file does not assume
--                                 migration_room_weather.sql was ever pasted)
--    2. the shop's kind check     now also allows 'machine'
--    3. the four parts            10 + 15 + 15 + 20 = 60 trophies
--    4. purchase_trophy_item      refuses a part the HOUSEHOLD already owns
--    5. room_weather reset        see the note above section 5
--
--  NOT included on purpose: any delete of the old wx_* price rows.
--  user_trophy_items.item_id references trophy_shop_items(item_id) ON DELETE
--  CASCADE, so dropping those rows would silently destroy the ownership rows
--  of anyone who actually bought a sky. Orphaned price rows are invisible —
--  the client builds its shelves from its own catalogue and shopItem() simply
--  returns undefined for an id it no longer lists. Same reasoning the decor_*
--  rows were left alone for in migration_room_weather.sql.
-- ============================================================

-- ── 1. Which sky hangs in which room ────────────────────────
-- Household-wide, exactly like room_skins. Re-asserted here rather than
-- assumed: LAUNCH_STATUS.md still lists migration_room_weather.sql as queued,
-- and a file that only half-applies is worse than one that repeats itself.

alter table public.eren_stats
  add column if not exists room_weather jsonb not null default '{}'::jsonb;

-- ── 2. Let the price list hold a machine part ───────────────

alter table public.trophy_shop_items
  drop constraint if exists trophy_shop_items_kind_check;

alter table public.trophy_shop_items
  add constraint trophy_shop_items_kind_check
  check (kind in ('machine', 'weather', 'decor', 'accessory', 'privilege', 'prestige'));

-- 'weather' and 'decor' stay in the list only so the rows already in the table
-- still satisfy it. Nothing sells either any more.

-- ── 3. The four parts ───────────────────────────────────────
-- GENERATED from src/lib/weatherMachine.ts. The price the player is charged
-- comes from HERE, not from the client catalogue; if the two ever disagree the
-- server wins and the card is a lie, so change both together.
--
-- Deliberately NOT stackable: a machine has one of each.

insert into public.trophy_shop_items (item_id, kind, price, stackable) values
  ('wxm_coil',  'machine', 10, false),  -- Condenser Coil
  ('wxm_gauge', 'machine', 15, false),  -- Pressure Gauge
  ('wxm_dish',  'machine', 15, false),  -- Sky Dish
  ('wxm_lever', 'machine', 20, false)   -- Ignition Lever
on conflict (item_id) do update set price = excluded.price, kind = excluded.kind;

-- ── 4. One machine, one household ───────────────────────────
-- The RPC was strictly per-user: it only ever answered 'already_owned' when
-- YOUR row existed. That is right for a title you wear and wrong for a machine
-- standing in a room you share — after she bought the dish it would cheerfully
-- sell him the same dish for another 15 trophies and bolt on nothing.
--
-- The client already refuses (the shop card and the Lab's rack both read
-- household ownership), but a client gate loses to a stale tab, and this is
-- real currency. So the check moves to where it cannot be skipped. Everything
-- else in the function is unchanged from migration_trophy_battle.sql.

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
  v_kind      text;
  v_hh        uuid;
  v_balance   int;
  v_inserted  int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select price, stackable, kind into v_price, v_stackable, v_kind
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

  -- A part either of us already bought is fitted. Charging for it twice would
  -- take 15 trophies and change nothing on the machine.
  --
  -- THE LOCK ABOVE IS NOT ENOUGH FOR THIS CHECK. `for update` holds MY profile
  -- row, which serializes me against myself — it says nothing about her. Two
  -- people tapping the same part in the same second would both read "nobody
  -- owns it", both insert their own row, and both be charged 15 for one part.
  -- So take a lock keyed on (household, item) for the rest of the transaction;
  -- it is the only thing both callers contend on.
  if v_kind = 'machine' then
    v_hh := public.my_household_id();

    -- No household is not a machine — there is nothing for a part to be fitted
    -- to, and the Lab is unreachable. Refuse rather than sell into the void.
    if v_hh is null then
      return jsonb_build_object('ok', false, 'reason', 'no_household', 'balance', v_balance);
    end if;

    perform pg_advisory_xact_lock(hashtext(v_hh::text || ':' || p_item_id));

    if exists (
      select 1
      from public.user_trophy_items ui
      join public.profiles p on p.id = ui.user_id
      where ui.item_id = p_item_id
        and ui.quantity > 0
        and p.household_id = v_hh
    ) then
      return jsonb_build_object('ok', false, 'reason', 'already_owned', 'balance', v_balance);
    end if;
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

-- ── 5. Take the skies down ──────────────────────────────────
-- Every sky has been free while the machine was being built (the client had a
-- WEATHER_ALL_UNLOCKED flag switched on), so households have real entries in
-- room_weather that they never paid for. Leaving them would put a thunderstorm
-- in every window of a house whose machine is a dead husk with 0/4 lamps lit,
-- which reads as a bug rather than as a head start.
--
-- Purely cosmetic and one tap to redo once the machine is built. If you would
-- rather keep the current skies hanging, DELETE THIS ONE STATEMENT — nothing
-- else in the app depends on it.
--
-- SCOPED TO HOUSEHOLDS THAT OWN NO PART, which is what makes the whole file
-- honestly re-runnable. A blanket UPDATE would be a one-time correction the
-- first time and a vandalism every time after: paste this again in six months
-- and it would wipe the skies of every household that had since built the
-- machine and chosen them. Scoped this way it is a no-op on the second run,
-- and stays correct if a household builds the machine between two pastes.

update public.eren_stats s
   set room_weather = '{}'::jsonb
 where s.room_weather <> '{}'::jsonb
   and not exists (
     select 1
     from public.user_trophy_items ui
     join public.profiles p on p.id = ui.user_id
     where p.household_id = s.household_id
       and ui.item_id like 'wxm\_%'
       and ui.quantity > 0
   );
