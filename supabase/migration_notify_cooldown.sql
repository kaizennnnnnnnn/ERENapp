-- ═══════════════════════════════════════════════════════════════════════════
-- Per-stat notification cooldown
-- Stores the last time each stat (hunger/happiness/energy/sleep/cleanliness
-- /sick) fired a push, keyed by notification tag. /api/decay reads this
-- before sending a push and won't re-fire within NOTIFY_COOLDOWN_HOURS of the
-- previous send, even if the threshold condition is still true.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.eren_stats
  ADD COLUMN IF NOT EXISTS last_notified_at jsonb DEFAULT '{}'::jsonb;
