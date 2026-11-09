# Recoverable bedroom saves

2026-11-09. `migration_sleep_session_saves.sql` adds
`complete_sleep_session_atomic(request, expected_user, household, action)`.
The owner confirmed installation. Read-only verification matched the function
body to the local SQL (LF-normalized MD5 b064066ffa64e6ec92857f891e81dfa2),
SECURITY DEFINER with an empty search_path, authenticated execution only.

Tuck-in locks the household stats, applies the existing decay/care rules and
saves the asleep flag, care values, one useful-care history row and a receipt
together. Waking only changes the asleep flag and update timestamp; it does
not reset decay or grant a second care history entry. No player data is reset.

No-op results also have receipts: replaying an old tuck after a later wake
cannot put the cat back to bed. A replay returns current stats, while keeping
the original action/changed/history result. Client scope/timestamp guards
prevent late replies from another account or household overwriting newer data.

`sleepSessionSaves.ts` journals the original tuck/wake intent. If a reply is
lost, the bedroom offers recovery with the same request/action, including
after reload. The write starts underneath the existing tuck choreography.
Wake stretch and daily-care credit happen only after a confirmed useful
change; recovering an uncertain save does not repeat the choreography.

Validation:
- `check_sleep_session_sql.cjs`: 125 disposable-database scenarios.
- `check_sleep_session_client.cjs`: 13 actual helper/provider checks.
- `check_sleep_ui.cjs`: actual handler/cleanup behavior, same-tick locks,
  uncertain saves, no-ops, choreography overlap and renamed-cat button states.
- TypeScript and production build.

No hosted sleep/wake writes were performed for testing. These checks do not
replace mobile visual review of the changed recovery button states.
