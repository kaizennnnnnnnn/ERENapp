-- Run if the first version of migration_kiosk_reliability.sql is already installed.
-- Compatibility only: no wallet, shift, note or customer data changes.
begin;
grant insert on public.kiosk_shifts to authenticated;
drop policy if exists "users insert own kiosk shifts" on public.kiosk_shifts;
create policy "users insert own kiosk shifts" on public.kiosk_shifts for insert to authenticated
  with check (household_id=(select public.my_household_id()) and user_id=(select auth.uid()));
commit;
