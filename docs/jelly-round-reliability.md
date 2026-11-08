# Jelly Round Saves

## Rollout

1. Run the full `supabase/migration_jelly_rounds.sql` in the existing Supabase project after the economy and Jelly progress/score migrations.
2. Verify `finish_jelly_round_atomic(uuid,uuid,uuid,text,numeric)` exists with authenticated-only execution and an empty search path.
3. Publish the matching client and refresh both players' devices.

The update preserves scores, lead markers, coins, flavours, Super Jellies and skins. There is no historical backpay. Legacy collection, score inserts and Super Jelly functions remain available for old clients during rollout. New clients do not fall back to split writes if the new function is missing: the round remains recoverable instead.

## Contract

- One request saves the score, first eligible daily lead bonus, one or two Jelly rolls, care effects, coin effects, tray transition, Super Jelly and post-game play action together.
- The server chooses the same five flavours and fifteen effects, with the same 70% empty-slot bias and 220 m Run / 240 m Jump thresholds. Each second roll sees the first roll's updated tray.
- A below-threshold lead does not consume the Jelly bonus. Ties and a partner with no positive score do not earn a bonus. Each player can earn one lead bonus per game per UTC day, as before.
- Profile then household-stat locks serialize wallets, care effects and new-client duel decisions. The daily progression row is locked before changing the tray. The request receipt prevents repeated score, effect, bonus or Super Jelly writes.
- The existing post-game play action is included after the Jelly effects, using the existing decay, rounding, mood, sickness, weight and interaction rules. There is no new energy gate and sleeping is not toggled.
- A retry reuses the exact request, game and score. Original rolls and milestone events replay without re-rolling; current coins and current tray/stock accompany the historical result.
- The UI reveals only confirmed results. Both games block a new round while the previous result is unresolved. The Parlour links to recovery, and its home notification remains marked independently of available Super Jelly stock.
- Journals are scoped to player, household and game and persist through a same-tab reload. Blocked storage retains in-memory recovery; closing the tab can lose the recovery link, not committed rewards.
- Reads and late replies cannot paint another account, household or game. Same-user writes in the client queue prevent out-of-order wallet adoption.

## Catalogue

`scripts/build_jelly_round_catalog.cjs` builds the private catalogue from `src/lib/jellies.ts` and the existing play action. Run with `--write`, rerun tests and reinstall SQL when these rules change. Without `--write` the checker fails on drift.

## Verification

- `node scripts/build_jelly_round_catalog.cjs`
- `node scripts/check_jelly_rounds_sql.cjs`
- `node scripts/check_jelly_rounds_client.cjs`
- `node scripts/check_jelly_rounds_ui.cjs`
- `node scripts/check_reward_indicators_client.cjs`
- `node scripts/check_super_jelly_client.cjs`
- `npx tsc --noEmit`
- `npm run build` with placeholder public build configuration

SQL tests execute the real migrations in disposable PGlite, including injected failures after individual writes. Client tests exercise the actual hook and request journal, not a rewritten implementation. Browser verification uses a disposable local backend; no hosted score, coins, stats or inventory are claimed. Review captures are ignored under `review-pictures/jelly-round-saves/`.

The live function body and generated catalogue were read back and matched the tested files on 2026-11-08. Anonymous execution and direct client catalogue access are denied. The [RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is intentional deny-all on the private catalogue; the [signed-in definer notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) describes the deliberately exposed, user/household-checked RPC entry point, not an unrestricted table grant.

## Boundaries

Scores still originate from the client; this is reliable settlement, not gameplay attestation. Quest completion is a separate idempotent workflow after a confirmed positive-score round. Legacy clients and other absolute stat/wallet writers remain outside this transaction. PGlite has one connection, so these tests are not hosted multi-connection lock-contention tests. Receipts must not be removed while retries remain possible.
