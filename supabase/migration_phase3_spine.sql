-- ============================================================
-- Phase 3 — Memory Wall + Daily Wishes — DATA SPINE
-- Run once in Supabase Dashboard → SQL Editor → New query.
-- Idempotent: safe to re-run.
-- ============================================================
--
-- What this migration introduces:
--   • households additions: tz, wishes_granted_count, eren_birthday,
--     couple_anniversary  (all shared-state lives on the household row)
--   • profiles additions:   birthday (per-partner), wish_push_optin,
--     memory_push_optin, quiet_eren_optin, memory_caught_up,
--     memory_last_seen_at, catchup_pushed_at, last_phase3_notify,
--     timezone (travel fallback for push scheduling only)
--   • eren_wishes table:    one row per household per day; CAS-style
--     grant via the grant_wish() RPC
--   • memory_frames table:  the picture-frame ledger for the wall
--   • memory_unlocks queue: push-batching table for new-memory pushes
--   • grant_wish() RPC:     atomic grant + counter bump + coin credit
--   • RLS:                  household-scoped via public.my_household_id()
-- ============================================================

-- ─── 1. HOUSEHOLDS additions ──────────────────────────────────
-- All Phase-3 shared state lives here so partners can't drift.
-- couple_anniversary + eren_birthday belong to the household, not
-- a single profile; each partner's own birthday lives on profiles.
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS tz                   text  NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS wishes_granted_count int   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eren_birthday        date,
  ADD COLUMN IF NOT EXISTS couple_anniversary   date;

-- ─── 2. PROFILES additions ────────────────────────────────────
-- Per-partner state: each partner sets their own birthday + push
-- preferences. The 4-countdown strip on Profile reads two profiles
-- rows (jovan, partner) and the households row (Eren + anniversary).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthday             date,
  ADD COLUMN IF NOT EXISTS wish_push_optin      boolean   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS memory_push_optin    boolean   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_eren_optin     boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS memory_caught_up     boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS memory_last_seen_at  timestamptz,
  ADD COLUMN IF NOT EXISTS catchup_pushed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_phase3_notify   jsonb     NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone             text;

