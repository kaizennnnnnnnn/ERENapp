# Bathroom Save Reliability

Scope: completing a bath in `WashScene`. The bathroom artwork, soap/shower props,
coverage mask, drag and keyboard flow, pose changes and finish reaction stay intact.
Sleeping, medicine and other legacy care writers are not migrated in this batch.

## Behavior

- A completed bath calls `finishWashSession` in the shared stats provider instead
  of sending an absolute care snapshot through `applyAction`.
- The request journal stores one actor/household-scoped ID before networking.
  An interrupted save offers **Recover bath**, including after reopening the room
  in the same browser tab. No extra soaping, rinsing or finish shake is required.
- The server locks the current profile and household stats, applies existing decay
  and `ACTION_CONFIGS.wash` deltas (cleanliness +60, happiness +5), then saves one
  interaction and a receipt in the same transaction. Useful-care scoring still
  checks post-decay cleanliness below 90. No new cooldown or reward is introduced.
- Replays return the original interaction with the current care snapshot. They do
  not wash twice or undo newer partner care. Non-care fields are not patched by
  the client, and older confirmed snapshots cannot rewind newer in-memory care.
- A committed bath can be confirmed while the cat now sleeps. An uncommitted bath
  remains pending until the cat is awake; a new wash cannot affect a sleeping cat.
- Only confirmation shows the saved banner and completes the daily wash task.
  The existing physical shake remains separate from save confirmation. Tools stay
  hidden after a recovered success, just as after an ordinary completed bath.
- Same-tick taps, late replies, account/household changes, switching away and back,
  unmount and old cleanup handlers cannot apply another scope's result or unlock
  a newer save. Moving soap/water while asleep or pending cannot add progress.
- Missing SQL leaves the bath recoverable; there is no legacy direct-write fallback.

## Rollout

Run `supabase/migration_wash_session_saves.sql` manually in project
`bjnnqqxjjihmsbljeayf`, after the existing economy/sleeping/interaction migrations.
It adds one function without resetting care, inventory, skins or coins. Existing
deployed clients keep working until the new UI is published.

Owner confirmed installation on 2026-11-08. Read-only verification matched the
tested function's source MD5 (CR characters removed):
`ca9695eca9ea92a3f0becbd26ce4500c`. Empty `search_path`, `SECURITY DEFINER`,
authenticated execute and no anonymous execute permission were confirmed.

## Verification

```text
node scripts/check_wash_session_sql.cjs
node scripts/check_wash_session_client.cjs
node scripts/check_wash_ui.cjs
node scripts/check_play_session_client.cjs
node scripts/check_food_actions_client.cjs
npx tsc --noEmit
npm run build
```

- 117 disposable-PGlite scenarios: existing care/decay math, numeric cleanliness,
  weight/sickness/mood bounds, distinct useful-care gates, preserved fields,
  partner interleavings (including the actual play RPC), replay, sleeping,
  rollback at each write, wrong scope, rerun and grants.
- 13 client checks run actual journal/provider/scene source with mocked transport:
  lost responses, reload, strict payload validation, double taps, newer stats,
  account/household/ABA/unmount guards, stale callbacks and recovery without a
  second physical bath. Existing wash pointer/keyboard/UI checks also pass.
- Playroom's 13 client checks and food actions' 12 client checks pass unchanged.
- Browser: actual `WashScene`, progress controls and save helper with a local-only
  backend. Soap/rinse, delayed confirmation, saved, missing function, lost response,
  reload recovery and confirmation while sleeping checked at 390x844 and 360x740.
  No horizontal overflow; room and sprite assets load. Screenshots are ignored in
  `review-pictures/wash-session-saves/`.
- Production build and strict TypeScript checks pass. The build reports the
  existing stale Browserslist-data notice; no dependency churn is included.

The preview backend lives outside the repo in `work/memory-preview` and is not
shipped. Browser tests use no hosted player data. Hosted verification is read-only,
not a two-phone live mutation test. PGlite checks interleavings, not simultaneous
multi-connection contention.

## Remaining Limits

The journal uses session storage with an in-memory fallback. Reload can recover;
closing the tab or blocking storage may lose the client recovery link, but cannot
undo an already committed transaction. Legacy care/background decay writers can
still send old snapshots and need separate work. This change prevents the new
bath transaction from overwriting care already saved by a partner; it does not
claim to harden those other writers.

The project advisor baseline also contains unrelated existing warnings, including
[anonymous executable functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[mutable function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Those settings/functions are untouched here. Private receipt/catalog tables
intentionally have deny-all RLS. Authenticated execution of this new definer
function is deliberate: it checks the real auth UID, expected actor and current
household before accessing any receipt or care row.
