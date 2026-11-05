# Kitchen and Bakery Saves

## Rollout

1. Keep `migration_economy_reliability.sql` installed.
2. Run the complete `supabase/migration_food_actions.sql` in the Supabase SQL
   editor for project `bjnnqqxjjihmsbljeayf`. The migration checks its existing
   schema dependencies and is safe to re-run. It does not reset game state.
3. Only then deploy the matching clients and refresh both devices. Clients with
   missing RPCs refuse these actions without charging or consuming anything;
   they never fall back to the old stock/payment compensation path.

## Contracts

- `purchase_food_atomic` charges the server catalogue price and adds one food
  to the buyer's personal fridge in one transaction. Kitchen/bakery availability
  stays distinct; retired Fish/Sushi stock remains edible, not buyable.
- `spin_donut_atomic` rolls uniformly from the existing 24 non-exclusive donuts.
  It uses the server clock, prefers an available free spin, and saves the prize,
  any 50-coin payment, and any free-spin timestamp together. A request for a free
  spin never silently becomes a paid spin. Paid spins do not reset the free clock.
- `feed_food_atomic` consumes personal stock first, then shared legacy stock.
  Consumption, current-row care benefits, coin perks, donut collection/effects,
  earned drink skins and the feed interaction save together. Prices, taste,
  perks, decay math and animation choreography are unchanged. This mirrors the
  existing feed-time decay rules, not the cron's different decay calculation.
- All three bind intent to the authenticated user and original household. They
  use the existing private receipt journal and wallet/state/fridge lock order.
  Recovery returns the original outcome and current wallet/fridge values. It
  never rerolls, extends an effect, consumes another food or charges again.
- One shared client ref lock covers all three actions. Pending requests survive
  same-tab reloads in sessionStorage and can be recovered without coins or food
  left. With storage blocked, only the in-memory journal survives. Closing the
  tab can lose the recovery link, not a committed reward or server receipt.
- Success-only wish/menu/quest work follows confirmation. The synchronous saved
  wallet event prevents a captured daily-feed quest callback from immediately
  overwriting the food's confirmed coin perk with its old render balance.
- The donut eligibility hook is read-only. Failed reads do not imply a free spin,
  stale/user-switched reads are ignored, and the UI accepts only saved server
  timestamps after a spin. Its retry control remains usable after a read failure.

## Remaining Boundaries

This is not an app-wide wallet/stat migration. Other care actions, generic food
grants, jelly compatibility paths, daily quests/menu rewards, achievement grants
and old clients still have their own save workflows. Their stale absolute writes
can conflict with these server transactions. Follow-up quests/wishes/menu work is
not part of the food receipt and can be missed if the tab closes immediately.
Do not claim global exactly-once economy behavior or revoke existing app-wide
grants on the strength of this change. Refresh both devices after deployment.

The bakery's three-item rotation still uses the existing viewer-local day. The
server enforces the bakery catalogue, not a new UTC-based daily stock selection.
Receipts must not be deleted while a client could still retry them.

## Catalogue and Verification

The SQL catalogue is generated from the actual kitchen declarations and existing
cake/donut/perk/skin definitions. After changing food rules or availability, run
`node scripts/build_food_action_catalog.cjs --write`, test, and re-run the SQL
before deploying the matching clients.

```text
node scripts/build_food_action_catalog.cjs
node scripts/check_food_actions_sql.cjs
node scripts/check_food_actions_client.cjs
node scripts/check_donut_machine.cjs
node scripts/check_feed_controls.cjs
node scripts/check_cakes.cjs
node scripts/check_kitchen_food.cjs
node scripts/check_fridge_client.cjs
node scripts/check_economy_client.cjs
npx tsc --noEmit
```

SQL tests execute the actual migrations and production schema/battle guards in
disposable PGlite. They cover 89-food parity, seeded spins, receipt replay,
household intent, failure rollback and permissions. PGlite is one connection;
these are not hosted multi-connection lock-contention tests. Client tests run the
actual journal/hooks against mock requests. Browser review uses an isolated
preview backend; no real account, food, coins or hosted database is changed.
