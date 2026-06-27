-- ============================================================================
-- Disk IO diagnostic pack — Eren app
-- ============================================================================
-- 100% READ-ONLY. Just SELECTs reading Postgres stats tables. Nothing is
-- modified, nothing locks. Safe to run on production.
--
-- HOW TO RUN:
--   1. Supabase dashboard -> SQL Editor -> New query
--   2. Highlight ONE numbered block below with your mouse, then click Run
--      (the editor runs only what's selected). Copy the result.
--   3. Repeat for each block. Paste the results back to Claude.
--
-- If you only have time for three: run #1, #2, #3 — that's ~90% of the signal.
-- ============================================================================


-- ── 1. TOP IO CONSUMERS (the money query) ───────────────────────────────────
-- realtime.list_changes / decay UPDATEs / net.* should surface near the top.
select calls,
       shared_blks_read    as disk_reads,
       shared_blks_dirtied as dirtied,
       temp_blks_written   as temp_writes,
       round((wal_bytes/1048576.0)::numeric, 1) as wal_mb,
       left(regexp_replace(query, '\s+', ' ', 'g'), 90) as query
from pg_stat_statements
order by (shared_blks_read + shared_blks_dirtied + temp_blks_written) desc
limit 25;


-- ── 2. WRITE-HEAVIEST TABLES + dead-tuple bloat + autovacuum frequency ───────
-- Low n_tup_hot_upd relative to n_tup_upd = bloat-prone updates.
select relname,
       n_live_tup,
       n_dead_tup,
       n_tup_upd,
       n_tup_hot_upd,
       n_tup_ins,
       n_tup_del,
       autovacuum_count,
       pg_size_pretty(pg_total_relation_size(relid)) as size
from pg_stat_user_tables
order by (n_tup_upd + n_tup_ins + n_tup_del) desc
limit 25;


-- ── 3. CACHE HIT RATIO ───────────────────────────────────────────────────────
-- Below ~99% = instance is RAM-starved and reads are hitting disk.
select round(100 * sum(heap_blks_hit)::numeric
       / greatest(sum(heap_blks_hit) + sum(heap_blks_read), 1), 2) as cache_hit_pct
from pg_statio_user_tables;


-- ── 4. REPLICATION SLOTS ─────────────────────────────────────────────────────
-- An inactive/orphaned slot retaining lots of WAL is a classic IO + disk leak.
select slot_name,
       active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as retained_wal
from pg_replication_slots;


-- ── 5. WHICH TABLES STREAM OVER REALTIME ─────────────────────────────────────
-- Confirms the realtime surface we may want to trim.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;


-- ── 6. EVERY CRON JOB + ITS SCHEDULE ─────────────────────────────────────────
-- Reveals the /api/decay cron frequency that isn't visible in the code.
select jobid, jobname, schedule, active
from cron.job
order by jobid;


-- ── 7. pg_net BACKLOG (optional) ─────────────────────────────────────────────
-- May error "relation does not exist" depending on pg_net version. If so,
-- just SKIP it — not a problem. The other 6 are what matter.
select (select count(*) from net._http_response) as net_responses;
