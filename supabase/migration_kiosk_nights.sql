-- Run manually after migration_kiosk_reliability.sql and migration_kiosk_rollout_compat.sql.
-- Keeps old shifts, receipts, notes, wallets and unfinished saves. No historical backpay.
begin;
set local lock_timeout='5s';

create table if not exists eren_private.kiosk_clocks (
  household_id uuid primary key references public.households(id) on delete cascade,
  time_zone text not null
);
create table if not exists eren_private.kiosk_night_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  night_date date not null,
  time_zone text not null,
  starts_at timestamptz not null,
  resets_at timestamptz not null,
  payable boolean not null,
  energy int not null,
  started_at timestamptz not null,
  closed_at timestamptz
);
create index if not exists kiosk_night_sessions_user on eren_private.kiosk_night_sessions(user_id);
create index if not exists kiosk_night_sessions_home on eren_private.kiosk_night_sessions(household_id);

create table if not exists public.kiosk_night_shifts (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shift_date date not null,
  session_id uuid not null unique references eren_private.kiosk_night_sessions(id),
  served int not null check(served between 0 and 120),
  wrong int not null check(wrong between 0 and 240),
  walked int not null check(walked between 0 and 240),
  missed_calls int not null check(missed_calls between 0 and 120),
  best_streak int not null check(best_streak between 0 and served),
  base int not null check(base between 0 and 4200),
  tips int not null check(tips between 0 and 30000),
  grade text not null check(grade in ('S','A','B','C','D')),
  rained boolean not null,
  weather text not null check(weather in ('clear','rain','fog','wind')),
  in_dark int not null check(in_dark between 0 and served),
  early boolean not null,
  special_served int not null check(special_served between 0 and 1 and special_served<=served),
  paid_coins int not null check(paid_coins between 0 and 34240),
  note text check(length(note)<=90),
  closed_at timestamptz not null,
  primary key(household_id,user_id,shift_date)
);
create index if not exists kiosk_night_shifts_recent on public.kiosk_night_shifts(household_id,closed_at desc);
create index if not exists kiosk_night_shifts_user on public.kiosk_night_shifts(user_id);

-- Each contributor creates their own row. The shared goal stamps earned_at;
-- claimed_at means the wallet actually received it.
create table if not exists eren_private.kiosk_night_bonuses (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  night_date date not null,
  earned_at timestamptz,
  claimed_at timestamptz,
  primary key(household_id,user_id,night_date)
);
create index if not exists kiosk_night_bonuses_user on eren_private.kiosk_night_bonuses(user_id);
alter table eren_private.kiosk_clocks enable row level security;
alter table eren_private.kiosk_night_sessions enable row level security;
alter table eren_private.kiosk_night_bonuses enable row level security;
revoke all on eren_private.kiosk_clocks,eren_private.kiosk_night_sessions,eren_private.kiosk_night_bonuses from public,anon,authenticated;
alter table public.kiosk_night_shifts enable row level security;
revoke all on public.kiosk_night_shifts from public,anon,authenticated;
grant select on public.kiosk_night_shifts to authenticated;
drop policy if exists "household reads kiosk nights" on public.kiosk_night_shifts;
create policy "household reads kiosk nights" on public.kiosk_night_shifts for select to authenticated
  using(household_id=(select public.my_household_id()));

create or replace function eren_private.kiosk_server_time() returns timestamptz
language sql volatile set search_path='' as $$select clock_timestamp()$$;
create or replace function eren_private.kiosk_night_bounds(p_stamp timestamptz,p_zone text)
returns table(night_date date,starts_at timestamptz,resets_at timestamptz)
language sql stable set search_path='' as $$
  select d,(d+time '04:00') at time zone p_zone,((d+1)+time '04:00') at time zone p_zone
  from (select ((p_stamp at time zone p_zone)-interval '4 hours')::date d) x
$$;
create or replace function eren_private.kiosk_clock(p_home uuid) returns text
language plpgsql set search_path='' as $$
declare zone text;
begin
  select time_zone into zone from eren_private.kiosk_clocks where household_id=p_home;
  if found then return zone;end if;
  insert into eren_private.kiosk_clocks(household_id,time_zone)
    select h.id,case when exists(select 1 from pg_catalog.pg_timezone_names z where z.name=h.tz) then h.tz else 'UTC' end
    from public.households h where h.id=p_home on conflict do nothing;
  select time_zone into zone from eren_private.kiosk_clocks where household_id=p_home;
  return zone;
