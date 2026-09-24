'use client'

import { useCouple } from '@/hooks/useCouple'

/**
 * What the Us tab's dot is telling you: partner messages you haven't read, or
 * a reward waiting to be claimed on /couple. The same condition the old home
 * heart button used, lifted here so the nav and any page agree:
 *
 * - an unacknowledged Care Battle win from last week (claimed through the
 *   champion popup, which stamps `acknowledged` on close);
 * - a met "We Cared" co-op goal not yet claimed. Gated on `coopGoal.loaded`:
 *   goalMet (from interactions) and claimed (from the coop row) settle in
 *   separate commits, and without the gate the dot would flash for a goal
 *   already claimed, or fire on a 503'd read.
 *
 * Not gated on having a partner: both payouts are solo too (last week settles
 * against Eren, the co-op goal has a one-person target), so a solo player has
 * coins to claim and needs the dot as much as anyone.
 */
export function useUsBadge(): { unread: number; reward: boolean; show: boolean } {
  const { unreadCount, weeklyChampion, coopGoal } = useCouple()
  const weeklyWinPending = weeklyChampion?.outcome === 'win' && !weeklyChampion.acknowledged
  const coopRewardPending = coopGoal.goalMet && coopGoal.loaded && !coopGoal.claimed
  const reward = weeklyWinPending || coopRewardPending
  return { unread: unreadCount, reward, show: unreadCount > 0 || reward }
}
