-- Apply manually after migration_economy_reliability.sql and the existing reward migrations.
-- Safe to re-run: no wallet, quest, streak, inventory or claimed-level reset.
begin;
do $$ begin
  if to_regclass('eren_private.economy_receipts') is null then
    raise exception 'Install migration_economy_reliability.sql first';
  end if;
  if to_regclass('public.user_task_completions') is null then
    raise exception 'The existing quest completion table is required';
  end if;
end $$;

create table if not exists eren_private.reward_catalog (
  singleton boolean primary key default true check (singleton), data jsonb not null
);
alter table eren_private.reward_catalog enable row level security;
revoke all on schema eren_private from public, anon, authenticated;
revoke all on eren_private.reward_catalog from public, anon, authenticated;
insert into eren_private.reward_catalog(singleton, data) values (true,
$reward_catalog${"tasks":[{"id":"daily_mood","period":"daily","coins":20,"xp":15,"maxProgress":null},{"id":"daily_feed","period":"daily","coins":25,"xp":20,"maxProgress":null},{"id":"daily_play","period":"daily","coins":25,"xp":20,"maxProgress":null},{"id":"daily_sleep","period":"daily","coins":25,"xp":20,"maxProgress":null},{"id":"daily_wash","period":"daily","coins":25,"xp":20,"maxProgress":null},{"id":"daily_game","period":"daily","coins":20,"xp":15,"maxProgress":null},{"id":"daily_nudge","period":"daily","coins":20,"xp":15,"maxProgress":null},{"id":"daily_chem_lesson","period":"daily","coins":35,"xp":15,"maxProgress":null},{"id":"daily_chem_streak","period":"daily","coins":35,"xp":20,"maxProgress":null},{"id":"weekly_all_care","period":"weekly","coins":60,"xp":100,"maxProgress":4},{"id":"weekly_all_games","period":"weekly","coins":50,"xp":80,"maxProgress":3},{"id":"weekly_high_score","period":"weekly","coins":40,"xp":60,"maxProgress":null},{"id":"weekly_mood_5","period":"weekly","coins":40,"xp":70,"maxProgress":5},{"id":"weekly_no_sick","period":"weekly","coins":50,"xp":90,"maxProgress":null}],"achievements":[{"id":"first_care","coins":10,"triggers":["care"]},{"id":"all_care_day","coins":50,"triggers":["care"]},{"id":"clean_sweep","coins":75,"triggers":["care"]},{"id":"care_100","coins":200,"triggers":["care","mount"]},{"id":"streak_7","coins":50,"triggers":["streak"]},{"id":"streak_30","coins":150,"triggers":["streak"]},{"id":"streak_100","coins":500,"triggers":["streak"]},{"id":"first_game","coins":10,"triggers":["game"]},{"id":"high_score_50","coins":100,"triggers":["game"]},{"id":"all_games","coins":200,"triggers":["game","mount"]},{"id":"level_10","coins":50,"triggers":["level","mount"]},{"id":"level_25","coins":100,"triggers":["level","mount"]},{"id":"level_50","coins":300,"triggers":["level","mount"]},{"id":"battle_win","coins":75,"triggers":["battle"]},{"id":"mood_7","coins":75,"triggers":["mood","mount"]},{"id":"first_nudge","coins":25,"triggers":["nudge"]}],"levels":[{"level":1,"items":[{"kind":"coins","amount":100}]},{"level":2,"items":[{"kind":"food","foods":["pizza","cevapi","ramen"],"pack":"World dishes"}]},{"level":3,"items":[{"kind":"coins","amount":60}]},{"level":4,"items":[{"kind":"food","foods":["donut_red_velvet","donut_sakura","donut_maple_bacon"],"pack":"Bakery box"}]},{"level":5,"items":[{"kind":"food","foods":["monsta_original"]},{"kind":"tickets","amount":1},{"kind":"coins","amount":100}]},{"level":6,"items":[{"kind":"coins","amount":120}]},{"level":7,"items":[{"kind":"food","foods":["lasagna","nigiri","tacos","gyoza"],"pack":"World dishes"},{"kind":"coins","amount":50}]},{"level":8,"items":[{"kind":"coins","amount":160}]},{"level":9,"items":[{"kind":"food","foods":["monsta_mango","monsta_loco"],"pack":"Purrbolt pack"}]},{"level":10,"items":[{"kind":"skin","rarity":"rare"},{"kind":"tickets","amount":3},{"kind":"stardust","amount":50},{"kind":"coins","amount":200}]},{"level":11,"items":[{"kind":"coins","amount":220}]},{"level":12,"items":[{"kind":"food","foods":["donut_tiger"]},{"kind":"coins","amount":200}]},{"level":13,"items":[{"kind":"coins","amount":260}]},{"level":14,"items":[{"kind":"food","foods":["carbonara","pad_thai","sarma","paella","temaki","meatballs"],"pack":"World dishes"},{"kind":"coins","amount":130}]},{"level":15,"items":[{"kind":"food","foods":["monsta_gold"]},{"kind":"tickets","amount":2},{"kind":"stardust","amount":75},{"kind":"coins","amount":300}]},{"level":16,"items":[{"kind":"coins","amount":320}]},{"level":17,"items":[{"kind":"food","foods":["donut_honey","donut_caramel","donut_matcha","donut_ube","donut_mochi"],"pack":"Bakery box"},{"kind":"coins","amount":180}]},{"level":18,"items":[{"kind":"coins","amount":360}]},{"level":19,"items":[{"kind":"food","foods":["donut_arcade"]},{"kind":"coins","amount":320}]},{"level":20,"items":[{"kind":"food","foods":["monsta_rainbow"]},{"kind":"tickets","amount":5},{"kind":"stardust","amount":100},{"kind":"coins","amount":400}]},{"level":21,"items":[{"kind":"coins","amount":420}]},{"level":22,"items":[{"kind":"food","foods":["donut_neon"]},{"kind":"coins","amount":380}]},{"level":23,"items":[{"kind":"coins","amount":460}]},{"level":24,"items":[{"kind":"food","foods":["monsta_white","monsta_pipeline","monsta_punch"],"pack":"Purrbolt pack"},{"kind":"coins","amount":180}]},{"level":25,"items":[{"kind":"skin","rarity":"epic"},{"kind":"tickets","amount":5},{"kind":"stardust","amount":150},{"kind":"coins","amount":500}]},{"level":26,"items":[{"kind":"food","foods":["donut_lattice","donut_sakura","donut_hibiscus","donut_black_forest","donut_ube"],"pack":"Bakery box"},{"kind":"coins","amount":370}]},{"level":27,"items":[{"kind":"food","foods":["monsta_rosa","monsta_peachy","monsta_original"],"pack":"Purrbolt pack"},{"kind":"coins","amount":240}]},{"level":28,"items":[{"kind":"coins","amount":560}]},{"level":29,"items":[{"kind":"stardust","amount":50},{"kind":"coins","amount":460}]},{"level":30,"items":[{"kind":"tickets","amount":5},{"kind":"stardust","amount":150},{"kind":"coins","amount":600}]},{"level":31,"items":[{"kind":"food","foods":["stew","risotto","maki","xiaolongbao","wrap","meatballs"],"pack":"World dishes"},{"kind":"coins","amount":470}]},{"level":32,"items":[{"kind":"food","foods":["monsta_mango","monsta_loco","monsta_white"],"pack":"Purrbolt pack"},{"kind":"coins","amount":340}]},{"level":33,"items":[{"kind":"coins","amount":660}]},{"level":34,"items":[{"kind":"stardust","amount":50},{"kind":"coins","amount":560}]},{"level":35,"items":[{"kind":"food","foods":["monsta_rosa","monsta_peachy"],"pack":"Purrbolt pack"},{"kind":"tickets","amount":6},{"kind":"stardust","amount":200},{"kind":"coins","amount":700}]},{"level":36,"items":[{"kind":"food","foods":["donut_maple_bacon","donut_mochi","donut_sesame","donut_gold_leaf","donut_pizza"],"pack":"Bakery box"},{"kind":"coins","amount":570}]},{"level":37,"items":[{"kind":"food","foods":["monsta_pipeline","monsta_punch","monsta_rosa"],"pack":"Purrbolt pack"},{"kind":"coins","amount":440}]},{"level":38,"items":[{"kind":"coins","amount":760}]},{"level":39,"items":[{"kind":"stardust","amount":50},{"kind":"coins","amount":660}]},{"level":40,"items":[{"kind":"skin","rarity":"epic"},{"kind":"tickets","amount":8},{"kind":"stardust","amount":200},{"kind":"coins","amount":800}]},{"level":41,"items":[{"kind":"food","foods":["roast_chicken","pizza","ramen","cevapi","tacos","lasagna"],"pack":"World dishes"},{"kind":"coins","amount":670}]},{"level":42,"items":[{"kind":"food","foods":["monsta_peachy","monsta_original","monsta_mango","monsta_loco"],"pack":"Purrbolt pack"},{"kind":"coins","amount":440}]},{"level":43,"items":[{"kind":"coins","amount":860}]},{"level":44,"items":[{"kind":"stardust","amount":75},{"kind":"coins","amount":690}]},{"level":45,"items":[{"kind":"food","foods":["monsta_gold"]},{"kind":"tickets","amount":6},{"kind":"stardust","amount":250},{"kind":"coins","amount":900}]},{"level":46,"items":[{"kind":"food","foods":["donut_lavender","donut_biscoff","donut_pistachio","donut_white_choc","donut_vanilla"],"pack":"Bakery box"},{"kind":"coins","amount":770}]},{"level":47,"items":[{"kind":"food","foods":["monsta_loco","monsta_white","monsta_pipeline","monsta_punch"],"pack":"Purrbolt pack"},{"kind":"coins","amount":540}]},{"level":48,"items":[{"kind":"coins","amount":960}]},{"level":49,"items":[{"kind":"stardust","amount":75},{"kind":"coins","amount":790}]},{"level":50,"items":[{"kind":"skin","rarity":"legendary"},{"kind":"tickets","amount":10},{"kind":"stardust","amount":400},{"kind":"coins","amount":1000}]},{"level":51,"items":[{"kind":"food","foods":["nigiri","pad_thai","sarma","paella","gyoza","carbonara"],"pack":"World dishes"},{"kind":"coins","amount":870}]},{"level":52,"items":[{"kind":"food","foods":["monsta_punch","monsta_rosa","monsta_peachy","monsta_original"],"pack":"Purrbolt pack"},{"kind":"coins","amount":640}]},{"level":53,"items":[{"kind":"coins","amount":1060}]},{"level":54,"items":[{"kind":"stardust","amount":75},{"kind":"coins","amount":890}]},{"level":55,"items":[{"kind":"tickets","amount":8},{"kind":"stardust","amount":300},{"kind":"coins","amount":1100}]},{"level":56,"items":[{"kind":"food","foods":["donut_honey","donut_caramel","donut_mint","donut_matcha","donut_blueberry"],"pack":"Bakery box"},{"kind":"coins","amount":970}]},{"level":57,"items":[{"kind":"food","foods":["monsta_original","monsta_mango","monsta_loco","monsta_white"],"pack":"Purrbolt pack"},{"kind":"coins","amount":740}]},{"level":58,"items":[{"kind":"coins","amount":1160}]},{"level":59,"items":[{"kind":"stardust","amount":75},{"kind":"coins","amount":990}]},{"level":60,"items":[{"kind":"skin","rarity":"epic"},{"kind":"tickets","amount":8},{"kind":"stardust","amount":300},{"kind":"coins","amount":1200}]},{"level":61,"items":[{"kind":"food","foods":["temaki","doner","stew","risotto","maki","xiaolongbao"],"pack":"World dishes"},{"kind":"coins","amount":1070}]},{"level":62,"items":[{"kind":"food","foods":["monsta_white","monsta_pipeline","monsta_punch","monsta_rosa"],"pack":"Purrbolt pack"},{"kind":"coins","amount":840}]},{"level":63,"items":[{"kind":"coins","amount":1260}]},{"level":64,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1030}]},{"level":65,"items":[{"kind":"food","foods":["monsta_rainbow"]},{"kind":"tickets","amount":10},{"kind":"stardust","amount":350},{"kind":"coins","amount":1300}]},{"level":66,"items":[{"kind":"food","foods":["donut_red_velvet","donut_mocha","donut_lattice","donut_sakura","donut_hibiscus"],"pack":"Bakery box"},{"kind":"coins","amount":1170}]},{"level":67,"items":[{"kind":"food","foods":["monsta_rosa","monsta_peachy","monsta_original","monsta_mango"],"pack":"Purrbolt pack"},{"kind":"coins","amount":940}]},{"level":68,"items":[{"kind":"coins","amount":1360}]},{"level":69,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1130}]},{"level":70,"items":[{"kind":"skin","rarity":"epic"},{"kind":"tickets","amount":10},{"kind":"stardust","amount":350},{"kind":"coins","amount":1400}]},{"level":71,"items":[{"kind":"food","foods":["wrap","meatballs","roast_chicken","pizza","ramen","cevapi"],"pack":"World dishes"},{"kind":"coins","amount":1270}]},{"level":72,"items":[{"kind":"food","foods":["monsta_mango","monsta_loco","monsta_white","monsta_pipeline","monsta_punch"],"pack":"Purrbolt pack"},{"kind":"coins","amount":940}]},{"level":73,"items":[{"kind":"coins","amount":1460}]},{"level":74,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1230}]},{"level":75,"items":[{"kind":"skin","rarity":"legendary"},{"kind":"tickets","amount":15},{"kind":"stardust","amount":600},{"kind":"coins","amount":1500}]},{"level":76,"items":[{"kind":"food","foods":["donut_black_forest","donut_ube","donut_maple_bacon","donut_mochi","donut_sesame"],"pack":"Bakery box"},{"kind":"coins","amount":1370}]},{"level":77,"items":[{"kind":"food","foods":["monsta_pipeline","monsta_punch","monsta_rosa","monsta_peachy","monsta_original"],"pack":"Purrbolt pack"},{"kind":"coins","amount":1040}]},{"level":78,"items":[{"kind":"coins","amount":1560}]},{"level":79,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1330}]},{"level":80,"items":[{"kind":"tickets","amount":12},{"kind":"stardust","amount":400},{"kind":"coins","amount":1600}]},{"level":81,"items":[{"kind":"food","foods":["tacos","lasagna","nigiri","pad_thai","sarma","paella"],"pack":"World dishes"},{"kind":"coins","amount":1470}]},{"level":82,"items":[{"kind":"food","foods":["monsta_peachy","monsta_original","monsta_mango","monsta_loco","monsta_white"],"pack":"Purrbolt pack"},{"kind":"coins","amount":1140}]},{"level":83,"items":[{"kind":"coins","amount":1660}]},{"level":84,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1430}]},{"level":85,"items":[{"kind":"skin","rarity":"epic"},{"kind":"tickets","amount":12},{"kind":"stardust","amount":450},{"kind":"coins","amount":1700}]},{"level":86,"items":[{"kind":"food","foods":["donut_gold_leaf","donut_pizza","donut_lavender","donut_biscoff","donut_pistachio"],"pack":"Bakery box"},{"kind":"coins","amount":1570}]},{"level":87,"items":[{"kind":"food","foods":["monsta_loco","monsta_white","monsta_pipeline","monsta_punch","monsta_rosa"],"pack":"Purrbolt pack"},{"kind":"coins","amount":1240}]},{"level":88,"items":[{"kind":"coins","amount":1760}]},{"level":89,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1530}]},{"level":90,"items":[{"kind":"food","foods":["monsta_gold","monsta_rainbow"],"pack":"Purrbolt pack"},{"kind":"tickets","amount":15},{"kind":"stardust","amount":500},{"kind":"coins","amount":1800}]},{"level":91,"items":[{"kind":"food","foods":["gyoza","carbonara","temaki","doner","stew","risotto"],"pack":"World dishes"},{"kind":"coins","amount":1670}]},{"level":92,"items":[{"kind":"food","foods":["monsta_punch","monsta_rosa","monsta_peachy","monsta_original","monsta_mango"],"pack":"Purrbolt pack"},{"kind":"coins","amount":1340}]},{"level":93,"items":[{"kind":"coins","amount":1860}]},{"level":94,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1630}]},{"level":95,"items":[{"kind":"tickets","amount":15},{"kind":"stardust","amount":550},{"kind":"coins","amount":1900}]},{"level":96,"items":[{"kind":"food","foods":["donut_white_choc","donut_vanilla","donut_honey","donut_caramel","donut_mint"],"pack":"Bakery box"},{"kind":"coins","amount":1770}]},{"level":97,"items":[{"kind":"food","foods":["monsta_original","monsta_mango","monsta_loco","monsta_white","monsta_pipeline"],"pack":"Purrbolt pack"},{"kind":"coins","amount":1440}]},{"level":98,"items":[{"kind":"coins","amount":1960}]},{"level":99,"items":[{"kind":"stardust","amount":100},{"kind":"coins","amount":1730}]},{"level":100,"items":[{"kind":"skin","rarity":"legendary"},{"kind":"tickets","amount":25},{"kind":"stardust","amount":1000},{"kind":"coins","amount":2500}]}],"skins":[{"id":"shark","rarity":"epic"},{"id":"bear","rarity":"epic"},{"id":"fox","rarity":"epic"},{"id":"penguin","rarity":"epic"},{"id":"bat","rarity":"epic"},{"id":"fish","rarity":"rare"},{"id":"dog","rarity":"rare"},{"id":"chicken","rarity":"rare"},{"id":"chick","rarity":"rare"},{"id":"frog","rarity":"rare"},{"id":"panda","rarity":"rare"},{"id":"owl","rarity":"rare"},{"id":"axolotl","rarity":"rare"},{"id":"sheep","rarity":"rare"},{"id":"raccoon","rarity":"rare"},{"id":"koala","rarity":"rare"},{"id":"otter","rarity":"rare"},{"id":"deer","rarity":"rare"},{"id":"cow","rarity":"rare"},{"id":"mouse","rarity":"legendary"},{"id":"bunny","rarity":"legendary"},{"id":"donut","rarity":"epic"},{"id":"cherry","rarity":"rare"},{"id":"tamale","rarity":"rare"},{"id":"cherry2","rarity":"rare"},{"id":"mochi","rarity":"epic"},{"id":"lemon","rarity":"rare"},{"id":"chocoglaze","rarity":"rare"},{"id":"cottoncandy","rarity":"epic"},{"id":"banana","rarity":"rare"},{"id":"applecandy","rarity":"rare"},{"id":"creamstrawberry","rarity":"legendary"},{"id":"cupcake","rarity":"legendary"},{"id":"strawberry","rarity":"rare"},{"id":"chocolate","rarity":"rare"},{"id":"watermelon","rarity":"epic"},{"id":"croissant","rarity":"rare"},{"id":"macaron","rarity":"epic"},{"id":"boba","rarity":"legendary"},{"id":"lemon2","rarity":"rare"},{"id":"applecandy2","rarity":"epic"},{"id":"bee","rarity":"rare"},{"id":"lobster","rarity":"epic"},{"id":"crystaldragon","rarity":"legendary"},{"id":"snail","rarity":"rare"},{"id":"butterfly","rarity":"epic"},{"id":"turtle","rarity":"rare"},{"id":"octopus","rarity":"epic"},{"id":"peacock","rarity":"legendary"},{"id":"ladybug","rarity":"rare"},{"id":"capybara","rarity":"rare"},{"id":"redpanda","rarity":"epic"},{"id":"jellyfish","rarity":"epic"},{"id":"unicorn","rarity":"legendary"}],"boxDust":{"common":50,"rare":100,"epic":150,"legendary":200},"careIds":["daily_feed","daily_play","daily_sleep","daily_wash"],"gameIds":["memory_match","treat_tumble","flappy_eren","tic_tac_toe","eren_stack","yarn_pop","eren_says","lane_runner","paw_doku","yarn_sort","purr_beat"],"milestones":{"7":50,"14":100,"30":200,"60":400,"100":1000},"freezeDays":14,"freezeMax":2,"freezeDefault":1,"repairCost":500,"repairDays":2}$reward_catalog$::jsonb)
on conflict (singleton) do update set data = excluded.data;

