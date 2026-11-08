-- Run manually after migration_economy_reliability.sql and migration_jelly_progress.sql.
-- Preserves all progress, flavours, inventory and wallets. No historical backpay.
begin;
set local lock_timeout='5s';

-- Keep the old client contract, but take the profile lock before progress/skin
-- so mixed old/new tabs cannot invert the new transaction's lock order.
do $$begin
  if to_regprocedure('eren_private.feed_super_jelly_v1()') is null then
    alter function public.feed_super_jelly() set schema eren_private;
    alter function eren_private.feed_super_jelly() rename to feed_super_jelly_v1;
  end if;
end$$;
alter function eren_private.feed_super_jelly_v1() set search_path='';
create or replace function public.feed_super_jelly() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    perform 1 from public.profiles where id=auth.uid() for update;
  end if;
  return eren_private.feed_super_jelly_v1();
end;
$$;

create or replace function public.feed_super_jelly_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;b public.eren_stats%rowtype;
  j public.jelly_progress%rowtype;r eren_private.economy_receipts%rowtype;
  input jsonb:=jsonb_build_object('household_id',p_household_id);result jsonb;fed jsonb;
  stamp timestamptz;hours numeric;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into r from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if r.operation<>'feed_super_jelly' or r.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    select * into j from public.jelly_progress where user_id=uid;
    return r.result||jsonb_build_object('coins',p.coins,'current_supers',j.supers,'current_fed',j.fed);
  end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  select * into j from public.jelly_progress where user_id=uid for update;
  if not found or j.supers<1 then return jsonb_build_object('ok',false,'reason','none');end if;

  fed:=eren_private.feed_super_jelly_v1();
  if not coalesce((fed->>'ok')::boolean,false) then raise exception 'Super Jelly feed was not saved';end if;
  stamp:=clock_timestamp();b:=s;
  -- Same computeDecay and pure-buff effects as feedWithFood; not cron decay.
  hours:=least(12,greatest(0,coalesce(extract(epoch from(stamp-s.last_decay_at))/3600,0)));
  s.hunger:=round(least(100,greatest(0,s.hunger-10*hours)+35));
  s.happiness:=round(least(100,greatest(0,s.happiness-7*hours)+45));
  s.energy:=100;
  s.sleep_quality:=round(least(100,greatest(0,s.sleep_quality-7*hours)+25));
  s.cleanliness:=round(least(100,greatest(0,coalesce(s.cleanliness,100)-4*hours)+20));
  s.weight:=round(greatest(2,least(10,s.weight)),2);
  s.is_sick:=false;
  s.mood:=case when s.hunger<30 then 'hungry' when s.sleep_quality<30 then 'sleepy'
    when s.cleanliness<25 or s.happiness<30 then 'angry'
    when s.energy>70 and s.happiness>70 then 'playful' when s.happiness>80 then 'happy' else 'idle' end;
  update public.eren_stats set hunger=s.hunger,happiness=s.happiness,energy=s.energy,
    sleep_quality=s.sleep_quality,cleanliness=s.cleanliness,weight=s.weight,is_sick=false,mood=s.mood,
    last_decay_at=stamp,updated_at=stamp where household_id=p_household_id;
  update public.profiles set coins=coins+120 where id=uid returning * into p;
  insert into public.interactions(household_id,user_id,action_type,happiness_delta,hunger_delta,energy_delta,sleep_delta,weight_delta,useful,created_at)
    values(p_household_id,uid,'feed',
      floor(s.happiness-greatest(0,b.happiness-7*hours)+0.5),
      floor(s.hunger-greatest(0,b.hunger-10*hours)+0.5),
      floor(s.energy-greatest(0,b.energy-8*hours)+0.5),
      floor(s.sleep_quality-greatest(0,b.sleep_quality-7*hours)+0.5),
      floor((s.weight-b.weight)*100+0.5)/100,
      greatest(0,b.hunger-10*hours)<90 or greatest(0,b.energy-8*hours)<90,stamp);
  result:=jsonb_build_object('ok',true,'version',1,'request_id',p_request_id,'user_id',uid,'household_id',p_household_id,
    'awarded',120,'coins',p.coins,'supers',fed->'supers','fed',fed->'fed','skin_granted',fed->'skin_granted','saved_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result)
    values(uid,p_request_id,'feed_super_jelly',input,result);
  return result||jsonb_build_object('current_supers',fed->'supers','current_fed',fed->'fed');
end;
$$;

revoke all on function eren_private.feed_super_jelly_v1() from public,anon,authenticated;
revoke all on function public.feed_super_jelly(),public.feed_super_jelly_atomic(uuid,uuid,uuid) from public,anon;
grant execute on function public.feed_super_jelly(),public.feed_super_jelly_atomic(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
