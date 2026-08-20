-- ============================================================
-- JELLY PARLOUR — daily duel scores + the once-a-day bonus marker.
--
-- Two games (slice, jump). Every finished round writes a row to
-- jelly_scores; "personal best" and "her best today" are both just
-- queries over it, so there is no separate best-score column to
-- drift out of sync with the runs that produced it.
--
-- jelly_duel_leads is the anti-farm guard for the bonus jelly. The
-- bonus is awarded the moment you take today's lead in a game, and
-- the PRIMARY KEY (household_id, user_id, game, day) makes that
-- exactly once per person per game per day: the insert either lands
-- (you get the jelly) or violates the key (you already had your
-- bonus today). It is deliberately NOT "one winner per day" — if she
-- takes the lead back, she earns hers too, which is the point of a
-- duel. Nobody can farm it by trading the lead all evening.
--
-- No cron and no settle step: both facts are decided by the insert
-- itself, client-side, the same way weekly_game_results settles.
--
-- Paste into the Supabase SQL editor (run once) BEFORE deploying the
-- Jelly Parlour. Safe to re-run.
-- ============================================================

create table if not exists public.jelly_scores (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id)   on delete cascade,
  game          text not null check (game in ('slice','jump')),
  score         int  not null check (score >= 0),
  day           date not null default ((now() at time zone 'utc')::date),
  created_at    timestamptz not null default now()
);

-- The two reads this table exists for: today's duel board (household,
-- game, day) and a player's all-time best (user, game).
create index if not exists idx_jelly_scores_duel
  on public.jelly_scores(household_id, game, day, score desc);
create index if not exists idx_jelly_scores_best
  on public.jelly_scores(user_id, game, score desc);

alter table public.jelly_scores enable row level security;

drop policy if exists "household reads jelly scores" on public.jelly_scores;
drop policy if exists "users insert own jelly scores" on public.jelly_scores;

-- The whole household reads: you can't duel someone whose score you can't see.
create policy "household reads jelly scores"
  on public.jelly_scores for select
  using (household_id = public.my_household_id());

create policy "users insert own jelly scores"
  on public.jelly_scores for insert
  with check (
    household_id = public.my_household_id() and user_id = auth.uid()
  );

-- ── Bonus-jelly marker ──────────────────────────────────────
create table if not exists public.jelly_duel_leads (
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id)   on delete cascade,
  game          text not null check (game in ('slice','jump')),
  day           date not null default ((now() at time zone 'utc')::date),
  created_at    timestamptz not null default now(),
  primary key (household_id, user_id, game, day)
);

alter table public.jelly_duel_leads enable row level security;

drop policy if exists "household reads jelly duel leads" on public.jelly_duel_leads;
drop policy if exists "users insert own jelly duel leads" on public.jelly_duel_leads;

create policy "household reads jelly duel leads"
  on public.jelly_duel_leads for select
  using (household_id = public.my_household_id());

create policy "users insert own jelly duel leads"
  on public.jelly_duel_leads for insert
  with check (
    household_id = public.my_household_id() and user_id = auth.uid()
  );