end;
$$;
create or replace function eren_private.kiosk_legacy_worked(p_home uuid,p_user uuid,p_start timestamptz,p_reset timestamptz)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.kiosk_shifts k where k.household_id=p_home and k.user_id=p_user
    and coalesce((select s.started_at from eren_private.kiosk_sessions s where s.household_id=k.household_id
      and s.user_id=k.user_id and s.shift_date=k.shift_date and s.closed_at=k.closed_at limit 1),k.closed_at)>=p_start
    and coalesce((select s.started_at from eren_private.kiosk_sessions s where s.household_id=k.household_id
      and s.user_id=k.user_id and s.shift_date=k.shift_date and s.closed_at=k.closed_at limit 1),k.closed_at)<p_reset)
$$;

create or replace function eren_private.kiosk_report_ok(t jsonb,r jsonb,w text,e boolean,special int)
returns boolean language plpgsql set search_path='' as $$
declare f text;item record;v jsonb;x jsonb;served int;learned int:=0;
begin
  if jsonb_typeof(t) is distinct from 'object' or jsonb_typeof(r) is distinct from 'object'
    or octet_length(r::text)>65536 or w is null or w not in ('clear','rain','fog','wind') or e is null or special is null then return false;end if;
  foreach f in array array['served','wrong','walked','missedCalls','bestStreak','base','tips','inDark'] loop
    if jsonb_typeof(t->f) is distinct from 'number' or coalesce(t->>f,'')!~'^\d{1,5}$' then return false;end if;
  end loop;
  served:=(t->>'served')::int;
  if served+(t->>'wrong')::int+(t->>'walked')::int not between 1 and 240 or served>120
    or (t->>'missedCalls')::int>120 or (t->>'bestStreak')::int>served or (t->>'inDark')::int>served
    or (t->>'base')::int>served*35 or (t->>'tips')::int>30000 or (e and (t->>'tips')::int<>0)
    or special not between 0 and 1 or special>served then return false;end if;
  for item in select * from jsonb_each(r) loop
    v:=item.value;
    if item.key!~'^[a-zA-Z0-9_-]{1,80}$' or jsonb_typeof(v) is distinct from 'object'
      or jsonb_typeof(v->'times') is distinct from 'number' or coalesce(v->>'times','')!~'^\d{1,3}$'
      or jsonb_typeof(v->'wraps') is distinct from 'array' or jsonb_typeof(v->'sides') is distinct from 'array' then return false;end if;
    if (v->>'times')::int not between 1 and served or jsonb_array_length(v->'wraps') not between 1 and 2
      or jsonb_array_length(v->'sides')>2 then return false;end if;
    for x in select * from jsonb_array_elements(v->'wraps') loop
      if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'toppings') is distinct from 'array' then return false;end if;
      if jsonb_array_length(x->'toppings')>8
        or exists(select 1 from jsonb_array_elements(x->'toppings') a where a not in ('"tomato"','"onion"','"cheese"','"lettuce"'))
        or (x->>'sauce' is not null and x->>'sauce' not in ('garlic','chilli','herb','mango','smoke'))
        or (x->>'without' is not null and x->>'without' not in ('tomato','onion','cheese','lettuce')) then return false;end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(v->'sides') a where a not in ('"cola"','"chips"')) then return false;end if;
    learned:=learned+(v->>'times')::int;
  end loop;
  return learned+special=served;
end;
$$;

