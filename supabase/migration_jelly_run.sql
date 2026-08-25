-- Jelly Slice is gone; Jelly Run replaces it in the parlour's second slot.
--
-- Both parlour tables constrain `game` to the two game ids, so the id has to be
-- swapped in the CHECK before a single Jelly Run score can be written. Until
-- this runs, finishing a run submits nothing and the duel line stays empty.
--
-- 'slice' is dropped rather than kept alongside: unlike the arcade's retired
-- games there is no history worth preserving here — the parlour's duel is
-- scored per DAY, so yesterday's slice rows have already stopped counting for
-- anything. Existing rows are moved to the new id so the constraint can be
-- re-added without a violation.
--
-- The constraint names are Postgres's own defaults for an inline column CHECK
-- (<table>_<column>_check). `drop ... if exists` makes this safe to re-run and
-- safe if yours were named differently — the add is what matters.

update public.jelly_scores     set game = 'run' where game = 'slice';
update public.jelly_duel_leads set game = 'run' where game = 'slice';

alter table public.jelly_scores
  drop constraint if exists jelly_scores_game_check;
alter table public.jelly_scores
  add constraint jelly_scores_game_check check (game in ('run','jump'));

alter table public.jelly_duel_leads
  drop constraint if exists jelly_duel_leads_game_check;
alter table public.jelly_duel_leads
  add constraint jelly_duel_leads_game_check check (game in ('run','jump'));
