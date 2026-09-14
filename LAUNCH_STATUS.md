# Eren — launch status

> **Read the code before you trust this file.** It is a running log, and the
> half of it written before 2026-09-11 has already misled two separate audits —
> it described solo state as unbuilt a week after it shipped, named one queued
> migration when four were open, and said in one place that password reset does
> not exist while another said it was code-complete.
>
> For what is actually applied in the database, run
> `supabase/probe_migration_state.sql` and read the result. For the current
> ranked backlog, read `memory/project_launch_backlog.md`, which is re-derived
> from the code rather than appended to.

Working checklist. Security/compliance pass 2026-08-28; corrected 2026-09-14.

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

## Safety + IP work (commits `12e1dc8`, `779168c`, `a83fa0a`)

**Report / block / delete shipped.** Long-press a message or note → Report /
Delete. Report on the memory wall, report-and-block on the profile, flag on
Eren's AI replies. Design notes that matter if you touch it:

- `report_content()` is an RPC, not an insert. A client-supplied snapshot could
  fabricate a message a partner never sent; a client-chosen target id would
  turn reporting into an oracle for probing whether a uuid exists. The server
  reads the row itself, scoped to the caller's own household.
- The snapshot exists BECAUSE people can now delete their own messages.
- `content_reports` and `user_blocks` use PLAIN uuids, no FK. An evidence
  record has to outlive the account it names, and a cascading block would let
  the blocked party delete their account to remove the row keeping them out.
- Block = leave + a permanent symmetric bar in `join_household()`. The CALLER
  leaves, never the other person — otherwise either member could evict the
  other from a shared history and keep it.
- A reported photo's bytes are held by `object_has_open_report()`, which the
  storage DELETE policy and both last-member sweeps consult. The row still
  deletes so nothing tips off the uploader.
- You cannot report after blocking (reporting needs a shared household). The
  block dialog says so and offers reporting first.

**Trademarks removed.** The ten `monsta_*.png` were renders of REAL Monster
cans (claw + wordmark legible); `fr_pepsi.webp` carried the PEPSI wordmark and
globe, and a Pepsi can was painted into `KioskBackReal.webp`. All regenerated
as original art with a paw mark by `scripts/build_energy_cans.py` and
`scripts/build_cola_can.py` — rerun those rather than hand-editing the PNGs.
Tic-tac-toe's "lime claw-mark accents" are a paw now. Flavours renamed off
Monster's SKU line; Biscoff → Speculoos.

**IDs were deliberately NOT renamed** (`monsta_*`, `donut_biscoff`) — they are
stored in inventories, gift payloads and purchase history. Only pixels and
display names moved. `SideId 'pepsi'` → `'cola'` WAS safe: in-memory only.

---

## Migrations — run the probe, do not trust a list

`supabase/probe_migration_state.sql` reports what is actually applied, by
value where existence is not enough. The section below is kept for the
reasoning it records, not as an inventory. As of 2026-09-14 two remain
unpasted: `migration_equip_prestige.sql` and
`migration_grant_wish_hardening.sql`.

**`supabase/migration_weather_machine.sql`** — paste this. It SUPERSEDES
`migration_room_weather.sql`, which no longer needs pasting on its own: the
new file re-asserts `eren_stats.room_weather` and the shop's `kind` check
itself, so it is safe whether or not the older one ever landed. It also seeds
the four machine parts (`wxm_coil`/`wxm_gauge`/`wxm_dish`/`wxm_lever`,
60 trophies the lot), teaches `purchase_trophy_item` to refuse a part the
household already owns, and clears `room_weather` so no window is showing a
sky a dead machine could not have made. Until it lands, the Lab's machine
shows 0/4 and its parts cannot be bought — nothing breaks.

The ten old `wx_*` sky rows are deliberately left in `trophy_shop_items`:
`user_trophy_items` cascades on delete, so dropping them would destroy real
ownership rows. Orphaned price rows are invisible to the client.


