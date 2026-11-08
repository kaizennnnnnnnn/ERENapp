# Playroom Save Reliability

Scope: the playroom's **Done playing** action only. Artwork, sprites, ball physics,
care deltas, useful-care rules, daily-play quest and finish reaction are retained.
Other legacy care actions and arcade play calls are not migrated in this batch.

## Save Path

- `PlayScene` calls the shared stats provider's `finishPlaySession`.
- `playSessionSaves.ts` records a user/household-scoped request before networking.
- `complete_play_session_atomic` locks the profile then the current household stats.
  It applies existing capped decay and play deltas to that saved row, writes one
  play interaction and a receipt in the same transaction.
- A retry returns the original interaction and current care snapshot. It cannot
  repeat energy use, happiness gain or care-history insertion.
- The provider adopts validated, confirmed care fields only, preserving food,
  cosmetics and any newer in-memory snapshot. Realtime non-care merges retain
  the newest `updated_at` so a late play reply cannot rewind that newer state.
- Same-tick taps share one lock. Account/household changes, switching away and back,
  unmount, stale callbacks and late `finally` blocks are guarded.
- An interrupted save stays recoverable after reopening the room in the same tab.
  Recovery needs no new throws. A committed session can be confirmed while the cat
  now sleeps; an uncommitted session cannot apply care until the cat is awake.
- While the RPC is missing, no legacy optimistic/direct-write fallback runs. The
  session remains available for retry after installation.

## Rollout

Manually run `supabase/migration_play_session_saves.sql` in project
`bjnnqqxjjihmsbljeayf`. It adds one function, changes no player data and leaves the
old client working. No table reset, new cooldown, backpay or new reward is added.

The owner confirmed successful installation on 2026-11-08. Read-only verification:

- Function source MD5 after removing CR characters:
  `fd190556685bfb0349a5977ab677d8ec`, matching the tested file.
- `SECURITY DEFINER`, empty `search_path`, no anonymous execute permission;
  authenticated execute permission present.

## Verification

Run from the repository root:

```text
node scripts/check_play_session_sql.cjs
node scripts/check_play_session_client.cjs
node scripts/check_playroom_ui.cjs
node scripts/check_food_actions_client.cjs
node scripts/check_jelly_rounds_client.cjs
npx tsc --noEmit
npm run build
```

- SQL: 114 disposable-PGlite scenarios, including decay limits, all existing play
  math, useful history, preserved non-care fields, partner interleavings, lost
  replies, sleeping, rollback at each write, scope, rerun and permissions.
- Client: 13 checks executing the actual request journal, provider method and
  scene handler source with mocked transport and a focused hook harness.
- Existing playroom UI/physics checks, 12 food-action client checks and 10 Jelly
  round client checks also pass.
- Browser review: actual `PlayScene`, button and request helper using a local-only
  backend at `/skin-lab/play`; ready, saving, saved, missing-function, lost-response
  and reload recovery at 390x844 and 360x740. A committed session also recovered
  after a partner sleep change without waking the cat or repeating care.
- Recovery text moves the character and ball above the footer instead of covering
  them. No horizontal overflow; room/sprite assets load.

Screenshots are ignored under `review-pictures/play-session-saves/`. Preview
fixtures live outside the repository in `work/memory-preview` and are not shipped.
Browser tests do not use real player data. Hosted verification was read-only;
these checks are not a live two-phone test. PGlite interleaving checks are not a
multi-connection contention benchmark.

## Remaining Limits

The journal uses session storage with an in-memory fallback. A tab reload can
recover; closing that tab or denying storage can lose the client recovery link,
but not a transaction that already committed. Other legacy care saves and the
background decay writer still need their own scoped migration. This change makes
playtime read the latest saved care; it does not make those other writers atomic.
