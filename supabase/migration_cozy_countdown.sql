-- ════════════════════════════════════════════════════════════════════════════
-- COZY COUNTDOWN — 12 advent-style doors ending on the couple anniversary.
--
-- One door per household per local day (households.tz); either partner opens
-- it, once. Server-authoritative: open_countdown_door() derives caller,
-- household, "today", door number and reward entirely in SQL — the client
-- sends nothing, so past/future doors are structurally unopenable and rewards
-- untamperable. Window math mirrors src/lib/countdown.ts — keep in lockstep.
--
-- Run once in the Supabase SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.countdown_doors (
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  period_key   text        NOT NULL,                       -- 'YYYY-MM-DD' in household tz
  door_no      int         NOT NULL CHECK (door_no BETWEEN 1 AND 12),
  opened_at    timestamptz NOT NULL DEFAULT now(),
  opened_by    uuid        REFERENCES public.profiles(id),
  reward_kind  text        NOT NULL CHECK (reward_kind IN ('coins','prompt')),
  coins_paid   int         NOT NULL DEFAULT 0,
  prompt_id    text,
  PRIMARY KEY (household_id, period_key)
);

ALTER TABLE public.countdown_doors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members read countdown doors" ON public.countdown_doors;
CREATE POLICY "Household members read countdown doors"
  ON public.countdown_doors FOR SELECT
  USING (household_id = public.my_household_id());
-- No INSERT/UPDATE policies: writes happen only through the SECURITY DEFINER RPC.

-- Partner's door-open should sync live (the component subscribes to INSERTs).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.countdown_doors;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.open_countdown_door()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hh uuid; v_tz text; v_ann date;
  v_today date; v_y int; v_m int; v_d int; v_dd int;
  v_occ date; v_start date; v_door int; v_key text;
  v_hash bigint; v_kind text; v_coins int := 0; v_prompt text := NULL;
  v_inserted int; v_row public.countdown_doors%ROWTYPE;
  -- Must stay in sync with COUNTDOWN_PROMPTS ids in src/lib/countdown.ts.
  v_prompts text[] := ARRAY[
    'cd-memory','cd-first','cd-song','cd-photo','cd-thanks','cd-future',
    'cd-laugh','cd-secret','cd-cook','cd-walk','cd-compliment','cd-recreate'];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  SELECT household_id INTO v_hh FROM profiles WHERE id = v_uid;
  IF v_hh IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_household');
  END IF;
  SELECT COALESCE(tz, 'UTC'), couple_anniversary INTO v_tz, v_ann
    FROM households WHERE id = v_hh;
  IF v_ann IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_anniversary');
  END IF;

  BEGIN
    v_today := (now() AT TIME ZONE v_tz)::date;          -- local day in household tz
  EXCEPTION WHEN OTHERS THEN
    v_today := (now() AT TIME ZONE 'UTC')::date;         -- bad tz string → UTC fallback
  END;

  -- Next occurrence of the anniversary's MM-DD; stored YEAR ignored;
  -- Feb-29 snaps to Feb-28 in non-leap years (mirrors countdown.ts).
  v_m := EXTRACT(month FROM v_ann)::int;
  v_d := EXTRACT(day   FROM v_ann)::int;
  v_y := EXTRACT(year  FROM v_today)::int;
  v_dd := CASE WHEN v_m = 2 AND v_d = 29
                AND NOT ((v_y % 4 = 0 AND v_y % 100 <> 0) OR v_y % 400 = 0)
          THEN 28 ELSE v_d END;
  v_occ := make_date(v_y, v_m, v_dd);
  IF v_occ < v_today THEN
    v_y := v_y + 1;
    v_dd := CASE WHEN v_m = 2 AND v_d = 29
                  AND NOT ((v_y % 4 = 0 AND v_y % 100 <> 0) OR v_y % 400 = 0)
            THEN 28 ELSE v_d END;
    v_occ := make_date(v_y, v_m, v_dd);
  END IF;
  v_start := v_occ - 11;
  IF v_today < v_start OR v_today > v_occ THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'outside_window');
  END IF;
  v_door := 12 - (v_occ - v_today);
  v_key  := to_char(v_today, 'YYYY-MM-DD');

  -- Deterministic server-side reward. Door 12 (anniversary day) is always the
  -- big coin door; otherwise ~40% couple prompts, else 8–15 coins.
  v_hash := abs(hashtext(v_hh::text || ':' || v_key || ':' || v_door)::bigint);
  IF v_door = 12 THEN
    v_kind := 'coins'; v_coins := 60;
  ELSIF v_hash % 5 < 2 THEN
    v_kind := 'prompt';
    v_prompt := v_prompts[1 + ((v_hash / 7) % array_length(v_prompts, 1))::int];
  ELSE
    v_kind := 'coins'; v_coins := 8 + (v_hash % 8)::int;
  END IF;

  -- Insert-first claim: PK (household_id, period_key) makes the second opener
  -- (double-tap or racing partner) a clean no-op that returns the winner's row.
  INSERT INTO public.countdown_doors
    (household_id, period_key, door_no, opened_by, reward_kind, coins_paid, prompt_id)
  VALUES (v_hh, v_key, v_door, v_uid, v_kind, v_coins, v_prompt)
  ON CONFLICT (household_id, period_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_row FROM public.countdown_doors
     WHERE household_id = v_hh AND period_key = v_key;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_opened',
      'door_no', v_row.door_no, 'period_key', v_row.period_key,
      'opened_by', v_row.opened_by, 'reward_kind', v_row.reward_kind,
      'coins_paid', v_row.coins_paid, 'prompt_id', v_row.prompt_id);
  END IF;

  -- Credit coins additively IN this transaction (grant_wish pattern).
  IF v_coins > 0 THEN
    UPDATE public.profiles SET coins = COALESCE(coins, 0) + v_coins WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('ok', true,
    'door_no', v_door, 'period_key', v_key, 'opened_by', v_uid,
    'reward_kind', v_kind, 'coins_paid', v_coins, 'prompt_id', v_prompt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_countdown_door() TO authenticated;
