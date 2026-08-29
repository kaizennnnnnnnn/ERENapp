-- ═══════════════════════════════════════════════════════════════════════
-- REPORTING, BLOCKING, AND DELETING YOUR OWN MESSAGES
--
-- Google Play's User Generated Content policy requires an app carrying user
-- content to provide an in-app way to report content AND users, and an in-app
-- way to block users. /terms §4 defines what may not be posted and §5 promises
-- these controls exist. This is that machinery.
--
-- Three pieces, and the order they are written in matters because each one
-- constrains the next:
--
--   1. content_reports  — an evidence record, not a feeling. Snapshots the
--                         reported content server-side at report time.
--   2. user_blocks      — a real bar, enforced in join_household(), not a
--                         client-side filter.
--   3. a DELETE policy  — people can remove their own messages, which is
--                         exactly why (1) has to snapshot.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. content_reports
-- ─────────────────────────────────────────────────────────────────────
-- reporter_id and reported_user_id are PLAIN uuids with NO foreign key, and
-- that is deliberate. A report is an evidence record: if the reported account
-- deletes itself the report must survive intact, including whose account it
-- was. An ON DELETE SET NULL would leave "someone posted this, no idea who",
-- which is useless for a law-enforcement referral and useless for spotting a
-- repeat offender. The uuid still matches Supabase's auth logs after the
-- profile row is gone.
CREATE TABLE IF NOT EXISTS public.content_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       uuid        NOT NULL,
  reported_user_id  uuid,
  household_id      uuid,
  target_kind       text        NOT NULL
                      CHECK (target_kind IN ('message','memory','profile','household','ai_reply')),
  target_id         uuid        NOT NULL,
  -- Drawn from the list published in /terms §4, so the categories a reporter
  -- picks from are the same ones the rules are written in.
  reason            text        NOT NULL
                      CHECK (reason IN (
                        'csam','ncii','harassment','threats','hate',
                        'self_harm','illegal','privacy','impersonation',
                        'spam','other')),
  detail            text,
  -- The content as it stood when reported. See §3 below for why.
  snapshot          jsonb,
  status            text        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','actioned','dismissed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  handled_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reports_open
  ON public.content_reports(created_at DESC) WHERE status = 'open';

-- One open report per reporter, per thing, per reason. Without this the RPC
-- inserts unconditionally on every call, so anyone can bury a real report
-- under thousands of scripted ones — and the operator queue is a plain
-- time-ordered list, so burying it is enough to hide it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_open_per_target
  ON public.content_reports(reporter_id, target_kind, target_id, reason)
  WHERE status = 'open';

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- No policies at all, on purpose. Every write goes through report_content()
-- below, which is SECURITY DEFINER and therefore bypasses RLS; with RLS on
-- and no policy, nothing else can read or write this table through the API.
-- Reports are read in the Supabase dashboard, the same arrangement as
-- deletion_requests. A reporter deliberately cannot list their own reports:
-- the table holds snapshots of other people's content, and a SELECT policy
-- keyed on reporter_id would hand back content that may since have been
-- deleted or actioned.


-- ─────────────────────────────────────────────────────────────────────
-- 2. user_blocks
-- ─────────────────────────────────────────────────────────────────────
-- Plain uuids with no foreign key, same reasoning as content_reports. With
-- ON DELETE CASCADE, the blocked person deleting their account would delete
-- the block that keeps them out — the one action a determined person is most
-- likely to try. The row has to outlive the profile.
--
-- Be honest about the limit: a uuid is minted fresh on re-registration, so
-- someone who deletes and signs up again is a different account and this
-- cannot recognise them. What it does stop is the far commoner case — the
-- same account being handed a new invite code.
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id  uuid        NOT NULL,
  blocked_id  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- You may see and lift your own blocks. You may not create one directly —
-- block_user() does that, because blocking has side effects (leaving the
-- household) that must happen in the same transaction.
DROP POLICY IF EXISTS "Users can read own blocks" ON public.user_blocks;
CREATE POLICY "Users can read own blocks"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Users can lift own blocks" ON public.user_blocks;
CREATE POLICY "Users can lift own blocks"
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

