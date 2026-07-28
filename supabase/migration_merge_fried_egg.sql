-- Fold any `fried_egg` piles back into `egg`.
--
-- `fried_egg` shipped with the world dishes as a duplicate of the `egg` the
-- shop already sold in SPECIAL — the picture should have become the existing
-- item's art instead of earning a second entry. `egg` is the canonical key
-- (level rewards and the `feed:egg` wish both reference it), so `fried_egg`
-- is gone from the code and its art is now egg.png.
--
-- Without this, anything already bought as a fried egg stays in the jsonb but
-- no longer renders in the fridge — an invisible, unfeedable pile. Run it once
-- in the Supabase SQL editor. Safe to skip if nobody ever bought one, and
-- harmless to run twice (the WHERE clauses match nothing the second time).

-- Shared legacy pool.
update public.eren_stats
set food_inventory = (food_inventory - 'fried_egg') || jsonb_build_object(
      'egg',
      coalesce((food_inventory->>'egg')::int, 0) + coalesce((food_inventory->>'fried_egg')::int, 0))
where food_inventory ? 'fried_egg';

-- Per-user piles: food_by_user is user_id -> { food key -> count }, so the
-- merge has to happen one level down.
update public.eren_stats s
set food_by_user = (
  select jsonb_object_agg(
    uid,
    case
      when pile ? 'fried_egg' then (pile - 'fried_egg') || jsonb_build_object(
        'egg',
        coalesce((pile->>'egg')::int, 0) + coalesce((pile->>'fried_egg')::int, 0))
      else pile
    end)
  from jsonb_each(s.food_by_user) as t(uid, pile))
where exists (
  select 1 from jsonb_each(s.food_by_user) as t(uid, pile) where pile ? 'fried_egg');
