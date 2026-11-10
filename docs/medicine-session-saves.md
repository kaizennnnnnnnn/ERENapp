# Recoverable medicine saves

Both `VetScene` and `HospitalScene` use `complete_medicine_session_atomic` through
`medicineSessionSaves.ts` and the shared stats provider. The legacy
`applyAction(user, 'medicine')` entry delegates to the same method; it cannot fall
back to separate stats/history writes.

## Owner Rollout

Run the full `supabase/migration_medicine_session_saves.sql` in project
`bjnnqqxjjihmsbljeayf`, including `BEGIN` through `COMMIT`, before publishing the
client. It depends on the existing economy receipts, sleeping and useful-history
migrations. It adds one function, with no player-data resets or new cooldowns.
Existing clients keep working until the new client is published.

Without the function, the new client leaves treatment unconfirmed and shows an
update/retry message. It does not claim a cure or write through the old path.

## Contract

- The server checks the signed-in user and current household membership, locks
  the profile before the current household stats, and remembers the request ID.
- A dose applies the existing capped decay and medicine boosts (+10 happiness,
  +15 energy, +10 cleanliness), clears sickness, recalculates mood, and records
  care history in the same transaction. The sleeping flag is preserved, including
  the clinic's existing ability to treat a sleeping patient.
- The existing vet care needs remain eligible: sickness, cleanliness below 30,
  sleep quality below 30, energy below 20, or weight above 7. A stale healthy
  visit is a recorded no-op. Medicine counts as useful care only when sick.
- Replays return the original outcome with *current* care values. They never
  reapply a dose, cure a newer illness, or erase a partner's later care. Even
  no-op receipts remain no-ops after a later illness.
- Food, coins, outfits and other household fields are not changed. No new tables,
  policies, triggers, indexes or background polling are introduced.
- The tab's existing saved-RPC journal retains unconfirmed intent across reloads.
  Retry uses that same request, including from the other vet screen, even when
  the patient is now healthy. Recovery does not replay the gulp/happy animation.
- Buttons respond immediately with busy feedback; confirmation is bounded to six
  seconds. Care values and success reactions change only after a valid reply.
  Returning to a different account/household discards stale UI responses.

## Verification

```powershell
node scripts/check_medicine_session_sql.cjs
node scripts/check_medicine_session_client.cjs
node scripts/check_vet_ui.cjs
node scripts/check_clinic_ui.cjs
npx tsc --noEmit
```

The SQL suite runs the actual migration in disposable PGlite/PostgreSQL and
compares complete table snapshots for rollback, replay and refusal cases. It
checks care math, vet eligibility boundaries, partner interleavings, sleep
preservation, membership changes, reruns and grants. PGlite uses one connection;
these are not simultaneous lock-contention tests. No hosted player is treated
by verification.

Client tests run the actual helper, journal and provider source with mocked
transport, including ignored aborts and late results. UI tests execute the actual
scene handlers and render their controls. Phone screenshots use an isolated local
backend at 390x844 and 360x740, with non-local requests blocked, under the ignored
`review-pictures/medicine-saves-2026-11-10/` directory.
