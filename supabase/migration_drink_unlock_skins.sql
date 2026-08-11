-- ════════════════════════════════════════════════════════════════════════════
-- DRINK-UNLOCK SKINS — Rainbow Eren and Golden Eren leave the economy.
--
-- Both looks were gacha drops on the Kitty Costumes banner. They're now earned
-- exactly one way: pour Eren the matching SPECIAL EDITION can (Rainbow Monsta /
-- Gold Monsta) and the FIRST one he finishes leaves its colours on him for good.
--
-- The client half of that lives in lib/skins.ts (`unlock: 'drink'`, which pulls
-- them out of every banner pool and out of the closet's stardust shop). This
-- migration closes the SERVER half: purchase_skin_with_stardust would otherwise
-- still sell them to a tampered client, which is the one path that bypasses the
-- kitchen entirely.
--
-- Nothing is revoked. A player who already pulled one keeps it — the inventory
-- row is untouched, and it's the same row the first pour would have created, so
-- the unlock simply no-ops for them.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function purchase_skin_with_stardust(p_item_id text, p_rarity text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_stardust int;
  v_price int;
  v_inserted int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  -- Only skin items are purchasable here (inventory ids are prefixed 'skin_').
  if p_item_id is null or left(p_item_id, 5) <> 'skin_' then
    return jsonb_build_object('ok', false, 'reason', 'bad_item');
  end if;

  -- Drink-unlock looks are not for sale at any price. Kept as an explicit list
  -- rather than a naming convention so adding a third one is a deliberate edit
  -- here and in DRINK_UNLOCK_SKINS (lib/skins.ts) — the two must agree.
  if p_item_id in ('skin_rainbow', 'skin_gold') then
    return jsonb_build_object('ok', false, 'reason', 'not_for_sale');
  end if;

  -- Server-authoritative price by rarity. The client cannot dictate the cost.
  v_price := case p_rarity
    when 'rare'      then 100
    when 'epic'      then 150
    when 'legendary' then 200
    else null
  end;
  if v_price is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_rarity');
  end if;

  -- Lock my gacha-state row for the rest of the transaction so two concurrent
  -- buys can't both pass the balance check and overspend.
  select stardust into v_stardust
  from user_gacha_state
  where user_id = v_uid
  for update;

  if v_stardust is null then
    return jsonb_build_object('ok', false, 'reason', 'no_state');
  end if;
  if v_stardust < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'stardust', v_stardust);
  end if;

  -- Grant FIRST; only charge if the row actually landed. If a gacha pull granted
  -- this skin in the gap (it doesn't take our lock), the insert no-ops and we
  -- charge nothing — no dust taken for a skin we didn't grant.
  insert into user_inventory (user_id, item_id, quantity, equipped)
  values (v_uid, p_item_id, 1, false)
  on conflict (user_id, item_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object('ok', false, 'reason', 'already_owned', 'stardust', v_stardust);
  end if;

  update user_gacha_state set stardust = stardust - v_price where user_id = v_uid;
  return jsonb_build_object('ok', true, 'stardust', v_stardust - v_price);
end;
$$;

grant execute on function purchase_skin_with_stardust(text, text) to authenticated;
