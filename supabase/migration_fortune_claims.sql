-- Run manually after migration_economy_reliability.sql. Safe to re-run.
-- Existing gifts, cooldowns, coins, inventory and gacha pity are not reset.
begin;
do $$ begin
  if to_regclass('eren_private.economy_receipts') is null then
    raise exception 'Install migration_economy_reliability.sql first';
  end if;
end $$;

create table if not exists eren_private.fortune_catalog (
  singleton boolean primary key default true check (singleton),data jsonb not null
);
alter table eren_private.fortune_catalog enable row level security;
revoke all on schema eren_private from public,anon,authenticated;
revoke all on eren_private.fortune_catalog from public,anon,authenticated;
insert into eren_private.fortune_catalog(singleton,data) values(true,
$fortune_catalog${"weights":{"common":55,"rare":30,"epic":12,"legendary":3},"gifts":[{"id":"fortune_coins_10","rarity":"common","coins":10,"dust":0,"tickets":0},{"id":"fortune_coins_25","rarity":"common","coins":25,"dust":0,"tickets":0},{"id":"fortune_coins_50","rarity":"rare","coins":50,"dust":0,"tickets":0},{"id":"fortune_coins_100","rarity":"epic","coins":100,"dust":0,"tickets":0},{"id":"fortune_coins_250","rarity":"legendary","coins":250,"dust":0,"tickets":0},{"id":"fortune_dust_5","rarity":"common","coins":0,"dust":5,"tickets":0},{"id":"fortune_dust_15","rarity":"rare","coins":0,"dust":15,"tickets":0},{"id":"fortune_dust_40","rarity":"epic","coins":0,"dust":40,"tickets":0},{"id":"fortune_ticket_1","rarity":"rare","coins":0,"dust":0,"tickets":1},{"id":"fortune_ticket_3","rarity":"epic","coins":0,"dust":0,"tickets":3},{"id":"fortune_ticket_10","rarity":"legendary","coins":0,"dust":0,"tickets":10},{"id":"fortune_lucky_paw","rarity":"common","coins":0,"dust":0,"tickets":0},{"id":"fortune_yarn_ball","rarity":"common","coins":0,"dust":0,"tickets":0},{"id":"fortune_star_fragment","rarity":"rare","coins":0,"dust":0,"tickets":0},{"id":"fortune_moon_stone","rarity":"rare","coins":0,"dust":0,"tickets":0},{"id":"fortune_crystal_fish","rarity":"epic","coins":0,"dust":0,"tickets":0},{"id":"fortune_eren_feather","rarity":"epic","coins":0,"dust":0,"tickets":0},{"id":"fortune_golden_bell","rarity":"legendary","coins":0,"dust":0,"tickets":0}]}$fortune_catalog$::jsonb)
on conflict(singleton) do update set data=excluded.data;
do $$ begin
  if not exists(select 1 from eren_private.fortune_catalog where singleton
    and jsonb_array_length(data->'gifts')=18 and data->'weights'='{"common":55,"rare":30,"epic":12,"legendary":3}'::jsonb) then
    raise exception 'Fortune catalogue incomplete';
  end if;
end $$;

-- Pure private helper: deterministic inputs let disposable tests compare every
-- draw with the original client algorithm. The public RPC supplies randomness.
create or replace function eren_private.roll_fortune(p_roll double precision,p_pick double precision)
returns jsonb language plpgsql stable set search_path='' as $$
declare c jsonb; w jsonb; rarity text:='common'; n double precision; pool jsonb;
begin
  if p_roll is null or p_pick is null or p_roll<0 or p_roll>=1 or p_pick<0 or p_pick>=1 then
    raise exception 'Invalid fortune roll';
  end if;
  select data into c from eren_private.fortune_catalog where singleton;
  w:=c->'weights';
  n:=p_roll*((w->>'common')::int+(w->>'rare')::int+(w->>'epic')::int+(w->>'legendary')::int);
  if n<(w->>'legendary')::int then rarity:='legendary';
  elsif n<(w->>'legendary')::int+(w->>'epic')::int then rarity:='epic';
  elsif n<(w->>'legendary')::int+(w->>'epic')::int+(w->>'rare')::int then rarity:='rare'; end if;
  select jsonb_agg(value order by ordinality) into pool from jsonb_array_elements(c->'gifts') with ordinality
    where value->>'rarity'=rarity;
  return pool->floor(p_pick*jsonb_array_length(pool))::int;
end;
$$;

create or replace function public.claim_fortune_atomic(p_request_id uuid,p_expected_user uuid,p_time_zone text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); p public.profiles%rowtype; s public.user_gacha_state%rowtype;
  r eren_private.economy_receipts%rowtype; input jsonb; result jsonb; gift jsonb; stamp timestamptz; today date;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated'); end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed'); end if;
  if p_request_id is null then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
  input:=jsonb_build_object('timeZone',p_time_zone);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile'); end if;
  select * into r from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if r.operation<>'fortune' or r.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch'); end if;
    select * into s from public.user_gacha_state where user_id=uid for update;
    return r.result||jsonb_build_object('user_id',uid,'coins',p.coins,'stardust',s.stardust,
      'gacha_tickets',s.gacha_tickets,'last_free_fortune',s.last_free_fortune);
  end if;
  if p_time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then
    return jsonb_build_object('ok',false,'reason','bad_request');
  end if;
  -- Same lock order as food, gacha and reward-road saves.
  insert into public.user_gacha_state(user_id) values(uid) on conflict(user_id) do nothing;
  select * into s from public.user_gacha_state where user_id=uid for update;
  stamp:=clock_timestamp(); today:=(stamp at time zone p_time_zone)::date;
  if s.last_free_fortune is not null and (s.last_free_fortune at time zone p_time_zone)::date>=today then
    return jsonb_build_object('ok',false,'reason','cooldown','last_free_fortune',s.last_free_fortune);
  end if;
  gift:=eren_private.roll_fortune(random(),random());
  if gift is null then raise exception 'Fortune catalogue has no matching gift'; end if;
  if (gift->>'coins')::int>0 then
    update public.profiles set coins=coalesce(coins,0)+(gift->>'coins')::int where id=uid returning * into p;
  elsif (gift->>'dust')::int=0 and (gift->>'tickets')::int=0 then
    insert into public.user_inventory(user_id,item_id,quantity,equipped) values(uid,gift->>'id',1,false)
      on conflict(user_id,item_id) do update set quantity=public.user_inventory.quantity+1;
  end if;
  update public.user_gacha_state set
    stardust=coalesce(stardust,0)+(gift->>'dust')::int,
    gacha_tickets=coalesce(gacha_tickets,0)+(gift->>'tickets')::int,last_free_fortune=stamp
    where user_id=uid returning * into s;
  result:=jsonb_build_object('ok',true,'gift_id',gift->>'id','claimed_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result)
    values(uid,p_request_id,'fortune',input,result);
  return result||jsonb_build_object('user_id',uid,'coins',p.coins,'stardust',s.stardust,
    'gacha_tickets',s.gacha_tickets,'last_free_fortune',s.last_free_fortune);
end;
$$;
revoke all on function eren_private.roll_fortune(double precision,double precision) from public,anon,authenticated;
revoke all on function public.claim_fortune_atomic(uuid,uuid,text) from public,anon;
grant execute on function public.claim_fortune_atomic(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
