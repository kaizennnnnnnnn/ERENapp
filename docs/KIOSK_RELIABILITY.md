# Shawarma Step 1: Reliable Shifts

Run `supabase/migration_kiosk_reliability.sql` manually after the existing kiosk
and economy migrations. It preserves all old wallets, shifts, notes, menu unlocks
and regulars, and adds the weather column missing from the older hosted table.
There is no historical backpay. Install the SQL before releasing this client.

## Save Contract

- Entry calls `start_kiosk_shift_atomic`: expected account, current household,
  valid timezone, server time/day and decayed energy are checked together.
- Starting consumes no coins or daily shift. Empty exits remain unworked.
- Closing calls `close_kiosk_shift_atomic`: wallet, paid daily record, lifetime
  orders, customer visits, session completion and receipt commit together.
- A second tab may have started before the first closes. It becomes unpaid
  practice when the first paid record wins, never a second daily payment.
- Closed practice sessions still learn regulars once, without a paid daily row.
- Visit counts are increments against a frozen opening snapshot. The stats-row
  lock merges them with the partner's latest memory instead of overwriting it.
- Retries keep their original request/session/report in the existing account-
  scoped session-storage journal. Replays return the original award and current
  wallet, never another payment or another memory increment.
- Only confirmed receipts update the wallet display. Missing SQL blocks entry
  with an update message; failed closes retain their result for retry on the
  receipt, shop front, reload or foreground return. New shifts wait for recovery.
- Notes remain owner-editable, but economic columns cannot be edited. Legacy
  own-row inserts remain allowed during rollout so the currently deployed shop
  can still record its day. The new client never uses this split-write path.

The server keeps existing grade thresholds, early-close base-only pay, energy
threshold and shared-goal bonus. It derives totals, grade and award; the client
does not send a coin amount or grade. Report fields and remembered orders are
bounded and validated. This is not a server-authoritative simulation of every
ingredient interaction; a client-generated report is still an untrusted score.

## Scope And Next Steps

This step deliberately keeps the existing local-calendar daily reset. The date
is now fixed by the server at entry rather than recalculated when closing.
Shared-bonus catch-up for a partner who finished earlier, the household reset
clock, stamps and daily dock badge are separate next steps. Existing kiosk
artwork and opening/closing animations stay.

## Nightly Special

The front board previews one of seven named recipes using the current local
calendar date. Entering freezes the recipe and featured opening customer from
the server-confirmed session `shift_date`; crossing midnight cannot change an
active shift. Recipes only use day-one ingredients and keep normal prices and
tips, with no new bonus, claim, daily allowance or SQL change. The special guest
always shows the full recipe rather than asking for a usual. Serving that order
does not replace the guest's saved usual; later visitors retain normal behavior.
The board refreshes on foreground return and each minute while open. Devices in
different timezones still follow the existing per-player calendar reset until
the shared household reset is implemented.

Only a finished report is recoverable; this does not resume half-built meals
after a page reload. Storage-blocked browsers retain retry intent in memory,
not across reloads. Legacy clients should be reloaded when releasing this update;
they cannot use the new atomic save. There is no legacy fallback in the new
client. If the first migration version was already applied, run the small
`migration_kiosk_rollout_compat.sql` patch to restore own-row legacy inserts.

## Verification

```sh
node scripts/check_kiosk_sql.cjs
node scripts/check_kiosk_client.cjs
node scripts/check_kiosk_specials.cjs
node scripts/check_kiosk_ui.cjs
npx tsc --noEmit
npm run build
```

SQL tests use disposable PGlite with actual schema/migrations, failure injection
and role grants. Competing sessions are tested sequentially; this is not a
production multi-connection load test. Browser checks use isolated preview
transport and seeded end-of-shift reports; they never award real player coins.
