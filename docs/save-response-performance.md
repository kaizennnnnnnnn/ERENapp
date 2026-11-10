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
- `check_save_budget.cjs`: six deterministic retry/budget cases, including an
  SDK promise blocked on authentication that ignores cancellation. The startup
  recovery pass now races the deadline as well as aborting the HTTP request.
- `check_image_cache.cjs`: ten actual-worker VM checks, including 200 warm
  consumers sharing one refresh, four-way precache, failures and offline hits.
- Existing receipt-backed client regression suites and TypeScript.

These are deterministic tests, not a hosted latency benchmark or a browser
service-worker installation test. The next useful measurement is timestamped
RPC duration on an actually slow button, without recording personal data.

## Collection snack follow-up

The collection's "Use one" path still had four sequential requests: stat
read, buff update, inventory decrement/delete, inventory refresh. The item
write's error was not checked, so a failed response could grant the buff
without consuming stock. It also closed the sheet before saving.

`migration_inventory_item_saves.sql` replaces that action with one atomic,
receipt-backed `use_inventory_item_atomic` RPC. The server derives all 13
existing buffs from an allowlist, locks the actor, household stats and stock,
and commits the buff, one-item decrement and receipt together. It changes no
fridge food, coins, care history, decay clock or cosmetic fields. Replays
return current stock and care values without applying the buff again.

The client adopts the confirmed quantity and stats without awaiting another
read, rejects stale reads/responses and account/household changes, and keeps
an uncertain request recoverable after a reload. The item sheet stays open
with a busy action or visible retry message. Missing SQL refuses safely with
no legacy write fallback. Install the entire SQL file manually before
publishing the client; the currently published client remains compatible.

Verification: `check_inventory_item_sql.cjs` (181 disposable PostgreSQL
scenarios), `check_inventory_item_client.cjs` (14 real-helper/hook/provider tests with
mock transport), and isolated browser checks at 390x844 and 360x740. No hosted
player writes or hosted latency benchmark were used.
