-- Apply manually after migration_economy_reliability.sql and the food migrations.
-- Populate the generated block: node scripts/build_food_action_catalog.cjs --write
-- Re-runnable; never resets wallets, food, collections, receipts or gacha counters.
begin;

do $dependencies$
declare
  v_missing text;
begin
  select string_agg(d.rel || '.' || d.col, ', ' order by d.rel, d.col) into v_missing
  from (values
    ('public.profiles', 'id'), ('public.profiles', 'household_id'), ('public.profiles', 'coins'),
    ('public.eren_stats', 'household_id'), ('public.eren_stats', 'food_by_user'),
    ('public.eren_stats', 'food_inventory'), ('public.eren_stats', 'hunger'),
    ('public.eren_stats', 'happiness'), ('public.eren_stats', 'energy'),
    ('public.eren_stats', 'sleep_quality'), ('public.eren_stats', 'cleanliness'),
    ('public.eren_stats', 'weight'), ('public.eren_stats', 'is_sick'),
    ('public.eren_stats', 'is_sleeping'), ('public.eren_stats', 'mood'),
    ('public.eren_stats', 'last_decay_at'), ('public.eren_stats', 'updated_at'),
    ('public.eren_stats', 'donuts_tasted'), ('public.eren_stats', 'donut_effect'),
    ('public.user_gacha_state', 'user_id'), ('public.user_gacha_state', 'last_free_donut'),
    ('public.user_inventory', 'user_id'), ('public.user_inventory', 'item_id'),
    ('public.user_inventory', 'quantity'), ('public.user_inventory', 'equipped'),
    ('public.interactions', 'household_id'), ('public.interactions', 'user_id'),
    ('public.interactions', 'action_type'), ('public.interactions', 'happiness_delta'),
    ('public.interactions', 'hunger_delta'), ('public.interactions', 'energy_delta'),
    ('public.interactions', 'sleep_delta'), ('public.interactions', 'weight_delta'),
    ('public.interactions', 'useful'), ('public.interactions', 'created_at'),
    ('eren_private.economy_receipts', 'user_id'), ('eren_private.economy_receipts', 'request_id'),
    ('eren_private.economy_receipts', 'operation'), ('eren_private.economy_receipts', 'input'),
    ('eren_private.economy_receipts', 'result'), ('eren_private.food_keys', 'food_key')
  ) as d(rel, col)
  where not exists (select 1 from pg_catalog.pg_attribute a
    where a.attrelid = to_regclass(d.rel) and a.attname = d.col and not a.attisdropped);
  if v_missing is not null then
    raise exception 'Food actions require existing migrations; missing: %', v_missing;
  end if;
  if to_regprocedure('public.pull_gacha_atomic(uuid,text,integer,boolean)') is null then
    raise exception 'Food actions require migration_economy_reliability.sql first';
  end if;
end;
$dependencies$;

create table if not exists eren_private.food_action_catalog (
  -- No FK: the economy migration refreshes food_keys with DELETE + INSERT.
  food_key text primary key,
  price integer not null check (price > 0),
  kitchen boolean not null,
  bakery boolean not null,
  machine boolean not null,
  hunger numeric not null,
  happiness numeric not null,
  weight numeric not null,
  energy numeric,
  sleep_quality numeric not null default 0,
  cleanliness numeric not null default 0,
  cure boolean not null,
  coins integer not null check (coins >= 0),
  donut boolean not null,
  effect text,
  effect_ms integer,
  skin text,
  check (not machine or donut),
  check ((effect is null and effect_ms is null) or (effect is not null and effect_ms is not null and effect_ms > 0)),
  check (skin is null or (skin <> '' and left(skin, 5) <> 'skin_'))
);
alter table eren_private.food_action_catalog enable row level security;
revoke all on schema eren_private from public, anon, authenticated;
revoke all on eren_private.food_action_catalog from public, anon, authenticated;

insert into eren_private.food_action_catalog
select food_key, price, kitchen, bakery, machine, hunger, happiness, weight, energy,
  coalesce(sleep_quality, 0), coalesce(cleanliness, 0), cure, coins, donut, effect, effect_ms, skin
