-- Run after migration_super_jelly_saves.sql. No resets or historical backpay.
-- The snack, feed, buffs, coins and fifth-feed skin share one transaction.
begin;
set local lock_timeout = '5s';

do $$begin
  if to_regprocedure('eren_private.feed_super_jelly_atomic_v1(uuid,uuid,uuid)') is null then
    alter function public.feed_super_jelly_atomic(uuid,uuid,uuid) set schema eren_private;
    alter function eren_private.feed_super_jelly_atomic(uuid,uuid,uuid) rename to feed_super_jelly_atomic_v1;
  end if;
end$$;
alter function eren_private.feed_super_jelly_atomic_v1(uuid,uuid,uuid) set search_path = '';

create or replace function public.feed_super_jelly_atomic(
  p_request_id uuid, p_expected_user uuid, p_household_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); v_result jsonb; had_receipt boolean;
  foods jsonb; mine jsonb; snack text;
  pool text[] := array['cookie','donut','donut_choco','donut_honey','donut_sakura'];
begin
  if uid is null or uid is distinct from p_expected_user or p_request_id is null or p_household_id is null then
    return eren_private.feed_super_jelly_atomic_v1(p_request_id,p_expected_user,p_household_id);
  end if;
  -- Same request lock as the original feed, including mixed-version retries.
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select exists(select 1 from eren_private.economy_receipts where user_id=uid and request_id=p_request_id) into had_receipt;
  v_result := eren_private.feed_super_jelly_atomic_v1(p_request_id,p_expected_user,p_household_id);
  if not coalesce((v_result->>'ok')::boolean,false) or had_receipt then return v_result; end if;

  -- The feed already holds profile, household-stats and progress row locks.
  -- Only the actor's personal food pile changes, never shared or partner food.
  select coalesce(food_by_user,'{}'::jsonb) into foods from public.eren_stats where household_id=p_household_id;
  mine := coalesce(nullif(foods->uid::text,'null'::jsonb),'{}'::jsonb);
  snack := pool[1+floor(random()*array_length(pool,1))::integer];
  mine := jsonb_set(mine,array[snack],to_jsonb(coalesce((mine->>snack)::integer,0)+1),true);
  update public.eren_stats set food_by_user=jsonb_set(foods,array[uid::text],mine,true) where household_id=p_household_id;
  v_result := v_result||jsonb_build_object('version',2,'snack',jsonb_build_object('food_key',snack,'quantity',1));
  update eren_private.economy_receipts as receipt set result=v_result where receipt.user_id=uid and receipt.request_id=p_request_id;
  return v_result;
end;
$$;

revoke all on function eren_private.feed_super_jelly_atomic_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.feed_super_jelly_atomic(uuid,uuid,uuid) from public,anon;
grant execute on function public.feed_super_jelly_atomic(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
