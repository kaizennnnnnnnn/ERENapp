# Save response investigation

2026-11-09. The owner clarified that the slow part was waiting for buttons to
save, rather than switching rooms. A stalled receipt-backed write could wait
for three six-second attempts plus 800/1600ms pauses: 20.4 seconds total.

`writeWithRetry` accepts an optional total `budgetMs`. The saved-RPC journal
uses a six-second total budget, including retry pauses; fast transient retries
still fit inside it. Unconfirmed writes keep their durable request receipt,
so recovery reuses the same request instead of risking duplicate rewards.
Legacy absolute-value writes keep their previous retry policy.

This bounds the client wait for stalled saved RPCs. It is not evidence that
the remote server or every end-to-end button workflow now finishes in six
seconds. A read-only live snapshot showed no waiting database locks and no
health advisories; an intermittent connection problem cannot be diagnosed
from that one snapshot. No production data was changed to measure latency.

The service worker also deduplicates cached-image refreshes for five minutes
per full URL and limits initial art precache to four concurrent downloads.
The existing image cache epoch is preserved; upgrading does not force a fresh
download of all 75 precached assets (about 30.38 MiB). Offline and cache-busted
URLs retain their existing behavior and artwork quality is unchanged.

Checks:
- `check_save_budget.cjs`: five deterministic retry/budget cases.
- `check_image_cache.cjs`: ten actual-worker VM checks, including 200 warm
  consumers sharing one refresh, four-way precache, failures and offline hits.
- Existing receipt-backed client regression suites and TypeScript.

These are deterministic tests, not a hosted latency benchmark or a browser
service-worker installation test. The next useful measurement is timestamped
RPC duration on an actually slow button, without recording personal data.