-- ─── 3. EREN_WISHES — the daily wish ledger ───────────────────
-- One row per household per local-day. wish_id matches the catalogue
-- id in src/lib/wishes.ts; the wish text is resolved client-side from
-- that id so we never have to migrate stored prose if we tweak copy.
CREATE TABLE IF NOT EXISTS public.eren_wishes (
  household_id      uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  period_key        text        NOT NULL,                    -- 'YYYY-MM-DD' in household.tz
  wish_id           text        NOT NULL,                    -- src/lib/wishes.ts Wish.id
  shown_at          timestamptz NOT NULL DEFAULT now(),
  granted_at        timestamptz,
  granted_by        uuid        REFERENCES public.profiles(id),
  action_taken      text,                                    -- e.g. 'feed:salmon', 'wash', 'play:tic_tac_toe'
  coins_paid        int         NOT NULL DEFAULT 0,
  pushed_at         timestamptz,                             -- morning wish push fired
  granted_pushed_at timestamptz,                             -- wish-granted push fired
  PRIMARY KEY (household_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_eren_wishes_recent
  ON public.eren_wishes (household_id, period_key DESC);

ALTER TABLE public.eren_wishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members read wishes" ON public.eren_wishes;
CREATE POLICY "Household members read wishes"
  ON public.eren_wishes FOR SELECT
  USING (household_id = public.my_household_id());

DROP POLICY IF EXISTS "Household members insert wishes" ON public.eren_wishes;
CREATE POLICY "Household members insert wishes"
  ON public.eren_wishes FOR INSERT
  WITH CHECK (household_id = public.my_household_id());

DROP POLICY IF EXISTS "Household members update wishes" ON public.eren_wishes;
CREATE POLICY "Household members update wishes"
  ON public.eren_wishes FOR UPDATE
  USING (household_id = public.my_household_id());

-- ─── 4. MEMORY_FRAMES — the picture-frame ledger ──────────────
-- One row per (household, frame_id). frame_id matches the catalogue
-- in src/lib/memoryCatalogue.ts. payload jsonb stores frame-specific
-- numbers (streak count, total wishes, etc). reaction jsonb stores
-- the partner's optional emote: { '<user_id>': 'brown_heart' | 'pink_heart' | 'sparkle' }.
CREATE TABLE IF NOT EXISTS public.memory_frames (
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  frame_id     text        NOT NULL,
  kind         text        NOT NULL,
  rarity       text        NOT NULL DEFAULT 'common'
                 CHECK (rarity IN ('common','rare','epic')),
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  unlocked_by  uuid        REFERENCES public.profiles(id),
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  reaction     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (household_id, frame_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_frames_recent
  ON public.memory_frames (household_id, unlocked_at DESC);

ALTER TABLE public.memory_frames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members read frames" ON public.memory_frames;
CREATE POLICY "Household members read frames"
  ON public.memory_frames FOR SELECT
  USING (household_id = public.my_household_id());

DROP POLICY IF EXISTS "Household members insert frames" ON public.memory_frames;
CREATE POLICY "Household members insert frames"
  ON public.memory_frames FOR INSERT
  WITH CHECK (household_id = public.my_household_id());

DROP POLICY IF EXISTS "Household members react frames" ON public.memory_frames;
CREATE POLICY "Household members react frames"
  ON public.memory_frames FOR UPDATE
  USING (household_id = public.my_household_id());

-- ─── 5. MEMORY_UNLOCKS — push-batching queue ──────────────────
-- New rows inserted from the same client + server paths that insert
-- into memory_frames. notify-memory drains these in batches of up
-- to 6h, then stamps pushed_at. Client cannot insert directly into
-- this queue; only the in-app unlock helper (server-routed) writes.
CREATE TABLE IF NOT EXISTS public.memory_unlocks (
  id           bigserial PRIMARY KEY,
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  frame_id     text        NOT NULL,
  rarity       text        NOT NULL CHECK (rarity IN ('common','rare','epic')),
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  pushed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_memory_unlocks_pending
  ON public.memory_unlocks (household_id, unlocked_at)
  WHERE pushed_at IS NULL;

ALTER TABLE public.memory_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members read memory unlocks" ON public.memory_unlocks;
CREATE POLICY "Household members read memory unlocks"
  ON public.memory_unlocks FOR SELECT
  USING (household_id = public.my_household_id());

-- INSERT + UPDATE on memory_unlocks happen via service-role only
-- (notify-memory and the unlock helper), so no client policies are
-- needed here. The push worker uses createAdminClient() and bypasses
-- RLS — same pattern as notify-action / notify-stats.

-- ─── 6. grant_wish() RPC ──────────────────────────────────────
-- One round trip. CAS update prevents the double-grant race when both
-- partners fire the matching action simultaneously: only the first
-- INSERT-then-UPDATE pair sees granted_at IS NULL and succeeds.
-- Returns {granted, coins_paid, wish_id} so the client knows whether
-- to play the animation + credit the coins.
--
-- We DO write coins inside the RPC so the +5/+10/+15 credit is in
-- the same Postgres transaction as the grant. Client refreshes its
-- coin display from the profile row on next render.
CREATE OR REPLACE FUNCTION public.grant_wish(
  p_household_id uuid,
  p_period_key   text,
  p_user_id      uuid,
  p_action_taken text,
  p_coins        int
)
RETURNS TABLE (granted boolean, coins_paid int, wish_id text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wish_id text;
BEGIN
  -- Authorization: caller must be a member of the household.
  -- (security definer bypasses RLS, so we re-check explicitly.)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = p_user_id
       AND household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'grant_wish: user % is not in household %', p_user_id, p_household_id;
  END IF;

  -- CAS: only one partner wins the grant.
  UPDATE public.eren_wishes
     SET granted_at = now(),
         granted_by = p_user_id,
         action_taken = p_action_taken,
         coins_paid = p_coins
   WHERE household_id = p_household_id
     AND period_key   = p_period_key
     AND granted_at IS NULL
  RETURNING eren_wishes.wish_id INTO v_wish_id;

  -- Either already granted, or row missing — both paths return granted=false.
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::text;
    RETURN;
  END IF;

  -- Household lifetime counter — drives Memory Wall cumulative frames.
  UPDATE public.households
     SET wishes_granted_count = wishes_granted_count + 1
   WHERE id = p_household_id;

  -- Credit the granter's coins in the same transaction.
  UPDATE public.profiles
     SET coins = COALESCE(coins, 0) + p_coins
   WHERE id = p_user_id;

  RETURN QUERY SELECT true, p_coins, v_wish_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_wish(uuid, text, uuid, text, int) TO authenticated;

-- ─── 7. household_created_at sanity ───────────────────────────
-- households.created_at already exists from schema.sql. We use that
-- timestamp as the household's adoption date for app_anniversary
-- frames. No backfill needed — it was stamped at signup.

-- ─── 8. tz default note ───────────────────────────────────────
-- households.tz defaults to 'UTC'. The app overwrites it on the
-- first authenticated mount via Intl.DateTimeFormat().resolvedOptions().timeZone
-- when the column is still 'UTC' (one-shot client-side write).
-- This keeps the migration safe to re-run and avoids needing to
-- know the user's tz at SQL time.
