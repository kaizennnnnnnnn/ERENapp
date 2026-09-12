-- ═══════════════════════════════════════════════════════════════════════════
-- EQUIP PRESTIGE — the titles and frames you pay trophies for never stuck
--
-- migration_household_takeover_fix.sql:46 does
--
--     REVOKE UPDATE ON public.profiles FROM authenticated;
--     GRANT UPDATE (achievements, avatar_url, ... , xp) ON public.profiles ...
--
-- and its own comment says: "If you ADD a column to profiles later, grant it
-- here or the client can't write it."
--
-- migration_trophy_battle.sql:33,36 then added `equipped_title` and
-- `equipped_frame`, and nothing granted them. useTrophyCosmetics.ts writes
-- both straight from the browser with no `if (error)` check — while
-- saveWeather, twelve lines above it, does check. So the write is refused, the
-- optimistic state makes the title look equipped, and it is gone on reload.
--
-- That is 8 to 50 trophies per item, and trophies are minted in exactly one
-- place: winning the daily battle. A player pays days of care for a crown that
-- silently does not exist.
--
-- AN RPC, NOT A COLUMN GRANT. Adding the two columns to that GRANT list is one
-- line and fixes the symptom, but it lets any client equip any title without
-- ever buying it — and the shop is the only trophy sink in the app, so that
-- empties the whole economy rather than a single item. This is the same call
-- migration_terms_acceptance.sql made, in its own words: "An RPC rather than a
-- column grant ... adding terms_accepted_at to that list would let the client
-- write any value it liked."
--
-- Ownership is the check. The slot comes from the item id prefix, which is how
-- both halves of the app already model it: every prestige item is title_* or
-- frame_*, in src/lib/trophyShop.ts and in the seed rows at
-- migration_trophy_battle.sql:674-682.
--
-- Not affected, and checked: `equipped_accessory` lives on eren_stats, which
-- has no column-level revoke, so that slot has always worked.
--
-- Idempotent. Safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.equip_prestige(p_slot text, p_item_id text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if p_slot not in ('title', 'frame') then
    raise exception 'unknown slot: %', p_slot using errcode = '22023';
  end if;

  -- Null clears the slot. No ownership question to answer: taking something
  -- off is always allowed, including an item that was later removed from the
  -- shop, which would otherwise strand a player wearing it.
  if p_item_id is not null then
    if p_item_id not like p_slot || '\_%' then
      raise exception '% is not a % item', p_item_id, p_slot using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.trophy_shop_items
       where item_id = p_item_id and kind = 'prestige'
    ) then
      raise exception 'no such prestige item: %', p_item_id using errcode = '22023';
    end if;

    -- The actual point of the function.
    if not exists (
      select 1 from public.user_trophy_items
       where user_id = v_uid and item_id = p_item_id
    ) then
      raise exception 'you do not own %', p_item_id using errcode = '42501';
    end if;
  end if;

  if p_slot = 'title' then
    update public.profiles set equipped_title = p_item_id where id = v_uid;
  else
    update public.profiles set equipped_frame = p_item_id where id = v_uid;
  end if;

  return p_item_id;
end $fn$;

revoke all on function public.equip_prestige(text, text) from public;
grant execute on function public.equip_prestige(text, text) to authenticated;


-- ── Verify ────────────────────────────────────────────────────────────────
-- Both rows must say 'ok'. The first proves the function is callable by a
-- signed-in user; the second proves the columns are still NOT directly
-- writable, which is the property the RPC exists to preserve.
select 'equip_prestige is executable by authenticated' as check,
       case when has_function_privilege('authenticated',
              'public.equip_prestige(text,text)', 'execute')
            then 'ok' else '** MISSING **' end as status
union all
select 'equipped_title/frame are NOT directly writable',
       case when has_column_privilege('authenticated', 'public.profiles', 'equipped_title', 'update')
              or has_column_privilege('authenticated', 'public.profiles', 'equipped_frame', 'update')
            then '** DIRECTLY WRITABLE — the RPC is pointless **'
            else 'ok' end;
