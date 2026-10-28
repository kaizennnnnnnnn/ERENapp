-- Run manually in the Supabase SQL editor before deploying the new clients.
-- Safe to re-run. No existing food, coins, skins or pity counters are reset.
-- Generated catalogue blocks: node scripts/build_economy_catalog.cjs --write
begin;

create schema if not exists eren_private;
revoke all on schema eren_private from public, anon, authenticated;

create table if not exists eren_private.economy_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create table if not exists eren_private.gacha_catalog (
  banner_id text not null,
  item_id text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  food_key text,
  primary key (banner_id, item_id)
);
create table if not exists eren_private.food_keys (food_key text primary key);
alter table eren_private.economy_receipts enable row level security;
alter table eren_private.gacha_catalog enable row level security;
alter table eren_private.food_keys enable row level security;
revoke all on all tables in schema eren_private from public, anon, authenticated;

delete from eren_private.gacha_catalog;
insert into eren_private.gacha_catalog (banner_id, item_id, rarity, food_key)
select banner_id, item_id, rarity, food_key
from jsonb_to_recordset($gacha_catalog$[
  {
    "banner_id": "food",
    "item_id": "cons_monsta_original",
    "rarity": "rare",
    "food_key": "monsta_original"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_white",
    "rarity": "common",
    "food_key": "monsta_white"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_mango",
    "rarity": "rare",
    "food_key": "monsta_mango"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_loco",
    "rarity": "rare",
    "food_key": "monsta_loco"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_pipeline",
    "rarity": "rare",
    "food_key": "monsta_pipeline"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_punch",
    "rarity": "rare",
    "food_key": "monsta_punch"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_rosa",
    "rarity": "epic",
    "food_key": "monsta_rosa"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_peachy",
    "rarity": "epic",
    "food_key": "monsta_peachy"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_rainbow",
    "rarity": "legendary",
    "food_key": "monsta_rainbow"
  },
  {
    "banner_id": "food",
    "item_id": "cons_monsta_gold",
    "rarity": "legendary",
    "food_key": "monsta_gold"
  },
  {
    "banner_id": "food",
    "item_id": "cons_donut_tiger",
    "rarity": "rare",
    "food_key": "donut_tiger"
  },
  {
    "banner_id": "food",
    "item_id": "cons_donut_arcade",
    "rarity": "epic",
    "food_key": "donut_arcade"
  },
  {
    "banner_id": "food",
    "item_id": "cons_donut_neon",
    "rarity": "epic",
    "food_key": "donut_neon"
  },
  {
    "banner_id": "animal",
    "item_id": "skin_shark",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_bear",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_fox",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_penguin",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_bat",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_fish",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_dog",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_chicken",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_chick",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_frog",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_panda",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_owl",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_axolotl",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_sheep",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_raccoon",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_koala",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_otter",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_deer",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_cow",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_mouse",
    "rarity": "legendary",
    "food_key": null
  },
  {
    "banner_id": "animal",
    "item_id": "skin_bunny",
    "rarity": "legendary",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_donut",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_cherry",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_tamale",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_cherry2",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_mochi",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_lemon",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_chocoglaze",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_cottoncandy",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_banana",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_applecandy",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_creamstrawberry",
    "rarity": "legendary",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_cupcake",
    "rarity": "legendary",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_strawberry",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_chocolate",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_watermelon",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_croissant",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_macaron",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_boba",
    "rarity": "legendary",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_lemon2",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "foodsuits",
    "item_id": "skin_applecandy2",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_bee",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_lobster",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_crystaldragon",
    "rarity": "legendary",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_snail",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_butterfly",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_turtle",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_octopus",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_peacock",
    "rarity": "legendary",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_ladybug",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_capybara",
    "rarity": "rare",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_redpanda",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_jellyfish",
    "rarity": "epic",
    "food_key": null
  },
  {
    "banner_id": "creatures",
    "item_id": "skin_unicorn",
    "rarity": "legendary",
    "food_key": null
  }
]$gacha_catalog$::jsonb)
as item(banner_id text, item_id text, rarity text, food_key text);
delete from eren_private.food_keys;
insert into eren_private.food_keys select jsonb_array_elements_text($food_keys$["kibble","fish","treat","tuna","steak","cream","biscuit","shrimp","salmon","chicken","sausage","milk","cheese","yogurt","cake","sushi","sardine","egg","cookie","jelly_caka","pizza","carbonara","lasagna","risotto","nigiri","temaki","maki","ramen","pad_thai","gyoza","xiaolongbao","cevapi","sarma","doner","tacos","wrap","paella","stew","meatballs","roast_chicken","monsta_original","monsta_white","monsta_mango","monsta_loco","monsta_pipeline","monsta_punch","monsta_rosa","monsta_peachy","monsta_rainbow","monsta_gold","cake_strawberry","cake_chocolate","cake_vanilla","cake_matcha","cake_blueberry","cake_macaron","cake_tiramisu","cake_royal","cake_honey_hive","cake_moonbeam","cake_moss_cottage","cake_lily_pond","donut","donut_choco","donut_vanilla","donut_honey","donut_caramel","donut_mint","donut_matcha","donut_blueberry","donut_red_velvet","donut_mocha","donut_lattice","donut_sakura","donut_hibiscus","donut_black_forest","donut_ube","donut_maple_bacon","donut_mochi","donut_sesame","donut_gold_leaf","donut_pizza","donut_lavender","donut_biscoff","donut_pistachio","donut_white_choc","donut_tiger","donut_arcade","donut_neon"]$food_keys$::jsonb);

