-- ═══════════════════════════════════════════════════════════════════════
-- PRIVATE MEMORIES BUCKET
--
-- The `memories` bucket is PUBLIC. Every photo any household has ever
-- uploaded is fetchable by anyone who has (or guesses, or scrapes, or is
-- handed) the URL — no session, no membership, forever. The path is
-- <household_uuid>/<epoch_ms>.<ext>, so one leaked URL exposes the household
-- id, and the epoch is guessable within a second, which makes the rest of a
-- household's photos enumerable from a single link.
--
-- That was a defensible shortcut for a two-person app. It is not one for a
-- public release holding other people's private photographs, and it is
-- flatly incompatible with the "you control your data" claim in the privacy
-- policy and the Play Data Safety form.
--
-- This migration:
--   1. flips the bucket to private,
--   2. replaces whatever storage policies exist on it with household-scoped
--      ones (a private bucket with no SELECT policy = nobody can read),
--   3. rewrites memories.image_url from a full public URL to a bare object
--      path, because the URL was a derived value that baked the bucket's
--      public-ness into the database.
--
-- The client signs a short-lived URL per object at render time. It tolerates
-- BOTH shapes of image_url, so this migration and the deploy can land in
-- either order without a broken window.
--
-- Run once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. The bucket itself
-- ─────────────────────────────────────────────────────────────────────
-- public = false makes /object/public/memories/... return 400. Reads now
-- go through /object/sign/... with a token, which storage validates against
-- the SELECT policy below.
--
-- file_size_limit caps a single object at 15 MB. That clears any real phone
-- photo (a 48MP HEIC is ~5 MB) while stopping one account from parking
-- gigabytes on a free-tier project.
--
-- Deliberately NOT setting allowed_mime_types: phones send image/heic,
-- image/heif and occasionally application/octet-stream, and a MIME reject
-- surfaces as a silent upload failure. Now that the bucket is private and
-- writes are pinned to the caller's own household folder, "someone stores a
-- non-image in their own private folder" is not a threat worth that
-- false-negative rate.
update storage.buckets
   set public = false,
       file_size_limit = 15728640
 where id = 'memories';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Clear the existing policy set for this bucket
-- ─────────────────────────────────────────────────────────────────────
-- Whatever is on there today was written for a public bucket, so by
-- definition none of it is the policy we want. Drop by discovery rather than
-- by guessed name: policies created through the dashboard wizard get names
-- like "Give users access to own folder 1oj01fe_0", which no migration
-- could have predicted.
--
-- Only policies that actually name this bucket are touched. A blanket
-- policy that names no bucket at all would survive this and still grant
-- access — step 5 lists what remains so that can be checked by eye.
do $$
declare
  r record;
begin
  for r in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename  = 'objects'
       and (coalesce(qual, '') like '%memories%'
         or coalesce(with_check, '') like '%memories%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
    raise notice 'dropped storage policy: %', r.policyname;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Household-scoped policies
-- ─────────────────────────────────────────────────────────────────────
-- The first path segment is the household id, so membership is checked by
-- comparing it to my_household_id(). Compared as text, not cast to uuid: a
-- malformed name would make the cast raise inside a policy, which fails the
-- whole query instead of just denying the row.

-- Read: any member of the owning household, for as long as they are a
-- member. Someone who leaves stops being able to sign new URLs immediately;
-- URLs they signed before leaving stay valid until they expire, which is
-- what the short TTL on the client is for.
create policy "Household members can read memory photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = public.my_household_id()::text
  );

-- Write: into your own household's folder only. Without the folder check any
-- signed-in user could write into any household's prefix, and since the
-- SELECT policy is prefix-based, that would let them plant content another
-- household sees as its own.
create policy "Household members can upload memory photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = public.my_household_id()::text
  );

-- Delete: your own uploads only, mirroring the memories row policy
-- ("Users can delete own memories"). Storage sets `owner` on insert; newer
-- projects populate `owner_id` (text) instead, so check both rather than
-- depending on which vintage this project is.
create policy "Users can delete own memory photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'memories'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
  );

-- No UPDATE policy on purpose. The app never upserts an object — a new
-- memory always gets a fresh timestamped name — so an UPDATE policy would
-- only widen the surface for nothing.

-- ─────────────────────────────────────────────────────────────────────
-- 4. Normalise memories.image_url to a bare object path
-- ─────────────────────────────────────────────────────────────────────
-- Storing the full public URL meant the database recorded a URL that stops
-- resolving the moment the bucket goes private. The path is the durable
-- fact; the URL is derived from it and now has to be signed per view.
--
-- split_part on '?' is belt-and-braces: getPublicUrl emits no query string,
-- but a signed or transformed URL would, and a query fragment left on the
-- end would make the path miss in storage.
update public.memories
   set image_url = split_part(
         regexp_replace(image_url, '^.*/object/public/memories/', ''),
         '?', 1)
 where image_url like '%/object/public/memories/%';

-- ─────────────────────────────────────────────────────────────────────
-- 5. Verification — read the output of this one
-- ─────────────────────────────────────────────────────────────────────
-- Expect: `memories` public = false, and exactly the three policies above.
-- Any OTHER policy listed here that does not name a bucket applies to every
-- bucket including this one, and needs a look.
select
  (select public::text from storage.buckets where id = 'memories') as memories_is_public,
  (select count(*) from public.memories where image_url like 'http%')  as rows_still_holding_a_url,
  (select count(*) from public.memories where image_url is not null)   as rows_with_an_image;

-- Then run this separately to see the full remaining policy set:
--   select policyname, cmd, qual, with_check
--     from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--    order by policyname;