from jsonb_to_recordset($food_action_catalog$[
  {
    "food_key": "kibble",
    "price": 5,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 15,
    "happiness": 0,
    "weight": 0.03,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "treat",
    "price": 8,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 8,
    "happiness": 20,
    "weight": 0.01,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "biscuit",
    "price": 6,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 12,
    "happiness": 0,
    "weight": 0.02,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "fish",
    "price": 12,
    "kitchen": false,
    "bakery": false,
    "machine": false,
    "hunger": 25,
    "happiness": 0,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "tuna",
    "price": 18,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 30,
    "happiness": 0,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "shrimp",
    "price": 15,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 20,
    "happiness": 0,
    "weight": 0.03,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "salmon",
    "price": 22,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 35,
    "happiness": 0,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "sardine",
    "price": 10,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 18,
    "happiness": 0,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "sushi",
    "price": 25,
    "kitchen": false,
    "bakery": false,
    "machine": false,
    "hunger": 28,
    "happiness": 0,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "steak",
    "price": 30,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 40,
    "happiness": 0,
    "weight": 0.1,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "chicken",
    "price": 14,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 28,
    "happiness": 0,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "sausage",
    "price": 12,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 22,
    "happiness": 0,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cream",
    "price": 10,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 10,
    "happiness": 30,
    "weight": 0.02,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "milk",
    "price": 6,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 12,
    "happiness": 0,
    "weight": 0.02,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cheese",
    "price": 10,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 14,
    "happiness": 0,
    "weight": 0.03,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "yogurt",
    "price": 8,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 10,
    "happiness": 0,
    "weight": 0.01,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake",
    "price": 35,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 15,
    "happiness": 40,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "egg",
    "price": 4,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 16,
    "happiness": 0,
    "weight": 0.03,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cookie",
    "price": 7,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 8,
    "happiness": 18,
    "weight": 0.02,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "jelly_caka",
    "price": 20,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 14,
    "happiness": 30,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_original",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 6,
    "happiness": 18,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 40,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_white",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 5,
    "happiness": 16,
    "weight": -0.24,
    "energy": 100,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_mango",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 6,
    "happiness": 53,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_loco",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 41,
    "happiness": 18,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_pipeline",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 5,
    "happiness": 17,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 0,
    "cleanliness": 35,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_punch",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 5,
    "happiness": 17,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": true,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_rosa",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 5,
    "happiness": 19,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 35,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_peachy",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 5,
    "happiness": 39,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 20,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "monsta_rainbow",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 43,
    "happiness": 75,
    "weight": -0.24,
    "energy": 100,
    "sleep_quality": 35,
    "cleanliness": 35,
    "cure": true,
    "coins": 40,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": "rainbow"
  },
  {
    "food_key": "monsta_gold",
    "price": 100,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 8,
    "happiness": 100,
    "weight": 0.01,
    "energy": 100,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 60,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": "gold"
  },
  {
    "food_key": "pizza",
    "price": 26,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 34,
    "happiness": 0,
    "weight": 0.09,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "carbonara",
    "price": 24,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 32,
    "happiness": 0,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "lasagna",
    "price": 28,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 38,
    "happiness": 0,
    "weight": 0.1,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "risotto",
    "price": 24,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 30,
    "happiness": 0,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "nigiri",
    "price": 22,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 22,
    "happiness": 0,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "temaki",
    "price": 20,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 20,
    "happiness": 0,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "maki",
    "price": 24,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 26,
    "happiness": 0,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "ramen",
    "price": 28,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 36,
    "happiness": 0,
    "weight": 0.09,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "pad_thai",
    "price": 26,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 32,
    "happiness": 0,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "gyoza",
    "price": 20,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 24,
    "happiness": 0,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "xiaolongbao",
    "price": 24,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 28,
    "happiness": 0,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cevapi",
    "price": 26,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 36,
    "happiness": 0,
    "weight": 0.09,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "sarma",
    "price": 24,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 32,
    "happiness": 0,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "doner",
    "price": 22,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 34,
    "happiness": 0,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "tacos",
    "price": 22,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 28,
    "happiness": 0,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "wrap",
    "price": 18,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 26,
    "happiness": 0,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "paella",
    "price": 30,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 38,
    "happiness": 0,
    "weight": 0.1,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "stew",
    "price": 24,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 34,
    "happiness": 0,
    "weight": 0.09,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "meatballs",
    "price": 26,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 34,
    "happiness": 0,
    "weight": 0.09,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "roast_chicken",
    "price": 32,
    "kitchen": true,
    "bakery": false,
    "machine": false,
    "hunger": 42,
    "happiness": 0,
    "weight": 0.12,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_strawberry",
    "price": 60,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 18,
    "happiness": 36,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_chocolate",
    "price": 90,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 20,
    "happiness": 40,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_vanilla",
    "price": 50,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 12,
    "happiness": 28,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_matcha",
    "price": 110,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 16,
    "happiness": 34,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_blueberry",
    "price": 95,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 15,
    "happiness": 32,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_macaron",
    "price": 140,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 12,
    "happiness": 38,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_tiramisu",
    "price": 170,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 18,
    "happiness": 42,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_royal",
    "price": 250,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 24,
    "happiness": 55,
    "weight": 0.1,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_honey_hive",
    "price": 180,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 20,
    "happiness": 42,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_moonbeam",
    "price": 200,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 20,
    "happiness": 44,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_moss_cottage",
    "price": 190,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 20,
    "happiness": 43,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "cake_lily_pond",
    "price": 170,
    "kitchen": false,
    "bakery": true,
    "machine": false,
    "hunger": 18,
    "happiness": 40,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": false,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut",
    "price": 14,
    "kitchen": true,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 54,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_choco",
    "price": 16,
    "kitchen": true,
    "bakery": true,
    "machine": true,
    "hunger": 25,
    "happiness": 24,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_vanilla",
    "price": 22,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 44,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_honey",
    "price": 20,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 34,
    "happiness": 24,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_caramel",
    "price": 26,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 14,
    "happiness": 56,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 18,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_mint",
    "price": 26,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 28,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 28,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_matcha",
    "price": 28,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 14,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 30,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_blueberry",
    "price": 26,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 13,
    "happiness": 51,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_red_velvet",
    "price": 30,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 14,
    "happiness": 90,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_mocha",
    "price": 28,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 38,
    "happiness": 28,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_lattice",
    "price": 30,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 15,
    "happiness": 29,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": true,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_sakura",
    "price": 32,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 84,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 20,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_hibiscus",
    "price": 32,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 32,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": true,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_black_forest",
    "price": 34,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 15,
    "happiness": 66,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_ube",
    "price": 26,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 53,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_maple_bacon",
    "price": 30,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 53,
    "happiness": 52,
    "weight": 0.07,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_mochi",
    "price": 28,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 13,
    "happiness": 30,
    "weight": -0.15,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_sesame",
    "price": 30,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 13,
    "happiness": 14,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 26,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_gold_leaf",
    "price": 40,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 14,
    "happiness": 34,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 35,
    "donut": true,
    "effect": "gilded",
    "effect_ms": 600000,
    "skin": null
  },
  {
    "food_key": "donut_pizza",
    "price": 30,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 67,
    "happiness": 11,
    "weight": 0.08,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_lavender",
    "price": 28,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 12,
    "happiness": 28,
    "weight": 0.04,
    "energy": null,
    "sleep_quality": 28,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_biscoff",
    "price": 30,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 15,
    "happiness": 29,
    "weight": 0.06,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 22,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_pistachio",
    "price": 32,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 13,
    "happiness": 30,
    "weight": -0.1,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_white_choc",
    "price": 30,
    "kitchen": false,
    "bakery": true,
    "machine": true,
    "hunger": 13,
    "happiness": 29,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 24,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": null,
    "effect_ms": null,
    "skin": null
  },
  {
    "food_key": "donut_tiger",
    "price": 45,
    "kitchen": false,
    "bakery": false,
    "machine": false,
    "hunger": 41,
    "happiness": 85,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": "zoomies",
    "effect_ms": 480000,
    "skin": null
  },
  {
    "food_key": "donut_arcade",
    "price": 60,
    "kitchen": false,
    "bakery": false,
    "machine": false,
    "hunger": 14,
    "happiness": 121,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 0,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": "confetti",
    "effect_ms": 600000,
    "skin": null
  },
  {
    "food_key": "donut_neon",
    "price": 60,
    "kitchen": false,
    "bakery": false,
    "machine": false,
    "hunger": 14,
    "happiness": 80,
    "weight": 0.05,
    "energy": null,
    "sleep_quality": 0,
    "cleanliness": 30,
    "cure": false,
    "coins": 0,
    "donut": true,
    "effect": "glow",
    "effect_ms": 600000,
    "skin": null
  }
]$food_action_catalog$::jsonb) as c(
  food_key text, price integer, kitchen boolean, bakery boolean, machine boolean,
  hunger numeric, happiness numeric, weight numeric, energy numeric, sleep_quality numeric,
  cleanliness numeric, cure boolean, coins integer, donut boolean, effect text, effect_ms integer, skin text)
