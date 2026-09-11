-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION STATE PROBE — read-only. Writes nothing. Safe to run any time.
--
-- Paste the whole file into the Supabase SQL editor. Read the result set:
-- anything whose status starts with "**" needs action, and the rows are
-- ordered so those float to the top.
--
-- Why this exists: LAUNCH_STATUS.md and the memory notes disagree with each
-- other about what has been applied, and several of these features fail
-- SILENTLY when their migration is missing — a tap that pays nothing, a score
-- that is discarded, a spend ceiling that is simply absent. Ask the database.
--
-- Two things here that a plain existence test cannot catch:
--
--   • eren_opponent_score is checked BY VALUE. The file was rewritten after it
--     was first published as "paste this" (every number changed on 09-01), so
--     a stale copy would exist and answer with the wrong numbers. The morning
--     verdict would then contradict the scoreboard the player watched all day.
--     Expect full_house 16..20, nurse 7..11, the single-type twists 10..14.
--
--   • settle_daily_battle is checked for whether it actually CALLS the
--     opponent function. Applying the function alone still leaves the empty
--     seat scored at 0 — and because the tier ladder is margin-based, that
--     mints GOLD every single day from the app's only trophy source.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.probe(p_sql text)
returns text language plpgsql as $fn$
declare v text;
begin
  execute p_sql into v;
  return coalesce(v, 'null');
exception when others then
  return '** ERROR: ' || replace(sqlerrm, '**', '') || ' **';
end $fn$;

