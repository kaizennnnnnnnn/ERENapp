-- Run manually after migration_phase3_spine.sql. Read-only; no player data changes.
begin;

create or replace function public.read_memory_counters(p_household_id uuid, p_keys text[])
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  result jsonb := '{}'::jsonb;
  care_types text[] := array['feed','play','sleep','wash','medicine'];
  requested_actions text[];
  total_care boolean := 'cares' = any(p_keys);
  both_care boolean := 'both-care' = any(p_keys);
  today_start timestamptz := date_trunc('day', now(), 'UTC');
  total_nudges bigint;
  traded bigint;
  games bigint;
  wishes int;
begin
  if (select auth.uid()) is null or p_household_id is null
     or p_household_id is distinct from (select public.my_household_id()) then
    raise exception 'Not a household member' using errcode = '42501';
  end if;
  if p_keys is null or cardinality(p_keys) > 11 or array_position(p_keys, null) is not null
     or not (p_keys <@ (care_types || array['cares','both-care','nudges','traded','games','wishes'])) then
    raise exception 'Invalid memory counter keys' using errcode = '22023';
  end if;
  select array(select unnest(care_types) intersect select unnest(p_keys)) into requested_actions;

  if total_care or both_care or cardinality(requested_actions) > 0 then
    select jsonb_build_object(
      'cares', count(*),
      'both-care', count(distinct user_id) filter (where both_care and created_at >= today_start),
      'feed', count(*) filter (where action_type = 'feed'),
      'play', count(*) filter (where action_type = 'play'),
      'sleep', count(*) filter (where action_type = 'sleep'),
      'wash', count(*) filter (where action_type = 'wash'),
      'medicine', count(*) filter (where action_type = 'medicine')
    ) into result
    from public.interactions
    where household_id = p_household_id
      and (total_care or action_type = any(requested_actions) or (both_care and created_at >= today_start));
  end if;

  if p_keys && array['nudges','traded'] then
    -- Preserve historical via_eren semantics, including written notes and gifts.
    select coalesce(sum(s.sent), 0),
      case when count(p.id) >= 2 then min(s.sent) filter (where p.id is not null) else 0 end
    into total_nudges, traded
    from (
      select j.sender_id, count(*) as sent
      from public.couple_journal j
      where j.household_id = p_household_id and j.via_eren = true
      group by j.sender_id
    ) s
    left join public.profiles p on 'traded' = any(p_keys) and p.household_id = p_household_id and p.id = s.sender_id;
    result := result || jsonb_build_object('nudges', total_nudges, 'traded', traded);
  end if;

  if 'games' = any(p_keys) then
    select count(*) into games
    from public.game_scores g join public.profiles p on p.id = g.user_id
    where p.household_id = p_household_id;
    result := result || jsonb_build_object('games', games);
  end if;

  if 'wishes' = any(p_keys) then
    select h.wishes_granted_count into wishes from public.households h where h.id = p_household_id;
    result := result || jsonb_build_object('wishes', coalesce(wishes, 0));
  end if;

  return (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
          from jsonb_each(result) where key = any(p_keys));
end;
$$;

revoke all on function public.read_memory_counters(uuid, text[]) from public, anon;
grant execute on function public.read_memory_counters(uuid, text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
