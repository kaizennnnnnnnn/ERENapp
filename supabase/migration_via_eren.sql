-- 2026-05-20 — couple_journal.via_eren flag
--
-- Messages and gifts sent through the home-screen ThoughtCloud
-- ("Eren has a message for you") set via_eren = true. They are
-- delivered to the recipient via the dedicated ErenMessagePopup only,
-- and are intentionally excluded from the journal list shown behind
-- the heart button — so the two channels stay separate.
--
-- The push notification for via_eren messages also hides the actual
-- text and just says "Eren has a message for you", to keep the body
-- secret until the partner opens the app.
ALTER TABLE public.couple_journal
  ADD COLUMN IF NOT EXISTS via_eren BOOLEAN NOT NULL DEFAULT false;
