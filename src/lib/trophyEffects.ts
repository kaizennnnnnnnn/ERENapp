// ═══════════════════════════════════════════════════════════════════════════
// TROPHY EFFECTS — the half of the shop that is not a picture.
//
// A privilege is bought with trophies and then FIRED, which writes one row to
// `trophy_effects`. The row is the whole record: what it was, who fired it,
// when it stops mattering. Nothing is mutated afterwards, so two devices
// reading the same rows always agree, and an expired effect needs no cleanup —
// it simply stops matching.
//
// Every effect is a pure function of (row, clock) so it can be applied
// identically by the live scoreboard, the nightly snapshot, and the partner's
// phone. That constraint is what keeps DOUBLE HOUR from being one number on
// your screen and a different one on hers.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PrivilegeId } from '@/lib/trophyShop'

export type EffectKind = PrivilegeId

export interface TrophyEffectRow {
  id: string
  household_id: string
  user_id: string
  kind: EffectKind
  payload: Record<string, unknown>
  /** ISO. Null or past = no longer running. */
  active_until: string | null
  created_at: string
}

/** A half-open [from, to) window in epoch ms. */
export interface Window {
  from: number
  to: number
}

/** Scoring adjustments a day's effects impose. Consumed by scoreDaily. */
export interface ScoreMods {
  /** user id → windows in which that person's actions count double. */
  doubles: Record<string, Window[]>
  /** user id → points to subtract from them for the day. */
  steals: Record<string, number>
}

export const NO_MODS: ScoreMods = { doubles: {}, steals: {} }

export function isLive(row: TrophyEffectRow, now = Date.now()): boolean {
  if (!row.active_until) return false
  const t = new Date(row.active_until).getTime()
  return Number.isFinite(t) && t > now
}

/** Every effect of a kind that is running right now. */
export function liveOf(
  rows: TrophyEffectRow[],
  kind: EffectKind,
  now = Date.now(),
): TrophyEffectRow[] {
  return rows.filter(r => r.kind === kind && isLive(r, now))
}

/**
 * The line the OTHER person paid to have Eren say to me, or null.
 *
 * Deliberately excludes my own purchases: buying Eren Says and then reading it
 * yourself is a mirror, not a message.
 */
export function erenSaysFor(rows: TrophyEffectRow[], viewerId: string, now = Date.now()): string | null {
  const live = liveOf(rows, 'eren_says', now)
    .filter(r => r.user_id !== viewerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const text = live[0]?.payload?.text
  return typeof text === 'string' && text.trim() ? text.trim() : null
}

/** When Eren's stats are frozen until, or 0. Household-wide — either of us. */
export function decayFrozenUntil(rows: TrophyEffectRow[], now = Date.now()): number {
  let max = 0
  for (const r of liveOf(rows, 'decay_freeze', now)) {
    const t = new Date(r.active_until!).getTime()
    if (t > max) max = t
  }
  return max
}

/**
 * Turn the day's effect rows into the adjustments the scorer needs.
 *
 * @param dayStart local midnight of the day being scored, epoch ms
 * @param dayEnd   the next local midnight
 */
export function scoreModsFor(
  rows: TrophyEffectRow[],
  dayStart: number,
  dayEnd: number,
): ScoreMods {
  const doubles: Record<string, Window[]> = {}
  const steals: Record<string, number> = {}

  for (const r of rows) {
    const started = new Date(r.created_at).getTime()
    const ends = r.active_until ? new Date(r.active_until).getTime() : started
    if (!Number.isFinite(started)) continue

    if (r.kind === 'double_hour') {
      // Clipped to the day, so an hour bought at 23:40 boosts forty minutes of
      // tonight and nothing of tomorrow.
      const from = Math.max(started, dayStart)
      const to = Math.min(ends, dayEnd)
      if (to <= from) continue
      ;(doubles[r.user_id] ??= []).push({ from, to })
    }

    if (r.kind === 'point_steal') {
      if (started < dayStart || started >= dayEnd) continue
      const target = r.payload?.target
      if (typeof target !== 'string') continue
      steals[target] = (steals[target] ?? 0) + 1
    }
  }

  return { doubles, steals }
}

export function inAnyWindow(windows: Window[] | undefined, at: number): boolean {
  if (!windows) return false
  for (const w of windows) if (at >= w.from && at < w.to) return true
  return false
}

// ── I/O ─────────────────────────────────────────────────────────────────────

/** Every effect row for the household since `sinceIso`. */
export async function fetchEffects(
  supabase: SupabaseClient,
  householdId: string,
  sinceIso: string,
): Promise<TrophyEffectRow[]> {
  const { data, error } = await supabase
    .from('trophy_effects')
    .select('*')
    .eq('household_id', householdId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
  // A missing table (migration not pasted yet) or an outage reads as "no
  // effects", which is the correct fallback: scoring is simply unmodified.
  if (error) return []
  return (data ?? []) as TrophyEffectRow[]
}

/** Fire one privilege. The row IS the effect. */
export async function fireEffect(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  kind: EffectKind,
  minutes: number,
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  const activeUntil = minutes > 0
    ? new Date(Date.now() + minutes * 60_000).toISOString()
    : null
  const { error } = await supabase.from('trophy_effects').insert({
    household_id: householdId,
    user_id: userId,
    kind,
    payload,
    active_until: activeUntil,
  })
  return !error
}

/** How long an Eren Says line may be. Matches the note board's limit. */
export const EREN_SAYS_MAX = 120

// ── Decay-freeze gate ───────────────────────────────────────────────────────
//
// useErenStats sits ABOVE the effects provider in the tree (the effects need a
// household, which the stats hook is also given), so it cannot read the freeze
// through context. A module-level latch is the smallest honest bridge: the
// provider publishes the current expiry, the decay loop reads it. Both live in
// the same tab, so there is no coherence problem to solve.

let _frozenUntil = 0

export function publishDecayFreeze(until: number): void {
  _frozenUntil = until
}

export function decayFrozen(now = Date.now()): boolean {
  return _frozenUntil > now
}