do $$ declare c jsonb; begin
  select data into c from eren_private.reward_catalog where singleton;
  if coalesce(jsonb_array_length(c->'tasks'),0) <> 14 or coalesce(jsonb_array_length(c->'levels'),0) <> 100
    or coalesce(jsonb_array_length(c->'achievements'),0) <> 16 then
    raise exception 'Populate reward catalogue with scripts/build_reward_catalog.cjs --write';
  end if;
end $$;

create or replace function eren_private.reward_profile(p public.profiles)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('coins',p.coins,'xp',p.xp,'level',p.level,'streak',p.streak,
    'achievements',p.achievements,'claimed_level',p.claimed_level);
$$;

create or replace function eren_private.reward_progress(p_uid uuid, p_day date)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'weekly_all_care',count(distinct task_id) filter(where task_id in ('daily_feed','daily_play','daily_sleep','daily_wash')),
    'weekly_mood_5',count(distinct period_key) filter(where task_id='daily_mood'),
    'weekly_all_games',least(3,count(*) filter(where task_id='daily_game')))
  from public.user_task_completions where user_id=p_uid
    and period_key between 'daily:'||(p_day-(extract(isodow from p_day)::int-1))::text
      and 'daily:'||(p_day+(7-extract(isodow from p_day)::int))::text;
