-- Run manually after migration_kiosk_shifts.sql and migration_economy_reliability.sql.
-- Preserves existing shifts, wallets and regulars. No historical backpay.
begin;
alter table public.kiosk_shifts add column if not exists weather text not null default 'clear';
alter table public.kiosk_shifts add column if not exists in_dark int not null default 0;
alter table public.kiosk_shifts add column if not exists early boolean not null default false;
alter table public.kiosk_shifts add column if not exists paid_coins int;
create index if not exists idx_kiosk_shifts_user on public.kiosk_shifts(user_id);

create table if not exists eren_private.kiosk_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  shift_date text not null,
  time_zone text not null,
  payable boolean not null,
  energy int not null,
  started_at timestamptz not null,
  closed_at timestamptz
);
create index if not exists kiosk_sessions_user on eren_private.kiosk_sessions(user_id);
create index if not exists kiosk_sessions_household on eren_private.kiosk_sessions(household_id);
alter table eren_private.kiosk_sessions enable row level security;
revoke all on eren_private.kiosk_sessions from public,anon,authenticated;

create or replace function public.start_kiosk_shift_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_time_zone text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  receipt eren_private.economy_receipts%rowtype;input jsonb;result jsonb;
  stamp timestamptz;day text;energy_value int;can_pay boolean;hours numeric;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  input:=jsonb_build_object('household_id',p_household_id,'time_zone',p_time_zone);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'kiosk_start' or receipt.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
    return receipt.result;
  end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  if p_time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then
    return jsonb_build_object('ok',false,'reason','bad_time_zone');
  end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  stamp:=clock_timestamp();day:=to_char(stamp at time zone p_time_zone,'YYYY-MM-DD');
  hours:=least(12,greatest(0,coalesce(extract(epoch from(stamp-s.last_decay_at))/3600,0)));
  energy_value:=round(greatest(0,least(100,s.energy-8*hours)));
  can_pay:=energy_value>=30 and not exists(select 1 from public.kiosk_shifts
    where household_id=p_household_id and user_id=uid and shift_date=day);
  insert into eren_private.kiosk_sessions(id,user_id,household_id,shift_date,time_zone,payable,energy,started_at)
    values(p_request_id,uid,p_household_id,day,p_time_zone,can_pay,energy_value,stamp);
  result:=jsonb_build_object('ok',true,'session_id',p_request_id,'user_id',uid,'household_id',p_household_id,
    'shift_date',day,'paid',can_pay,'blocked',energy_value<30,'energy',energy_value,'started_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result)
    values(uid,p_request_id,'kiosk_start',input,result);
  return result;
end;
$$;
revoke all on function public.start_kiosk_shift_atomic(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.start_kiosk_shift_atomic(uuid,uuid,uuid,text) to authenticated;

create or replace function public.close_kiosk_shift_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_session_id uuid,
  p_takings jsonb,p_weather text,p_early boolean,p_regulars jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  session eren_private.kiosk_sessions%rowtype;receipt eren_private.economy_receipts%rowtype;
  input jsonb;result jsonb;stamp timestamptz;item record;v jsonb;w jsonb;old jsonb;merged jsonb;
  served int;wrong int;walked int;missed int;streak int;base int;tips int;dark int;
  attempts int;score numeric;grade_value text;amount int;total int;before_wraps int;learned int:=0;
  can_pay boolean;goal boolean;field text;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_session_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  input:=jsonb_build_object('household_id',p_household_id,'session_id',p_session_id,'takings',p_takings,
    'weather',p_weather,'early',p_early,'regulars',p_regulars);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'kiosk_close' or receipt.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    return receipt.result||jsonb_build_object('coins',p.coins);
  end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into session from eren_private.kiosk_sessions where id=p_session_id and user_id=uid and household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_session');end if;
  if session.closed_at is not null then return jsonb_build_object('ok',false,'reason','already_closed');end if;
  if jsonb_typeof(p_takings) is distinct from 'object' or jsonb_typeof(p_regulars) is distinct from 'object'
    or octet_length(p_regulars::text)>65536 or p_weather is null or p_weather not in ('clear','rain','fog','wind') or p_early is null then
    return jsonb_build_object('ok',false,'reason','bad_result');
  end if;
  foreach field in array array['served','wrong','walked','missedCalls','bestStreak','base','tips','inDark'] loop
    if jsonb_typeof(p_takings->field) is distinct from 'number' or coalesce(p_takings->>field,'')!~'^\d{1,5}$' then
      return jsonb_build_object('ok',false,'reason','bad_result');
    end if;
  end loop;
  served:=(p_takings->>'served')::int;wrong:=(p_takings->>'wrong')::int;walked:=(p_takings->>'walked')::int;
  missed:=(p_takings->>'missedCalls')::int;streak:=(p_takings->>'bestStreak')::int;
  base:=(p_takings->>'base')::int;tips:=(p_takings->>'tips')::int;dark:=(p_takings->>'inDark')::int;
  attempts:=served+wrong+walked;
  if attempts not between 1 and 240 or served>120 or missed>120 or streak>served or dark>served
    or base>served*35 or tips>30000 or (p_early and tips<>0) then
    return jsonb_build_object('ok',false,'reason','bad_result');
  end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  merged:=coalesce(s.kiosk_regulars,'{}'::jsonb);before_wraps:=s.kiosk_wraps;
  -- Each entry contains only THIS shift's visits, not a stale household snapshot.
  for item in select * from jsonb_each(p_regulars) loop
    v:=item.value;
    if item.key!~'^[a-zA-Z0-9_-]{1,80}$' or jsonb_typeof(v) is distinct from 'object'
      or jsonb_typeof(v->'times') is distinct from 'number' or coalesce(v->>'times','')!~'^\d{1,3}$'
      or jsonb_typeof(v->'wraps') is distinct from 'array' or jsonb_typeof(v->'sides') is distinct from 'array' then
      return jsonb_build_object('ok',false,'reason','bad_result');
    end if;
    if (v->>'times')::int not between 1 and served or jsonb_array_length(v->'wraps') not between 1 and 2 or jsonb_array_length(v->'sides')>2 then
      return jsonb_build_object('ok',false,'reason','bad_result');
    end if;
    for w in select * from jsonb_array_elements(v->'wraps') loop
      if jsonb_typeof(w) is distinct from 'object' or jsonb_typeof(w->'toppings') is distinct from 'array' then
        return jsonb_build_object('ok',false,'reason','bad_result');
      end if;
      if jsonb_array_length(w->'toppings')>8 or exists(select 1 from jsonb_array_elements(w->'toppings') t where t not in ('"tomato"','"onion"','"cheese"','"lettuce"'))
        or (w->>'sauce' is not null and w->>'sauce' not in ('garlic','chilli','herb','mango','smoke'))
        or (w->>'without' is not null and w->>'without' not in ('tomato','onion','cheese','lettuce')) then
        return jsonb_build_object('ok',false,'reason','bad_result');
      end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(v->'sides') x where x not in ('"cola"','"chips"')) then
      return jsonb_build_object('ok',false,'reason','bad_result');
    end if;
    learned:=learned+(v->>'times')::int;old:=merged->item.key;
    merged:=jsonb_set(merged,array[item.key],jsonb_build_object('wraps',v->'wraps','sides',v->'sides',
      'times',coalesce((old->>'times')::int,0)+(v->>'times')::int));
  end loop;
  if learned<>served then return jsonb_build_object('ok',false,'reason','bad_result');end if;
  stamp:=clock_timestamp();
  can_pay:=session.payable and not exists(select 1 from public.kiosk_shifts
    where household_id=p_household_id and user_id=uid and shift_date=session.shift_date);
  select coalesce(sum(k.served),0) into total from public.kiosk_shifts k where household_id=p_household_id and shift_date=session.shift_date;
  if can_pay then total:=total+served;end if;
  goal:=total>=22;
  score:=served::numeric/attempts*0.68+least(1,served::numeric/9)*0.32;
  grade_value:=case when score>=0.94 and wrong=0 and walked=0 then 'S' when score>=0.82 then 'A'
    when score>=0.64 then 'B' when score>=0.42 then 'C' else 'D' end;
  amount:=case when can_pay then base+tips+case when goal then 40 else 0 end else 0 end;
  if can_pay then
    insert into public.kiosk_shifts(household_id,user_id,shift_date,served,wrong,walked,missed_calls,best_streak,base,tips,grade,rained,weather,in_dark,early,paid_coins,closed_at)
      values(p_household_id,uid,session.shift_date,served,wrong,walked,missed,streak,base,tips,grade_value,p_weather='rain',p_weather,dark,p_early,amount,stamp);
  end if;
  update public.eren_stats set kiosk_wraps=kiosk_wraps+served,kiosk_regulars=merged where household_id=p_household_id;
  if amount>0 then update public.profiles set coins=coins+amount where id=uid returning * into p;end if;
  update eren_private.kiosk_sessions set closed_at=stamp where id=p_session_id;
  result:=jsonb_build_object('ok',true,'request_id',p_request_id,'session_id',p_session_id,'user_id',uid,'household_id',p_household_id,
    'shift_date',session.shift_date,'awarded',amount,'coins',p.coins,'paid',can_pay,'blocked',session.energy<30,'grade',grade_value,
    'night_total',total,'goal_met',goal,'wraps_before',before_wraps,'wraps_after',s.kiosk_wraps+served,'saved_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result)
    values(uid,p_request_id,'kiosk_close',input,result);
  return result;
end;
$$;
revoke all on function public.close_kiosk_shift_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb) from public,anon;
grant execute on function public.close_kiosk_shift_atomic(uuid,uuid,uuid,uuid,jsonb,text,boolean,jsonb) to authenticated;

-- Keep legacy inserts during rollout: old clients pay before writing their row.
-- Removing INSERT before those clients are replaced would leave their day unrecorded.
revoke update,delete,truncate,references,trigger on public.kiosk_shifts from public,anon,authenticated;
revoke insert on public.kiosk_shifts from public,anon;
grant select on public.kiosk_shifts to authenticated;
grant insert on public.kiosk_shifts to authenticated;
grant update(note) on public.kiosk_shifts to authenticated;
drop policy if exists "users insert own kiosk shifts" on public.kiosk_shifts;
create policy "users insert own kiosk shifts" on public.kiosk_shifts for insert to authenticated
  with check (household_id=(select public.my_household_id()) and user_id=(select auth.uid()));
drop policy if exists "users update own kiosk shifts" on public.kiosk_shifts;
create policy "users update own kiosk shifts" on public.kiosk_shifts for update to authenticated
  using (household_id=(select public.my_household_id()) and user_id=(select auth.uid()))
  with check (household_id=(select public.my_household_id()) and user_id=(select auth.uid()));
commit;
