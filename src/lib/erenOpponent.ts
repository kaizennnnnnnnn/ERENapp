// ═══════════════════════════════════════════════════════════════════════════
// EREN AS THE OPPONENT — the second player in a household of one.
//
// The daily battle was built for two people. A solo household has nobody in
// the other seat, and the consequence is not a cosmetic gap: `partner_score`
// stays 0, so `margin = my whole score`, so EVERY finished day would settle as
// a gold win. The battle is also the only place trophies are minted anywhere
// in the app, which means the Trophy Room — case, shop, decor, powers,
// prestige — is either dead (today, because the client gates settlement on a
// partner) or a printing press (if that gate were simply removed).
//
// So Eren takes the seat. He gets a score, and then every rule downstream is
// untouched: tier-by-margin, the streak bonus, the consolation rule, the
// outcome string, the verdict screen, and the `partner_score` column he is
// stored in. Nothing about the two-person path changes, and no table changes.
//
// THE HARD CONSTRAINT: this number is computed on the client (to render the
// HUD live) and again in Postgres (to settle and mint, authoritatively). The
// two MUST agree or the morning verdict contradicts the scoreboard the player
// watched all day. That is the same constraint `twistForDate` lives under, and
// it is why this is a pair of array lookups rather than a seeded RNG — see the
// note in dailyTwist.ts: the rotation was chosen over a seeded shuffle
// "precisely so that it ports to one line of SQL".
//
//   MIRRORED IN: supabase/migration_solo_eren_opponent.sql
//                -> public.eren_opponent_score(date)
//   Change one, change the other. There is no test that catches drift.
//
// He is a pace-setter, not a simulation. He does not "care for himself" — the
// player would rightly ask why the cat needs them at all.
// ═══════════════════════════════════════════════════════════════════════════

import type { TwistId } from './dailyTwist'

/**
 * What Eren is worth on each twist, before the day's jitter.
 *
 * Keyed on the twist because the twist decides what a care action is WORTH,
 * and a flat number would make high-multiplier days free wins. On `full_house`
 * the first of each type pays 4, so the same care is worth roughly twice a
 * plain day — against a flat number that is a guaranteed gold every eighth day.
 *
 * ── TUNING ──
 * These are the only balance numbers in the file, and they are calibrated
 * against 204 real playing days on this deployment:
 *
 *   median 13 · p75 21 · p90 33 · max 66 · avg 16.7
 *
 * Eren sits at ABOUT THE MEDIAN for his twist, which is the whole point: at
 * median performance the day is a coin flip. That matters because the tier
 * ladder is margin-based (>=6 gold, >=3 silver, >=1 bronze) and the score
 * spread here is enormous — a fixed low opponent would hand out gold on any
 * ordinary day and pay a solo player ~3x what someone in a couple earns, since
 * two real partners both playing keep each other's margins small.
 *
 * Per-twist values are the all-twist median (13) scaled by how much that twist
 * inflates a day, so they are ESTIMATED, not measured per twist. To replace the
 * estimate with the real thing:
 *
 *   select public.eren_twist_for_date(date) as twist, count(*) as days,
 *          round(percentile_cont(0.5) within group (order by score)::numeric, 1) as median
 *     from daily_battle_results where score > 0 group by 1 order by median;
 *
 * Raising a value makes that twist harder; lowering it makes it a gift.
 */
const EREN_BASE: Record<TwistId, number> = {
  // One action type pays 3 — a moderate lift over a plain day.
  bath_day:  12,
  feast:     12,
  playday:   12,
  nap_day:   12,
  // Medicine only comes up when he is actually sick, so the x5 rarely lands.
  nurse:      9,
  // Everything doubles.
  double:    16,
  // First of each type pays 4 — the biggest inflator.
  full_house: 18,
  // First six pay 3.
  sprint:    16,
}

/**
 * Day-to-day variance, so he is not the same wall every week.
 *
 * Length 11 against the twist cycle's 8 gives an 88-day period, so the same
 * twist meets a different Eren each time it comes round. Deliberately small
 * and zero-summed-ish: this is texture, not a slot machine.
 */
const EREN_JITTER = [0, 1, -1, 2, -1, 1, 0, -2, 1, 0, -1] as const

/** Below this he stops being a contest and starts being a formality. */
const EREN_FLOOR = 3

/** Days since epoch. Same helper shape as dailyTwist's, kept local so this
 *  module has no dependency that could drift underneath it. */
function dayNumber(dayKey: string): number {
  const y = Number(dayKey.slice(0, 4))
  const m = Number(dayKey.slice(5, 7))
  const d = Number(dayKey.slice(8, 10))
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * Eren's score for a date. Pure: the day key and the twist are the whole input.
 *
 * @param dayKey yyyy-MM-dd in the viewer's own timezone (not UTC — see
 *   seededRng.todayKey for why that distinction matters here).
 */
export function erenOpponentScore(dayKey: string, twist: TwistId): number {
  const n = dayNumber(dayKey)
  const jitter = EREN_JITTER[((n % EREN_JITTER.length) + EREN_JITTER.length) % EREN_JITTER.length]
  return Math.max(EREN_FLOOR, EREN_BASE[twist] + jitter)
}

/** What the HUD and the verdict screen call him. */
export const EREN_OPPONENT_NAME = 'Eren'
