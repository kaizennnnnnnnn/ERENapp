-- ════════════════════════════════════════════════════════════════════════════
-- SKIN STARDUST SHOP — buy a skin outright with stardust (the gacha duplicate
-- currency) instead of pulling for it. rare 100 / epic 150 / legendary 200.
--
-- Atomicity matters: this is a currency transaction. Deducting dust and granting
-- the skin must both happen, or neither. Both writes live in one function, with
-- the user's gacha-state row locked FOR UPDATE to serialize a user's concurrent
-- purchases. The skin is INSERTED FIRST and dust is charged ONLY if that insert
-- actually landed — so a gacha pull that grants the same skin in the gap can't
-- leave us charging dust for nothing.
--
-- Trust model: SECURITY DEFINER bypasses RLS, so the function trusts ONLY
-- auth.uid() (never a caller-supplied user id) and only touches the caller's own
-- rows. The PRICE is derived server-side from rarity — the client cannot set the
-- cost (a tampered client could otherwise buy anything for 0).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- A previous draft of this shop shipped a (text, int) signature that trusted a
-- client price. Drop it so only the hardened (text, text) version remains.
drop function if exists purchase_skin_with_stardust(text, int);

-- ── Buy a skin with stardust ────────────────────────────────────────────────
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