on conflict (food_key) do update set
  price = excluded.price, kitchen = excluded.kitchen, bakery = excluded.bakery, machine = excluded.machine,
  hunger = excluded.hunger, happiness = excluded.happiness, weight = excluded.weight, energy = excluded.energy,
  sleep_quality = excluded.sleep_quality, cleanliness = excluded.cleanliness, cure = excluded.cure,
  coins = excluded.coins, donut = excluded.donut, effect = excluded.effect, effect_ms = excluded.effect_ms,
  skin = excluded.skin;

do $catalog_ready$
begin
  if not exists (select 1 from eren_private.food_action_catalog where machine)
     or exists (select 1 from eren_private.food_keys k where not exists (
       select 1 from eren_private.food_action_catalog c where c.food_key = k.food_key))
     or exists (select 1 from eren_private.food_action_catalog c where not exists (
       select 1 from eren_private.food_keys k where k.food_key = c.food_key)) then
    raise exception 'Food action catalog incomplete: populate the generated block with scripts/build_food_action_catalog.cjs --write';
  end if;
end;
$catalog_ready$;

-- Explicit response whitelist: never serialize the entire household row.
create or replace function eren_private.food_stats_patch(s public.eren_stats, p_feed boolean)
returns jsonb language sql immutable set search_path = '' as $fn$
  select jsonb_build_object('food_by_user', s.food_by_user, 'food_inventory', s.food_inventory)
    || case when p_feed then jsonb_build_object(
      'happiness', s.happiness, 'hunger', s.hunger, 'energy', s.energy,
      'sleep_quality', s.sleep_quality, 'cleanliness', s.cleanliness, 'weight', s.weight,
      'is_sick', s.is_sick, 'mood', s.mood, 'last_decay_at', s.last_decay_at,
      'updated_at', s.updated_at, 'donuts_tasted', s.donuts_tasted, 'donut_effect', s.donut_effect)
    else '{}'::jsonb end;
