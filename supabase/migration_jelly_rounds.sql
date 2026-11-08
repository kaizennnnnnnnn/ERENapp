-- Run manually after the existing economy and Jelly migrations. No resets/backpay.
-- Keeps legacy functions/tables usable until both players refresh the new client.
begin;
set local lock_timeout='5s';
create table if not exists eren_private.jelly_round_catalog(singleton boolean primary key default true check(singleton),data jsonb not null);
alter table eren_private.jelly_round_catalog enable row level security;
revoke all on eren_private.jelly_round_catalog from public,anon,authenticated;
insert into eren_private.jelly_round_catalog(singleton,data) values(true,$jelly_round_catalog${
  "thresholds": {
    "run": 220,
    "jump": 240
  },
  "new_bias": 0.7,
  "play": {
    "happiness": 20,
    "energy": -15,
    "hunger": -10,
    "weight": -0.03
  },
  "flavours": [
    {
      "id": "red",
      "effects": [
        {
          "label": "JOY +30",
          "happiness": 30
        },
        {
          "label": "+45 COINS",
          "coins": 45
        },
        {
          "label": "CURES SICKNESS",
          "cure": true
        }
      ]
    },
    {
      "id": "green",
      "effects": [
        {
          "label": "ENERGY +35",
          "happiness": 10,
          "sleep_quality": 25
        },
        {
          "label": "JOY +18",
          "happiness": 18
        },
        {
          "label": "CLEAN +30",
          "cleanliness": 30
        }
      ]
    },
    {
      "id": "purple",
      "effects": [
        {
          "label": "SLEEP +35",
          "sleep_quality": 35
        },
        {
          "label": "HUNGER +25",
          "hunger": 25
        },
        {
          "label": "JOY +25",
          "happiness": 25
        }
      ]
    },
    {
      "id": "yellow",
      "effects": [
        {
          "label": "+60 COINS",
          "coins": 60
        },
        {
          "label": "CLEAN +25 JOY +15",
          "cleanliness": 25,
          "happiness": 15
        },
        {
          "label": "-0.2 KG",
          "weight": -0.2
        }
      ]
    },
    {
      "id": "orange",
      "effects": [
        {
          "label": "SLEEP+20 JOY+20",
          "sleep_quality": 20,
          "happiness": 20
        },
        {
          "label": "HUNGER +35",
          "hunger": 35
        },
        {
          "label": "+35 COINS",
          "coins": 35
        }
      ]
    }
  ]
}$jelly_round_catalog$::jsonb)
  on conflict(singleton) do update set data=excluded.data;

