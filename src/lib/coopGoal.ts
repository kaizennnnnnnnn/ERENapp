import type { SupabaseClient } from '@supabase/supabase-js'
import type { Interaction } from '@/types'
import { isoWeekKey } from '@/lib/battleResults'

// ═══════════════════════════════════════════════════════════════════════════════
// "WE CARED" — weekly co-op goal (the cooperative counterweight to the Care Battle).
//
// Both partners' USEFUL care actions this ISO week are SUMMED into one shared
// meter. Hit the target together and EACH partner claims a coin reward once.
//
// Unlike the battle/games competitions (which settle LAST week's winner on a
// Monday), this is a CURRENT-week goal you claim the moment you cross the line
// together — the "look what we did" beat. Persistence is per-user rows with a
// payout_paid CAS, mirroring weekly_game_results / weekly_battle_results so each
// partner only ever writes their own row (RLS-friendly, no payout races).
//
// Progress is DERIVED, not stored: useCouple already fetches this week's
// interactions for the love meter, so the combined count costs no extra read.
// ═══════════════════════════════════════════════════════════════════════════════

/** Care actions that count toward the shared goal — same set the daily battle scores. */
const COOP_CARE_ACTIONS = new Set(['feed', 'play', 'sleep', 'wash', 'medicine'])

/** Combined useful care actions both partners must reach this week. Tunable. */
export const COOP_WEEKLY_TARGET = 50
/** Coins EACH partner claims when the goal is met (paid once per user per week). */
export const COOP_REWARD_COINS = 50

export interface CoopGoalRow {
  household_id: string
  user_id: string
  iso_week: string            // e.g. "2026-W26"
  combined_actions: number    // snapshot at claim time, for display
  goal: number
  payout_coins: number
  payout_paid: boolean
  created_at?: string
}

/** What the UI needs: combined progress + whether it's met / already claimed. */
export interface CoopGoalState {
  combined: number
  target: number
  reward: number
  goalMet: boolean
  claimed: boolean
}

/** Count both partners' useful care actions in an interaction list. */
export function countCoopActions(interactions: Interaction[]): number {
  let n = 0
  for (const i of interactions) {
    if (i.useful === false) continue
    if (COOP_CARE_ACTIONS.has(i.action_type)) n++
  }
  return n
}

/** ISO-week key of the current week — the row key for this week's goal. */
export function thisIsoWeekKey(now: Date = new Date()): string {
  return isoWeekKey(now)
}

/** My co-op row for the current ISO week (null until I've claimed). */
export async function fetchCoopRow(
  supabase: SupabaseClient,
  myId: string,
): Promise<CoopGoalRow | null> {
  const { data } = await supabase
    .from('weekly_coop_results')
    .select('*')
    .eq('user_id', myId)
    .eq('iso_week', thisIsoWeekKey())
    .maybeSingle()
  return (data as CoopGoalRow | null) ?? null
}

/**
 * Claim my share of this week's co-op reward. Inserts my row (ignoreDuplicates)
 * so the CAS has something to flip, then atomically sets payout_paid false→true.
 * Returns the coins to credit (exactly once) or 0 if already claimed / not met.
 * Caller is responsible for crediting the returned coins.
 */
export async function claimCoopReward(
  supabase: SupabaseClient,
  householdId: string,
  myId: string,
  combined: number,
): Promise<number> {
  if (combined < COOP_WEEKLY_TARGET) return 0
  const key = thisIsoWeekKey()

  // Ensure a row exists to CAS against — no-op on a race / repeat claim.
  await supabase
    .from('weekly_coop_results')
    .upsert([{
      household_id: householdId,
      user_id: myId,
      iso_week: key,
      combined_actions: combined,
      goal: COOP_WEEKLY_TARGET,
      payout_coins: COOP_REWARD_COINS,
      payout_paid: false,
    }], { onConflict: 'household_id,user_id,iso_week', ignoreDuplicates: true })

  // CAS: pays exactly once. A repeat tap / sibling tab finds payout_paid=true
  // and matches no rows → returns 0.
  const { data } = await supabase
    .from('weekly_coop_results')
    .update({ payout_paid: true, combined_actions: combined })
    .eq('user_id', myId)
    .eq('iso_week', key)
    .eq('payout_paid', false)
    .select('payout_coins')
  if (data && data.length > 0) return (data[0].payout_coins as number) ?? COOP_REWARD_COINS
  return 0
}
