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

## Migrations — all applied

`private_memories_bucket`, `account_deletion_fix`, `journal_integrity`,
`avatar_bucket_scope`, `terms_acceptance` all pasted 2026-08-28, on top of the
earlier set (`kiosk_shifts`, `household_takeover_fix`, `per_profile_heart`,
`leave_household`, `account_deletion`, `cron_io_reduction`, `cron_auth_headers`).

`account_deletion_fix` deadlocked on its first run — `DROP NOT NULL` needs an
AccessExclusiveLock and `fire-reminders` reads `reminders` every 15 minutes.
The file now sets `lock_timeout` and retries each ALTER inside its own
EXCEPTION block, so a caught deadlock releases its locks and the loop carries
on instead of the script dying.

**Nothing is queued for the dashboard.** Next SQL will come with report+block.

---

## The three defects the UGC map turned up

Found while inventorying user-content surfaces for report+block. All three
sat underneath the feature about to be built on them.

**`delete_my_account()` aborted for every caller, twice over.** It ran
`DELETE FROM game_best_scores`, which is a VIEW with `GROUP BY`/`max()` —
Postgres raises 55000 before any real work. And it anonymises co-authored
content by nulling the author column, but `couple_journal.sender_id`,
`memories.user_id` and `reminders.created_by` are all `NOT NULL`, so every
real user hit 23502. The design was right; the schema never permitted it.
Nulling the author before dropping `auth.users` is also what stops
`ON DELETE CASCADE` taking the partner's history, so it is load-bearing.

**Journal messages were mutable and forgeable.** The policy called "Users can
mark messages read" had `USING` with no `WITH CHECK` and no column grant, so
either member could rewrite `message` and `sender_id` on any row. Nothing in
the app has ever updated that table (`is_read` only moves in React state), so
the capability was removed rather than narrowed.

**`/api/notify-message` trusted the request body.** `sender_id`, `sender_name`
and `message` all came from the caller and none were checked against the
session — and no journal row was required, so one member could push unlimited
arbitrary text to the other's lock screen under any name, recorded nowhere.
Now it takes only a message id and refuses unless the caller wrote that row.

---

## ⚠ ONE MIGRATION TO PASTE

`supabase/migration_reports_blocks.sql` — reports, blocks, delete-your-own-
message, and the evidence-retention guard. Everything else is applied.

---

## NEXT UP

### 1. TWA build — still the blocker on the longest pole
Testers can only opt in to a build that exists in Play Console, so this gates
the 4-6 week wait, not report+block.

**Prep is done in the repo:** real 192/512 icons, separate maskable variants
with a safe zone, explicit `scope`, matching `theme_color`, and
`public/.well-known/assetlinks.json` scaffolded with the Play-App-Signing
trap written up in a README beside it. `public/play-icon-512.png` is the Play
listing hi-res icon.

**Still needed and only you can do it:** the Play Console app, the $25
registration, then `bubblewrap init/build`, upload, and paste the real
fingerprint into assetlinks.json.

**Store art that does not exist:** 1024x500 feature graphic (net-new), and
phone screenshots at a compliant ratio — the 52 dev shots in `scripts/*_shots/`
are 780x1688, whose 2.164 ratio exceeds Play's 2.0 limit, so they cannot be
used.

### 2. Start the 12-tester clock the moment a build is up
Recruit 15. Everything below ships into the same track while it runs.

### 3. IP — this is worse than "pastiche" and needs deciding now
Verified by opening the files, not inferred:
- `public/food/monsta_*.png` (10 files) are renders of **real Monster Energy
  cans** — the claw device and the MONSTER ENERGY wordmark are legible.
- `public/fr_pepsi.webp` carries the **PEPSI wordmark twice and the globe**.
- `games/tic-tac-toe/page.tsx:930-968` draws "lime claw-mark accents".
- `lib/donuts.ts:124` sells a donut named **Biscoff** (Lotus Bakeries).

Renaming does not help — the infringement is in the pixels. Redraw or remove
before buying store art, because Play's IP process is takedown on complaint.

### 4. Remaining code, in rough priority
- Solo state (100% of new installs land on a couple UI with no partner)
- Password reset (does not exist anywhere)
- Economy hardening (coins/stardust/inventory client-writable)
- Offline fallback: the SW caches images only, so a cold start with no network
  is a blank screen with no address bar to escape from in a TWA
- Precache is 30 MB and re-pulls on every SW_VERSION bump
- Bakery donut machine is a second loot box with no published odds
- Error reporting (none exists)
- React #418/#423 hydration errors on /home, still undiagnosed

### Placeholders — 34 total, not 21
21 in `privacy/policy.md`, 13 in `terms/terms.md`, plus a live
`PLACEHOLDER@example.com` mailto on `/delete-account:114` — which is the exact
page a Play reviewer opens for the deletion-URL requirement.

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