$$;

create or replace function eren_private.reward_streak(p_state jsonb, p_day date)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  c jsonb; s jsonb := coalesce(p_state,'{}'); n int; best int; gap int; earned int;
  tokens int; earned_at date; last_day date; frozen boolean := false; broken boolean := false;
  hits jsonb; bonus int;
begin
  select data into c from eren_private.reward_catalog where singleton;
  if s->>'lastDate'=p_day::text then
    return jsonb_build_object('streak',s,'changed',false,'milestones','[]'::jsonb,'milestoneCoins',0,'freezeUsed',false);
  end if;
  tokens := coalesce((s->>'freezeTokens')::int,(c->>'freezeDefault')::int);
  earned_at := coalesce((s->>'lastFreezeEarnedAt')::date,p_day);
  if tokens < (c->>'freezeMax')::int then
    earned := floor((p_day-earned_at)::numeric/(c->>'freezeDays')::int);
    if earned>0 then
      tokens := least((c->>'freezeMax')::int,tokens+earned);
      earned_at := earned_at+earned*(c->>'freezeDays')::int;
    end if;
  end if;
  last_day := (s->>'lastDate')::date;
  n := coalesce((s->>'current')::int,0);
  if last_day is null or n=0 then n:=1;
  else
    gap := p_day-last_day;
    if gap=1 then n:=n+1;
    elsif gap=2 and tokens>0 then n:=n+1; tokens:=tokens-1; frozen:=true;
    else broken:=n>0; n:=1;
    end if;
  end if;
  best := greatest(coalesce((s->>'best')::int,0),n);
  select coalesce(jsonb_agg(key::int order by key::int),'[]'::jsonb),coalesce(sum(value::int),0)
    into hits,bonus from jsonb_each_text(c->'milestones')
    where key::int<=n and coalesce((s->>'current')::int,0)<key::int;
  return jsonb_build_object('streak',jsonb_build_object('current',n,'best',best,'lastDate',p_day,
    'freezeTokens',tokens,'lastFreezeEarnedAt',earned_at)
    ||case when broken then jsonb_build_object('priorCurrent',coalesce((s->>'current')::int,0),'brokenAt',p_day) else '{}'::jsonb end,
    'changed',true,'milestones',hits,'milestoneCoins',bonus,'freezeUsed',frozen);
