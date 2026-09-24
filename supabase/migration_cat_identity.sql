-- ============================================================
-- Cat identity: every household names its own cat, picks boy or girl, and
-- chooses a look (the Meadow onboarding's "Build your cat").
--
-- On eren_stats rather than households or profiles, on purpose:
--   * it is the one row every screen already loads (select '*') and both
--     phones already receive over realtime, so a rename or a new coat shows
--     up on the partner's phone without a reload;
--   * profiles has an explicit column GRANT list (see
--     migration_household_takeover_fix.sql) that a new column would silently
--     miss, and the cat is the household's, not one person's.
--
-- Columns:
--   cat_name  text   1..24 characters, defaults to 'Eren' so every existing
--                    household keeps the cat it has today.
--   cat_sex   text   'male' | 'female', defaults to 'male' (Eren is a boy).
--   cat_look  jsonb  NULL = the classic Eren art. Otherwise a small object:
--                    { "preset": "tuxedo" | null,
--                      "parts": { "body": "black", "ears": ..., "tail": ...,
--                                 "face": ..., "bib": ..., "legs": ...,
--                                 "socks": ... },
--                      "pattern": null | "tabby" | "tortie",
--                      "eyes": "gold", "nose": "pink" }
--                    The app validates every key (lib/catIdentity.ts
--                    parseCatLook); the checks here only keep the column an
--                    object and small, so a bad client cannot park megabytes
--                    on a row that is broadcast to both phones.
--
-- The client writes these with a plain update on the household's row, the same
-- way room_skins and room_weather are written; the existing eren_stats RLS
-- (household members only) already covers it.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

ALTER TABLE public.eren_stats
  ADD COLUMN IF NOT EXISTS cat_name text NOT NULL DEFAULT 'Eren',
  ADD COLUMN IF NOT EXISTS cat_sex  text NOT NULL DEFAULT 'male',
  ADD COLUMN IF NOT EXISTS cat_look jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eren_stats_cat_name_len'
      AND conrelid = 'public.eren_stats'::regclass
  ) THEN
    ALTER TABLE public.eren_stats
      ADD CONSTRAINT eren_stats_cat_name_len
      CHECK (char_length(btrim(cat_name)) BETWEEN 1 AND 24);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eren_stats_cat_sex_valid'
      AND conrelid = 'public.eren_stats'::regclass
  ) THEN
    ALTER TABLE public.eren_stats
      ADD CONSTRAINT eren_stats_cat_sex_valid
      CHECK (cat_sex IN ('male', 'female'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eren_stats_cat_look_shape'
      AND conrelid = 'public.eren_stats'::regclass
  ) THEN
    ALTER TABLE public.eren_stats
      ADD CONSTRAINT eren_stats_cat_look_shape
      CHECK (
        cat_look IS NULL
        OR (jsonb_typeof(cat_look) = 'object' AND pg_column_size(cat_look) < 2048)
      );
  END IF;
END $$;

-- Check it landed (expect three rows):
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'eren_stats'
--    AND column_name IN ('cat_name', 'cat_sex', 'cat_look');
