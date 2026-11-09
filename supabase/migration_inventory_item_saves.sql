-- Run manually after migration_economy_reliability.sql. Safe to re-run.
-- Collection use only: preserves fridge stock, coins, cosmetics and care history.
begin;
set local lock_timeout='5s';
create or replace function public.use_inventory_item_atomic(
  p_request_id uuid, p_expected_user uuid, p_household_id uuid, p_item_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); p public.profiles%rowtype; s public.eren_stats%rowtype;
  item public.user_inventory%rowtype; receipt eren_private.economy_receipts%rowtype;
  input jsonb:=jsonb_build_object('household_id',p_household_id,'item_id',p_item_id);
  result jsonb; buff jsonb; stamp timestamptz;
  -- Match the collection buffs, not the separate kitchen food effects.
  buffs constant jsonb:=$inventory_buffs${
    "cons_monsta_original":{"stat":"energy","amount":100},
    "cons_monsta_white":{"stat":"energy","amount":100},
    "cons_monsta_mango":{"stat":"energy","amount":100},
    "cons_monsta_loco":{"stat":"energy","amount":100},
    "cons_monsta_pipeline":{"stat":"energy","amount":100},
    "cons_monsta_punch":{"stat":"energy","amount":100},
    "cons_monsta_rosa":{"stat":"energy","amount":100},
    "cons_monsta_peachy":{"stat":"energy","amount":100},
    "cons_monsta_rainbow":{"stat":"energy","amount":100},
    "cons_monsta_gold":{"stat":"energy","amount":100},
    "cons_donut_tiger":{"stat":"happiness","amount":30},
    "cons_donut_arcade":{"stat":"happiness","amount":38},
    "cons_donut_neon":{"stat":"happiness","amount":40}
  }$inventory_buffs$::jsonb;
begin
  if uid is null then return jsonb_build_object('ok',false,'reason','unauthenticated'); end if;
  if uid is distinct from p_expected_user then return jsonb_build_object('ok',false,'reason','session_changed'); end if;
  if p_request_id is null or p_household_id is null then return jsonb_build_object('ok',false,'reason','bad_request'); end if;
  buff:=buffs->p_item_id;
  if buff is null then return jsonb_build_object('ok',false,'reason','bad_item'); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id::text,0));
  select * into p from public.profiles where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_profile'); end if;
  if p.household_id is distinct from p_household_id then return jsonb_build_object('ok',false,'reason','household_changed'); end if;
  select * into receipt from eren_private.economy_receipts where user_id=uid and request_id=p_request_id;
  if found and (receipt.operation<>'inventory_item' or receipt.input<>input) then
    return jsonb_build_object('ok',false,'reason','request_mismatch');
  end if;
  select * into s from public.eren_stats where household_id=p_household_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','no_stats'); end if;
  select * into item from public.user_inventory where user_id=uid and item_id=p_item_id for update;
  if receipt.request_id is not null then
    result:=receipt.result;
  else
    if item.id is null or item.quantity<=0 then return jsonb_build_object('ok',false,'reason','no_stock'); end if;
    stamp:=clock_timestamp();
    update public.eren_stats set
      energy=case when buff->>'stat'='energy' then least(100,energy+(buff->>'amount')::int) else energy end,
      happiness=case when buff->>'stat'='happiness' then least(100,happiness+(buff->>'amount')::int) else happiness end,
      updated_at=stamp
      where household_id=p_household_id returning * into s;
    if item.quantity=1 then
      delete from public.user_inventory where id=item.id;
      item:=null;
    else
      update public.user_inventory set quantity=quantity-1 where id=item.id returning * into item;
    end if;
    result:=jsonb_build_object('ok',true,'version',1,'request_id',p_request_id,'user_id',uid,
      'household_id',p_household_id,'item_id',p_item_id,'saved_at',stamp);
    insert into eren_private.economy_receipts(user_id,request_id,operation,input,result,created_at)
      values(uid,p_request_id,'inventory_item',input,result,stamp);
  end if;
  -- Replays return today's stock/stat values, never an old pre-partner snapshot.
  return result||jsonb_build_object('inventory_item',case when item.id is null then null else to_jsonb(item) end,
    'stats',jsonb_build_object('household_id',s.household_id,'energy',s.energy,'happiness',s.happiness,'updated_at',s.updated_at));
end;
$$;
revoke all on function public.use_inventory_item_atomic(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.use_inventory_item_atomic(uuid,uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
