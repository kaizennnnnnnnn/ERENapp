-- ============================================================
-- JELLY PROGRESS — the daily tray, the Super Jelly, and the long
-- road to Eren Jelly.
--
-- REPLACES the old rule, where owning all five flavours once
-- unlocked the skin on day one. The loop is now:
--
--   • Each DAY the tray of five empties. A won round fills one slot.
--   • Filling the fifth slot mints ONE Super Jelly.
--   • A Super Jelly is fed to Eren; feeding FIVE of them earns the
--     Eren Jelly skin.
--
-- So the skin is a five-day commitment at the very fastest, and
-- each of those days is its own complete little goal.
--
-- One row per user. `day` + `flavours` are the tray and reset
-- themselves lazily — the first collect of a new day notices the
-- date moved and empties the tray, so there is no cron and no
-- midnight job to miss. `supers` and `fed` are lifetime counters
-- and deliberately survive the reset.
--
-- Both writes are RPCs rather than client updates because both are
-- read-modify-write decisions ("is this the fifth?", "is this the
-- fifth FEED?") where two devices finishing a round at the same
-- moment must not both mint a prize. SELECT ... FOR UPDATE makes
-- the row the lock, exactly as purchase_skin_with_stardust does.
--
-- Paste into the Supabase SQL editor (run once). Safe to re-run.
-- ============================================================

create table if not exists public.jelly_progress (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  -- The tray: which UTC day it belongs to, and the flavours on it.
  day        date  not null default ((now() at time zone 'utc')::date),
  flavours   jsonb not null default '[]'::jsonb,
  -- Lifetime: Super Jellies held but not yet fed, and Super Jellies fed.
  supers     int   not null default 0 check (supers >= 0),
  fed        int   not null default 0 check (fed >= 0),
  updated_at timestamptz not null default now()
);

alter table public.jelly_progress enable row level security;

drop policy if exists "users read own jelly progress" on public.jelly_progress;

-- Read-only to the client. Every write goes through the two RPCs below, so
-- there is no client path that can mint a Super Jelly or a feed.
create policy "users read own jelly progress"
  on public.jelly_progress for select
  using (user_id = auth.uid());

-- ── Collect one flavour ─────────────────────────────────────
-- Called once per won round with the flavour the round rolled.
create or replace function public.collect_jelly(p_flavour text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tray      constant int := 5;   -- flavours that make a full tray
  v_uid       uuid := auth.uid();
  v_today     date := (now() at time zone 'utc')::date;
  v_row       public.jelly_progress;
  v_flavours  jsonb;
  v_is_new    boolean;
  v_super     boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if p_flavour is null or p_flavour not in ('red', 'green', 'purple', 'yellow', 'orange') then
    return jsonb_build_object('ok', false, 'reason', 'bad_flavour');
  end if;

  -- Make sure a row exists, then take it for the rest of the transaction.
  insert into public.jelly_progress (user_id, day)
  values (v_uid, v_today)
  on conflict (user_id) do nothing;

  select * into v_row from public.jelly_progress where user_id = v_uid for update;

  -- Lazy daily reset. Checked HERE rather than by a cron so the tray is always
  -- correct at the moment it matters, in whatever timezone the player wakes up.
  if v_row.day <> v_today then
    v_row.flavours := '[]'::jsonb;
  end if;

  -- `@>` rather than `?`: containment tests an array element the same way and
  -- keeps the function free of a character some clients treat as a placeholder.
  v_is_new := not (v_row.flavours @> to_jsonb(p_flavour));
  v_flavours := case when v_is_new then v_row.flavours || to_jsonb(p_flavour) else v_row.flavours end;

  -- Only the TRANSITION to a full tray pays. A tray can't reach five twice in
  -- one day, so this cannot double-mint however many rounds follow.
  v_super := v_is_new and jsonb_array_length(v_flavours) >= c_tray;

  update public.jelly_progress
  set day        = v_today,
      flavours   = v_flavours,
      supers     = supers + (case when v_super then 1 else 0 end),
      updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'flavour', p_flavour,
    'is_new', v_is_new,
    'today', v_row.flavours,
    'count', jsonb_array_length(v_row.flavours),
    'super_awarded', v_super,
    'supers', v_row.supers,
    'fed', v_row.fed
  );
end;
$$;

grant execute on function public.collect_jelly(text) to authenticated;

-- ── Feed one Super Jelly ────────────────────────────────────
-- Spends a Super Jelly. The fifth one ever fed grants Eren Jelly, and the
-- grant happens HERE, inside the same transaction that spent the jelly, so a
-- dropped connection can't leave a player five-fed with no skin.
create or replace function public.feed_super_jelly()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_goal    constant int  := 5;             -- feeds that earn the skin
  c_skin    constant text := 'skin_jelly';
  v_uid     uuid := auth.uid();
  v_row     public.jelly_progress;
  v_granted boolean := false;
  v_rows    int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select * into v_row from public.jelly_progress where user_id = v_uid for update;
  if not found or v_row.supers < 1 then
    return jsonb_build_object('ok', false, 'reason', 'none');
  end if;

  update public.jelly_progress
  set supers = supers - 1, fed = fed + 1, updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  if v_row.fed >= c_goal then
    insert into public.user_inventory (user_id, item_id, quantity, equipped)
    values (v_uid, c_skin, 1, false)
    on conflict (user_id, item_id) do nothing;
    get diagnostics v_rows = row_count;
    -- TRUE only on the insert that actually created the row, so the unlock
    -- cinematic plays exactly once even if two devices race the fifth feed.
    v_granted := v_rows > 0;
  end if;

  return jsonb_build_object(
    'ok', true,
    'supers', v_row.supers,
    'fed', v_row.fed,
    'goal', c_goal,
    'skin_granted', v_granted
  );
end;
$$;

grant execute on function public.feed_super_jelly() to authenticated;

-- ── Retire the old per-flavour inventory rows ───────────────
-- Jellies used to be owned forever as user_inventory rows. Nothing reads them
-- now (the tray above is the only source of truth), and leaving them behind
-- would strand five mystery items in a table that is otherwise all skins and
-- gacha prizes. The skin itself ('skin_jelly') is NOT touched.
delete from public.user_inventory
where item_id in ('jelly_red', 'jelly_green', 'jelly_purple', 'jelly_yellow', 'jelly_orange');
