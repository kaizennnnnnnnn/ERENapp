# Shared Kiosk Nights

Run the full `supabase/migration_kiosk_nights.sql` manually before publishing this
client. It expects the existing economy/kiosk migrations and `households.tz` from
the live phase-3 schema. It does not reset wallets, food, skins, notes or history.
There is no historical backpay. Weekly stamps and a kiosk dock dot are later work.

## Clock And Paid Shifts

- At first use, a private clock pins the household's existing valid timezone
  (UTC fallback). Changing the phone clock/timezone or later changing the general
  household timezone cannot reopen the kiosk's paid slot.
- A night runs from 04:00 to the following 04:00 in that zone. Calendar arithmetic
  uses wall time, so daylight-saving nights can be 23 or 25 hours long.
- Entry freezes the server-confirmed night, reset instant and energy eligibility.
  A shift crossing the reset still belongs to its original night.
- Each player has one paid slot per night. Empty exits do not use it; tired and
  already-worked shifts remain unpaid practice, with ordinary regular learning.
- Status refreshes on foreground, each minute and at the confirmed reset.
  The countdown advances from server time with a monotonic clock, not phone time.

## Shared Bonus

The target remains 22 paid orders and the reward remains 40 coins per contributor.
Each contributor creates their own pending bonus record when saving a paid shift.
When a new-clock night reaches its target, the transaction marks those bonuses
earned. The closing player's bonus is included
in their receipt. Earlier finishers can collect theirs later, including on a later
night. Repeated taps, multiple tabs and lost replies replay the same saved request;
an entitlement can move into the wallet only once. Practice does not pay bonuses.
No operation writes a partner's wallet while holding the current player's lock.
Creating only the current player's bonus record also avoids a foreign-key lock
on a partner who may be starting or closing their own shift at the same time.

Earned entitlements remain separate from shift history, so deleting another
player's account does not erase the remaining player's already-earned bonus.
Claims still require membership in the household that earned the reward.

## Compatibility And Special Orders

Old paid records stay in `kiosk_shifts`; new ones use `kiosk_night_shifts`, avoiding
collisions with old calendar-date primary keys. Both are shown in history. The
old atomic closer stays available for already-open tabs and journaled closes;
both versions serialize against the same profile/stats locks and check whether
the other version already paid the same physical night. Old direct-insert grants
are left unchanged. Only new-clock paid shifts count toward new-clock bonuses;
old history is not reinterpreted or retroactively paid during rollout.

The special-order count now travels with the saved close. The server validates
ordinary remembered visits plus at most one served special against the total.
This fixes the unpublished special's mismatch with the old SQL's visit-count
check, without replacing a regular's saved usual with a one-off daily recipe.

Missing new functions preserve the readable old board but block new-clock entry
with an update message. Existing finished old closes still recover on their old
RPC. There is no fallback split wallet/shift write. Notes are pinned to the exact
new session rather than a date shared with old history.

## Verification

```sh
node scripts/check_kiosk_nights_sql.cjs
node scripts/check_kiosk_sql.cjs
node scripts/check_kiosk_client.cjs
node scripts/check_kiosk_specials.cjs
node scripts/check_kiosk_ui.cjs
npx tsc --noEmit
npm run build
```

Database checks run actual migrations in disposable PGlite, including role checks,
injected write failures, DST boundaries, recovery, grades and mixed-version closes.
Competing calls are ordered sequentially; this is not a live multi-connection load
test. Browser previews use an isolated mock transport and never award real coins.
