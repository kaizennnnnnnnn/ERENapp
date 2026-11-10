# Background badge requests

`RewardIndicatorsProvider` keeps local navigation/news handling separate from
Supabase readiness reads. Changing rooms, pages, quest-loading state, or a saved
coin balance does not refetch the gacha/Jelly/weekly/kiosk status.

Server refreshes still happen on mount, account/household changes, returning to
the foreground, the existing visible one-minute backup check, the kiosk night
boundary, and explicit reward/game/claim events, including fortune gifts that
award gacha tickets. The existing local clock still
updates free-donut and free-food cooldown dots without a request.

Overlapping focus/poll callers share one scoped read. A reward event immediately
invalidates an older in-flight snapshot and requests one fresh follow-up. Idle
event bursts retain the existing 150 ms debounce. Switching accounts/households,
including away-and-back transitions, or unmounting prevents stale UI patches.

Both status RPCs have a six-second total retry budget here. The optional budget
argument added to `readKioskNight` leaves other callers' behavior unchanged. The
older-SQL fallback reads also use bounded queries. No new SQL, polling, database
writes, realtime subscriptions, or changes to notification appearance are needed.

Checks:

```powershell
node scripts/check_reward_indicators_client.cjs
node scripts/check_kiosk_client.cjs
npx tsc --noEmit
```

The provider tests run actual source with controlled hooks and transport. They
count requests through navigation/wallet events, verify real reward and clock
updates still change the correct dots, and cover overlap, queued mutations,
legacy SQL, deadlines, account/household changes, StrictMode and cleanup.
Browser checks use the actual provider with an isolated local backend at 390x844
and 360x740; screenshots are under the ignored
`review-pictures/badge-requests-2026-11-10/` directory. Request reductions measured
there are local test results, not a claim of measured production latency or IO.
