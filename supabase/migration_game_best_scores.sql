-- Per-user-per-game best scores. The leaderboard and the games hub only need
-- max(score) per (user, game), but were downloading every game_scores row
-- ever recorded to compute it client-side. security_invoker makes the
-- existing game_scores RLS policies apply to the calling user (PG15+).
--
-- Paste into the Supabase SQL editor BEFORE deploying the code that reads
-- from game_best_scores.

create or replace view public.game_best_scores
with (security_invoker = on) as
  select user_id, game_type, max(score) as score
  from public.game_scores
  group by user_id, game_type;

grant select on public.game_best_scores to authenticated;