REVOKE INSERT, UPDATE ON public.user_blocks FROM authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 3. report_content() — the snapshot is taken here, not by the client
-- ─────────────────────────────────────────────────────────────────────
-- Two reasons this is an RPC rather than a plain INSERT.
--
-- Evidence integrity: if the client supplied the snapshot, a reporter could
-- fabricate a message their partner never sent and attach it to that
-- partner's id. The report would then be indistinguishable from a real one.
-- Read server-side, the snapshot is a copy of a row that actually exists.
--
-- Non-enumeration: the lookup is scoped to the caller's own household, so a
-- guessed target_id in someone else's household resolves to nothing and
-- raises. Without that, reporting would be an oracle for probing whether a
-- given uuid exists anywhere in the database.
--
-- And the timing matters now that people can delete their own messages: the
-- copy is taken at report time, so deleting the message afterwards removes it
-- from the chat but not from the report.
CREATE OR REPLACE FUNCTION public.report_content(
  p_target_kind text,
  p_target_id   uuid,
  p_reason      text,
  p_detail      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_household uuid;
  v_snapshot  jsonb;
  v_author    uuid;
  v_report    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'report_content: not authenticated';
  END IF;

  SELECT household_id INTO v_household FROM public.profiles WHERE id = v_uid;
  IF v_household IS NULL THEN
    RAISE EXCEPTION 'report_content: not in a household';
  END IF;

  IF p_target_kind = 'message' THEN
    SELECT jsonb_build_object(
             'message',    j.message,
             'gift_item',  j.gift_item,
             'via_eren',   j.via_eren,
             'eren_state', j.eren_state,
             'created_at', j.created_at),
           j.sender_id
      INTO v_snapshot, v_author
      FROM public.couple_journal j
     WHERE j.id = p_target_id AND j.household_id = v_household;

  ELSIF p_target_kind = 'memory' THEN
    SELECT jsonb_build_object(
             'text',       m.text,
             -- The object PATH, not a URL. The bucket is private and signed
             -- URLs expire, so a URL would be unopenable by the time anyone
             -- reviewed it. A reviewer resolves this path with the service
             -- role, which is not bound by the household-scoped read policy.
             'image_path', m.image_url,
             'created_at', m.created_at),
           m.user_id
      INTO v_snapshot, v_author
      FROM public.memories m
     WHERE m.id = p_target_id AND m.household_id = v_household;

  ELSIF p_target_kind = 'profile' THEN
    -- A name and a heart colour is not a report. Someone reporting a person
    -- rather than one message is usually reporting a pattern — dozens of
    -- messages, none individually damning — and asking them to file each one
    -- separately is asking a person in distress to do data entry. Carry the
    -- recent authored content with it so there is something to actually read.
    SELECT jsonb_build_object(
             'name',  p.name,
             'heart', p.heart,
             'recent_messages', coalesce((
               SELECT jsonb_agg(x)
                 FROM (
                   SELECT j.message, j.gift_item, j.via_eren, j.created_at
                     FROM public.couple_journal j
                    WHERE j.household_id = v_household
                      AND j.sender_id = p_target_id
                    ORDER BY j.created_at DESC
                    LIMIT 30
                 ) x
             ), '[]'::jsonb),
             'recent_memories', coalesce((
               SELECT jsonb_agg(y)
                 FROM (
                   SELECT m.text, m.image_url AS image_path, m.created_at
                     FROM public.memories m
                    WHERE m.household_id = v_household
                      AND m.user_id = p_target_id
                    ORDER BY m.created_at DESC
                    LIMIT 20
                 ) y
             ), '[]'::jsonb)),
           p.id
      INTO v_snapshot, v_author
      FROM public.profiles p
     WHERE p.id = p_target_id AND p.household_id = v_household;

  ELSIF p_target_kind = 'ai_reply' THEN
    -- Play requires an in-app way to report generative-AI output. Scoped to
    -- the caller's OWN chat, which is also the only thing they could report:
    -- eren_chat_messages is private per user, partner included.
    --
    -- reported_user_id stays NULL. Nobody authored this — it came out of a
    -- model — and pinning a person's id to it would put a human in a
    -- moderation queue for something software said.
    SELECT jsonb_build_object(
             'content',    c.content,
             'role',       c.role,
             'created_at', c.created_at),
           NULL::uuid
      INTO v_snapshot, v_author
      FROM public.eren_chat_messages c
     WHERE c.id = p_target_id AND c.user_id = v_uid;

  ELSIF p_target_kind = 'household' THEN
    SELECT jsonb_build_object('name', h.name),
           NULL::uuid
      INTO v_snapshot, v_author
      FROM public.households h
     WHERE h.id = p_target_id AND h.id = v_household;

  ELSE
    RAISE EXCEPTION 'report_content: unknown target_kind %', p_target_kind;
  END IF;

  -- Nothing matched: either the id is wrong or it belongs to a household the
  -- caller is not in. Both get the same error, so this cannot be used to tell
  -- the two apart.
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'not_visible';
  END IF;

  INSERT INTO public.content_reports (
    reporter_id, reported_user_id, household_id,
    target_kind, target_id, reason, detail, snapshot
  ) VALUES (
    v_uid, v_author, v_household,
    p_target_kind, p_target_id, p_reason, left(coalesce(p_detail, ''), 2000), v_snapshot
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_report;

  -- Already reported by this person, for this reason, and still open. Report
  -- it as success: the reporter did the right thing and telling them "you
  -- already did that" helps nobody.
  IF v_report IS NULL THEN
    SELECT id INTO v_report
      FROM public.content_reports
     WHERE reporter_id = v_uid AND target_kind = p_target_kind
       AND target_id = p_target_id AND reason = p_reason AND status = 'open'
     LIMIT 1;
  END IF;

  RETURN v_report;
END;
$$;

REVOKE ALL ON FUNCTION public.report_content(text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 4. block_user() — a block here means the shared space ends
-- ─────────────────────────────────────────────────────────────────────
-- A household is two people who share one cat, one journal, one photo wall.
-- There is no feed to filter and no way to be present without being visible,
-- so "block" cannot mean "hide their posts" — it has to mean "we are no
-- longer sharing this". The block record is what makes it stick: without it,
-- the blocked person could simply be handed a fresh invite code.
--
-- Detaching the CALLER rather than ejecting the other person is deliberate.
-- Either member could otherwise evict the other from a shared history and
-- keep it, which turns a safety control into a weapon.
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_household uuid;
  v_known     boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'block_user: not authenticated';
  END IF;
  IF p_blocked_id = v_uid THEN
    RAISE EXCEPTION 'block_user: cannot block yourself';
  END IF;

  SELECT household_id INTO v_household FROM public.profiles WHERE id = v_uid;

  -- You may only block someone you actually share, or shared, a home with.
  -- Otherwise blocking becomes a way to probe whether an arbitrary uuid is a
  -- real account. The second arm covers a partner who already left: they can
  -- still be handed a new code, so they must still be blockable.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = p_blocked_id AND household_id = v_household AND v_household IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.couple_journal
     WHERE household_id = v_household AND sender_id = p_blocked_id
  ) OR EXISTS (
    -- Someone can share a home, upload photos and never type a message. Keying
    -- reachability on journal authorship alone would make exactly that person
    -- unblockable after they leave.
    SELECT 1 FROM public.memories
     WHERE household_id = v_household AND user_id = p_blocked_id
  ) INTO v_known;

  IF NOT v_known THEN
    RAISE EXCEPTION 'not_visible';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_uid, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Then leave, if there is anything to leave. Same body as
  -- leave_household(): calling it directly would be neater but it reads
  -- auth.uid() itself, and inlining keeps this one transaction.
  IF v_household IS NOT NULL THEN
    DELETE FROM public.push_subscriptions
     WHERE user_id = v_uid AND household_id = v_household;

    UPDATE public.profiles
       SET household_id = NULL, heart = 'pink_heart'
     WHERE id = v_uid;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE household_id = v_household) THEN
      DELETE FROM storage.objects
       WHERE bucket_id = 'memories' AND name LIKE v_household::text || '/%'
         AND NOT public.object_has_open_report(name);
      DELETE FROM public.households WHERE id = v_household;
    ELSE
      UPDATE public.households
         SET invite_code = upper(substring(gen_random_uuid()::text FROM 1 FOR 8))
       WHERE id = v_household;

      UPDATE public.profiles
         SET heart = 'brown_heart'
       WHERE household_id = v_household
         AND NOT EXISTS (
           SELECT 1 FROM public.profiles
            WHERE household_id = v_household AND heart = 'brown_heart'
         );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 5. join_household() — now refuses across a block, in both directions
-- ─────────────────────────────────────────────────────────────────────
-- This is what makes a block more than a gesture. Rotating the invite code on
-- the way out stops an accidental return; it does not stop a determined one,
-- because codes get shared, guessed at, or handed over under pressure. The
-- check is symmetric: it does not matter who blocked whom, those two accounts
-- do not share a household again.
CREATE OR REPLACE FUNCTION public.join_household(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_current   uuid;
  v_count     int;
  v_heart     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'join_household: not authenticated';
  END IF;

  SELECT household_id INTO v_current
    FROM public.profiles WHERE id = auth.uid();

  IF v_current IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_household';
  END IF;

  SELECT id INTO v_household
    FROM public.households
   WHERE invite_code = upper(trim(p_invite_code));

  IF v_household IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.profiles WHERE household_id = v_household;

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'household_full';
  END IF;

  -- The block gate. Deliberately raised BEFORE the join and reported as its
  -- own error so the app can say something true rather than "bad code".
  IF EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.user_blocks b
        ON (b.blocker_id = p.id       AND b.blocked_id = auth.uid())
        OR (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
     WHERE p.household_id = v_household
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  SELECT CASE
           WHEN EXISTS (
             SELECT 1 FROM public.profiles
              WHERE household_id = v_household AND heart = 'brown_heart'
           ) THEN 'pink_heart'
           ELSE 'brown_heart'
         END
    INTO v_heart;

  UPDATE public.profiles
     SET household_id = v_household,
         heart        = v_heart
   WHERE id = auth.uid();

  RETURN v_household;
END;
$$;

REVOKE ALL ON FUNCTION public.join_household(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_household(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 6. Delete your own messages
-- ─────────────────────────────────────────────────────────────────────
-- /terms §10 says you may delete individual items before deleting your
-- account. For memories that was already true (own-rows-only DELETE). For
-- journal messages it was not: the table had no DELETE policy for anyone, so
-- the sentence was a promise the app could not keep.
--
-- Own rows only. Deleting what the other person wrote is not tidying up, it
-- is editing their side of a shared history — and it would let an abuser
-- erase what they said from the other person's phone.
DROP POLICY IF EXISTS "Users can delete own journal messages" ON public.couple_journal;
-- The household predicate is not decoration. sender_id survives leaving and
-- survives being blocked, and a PostgREST DELETE needs no SELECT privilege on
-- the row — so without it, someone who left (or was blocked) could still reach
-- back into the household they are no longer in and erase everything they ever
-- said, which is precisely the evidence the person who blocked them may need.
CREATE POLICY "Users can delete own journal messages"
  ON public.couple_journal FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND household_id = public.my_household_id()
  );


-- ─────────────────────────────────────────────────────────────────────
-- 6b. Reported photos survive the uploader deleting them
-- ─────────────────────────────────────────────────────────────────────
-- The snapshot for a memory stores the object PATH, not the bytes — SQL
-- cannot copy an object out of storage. So on its own it does not survive
-- this sequence:
--
--   A uploads a photo → B reports it → A opens the memory wall and deletes
--   it → memories/page.tsx removes the storage object first, then the row →
--   the report now points at nothing.
--
-- That is the exact sequence that matters most, because the photos worth
-- reporting are the ones the uploader most wants gone: an intimate image
-- posted without consent, or worse. A report that resolves to a 404 is not
-- evidence, and it is not something we could hand to anyone.
--
-- The fix keeps the ROW deletable and the OBJECT retained. The person
-- deleting sees it disappear from the wall exactly as before — no error, no
-- hint that anything was preserved, which matters because tipping off the
-- uploader is its own harm. The bytes stay reachable to the service role
-- until the report is closed.
--
-- The privacy policy already discloses that reports keep a copy of reported
-- content and that we keep it after deletion.
CREATE OR REPLACE FUNCTION public.object_has_open_report(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- SECURITY DEFINER because content_reports has RLS on and no policies:
  -- a storage policy evaluated as the deleting user could not see the rows,
  -- and would silently always return false.
  SELECT EXISTS (
    SELECT 1 FROM public.content_reports
     WHERE status = 'open'
       AND (
         (target_kind = 'memory'  AND snapshot->>'image_path' = p_name)
         -- A profile report carries the reported person's recent memories,
         -- so those paths need holding too.
         OR (target_kind = 'profile'
             AND snapshot->'recent_memories' @> jsonb_build_array(
                   jsonb_build_object('image_path', p_name)))
       )
  );
$$;

REVOKE ALL ON FUNCTION public.object_has_open_report(text) FROM public;
GRANT EXECUTE ON FUNCTION public.object_has_open_report(text) TO authenticated;

DROP POLICY IF EXISTS "Users can delete own memory photos" ON storage.objects;
CREATE POLICY "Users can delete own memory photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'memories'
    AND (owner = auth.uid() OR owner_id = auth.uid()::text)
    AND NOT public.object_has_open_report(name)
  );


-- ─────────────────────────────────────────────────────────────────────
-- 6c. The same guard on account deletion
-- ─────────────────────────────────────────────────────────────────────
-- delete_my_account() sweeps the household's storage objects when the last
-- member leaves, and it is SECURITY DEFINER so the policy above does not
-- constrain it. Restated here in full — identical to
-- migration_account_deletion_fix.sql apart from the one added condition —
-- because a function body cannot be patched in place.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_household uuid;
  v_remaining int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'delete_my_account: not authenticated';
  END IF;

  SELECT household_id INTO v_household
    FROM public.profiles WHERE id = v_uid;

  -- ── 1. Personal data: destroyed outright ────────────────────────────────
  -- Everything here must be a BASE TABLE. game_best_scores used to be in this
  -- list and is a view over game_scores — deleting the underlying game_scores
  -- rows (below) is what actually clears it.
  DELETE FROM public.eren_chat_messages     WHERE user_id = v_uid;
  DELETE FROM public.eren_chat_memories     WHERE user_id = v_uid;
  DELETE FROM public.push_subscriptions     WHERE user_id = v_uid;
  DELETE FROM public.user_gacha_state       WHERE user_id = v_uid;
  DELETE FROM public.user_inventory         WHERE user_id = v_uid;
  DELETE FROM public.gacha_pull_log         WHERE user_id = v_uid;
  DELETE FROM public.user_task_completions  WHERE user_id = v_uid;
  DELETE FROM public.interactions           WHERE user_id = v_uid;
  DELETE FROM public.time_spent             WHERE user_id = v_uid;
  DELETE FROM public.daily_moods            WHERE user_id = v_uid;
  DELETE FROM public.game_scores            WHERE user_id = v_uid;
  DELETE FROM public.jelly_scores           WHERE user_id = v_uid;
  DELETE FROM public.jelly_duel_leads       WHERE user_id = v_uid;
  DELETE FROM public.jelly_progress         WHERE user_id = v_uid;
  DELETE FROM public.kiosk_shifts           WHERE user_id = v_uid;
  DELETE FROM public.daily_battle_results   WHERE user_id = v_uid;
  DELETE FROM public.weekly_battle_results  WHERE user_id = v_uid;
  DELETE FROM public.weekly_coop_results    WHERE user_id = v_uid;
  DELETE FROM public.weekly_game_results    WHERE user_id = v_uid;
  DELETE FROM public.reminder_fires         WHERE user_id = v_uid;
  DELETE FROM public.reminder_logs          WHERE user_id = v_uid;

  -- ── 2. Co-authored content: severed, not destroyed ──────────────────────
  -- Must run before the auth.users delete below: these columns carry
  -- ON DELETE CASCADE, so a row still pointing at this user would be deleted
  -- with them rather than anonymised, taking the partner's history with it.
  UPDATE public.couple_journal      SET sender_id  = NULL WHERE sender_id  = v_uid;
  UPDATE public.memories            SET user_id    = NULL WHERE user_id    = v_uid;
  UPDATE public.household_reminders SET created_by = NULL WHERE created_by = v_uid;
  UPDATE public.reminders           SET created_by = NULL WHERE created_by = v_uid;
  UPDATE public.eren_wishes         SET granted_by = NULL WHERE granted_by = v_uid;

  -- ── 3. The household ────────────────────────────────────────────────────
  IF v_household IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
      FROM public.profiles
     WHERE household_id = v_household AND id <> v_uid;

    IF v_remaining = 0 THEN
      -- Last one out. Nothing here is shared any more, so the uploaded photos
      -- go too. The bucket is private now, but an orphaned object still costs
      -- storage and still answers any signed URL minted before this ran.
      DELETE FROM storage.objects
       WHERE bucket_id = 'memories'
         AND name LIKE v_household::text || '/%'
         AND NOT public.object_has_open_report(name);

      DELETE FROM public.households WHERE id = v_household;
    ELSE
      -- Someone stays: rotate the code so a departed partner cannot rejoin,
      -- and make sure the survivor holds a colour.
      UPDATE public.households
         SET invite_code = upper(substring(gen_random_uuid()::text FROM 1 FOR 8))
       WHERE id = v_household;

      UPDATE public.profiles
         SET heart = 'brown_heart'
       WHERE household_id = v_household
         AND NOT EXISTS (
           SELECT 1 FROM public.profiles
            WHERE household_id = v_household AND heart = 'brown_heart' AND id <> v_uid
         );
    END IF;
  END IF;

  -- ── 4. The identity itself ──────────────────────────────────────────────
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 7. Verification
-- ─────────────────────────────────────────────────────────────────────
select 'tables' as kind, table_name as name, '' as detail
  from information_schema.tables
 where table_schema = 'public' and table_name in ('content_reports','user_blocks')
union all
select 'function', p.proname, pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('report_content','block_user','join_household')
union all
select 'policy', policyname, cmd::text
  from pg_policies
 where schemaname = 'public'
   and tablename in ('couple_journal','user_blocks','content_reports')
 order by kind, name;
