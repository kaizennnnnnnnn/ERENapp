# Minigame Result Saves

Run `supabase/migration_game_results.sql` manually after the existing economy
migration, before deploying this client. It is safe to rerun. It preserves all
existing scores, coins and weekly results and does not attempt historical backpay.

All 11 playable arcade games use `save_game_result_atomic`. It authenticates the
expected account, checks household membership and computes the original game's
coin curve from a generated private catalog. The score row, coin credit and
receipt commit together. A retry with the same request returns the original
outcome with the current wallet, never another credit or leaderboard row.

The energy gate is evaluated from saved stats (including the existing capped
decay) on first successful confirmation, not from an unloaded client default of
100. It is then fixed in the receipt: resting cannot change a previously blocked
run into a paid one. Positive scores still save when coins are energy-blocked.
Zero-score runs retain participation coins without adding junk score rows;
tic-tac-toe losses/draws keep the same treatment. No care stats, clocks or effects
are changed by this function. Offline results are dated when saved, as before.

The client journals each run before networking. Same-tick finish handlers share
that run; starting another round gives it a distinct receipt, even at the same
score. Starting again or leaving the result card does not erase a pending save.
Recoveries serialize per account and coalesce matching in-flight requests.
Malformed successful replies retain their receipt rather than silently discarding
it. Missing SQL retains game intent for retry after installation; other existing
saved-RPC callers keep their old missing-function behavior. A temporarily missing
stats row also retains the unsaved run so Retry actually tries it again.

Only a confirmed result starts the coin animation. A failed save offers Retry,
and the arcade recovers pending runs on entry/foreground return. Failed arcade
recoveries remain visible with a Retry action. Confirmed recovery refreshes the
personal-best tiles. Account/household changes and unmounts cannot adopt a late
reply into a different wallet or result card. The recovery journal is scoped to
the account, household and browser tab; blocked storage leaves memory-only intent.

This is reliability work, not a full anti-cheat system: scores and win flags still
come from the game client, and legacy direct-write permissions are unchanged.
Weekly competition settlement/payouts are a separate path, untouched here.
Refresh both devices after deployment. This cannot reconstruct results lost by
the old fire-and-forget client or a deleted local recovery journal.

## Verification

```sh
node scripts/build_game_catalog.cjs
node scripts/check_game_results_sql.cjs
node scripts/check_game_results_client.cjs
node scripts/check_food_actions_client.cjs
node scripts/check_fortune_client.cjs
node scripts/check_menu_client.cjs
node scripts/check_reward_saves_client.cjs
npx tsc --noEmit
```

SQL tests use a disposable PGlite database and actual migrations. They check all
11 reward curves, replay, low energy, score-only saves, invalid inputs, rollback,
permissions, legacy data and the best-score view. They do not simulate production
multi-connection contention. Client tests load the real hook/helper and mock only
the transport/auth/React lifecycle. Browser checks use isolated mock transport,
with screenshots at 390 and 360 pixels in `review-pictures/game-saves` (ignored).
Hosted verification is read-only metadata/catalog inspection, not player claims.
