-- ============================================================
-- Pocket Eren — Complete Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────
-- 1. HOUSEHOLDS
--    Groups two users together as Eren's caretakers
-- ─────────────────────────────────────────────────
create table public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Our Home',
  invite_code  text unique not null default upper(substring(gen_random_uuid()::text from 1 for 8)),
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────
-- 2. PROFILES
--    Extends auth.users with app-specific data
-- ─────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  avatar_url    text,
  household_id  uuid references public.households(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────
-- 3. EREN STATS
--    One row per household — the single source of truth
-- ─────────────────────────────────────────────────
create table public.eren_stats (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null unique references public.households(id) on delete cascade,
  happiness     integer not null default 80 check (happiness between 0 and 100),
  hunger        integer not null default 80 check (hunger between 0 and 100),
  energy        integer not null default 80 check (energy between 0 and 100),
  sleep_quality integer not null default 80 check (sleep_quality between 0 and 100),
  weight        numeric(4,2) not null default 4.50,
  mood          text not null default 'idle'
                  check (mood in ('idle','happy','hungry','sleepy','playful','angry')),
  updated_at    timestamptz not null default now()
);

-- Auto-decay stats every hour via a pg_cron job (set up separately)
-- See SETUP.md for the cron configuration

-- ─────────────────────────────────────────────────
-- 4. INTERACTIONS
--    Every time a user does something with Eren
-- ─────────────────────────────────────────────────
create table public.interactions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  action_type   text not null
                  check (action_type in ('feed','play','sleep','clean','pet','medicine','brush')),
  happiness_delta  integer not null default 0,
  hunger_delta     integer not null default 0,
  energy_delta     integer not null default 0,
  sleep_delta      integer not null default 0,
  weight_delta     numeric(3,2) not null default 0,
  note          text,
  created_at    timestamptz not null default now()
);

create index idx_interactions_household on public.interactions(household_id);
create index idx_interactions_user     on public.interactions(user_id);
create index idx_interactions_created  on public.interactions(created_at desc);

-- ─────────────────────────────────────────────────
-- 5. DAILY MOODS
--    One entry per user per day — how they're feeling
-- ─────────────────────────────────────────────────
create table public.daily_moods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mood        text not null
                check (mood in ('good','mid','sad','angry','tired')),
  note        text,
  date        date not null default current_date,
  created_at  timestamptz not null default now(),
  unique(user_id, date)
);

create index idx_daily_moods_user on public.daily_moods(user_id, date desc);