end;
$$;

-- Only stored facts are used for achievement eligibility. Client score/coin totals are not accepted.
create or replace function eren_private.reward_achievements(p public.profiles, p_triggers text[], p_day date)
returns jsonb language plpgsql stable set search_path = '' as $$
declare c jsonb; a jsonb; hits jsonb:='[]'; yes boolean; s public.eren_stats%rowtype; total int;
begin
  select data into c from eren_private.reward_catalog where singleton;
  select * into s from public.eren_stats where household_id=p.household_id;
  for a in select value from jsonb_array_elements(c->'achievements') loop
    if coalesce(p.achievements,'{}'::jsonb) ? (a->>'id')
      or not exists(select 1 from jsonb_array_elements_text(a->'triggers') t where t=any(p_triggers)) then continue; end if;
    yes:=false;
    case a->>'id'
      when 'first_care' then select exists(select 1 from public.user_task_completions where user_id=p.id and task_id in ('daily_feed','daily_play','daily_sleep','daily_wash')) into yes;
      when 'all_care_day' then select count(distinct task_id)=4 into yes from public.user_task_completions where user_id=p.id and period_key='daily:'||p_day::text and task_id in ('daily_feed','daily_play','daily_sleep','daily_wash');
      when 'care_100' then select count(*)>=100 into yes from public.user_task_completions where user_id=p.id and task_id in ('daily_feed','daily_play','daily_sleep','daily_wash');
      when 'clean_sweep' then yes:=s.happiness>80 and s.hunger>80 and s.energy>80 and s.sleep_quality>80 and s.cleanliness>80;
      when 'streak_7' then yes:=coalesce((p.streak->>'current')::int,0)>=7;
      when 'streak_30' then yes:=coalesce((p.streak->>'current')::int,0)>=30;
      when 'streak_100' then yes:=coalesce((p.streak->>'current')::int,0)>=100;
      when 'first_game' then select exists(select 1 from public.user_task_completions where user_id=p.id and task_id='daily_game') into yes;
      when 'high_score_50' then select exists(select 1 from public.game_scores where user_id=p.id and score>=50) into yes;
      when 'all_games' then select not exists(select 1 from jsonb_array_elements_text(c->'gameIds') g where not exists(select 1 from public.game_scores where user_id=p.id and game_type=g)) into yes;
      when 'level_10' then yes:=p.level>=10;
      when 'level_25' then yes:=p.level>=25;
      when 'level_50' then yes:=p.level>=50;
      when 'battle_win' then select exists(select 1 from public.daily_battle_results where user_id=p.id and outcome='win') into yes;
      when 'first_nudge' then select exists(select 1 from public.user_task_completions where user_id=p.id and task_id='daily_nudge') into yes;
      when 'mood_7' then
        select count(distinct date)=7 and max(date)-min(date)=6 into yes from
          (select date from public.daily_moods where user_id=p.id order by date desc limit 7) m;
      else yes:=false;
    end case;
    if coalesce(yes,false) then hits:=hits||jsonb_build_array(a->>'id'); end if;
  end loop;
  return hits;
