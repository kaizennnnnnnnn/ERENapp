-- ============================================================================
-- Disk IO — missing indexes + dead realtime publication entries
-- ============================================================================
-- From the 2026-08-31 audit. Two independent changes:
--
--   1. Five indexes for queries that currently have none. All of these are
--      cheap today (interactions is 4,372 rows) and become the app's dominant
--      read cost once the tables outgrow shared_buffers. Adding them now is
--      free; adding them at 1M rows is an outage.
--
--   2. Drop daily_moods and reminders from the realtime publication. Block 5
--      of diag_disk_io.sql shows 9 published tables; grep over src/ shows only
--      7 are ever subscribed. The other two are decoded on every write for
--      nobody.
--
-- RUN EACH `CREATE INDEX CONCURRENTLY` STATEMENT ON ITS OWN — CONCURRENTLY
-- cannot run inside a transaction block, and the Supabase SQL editor wraps a
-- multi-statement submission in one. Highlight one statement, press Run,
-- repeat. The ALTER PUBLICATION lines at the bottom can go together.
--
-- CONCURRENTLY takes no write lock, so this is safe against production.
-- ============================================================================


-- ── 1. The five per-type COUNT(*)s in the memory-unlock check ───────────────
-- checkOnEventUnlocks counts interactions per action_type; action_type is in
-- no existing index (schema.sql:86-88 indexes household_id, user_id,
-- created_at; migration_interactions_useful.sql adds household_id+useful).
CREATE INDEX CONCURRENTLY IF NOT EXISTS interactions_household_action_idx
  ON public.interactions (household_id, action_type);


-- ── 2. /api/chat's recent-care lookup + the memory sweep's window scans ─────
-- Both filter household_id and order by created_at desc. Today this is a sort
-- over the household's entire history on every chat message.
CREATE INDEX CONCURRENTLY IF NOT EXISTS interactions_household_created_idx
  ON public.interactions (household_id, created_at DESC);


-- ── 3. /api/chat's global rate-limit counter ────────────────────────────────
-- Partial index: the predicate matches the query's .eq('role','user') exactly,
-- so the count becomes a bounded range scan over recent rows instead of a full
-- table scan. This is the worst curve in the audit — left alone it exceeds the
-- entire daily IO budget on its own at ~1000 users.
CREATE INDEX CONCURRENTLY IF NOT EXISTS eren_chat_messages_user_created_idx
  ON public.eren_chat_messages (created_at DESC)
  WHERE role = 'user';


-- ── 4. /api/fire-reminders dedup ────────────────────────────────────────────
-- Runs once per due reminder, twice per fire, against a table nothing prunes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS reminder_fires_reminder_fired_idx
  ON public.reminder_fires (reminder_id, fired_at DESC);


-- ── 5. profiles.household_id — an unindexed foreign key ─────────────────────
-- Postgres does not auto-index the referencing side of an FK. This column is
-- the app's most common predicate (~9 server call sites) and every one of them
-- is a sequential scan today.
CREATE INDEX CONCURRENTLY IF NOT EXISTS profiles_household_idx
  ON public.profiles (household_id);


-- ── 6. Stop decoding two tables nobody listens to ───────────────────────────
-- Safe to run together. Re-add with ALTER PUBLICATION ... ADD TABLE if a
-- client ever subscribes to them.
ALTER PUBLICATION supabase_realtime DROP TABLE public.daily_moods;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reminders;


-- Verify afterwards:
--   SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' ORDER BY tablename;   -- expect 7
--   SELECT indexname FROM pg_indexes
--    WHERE tablename IN ('interactions','profiles','reminder_fires',
--                        'eren_chat_messages');
