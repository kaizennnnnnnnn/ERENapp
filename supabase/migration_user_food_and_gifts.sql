-- ────────────────────────────────────────────────────────────────────────────
-- Per-user food ownership in the fridge + gift attachments on couple messages.
-- Run once in the Supabase SQL editor. Safe to re-run (uses IF NOT EXISTS).
-- ────────────────────────────────────────────────────────────────────────────

-- 1) Per-user food piles inside the shared eren_stats row.
--    Shape: { "<user_id>": { kibble: 3, fish: 1, ... }, "<partner_id>": {...} }
--    The original shared `food_inventory` column stays as a legacy pool that
--    either user can still draw from; new shop purchases land in this column
--    under the buyer's user id.
ALTER TABLE public.eren_stats
  ADD COLUMN IF NOT EXISTS food_by_user JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Gift attachment on couple_journal rows. When set, the message is also a
--    food gift moved from the sender's per-user pile to the recipient's.
--    Shape: { "key": "fish", "qty": 1 }
ALTER TABLE public.couple_journal
  ADD COLUMN IF NOT EXISTS gift_item JSONB DEFAULT NULL;