-- The only privileged paths. Callers cannot choose a user, price, roll, reward
-- or balance. Private receipts and catalogue cannot be forged through REST.
create or replace function public.pull_gacha_atomic(
  p_request_id uuid, p_banner_id text, p_count integer, p_use_ticket boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_state public.user_gacha_state%rowtype;
  v_input jsonb := jsonb_build_object('banner', p_banner_id, 'count', p_count, 'ticket', p_use_ticket);
  v_receipt eren_private.economy_receipts%rowtype;
  v_food jsonb;
  v_mine jsonb;
  v_item eren_private.gacha_catalog%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_rarities text[] := array['common', 'rare', 'epic', 'legendary'];
  v_tier integer;
  v_roll double precision;
  v_rarity text;
  v_pity boolean;
  v_quantity integer;
  v_new boolean;
  v_dust integer;
  v_cost integer;
  v_i integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'unauthenticated'); end if;
  if p_request_id is null or p_count is null or p_count not in (1, 10)
     or p_use_ticket is null or (p_use_ticket and p_count <> 1) then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  if not exists (select 1 from eren_private.gacha_catalog where banner_id = p_banner_id) then
    return jsonb_build_object('ok', false, 'reason', 'bad_banner');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_request_id::text, 0));
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into v_receipt from eren_private.economy_receipts where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_receipt.operation <> 'gacha' or v_receipt.input <> v_input then
      return jsonb_build_object('ok', false, 'reason', 'request_mismatch');
    end if;
    return v_receipt.result || jsonb_build_object('coins', v_profile.coins, 'state',
      (select to_jsonb(s) from public.user_gacha_state s where user_id = v_uid));
  end if;

  -- Keep the same lock order for every gacha: wallet, pity, then fridge.
  insert into public.user_gacha_state(user_id) values (v_uid) on conflict do nothing;
  select * into v_state from public.user_gacha_state where user_id = v_uid for update;
  v_cost := case when p_use_ticket then 0 when p_count = 10 then 450 else 50 end;
  if p_use_ticket and v_state.gacha_tickets < 1 then
    return jsonb_build_object('ok', false, 'reason', 'no_ticket');
  end if;
  if coalesce(v_profile.coins, 0) < v_cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient');
  end if;
  if exists (select 1 from eren_private.gacha_catalog where banner_id = p_banner_id and food_key is not null) then
    select coalesce(food_by_user, '{}'::jsonb) into v_food from public.eren_stats
    where household_id = v_profile.household_id for update;
    if not found then return jsonb_build_object('ok', false, 'reason', 'no_fridge'); end if;
    v_mine := coalesce(v_food -> v_uid::text, '{}'::jsonb);
  end if;

  for v_i in 1..p_count loop
    v_roll := random() * 100;
    v_rarity := case
      when v_state.pulls_since_legendary >= 99 then 'legendary'
      when v_state.pulls_since_epic >= 29 then 'epic'
      when v_roll < 3 then 'legendary'
      when v_roll < 15 then 'epic'
      when v_roll < 40 then 'rare'
      else 'common' end;
    if p_count = 10 and v_i = 10 and v_rarity = 'common' then v_rarity := 'rare'; end if;
    v_pity := (v_rarity = 'epic' and v_state.pulls_since_epic >= 29)
      or (v_rarity = 'legendary' and v_state.pulls_since_legendary >= 99);
    -- Tier escalation matches rollItem; pity tracks the original roll.
    v_tier := array_position(v_rarities, v_rarity);
    select * into v_item from eren_private.gacha_catalog
    where banner_id = p_banner_id and array_position(v_rarities, rarity) >= v_tier
    order by array_position(v_rarities, rarity), random() limit 1;
    if not found then raise exception 'No reward at or above rolled tier'; end if;

    insert into public.user_inventory(user_id, item_id, quantity, equipped)
    values (v_uid, v_item.item_id, 1, false)
    on conflict (user_id, item_id) do nothing
    returning quantity into v_quantity;
    v_new := found;
    if not v_new then
      update public.user_inventory set quantity = quantity + 1
      where user_id = v_uid and item_id = v_item.item_id returning quantity into v_quantity;
    end if;
    v_dust := case when v_new or v_item.food_key is not null then 0
      when v_item.rarity = 'legendary' then 200 when v_item.rarity = 'epic' then 50
      when v_item.rarity = 'rare' then 15 else 5 end;
    if v_item.food_key is not null then
      v_mine := jsonb_set(v_mine, array[v_item.food_key], to_jsonb(coalesce((v_mine ->> v_item.food_key)::integer, 0) + 1), true);
    end if;
    v_state.total_pulls := v_state.total_pulls + 1;
    v_state.pulls_since_epic := case when v_rarity in ('epic', 'legendary') then 0 else v_state.pulls_since_epic + 1 end;
    v_state.pulls_since_legendary := case when v_rarity = 'legendary' then 0 else v_state.pulls_since_legendary + 1 end;
    v_state.stardust := v_state.stardust + v_dust;
    insert into public.gacha_pull_log(user_id, banner_id, item_id, rarity, pull_number)
    values (v_uid, p_banner_id, v_item.item_id, v_rarity, v_state.total_pulls);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'itemId', v_item.item_id, 'isNew', v_new, 'stardustGained', v_dust, 'isPity', v_pity));
  end loop;

  if v_food is not null then
    update public.eren_stats set food_by_user = jsonb_set(v_food, array[v_uid::text], v_mine, true)
    where household_id = v_profile.household_id;
  end if;
  update public.profiles set coins = coalesce(coins, 0) - v_cost where id = v_uid returning * into v_profile;
  update public.user_gacha_state set
    total_pulls = v_state.total_pulls, pulls_since_epic = v_state.pulls_since_epic,
    pulls_since_legendary = v_state.pulls_since_legendary, stardust = v_state.stardust,
    gacha_tickets = gacha_tickets - case when p_use_ticket then 1 else 0 end
  where user_id = v_uid returning * into v_state;
  v_result := jsonb_build_object('ok', true, 'results', v_results, 'coins', v_profile.coins, 'state', to_jsonb(v_state));
  insert into eren_private.economy_receipts(user_id, request_id, operation, input, result)
  values (v_uid, p_request_id, 'gacha', v_input, v_result);
  return v_result;
