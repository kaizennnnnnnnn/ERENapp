# Startup availability investigation

2026-11-10. Both household members reported three days of failed opens,
connection messages and unresponsive saves. The free-plan log window available
to this investigation covered the latest 24 hours, not the full three days.

Read-only gateway logs included a profiles request completing after 118,112 ms,
another failing with HTTP 500 after 147,191 ms, and an Auth user request with
HTTP 522. Other stats and reminder responses took over ten seconds. A public
production `/home` document returned HTTP 200 in about 937 ms during the check.
These measurements confirm backend availability trouble, but do not prove
disk throttling rather than memory pressure or another server/network issue.
Historical SQL counters are not measurements of those individual requests.

## First corrective batch

- `useAuth` now reads a single browser-tab store. Thirty mounted readers share
  one account verification, profile request, auth listener and recovery listener.
  Server rendering uses a fixed anonymous/loading snapshot, never browser state.
- Account/profile startup has a ten-second total deadline. Failure remains an
  unconfirmed connection state, not a fabricated sign-out or missing household.
  Profile retries reuse the verified actor. Sign-out, account changes, ABA
  switches and stale responses cannot restore another account's profile.
- Explicitly saved profile patches still update all readers without rereading
  coins/streaks. Onboarding announces its confirmed household before SPA navigation,
  including when a previous profile read is still outstanding.
- `/` redirects to `/home` without a server Auth network dependency. Existing
  client guards still send definitively signed-out visitors to onboarding;
  server API authorization and database RLS are unchanged.
- Home stats reads coalesce, abort/time out at eight seconds, preserve already
  loaded data on failure and ignore stale/scope-changed results. Optional clock
  initialization/freeze writes no longer hold an already-read room on its loader.
- Home/entry-point errors expose an in-place retry, rather than a full reload
  that restarts all startup requests. The copy no longer blames the phone's
  internet for an unavailable server. A failed daily-mood check cannot re-ask
  and overwrite a mood already recorded for today.
- Hidden tabs no longer run periodic stats reads or decay safety-net pings.
  The server's scheduled decay and notification jobs remain enabled.
- Write timeouts now settle even if the SDK is waiting for an auth lock and
  ignores AbortSignal. Existing receipt IDs are retained for uncertain saves;
  this does not invent success or roll back a possibly committed write.

No hosted player writes, plan upgrade, database reset or schema change was made.
This is an availability/resilience fix, not proof that the Disk IO warning has
been eliminated. Infrastructure Disk IO balance, RAM and swap charts around
the email are still needed to establish the resource bottleneck. Load testing
belongs in an isolated environment, not the production household.

## Verification

- `check_startup_recovery.cjs`: 17 deterministic cases using the real auth store,
  transport, hook and stats-read source, including failure/retry/account races.
- `check_save_budget.cjs`: six budget cases, including SDK promises that ignore
  abort and quick retry/legacy behavior.
- Existing receipt-backed client regression suites, loading checks, TypeScript
  and a production build with non-live build credentials.
- Isolated browser fixture with thirty real store readers: failed and stalled
  profile requests, retry/busy state and return to the mock room at 390x844 and
  360x740. It does not authenticate or write to the hosted project.
