-- Donut effects: the visible mark a special donut leaves on Eren for a while.
--
-- Household-scoped on purpose. Feeding him the Neon Slime donut should be
-- something the other person walks in on, so it rides the eren_stats row that
-- both clients already subscribe to via realtime.
--
-- Shape: { "id": "glow" | "gilded" | "confetti" | "zoomies",
--          "until": "2026-08-13T18:22:00.000Z" }
-- NULL, or an `until` in the past, both mean nothing is running — nothing ever
-- clears the column, so every reader goes through liveDonutEffect().

alter table public.eren_stats
  add column if not exists donut_effect jsonb;
