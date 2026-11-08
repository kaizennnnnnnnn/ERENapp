-- Run manually after the existing economy, sleeping and interaction migrations.
-- Bathroom only. No resets, backpay, new cooldowns, or changes to other care actions.
begin;
set local lock_timeout='5s';

create or replace function public.complete_wash_session_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  receipt eren_private.economy_receipts%rowtype;input jsonb:=jsonb_build_object('household_id',p_household_id,'action','wash');
  result jsonb;stamp timestamptz;hours numeric;before_clean numeric;interaction_id uuid;useful boolean;
  -- Matches ACTION_CONFIGS.wash; the SQL checker rejects catalogue drift.
  cfg constant jsonb:=$wash_session_config${"cleanliness":60,"happiness":5}$wash_session_config$::jsonb;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found and (receipt.operation<>'wash_session' or receipt.input<>input) then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
  -- Same profile -> household lock order as food, Jelly and kiosk transactions.
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  if receipt.request_id is not null then
    result:=receipt.result;
  else
    -- A confirmed historical session can replay while asleep; a new one cannot.
    if s.is_sleeping then return jsonb_build_object('ok',false,'reason','sleeping');end if;
    stamp:=clock_timestamp();
    hours:=least(12,greatest(0,coalesce(extract(epoch from(stamp-s.last_decay_at))/3600,0)));
    before_clean:=greatest(0,coalesce(s.cleanliness,100)-4*hours);useful:=before_clean<90;
    s.happiness:=round(least(100,greatest(0,greatest(0,s.happiness-7*hours)+coalesce((cfg->>'happiness')::numeric,0))));
    s.hunger:=round(least(100,greatest(0,greatest(0,s.hunger-10*hours)+coalesce((cfg->>'hunger')::numeric,0))));
    s.energy:=round(least(100,greatest(0,greatest(0,s.energy-8*hours)+coalesce((cfg->>'energy')::numeric,0))));
    s.sleep_quality:=round(least(100,greatest(0,greatest(0,s.sleep_quality-7*hours)+coalesce((cfg->>'sleep_quality')::numeric,0))));
    s.cleanliness:=least(100,greatest(0,before_clean+coalesce((cfg->>'cleanliness')::numeric,0)));
    s.weight:=round(greatest(2,least(10,s.weight+coalesce((cfg->>'weight')::numeric,0))),2);
    s.is_sick:=((s.cleanliness<5)::int+(s.sleep_quality<5)::int+(s.weight>8)::int)>=2;
    s.mood:=case when s.hunger<30 then 'hungry' when s.sleep_quality<30 then 'sleepy' when s.cleanliness<25 or s.happiness<30 then 'angry'
      when s.energy>70 and s.happiness>70 then 'playful' when s.happiness>80 then 'happy' else 'idle' end;
    update public.eren_stats set happiness=s.happiness,hunger=s.hunger,energy=s.energy,sleep_quality=s.sleep_quality,
      cleanliness=s.cleanliness,weight=s.weight,is_sick=s.is_sick,mood=s.mood,last_decay_at=stamp,updated_at=stamp
      where household_id=p_household_id returning * into s;
    insert into public.interactions(household_id,user_id,action_type,happiness_delta,hunger_delta,energy_delta,sleep_delta,weight_delta,useful,created_at)
      values(p_household_id,uid,'wash',coalesce((cfg->>'happiness')::int,0),coalesce((cfg->>'hunger')::int,0),coalesce((cfg->>'energy')::int,0),
        coalesce((cfg->>'sleep_quality')::int,0),coalesce((cfg->>'weight')::numeric,0),useful,stamp) returning id into interaction_id;
    result:=jsonb_build_object('ok',true,'version',1,'request_id',p_request_id,'user_id',uid,'household_id',p_household_id,
      'action','wash','interaction_id',interaction_id,'useful',useful,'saved_at',stamp);
    insert into eren_private.economy_receipts(user_id,request_id,operation,input,result,created_at) values(uid,p_request_id,'wash_session',input,result,stamp);
  end if;
  -- Replay the original session, but never rewind the UI to its old stat snapshot.
  return result||jsonb_build_object('stats',jsonb_build_object('household_id',s.household_id,'hunger',s.hunger,'happiness',s.happiness,
    'energy',s.energy,'sleep_quality',s.sleep_quality,'cleanliness',s.cleanliness,'weight',s.weight,'mood',s.mood,'is_sick',s.is_sick,
    'is_sleeping',s.is_sleeping,'last_decay_at',s.last_decay_at,'updated_at',s.updated_at));
end;
$$;
revoke all on function public.complete_wash_session_atomic(uuid,uuid,uuid) from public,anon;
grant execute on function public.complete_wash_session_atomic(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
