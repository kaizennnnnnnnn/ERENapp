-- ============================================================
-- Minigame weekly competition: per-user weekly games-won result.
--   Mirrors weekly_battle_results (the Care Battle weekly champion),
--   but the metric is GAMES WON, not a summed score: for each game
--   type, whoever has the higher best score THAT ISO WEEK wins that
--   game; the champion is whoever won more individual games.
--
--   payout_coins is the coins this user is owed for the week
--   (champion/tie = 100, loser who played = 25, otherwise 0).
--   payout_paid is the CAS guard so the bonus pays out exactly once;
--   acknowledged gates the one-time champion popup.
--
-- Per-user rows (vs. one row per week) keep RLS simple — each
-- partner only ever writes their own row, settled client-side on
-- load (no cron, same as weekly_battle_results).
--
-- Paste into the Supabase SQL editor (run once) BEFORE deploying the
-- code that reads/writes weekly_game_results.
-- ============================================================

create table if not exists public.weekly_game_results (
  household_id        uuid not null references public.households(id) on delete cascade,
  user_id             uuid not null references public.profiles(id)   on delete cascade,
  iso_week            text not null,            -- e.g. "2026-W22"
  games_won           int  not null default 0,  -- games where MY weekly-best beat partner's
  partner_games_won   int  not null default 0,
  outcome             text not null check (outcome in ('win','loss','tie')),
  payout_coins        int  not null default 0,  -- coins owed to this user for the week
  payout_paid         boolean not null default false,
  acknowledged        boolean not null default false,
  created_at          timestamptz not null default now(),
  primary key (household_id, user_id, iso_week)
);

create index if not exists idx_wgr_user_week
  on public.weekly_game_results(user_id, iso_week desc);

alter table public.weekly_game_results enable row level security;

drop policy if exists "household reads weekly game results"  on public.weekly_game_results;
drop policy if exists "users insert own weekly game results" on public.weekly_game_results;
drop policy if exists "users update own weekly game results" on public.weekly_game_results;

create policy "household reads weekly game results"
  on public.weekly_game_results for select
  using (household_id = public.my_household_id());

create policy "users insert own weekly game results"
  on public.weekly_game_results for insert
  with check (
    household_id = public.my_household_id() and user_id = auth.uid()
  );

create policy "users update own weekly game results"
  on public.weekly_game_results for update
  using (household_id = public.my_household_id() and user_id = auth.uid());
