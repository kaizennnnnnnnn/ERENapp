# Reward save reliability

## Deploy

Run `supabase/migration_reward_reliability.sql` manually before deploying the client.
It requires the existing economy receipts, quest completion table, streak/achievement,
level-reward, gacha, personal-food and battle-result migrations. It is safe to rerun:
existing wallets, completions, achievements, streaks and claimed levels are preserved.
It does not infer or repay historical partially saved rewards.

The RPC is `claim_reward_atomic(uuid, text, jsonb)`. Missing RPCs fail closed with an
update message; there is no fallback to the old split writes. Refresh old clients
after deployment, including the partner's device.

## Guarantees

- Quest completion, coins, XP, levels, streak milestones and eligible achievements
  commit together. Counted weekly quests use stored completions in the same ISO week.
- Achievement unlocks and their coin awards commit together and merge into the
  locked profile's existing achievement map.
- Streak repair and its cost commit together, using the original rules and prices.
- Reward-road coins, personal food, tickets, stardust, skin boxes and the claimed-level
  high-water mark commit together. Household-owned skins are excluded from boxes;
  exhausted rarities convert to the existing stardust prices. Pity is not reset.
- Generic coin helpers apply a delta to the locked saved balance, not a captured
  browser balance. Separate equal payouts have separate receipts.
- Requests are recorded in session storage before entering the per-user queue.
  Lost replies and reloads replay the same arguments/request ID. The outcome is
  immutable, but each successful reply includes the current saved profile snapshot.
- Committed requests can replay after a date rollover or an exhausted balance.
  Uncommitted date-bound requests must still match the server date in the supplied
  valid IANA timezone. They are not silently moved into a new quest period.
- Road recovery is available even when the saved claimed marker has already moved.
  Account/unmount guards prevent late results from being shown to a different user.

Private catalogs and receipts are not exposed to authenticated/anonymous clients.
Only authenticated users can call the RPC, and its actor is always `auth.uid()`.

## Boundaries

This is a reliability change, not a full anti-cheat system. Client event-based quests
still accept a known quest ID; reward values and duplicate-period checks are server
owned. Achievement eligibility uses stored facts rather than supplied scores/stats.
Game-score persistence and external payout sources are separate workflows.

Generic wallet deltas preserve existing caller compatibility. They do not make a
legacy purchase plus inventory grant, or an upstream payout marker, one transaction.
Other direct profile writers and old app versions can still write stale balances;
this change does not revoke their existing permissions. Cross-device snapshots may
briefly lag until another confirmed read; the saved transactions remain serialized.

If session storage is blocked, requests survive only in memory. Closing the tab
then loses local recovery intent, though server receipts and quest/road uniqueness
still prevent duplicate payouts from those protected sources.

## Verify Locally

```
node scripts/build_reward_catalog.cjs
node scripts/check_reward_saves_sql.cjs
node scripts/check_reward_saves_client.cjs
node scripts/check_food_actions_sql.cjs
node scripts/check_food_actions_client.cjs
node scripts/check_economy_sql.cjs
node scripts/check_economy_client.cjs
node scripts/check_donut_machine.cjs
npx tsc --noEmit
```

SQL tests use disposable PGlite databases and the real migration. The older quest
table fixture matches its live read-only schema inspection. They do not write to
Supabase. Single-connection rollback/replay tests do not simulate production
multi-connection contention. Browser previews use an isolated mock backend.