with
  solo_seated as (
    select exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'settle_daily_battle'
         and pg_get_functiondef(p.oid) like '%eren_opponent_score%') ok
  ),
  fk_blockers as (
    select count(*) cnt from pg_constraint
     where contype = 'f' and confrelid = 'public.profiles'::regclass
       and confdeltype = 'a'
  ),
  del_tables as (
    select string_agg(t, ', ') missing from unnest(array[
      'jelly_scores','jelly_duel_leads','jelly_progress','kiosk_shifts',
      'weekly_coop_results','weekly_game_results','countdown_doors',
      'memory_frames','eren_wishes','trophy_effects','user_trophy_items'
    ]) t where to_regclass('public.' || t) is null
  ),
  checks(sort_key, feature, status, what_breaks_without_it) as (

    -- ── The margin-ladder blocker ──────────────────────────────────────────
    select 0,
           'solo: eren_opponent_score VALUES',
           pg_temp.probe($q$
             select string_agg(t || '=' || s, ', ' order by t)
               from (select distinct
                            public.eren_twist_for_date(d::date) t,
                            public.eren_opponent_score(d::date) s
                       from generate_series(current_date - 8, current_date, '1 day') d) z
           $q$),
           'Solo daily battle, and the app''s only trophy mint'

    union all
    select case when ok then 9 else 0 end,
           'solo: settle_daily_battle SEATS Eren',
           case when ok then 'seated'
                else '** NOT SEATED — paste migration_solo_eren_opponent.sql **' end,
           'Without it the empty seat scores 0, so every solo day mints GOLD'
      from solo_seated

    -- ── Play-mandatory account deletion ────────────────────────────────────
    union all
    select case when cnt = 0 then 9 else 0 end,
           'delete_my_account: blocking foreign keys',
           case when cnt = 0 then 'none'
                else '** ' || cnt || ' FK(s) still NO ACTION — paste migration_delete_account_fk_fix.sql **' end,
           'Play requires a working in-app deletion path'
      from fk_blockers

    union all
    select case when missing is null then 9 else 0 end,
           'delete_my_account: tables it deletes from',
           coalesce('** missing: ' || missing || ' **', 'all present'),
           'A missing table raises 42P01 at RUNTIME; CREATE OR REPLACE proved nothing'
      from del_tables

    -- ── Features that fail silently ────────────────────────────────────────
    union all
    select case when exists (select 1 from pg_constraint
                   where conrelid = to_regclass('public.jelly_scores')
                     and pg_get_constraintdef(oid) like '%run%') then 9 else 0 end,
           'jelly run: game=''run'' accepted',
           case when exists (select 1 from pg_constraint
                   where conrelid = to_regclass('public.jelly_scores')
                     and pg_get_constraintdef(oid) like '%run%')
                then 'ok' else '** paste migration_jelly_run.sql **' end,
           'Every Jelly Run finish is discarded, with no error shown'

    union all
    select case when to_regclass('public.weekly_coop_results') is null then 0 else 9 end,
           'co-op goal: weekly_coop_results',
           case when to_regclass('public.weekly_coop_results') is null
                then '** paste migration_weekly_coop_results.sql **' else 'ok' end,
           'The "We Cared" CLAIM button takes the tap and pays 0 forever'

    union all
    select case when to_regclass('public.weekly_game_results') is null then 0 else 9 end,
           'arcade weekly: weekly_game_results',
           case when to_regclass('public.weekly_game_results') is null
                then '** paste migration_weekly_game_results.sql **' else 'ok' end,
           'The weekly arcade champion never settles'

    union all
    select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'purchase_skin_with_stardust')
                then 9 else 0 end,
           'stardust shop: purchase_skin_with_stardust',
           case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'purchase_skin_with_stardust')
                then 'ok' else '** paste migration_skin_stardust_shop.sql **' end,
           'The closet Buy button 404s on every tap'

    union all
    select case when exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'eren_stats'
                     and column_name = 'room_skins') then 9 else 0 end,
           'closet: eren_stats.room_skins',
           case when exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'eren_stats'
                     and column_name = 'room_skins')
                then 'ok' else '** paste migration_room_skins.sql **' end,
           'Per-room skin assignment cannot persist'

    union all
    select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'purchase_trophy_item'
                     and pg_get_functiondef(p.oid) like '%machine%') then 9 else 0 end,
           'weather machine: purchase_trophy_item knows ''machine''',
           case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'purchase_trophy_item'
                     and pg_get_functiondef(p.oid) like '%machine%')
                then 'ok' else '** paste migration_weather_machine.sql **' end,
           'The Lab machine''s four parts cannot be bought'

    union all
    select case when to_regclass('public.ai_spend_daily') is null then 0 else 9 end,
           'AI spend ceiling: ai_spend_daily',
           case when to_regclass('public.ai_spend_daily') is null
                then '** paste migration_ai_spend_ceiling.sql **' else 'ok' end,
           'chat/route.ts FAILS OPEN: no dollar cap on the Anthropic bill at all'

    union all
    select case when to_regclass('public.jelly_progress') is null then 0 else 9 end,
           'jelly parlour: jelly_progress',
           case when to_regclass('public.jelly_progress') is null
                then '** paste migration_jelly_progress.sql **' else 'ok' end,
           'Super Jelly cannot be fed and the jelly skin cannot be minted'

    -- ── Believed applied. Confirm rather than assume. ──────────────────────
    union all
    select 9, 'safety: report_content exists',
           case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'report_content')
                then 'ok' else '** MISSING **' end,
           'Play UGC policy requires in-app reporting'

    union all
    select 9, 'trophy battle: trophy_shop_items',
           case when to_regclass('public.trophy_shop_items') is null
                then '** MISSING **' else 'ok' end,
           'The whole Trophy Room shop'

    union all
    select 9, 'countdown: countdown_doors',
           case when to_regclass('public.countdown_doors') is null
                then '** MISSING **' else 'ok' end,
           'Cozy Countdown'

    union all
    select 9, 'cron jobs registered',
           coalesce((select string_agg(jobname || ' @ ' || schedule, ' | ' order by jobname)
                       from cron.job), '** NONE **'),
           'Stat decay, reminder fires, weekly sweeps'
  )
select feature, status, what_breaks_without_it
  from checks
 order by sort_key, feature;
