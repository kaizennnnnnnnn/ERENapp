# Memory Wall background reads

One batch runs at a time per signed-in tab. A short collection window keeps
each distinct event, so a care action and the wish it grants both qualify for
their own firsts. Failed work is retried in the same session on the next
event, reconnect or return to the app, with a cooldown and no retry polling.
Changing users or households cancels queued work and aborts in-flight requests.

Already unlocked frames are held in memory and refreshed when a relevant
check needs them, at most once a minute. Firsts need no counter reads.
Other milestones read only the counts their events can change. Existing
thresholds, UTC-day rules, original journal counting, unlock identity,
unique insert behavior and the notification trigger are preserved.

The app works with or without `supabase/migration_memory_counters.sql`.
Before installing it, a warm feed batch uses at most three care reads
instead of the prior 14-read snapshot for a two-person household. After
installing the migration, those counts use one RPC. A cold batch may also
read unlocked frame IDs; inserts are separate and only happen for newly
qualified frames. Existing open tabs using the fallback need to reopen or
refresh to pick up the RPC. Only a missing RPC enables the fallback.

The migration adds a read-only, security-invoker function. It checks the
caller's household and keeps existing row-level security in force. It adds
no table, index, scheduled job or data update. Apply it manually in Supabase.

Verification:

```powershell
node scripts/check_memory_event_reads.cjs
node scripts/check_memory_counters_sql.cjs
npx tsc --noEmit
npm run build
```

These verify request counts against a mock transport and SQL behavior against
disposable Postgres. They are not measurements of live latency or disk IO.
After rollout, compare slow calls, errors and disk IO at similar play volume.
