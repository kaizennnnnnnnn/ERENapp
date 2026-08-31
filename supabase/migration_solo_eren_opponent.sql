-- ============================================================================
-- Solo households: Eren takes the empty seat in the daily battle
-- ============================================================================
-- WHY THIS IS NOT COSMETIC.
--
-- The daily battle was built for two people. In a household of one,
-- settle_daily_battle scores `v_them = 0`, so `v_margin = v_me` — the player's
-- WHOLE score becomes the winning margin. The tier ladder is margin-based
-- (>=6 gold, >=3 silver, >=1 bronze), so a solo player would settle GOLD every
-- single day they did six points of care, plus the +2 streak bonus every third
-- day. The daily battle is also the ONLY place trophies are minted anywhere in
-- the app, and trophies buy the entire Trophy Room. That is a printing press.
--
-- Today it is merely dead instead: useDailyVerdict.ts gated settlement on
-- `partner?.id`, so a solo player never settled and never earned a trophy, and
-- the whole Trophy Room was a wall of prices they could not pay. Removing that
-- gate WITHOUT this migration turns the dead feature into the printing press.
-- Do not deploy one without the other.
--
-- So Eren gets a score. Every rule downstream is then untouched — tier by
-- margin, the streak bonus, the consolation rule, the outcome string, and the
-- `partner_score` column he is stored in. No table changes.
--
-- ── MIRRORS src/lib/erenOpponent.ts ──
-- The client computes this to render the live HUD; this function computes it
-- to settle and mint. If the two disagree, the morning verdict contradicts the
-- scoreboard the player watched all day. Nothing tests for that drift.
-- Change one, change the other.
--
-- Same reasoning as eren_twist_for_date: array lookups rather than a seeded
-- RNG, precisely so it ports to a few lines of SQL.
--
-- Idempotent. Run in the Supabase SQL editor.
-- ============================================================================


-- ── Eren's score for a date ─────────────────────────────────────────────────
-- EREN_BASE keyed on the twist (the twist decides what an action is WORTH, so
-- a flat number would make high-multiplier days free wins), plus an 11-long
-- jitter against the twist cycle's 8 for an 88-day period, floored at 3.
--
-- Calibrated against 204 real playing days: median 13, p75 21, p90 33, max 66.
-- Eren sits at about the median for his twist, so a median day is a coin flip.
-- He is deliberately NOT set low: the tier ladder is margin-based, so a weak
-- opponent would mint gold on any ordinary day and pay a solo player roughly
-- 3x what someone in a couple earns (two real partners keep each other's
-- margins small just by both showing up).
create or replace function public.eren_opponent_score(p_date date)
returns int
language sql
immutable
set search_path = public
as $fn$
  select greatest(
    3,                                          -- EREN_FLOOR
    (case public.eren_twist_for_date(p_date)    -- EREN_BASE
       when 'bath_day'   then 12
       when 'feast'      then 12
       when 'playday'    then 12
       when 'nap_day'    then 12
       when 'nurse'      then 9
       when 'double'     then 16
       when 'full_house' then 18
       when 'sprint'     then 16
       else 12
     end)
    + (array[0,1,-1,2,-1,1,0,-2,1,0,-1])[       -- EREN_JITTER, length 11
        (((p_date - date '1970-01-01') % 11) + 11) % 11 + 1 ]
  );
$fn$;

grant execute on function public.eren_opponent_score(date) to authenticated;



-- ── The settler, with the empty seat filled ─────────────────────────────────
-- Reproduced in full from migration_trophy_battle.sql with ONE expression
-- changed (marked "SOLO:" below). Written out rather than patched at runtime
-- so it is reviewable and cannot silently mis-apply. CREATE OR REPLACE, so
-- re-running is a no-op. If you edit the scoring in migration_trophy_battle.sql
-- later, this copy is the one that is live — reconcile them.

