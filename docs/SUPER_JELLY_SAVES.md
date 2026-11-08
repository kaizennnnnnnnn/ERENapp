# Super Jelly Feeding Saves

Run `supabase/migration_super_jelly_saves.sql` manually before releasing this
client. It depends on the existing economy receipts, Jelly progress, cleanliness,
sleep and useful-interaction migrations. No progress, flavours, skins, coins or
other player data are reset, and old split-write losses are not backpaid.

## One Confirmed Feed

The new `feed_super_jelly_atomic` RPC derives the actor from `auth.uid()`, checks
the expected account and household, and takes the profile, household stats and
Jelly progress locks in that order. One transaction spends one Super Jelly,
increments the lifetime feed count, applies the original fixed buff, adds 120
coins, inserts the care interaction and grants the Jelly skin from the fifth
feed onward if absent. Any write failure rolls all of it back.

Effects preserve the existing `SUPER_JELLY_BUFF` and `feedWithFood` math: capped
12-hour client-style decay, rounded/clamped stats, full energy, cure, unchanged
weight apart from the existing range clamp, and the same useful-feed test. Sleep
state is preserved, matching the previous Super Jelly path. No new sickness,
health changes, food inventory changes or general stat-writer refactor is added.

The original skin/progress implementation is retained privately. Its public
zero-argument wrapper remains compatible with old clients but takes the profile
lock first to avoid mixed-client lock inversion. It intentionally retains the
old progression-only contract; refresh both devices after deployment.

## Recovery

The saved-RPC journal scopes one outstanding feed to its account and household.
An unknown or malformed reply keeps the same request ID across retries and tab
reloads. A successful replay returns the original animation/unlock result plus
current wallet and progress values; it never spends, buffs or pays again.
Confirmed refusals and missing SQL clear the uncommitted request, with no legacy
split-write fallback. A pending feed stays visible even with zero stock or a
skin that the first attempt already granted. The home Jelly dot also points to
unconfirmed feeds. Feeding never happens automatically on page entry.

The client adopts confirmed coins rather than calling `addCoins`, refreshes the
saved stats/inventory, and ignores late results after account/household changes
or unmount. The existing partner care notification is emitted only after confirmation.
Existing feeding and skin-unlock animations remain behind confirmation.
The journal survives in sessionStorage; blocked storage falls back to memory.
Closing the tab can lose the reveal link, not committed rewards.

Regular round `collect_jelly` effects and duel rewards remain separate work;
this migration does not claim to make those flows atomic or anti-cheat.

## Verification

```sh
node scripts/check_super_jelly_sql.cjs
node scripts/check_super_jelly_client.cjs
node scripts/check_super_jelly_ui.cjs
node scripts/check_reward_indicators_client.cjs
npx tsc --noEmit
npm run build
```

SQL checks run real migrations in disposable PGlite, including failure injection,
JS decay/buff parity, receipts, account checks, old-client compatibility and
privileges. They order competing operations sequentially, not as a hosted
multi-connection load test. Browser previews use isolated mock transport;
screenshots at 390/360px live in ignored `review-pictures/super-jelly-saves`.
