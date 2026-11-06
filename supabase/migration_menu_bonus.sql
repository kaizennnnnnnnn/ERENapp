-- Apply manually after migration_food_actions.sql. Safe to re-run.
-- Existing balances, meals and claimed menus are not reset or back-paid.
begin;
do $$ begin
  if to_regclass('eren_private.economy_receipts') is null
    or to_regclass('eren_private.food_action_catalog') is null then
    raise exception 'Install the existing economy and food-action migrations first';
  end if;
end $$;
create table if not exists eren_private.menu_catalog(singleton boolean primary key default true check(singleton),data jsonb not null);
create table if not exists eren_private.menu_claims(
  household_id uuid not null references public.households(id) on delete cascade,
  day date not null,claimed_by uuid references public.profiles(id) on delete set null,
  coins integer not null check(coins>=0),claimed_at timestamptz not null,
  primary key(household_id,day)
);
alter table eren_private.menu_catalog enable row level security;
alter table eren_private.menu_claims enable row level security;
revoke all on schema eren_private from public,anon,authenticated;
revoke all on eren_private.menu_catalog,eren_private.menu_claims from public,anon,authenticated;
create index if not exists economy_receipts_menu_meals
  on eren_private.economy_receipts((input->>'household_id'),created_at) where operation='feed_food';
insert into eren_private.menu_catalog(singleton,data) values(true,$menu_catalog${"pool":["kibble","treat","tuna","steak","cream","biscuit","shrimp","salmon","chicken","sausage","milk","cheese","yogurt","egg","cake","sardine","cookie","jelly_caka","pizza","carbonara","lasagna","risotto","nigiri","temaki","maki","ramen","pad_thai","gyoza","xiaolongbao","cevapi","sarma","doner","tacos","wrap","paella","stew","meatballs","roast_chicken","donut","donut_choco"],"size":3,"coins":30}$menu_catalog$::jsonb)
  on conflict(singleton) do update set data=excluded.data;
do $$ begin
  if not exists(select 1 from eren_private.menu_catalog where singleton
    and jsonb_array_length(data->'pool')>=3 and (data->>'size')::int=3 and (data->>'coins')::int=30) then
    raise exception 'Menu catalogue incomplete';
  end if;
end $$;

-- FNV-1a and Mulberry32/Fisher-Yates parity with lib/seededRng.ts.
-- The seed contains ASCII dates and canonical UUIDs. Numeric multiplication
-- retains the low 32 bits without overflowing signed PostgreSQL bigint.
create or replace function eren_private.menu_for_day(p_day date,p_household uuid)
returns text[] language plpgsql stable set search_path='' as $$
declare
  c jsonb; seed text:='eren-menu:'||p_day::text||':'||coalesce(p_household::text,'solo');
  a bigint:=2166136261;t bigint;u bigint;items text[];j int;swap text;
begin
  select data into c from eren_private.menu_catalog where singleton;
  select array_agg(value order by ordinality) into items from jsonb_array_elements_text(c->'pool') with ordinality;
  for i in 1..length(seed) loop a:=((a # ascii(substr(seed,i,1)))*16777619)%4294967296;end loop;
  for i in reverse cardinality(items)..2 loop
    a:=(a+1831565813)%4294967296;
    t:=mod((a # (a>>15))::numeric*(1|a)::numeric,4294967296)::bigint;
    u:=mod((t # (t>>7))::numeric*(61|t)::numeric,4294967296)::bigint;
    t:=((t+u)%4294967296) # t;
    j:=floor(((t # (t>>14))::numeric/4294967296)*i)::int+1;
    swap:=items[i];items[i]:=items[j];items[j]:=swap;
  end loop;
  return items[1:(c->>'size')::int];
end;
$$;

create or replace function public.claim_menu_bonus_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_day text,p_time_zone text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;
  receipt eren_private.economy_receipts%rowtype;claim eren_private.menu_claims%rowtype;
  input jsonb;result jsonb;d date;menu text[];done jsonb;legacy jsonb;next_state jsonb;
  stamp timestamptz;start_at timestamptz;end_at timestamptz;paid int:=0;amount int;
begin
  result:=jsonb_build_object('ok',false,'day',p_day);
  if uid is null then return result||jsonb_build_object('reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return result||jsonb_build_object('reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return result||jsonb_build_object('reason','bad_request');end if;
  input:=jsonb_build_object('household_id',p_household_id,'day',p_day,'time_zone',p_time_zone);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return result||jsonb_build_object('reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return result||jsonb_build_object('reason','household_changed');end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return result||jsonb_build_object('reason','no_fridge');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'menu_bonus' or receipt.input<>input then return result||jsonb_build_object('reason','request_mismatch');end if;
    return receipt.result||jsonb_build_object('coins',p.coins,'menu_state',s.menu_state);
  end if;
  if coalesce(p_day,'')!~'^\d{4}-\d{2}-\d{2}$' or p_time_zone is null
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then
    return result||jsonb_build_object('reason','bad_request');
  end if;
  d:=p_day::date;stamp:=clock_timestamp();
  if d<>(stamp at time zone p_time_zone)::date then return result||jsonb_build_object('reason','period_changed');end if;
  start_at:=d::timestamp at time zone p_time_zone;end_at:=(d+1)::timestamp at time zone p_time_zone;
  menu:=eren_private.menu_for_day(d,p_household_id);
  legacy:=case when s.menu_state->>'day'=p_day then s.menu_state else '{}'::jsonb end;
  select coalesce(jsonb_agg(food order by ord),'[]'::jsonb) into done from unnest(menu) with ordinality foods(food,ord)
    where (case when jsonb_typeof(legacy->'done')='array' then legacy->'done' else '[]'::jsonb end) ? food
    or exists(select 1 from eren_private.economy_receipts r where r.operation='feed_food'
      and r.input->>'household_id'=p_household_id::text and r.input->>'food_key'=food
      and r.created_at>=start_at and r.created_at<end_at);
  select * into claim from eren_private.menu_claims where household_id=p_household_id and day=d;
  if not found and nullif(legacy->>'claimed_at','') is not null then
    -- Do not guess whether an old split-write payout landed. Honor its marker.
    insert into eren_private.menu_claims values(p_household_id,d,null,0,stamp) returning * into claim;
  elsif not found and jsonb_array_length(done)=cardinality(menu) then
    select (data->>'coins')::int into amount from eren_private.menu_catalog where singleton;
    insert into eren_private.menu_claims values(p_household_id,d,uid,amount,stamp) returning * into claim;
    update public.profiles set coins=coalesce(coins,0)+amount where id=uid returning * into p;
    paid:=amount;
  end if;
  next_state:=jsonb_build_object('day',p_day,'done',done,'claimed_at',claim.claimed_at);
  if s.menu_state is distinct from next_state then
    update public.eren_stats set menu_state=next_state where household_id=p_household_id;
  end if;
  result:=jsonb_build_object('ok',true,'user_id',uid,'household_id',p_household_id,'day',p_day,
    'awarded',paid,'claimed_by',claim.claimed_by);
  if paid>0 then
    insert into eren_private.economy_receipts(user_id,request_id,operation,input,result)
      values(uid,p_request_id,'menu_bonus',input,result);
  end if;
  return result||jsonb_build_object('coins',p.coins,'menu_state',next_state);
end;
$$;
revoke all on function eren_private.menu_for_day(date,uuid) from public,anon,authenticated;
revoke all on function public.claim_menu_bonus_atomic(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.claim_menu_bonus_atomic(uuid,uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
