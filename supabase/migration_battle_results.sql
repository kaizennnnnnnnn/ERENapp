-- ============================================================
-- Phase 2 competition spine: daily + weekly battle result history
--   * daily_battle_results — per-user daily score + win/loss/tie
--     so we can render lifetime W-L-T, detect comebacks, and pay
--     out one-time 10-coin comeback bonuses without re-querying
--     the entire interactions table.
--   * weekly_battle_results — same shape for the weighted weekly
--     love-meter race, with payout_paid + acknowledged flags so the
--     100-coin Weekly Champion bonus pays out exactly once and the
--     popup shows exactly once.
-- Per-user rows (vs. one row per match) keep RLS simple — each
-- partner only ever writes their own row.
-- ============================================================

create table if not exists public.daily_battle_results (
  household_id     uuid not null references public.households(id) on delete cascade,
  user_id          uuid not null references public.profiles(id)   on delete cascade,
  date             date not null,
  score            int  not null default 0,
  partner_score    int  not null default 0,
  outcome          text not null check (outcome in ('win','loss','tie')),
  comeback_claimed boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (household_id, user_id, date)
);

create index if not exists idx_dbr_user_date
  on public.daily_battle_results(user_id, date desc);

create index if not exists idx_dbr_household_date
  on public.daily_battle_results(household_id, date desc);

alter table public.daily_battle_results enable row level security;

drop policy if exists "household reads daily battle results"  on public.daily_battle_results;
drop policy if exists "users insert own daily battle results" on public.daily_battle_results;
drop policy if exists "users update own daily battle results" on public.daily_battle_results;

create policy "household reads daily battle results"
  on public.daily_battle_results for select
  using (household_id = public.my_household_id());

create policy "users insert own daily battle results"
  on public.daily_battle_results for insert
  with check (
    household_id = public.my_household_id() and user_id = auth.uid()
  );

create policy "users update own daily battle results"
  on public.daily_battle_results for update
  using (household_id = public.my_household_id() and user_id = auth.uid());

-- ── Weekly ──────────────────────────────────────────────────

create table if not exists public.weekly_battle_results (
  household_id   uuid not null references public.households(id) on delete cascade,
  user_id        uuid not null references public.profiles(id)   on delete cascade,
  iso_week       text not null, -- e.g. "2026-W22"
  score          int  not null default 0,
  partner_score  int  not null default 0,
  outcome        text not null check (outcome in ('win','loss','tie')),
  payout_paid    boolean not null default false,
  acknowledged   boolean not null default false,
  created_at     timestamptz not null default now(),
  primary key (household_id, user_id, iso_week)
);

create index if not exists idx_wbr_user_week
  on public.weekly_battle_results(user_id, iso_week desc);

alter table public.weekly_battle_results enable row level security;

drop policy if exists "household reads weekly battle results"  on public.weekly_battle_results;
drop policy if exists "users insert own weekly battle results" on public.weekly_battle_results;
drop policy if exists "users update own weekly battle results" on public.weekly_battle_results;

create policy "household reads weekly battle results"
  on public.weekly_battle_results for select
  using (household_id = public.my_household_id());

create policy "users insert own weekly battle results"
  on public.weekly_battle_results for insert
  with check (
    household_id = public.my_household_id() and user_id = auth.uid()
  );

create policy "users update own weekly battle results"
  on public.weekly_battle_results for update
  using (household_id = public.my_household_id() and user_id = auth.uid());
