-- ============================================================
--  SUPERSEDED by migration_weather_machine.sql. DO NOT PASTE THIS FILE.
--
--  Skies are no longer sold one at a time; the four parts of the machine in
--  the Lab are. The newer file re-asserts everything below that still matters
--  (the room_weather column, the kind check) so this one has nothing left to
--  add — and re-adding section 2 would now FAIL, because it rebuilds the kind
--  constraint without 'machine' while machine rows exist. Kept only as the
--  record of where room_weather came from.
-- ============================================================
--
--  ROOM WEATHER  —  the sky outside each room's window
--
--  Replaces the room-decor shelf, which is gone from the client. Decor asked
--  you to hang a bought prop on a painted wall; weather changes what is
--  OUTSIDE, through the window every room already had.
--
--  Paste this whole file into the Supabase SQL editor. Safe to re-run.
--
--    1. eren_stats.room_weather   which sky hangs in which room (household)
--    2. the shop's kind check     now allows 'weather'
--    3. the price list            ten skies, generated from src/lib/weather.ts
--
--  NOT included on purpose: any cleanup of the old decor_* rows. Nobody has
--  bought one (the shelf shipped and was removed inside two days), and a
--  DELETE that is wrong is worse than a handful of dead rows that no client
--  can see. If you want them gone later:
--    delete from public.user_trophy_items where item_id like 'decor_%';
--    delete from public.trophy_shop_items  where item_id like 'decor_%';
-- ============================================================

-- ── 1. Which sky hangs in which room ────────────────────────
-- Household-wide, exactly like room_skins: there is one house, and the storm
-- she put over the bath should still be there when you open the door. A room
-- with no key showing is showing 'clear' — the sky the artist painted.

alter table public.eren_stats
  add column if not exists room_weather jsonb not null default '{}'::jsonb;

-- ── 2. Let the price list hold a sky ────────────────────────

alter table public.trophy_shop_items
  drop constraint if exists trophy_shop_items_kind_check;

alter table public.trophy_shop_items
  add constraint trophy_shop_items_kind_check
  check (kind in ('weather', 'decor', 'accessory', 'privilege', 'prestige'));

-- 'decor' stays in the list only so the rows already in the table still
-- satisfy the constraint. Nothing sells it any more.

-- ── 3. The skies ────────────────────────────────────────────
-- GENERATED from src/lib/weather.ts. The price the player is charged comes
-- from HERE, not from the client catalogue; if the two ever disagree the
-- server wins and the card is a lie, so change both together.
--
-- 'clear' is deliberately absent: it is the absence of a layer, it is free,
-- and the machine in the Lab treats it as always owned.

insert into public.trophy_shop_items (item_id, kind, price, stackable) values
  ('wx_rain', 'weather', 8, false),  -- Rain
  ('wx_snow', 'weather', 8, false),  -- Snowfall
  ('wx_sunrise', 'weather', 14, false),  -- Sunrise
  ('wx_sunset', 'weather', 14, false),  -- Sunset
  ('wx_petals', 'weather', 14, false),  -- Petal Drift
  ('wx_storm', 'weather', 22, false),  -- Thunderstorm
  ('wx_fireflies', 'weather', 22, false),  -- Fireflies
  ('wx_meteors_gold', 'weather', 22, false),  -- Meteor Shower
  ('wx_meteors_rose', 'weather', 22, false),  -- Rose Meteors
  ('wx_aurora', 'weather', 40, false)  -- Aurora
on conflict (item_id) do update set price = excluded.price, kind = excluded.kind;
