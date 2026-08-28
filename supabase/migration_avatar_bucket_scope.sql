-- ═══════════════════════════════════════════════════════════════════════
-- SCOPE THE AVATARS BUCKET TO THE UPLOADER'S OWN FOLDER
--
-- The policy listing after migration_private_memories_bucket.sql turned up:
--
--   "Users can upload own avatar"  INSERT
--     with_check: bucket_id = 'avatars' AND auth.role() = 'authenticated'
--
-- The name says "own avatar"; the rule says "any authenticated user, any
-- path". The `avatars` bucket is PUBLIC, and nothing in the app has ever
-- uploaded to it — `storage.from('avatars')` has zero call sites; the
-- profiles.avatar_url column is only ever read.
--
-- So this is write access to a public CDN, granted to anyone who can create
-- an account, for a feature that does not exist. With two accounts that is
-- nothing. Once registration is open it is free hosting for whatever someone
-- wants to serve from this project's domain, billed to its egress.
--
-- Scoped rather than dropped: when avatars do get built, the safe pattern is
-- already here. A dropped policy would surface later as a permission error
-- and invite exactly the blanket rule being replaced.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;

-- Path must be <user_uuid>/<file>. Matches the convention the memories
-- bucket now uses, one level down: household there, user here.
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- A replaced avatar should not leave the old file on a public URL forever.
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Cap a single object at 5 MB. An avatar is a thumbnail; anything larger is
-- either a mistake or someone using the bucket for something else.
UPDATE storage.buckets
   SET file_size_limit = 5242880
 WHERE id = 'avatars';

-- NOTE for whoever builds avatar upload: the bucket is still PUBLIC, so an
-- avatar has a permanent guessable-by-uuid URL and is readable without a
-- session. That is the normal trade for a display picture, but if avatars
-- ever become face photos of a private person, revisit it the same way
-- migration_private_memories_bucket.sql handled the memory wall.

-- Verification.
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by policyname;