Applied 2026-08-28/29: `kiosk_shifts`, `household_takeover_fix`,
`per_profile_heart`, `leave_household`, `account_deletion`,
`cron_io_reduction`, `cron_auth_headers`, `private_memories_bucket`,
`account_deletion_fix`, `journal_integrity`, `avatar_bucket_scope`,
`terms_acceptance`, `reports_blocks`.

Verified live after the last paste: `report_content`, `block_user`,
`join_household` functions present; `content_reports` and `user_blocks`
tables present; journal delete/read/send and block read/lift policies present.

### ✅ Applied: `supabase/migration_trophy_battle.sql`

Confirmed 2026-08-31 from `pg_publication_tables`: `trophy_effects` is in the
`supabase_realtime` publication. That table is created only by this migration
and the publication line sits near the end of the file, so it ran to
completion. (This section previously read "waiting for the dashboard" — that
was stale, and it misled a later audit into assuming the Trophy Room was inert.)

The daily Care Battle pays **trophies** instead of 30 coins, and trophies buy
the Trophy Room (decor / accessories / powers / prestige).

It added:

- `profiles.trophies`, `profiles.equipped_title`, `profiles.equipped_frame`
- `daily_battle_results`: `twist_id`, `trophy_tier`, `trophies_awarded`,
  `trophy_claimed`, `verdict_seen`
- `claim_daily_trophy(date)` — one-shot mint, tier derived server-side
- `trophy_shop_items` (price list, seeded) + `user_trophy_items` (ownership)
- `purchase_trophy_item(text)` — atomic spend, grant-before-charge
- `eren_stats.room_decor`, `eren_stats.equipped_accessory`
- `trophy_effects` + its realtime publication

---

### ✅ Applied: the disk-IO pass (2026-08-31)

Supabase warned on Disk IO budget for the fourth time. Measured against live
`pg_stat_statements` this round instead of reasoning from source: **the app is
not the cause.** Top-25 queries total ~1.4 MB WAL/day at two users. The three
prior rounds each fixed something real but immaterial — `cron.job_run_details`,
the one the last round targeted, is ~0.004% of capacity.

Applied: `migration_disk_io_indexes.sql` (five missing indexes; dropped
`daily_moods` and `reminders` from the realtime publication — 9 published, 7
ever subscribed) and `migration_retention.sql` (monthly prune). Code in
`e6c41aa`: the memory-unlock check no longer runs five lifetime `COUNT(*)`s per
tap, and `time_spent` writes one complete row per session instead of
insert-then-update.

**Do not put these on a retention timer:** `couple_journal` (their actual
messages), `time_spent` (lifetime profile total, no date filter),
`interactions` / `game_scores` (lifetime memory-catalogue counters, ceiling 500
cares). Reasons are documented inside `migration_retention.sql`.

Two things measurement surfaced that are *not* app code: `realtime.subscription`
has the highest churn of any table (740 autovacuums), and the single biggest
temp-file writer is Supabase Studio's own schema introspection (~2.6 GB).

---

## NEXT UP

### 1. TWA build — the blocker on the longest pole
Testers can only opt in to a build that exists in Play Console, so this gates
the 4-6 week wait. Nothing else does.

**Done in the repo:** real 192/512 icons plus separate maskable variants with
a safe zone (the art runs edge to edge, so a maskable-declared full-bleed icon
would have been cropped into the cats); explicit `scope`; `theme_color` now
matches the meta tag; `public/.well-known/assetlinks.json` scaffolded with the
Play-App-Signing trap written up in a README beside it;
`public/play-icon-512.png` for the listing.

**Yours:** Play Console app + $25, then `bubblewrap init/build`, upload, read
the SHA-256 from **Play App Signing** (NOT the local upload key — that mismatch
is the usual cause of a TWA shipping with a visible address bar), paste it into
assetlinks.json, redeploy.

**Store art that does not exist:** 1024x500 feature graphic (net-new), and
phone screenshots — the 52 dev shots in `scripts/*_shots/` are 780x1688, and
that 2.164 ratio exceeds Play's 2.0 limit, so they cannot be used.

