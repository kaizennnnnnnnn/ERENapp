-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Gacha System + Couple Features + Daily Fortune
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. USER INVENTORY — tracks owned gacha items + fortune items
create table if not exists public.user_inventory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  item_id      text not null,
  quantity     integer not null default 1,
  equipped     boolean not null default false,
  obtained_at  timestamptz not null default now(),
  unique(user_id, item_id)
);
create index if not exists idx_inventory_user on public.user_inventory(user_id);

-- RLS
alter table public.user_inventory enable row level security;
create policy "Users can read own inventory" on public.user_inventory for select using (auth.uid() = user_id);
create policy "Users can insert own inventory" on public.user_inventory for insert with check (auth.uid() = user_id);
create policy "Users can update own inventory" on public.user_inventory for update using (auth.uid() = user_id);

-- 2. GACHA PULL LOG — tracks every pull for history + pity
create table if not exists public.gacha_pull_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  banner_id    text not null,
  item_id      text not null,
  rarity       text not null check (rarity in ('common','rare','epic','legendary')),
  pull_number  integer not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_pulls_user_banner on public.gacha_pull_log(user_id, banner_id);

-- RLS
alter table public.gacha_pull_log enable row level security;
create policy "Users can read own pulls" on public.gacha_pull_log for select using (auth.uid() = user_id);
create policy "Users can insert own pulls" on public.gacha_pull_log for insert with check (auth.uid() = user_id);

-- 3. USER GACHA STATE — pity counters + stardust + fortune tracking
create table if not exists public.user_gacha_state (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  stardust             integer not null default 0,
  pulls_since_epic     integer not null default 0,
  pulls_since_legendary integer not null default 0,
  total_pulls          integer not null default 0,
  gacha_tickets        integer not null default 0,
  last_free_fortune    timestamptz
);

-- RLS
alter table public.user_gacha_state enable row level security;
create policy "Users can read own state" on public.user_gacha_state for select using (auth.uid() = user_id);
create policy "Users can insert own state" on public.user_gacha_state for insert with check (auth.uid() = user_id);
create policy "Users can update own state" on public.user_gacha_state for update using (auth.uid() = user_id);

-- 4. COUPLE JOURNAL — messages between partners delivered by Eren
create table if not exists public.couple_journal (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  message       text not null,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_journal_household on public.couple_journal(household_id, created_at desc);

-- RLS — household members can read/write
alter table public.couple_journal enable row level security;
create policy "Household members can read journal" on public.couple_journal for select
  using (household_id in (select household_id from public.profiles where id = auth.uid()));
create policy "Users can send journal messages" on public.couple_journal for insert
  with check (auth.uid() = sender_id);
create policy "Users can mark messages read" on public.couple_journal for update
  using (household_id in (select household_id from public.profiles where id = auth.uid()));

-- Enable realtime for journal (Eren delivers messages live)
alter publication supabase_realtime add table public.couple_journal;

-- Done!
