-- ════════════════════════════════════════════════════════════════════════════
-- THE BUCKET LIST: the household's plans for later, kept together.
--
-- One row per plan. Either of you can add one, tick it off, take the tick back
-- or remove it; it is a shared list, so every member of the household may write
-- every row of it. A household of one keeps it as "My bucket list".
--
--   kind     travel | food | adventure | home | someday. Must match KINDS in
--            src/lib/bucketList.ts.
--   target   optional free text "by when" ("Summer 2027"), not a date: plans
--            this far out are rarely a day.
--   done_at  null while the plan is still open. Ticking it off stamps who and
--            when; the Hallway hangs ticked-off plans as memory frames.
--
-- The push to the partner (added / ticked off) is sent by /api/notify-bucket,
-- which reads the stored row. Two triggers below: one stamps who ticked a plan
-- and when, one hangs a ticked-off plan on the Hallway wall.
--
-- Run once in the Supabase SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bucket_list (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  title         text        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  kind          text        NOT NULL DEFAULT 'someday'
                            CHECK (kind IN ('travel', 'food', 'adventure', 'home', 'someday')),
  target        text        CHECK (target IS NULL OR char_length(target) <= 40),
  note          text        CHECK (note IS NULL OR char_length(note) <= 280),
  done_at       timestamptz,
  done_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bucket_list_household
  ON public.bucket_list (household_id, created_at DESC);

ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members read the bucket list" ON public.bucket_list;
CREATE POLICY "Household members read the bucket list"
  ON public.bucket_list FOR SELECT
  USING (household_id = public.my_household_id());

-- You add plans as yourself, to your own household.
DROP POLICY IF EXISTS "Household members add to the bucket list" ON public.bucket_list;
CREATE POLICY "Household members add to the bucket list"
  ON public.bucket_list FOR INSERT
  WITH CHECK (household_id = public.my_household_id() AND created_by = auth.uid());

-- Either of you edits or ticks off any plan, and it stays in the household.
DROP POLICY IF EXISTS "Household members update the bucket list" ON public.bucket_list;
CREATE POLICY "Household members update the bucket list"
  ON public.bucket_list FOR UPDATE
  USING (household_id = public.my_household_id())
  WITH CHECK (household_id = public.my_household_id());

DROP POLICY IF EXISTS "Household members remove from the bucket list" ON public.bucket_list;
CREATE POLICY "Household members remove from the bucket list"
  ON public.bucket_list FOR DELETE
  USING (household_id = public.my_household_id());

-- A tick is only ever stamped by the person making it: done_by follows the
-- caller, and clearing done_at clears done_by with it. Keeps the push honest
-- ("Lidija ticked off ...") without trusting what the client sent.
CREATE OR REPLACE FUNCTION public.bucket_list_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- A person's id may only ever go to NULL: that is ON DELETE SET NULL when
  -- they delete their account, and it must go through.
  IF TG_OP = 'UPDATE' THEN
    NEW.household_id := OLD.household_id;
    NEW.created_at   := OLD.created_at;
    IF NEW.created_by IS NOT NULL THEN NEW.created_by := OLD.created_by; END IF;
  END IF;
  IF NEW.done_at IS NULL THEN
    NEW.done_by := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.done_at IS NULL THEN
    NEW.done_at := now();
    NEW.done_by := auth.uid();
  ELSE
    NEW.done_at := OLD.done_at;
    IF NEW.done_by IS NOT NULL THEN NEW.done_by := OLD.done_by; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bucket_list_stamp ON public.bucket_list;
CREATE TRIGGER bucket_list_stamp
  BEFORE INSERT OR UPDATE ON public.bucket_list
  FOR EACH ROW EXECUTE FUNCTION public.bucket_list_stamp();

-- ── Ticked-off plans hang in the Hallway ───────────────────────────────────
-- Each done plan is one memory_frames row, frame_id 'bucket:<plan id>', kind
-- 'bucket', with the plan's title in payload (the wall reads it from there;
-- these frames are not in the catalogue). Taking the tick back, or removing
-- the plan, takes the picture down; renaming a done plan renames it.
--
-- memory_frames queues every insert for the 6-hourly "new memories" push.
-- The partner already got "X ticked one off" from /api/notify-bucket, so the
-- queued row is dropped again here rather than announced twice.
CREATE OR REPLACE FUNCTION public.bucket_list_frame()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old_done boolean; v_new_done boolean;
BEGIN
  v_old_done := TG_OP <> 'INSERT' AND OLD.done_at IS NOT NULL;
  v_new_done := TG_OP <> 'DELETE' AND NEW.done_at IS NOT NULL;

  IF v_old_done AND NOT v_new_done THEN
    DELETE FROM memory_frames
     WHERE household_id = OLD.household_id AND frame_id = 'bucket:' || OLD.id::text;
  ELSIF v_new_done THEN
    INSERT INTO memory_frames (household_id, frame_id, kind, rarity, unlocked_at, unlocked_by, payload)
    VALUES (NEW.household_id, 'bucket:' || NEW.id::text, 'bucket', 'rare', NEW.done_at, NEW.done_by,
            jsonb_build_object('title', NEW.title, 'kind', NEW.kind, 'plan_id', NEW.id))
    ON CONFLICT (household_id, frame_id) DO UPDATE
      SET payload = EXCLUDED.payload;
    DELETE FROM memory_unlocks
     WHERE household_id = NEW.household_id AND frame_id = 'bucket:' || NEW.id::text;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bucket_list_frame ON public.bucket_list;
CREATE TRIGGER bucket_list_frame
  AFTER INSERT OR UPDATE OR DELETE ON public.bucket_list
  FOR EACH ROW EXECUTE FUNCTION public.bucket_list_frame();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bucket_list;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