-- ─────────────────────────────────────────────────
-- 6. REMINDERS
--    Feed Eren, clean litter, give medicine, etc.
-- ─────────────────────────────────────────────────
create table public.reminders (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households(id) on delete cascade,
  created_by       uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  description      text,
  reminder_type    text not null
                     check (reminder_type in ('feed','litter','medicine','vet','groom','play','custom')),
  repeat_interval  text check (repeat_interval in ('once','daily','weekly','monthly')),
  next_due         timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index idx_reminders_household on public.reminders(household_id, is_active);

-- ─────────────────────────────────────────────────
-- 7. REMINDER LOGS
--    Track who completed a reminder and when
-- ─────────────────────────────────────────────────
create table public.reminder_logs (
  id           uuid primary key default gen_random_uuid(),
  reminder_id  uuid not null references public.reminders(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  note         text
);

create index idx_reminder_logs_reminder on public.reminder_logs(reminder_id);

-- ─────────────────────────────────────────────────
-- 8. MEMORIES
--    Photos and text memories of Eren
-- ─────────────────────────────────────────────────
create table public.memories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  image_url     text,
  text          text,
  tags          text[] default '{}',
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_memories_household on public.memories(household_id, created_at desc);

-- ─────────────────────────────────────────────────
-- 9. TIME SPENT
--    Track session time per user for the "time with Eren" feature
-- ─────────────────────────────────────────────────
create table public.time_spent (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  session_start    timestamptz not null,
  session_end      timestamptz,
  duration_seconds integer generated always as (
    extract(epoch from (session_end - session_start))::integer
  ) stored,
  date             date not null default current_date
);

create index idx_time_spent_user on public.time_spent(user_id, date desc);

-- ─────────────────────────────────────────────────
-- 10. GAME SCORES
--     High scores for mini games
-- ─────────────────────────────────────────────────
create table public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_type  text not null
               check (game_type in ('catch_mouse','yarn_chase','paw_tap')),
  score      integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_game_scores_user on public.game_scores(user_id, game_type);

-- ─────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────

alter table public.households      enable row level security;
alter table public.profiles        enable row level security;
alter table public.eren_stats      enable row level security;
alter table public.interactions    enable row level security;
alter table public.daily_moods     enable row level security;
alter table public.reminders       enable row level security;
alter table public.reminder_logs   enable row level security;
alter table public.memories        enable row level security;
alter table public.time_spent      enable row level security;
alter table public.game_scores     enable row level security;

-- ─── Helper: get current user's household_id ─────
create or replace function public.my_household_id()
returns uuid as $$
  select household_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ─── HOUSEHOLDS ──────────────────────────────────
create policy "Users can read their household"
  on public.households for select
  using (id = public.my_household_id());

create policy "Users can create a household"
  on public.households for insert
  with check (true);

create policy "Household members can update household"
  on public.households for update
  using (id = public.my_household_id());

-- ─── PROFILES ────────────────────────────────────
create policy "Anyone can read profiles in same household"
  on public.profiles for select
  using (
    id = auth.uid() or
    household_id = public.my_household_id()
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ─── EREN STATS ──────────────────────────────────
create policy "Household members can read stats"
  on public.eren_stats for select
  using (household_id = public.my_household_id());

create policy "Household members can update stats"
  on public.eren_stats for update
  using (household_id = public.my_household_id());

create policy "Household members can insert stats"
  on public.eren_stats for insert
  with check (household_id = public.my_household_id());

-- ─── INTERACTIONS ────────────────────────────────
create policy "Household members can read interactions"
  on public.interactions for select
  using (household_id = public.my_household_id());

create policy "Authenticated users can insert interactions"
  on public.interactions for insert
  with check (
    household_id = public.my_household_id() and
    user_id = auth.uid()
  );

-- ─── DAILY MOODS ─────────────────────────────────
-- Both partners can see each other's moods (that's the fun part!)
create policy "Household members can read moods"
  on public.daily_moods for select
  using (
    user_id = auth.uid() or
    user_id in (
      select id from public.profiles
      where household_id = public.my_household_id()
    )
  );

create policy "Users can insert own mood"
  on public.daily_moods for insert
  with check (user_id = auth.uid());

create policy "Users can update own mood"
  on public.daily_moods for update
  using (user_id = auth.uid());

-- ─── REMINDERS ───────────────────────────────────
create policy "Household members can read reminders"
  on public.reminders for select
  using (household_id = public.my_household_id());

create policy "Household members can create reminders"
  on public.reminders for insert
  with check (
    household_id = public.my_household_id() and
    created_by = auth.uid()
  );

create policy "Household members can update reminders"
  on public.reminders for update
  using (household_id = public.my_household_id());

create policy "Household members can delete reminders"
  on public.reminders for delete
  using (household_id = public.my_household_id());

-- ─── REMINDER LOGS ───────────────────────────────
create policy "Household members can read reminder logs"
  on public.reminder_logs for select
  using (
    reminder_id in (
      select id from public.reminders
      where household_id = public.my_household_id()
    )
  );

create policy "Users can log reminder completions"
  on public.reminder_logs for insert
  with check (user_id = auth.uid());

-- ─── MEMORIES ────────────────────────────────────
create policy "Household members can read memories"
  on public.memories for select
  using (household_id = public.my_household_id());

create policy "Household members can add memories"
  on public.memories for insert
  with check (
    household_id = public.my_household_id() and
    user_id = auth.uid()
  );

create policy "Users can update own memories"
  on public.memories for update
  using (user_id = auth.uid());

create policy "Users can delete own memories"
  on public.memories for delete
  using (user_id = auth.uid());

-- ─── TIME SPENT ──────────────────────────────────
create policy "Household members can read time spent"
  on public.time_spent for select
  using (
    user_id = auth.uid() or
    user_id in (
      select id from public.profiles
      where household_id = public.my_household_id()
    )
  );

create policy "Users can insert own sessions"
  on public.time_spent for insert
  with check (user_id = auth.uid());

create policy "Users can update own sessions"
  on public.time_spent for update
  using (user_id = auth.uid());

-- ─── GAME SCORES ─────────────────────────────────
create policy "Household members can read scores"
  on public.game_scores for select
  using (
    user_id = auth.uid() or
    user_id in (
      select id from public.profiles
      where household_id = public.my_household_id()
    )
  );

create policy "Users can insert own scores"
  on public.game_scores for insert
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────
-- REALTIME — enable for live stat updates
-- ─────────────────────────────────────────────────
-- Run these in the Supabase Realtime settings too:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.eren_stats;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_moods;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;

-- ─────────────────────────────────────────────────
-- STORAGE BUCKETS (run after schema)
-- ─────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public)
-- values ('memories', 'memories', true);
-- insert into storage.buckets (id, name, public)
-- values ('avatars', 'avatars', true);
