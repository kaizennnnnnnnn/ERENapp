-- ════════════════════════════════════════════════════════════════════════════
-- INVENTORY HOUSEHOLD READ — let household members see each other's owned skins.
--
-- The closet is household-shared: the cat is shared, room_skins is per-household,
-- and "either partner may dress any skin either of them owns" (see useCloset).
-- That union is built client-side by reading user_inventory for BOTH partners'
-- ids. But user_inventory shipped with only a self-read policy (auth.uid() =
-- user_id), so RLS silently stripped the partner's rows and the union collapsed
-- to "my skins only". Consequence: a costume the partner already owns shows up
-- as buyable in the Closet SHOP (and can't appear in My Looks), even though the
-- household owns it.
--
-- Fix: add a household-scoped read policy mirroring eren_stats / couple_journal /
-- weekly_* — a member may READ any inventory row whose owner shares their
-- household. INSERT/UPDATE stay self-only (you only mutate your own inventory),
-- so this grants visibility, not the ability to spend a partner's items.
--
-- my_household_id() is SECURITY DEFINER + stable, so the lookup does not recurse
-- through profiles RLS. The existing self-read policy is kept as-is: RLS SELECT
-- policies are OR'd, so a user with no household (my_household_id() null) can
-- still read their own rows.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "Household members can read inventory" on public.user_inventory;

create policy "Household members can read inventory"
  on public.user_inventory for select
  using (
    user_id in (
      select id from public.profiles where household_id = public.my_household_id()
    )
  );