$fn$;

-- One executor keeps receipt semantics and lock order identical across all three APIs.
create or replace function eren_private.food_action_atomic(
  p_operation text, p_request_id uuid, p_household_id uuid, p_food_key text,
  p_source text, p_use_free boolean
) returns jsonb language plpgsql set search_path = '' as $fn$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_stats public.eren_stats%rowtype;
  v_before public.eren_stats%rowtype;
  v_receipt eren_private.economy_receipts%rowtype;
  v_food eren_private.food_action_catalog%rowtype;
  v_last_free timestamptz;
  v_now timestamptz;
  v_hours numeric;
  v_foods jsonb;
  v_mine jsonb;
  v_shared jsonb;
  v_input jsonb;
  v_result jsonb := jsonb_build_object('ok', false, 'household_id', null, 'coins', null,
    'stats', '{}'::jsonb, 'food_key', p_food_key);
  v_cost integer := 0;
  v_free boolean;
  v_inserted integer;
  v_new_skin text;
begin
  if v_uid is null then return v_result || jsonb_build_object('reason', 'unauthenticated'); end if;
  if p_request_id is null or p_household_id is null
     or p_operation not in ('purchase_food', 'spin_donut', 'feed_food')
     or (p_operation <> 'spin_donut' and p_food_key is null)
     or (p_operation = 'purchase_food' and (p_source is null or p_source not in ('kitchen', 'bakery')))
     or (p_operation = 'spin_donut' and p_use_free is null) then
    return v_result || jsonb_build_object('reason', 'bad_request');
  end if;
  v_input := jsonb_build_object('household_id', p_household_id) || case p_operation
    when 'purchase_food' then jsonb_build_object('food_key', p_food_key, 'source', p_source)
    when 'feed_food' then jsonb_build_object('food_key', p_food_key)
    else jsonb_build_object('use_free', p_use_free) end;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_request_id::text, 0));
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then return v_result || jsonb_build_object('reason', 'no_profile'); end if;
  v_result := v_result || jsonb_build_object('coins', v_profile.coins, 'household_id', v_profile.household_id);
  if v_profile.household_id is null then return v_result || jsonb_build_object('reason', 'no_household'); end if;
  if v_profile.household_id <> p_household_id then
    return v_result || jsonb_build_object('reason', 'household_changed');
  end if;

  -- Same as pull_gacha_atomic: profile -> gacha state (spin only) -> household stats.
  -- If state is absent, the profile lock serializes its eventual lazy creation.
  if p_operation = 'spin_donut' then
    select last_free_donut into v_last_free from public.user_gacha_state where user_id = v_uid for update;
    v_result := v_result || jsonb_build_object('last_free_donut', v_last_free);
  end if;
  select * into v_stats from public.eren_stats where household_id = p_household_id for update;
  if not found then return v_result || jsonb_build_object('reason', 'no_fridge'); end if;
  v_result := v_result || jsonb_build_object('stats', eren_private.food_stats_patch(v_stats, p_operation = 'feed_food'));
  select * into v_receipt from eren_private.economy_receipts where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_receipt.operation <> p_operation or v_receipt.input <> v_input then
      return v_result || jsonb_build_object('reason', 'request_mismatch');
    end if;
    -- Keep the original award, but replace mutable values with the rows locked above.
    return v_receipt.result || v_result || jsonb_build_object('ok', true, 'food_key', v_receipt.result -> 'food_key');
  end if;

  v_now := clock_timestamp();
  if p_operation = 'spin_donut' then
    v_free := v_last_free is null or v_last_free <= v_now - interval '24 hours';
    if p_use_free and not v_free then return v_result || jsonb_build_object('reason', 'cooldown'); end if;
    v_cost := case when v_free then 0 else 50 end;
    select * into v_food from eren_private.food_action_catalog where machine order by random() limit 1;
    if not found then raise exception 'Food action catalog has no machine rewards'; end if;
  else
    select * into v_food from eren_private.food_action_catalog where food_key = p_food_key;
    if not found then return v_result || jsonb_build_object('reason', 'bad_food'); end if;
    if p_operation = 'purchase_food' then
      if not (case p_source when 'kitchen' then v_food.kitchen else v_food.bakery end) then
        return v_result || jsonb_build_object('reason', 'not_for_sale');
      end if;
      v_cost := v_food.price;
    end if;
  end if;
  if v_cost > 0 and coalesce(v_profile.coins, 0) < v_cost then
    return v_result || jsonb_build_object('reason', 'insufficient');
  end if;

  v_foods := coalesce(v_stats.food_by_user, '{}'::jsonb);
  v_mine := coalesce(v_foods -> v_uid::text, '{}'::jsonb);
  v_shared := coalesce(v_stats.food_inventory, '{}'::jsonb);
  if p_operation = 'feed_food' then
    if v_stats.is_sleeping then return v_result || jsonb_build_object('reason', 'sleeping'); end if;
    if coalesce((v_mine ->> p_food_key)::integer, 0) > 0 then
      v_mine := jsonb_set(v_mine, array[p_food_key], to_jsonb((v_mine ->> p_food_key)::integer - 1), true);
    elsif coalesce((v_shared ->> p_food_key)::integer, 0) > 0 then
      v_shared := jsonb_set(v_shared, array[p_food_key], to_jsonb((v_shared ->> p_food_key)::integer - 1), true);
    else
      return v_result || jsonb_build_object('reason', 'out_of_stock');
    end if;

    -- Mirrors feedWithFood's computeDecay, not the cron: no weight loss or new sickness.
    v_hours := least(12, greatest(0, coalesce(extract(epoch from (v_now - v_stats.last_decay_at)) / 3600, 0)));
    v_before := v_stats;
    v_stats.hunger := round(greatest(0, least(100, greatest(0, v_stats.hunger - 10 * v_hours) + v_food.hunger)));
    v_stats.happiness := round(greatest(0, least(100, greatest(0, v_stats.happiness - 7 * v_hours) + v_food.happiness)));
    v_stats.energy := round(least(100, greatest(0, coalesce(v_food.energy, greatest(0, v_stats.energy - 8 * v_hours)))));
    v_stats.sleep_quality := round(greatest(0, least(100, greatest(0, v_stats.sleep_quality - 7 * v_hours) + v_food.sleep_quality)));
    v_stats.cleanliness := round(greatest(0, least(100, greatest(0, coalesce(v_stats.cleanliness, 100) - 4 * v_hours) + v_food.cleanliness)));
    v_stats.weight := round(greatest(2, least(10, v_stats.weight + v_food.weight)), 2);
    v_stats.is_sick := case when v_food.cure then false else v_stats.is_sick end;
    v_stats.mood := case when v_stats.hunger < 30 then 'hungry'
      when v_stats.sleep_quality < 30 then 'sleepy' when v_stats.cleanliness < 25 then 'angry'
      when v_stats.happiness < 30 then 'angry'
      when v_stats.energy > 70 and v_stats.happiness > 70 then 'playful'
      when v_stats.happiness > 80 then 'happy' else 'idle' end;
    v_stats.last_decay_at := v_now;
    v_stats.updated_at := v_now;
    if v_food.donut and not coalesce(v_stats.donuts_tasted, '[]'::jsonb) ? p_food_key then
      v_stats.donuts_tasted := coalesce(v_stats.donuts_tasted, '[]'::jsonb) || jsonb_build_array(p_food_key);
    end if;
    if v_food.effect is not null then
      v_stats.donut_effect := jsonb_build_object('id', v_food.effect, 'until', v_now + v_food.effect_ms * interval '1 millisecond');
    end if;
  else
    v_mine := jsonb_set(v_mine, array[v_food.food_key], to_jsonb(coalesce((v_mine ->> v_food.food_key)::integer, 0) + 1), true);
  end if;

  if p_operation = 'spin_donut' and v_free then
    insert into public.user_gacha_state(user_id, last_free_donut) values (v_uid, v_now)
    on conflict (user_id) do update set last_free_donut = excluded.last_free_donut
    returning last_free_donut into v_last_free;
  end if;
  if v_cost <> 0 or (p_operation = 'feed_food' and v_food.coins <> 0) then
    update public.profiles set coins = coalesce(coins, 0) - v_cost
      + case when p_operation = 'feed_food' then v_food.coins else 0 end
    where id = v_uid returning * into v_profile;
  end if;
  v_stats.food_by_user := jsonb_set(v_foods, array[v_uid::text], v_mine, true);
  v_stats.food_inventory := v_shared;
  if p_operation = 'feed_food' then
    update public.eren_stats set
      food_by_user = v_stats.food_by_user, food_inventory = v_stats.food_inventory,
      hunger = v_stats.hunger, happiness = v_stats.happiness, energy = v_stats.energy,
      sleep_quality = v_stats.sleep_quality, cleanliness = v_stats.cleanliness, weight = v_stats.weight,
      is_sick = v_stats.is_sick, mood = v_stats.mood, last_decay_at = v_now, updated_at = v_now,
      donuts_tasted = v_stats.donuts_tasted, donut_effect = v_stats.donut_effect
    where household_id = p_household_id returning * into v_stats;
    if v_food.skin is not null then
      insert into public.user_inventory(user_id, item_id, quantity, equipped)
      values (v_uid, 'skin_' || v_food.skin, 1, false) on conflict (user_id, item_id) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_new_skin := v_food.skin; end if;
    end if;
    insert into public.interactions(household_id, user_id, action_type, happiness_delta,
      hunger_delta, energy_delta, sleep_delta, weight_delta, useful, created_at)
    values (p_household_id, v_uid, 'feed',
      floor(v_stats.happiness - greatest(0, v_before.happiness - 7 * v_hours) + 0.5),
      floor(v_stats.hunger - greatest(0, v_before.hunger - 10 * v_hours) + 0.5),
      floor(v_stats.energy - greatest(0, v_before.energy - 8 * v_hours) + 0.5),
      floor(v_stats.sleep_quality - greatest(0, v_before.sleep_quality - 7 * v_hours) + 0.5),
      floor((v_stats.weight - v_before.weight) * 100 + 0.5) / 100,
      greatest(0, v_before.hunger - 10 * v_hours) < 90
        or (v_food.energy is not null and greatest(0, v_before.energy - 8 * v_hours) < 90), v_now);
  else
    update public.eren_stats set food_by_user = v_stats.food_by_user, food_inventory = v_shared
    where household_id = p_household_id returning * into v_stats;
  end if;

  v_result := jsonb_build_object('ok', true, 'household_id', p_household_id, 'food_key', v_food.food_key);
  if p_operation = 'feed_food' then v_result := v_result || jsonb_build_object('new_skin', v_new_skin); end if;
  if p_operation = 'spin_donut' then v_result := v_result || jsonb_build_object('was_free', v_free); end if;
  insert into eren_private.economy_receipts(user_id, request_id, operation, input, result)
  values (v_uid, p_request_id, p_operation, v_input, v_result);
  return v_result || jsonb_build_object('coins', v_profile.coins,
    'stats', eren_private.food_stats_patch(v_stats, p_operation = 'feed_food'))
    || case when p_operation = 'spin_donut' then jsonb_build_object('last_free_donut', v_last_free) else '{}'::jsonb end;