create or replace function public.finish_jelly_round_atomic(
  p_request_id uuid,p_expected_user uuid,p_household_id uuid,p_game text,p_score numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();p public.profiles%rowtype;s public.eren_stats%rowtype;j public.jelly_progress%rowtype;
  receipt eren_private.economy_receipts%rowtype;input jsonb;result jsonb;c jsonb;f jsonb;effect jsonb;play jsonb;
  stamp timestamptz;day_key date;hours numeric;best int;peer_score int:=0;peer_name text;score_id uuid;
  eligible boolean;lead boolean;bonus boolean:=false;n int;idx int;flavour text;pool text[];empty_slots text[];all_slots text[];
  is_new boolean;minted boolean;won jsonb:='[]';amount int:=0;rows_changed int;
  h numeric;joy numeric;e numeric;sl numeric;cl numeric;w numeric;sick boolean;
  bh numeric;bj numeric;be numeric;bs numeric;bw numeric;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated');end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed');end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request');end if;
  if p_game is null or p_game not in ('run','jump') or p_score is null or not(p_score between 0 and 2147483647) or p_score<>trunc(p_score) then
    return jsonb_build_object('ok',false,'reason','bad_result');
  end if;
  input:=jsonb_build_object('household_id',p_household_id,'game',p_game,'score',p_score);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile');end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed');end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'jelly_round' or receipt.input<>input then return jsonb_build_object('ok',false,'reason','request_mismatch');end if;
    select * into j from public.jelly_progress where user_id=uid;
    return receipt.result||jsonb_build_object('coins',p.coins,'current_day',j.day,'current_flavours',coalesce(j.flavours,'[]'),
      'current_supers',coalesce(j.supers,0),'current_fed',coalesce(j.fed,0));
  end if;
  -- Serializes the household's duel decision as well as its care effects.
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats');end if;
  stamp:=clock_timestamp();day_key:=(stamp at time zone 'utc')::date;
  select data into c from eren_private.jelly_round_catalog where singleton;
  play:=c->'play';eligible:=p_score >= (c->'thresholds'->>p_game)::int;
  select coalesce(max(score),0) into best from public.jelly_scores where user_id=uid and household_id=p_household_id and game=p_game;
  select scores.score,peer.name into peer_score,peer_name from public.jelly_scores scores join public.profiles peer on peer.id=scores.user_id
    where scores.household_id=p_household_id and peer.household_id=p_household_id and scores.user_id<>uid and scores.game=p_game and scores.day=day_key
    order by scores.score desc,scores.created_at,scores.id limit 1;
  peer_score:=coalesce(peer_score,0);lead:=peer_score>0 and p_score>peer_score;
  if p_score>0 then
    insert into public.jelly_scores(household_id,user_id,game,score,day,created_at)
      values(p_household_id,uid,p_game,p_score::int,day_key,stamp) returning id into score_id;
  end if;
  if eligible and lead then
    insert into public.jelly_duel_leads(household_id,user_id,game,day,created_at) values(p_household_id,uid,p_game,day_key,stamp) on conflict do nothing;
    get diagnostics rows_changed=row_count;bonus:=rows_changed>0;
  end if;
  if eligible then
    insert into public.jelly_progress(user_id,day) values(uid,day_key) on conflict(user_id) do nothing;
    select * into j from public.jelly_progress where user_id=uid for update;
    if j.day<>day_key then j.flavours:='[]';end if;
  else select * into j from public.jelly_progress where user_id=uid;end if;

  hours:=least(12,greatest(0,coalesce(extract(epoch from(stamp-s.last_decay_at))/3600,0)));
  h:=greatest(0,s.hunger-10*hours);joy:=greatest(0,s.happiness-7*hours);e:=greatest(0,s.energy-8*hours);
  sl:=greatest(0,s.sleep_quality-7*hours);cl:=greatest(0,coalesce(s.cleanliness,100)-4*hours);w:=s.weight;sick:=s.is_sick;
  select array_agg(value->>'id' order by ordinal) into all_slots from jsonb_array_elements(c->'flavours') with ordinality as items(value,ordinal);
  if eligible then
    for n in 1..(case when bonus then 2 else 1 end) loop
      select array_agg(id order by ordinal) into empty_slots from unnest(all_slots) with ordinality as slots(id,ordinal) where not(j.flavours @> to_jsonb(id));
      pool:=case when coalesce(array_length(empty_slots,1),0)>0 and random()<(c->>'new_bias')::numeric then empty_slots else all_slots end;
      flavour:=pool[1+floor(random()*array_length(pool,1))::int];
      select value into f from jsonb_array_elements(c->'flavours') where value->>'id'=flavour;
      idx:=floor(random()*jsonb_array_length(f->'effects'))::int;effect:=f->'effects'->idx;
      is_new:=not(j.flavours @> to_jsonb(flavour));
      if is_new then j.flavours:=j.flavours||to_jsonb(flavour);end if;
      minted:=is_new and jsonb_array_length(j.flavours)>=5;
      if minted then j.supers:=j.supers+1;end if;
      won:=won||jsonb_build_array(jsonb_build_object('flavour',flavour,'effect',idx,'is_new',is_new,'minted_super',minted,'tray_count',jsonb_array_length(j.flavours)));
      amount:=amount+coalesce((effect->>'coins')::int,0);
      bh:=h;bj:=joy;be:=e;bs:=sl;bw:=w;
      h:=round(least(100,greatest(0,h+coalesce((effect->>'hunger')::numeric,0))));
      joy:=round(least(100,greatest(0,joy+coalesce((effect->>'happiness')::numeric,0))));
      e:=round(least(100,greatest(0,coalesce((effect->>'energy')::numeric,e))));
      sl:=round(least(100,greatest(0,sl+coalesce((effect->>'sleep_quality')::numeric,0))));
      cl:=round(least(100,greatest(0,cl+coalesce((effect->>'cleanliness')::numeric,0))));
      w:=round(greatest(2,least(10,w+coalesce((effect->>'weight')::numeric,0))),2);
      if coalesce((effect->>'cure')::boolean,false) then sick:=false;end if;
      insert into public.interactions(household_id,user_id,action_type,happiness_delta,hunger_delta,energy_delta,sleep_delta,weight_delta,useful,created_at)
        values(p_household_id,uid,'feed',floor(joy-bj+0.5),floor(h-bh+0.5),floor(e-be+0.5),floor(sl-bs+0.5),floor((w-bw)*100+0.5)/100,bh<90 or (effect ? 'energy' and be<90),stamp);
    end loop;
    update public.jelly_progress set day=day_key,flavours=j.flavours,supers=j.supers,updated_at=stamp where user_id=uid returning * into j;
  end if;
  if p_score>0 then
    -- The existing post-game play action, now saved after the Jelly buffs.
    insert into public.interactions(household_id,user_id,action_type,happiness_delta,hunger_delta,energy_delta,sleep_delta,weight_delta,useful,created_at)
      values(p_household_id,uid,'play',coalesce((play->>'happiness')::int,0),coalesce((play->>'hunger')::int,0),coalesce((play->>'energy')::int,0),coalesce((play->>'sleep_quality')::int,0),coalesce((play->>'weight')::numeric,0),joy<90,stamp);
    h:=round(least(100,greatest(0,h+coalesce((play->>'hunger')::numeric,0))));
    joy:=round(least(100,greatest(0,joy+coalesce((play->>'happiness')::numeric,0))));
    e:=round(least(100,greatest(0,e+coalesce((play->>'energy')::numeric,0))));
    sl:=round(least(100,greatest(0,sl+coalesce((play->>'sleep_quality')::numeric,0))));
    cl:=least(100,greatest(0,cl+coalesce((play->>'cleanliness')::numeric,0)));
    w:=round(greatest(2,least(10,w+coalesce((play->>'weight')::numeric,0))),2);
    sick:=((cl<5)::int+(sl<5)::int+(w>8)::int)>=2;
    update public.eren_stats set hunger=h,happiness=joy,energy=e,sleep_quality=sl,cleanliness=cl,weight=w,is_sick=sick,
      mood=case when h<30 then 'hungry' when sl<30 then 'sleepy' when cl<25 or joy<30 then 'angry' when e>70 and joy>70 then 'playful' when joy>80 then 'happy' else 'idle' end,
      last_decay_at=stamp,updated_at=stamp where household_id=p_household_id;
  end if;
  if amount>0 then update public.profiles set coins=coins+amount where id=uid returning * into p;end if;
  result:=jsonb_build_object('ok',true,'version',1,'request_id',p_request_id,'user_id',uid,'household_id',p_household_id,'game',p_game,'score',p_score,
    'best',greatest(best,p_score),'is_best',p_score>best,'theirs_today',peer_score,'their_name',peer_name,'took_lead',lead,'bonus_jelly',bonus,
    'wins',won,'awarded',amount,'coins',p.coins,'saved_at',stamp);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result,created_at) values(uid,p_request_id,'jelly_round',input,result,stamp);
  return result||jsonb_build_object('current_day',j.day,'current_flavours',coalesce(j.flavours,'[]'),'current_supers',coalesce(j.supers,0),'current_fed',coalesce(j.fed,0));
end;
$$;
revoke all on function public.finish_jelly_round_atomic(uuid,uuid,uuid,text,numeric) from public,anon;
grant execute on function public.finish_jelly_round_atomic(uuid,uuid,uuid,text,numeric) to authenticated;
notify pgrst,'reload schema';
commit;
