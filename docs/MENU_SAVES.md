# Daily Menu Saves

Run `supabase/migration_menu_bonus.sql` manually after the economy and food-action
migrations, before deploying this client. It is safe to rerun and does not reset
food, coins or claimed menus. Missing RPCs show a retry state; there is no fallback
to the old split writes.

`claim_menu_bonus_atomic` verifies the account and household, then locks the profile
and household stats in the existing economy order. It reconstructs today's progress
from successful food-action receipts, including meals fed by either partner. It also
retains valid progress recorded by older clients. Purchases and other households'
meals do not count. The menu's existing 40-food pool, seeded selection and 30-coin
reward are unchanged; the generated private catalog is checked against client data.

The third meal's bonus, household claim marker and request receipt commit together.
A private household/day claim prevents double payment even if an old client later
overwrites the public marker. Legacy claimed markers are honored without backpay:
the migration cannot know whether a historical split-write payout succeeded.

The calendar day follows the viewer's validated IANA timezone, preserving existing
behavior and daylight-saving boundaries. The supplied timezone is not an anti-cheat
location. The payout goes to the account that confirms the completed menu first.

The shared saved-RPC journal retains the request ID across lost replies and reloads.
A retry returns the saved outcome with current wallet/menu state. An older pending
day is recovered before synchronizing the displayed day. Only confirmed responses
update the wallet; the client never adds the bonus optimistically. The menu says
"Paid" only after the claim marker is confirmed. Foreground return, changed food
inventory and a visible-only recovery poll refresh progress without a retry loop.

This does not revoke legacy direct-write permissions. Refresh both devices after
deployment. With browser storage blocked, pending intent survives only in memory;
the database claim still prevents a second payout.

## Verification

```sh
node scripts/build_menu_catalog.cjs
node scripts/check_menu_sql.cjs
node scripts/check_menu_client.cjs
node scripts/check_food_actions_client.cjs
node scripts/check_fortune_client.cjs
npx tsc --noEmit
```

SQL tests use a disposable PGlite database and real migrations, not hosted players.
They cover seeded-menu parity, actual feeding receipts, shared claims, replay,
rollover, legacy markers, rollback and permissions. They do not simulate concurrent
production database connections. Client checks exercise the actual hook and save
helper, including account changes, lost replies and meals arriving during a save.
Browser checks use isolated mock transport at 390 and 360 pixels; screenshots are
in the ignored `review-pictures/menu-gift-review` directory. Live verification is
read-only function/catalog/permission inspection, not a claim against a player.
