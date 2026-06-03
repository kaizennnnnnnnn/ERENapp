-- ============================================================
-- Phase 3 — Memory Wall auto-queue trigger
-- Run once in Supabase Dashboard → SQL Editor → New query.
-- Idempotent: safe to re-run.
-- ============================================================
--
-- The spine migration declared memory_unlocks as service-role-only (no
-- client INSERT policies). Without something filling that queue, the
-- notify-memory cron (PR 9) has nothing to drain. This trigger fills
-- the gap: every successful INSERT into memory_frames (whether from
-- the in-app tryUnlock helper or the cron sweep) queues a matching
-- memory_unlocks row in the same transaction.
--
-- Why a trigger and not a client-side write:
--   • memory_unlocks RLS denies client INSERTs by design (push-batching
--     state is owned by the server).
--   • A server-side RPC for every unlock would double the round trips.
--   • The trigger fires under SECURITY DEFINER so it bypasses the
--     queue's RLS while still being driven by the client INSERT into
--     memory_frames (which IS policy-checked).
-- ============================================================

CREATE OR REPLACE FUNCTION public.queue_memory_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.memory_unlocks (household_id, frame_id, rarity, unlocked_at)
  VALUES (NEW.household_id, NEW.frame_id, NEW.rarity, NEW.unlocked_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memory_frames_queue_unlock ON public.memory_frames;
CREATE TRIGGER memory_frames_queue_unlock
  AFTER INSERT ON public.memory_frames
  FOR EACH ROW EXECUTE FUNCTION public.queue_memory_unlock();