### 2. Start the 12-tester clock the moment a build is up
12 opted in for 14 CONTINUOUS days, then ~7 days review. Recruit 15 — dropping
below 12 on day nine is the failure mode. Must be the Google account they
actually use on the Play Store. Everything below ships into the same track
while the clock runs.

### 3. Fill 34 placeholders
21 in `privacy/policy.md`, 13 in `terms/terms.md`, plus a live
`PLACEHOLDER@example.com` mailto at `delete-account/page.tsx:114` — the exact
page a reviewer opens for the deletion-URL requirement. Then set
`TERMS_LAST_UPDATED` in `components/legal/TermsGate.tsx` to the real publish
date.

### 4. Remaining code, roughly prioritised
- ~~**Solo state**~~ — DONE, 15 commits, 2026-09-03. "Eren fills the seat":
  he scores in the daily and weekly battles so the ladder has an opponent,
  and every surface that asked a household of one for a second person was
  hidden rather than repointed at him. See `memory/project_solo_state.md`.
- ~~**Password reset**~~ — CODE DONE (`469f10c`): `/auth/forgot` + `/auth/reset`,
  reusing the existing PKCE callback, neutral response so the form can't be used
  to enumerate registered emails. **STILL BLOCKED on two dashboard steps**:
  allowlist `/auth/callback` under Authentication → URL Configuration (unlisted,
  it silently falls back to the Site URL and the link goes nowhere), and wire
  custom SMTP — Supabase's built-in mailer does a few messages an hour and
  password reset is the first thing that breaks under it
- **Economy hardening** — coins/stardust/inventory client-writable; gacha odds
  are a promise the server cannot keep
- **Offline fallback** — the SW caches images only, so a cold start with no
  network is a blank screen with no address bar to escape from in a TWA
- **Precache is 30 MB** and re-pulls on every SW_VERSION bump
- **Bakery donut machine** is a second loot box with no published odds
- **Error reporting** — none exists
- **React #418/#423** hydration errors on /home, still undiagnosed (MoodSky
  ruled out; needs a dev build to read the un-minified mismatch)
- ~~**`/talk` has no AI disclosure in the UI**~~ — DONE (`d6d2b3c`): an AI chip
  in the header, a plain-language line in the empty state, and a tag on the
  attic speech bubble (the second surface where he answers — reachable without
  ever opening the transcript). The empty state also names the long-press
  report, which was wired and undiscoverable. Wording is not legal advice and
  should be squared with the privacy policy and terms

---

## Track B — the rest of the public-release work

### Multi-tenancy
- ~~**No solo state.**~~ FIXED 2026-09-03 — see the Track A note above. The
  copy this bullet quotes ("TOGETHER FOR 0 DAYS") now reads "WITH EREN FOR n
  DAYS" for a household of one.
- **Cat name hardcoded "Eren"**, no `pet_name` column. Real scope: one column
  + ~40 user-facing strings (an auditor claimed 1,655; the critic corrected it).
- Two of eight care rooms are the girlfriend's Serbian course and chemistry
  trainer; 3 of 10 daily quests require them.
- `seed.sql` creates a household with invite code `ERENHOME`, and `SETUP.md`
  tells you to run it in production. Squattable.
- **Password reset exists but cannot deliver.** Code shipped in `469f10c`;
  it is dead until custom SMTP, because Supabase's built-in mailer only
  delivers to addresses on the project team. `38e7e51` made the failure
  visible instead of silent — it used to show a success screen regardless.
  Test with an address that is NOT on your Supabase org or you get a
  convincing false all-clear.

### Economy — anyone can mint
Acceptable when the only possible cheaters were the two of you. Not once
anyone can sign up.
- ~~`grant_wish` credits a **client-chosen** coin amount.~~ Hardened in
  `9f176b3`: the caller is validated against `auth.uid()`, the amount is
  clamped, and `search_path` is pinned. The clamp is still notional while
  `coins` sits in the profiles GRANT list — see the next bullet.
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
