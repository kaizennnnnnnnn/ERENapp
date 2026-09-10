-- ═════════════════════════════════════════════════════════════════════════════
-- A DOLLAR ceiling on /talk, not a message ceiling.
--
-- The route already had a whole-deployment cap of 2,000 messages/day, and that
-- number does not bound the invoice. A message costs anywhere from ~0.15c to
-- well over 1c depending on how many memories the account carries, how long the
-- text is, and how much the model thinks -- so "2,000 messages" is somewhere
-- between $3 and $40. It also silently stops meaning anything the day a model
-- price changes or a prefix falls under a cache minimum.
--
-- This tracks actual spend in MICRO-DOLLARS (integers -- no float drift on a
-- running total) and lets the route refuse before it spends past the ceiling.
--
-- One row per UTC day, so it stays a single-row primary-key lookup forever.
-- That also makes it CHEAPER to check than the COUNT-over-24h-of-every-user's-
-- rows query it replaces, which grew with the table.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.ai_spend_daily (
  day        date        primary key,
  micro_usd  bigint      not null default 0,
  messages   integer     not null default 0,
  updated_at timestamptz not null default now()
);

-- RLS on with NO policies: clients get nothing, in either direction. The route
-- reads and writes this with the service-role key, which bypasses RLS. There is
-- deliberately no read policy either -- the running spend of the whole
-- deployment is not a thing any user needs to see.
alter table public.ai_spend_daily enable row level security;

-- ── The atomic increment ─────────────────────────────────────────────────────
-- Needed as a function purely because `micro_usd = micro_usd + x` cannot be
-- expressed through PostgREST's upsert. Doing it read-modify-write from the app
-- would lose increments under concurrency, which for a spend guard means
-- undercounting exactly when traffic is highest and the guard matters most.
--
-- SECURITY INVOKER on purpose, NOT definer. RLS then still applies to whoever
-- calls it, so even if the grant below were somehow bypassed the write is
-- refused. A definer function here would be a hole: anyone who could reach it
-- could poison the counter to the ceiling and switch /talk off for everybody.
create or replace function public.add_ai_spend(p_micro_usd bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  total bigint;
begin
  if p_micro_usd is null or p_micro_usd < 0 then
    raise exception 'add_ai_spend: micro_usd must be >= 0';
  end if;

  insert into public.ai_spend_daily as t (day, micro_usd, messages)
  values ((now() at time zone 'utc')::date, p_micro_usd, 1)
  on conflict (day) do update
    set micro_usd  = t.micro_usd + excluded.micro_usd,
        messages   = t.messages + 1,
        updated_at = now()
  returning t.micro_usd into total;

  return total;
end
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Without this
-- revoke, any signed-in client could call add_ai_spend(999999999) and trip the
-- ceiling for the entire deployment -- a one-line denial of service against the
-- feature. The service-role key is the only intended caller.
revoke all on function public.add_ai_spend(bigint) from public;
revoke all on function public.add_ai_spend(bigint) from anon;
revoke all on function public.add_ai_spend(bigint) from authenticated;
