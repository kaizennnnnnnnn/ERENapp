# Eren — launch status

Working checklist. Last updated 2026-08-28, end of the security/compliance pass.

Two tracks. **Track A** makes the app you have today correct and safe — it is
done and deployed. **Track B** turns a two-person app into a public product;
it is the long one, and most of it is not code.

---

## Where things stand right now

**Deployed and verified in production** (not assumed — probed):

- `eren-care-app.vercel.app` is live, login works.
- Crons return real HTTP 200s (checked `net._http_response`, not just pg_cron's
  `succeeded`, which only means the SQL ran). All four jobs green at 18:00.
- Unauthenticated `POST /api/notify-message` → `401 unauthorized`. The push
  injection hole is closed in production.
- `/privacy` and `/delete-account` → 200, reachable with no session.
- Sweep endpoints: `notify-memory` / `notify-favorite` → `"cron only"`;
  `decay` / `fire-reminders` → `"unauthorized"` (they still accept a session,
  scoped to that user's own household).

### The env var saga (worth remembering — it cost an hour)

Removing the hardcoded `env` block from `next.config.mjs` exposed **two**
broken Vercel variables that had been dead since April, because the hardcoded
values were silently overriding them:

1. `NEXT_PUBLIC_SUPABASE_URL` was `https://bjnnqqxjjihmsbljeayf.co` — missing
   `.supabase`.
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` contained **the key, a newline, then
   `NEXT_PUBLIC_APP_URL=http://localhost:3000`** — two lines pasted into one
   field. A newline in a header value makes `fetch` throw
   `Failed to execute 'fetch' on 'Window': Invalid value`, which surfaces as
   `AuthRetryableFetchError` with `status: 0`. The code's `.trim()` couldn't
   save it because the newline was in the middle, not at the end.

Both fixed. A trailing newline remains on the anon key (raw 210 vs 208) but
`.trim()` handles it — cosmetic only.

**Lesson:** `NEXT_PUBLIC_*` values are inlined at BUILD time. Editing a
variable does nothing until you redeploy, and a `next.config.mjs` `env` block
beats the environment entirely.

---

## Migrations — all applied and verified live

`kiosk_shifts`, `household_takeover_fix`, `per_profile_heart`,
`leave_household`, `account_deletion`, `cron_auth_headers`.

RPCs confirmed present: `create_household`, `join_household`,
`leave_household`, `rotate_invite_code`, `delete_my_account`, `grant_wish`,
`purchase_skin_with_stardust`, `collect_jelly`, `feed_super_jelly`,
`open_countdown_door`, `my_household_id`.

Nothing from the original audit is left to paste. `jelly_run`,
`drink_unlock_skins`, `streak_sos` and `cron_io_reduction` all turned out to
be applied already.

---

## Done this session (11 commits, `0be2382`..`53507f2`)

| | What |
|---|---|
| ✅ | Kiosk migration applied — unlimited nightly coin faucet closed |
| ✅ | Household takeover closed (`WITH CHECK` + `household_id` revoked from client) |
| ✅ | Invite-code join fixed — it could never have worked (RLS hid `households` from anyone not yet in one) |
| ✅ | All 11 service-role `notify-*` routes authenticated (cron secret **or** session) |
| ✅ | Sweeps scoped: cron sweeps all households, a session sweeps only its own |
| ✅ | Client decay write was a dead statement (bare supabase-js builder, never sent a request) |
| ✅ | Reminders: 2-min window vs 15-min cron meant ~87% never fired; also ran in UTC not local |
| ✅ | Coin/quest/gacha/battle payouts no longer silently lost on a 503 |
| ✅ | Owner's email + name removed from runtime (persona prompt, flavour lines, hearts) |
| ✅ | `/talk`: reserve-before-stream, `CHAT_DAILY_GLOBAL_CAP`, `EREN_CHAT_DISABLED` kill switch |
| ✅ | Account deletion — in-app + `/delete-account` |
| ✅ | Privacy policy at `/privacy` (21 `[PLACEHOLDER]`s left to fill) |
| ✅ | Deleting a memory now deletes the photo object too |

---

## NEXT UP — in the order I'd take them

### 1. Private photo bucket (biggest real risk)
`memories` bucket is **public**. Every photo ever uploaded is fetchable by URL
with no auth, household UUID in the path. Needs private bucket + signed URLs.
Breaks every stored `image_url`, so it needs a real migration, not a drive-by.
`src/app/(app)/memories/page.tsx:74-81` uses `getPublicUrl`.

### 2. Wire up leave / rotate (written, live, unreachable)
`leave_household()` and `rotate_invite_code()` exist in the DB with **zero
call sites**. Needs two buttons on the profile page. This is a Play-blocking
requirement sitting one button away from done.

### 3. Report + block (Play blocking)
UGC policy applies even to a private two-person space ("a subset of users").
Needs: report content AND users, block users, ToS acceptance gate, published
objectionable-content definition. `couple_journal` backs both the chat and the
note board, so one report target kind covers both text surfaces.

### 4. Start the 12-tester clock
New personal dev accounts: closed test, 12 testers, **14 continuous days**,
then ~7 days production-access review. 4–6 weeks total. Nothing shortens it.
Start recruiting before writing more code.

### 5. Verify TWA push on a real device — could invalidate the plan
[android-browser-helper#563](https://github.com/GoogleChrome/android-browser-helper/issues/563)
(open, updated 2026-08-09): on Android 16 / Chrome 142 the page reports
permission `granted` while native `POST_NOTIFICATIONS` stays blocked and
nothing arrives. **The entire retention loop is push.** Test before writing a
store listing.

### 6. Open question, not yet diagnosed
React **#418 / #423** hydration errors on `/home` in production. Non-fatal —
React discards the prerender and client-renders — but costs startup perf.
Almost certainly pre-existing. `MoodSky` was checked and is already correct
(`useState('day')` + `useEffect(setPart(getDaypart()))`). **Source not yet
found.** Needs a dev build to read the un-minified mismatch.

---

## Track B — the rest of the public-release work

### Multi-tenancy
- **No solo state.** 100% of new installs land on a couple UI saying "You &
  your partner" / "TOGETHER FOR 0 DAYS" with no partner.
- **Cat name hardcoded "Eren"**, no `pet_name` column. Real scope: one column
  + ~40 user-facing strings (an auditor claimed 1,655; the critic corrected it).
- Two of eight care rooms are the girlfriend's Serbian course and chemistry
  trainer; 3 of 10 daily quests require them.
- `seed.sql` creates a household with invite code `ERENHOME`, and `SETUP.md`
  tells you to run it in production. Squattable.
- **No password reset anywhere.** At scale this is the #1 support burden.

### Economy — anyone can mint
Acceptable when the only possible cheaters were the two of you. Not once
anyone can sign up.
- `grant_wish` credits a **client-chosen** coin amount.
- `user_inventory` INSERT is ownership-only — self-grant any skin, including
  the drink-unlock-only ones the purchase RPC refuses to sell.
- `eren_stats.coins`, `user_gacha_state.stardust/tickets` directly writable.
- Gacha rolls + pity are client-side; published odds are a promise the server
  cannot keep.

### Store / legal
- TWA wrapper + signed AAB (nothing Android exists yet). Bubblewrap.
- `assetlinks.json` at `/.well-known/` — fingerprint comes from **Play App
  Signing**, not the local upload key.
- Fill the 21 privacy-policy placeholders (entity, address, email,
  jurisdiction, date).
- Data Safety form — must declare Anthropic as third-party sharing.
- Store assets: icon, feature graphic, screenshots (manifest icons are NOT these).
- **Set age 18+**: couples framing + private photos + GDPR Art. 8 + Anthropic's
  own 18+ terms (contractual, given `/talk`). Watch the trap — Play rejects
  "youthful animation" when the declared audience excludes children, and Eren
  is a cartoon cat with a gacha machine. Mitigate in the **store listing**.
- **AI**: in-app flag control on each `/talk` reply, without navigating away.

### Infra
- Vercel Hobby: 30 GB cold-install transfer vs 100 GB allowance. The
  non-commercial ToS reading is arguable; the quota math is not.
- Supabase free tier: 500 MB DB, 5 GB egress, no backups.
- **No error/crash reporting anywhere.** At 2 users you hear about bugs; at
  2,000 you get silent uninstalls.
- Assets 251 MB (114 skins / 73 gacha / 85 video). Closet grid downloads
  full-res art for thumbnails. The kiosk walls already prove the webp recipe
  at ~90 KB.

### IP risk — decide before buying store art
Monsta cans are a Monster Energy pastiche; the cat is named for an Attack on
Titan character. Play IP policy is takedown-on-complaint, no warning.

---

## Needs a lawyer, not a developer
1. CSAM/NCMEC procedure — the instinctive "download it to preserve evidence"
   is itself an offence.
2. Privacy policy GDPR basis + international-transfer clauses.
3. ToS enforceability.
4. Any decision to go below 18.
5. Whether an entity should sit between you personally and custody of other
   people's intimate photographs.

---

## Reference — env vars (8, all required)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`,
`NEXT_PUBLIC_APP_URL`. All documented in `.env.local.example`.

Cron jobs (7): `eren-decay-hourly` `0 * * * *`, `fire-reminders` `*/15`,
`eren_notify_memory_6h` `0 */6`, `eren_notify_favorite_weekly` `0 9 * * 1`,
`eren_notify_anniversary_daily` `0 8 * * *`, `eren_notify_streak_sos`
`0 16,18,20 * * *`, `prune-cron-history` `17 3 * * *` (SQL only, no header).

Useful checks:
```sql
select j.jobname, d.status, d.return_message, d.start_time
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
 order by d.start_time desc limit 15;

select r.status_code, r.created, left(r.content,120)
  from net._http_response r order by r.created desc limit 15;
```