end;
$$;

create or replace function public.claim_reward_atomic(p_request_id uuid,p_kind text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid:=auth.uid(); p public.profiles%rowtype; st public.user_gacha_state%rowtype; fridge public.eren_stats%rowtype;
  receipt eren_private.economy_receipts%rowtype; c jsonb; task jsonb; todo text[]; task_id text;
  day date; zone text; period_key text; progress jsonb; changed int; delta int; old_level int;
  result jsonb; outcome jsonb:=jsonb_build_object('tasks','[]'::jsonb,'achievements','[]'::jsonb);
  streak_result jsonb; triggers text[]:='{}'; ids jsonb; aid text; achievement jsonb;
  target int; from_level int; reward jsonb; item jsonb; k text; mine jsonb; food jsonb;
  skins jsonb:='[]'; converted jsonb:='[]'; foods jsonb:='[]'; boxes jsonb:='[]'; rarity text; pick text;
  paid_coins int:=0; dust int:=0; tickets int:=0; box_dust int:=0; inserted int;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated'); end if;
  if p_request_id is null or p_kind is null or p_kind not in ('task','achievement','repair','road','wallet')
    or p_input is null or jsonb_typeof(p_input)<>'object' then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile'); end if;
  if p_kind='road' and (p.household_id is null or p_input->>'householdId' is distinct from p.household_id::text) then
    return jsonb_build_object('ok',false,'reason','household_changed');
  end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.operation<>'reward:'||p_kind or receipt.input<>p_input then return jsonb_build_object('ok',false,'reason','request_mismatch'); end if;
    return receipt.result||jsonb_build_object('profile',eren_private.reward_profile(p));
  end if;
  select data into c from eren_private.reward_catalog where singleton;
  old_level:=p.level;
  if p_kind in ('task','achievement','repair') then
    zone:=p_input->>'timeZone';
    if zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone)
      or coalesce(p_input->>'day','')!~'^\d{4}-\d{2}-\d{2}$' then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
    day:=(p_input->>'day')::date;
    if day<>(clock_timestamp() at time zone zone)::date then return jsonb_build_object('ok',false,'reason','period_changed'); end if;
  end if;

  if p_kind='wallet' then
    if jsonb_typeof(p_input->'amount') is distinct from 'number' or (p_input->>'amount')!~'^-?\d+$' then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
    delta:=(p_input->>'amount')::int;
    if abs(delta::bigint)>1000000 then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
    if coalesce(p.coins,0)::bigint+delta<0 then return jsonb_build_object('ok',false,'reason','insufficient'); end if;
    p.coins:=coalesce(p.coins,0)+delta;
    outcome:=outcome||jsonb_build_object('walletDelta',delta);
  elsif p_kind='task' then
    task_id:=p_input->>'taskId';
    select value into task from jsonb_array_elements(c->'tasks') where value->>'id'=task_id;
    if task is null then return jsonb_build_object('ok',false,'reason','bad_task'); end if;
    progress:=eren_private.reward_progress(uid,day);
    if task->>'period'='weekly' and task->>'maxProgress' is not null
      and coalesce((progress->>task_id)::int,0)<(task->>'maxProgress')::int then return jsonb_build_object('ok',false,'reason','not_eligible'); end if;
    todo:=array[task_id];
    -- Re-evaluate automatic weekly thresholds after inserting the daily source.
    for i in 1..4 loop
      exit when i>coalesce(array_length(todo,1),0);
      task_id:=todo[i];
      select value into task from jsonb_array_elements(c->'tasks') where value->>'id'=task_id;
      period_key:=case task->>'period' when 'daily' then 'daily:'||day::text else 'weekly:'||to_char(day,'IYYY-"W"IW') end;
      insert into public.user_task_completions(user_id,task_id,period_key,coins_earned,xp_earned)
        values(uid,task_id,period_key,(task->>'coins')::int,(task->>'xp')::int) on conflict do nothing;
      get diagnostics changed=row_count;
      if changed=1 then
        p.coins:=coalesce(p.coins,0)+(task->>'coins')::int; p.xp:=coalesce(p.xp,0)+(task->>'xp')::int;
        outcome:=jsonb_set(outcome,'{tasks}',outcome->'tasks'||jsonb_build_array(task||jsonb_build_object('periodKey',period_key)));
        if task->>'period'='daily' then
          streak_result:=eren_private.reward_streak(p.streak,day);
          p.streak:=streak_result->'streak'; p.coins:=p.coins+(streak_result->>'milestoneCoins')::int;
          if (streak_result->>'changed')::boolean then outcome:=outcome||streak_result-'streak'-'changed'; triggers:=array_append(triggers,'streak'); end if;
          if task_id=any(array['daily_feed','daily_play','daily_sleep','daily_wash']) then triggers:=array_append(triggers,'care');
          elsif task_id='daily_game' then triggers:=array_append(triggers,'game');
          elsif task_id='daily_mood' then triggers:=array_append(triggers,'mood');
          elsif task_id='daily_nudge' then triggers:=array_append(triggers,'nudge'); end if;
        end if;
      end if;
      if i=1 and task->>'period'='daily' then
        progress:=eren_private.reward_progress(uid,day);
        for reward in select value from jsonb_array_elements(c->'tasks') where value->>'period'='weekly' and value->>'maxProgress' is not null loop
          if (progress->>(reward->>'id'))::int >= (reward->>'maxProgress')::int then todo:=array_append(todo,reward->>'id'); end if;
        end loop;
      end if;
    end loop;
    p.level:=greatest(1,p.level);
    while (p.level::bigint*(p.level+1)/2)*100<=p.xp loop p.level:=p.level+1; end loop;
    if p.level>old_level then triggers:=array_append(triggers,'level'); end if;
  elsif p_kind='achievement' then
    if p_input->>'trigger' is null or p_input->>'trigger' not in ('care','game','level','streak','battle','mood','mount','nudge') then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
    triggers:=array[p_input->>'trigger'];
  elsif p_kind='repair' then
    if coalesce((p.streak->>'priorCurrent')::int,0)<=0 or p.streak->>'brokenAt' is null
      or day-(p.streak->>'brokenAt')::date not between 0 and (c->>'repairDays')::int then return jsonb_build_object('ok',false,'reason','not_eligible'); end if;
    if coalesce(p.coins,0)<(c->>'repairCost')::int then return jsonb_build_object('ok',false,'reason','insufficient'); end if;
    p.coins:=p.coins-(c->>'repairCost')::int;
    p.streak:=(p.streak-'priorCurrent'-'brokenAt')||jsonb_build_object('current',(p.streak->>'priorCurrent')::int+1,
      'best',greatest((p.streak->>'best')::int,(p.streak->>'priorCurrent')::int+1),'lastDate',day);
    outcome:=outcome||jsonb_build_object('repaired',true,'streakCount',p.streak->'current');
  elsif p_kind='road' then
    if jsonb_typeof(p_input->'target') is distinct from 'number' or (p_input->>'target')!~'^\d+$' then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
    target:=(p_input->>'target')::int;
    if target<1 or target>100 or target>p.level then return jsonb_build_object('ok',false,'reason','not_eligible'); end if;
    if target>coalesce(p.claimed_level,0) then
      from_level:=coalesce(p.claimed_level,0)+1;
      for reward in select value from jsonb_array_elements(c->'levels') where (value->>'level')::int between from_level and target order by (value->>'level')::int loop
        for item in select value from jsonb_array_elements(reward->'items') loop
          case item->>'kind'
            when 'coins' then paid_coins:=paid_coins+(item->>'amount')::int;
            when 'stardust' then dust:=dust+(item->>'amount')::int;
            when 'tickets' then tickets:=tickets+(item->>'amount')::int;
            when 'food' then foods:=foods||(item->'foods');
            when 'skin' then boxes:=boxes||jsonb_build_array(item->>'rarity');
            else raise exception 'Unknown reward catalogue item';
          end case;
        end loop;
      end loop;
      -- Match food/gacha lock order: wallet -> gacha state -> shared fridge.
      if dust>0 or tickets>0 or jsonb_array_length(boxes)>0 then
        select * into st from public.user_gacha_state where user_id=uid for update;
      end if;
      if jsonb_array_length(foods)>0 or jsonb_array_length(boxes)>0 then
        select * into fridge from public.eren_stats where household_id=p.household_id for update;
        if not found then return jsonb_build_object('ok',false,'reason','no_fridge'); end if;
      end if;
      if jsonb_array_length(foods)>0 then
        food:=coalesce(fridge.food_by_user,'{}'); mine:=coalesce(food->uid::text,'{}');
        for k in select jsonb_array_elements_text(foods) loop
          if not exists(select 1 from eren_private.food_keys where food_key=k) then raise exception 'Unknown reward food'; end if;
          mine:=jsonb_set(mine,array[k],to_jsonb(coalesce((mine->>k)::int,0)+1),true);
        end loop;
        update public.eren_stats set food_by_user=jsonb_set(food,array[uid::text],mine,true) where household_id=p.household_id;
      end if;
      for rarity in select jsonb_array_elements_text(boxes) loop
        loop
          select value->>'id' into pick from jsonb_array_elements(c->'skins') candidate
            where value->>'rarity'=rarity and not exists(select 1 from public.user_inventory inv
              join public.profiles member on member.id=inv.user_id where member.household_id=p.household_id and inv.item_id='skin_'||(value->>'id'))
            order by random() limit 1;
          if pick is null then converted:=converted||jsonb_build_array(rarity); box_dust:=box_dust+(c->'boxDust'->>rarity)::int; exit; end if;
          insert into public.user_inventory(user_id,item_id,quantity,equipped) values(uid,'skin_'||pick,1,false)
            on conflict(user_id,item_id) do nothing;
          get diagnostics inserted=row_count;
          if inserted=1 then skins:=skins||jsonb_build_array(pick); exit; end if;
        end loop;
      end loop;
      if dust+box_dust>0 or tickets>0 then
        insert into public.user_gacha_state(user_id,stardust,gacha_tickets) values(uid,dust+box_dust,tickets)
          on conflict(user_id) do update set stardust=public.user_gacha_state.stardust+excluded.stardust,
            gacha_tickets=public.user_gacha_state.gacha_tickets+excluded.gacha_tickets;
      end if;
      p.coins:=coalesce(p.coins,0)+paid_coins; p.claimed_level:=target;
      outcome:=outcome||jsonb_build_object('road',jsonb_build_object('from',from_level,'to',target,'coins',paid_coins,
        'stardust',dust+box_dust,'tickets',tickets,'foods',foods,'skinIds',skins,'boxDust',box_dust,'converted',converted));
    end if;
  end if;

  if coalesce(array_length(triggers,1),0)>0 then
    ids:=eren_private.reward_achievements(p,triggers,day);
    for aid in select jsonb_array_elements_text(ids) loop
      select value into achievement from jsonb_array_elements(c->'achievements') where value->>'id'=aid;
      p.achievements:=coalesce(p.achievements,'{}')||jsonb_build_object(aid,clock_timestamp());
      p.coins:=p.coins+(achievement->>'coins')::int;
    end loop;
    outcome:=jsonb_set(outcome,'{achievements}',ids);
  end if;
  outcome:=outcome||jsonb_build_object('levelUp',p.level>old_level,'levelReached',p.level);
  update public.profiles set coins=p.coins,xp=p.xp,level=p.level,streak=p.streak,
    achievements=p.achievements,claimed_level=p.claimed_level where id=uid returning * into p;
  result:=jsonb_build_object('ok',true,'outcome',outcome);
  insert into eren_private.economy_receipts(user_id,request_id,operation,input,result)
    values(uid,p_request_id,'reward:'||p_kind,p_input,result);
  return result||jsonb_build_object('profile',eren_private.reward_profile(p));
end;
$$;

revoke all on function eren_private.reward_profile(public.profiles) from public,anon,authenticated;
revoke all on function eren_private.reward_progress(uuid,date) from public,anon,authenticated;
revoke all on function eren_private.reward_streak(jsonb,date) from public,anon,authenticated;
revoke all on function eren_private.reward_achievements(public.profiles,text[],date) from public,anon,authenticated;
revoke all on function public.claim_reward_atomic(uuid,text,jsonb) from public,anon;
grant execute on function public.claim_reward_atomic(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