create or replace function public.settle_daily_battle(
  p_date  date,
  p_start timestamptz,
  p_end   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid      uuid := auth.uid();
  v_hh       uuid;
  v_partner  uuid;
  v_twist    text;
  v_me       int := 0;
  v_them     int := 0;
  v_outcome  text;
  v_margin   int;
  v_tier     text;
  v_amount   int := 0;
  v_streak   int := 0;
  v_updated  int;
  v_balance  int;
  v_cursor   date;
  v_prev     text;
  v_claimed  boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  -- ── Window sanity ──
  if p_start is null or p_end is null or p_end <= p_start then
    return jsonb_build_object('ok', false, 'reason', 'bad_window');
  end if;
  -- A calendar day, give or take a DST hour.
  if (p_end - p_start) < interval '23 hours'
     or (p_end - p_start) > interval '25 hours' then
    return jsonb_build_object('ok', false, 'reason', 'bad_window');
  end if;
  -- The day must be OVER. This replaces an earlier `p_date >=
  -- current_date` test that compared a client-LOCAL date against the
  -- server's UTC one, and so refused legitimate claims during the first
  -- hours of the local day east of Greenwich.
  if p_end > now() then
    return jsonb_build_object('ok', false, 'reason', 'not_finished');
  end if;
  -- And the window must sit on the date it claims, so it cannot be slid
  -- over a busier day.
  if abs(extract(epoch from (p_start - p_date::timestamptz))) > 86400 then
    return jsonb_build_object('ok', false, 'reason', 'bad_window');
  end if;
  -- Nothing older than the backfill window is settleable, so a fresh
  -- account cannot walk backwards through history minting trophies.
  if p_date < current_date - 40 then
    return jsonb_build_object('ok', false, 'reason', 'too_old');
  end if;

  select household_id into v_hh from public.profiles where id = v_uid;
  if v_hh is null then
    return jsonb_build_object('ok', false, 'reason', 'no_household');
  end if;

  select id into v_partner
  from public.profiles
  where household_id = v_hh and id <> v_uid
  limit 1;

  v_twist := public.eren_twist_for_date(p_date);

  -- ── Score the day from what actually happened ──
  --
  -- Mirrors scoreDaily(): useful care actions only, in order, with a
  -- DOUBLE HOUR duplicating a row rather than doubling a subtotal —
  -- which is what keeps SPRINT and FULL HOUSE right, since their value
  -- depends on an action's position in the sequence.
  with acts as (
    select i.user_id, i.action_type, i.created_at
    from public.interactions i
    where i.household_id = v_hh
      and i.created_at >= p_start
      and i.created_at <  p_end
      and coalesce(i.useful, true)
      and i.action_type in ('feed','play','sleep','wash','medicine')
      and i.user_id in (v_uid, coalesce(v_partner, v_uid))
  ),
  expanded as (
    select a.user_id, a.action_type, a.created_at, g.n
    from acts a
    cross join lateral generate_series(
      1,
      case when exists (
        select 1 from public.trophy_effects e
        where e.household_id = v_hh
          and e.kind = 'double_hour'
          and e.user_id = a.user_id
          and e.active_until is not null
          and a.created_at >= e.created_at
          and a.created_at <  e.active_until
      ) then 2 else 1 end
    ) as g(n)
  ),
  ranked as (
    select user_id, action_type,
      row_number() over (partition by user_id order by created_at, n) as idx,
      row_number() over (partition by user_id, action_type order by created_at, n) as type_idx
    from expanded
  ),
  scored as (
    select user_id, sum(
      case v_twist
        when 'bath_day'   then case when action_type = 'wash'     then 3 else 1 end
        when 'feast'      then case when action_type = 'feed'     then 3 else 1 end
        when 'playday'    then case when action_type = 'play'     then 3 else 1 end
        when 'nap_day'    then case when action_type = 'sleep'    then 3 else 1 end
        when 'nurse'      then case when action_type = 'medicine' then 5 else 1 end
        when 'double'     then 2
        when 'full_house' then case when type_idx = 1 then 4 else 1 end
        when 'sprint'     then case when idx <= 6    then 3 else 1 end
        else 1
      end
    )::int as pts
    from ranked
    group by user_id
  )
  select
    coalesce(max(pts) filter (where user_id = v_uid), 0),
    -- SOLO: Eren takes the empty seat. Against a literal 0 the margin
    -- would be the player's whole score, so every finished day would
    -- settle GOLD -- and this is the only trophy mint in the app.
    -- Mirrors erenOpponentScore() in src/lib/erenOpponent.ts.
    case when v_partner is null
         then public.eren_opponent_score(p_date)
         else coalesce(max(pts) filter (where user_id = v_partner), 0) end
  into v_me, v_them
  from scored;

  -- POINT STEAL: one point off the named target, floored at zero.
  v_me := greatest(0, v_me - (
    select count(*) from public.trophy_effects e
    where e.household_id = v_hh and e.kind = 'point_steal'
      and e.created_at >= p_start and e.created_at < p_end
      and e.payload->>'target' = v_uid::text));
  if v_partner is not null then
    v_them := greatest(0, v_them - (
      select count(*) from public.trophy_effects e
      where e.household_id = v_hh and e.kind = 'point_steal'
        and e.created_at >= p_start and e.created_at < p_end
        and e.payload->>'target' = v_partner::text));
  end if;

  v_outcome := case when v_me > v_them then 'win'
                    when v_them > v_me then 'loss'
                    else 'tie' end;

  -- ── Write the truth back ──
  -- The row is a cache for the history views, so it is corrected here
  -- whatever the client had put in it. `verdict_seen` and
  -- `comeback_claimed` are left alone — those are the client's to set.
  -- The flag tells the guard trigger below that this write is ours.
  perform set_config('eren.settling', 'on', true);

  insert into public.daily_battle_results
    (household_id, user_id, date, score, partner_score, outcome,
     comeback_claimed, twist_id)
  values (v_hh, v_uid, p_date, v_me, v_them, v_outcome, false, v_twist)
  on conflict (household_id, user_id, date) do update
    set score         = excluded.score,
        partner_score = excluded.partner_score,
        outcome       = excluded.outcome,
        twist_id      = excluded.twist_id;

  select trophy_claimed into v_claimed
  from public.daily_battle_results
  where household_id = v_hh and user_id = v_uid and date = p_date
  for update;

  if v_claimed then
    select trophies into v_balance from public.profiles where id = v_uid;
    return jsonb_build_object(
      'ok', false, 'reason', 'already_claimed',
      'score', v_me, 'partner_score', v_them, 'outcome', v_outcome,
      'trophies', 0, 'balance', coalesce(v_balance, 0));
  end if;

  -- ── The prize ──
  v_margin := v_me - v_them;

  -- Tier by margin — identical to trophyTier().
  v_tier := case
    when v_margin >= 6 then 'gold'
    when v_margin >= 3 then 'silver'
    when v_margin >= 1 then 'bronze'
    else null
  end;

  -- Base value — identical to TROPHY_VALUE.
  v_amount := case v_tier
    when 'gold'   then 3
    when 'silver' then 2
    when 'bronze' then 1
    else 0
  end;

  if v_tier is not null then
    -- Consecutive wins ending on this date. Walked one calendar day at
    -- a time because the rule is "no gap": a day with no row at all
    -- (nobody played) breaks the streak. 365 is a guard, not a rule.
    v_cursor := p_date;
    loop
      select outcome into v_prev
      from public.daily_battle_results
      where user_id = v_uid and date = v_cursor;
      exit when v_prev is null or v_prev <> 'win';
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
      exit when v_streak >= 365;
    end loop;

    -- Identical to streakBonus().
    if v_streak > 0 and v_streak % 3 = 0 then
      v_amount := v_amount + 2;
    end if;
  else
    -- Identical to consolationTrophies().
    if (v_them - v_me) between 1 and 2 and v_me >= 3 then
      v_amount := 1;
    end if;
  end if;

  -- CAS. Only the first caller for this (user, date) gets rowcount 1.
  update public.daily_battle_results
     set trophy_claimed   = true,
         trophy_tier      = v_tier,
         trophies_awarded = v_amount
   where household_id = v_hh
     and user_id = v_uid
     and date = p_date
     and trophy_claimed = false;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    select trophies into v_balance from public.profiles where id = v_uid;
    return jsonb_build_object(
      'ok', false, 'reason', 'already_claimed',
      'score', v_me, 'partner_score', v_them, 'outcome', v_outcome,
      'trophies', 0, 'balance', coalesce(v_balance, 0));
  end if;

  update public.profiles
     set trophies = trophies + v_amount
   where id = v_uid
  returning trophies into v_balance;

  return jsonb_build_object(
    'ok', true,
    'score', v_me, 'partner_score', v_them, 'outcome', v_outcome,
    'twist_id', v_twist,
    'tier', v_tier,
    'trophies', v_amount,
    'streak', v_streak,
    'balance', coalesce(v_balance, 0));
end;
$fn$;

grant execute on function public.settle_daily_battle(date, timestamptz, timestamptz) to authenticated;


-- Verify afterwards:
--   -- Eren's next fortnight, paired with the twist he meets:
--   select d::date,
--          public.eren_twist_for_date(d::date)  as twist,
--          public.eren_opponent_score(d::date)  as eren
--     from generate_series(current_date, current_date + 13, '1 day') d;
--
--   -- Confirm the settler picked him up:
--   select position('eren_opponent_score' in pg_get_functiondef(oid)) > 0 as patched
--     from pg_proc where proname = 'settle_daily_battle';
