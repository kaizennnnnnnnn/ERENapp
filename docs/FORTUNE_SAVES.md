# Daily Fortune Saves

Run `supabase/migration_fortune_claims.sql` manually after the existing economy
migration, before deploying this client. It is safe to rerun and does not reset
cooldowns, inventory, wallets or gacha state. Missing RPCs fail closed.

`claim_fortune_atomic` authenticates the actor and verifies the expected account.
It locks the profile, then gacha state, in the same order as other economy RPCs.
The server checks the calendar-day cooldown, draws from the trusted catalog and
saves the reward, cooldown and receipt in one transaction. It does not change
the original 18 gifts, rarity weights, values, keepsake stacking or pity counters.

The supplied IANA timezone preserves the existing viewer-local calendar day,
not a 24-hour timer. It is validated but is not a trusted anti-cheat location.
Future cooldown timestamps do not grant extra gifts.

The shared saved-RPC journal preserves the request ID, actor and timezone across
lost replies and tab reloads. Replays return the original gift with current
balances/cooldown and never reroll or award twice. A pending receipt keeps the
recovery button available even if a subsequent read sees today's saved cooldown.
Coin balances are adopted from the saved response; they are not credited again
through the generic coin helper. The existing gift opening and coin shower remain.

Availability reads are bounded and fail closed. Local storage is an optional hint,
not proof of eligibility. Same-tab save events, cross-tab storage events, foreground
return and the visible-only minute poll refresh availability. The home gift button
also opens an explicit retry state when an availability read fails.

This does not repair historical split-write failures or revoke legacy direct-write
permissions. Refresh both devices after deployment. A closed tab can lose its local
recovery journal; saved rewards remain banked, but the old reveal may not reopen.
If browser storage is blocked, retry intent survives in memory only.

## Verification

```
node scripts/build_fortune_catalog.cjs
node scripts/check_fortune_sql.cjs
node scripts/check_fortune_client.cjs
node scripts/check_reward_saves_client.cjs
npx tsc --noEmit
```

SQL checks use a disposable PGlite database and real migrations, never hosted
player accounts. They cover all gifts, draw parity, calendar timezones, replay,
duplicate claims, account intent, missing initial state, full-table rollback and
function permissions. They do not simulate multi-connection production contention.
Browser previews use isolated mock transport; proof images are in the ignored
`review-pictures/fortune-saves` directory at 390 and 360 pixels.