create or replace function public.start_kiosk_night_atomic(p_request_id uuid,p_expected_user uuid,p_household_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  receipt eren_private.economy_receipts%rowtype;input jsonb:=jsonb_build_object('household_id',p_household_id);
  result jsonb;stamp timestamptz;zone text;n record;hours numeric;energy_value int;can_pay boolean;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'kiosk_night_start' or receipt.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    return receipt.result;
  end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  zone:=eren_private.kiosk_clock(p_household_id);stamp:=eren_private.kiosk_server_time();
  select * into n from eren_private.kiosk_night_bounds(stamp,zone);
  hours:=least(12,greatest(0,coalesce(extract(epoch from(stamp-s.last_decay_at))/3600,0)));
  energy_value:=round(greatest(0,least(100,s.energy-8*hours)));
  can_pay:=energy_value>=30 and not exists(select 1 from public.kiosk_night_shifts
    where household_id=p_household_id and user_id=uid and shift_date=n.night_date)
    and not eren_private.kiosk_legacy_worked(p_household_id,uid,n.starts_at,n.resets_at);
  insert into eren_private.kiosk_night_sessions(id,user_id,household_id,night_date,time_zone,starts_at,resets_at,payable,energy,started_at)
    values(p_request_id,uid,p_household_id,n.night_date,zone,n.starts_at,n.resets_at,can_pay,energy_value,stamp);
  result:=jsonb_build_object('ok',true,'version',2,'session_id',p_request_id,'user_id',uid,'household_id',p_household_id,
    'shift_date',n.night_date,'time_zone',zone,'resets_at',n.resets_at,'paid',can_pay,'blocked',energy_value<30,'energy',energy_value,'started_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values(uid,p_request_id,'kiosk_night_start',input,result);
  return result;
end;
$$;

create or replace function public.close_kiosk_night_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_session_id uuid,
  p_takings jsonb,p_weather text,p_early boolean,p_regulars jsonb,p_special_served int
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  session eren_private.kiosk_night_sessions%rowtype;receipt eren_private.economy_receipts%rowtype;
  input jsonb;result jsonb;stamp timestamptz;item record;v jsonb;old jsonb;merged jsonb;
  served int;wrong int;walked int;missed int;streak int;base int;tips int;dark int;attempts int;
  score numeric;grade_value text;amount int;total int;before_wraps int;bonus int:=0;can_pay boolean;goal boolean;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_session_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  input:=jsonb_build_object('household_id',p_household_id,'session_id',p_session_id,'takings',p_takings,
    'weather',p_weather,'early',p_early,'regulars',p_regulars,'special_served',p_special_served);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'kiosk_night_close' or receipt.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    return receipt.result||jsonb_build_object('coins',p.coins);
  end if;
  select * into session from eren_private.kiosk_night_sessions where id=p_session_id and user_id=uid and household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_session');end if;
  if session.closed_at is not null then return jsonb_build_object('ok',false,'reason','already_closed');end if;
  if not eren_private.kiosk_report_ok(p_takings,p_regulars,p_weather,p_early,p_special_served) then
    return jsonb_build_object('ok',false,'reason','bad_result');end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  served:=(p_takings->>'served')::int;wrong:=(p_takings->>'wrong')::int;walked:=(p_takings->>'walked')::int;
  missed:=(p_takings->>'missedCalls')::int;streak:=(p_takings->>'bestStreak')::int;
  base:=(p_takings->>'base')::int;tips:=(p_takings->>'tips')::int;dark:=(p_takings->>'inDark')::int;attempts:=served+wrong+walked;
  merged:=coalesce(s.kiosk_regulars,'{}'::jsonb);before_wraps:=s.kiosk_wraps;
  for item in select * from jsonb_each(p_regulars) loop
    v:=item.value;old:=merged->item.key;
    merged:=jsonb_set(merged,array[item.key],jsonb_build_object('wraps',v->'wraps','sides',v->'sides',
      'times',coalesce((old->>'times')::int,0)+(v->>'times')::int));
  end loop;
  stamp:=eren_private.kiosk_server_time();
  can_pay:=session.payable and not exists(select 1 from public.kiosk_night_shifts
    where household_id=p_household_id and user_id=uid and shift_date=session.night_date)
    and not eren_private.kiosk_legacy_worked(p_household_id,uid,session.starts_at,session.resets_at);
  select coalesce(sum(k.served),0) into total from public.kiosk_night_shifts k where household_id=p_household_id and shift_date=session.night_date;
  if can_pay then total:=total+served;end if;goal:=total>=22;
  score:=served::numeric/attempts*0.68+least(1,served::numeric/9)*0.32;
  grade_value:=case when score>=0.94 and wrong=0 and walked=0 then 'S' when score>=0.82 then 'A'
    when score>=0.64 then 'B' when score>=0.42 then 'C' else 'D' end;
  amount:=case when can_pay then base+tips else 0 end;
  if can_pay then
    insert into public.kiosk_night_shifts(household_id,user_id,shift_date,session_id,served,wrong,walked,missed_calls,best_streak,
      base,tips,grade,rained,weather,in_dark,early,special_served,paid_coins,closed_at)
      values(p_household_id,uid,session.night_date,session.id,served,wrong,walked,missed,streak,base,tips,grade_value,
        p_weather='rain',p_weather,dark,p_early,p_special_served,amount,stamp);
    -- Only insert our own FK-backed record: inserting for the partner could
    -- wait on their profile lock while their shift waits on our stats lock.
    if served>0 then
      insert into eren_private.kiosk_night_bonuses(household_id,user_id,night_date)
        values(p_household_id,uid,session.night_date) on conflict do nothing;
    end if;
    if goal then
      update eren_private.kiosk_night_bonuses set earned_at=stamp where household_id=p_household_id
        and night_date=session.night_date and earned_at is null;
      update eren_private.kiosk_night_bonuses set claimed_at=stamp where household_id=p_household_id and user_id=uid
        and night_date=session.night_date and earned_at is not null and claimed_at is null returning 40 into bonus;
      bonus:=coalesce(bonus,0);amount:=amount+bonus;
      update public.kiosk_night_shifts set paid_coins=amount where session_id=session.id;
    end if;
  end if;
  update public.eren_stats set kiosk_wraps=kiosk_wraps+served,kiosk_regulars=merged where household_id=p_household_id;
  if amount>0 then update public.profiles set coins=coins+amount where id=uid returning * into p;end if;
  update eren_private.kiosk_night_sessions set closed_at=stamp where id=session.id;
  result:=jsonb_build_object('ok',true,'version',2,'request_id',p_request_id,'session_id',session.id,'user_id',uid,'household_id',p_household_id,
    'shift_date',session.night_date,'awarded',amount,'night_bonus',bonus,'coins',p.coins,'paid',can_pay,'blocked',session.energy<30,'grade',grade_value,
    'night_total',total,'goal_met',goal,'wraps_before',before_wraps,'wraps_after',s.kiosk_wraps+served,'saved_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values(uid,p_request_id,'kiosk_night_close',input,result);
  return result;
end;
$$;

create or replace function public.claim_kiosk_night_bonus_atomic(p_request_id uuid,p_expected_user uuid,p_household_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;receipt eren_private.economy_receipts%rowtype;
  input jsonb:=jsonb_build_object('household_id',p_household_id);result jsonb;stamp timestamptz;dates jsonb;amount int;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'kiosk_night_bonus' or receipt.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    return receipt.result||jsonb_build_object('coins',p.coins);
  end if;
  stamp:=eren_private.kiosk_server_time();
  with taken as (update eren_private.kiosk_night_bonuses set claimed_at=stamp
    where household_id=p_household_id and user_id=uid and earned_at is not null and claimed_at is null returning night_date)
    select coalesce(jsonb_agg(night_date order by night_date),'[]'::jsonb),count(*)::int*40 into dates,amount from taken;
  if amount>0 then update public.profiles set coins=coins+amount where id=uid returning * into p;end if;
  result:=jsonb_build_object('ok',true,'version',2,'request_id',p_request_id,'user_id',uid,'household_id',p_household_id,
    'awarded',amount,'coins',p.coins,'nights',dates,'saved_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result) values(uid,p_request_id,'kiosk_night_bonus',input,result);
  return result;
end;
$$;

create or replace function public.get_kiosk_night_status(p_expected_user uuid,p_household_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();zone text;stamp timestamptz;n record;worked boolean;total int;due int;rows jsonb;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if not exists(select 1 from public.profiles where id=uid and household_id=p_household_id) then
    return jsonb_build_object('ok',false,'reason','household_changed');end if;
  zone:=eren_private.kiosk_clock(p_household_id);stamp:=eren_private.kiosk_server_time();
  select * into n from eren_private.kiosk_night_bounds(stamp,zone);
  worked:=exists(select 1 from public.kiosk_night_shifts where household_id=p_household_id and user_id=uid and shift_date=n.night_date)
    or eren_private.kiosk_legacy_worked(p_household_id,uid,n.starts_at,n.resets_at);
  select coalesce(sum(served),0) into total from public.kiosk_night_shifts where household_id=p_household_id and shift_date=n.night_date;
  select count(*)::int*40 into due from eren_private.kiosk_night_bonuses where household_id=p_household_id and user_id=uid and earned_at is not null and claimed_at is null;
  select coalesce(jsonb_agg(row order by closed_at desc),'[]'::jsonb) into rows from (
    select row,closed_at from (
      select to_jsonb(k)||jsonb_build_object('version',2) row,k.closed_at from public.kiosk_night_shifts k where household_id=p_household_id
      union all
      select to_jsonb(k)||jsonb_build_object('version',1) row,k.closed_at from public.kiosk_shifts k where household_id=p_household_id
    ) history order by closed_at desc limit 24
  ) recent;
  return jsonb_build_object('ok',true,'version',2,'user_id',uid,'household_id',p_household_id,'server_time',stamp,'time_zone',zone,
    'night_date',n.night_date,'starts_at',n.starts_at,'resets_at',n.resets_at,'worked',worked,'night_total',total,'bonus_due',due,'rows',rows);
end;
$$;

create or replace function public.pin_kiosk_night_note(p_expected_user uuid,p_household_id uuid,p_session_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if not exists(select 1 from public.profiles where id=uid and household_id=p_household_id) then
    return jsonb_build_object('ok',false,'reason','household_changed');end if;
  if p_note is null or length(p_note)>90 then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  update public.kiosk_night_shifts set note=btrim(p_note) where session_id=p_session_id and user_id=uid and household_id=p_household_id;
  return jsonb_build_object('ok',found);
end;
$$;

-- Preserve the original closer and its receipts; prevent an old open tab paying
-- again after a new-clock shift has won the same physical night.
do $$begin
  if to_regprocedure('eren_private.close_kiosk_shift_v1(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb)') is null then
    alter function public.close_kiosk_shift_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb) set schema eren_private;
    alter function eren_private.close_kiosk_shift_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb) rename to close_kiosk_shift_v1;
  end if;
end$$;
create or replace function public.close_kiosk_shift_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_session_id uuid,p_takings jsonb,p_weather text,p_early boolean,p_regulars jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();s eren_private.kiosk_sessions%rowtype;zone text;n record;changed boolean:=false;result jsonb;
begin
  if uid=p_expected_user and p_request_id is not null and p_session_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
    perform 1 from public.profiles where id=uid for update;
    if not exists(select 1 from public.profiles where id=uid and household_id=p_household_id) then
      return eren_private.close_kiosk_shift_v1(p_request_id,p_expected_user,p_household_id,p_session_id,p_takings,p_weather,p_early,p_regulars);
    end if;
    select * into s from eren_private.kiosk_sessions where id=p_session_id and user_id=uid and household_id=p_household_id for update;
    if found and s.payable and s.closed_at is null and not exists(select 1 from eren_private.economy_receipts where user_id=uid and request_id=p_request_id) then
      -- Use the same stats-row lock as the new closer, without locking a partner's wallet.
      perform 1 from public.eren_stats where household_id=p_household_id for update;
      zone:=eren_private.kiosk_clock(p_household_id);
      select * into n from eren_private.kiosk_night_bounds(s.started_at,zone);
      if exists(select 1 from public.kiosk_night_shifts where household_id=p_household_id and user_id=uid and shift_date=n.night_date) then
        update eren_private.kiosk_sessions set payable=false where id=s.id;changed:=true;
      end if;
    end if;
  end if;
  result:=eren_private.close_kiosk_shift_v1(p_request_id,p_expected_user,p_household_id,p_session_id,p_takings,p_weather,p_early,p_regulars);
  if changed and not coalesce((result->>'ok')::boolean,false) then update eren_private.kiosk_sessions set payable=true where id=s.id;end if;
  return result;
end;
$$;

revoke all on function eren_private.kiosk_server_time(),eren_private.kiosk_night_bounds(timestamptz,text),
  eren_private.kiosk_clock(uuid),eren_private.kiosk_legacy_worked(uuid,uuid,timestamptz,timestamptz),
  eren_private.kiosk_report_ok(jsonb,jsonb,text,boolean,int),eren_private.close_kiosk_shift_v1(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb)
  from public,anon,authenticated;
revoke all on function public.start_kiosk_night_atomic(uuid,uuid,uuid),
  public.close_kiosk_night_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb,int),
  public.claim_kiosk_night_bonus_atomic(uuid,uuid,uuid),public.get_kiosk_night_status(uuid,uuid),
  public.pin_kiosk_night_note(uuid,uuid,uuid,text),public.close_kiosk_shift_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb) from public,anon;
grant execute on function public.start_kiosk_night_atomic(uuid,uuid,uuid),
  public.close_kiosk_night_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb,int),
  public.claim_kiosk_night_bonus_atomic(uuid,uuid,uuid),public.get_kiosk_night_status(uuid,uuid),
  public.pin_kiosk_night_note(uuid,uuid,uuid,text),public.close_kiosk_shift_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
