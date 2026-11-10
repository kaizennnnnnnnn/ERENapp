# Shared household reads

The shared couple provider separates messages, partner, household date, moods,
current-week care and historical results into independent read groups. Calls
overlapping within a group share one operation. Messages do not wait for a slow
partner lookup or history calculation.

The household start date is reused for the signed-in actor/household session,
including the Us page's postmark. Historical daily backfill, lifetime aggregation
and last-week settlement run once per successful local day and partner identity.
Returning to the app still refreshes messages, partner profile, moods, weekly
care, co-op claim state and last-week claim/acknowledgement state. Explicit
`refetch()` retries history too. A failed history calculation is not cached.

The existing single filtered journal INSERT subscription remains. Reconnection
reconciles only the two message lists; foreground reconciliation still handles
deletions because there is no new DELETE subscription. Incoming inserts and
confirmed deletes invalidate an older message snapshot and request one fresh
follow-up. Repeated payloads do not duplicate messages or unread counts.

Reads have bounded retry budgets (six seconds for current data, eight seconds
for each history branch). Failed reads preserve existing data; a failed initial
partner lookup never means a solo household. Actor/household changes and unmount
invalidate pending UI updates, including away-and-back account transitions.
Day/week changes during reads request fresh snapshots before accepting results.

Persisted history now rejects failed care/effect/result queries rather than
recording an invented empty result. The old missing-effect-table and missing
twist-column rollout paths remain supported. Scores, rewards, claim formulas,
SQL, polling cadence and page appearance are unchanged. This does not replace
the legacy weekly/co-op payout persistence with a new atomic transaction.

Checks:

```powershell
node scripts/check_couple_reads.cjs
node scripts/check_couple_history.cjs
npx tsc --noEmit
npm run build
```

The provider checks execute actual provider/queue source with controlled hooks
and transport. The history checks execute actual settlement/effect helpers with
mock queries. Local browser QA uses the actual provider and Us page with
isolated mock accounts, bridging saved rows between contexts for recipient
realtime tests. It does not send real messages, notifications or player writes.
Screenshots are kept under ignored `review-pictures/couple-reads-2026-11-10/`.
Request reductions in these checks are local measurements, not a measured
production latency or Disk IO reduction.
