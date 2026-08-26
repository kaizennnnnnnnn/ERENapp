-- ============================================================
-- SHAWARMA KIOSK: the night's takings, and what the kiosk remembers.
--
--   kiosk_shifts        one row per CLOSED shift. Append-only. Whoever
--                       worked it, what they took, how it graded, and the
--                       note they left at the till for the other one.
--
--                       (household_id, user_id, shift_date) is unique, which
--                       is what makes "one paid shift each per night" a rule
--                       the database keeps rather than a promise the client
--                       makes. shift_date is the player's LOCAL date, sent by
--                       the client — a night that starts at 23:50 belongs to
--                       the day it started in, not to UTC's idea of it.
--
--   eren_stats.kiosk_regulars  household memory: costume id -> the order they
--                       had last time, and how many times they've been served
--                       right. Two, and they start asking for "the usual".
--
--   eren_stats.kiosk_wraps     lifetime wraps served by the household. Drives
--                       the menu unlocks (herb sauce at 25, chips at 50).
--
-- Paste into the Supabase SQL editor (run once) BEFORE deploying the code
-- that reads or writes any of this. Safe to re-run.
-- ============================================================

create table if not exists public.kiosk_shifts (
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id)   on delete cascade,
  shift_date    text not null,                 -- player-local YYYY-MM-DD
  served        int  not null default 0,
  wrong         int  not null default 0,
  walked        int  not null default 0,
  missed_calls  int  not null default 0,
  best_streak   int  not null default 0,
  base          int  not null default 0,
  tips          int  not null default 0,
  grade         text not null default 'D' check (grade in ('S','A','B','C','D')),
  rained        boolean not null default false,
  note          text,
  closed_at     timestamptz not null default now(),
  primary key (household_id, user_id, shift_date)
);

create index if not exists idx_kiosk_shifts_recent
  on public.kiosk_shifts(household_id, closed_at desc);

alter table public.kiosk_shifts enable row level security;

drop policy if exists "household reads kiosk shifts" on public.kiosk_shifts;
drop policy if exists "users insert own kiosk shifts" on public.kiosk_shifts;
drop policy if exists "users update own kiosk shifts" on public.kiosk_shifts;

-- Both partners read every shift: the board on the kiosk front is the whole
-- point, and so is the note left at the till.
create policy "household reads kiosk shifts"
  on public.kiosk_shifts for select
  using (household_id = public.my_household_id());

create policy "users insert own kiosk shifts"
  on public.kiosk_shifts for insert
  with check (household_id = public.my_household_id() and user_id = auth.uid());

-- Only ever used to edit the note you left on your own shift.
create policy "users update own kiosk shifts"
  on public.kiosk_shifts for update
  using (household_id = public.my_household_id() and user_id = auth.uid());

-- The kiosk's memory rides on the shared stats row, like room_skins does.
alter table public.eren_stats
  add column if not exists kiosk_regulars jsonb not null default '{}'::jsonb;

alter table public.eren_stats
  add column if not exists kiosk_wraps int not null default 0;