end;
$$;

create or replace function public.mutate_fridge_atomic(
  p_request_id uuid, p_action text, p_foods jsonb, p_recipient_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_food jsonb;
  v_shared jsonb;
  v_mine jsonb;
  v_recipient jsonb;
  v_key text;
  v_count integer;
  v_input jsonb := jsonb_build_object('action', p_action, 'foods', p_foods, 'recipient', p_recipient_id);
  v_receipt eren_private.economy_receipts%rowtype;
  v_result jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'unauthenticated'); end if;
  if p_request_id is null or p_action is null or p_action not in ('add', 'consume', 'gift')
     or p_foods is null or jsonb_typeof(p_foods) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  if jsonb_array_length(p_foods) not between 1 and 100
     or (p_action <> 'add' and jsonb_array_length(p_foods) <> 1)
     or exists (select 1 from jsonb_array_elements(p_foods) f
       where jsonb_typeof(f) <> 'string' or not exists (
         select 1 from eren_private.food_keys k where k.food_key = f #>> '{}')) then
    return jsonb_build_object('ok', false, 'reason', 'bad_food');
  end if;
  select household_id into v_household from public.profiles where id = v_uid;
  if v_household is null then return jsonb_build_object('ok', false, 'reason', 'no_household'); end if;
  if p_action = 'gift' and (p_recipient_id is null or p_recipient_id = v_uid or not exists (
    select 1 from public.profiles where id = p_recipient_id and household_id = v_household
  )) then return jsonb_build_object('ok', false, 'reason', 'bad_recipient'); end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_request_id::text, 0));
  select coalesce(food_by_user, '{}'::jsonb), coalesce(food_inventory, '{}'::jsonb) into v_food, v_shared
  from public.eren_stats where household_id = v_household for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_fridge'); end if;
  select * into v_receipt from eren_private.economy_receipts where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_receipt.operation <> 'fridge' or v_receipt.input <> v_input then
      return jsonb_build_object('ok', false, 'reason', 'request_mismatch');
    end if;
    return jsonb_build_object('ok', true, 'household_id', v_household, 'food_by_user', v_food, 'food_inventory', v_shared);
  end if;
  v_mine := coalesce(v_food -> v_uid::text, '{}'::jsonb);
  for v_key in select jsonb_array_elements_text(p_foods) loop
    v_count := coalesce((v_mine ->> v_key)::integer, 0);
    if p_action = 'add' then
      v_mine := jsonb_set(v_mine, array[v_key], to_jsonb(v_count + 1), true);
    elsif v_count > 0 then
      v_mine := jsonb_set(v_mine, array[v_key], to_jsonb(v_count - 1), true);
    elsif p_action = 'consume' and coalesce((v_shared ->> v_key)::integer, 0) > 0 then
      v_shared := jsonb_set(v_shared, array[v_key], to_jsonb((v_shared ->> v_key)::integer - 1), true);
    else
      return jsonb_build_object('ok', false, 'reason', 'out_of_stock');
    end if;
    if p_action = 'gift' then
      v_recipient := coalesce(v_food -> p_recipient_id::text, '{}'::jsonb);
      v_recipient := jsonb_set(v_recipient, array[v_key], to_jsonb(coalesce((v_recipient ->> v_key)::integer, 0) + 1), true);
      v_food := jsonb_set(v_food, array[p_recipient_id::text], v_recipient, true);
    end if;
  end loop;
  v_food := jsonb_set(v_food, array[v_uid::text], v_mine, true);
  update public.eren_stats set food_by_user = v_food, food_inventory = v_shared where household_id = v_household;
  v_result := jsonb_build_object('ok', true, 'household_id', v_household, 'food_by_user', v_food, 'food_inventory', v_shared);
  insert into eren_private.economy_receipts(user_id, request_id, operation, input, result)
  values (v_uid, p_request_id, 'fridge', v_input, v_result);
  return v_result;
end;
$$;

revoke all on function public.pull_gacha_atomic(uuid, text, integer, boolean) from public, anon;
revoke all on function public.mutate_fridge_atomic(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.pull_gacha_atomic(uuid, text, integer, boolean) to authenticated;
grant execute on function public.mutate_fridge_atomic(uuid, text, jsonb, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
