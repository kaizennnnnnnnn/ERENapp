-- Apply manually after migration_economy_reliability.sql. Safe to re-run.
-- Existing scores, coins and weekly results are preserved. No historical backpay.
begin;
do $$ begin
  if to_regclass('eren_private.economy_receipts') is null then
    raise exception 'Install the existing economy migration first';
  end if;
end $$;
create table if not exists eren_private.game_catalog(singleton boolean primary key default true check(singleton),data jsonb not null);
alter table eren_private.game_catalog enable row level security;
revoke all on schema eren_private from public,anon,authenticated;
revoke all on eren_private.game_catalog from public,anon,authenticated;
insert into eren_private.game_catalog(singleton,data) values(true,$game_catalog${"floor":3,"energy":30,"curves":{"memory_match":{"greatScore":255,"cap":32},"treat_tumble":{"greatScore":340,"cap":32},"flappy_eren":{"greatScore":40,"cap":24},"tic_tac_toe":{"greatScore":1,"cap":16},"eren_stack":{"greatScore":78,"cap":32},"yarn_pop":{"greatScore":4400,"cap":36},"eren_says":{"greatScore":15,"cap":24},"lane_runner":{"greatScore":1300,"cap":36},"paw_doku":{"greatScore":28000,"cap":42},"yarn_sort":{"greatScore":16,"cap":32},"purr_beat":{"greatScore":60000,"cap":44}}}$game_catalog$::jsonb)
  on conflict(singleton) do update set data=excluded.data;

create or replace function public.save_game_result_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_game_type text,
  p_score numeric,p_won boolean,p_save_score boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  receipt eren_private.economy_receipts%rowtype;c jsonb;curve jsonb;input jsonb;result jsonb;
  energy_value int;amount int;score_id uuid;hours numeric;stamp timestamptz;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  input:=jsonb_build_object('household_id',p_household_id,'game_type',p_game_type,'score',p_score,
    'won',coalesce(p_won,false),'save_score',coalesce(p_save_score,p_score>0));
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'game_result' or receipt.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    return receipt.result||jsonb_build_object('coins',p.coins);
  end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select data into c from eren_private.game_catalog where singleton;
  curve:=c->'curves'->p_game_type;
  if curve is null or p_score is null or not(p_score between 0 and 2147483647) or p_score<>trunc(p_score) then
    return jsonb_build_object('ok',false,'reason','bad_result');
  end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  stamp:=clock_timestamp();
  -- Read the same capped decay as care actions, without changing care stats or clocks.
  hours:=least(12,greatest(0,coalesce(extract(epoch from(stamp-s.last_decay_at))/3600,0)));
  energy_value:=round(greatest(0,least(100,s.energy-8*hours)));
  amount:=case when energy_value<(c->>'energy')::int then 0
    when p_game_type='tic_tac_toe' then case when coalesce(p_won,false) then (curve->>'cap')::int else (c->>'floor')::int end
    else least((curve->>'cap')::int,(c->>'floor')::int+round(least(1,p_score/(curve->>'greatScore')::numeric)*((curve->>'cap')::int-(c->>'floor')::int))::int) end;
  if (input->>'save_score')::boolean and p_score>0 then
    insert into public.game_scores(user_id,game_type,score,created_at) values(uid,p_game_type,p_score::int,stamp) returning id into score_id;
  end if;
  if amount>0 then update public.profiles set coins=coins+amount where id=uid returning * into p;end if;
  result:=jsonb_build_object('ok',true,'request_id',p_request_id,'user_id',uid,'household_id',p_household_id,
    'game_type',p_game_type,'score',p_score,'awarded',amount,'coins',p.coins,
    'blocked',energy_value<(c->>'energy')::int,'energy',energy_value,'score_id',score_id,'saved_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result,created_at)
    values(uid,p_request_id,'game_result',input,result,stamp);
  return result;
end;
$$;
revoke all on function public.save_game_result_atomic(uuid,uuid,uuid,text,numeric,boolean,boolean) from public,anon;
grant execute on function public.save_game_result_atomic(uuid,uuid,uuid,text,numeric,boolean,boolean) to authenticated;
commit;
