# Gacha and Fridge Saving

## Install Before Deploying

1. In Supabase project `bjnnqqxjjihmsbljeayf`, open the SQL editor.
2. Run the complete `supabase/migration_economy_reliability.sql` file. It is safe
   to re-run and does not reset existing coins, inventory, pity or food.
3. Deploy the matching app changes, then refresh the app on both devices.
4. Confirm a single pull, a ticket pull and a ten-pull on a test account. Confirm
   a food purchase, feeding and gifting from both devices.

The new clients fail closed while the functions are absent: pulls and fridge
changes return failure, and shops do not charge for an unsuccessful stock save.
Do not deploy the clients first and leave the database update for later.

## Contracts

- `pull_gacha_atomic` chooses the roll, validates the balance/ticket, grants all
  inventory and edible food, records history, updates pity/dust and deducts
  payment in one PostgreSQL transaction. No reward is revealed before success.
- Prices, rarity weights, pity thresholds and duplicate compensation are the
  existing values. Roll-tier counters retain the existing tier-escalation rule.
- The server catalogue is generated from the existing TypeScript catalogue.
  After changing pools/food keys, run `node scripts/build_economy_catalog.cjs
  --write` and re-run the SQL before releasing items that require it. The checker
  fails if the catalogue drifts. Currently no banner has featured items.
- `mutate_fridge_atomic` locks the latest household fridge, then adds, consumes
  or transfers only the requested foods. Consuming uses personal stock first,
  then legacy shared stock. Gifts use personal stock only and require a distinct
  recipient in the same household. Both sides of a gift save together.
- Food helpers return true only after confirmation. They no longer make
  optimistic stock changes on a failed save. Callers must not subtract an item
  to undo a grant that returned false.
- Requests have user-scoped UUID receipts. An ambiguous network failure retries
  the same request instead of repeating the mutation. A receipt cannot be reused
  with different inputs or a different operation. Gacha offers a recovery button
  even when the original purchase used the last coins/ticket.
- Pending client requests are stored in sessionStorage and survive a reload of
  the same tab. With storage blocked, retries are in-memory only. Closing the tab
  loses the client recovery link, not any committed reward or server receipt.
  Successfully committed inventory is still visible in the collection/fridge.
- The privileged RPCs derive the actor from `auth.uid()`. Private tables have
  RLS enabled, no public/client schema access and no client write grants. RPCs
  have an empty search_path and explicit authenticated-only execute grants.

## Scope and Remaining Work

These changes fix gacha checkout atomicity and stale-snapshot fridge overwrites.
They are not a migration of the entire app economy. Kitchen/bakery purchases
still use stock-first checkout with a compensation on payment failure; feeding
still saves the stat change separately from food consumption. A permanent
failure during compensation or a lost response at those outer boundaries needs
reconciliation. General profile coin grants, reward claims and the donut free-spin
cooldown remain separate workflows. Do not claim exactly-once completion for
those workflows on the basis of these two RPCs.

Legacy clients can still perform their old absolute writes. Refresh both devices
after deployment; this migration does not revoke existing app-wide table grants.
Receipts are retained for replay safety. Do not delete them while a client could
still retry the corresponding request; no automatic expiry is installed.

## Verification

```text
node scripts/build_economy_catalog.cjs
node scripts/check_economy_sql.cjs
node scripts/check_economy_client.cjs
node scripts/check_fridge_client.cjs
node scripts/check_cakes.cjs
node scripts/check_kitchen_food.cjs
node scripts/check_gacha_presentation.cjs
npx tsc --noEmit
```

The SQL checker runs the real migration and RPCs in disposable in-memory
PostgreSQL (PGlite), with test users and injected trigger failures. It verifies
whole-transaction rollback, mid-ten-pull failure, receipts, tickets/pity,
duplicate compensation, food delivery, interleaved stale-device actions, gifts,
legacy shared stock and function privileges. PGlite has one database connection;
this is not a multi-connection lock-contention test against hosted Supabase.

The client checker exercises the actual gacha hook and request journal with
simulated network failures. It verifies lost-response/reload replay, same-tick
double taps, missing-schema failures, busy cleanup and no charge/removal after
a failed stock grant. No production account or database is touched by these tests.

Browser captures are kept out of Git under `review-pictures/economy-fixes/`.
They exercise the actual UI with an isolated preview backend, not the hosted DB.
