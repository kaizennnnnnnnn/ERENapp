-- ============================================================
-- Talking to Eren — /talk
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Two tables, both scoped to ONE user, not the household. The chat is
-- deliberately private per person: if Eren carried facts across the two
-- threads he would leak "Jovan told me X" into her conversation, which
-- breaks the whole promise of a private chat with your cat.
--
-- Note the names: `memories` already exists and holds photos. These are
-- `eren_chat_*` so the two never get confused.
-- ============================================================

-- ─────────────────────────────────────────────────
-- 1. CHAT MESSAGES
--    The transcript. `role` mirrors the API's own vocabulary so rows can
--    be replayed into the model untouched.
-- ─────────────────────────────────────────────────
create table if not exists public.eren_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz not null default now()
);

-- The hot path is "last N messages for this user", newest first.
create index if not exists idx_eren_chat_user
  on public.eren_chat_messages(user_id, created_at desc);

-- ─────────────────────────────────────────────────
-- 2. CHAT MEMORIES
--    Facts Eren decided were worth keeping, written by him via the
--    `remember` tool — never by the client. Capped in the API route at
--    MEMORY_CAP; every stored fact rides in the prompt on every single
--    message, so an uncapped table is a slow cost leak.
-- ─────────────────────────────────────────────────
create table if not exists public.eren_chat_memories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  fact         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_eren_chat_memories_user
  on public.eren_chat_memories(user_id, created_at desc);

-- ─────────────────────────────────────────────────
-- 3. RLS — strictly own-rows-only on both tables
-- ─────────────────────────────────────────────────
alter table public.eren_chat_messages enable row level security;
alter table public.eren_chat_memories enable row level security;

drop policy if exists "own chat messages" on public.eren_chat_messages;
create policy "own chat messages"
  on public.eren_chat_messages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own chat memories" on public.eren_chat_memories;
create policy "own chat memories"
  on public.eren_chat_memories for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