end;
$fn$;

create or replace function public.purchase_food_atomic(
  p_request_id uuid, p_household_id uuid, p_food_key text, p_source text
) returns jsonb language sql security definer set search_path = '' as $fn$
  select eren_private.food_action_atomic('purchase_food', p_request_id, p_household_id, p_food_key, p_source, null);
$fn$;
create or replace function public.spin_donut_atomic(
  p_request_id uuid, p_household_id uuid, p_use_free boolean
) returns jsonb language sql security definer set search_path = '' as $fn$
  select eren_private.food_action_atomic('spin_donut', p_request_id, p_household_id, null, null, p_use_free);
$fn$;
create or replace function public.feed_food_atomic(
  p_request_id uuid, p_household_id uuid, p_food_key text
) returns jsonb language sql security definer set search_path = '' as $fn$
  select eren_private.food_action_atomic('feed_food', p_request_id, p_household_id, p_food_key, null, null);
$fn$;

revoke all on function eren_private.food_stats_patch(public.eren_stats, boolean) from public, anon, authenticated;
revoke all on function eren_private.food_action_atomic(text, uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.purchase_food_atomic(uuid, uuid, text, text) from public, anon;
revoke all on function public.spin_donut_atomic(uuid, uuid, boolean) from public, anon;
revoke all on function public.feed_food_atomic(uuid, uuid, text) from public, anon;
grant execute on function public.purchase_food_atomic(uuid, uuid, text, text) to authenticated;
grant execute on function public.spin_donut_atomic(uuid, uuid, boolean) to authenticated;
grant execute on function public.feed_food_atomic(uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';
commit;
