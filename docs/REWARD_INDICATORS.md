# Reward Indicators And Free Food Pulls

Run `supabase/migration_free_food_gacha.sql` manually after the existing economy,
donut, Jelly progress and weekly-game migrations. It is rerunnable and preserves
existing wallets, tickets, food, skins, pity counters and cooldowns.

## Free Food Pull

Each account gets one food-machine pull per rolling 24 hours, not per calendar
day. It is used before tickets or coins. Other machines and ten-pulls keep their
existing prices; tickets remain usable on any machine. The HUD shows the offer
or a countdown. Missing SQL keeps the new timed offer off.

`claim_free_food_gacha_atomic` checks the expected account and locks the wallet
then gacha state. It reuses the existing tested draw transaction with a temporary
ticket, restores the exact original ticket count, and saves the cooldown and
outer receipt in the same transaction. It does not replace the paid-pull RPC,
catalog or rarity algorithm. Ordinary refusals and exceptions roll everything
back, including the temporary ticket. Replays recover the same food and current
wallet/state without another draw. A trigger prevents direct client backdating
of the new clock; old clients can still update their existing fields.

## Badge Rules

- Bakery: a confirmed free donut is ready.
- Gacha: the timed food pull or held tickets are ready.
- Jelly: a confirmed Super Jelly is available to feed.
- Play: unseen new games, unpaid weekly results or pending run saves.
- Me/level tile: unclaimed level rewards or new achievements/streak milestones.
- Quests: newly received quest rewards or a reward save needing confirmation.
- Kitchen: food won from gacha or reward-road food, until the kitchen opens.
- Menu bowl: a newly confirmed menu bonus, until its menu opens.

Claimable offers remain marked until used. Automatically received rewards remain
unread until the relevant view opens; a failed quest read does not acknowledge
them. Receipt/task-period identifiers prevent replay from making a seen reward
new again. Existing Closet and Us badges remain intact.

Unread markers and seen-game IDs are account-scoped in local browser storage,
with an in-memory fallback when storage is blocked. They sync across tabs, not
across devices. First install seeds current games quietly; future additions to
`PLAYABLE_MINIGAME_IDS` are marked new until that specific game opens.

The provider performs one invoker/RLS-protected status read, refreshes on relevant
save events, navigation, foreground return and a visible-only minute poll. A local
clock updates expired offers without refetching every tick. Unknown, failed and
malformed reads never invent free rewards. Old SQL falls back to existing reads
for donut/Jelly/ticket badges. Badge tracking never changes balances or inventory.

## Verification

```sh
node scripts/check_free_food_sql.cjs
node scripts/check_reward_indicators_client.cjs
node scripts/check_donut_machine.cjs
node scripts/check_reward_saves_client.cjs
node scripts/check_menu_client.cjs
node scripts/check_game_results_client.cjs
npx tsc --noEmit
```

SQL checks use disposable PGlite, real migrations and role/RLS checks, not hosted
players. They do not simulate production multi-connection contention. Browser
previews use isolated mock transport; 390/360px proof images live in the ignored
`review-pictures/reward-indicators` folder. Hosted verification is read-only
function hashes, grants, column and trigger inspection.
