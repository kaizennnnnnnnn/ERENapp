-- Run manually after migration_economy_reliability.sql.
-- One free food pull per account every rolling 24 hours; no existing data reset.
begin;
alter table public.user_gacha_state add column if not exists last_free_food_gacha timestamptz;

create or replace function eren_private.guard_free_food_clock()
returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated') then
    if (tg_op='INSERT' and new.last_free_food_gacha is not null)
      or (tg_op='UPDATE' and new.last_free_food_gacha is distinct from old.last_free_food_gacha) then
      raise exception 'Free food cooldown is server managed' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_free_food_clock on public.user_gacha_state;
create trigger guard_free_food_clock before insert or update on public.user_gacha_state
  for each row execute function eren_private.guard_free_food_clock();
revoke all on function eren_private.guard_free_food_clock() from public,anon,authenticated;

create or replace function public.claim_free_food_gacha_atomic(p_request_id uuid,p_expected_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.user_gacha_state%rowtype;
  receipt eren_private.economy_receipts%rowtype;result jsonb;stamp timestamptz;held_tickets int;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'free_food_gacha' or receipt.input<>'{}'::jsonb then
      return jsonb_build_object('ok',false,'reason','request_mismatch');
    end if;
    return receipt.result||jsonb_build_object('coins',p.coins,'state',
      (select to_jsonb(g) from public.user_gacha_state g where user_id=uid));
  end if;
  begin
    insert into public.user_gacha_state(user_id) values(uid) on conflict do nothing;
    select * into s from public.user_gacha_state where user_id=uid for update;
    stamp:=clock_timestamp();
    if s.last_free_food_gacha is not null and s.last_free_food_gacha>stamp-interval '24 hours' then
      return jsonb_build_object('ok',false,'reason','cooldown','state',to_jsonb(s));
    end if;
    held_tickets:=s.gacha_tickets;
    -- Reuse the proven pull transaction, then restore the exact held ticket count.
    -- The temporary ticket and both receipts are invisible until this outer save commits.
    update public.user_gacha_state set gacha_tickets=greatest(1,gacha_tickets) where user_id=uid;
    result:=public.pull_gacha_atomic(gen_random_uuid(),'food',1,true);
    if not coalesce((result->>'ok')::boolean,false) then
      raise exception 'Free food pull refused' using errcode='EF001';
    end if;
    update public.user_gacha_state set gacha_tickets=held_tickets,last_free_food_gacha=stamp
      where user_id=uid returning * into s;
    result:=result||jsonb_build_object('state',to_jsonb(s),'freeFood',true);
    insert into eren_private.economy_receipts(user_id,request_id,operation,input,result)
      values(uid,p_request_id,'free_food_gacha','{}',result);
    return result;
  exception when sqlstate 'EF001' then
    -- A normal refusal must roll back the temporary ticket too.
    if result is null or coalesce((result->>'ok')::boolean,false) then raise;end if;
    return result;
  end;
end;
$$;
revoke all on function public.claim_free_food_gacha_atomic(uuid,uuid) from public,anon;
grant execute on function public.claim_free_food_gacha_atomic(uuid,uuid) to authenticated;

-- One read for the global shortcut badges; caller RLS still applies.
create or replace function public.read_reward_indicators(p_expected_user uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null or uid is distinct from p_expected_user then
    return jsonb_build_object('ok',false,'reason','session_changed');
  end if;
  return jsonb_build_object('ok',true,'user_id',uid,'gacha',coalesce(
    (select to_jsonb(g) from public.user_gacha_state g where user_id=uid),
    jsonb_build_object('last_free_donut',null,'last_free_food_gacha',null,'gacha_tickets',0)),
    'supers',coalesce((select supers from public.jelly_progress where user_id=uid),0),
    'weekly',(select count(*) from public.weekly_game_results where user_id=uid and not payout_paid and payout_coins>0));
end;
$$;
revoke all on function public.read_reward_indicators(uuid) from public,anon;
grant execute on function public.read_reward_indicators(uuid) to authenticated;
commit;
