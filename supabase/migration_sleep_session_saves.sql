-- Run manually after economy, sleeping and useful-interaction migrations.
-- Additive bedroom save API. No resets, backpay or new cooldowns.
begin;
set local lock_timeout='5s';
create or replace function public.complete_sleep_session_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_action text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  receipt eren_private.economy_receipts%rowtype;
  input jsonb:=jsonb_build_object('household_id',p_household_id,'action',p_action);
  result jsonb;stamp timestamptz;hours numeric;changed boolean;useful boolean:=false;interaction_id uuid;
  cfg constant jsonb:=$sleep_session_config${"sleep_quality":30,"energy":25,"hunger":-5}$sleep_session_config$::jsonb;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  if p_action is null or p_action not in ('tuck','wake') then return jsonb_build_object('ok',false,'reason','bad_action');end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found and (receipt.operation<>'sleep_session' or receipt.input<>input) then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  if receipt.request_id is not null then
    result:=receipt.result;
  else
    stamp:=clock_timestamp();changed:=coalesce(s.is_sleeping,false) is distinct from (p_action='tuck');
    if changed and p_action='tuck' then
      hours:=least(12,greatest(0,coalesce(extract(epoch from(stamp-s.last_decay_at))/3600,0)));
      useful:=greatest(0,s.energy-8*hours)<90;
      s.happiness:=round(least(100,greatest(0,greatest(0,s.happiness-7*hours)+coalesce((cfg->>'happiness')::numeric,0))));
      s.hunger:=round(least(100,greatest(0,greatest(0,s.hunger-10*hours)+coalesce((cfg->>'hunger')::numeric,0))));
      s.energy:=round(least(100,greatest(0,greatest(0,s.energy-8*hours)+coalesce((cfg->>'energy')::numeric,0))));
      s.sleep_quality:=round(least(100,greatest(0,greatest(0,s.sleep_quality-7*hours)+coalesce((cfg->>'sleep_quality')::numeric,0))));
      s.cleanliness:=least(100,greatest(0,greatest(0,coalesce(s.cleanliness,100)-4*hours)+coalesce((cfg->>'cleanliness')::numeric,0)));
      s.weight:=round(greatest(2,least(10,s.weight+coalesce((cfg->>'weight')::numeric,0))),2);
      s.is_sick:=((s.cleanliness<5)::int+(s.sleep_quality<5)::int+(s.weight>8)::int)>=2;
      s.mood:=case when s.hunger<30 then 'hungry' when s.sleep_quality<30 then 'sleepy' when s.cleanliness<25 or s.happiness<30 then 'angry'
        when s.energy>70 and s.happiness>70 then 'playful' when s.happiness>80 then 'happy' else 'idle' end;
      update public.eren_stats set happiness=s.happiness,hunger=s.hunger,energy=s.energy,sleep_quality=s.sleep_quality,
        cleanliness=s.cleanliness,weight=s.weight,is_sick=s.is_sick,mood=s.mood,is_sleeping=true,last_decay_at=stamp,updated_at=stamp
        where household_id=p_household_id returning * into s;
      insert into public.interactions(household_id,user_id,action_type,happiness_delta,hunger_delta,energy_delta,sleep_delta,weight_delta,useful,created_at)
        values(p_household_id,uid,'sleep',coalesce((cfg->>'happiness')::int,0),coalesce((cfg->>'hunger')::int,0),coalesce((cfg->>'energy')::int,0),
          coalesce((cfg->>'sleep_quality')::int,0),coalesce((cfg->>'weight')::numeric,0),useful,stamp) returning id into interaction_id;
    elsif changed then
      -- Waking preserves every care value and the decay clock, as before.
      update public.eren_stats set is_sleeping=false,updated_at=stamp where household_id=p_household_id returning * into s;
    end if;
    -- Record no-ops too: retrying "already asleep" after a later wake must not tuck again.
    result:=jsonb_build_object('ok',true,'version',1,'request_id',p_request_id,'user_id',uid,'household_id',p_household_id,
      'action',p_action,'changed',changed,'interaction_id',interaction_id,'useful',useful,'saved_at',stamp);
    insert into eren_private.economy_receipts(user_id,request_id,operation,input,result,created_at) values(uid,p_request_id,'sleep_session',input,result,stamp);
  end if;
  return result||jsonb_build_object('stats',jsonb_build_object('household_id',s.household_id,'hunger',s.hunger,'happiness',s.happiness,
    'energy',s.energy,'sleep_quality',s.sleep_quality,'cleanliness',s.cleanliness,'weight',s.weight,'mood',s.mood,'is_sick',s.is_sick,
    'is_sleeping',s.is_sleeping,'last_decay_at',s.last_decay_at,'updated_at',s.updated_at));
end;
$$;
revoke all on function public.complete_sleep_session_atomic(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.complete_sleep_session_atomic(uuid,uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
