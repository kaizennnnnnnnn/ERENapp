-- ============================================================
-- "We Cared" weekly co-op goal: per-user claim of a shared reward.
--   The cooperative counterweight to the Care Battle. Both partners'
--   USEFUL care actions this ISO week are SUMMED toward a shared target
--   (see COOP_WEEKLY_TARGET in src/lib/coopGoal.ts). When the household
--   hits it, EACH partner claims COOP_REWARD_COINS once.
--
--   Progress is DERIVED client-side from `interactions` (no column needed);
--   this table only persists the per-user CLAIM so the reward pays out
--   exactly once per user per week (payout_paid is the CAS guard).
--
--   Per-user rows (vs. one row per week) keep RLS simple — each partner
--   only ever writes their own row, claimed client-side (no cron, same as
--   weekly_battle_results / weekly_game_results).
--
-- Paste into the Supabase SQL editor (run once) BEFORE deploying the
-- code that reads/writes weekly_coop_results.
-- ============================================================

create table if not exists public.weekly_coop_results (
  household_id      uuid not null references public.households(id) on delete cascade,
  user_id           uuid not null references public.profiles(id)   on delete cascade,
  iso_week          text not null,            -- e.g. "2026-W26"
  combined_actions  int  not null default 0,  -- both partners' useful care actions (snapshot at claim)
  goal              int  not null default 0,  -- the target in force when claimed
  payout_coins      int  not null default 0,  -- coins owed to this user for the week
  payout_paid       boolean not null default false,
  created_at        timestamptz not null default now(),
  primary key (household_id, user_id, iso_week)
);

create index if not exists idx_wcr_user_week
  on public.weekly_coop_results(user_id, iso_week desc);

alter table public.weekly_coop_results enable row level security;

drop policy if exists "household reads weekly coop results"  on public.weekly_coop_results;
drop policy if exists "users insert own weekly coop results" on public.weekly_coop_results;
drop policy if exists "users update own weekly coop results" on public.weekly_coop_results;

create policy "household reads weekly coop results"
  on public.weekly_coop_results for select
  using (household_id = public.my_household_id());

create policy "users insert own weekly coop results"
  on public.weekly_coop_results for insert
  with check (
    household_id = public.my_household_id() and user_id = auth.uid()
  );

create policy "users update own weekly coop results"
  on public.weekly_coop_results for update
  using (household_id = public.my_household_id() and user_id = auth.uid());
