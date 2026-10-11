-- ════════════════════════════════════════════════════════════════════════════
-- THE GARDEN — six beds the household grows flowers in, together.
--
-- One seed per person per day. A flower blooms after enough waterings
-- (daisy 2, tulip 3, sunflower 5); each person can water once a day, so two
-- people watering grow it twice as fast, and every day BOTH of you watered
-- raises its chance of a rare colour. A household of one has the cat: each
-- watering counts double and as "together". Rain from the weather machine (any
-- window set to rain or storm) waters the garden once that day.
--
-- When a flower opens it picks its colour here, server-side:
--   * 35% a MIXED colour, if a bloom of the same kind stands in a bed beside
--     it (left, right, above or below) — the cross-pollination;
--   * otherwise 8% + 12% per together-day (max 50%) the RARE colour;
--   * otherwise one of the three common colours.
-- Colour keys must match FLOWERS in src/lib/garden.ts.
--
-- Pick a bloom and it goes into the picker's basket; from the basket it goes
-- into a vase — yours, or your partner's (a gift). Rows are never deleted, so
-- the flower book is simply every colour this household has ever grown.
--
-- Every write is a SECURITY DEFINER RPC that derives caller, household and
-- "today" (households.tz) itself. Opening the room calls garden_tend(false),
-- which writes nothing unless it is raining on a plant not yet rained on today.
--
-- Run once in the Supabase SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.garden_plants (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  slot          smallint    NOT NULL CHECK (slot BETWEEN 0 AND 5),
  species       text        NOT NULL CHECK (species IN ('daisy', 'tulip', 'sunflower')),
  planted_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  planted_day   date        NOT NULL,
  growth        smallint    NOT NULL DEFAULT 0,
  together_days smallint    NOT NULL DEFAULT 0,
  water_day     date,                                   -- the day watered_by is about
  watered_by    uuid[]      NOT NULL DEFAULT '{}',
  rained_day    date,
  color         text,
  rarity        text        CHECK (rarity IN ('common', 'rare', 'mixed')),
  bloomed_at    timestamptz,
  picked_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  picked_at     timestamptz,
  vase_of       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  placed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One living plant per bed.
CREATE UNIQUE INDEX IF NOT EXISTS garden_plants_bed
  ON public.garden_plants (household_id, slot) WHERE picked_at IS NULL;
CREATE INDEX IF NOT EXISTS garden_plants_household
  ON public.garden_plants (household_id, created_at DESC);

ALTER TABLE public.garden_plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members read the garden" ON public.garden_plants;
CREATE POLICY "Household members read the garden"
  ON public.garden_plants FOR SELECT
  USING (household_id = public.my_household_id());
-- No INSERT/UPDATE/DELETE policies: writes go through the RPCs below.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.garden_plants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.garden_today(p_hh uuid)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tz text;
BEGIN
  SELECT COALESCE(tz, 'UTC') INTO v_tz FROM households WHERE id = p_hh;
  BEGIN
    RETURN (now() AT TIME ZONE v_tz)::date;
  EXCEPTION WHEN OTHERS THEN
    RETURN (now() AT TIME ZONE 'UTC')::date;
  END;
END;
$$;

-- ── Plant today's seed ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.garden_plant(p_slot int, p_species text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hh uuid; v_today date;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT household_id INTO v_hh FROM profiles WHERE id = v_uid;
  IF v_hh IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_household'); END IF;
  IF p_slot IS NULL OR p_slot < 0 OR p_slot > 5 OR p_species NOT IN ('daisy', 'tulip', 'sunflower') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_input');
  END IF;
  v_today := garden_today(v_hh);

  IF EXISTS (SELECT 1 FROM garden_plants
              WHERE household_id = v_hh AND planted_by = v_uid AND planted_day = v_today) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_planted');
  END IF;

  BEGIN
    INSERT INTO garden_plants (household_id, slot, species, planted_by, planted_day)
    VALUES (v_hh, p_slot, p_species, v_uid, v_today);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bed_taken');
  END;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Water (and let the rain in) ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.garden_tend(p_water boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hh uuid; v_today date; v_solo boolean; v_raining boolean;
  v_need int; v_changed boolean; v_n int := 0; v_watered int := 0; v_bloomed int := 0;
  v_nb boolean; v_commons text[]; v_rare text; v_mixed text;
  -- The plant being tended, copied out of its row so it can be changed.
  v_water_day date; v_by uuid[]; v_rained date; v_growth int; v_together int;
  v_color text; v_rarity text; v_bloomed_at timestamptz;
  r record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT household_id INTO v_hh FROM profiles WHERE id = v_uid;
  IF v_hh IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_household'); END IF;
  v_today := garden_today(v_hh);
  v_solo := (SELECT count(*) FROM profiles WHERE household_id = v_hh) < 2;
  v_raining := EXISTS (
    SELECT 1 FROM eren_stats s, jsonb_each_text(COALESCE(s.room_weather, '{}'::jsonb)) w
     WHERE s.household_id = v_hh AND w.value IN ('rain', 'storm'));

  FOR r IN SELECT id, slot, species, growth, together_days, water_day, watered_by, rained_day
             FROM garden_plants
            WHERE household_id = v_hh AND picked_at IS NULL AND bloomed_at IS NULL
            ORDER BY slot FOR UPDATE
  LOOP
    v_changed := false;
    v_water_day := r.water_day; v_by := r.watered_by; v_rained := r.rained_day;
    v_growth := r.growth; v_together := r.together_days;
    v_color := NULL; v_rarity := NULL; v_bloomed_at := NULL;

    IF v_water_day IS DISTINCT FROM v_today THEN
      v_water_day := v_today;
      v_by := '{}';
    END IF;

    IF p_water AND NOT (v_uid = ANY (v_by)) THEN
      v_by := array_append(v_by, v_uid);
      v_growth := v_growth + CASE WHEN v_solo THEN 2 ELSE 1 END;
      IF v_solo OR (SELECT count(DISTINCT x) FROM unnest(v_by) x) = 2 THEN
        v_together := v_together + 1;
      END IF;
      v_changed := true;
      v_watered := v_watered + 1;
    END IF;

    IF v_raining AND v_rained IS DISTINCT FROM v_today THEN
      v_rained := v_today;
      v_growth := v_growth + 1;
      v_changed := true;
    END IF;

    CONTINUE WHEN NOT v_changed;

    v_need := CASE r.species WHEN 'daisy' THEN 2 WHEN 'tulip' THEN 3 ELSE 5 END;
    IF v_growth >= v_need THEN
      IF r.species = 'daisy' THEN
        v_commons := ARRAY['pink', 'butter', 'lilac'];   v_rare := 'moonlit'; v_mixed := 'peach';
      ELSIF r.species = 'tulip' THEN
        v_commons := ARRAY['pink', 'red', 'lemon'];      v_rare := 'violet';  v_mixed := 'flame';
      ELSE
        v_commons := ARRAY['classic', 'sunset', 'rosy']; v_rare := 'snow';    v_mixed := 'dusk';
      END IF;
      v_nb := EXISTS (
        SELECT 1 FROM garden_plants n
         WHERE n.household_id = v_hh AND n.picked_at IS NULL AND n.bloomed_at IS NOT NULL
           AND n.species = r.species AND n.id <> r.id
           AND ((n.slot = r.slot - 1 AND r.slot % 3 > 0)
             OR (n.slot = r.slot + 1 AND r.slot % 3 < 2)
             OR n.slot = r.slot - 3 OR n.slot = r.slot + 3));
      IF v_nb AND random() < 0.35 THEN
        v_color := v_mixed; v_rarity := 'mixed';
      ELSIF random() < LEAST(0.5, 0.08 + 0.12 * v_together) THEN
        v_color := v_rare; v_rarity := 'rare';
      ELSE
        v_color := v_commons[1 + floor(random() * 3)::int]; v_rarity := 'common';
      END IF;
      v_bloomed_at := now();
      v_bloomed := v_bloomed + 1;
    END IF;

    UPDATE garden_plants
       SET water_day = v_water_day, watered_by = v_by, rained_day = v_rained,
           growth = v_growth, together_days = v_together,
           color = v_color, rarity = v_rarity, bloomed_at = v_bloomed_at
     WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'today', to_char(v_today, 'YYYY-MM-DD'),
    'raining', v_raining, 'watered', v_watered, 'bloomed', v_bloomed, 'changed', v_n);
END;
$$;

-- ── Pick a bloom into your basket ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.garden_pick(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_hh uuid; v_n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT household_id INTO v_hh FROM profiles WHERE id = v_uid;
  UPDATE garden_plants SET picked_by = v_uid, picked_at = now()
   WHERE id = p_id AND household_id = v_hh AND bloomed_at IS NOT NULL AND picked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pickable'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Put basket flowers in a vase: your own, or your partner's ───────────────

CREATE OR REPLACE FUNCTION public.garden_place(p_ids uuid[], p_to uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_hh uuid; v_n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT household_id INTO v_hh FROM profiles WHERE id = v_uid;
  IF p_to IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_to AND household_id = v_hh) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_recipient');
  END IF;
  UPDATE garden_plants SET vase_of = p_to, placed_at = now()
   WHERE id = ANY (p_ids) AND household_id = v_hh AND picked_by = v_uid AND placed_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', v_n > 0, 'placed', v_n);
END;
$$;

-- The helper is for the RPCs above, which run as its owner; nobody calls it directly.
REVOKE EXECUTE ON FUNCTION public.garden_today(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.garden_plant(int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.garden_tend(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.garden_pick(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.garden_place(uuid[], uuid) TO authenticated;
