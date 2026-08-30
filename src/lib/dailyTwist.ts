// ═══════════════════════════════════════════════════════════════════════════
// DAILY TWIST — the rule that changes what a care action is worth today.
//
// The daily battle used to be a tap counter: every useful action was worth
// exactly one point, every day, forever. Nothing about Tuesday felt different
// from Monday, so there was no reason to plan and no reason to care which
// room you walked into first.
//
// A twist is one sentence both people wake up to. It is dealt from a fixed
// cycle keyed on the local date, so it needs no storage and no server
// round-trip: both phones compute the same twist for the same day, all day.
//
// TWO KINDS, and the difference matters:
//   perRow  — a row's points depend only on that row (its action type). The
//             live realtime handler can add points incrementally.
//   !perRow — points depend on what the same person already did today (their
//             first of each type, their first six). The realtime handler
//             CANNOT increment for these; it refetches the day instead.
//
// Nothing in here may touch the clock or Math.random beyond the date key it
// is handed — see lib/seededRng.ts for why.
// ═══════════════════════════════════════════════════════════════════════════

/** The five action types the daily battle scores. Anything else is worth 0. */
export const BATTLE_ACTIONS = ['feed', 'play', 'sleep', 'wash', 'medicine'] as const
export type BattleAction = typeof BATTLE_ACTIONS[number]

export function isBattleAction(a: string): a is BattleAction {
  return (BATTLE_ACTIONS as readonly string[]).includes(a)
}

export type TwistId =
  | 'bath_day' | 'feast' | 'playday' | 'nap_day'
  | 'nurse' | 'double' | 'full_house' | 'sprint'

export interface TwistDef {
  id: TwistId
  /** Shouted on the HUD and the verdict screen. */
  name: string
  /** One line. It has to explain the whole rule — there is no second line. */
  blurb: string
  /** Drives the twist chip tint. */
  tone: string
  /** Which action the twist is about, for the icon. null = all of them. */
  focus: BattleAction | null
  /** False when scoring needs the person's earlier actions today. */
  perRow: boolean
}

// Contextual twists — the two whose points depend on what came before. Named
// once, here, so `perRow` below can be derived instead of hand-set on each
// entry where it could drift from the scoring switch.
const CONTEXTUAL: readonly TwistId[] = ['full_house', 'sprint']

function def(
  id: TwistId, name: string, tone: string, focus: BattleAction | null, blurb: string,
): TwistDef {
  return { id, name, tone, focus, blurb, perRow: !CONTEXTUAL.includes(id) }
}

export const TWISTS: Record<TwistId, TwistDef> = {
  bath_day:   def('bath_day',   'BATH DAY',   '#4FD8FF', 'wash',     'Every wash is worth 3.'),
  feast:      def('feast',      'FEAST DAY',  '#FFB255', 'feed',     'Every meal is worth 3.'),
  playday:    def('playday',    'PLAY DAY',   '#63F094', 'play',     'Every play is worth 3.'),
  nap_day:    def('nap_day',    'NAP DAY',    '#BB78FF', 'sleep',    'Every tuck-in is worth 3.'),
  nurse:      def('nurse',      'NURSE DAY',  '#FF5C7A', 'medicine', 'Medicine is worth 5.'),
  double:     def('double',     'DOUBLE DAY', '#FFF06B', null,       'Everything counts twice.'),
  full_house: def('full_house', 'FULL HOUSE', '#FF8DB8', null,       'Your first of each of the five is worth 4.'),
  sprint:     def('sprint',     'SPRINT',     '#FF6B3D', null,       'Your first 6 are worth 3. After that, 1.'),
}

// ─── The daily deal ──────────────────────────────────────────────────────────
// A CYCLE, not an independent daily draw. Independent draws would run BATH DAY
// twice in one week and hide NURSE DAY for a month; dealing one per day from a
// fixed order guarantees all eight inside eight days.

const TWIST_ORDER: readonly TwistId[] = [
  'bath_day', 'feast', 'playday', 'nap_day', 'nurse', 'double', 'full_house', 'sprint',
]

/** Whole days since the epoch for a 'yyyy-mm-dd' key. */
function dayNumber(dayKey: string): number {
  const y = Number(dayKey.slice(0, 4))
  const m = Number(dayKey.slice(5, 7))
  const d = Number(dayKey.slice(8, 10))
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

function twistAt(n: number): TwistDef {
  const len = TWIST_ORDER.length
  return TWISTS[TWIST_ORDER[((n % len) + len) % len]]
}

/**
 * Today's twist.
 *
 * Deliberately a plain rotation over a fixed order rather than a seeded
 * shuffle: the settlement path has to be able to reach the same answer
 * elsewhere, and `(day_number % 8)` ports in one line where mulberry32
 * does not.
 *
 * @param dayKey local date as 'yyyy-mm-dd' — todayKey() or dateStr().
 */
export function twistForDate(dayKey: string): TwistDef {
  return twistAt(dayNumber(dayKey))
}

/** Tomorrow's, for the "up next" line on the verdict screen. */
export function nextTwist(dayKey: string): TwistDef {
  return twistAt(dayNumber(dayKey) + 1)
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

const BASE = 1

/** How many of a person's opening actions SPRINT pays extra for. */
const SPRINT_WINDOW = 6

/**
 * What one action is worth on its own, under a per-row twist.
 *
 * Contextual twists return BASE here — the caller must use {@link scoreActions}
 * for those. `twist.perRow` tells you which one you need.
 */
export function pointsForAction(twist: TwistDef, action: string): number {
  if (!isBattleAction(action)) return 0
  switch (twist.id) {
    case 'bath_day': return action === 'wash'     ? 3 : BASE
    case 'feast':    return action === 'feed'     ? 3 : BASE
    case 'playday':  return action === 'play'     ? 3 : BASE
    case 'nap_day':  return action === 'sleep'    ? 3 : BASE
    case 'nurse':    return action === 'medicine' ? 5 : BASE
    case 'double':   return 2
    default:         return BASE
  }
}

/**
 * One person's score for the day.
 *
 * @param actions their counted action types, OLDEST FIRST. Order only matters
 *   for the contextual twists, but pass it sorted always — a caller that
 *   shuffles will silently score SPRINT wrong.
 */
export function scoreActions(twist: TwistDef, actions: string[]): number {
  const counted = actions.filter(isBattleAction)
  if (twist.id === 'full_house') {
    const seen = new Set<string>()
    let total = 0
    for (const a of counted) {
      if (seen.has(a)) { total += BASE; continue }
      seen.add(a)
      total += 4
    }
    return total
  }
  if (twist.id === 'sprint') {
    let total = 0
    for (let i = 0; i < counted.length; i++) total += i < SPRINT_WINDOW ? 3 : BASE
    return total
  }
  let total = 0
  for (const a of counted) total += pointsForAction(twist, a)
  return total
}

// ─── Trophies ────────────────────────────────────────────────────────────────
// The prize the battle actually pays. Tier is a pure function of the winning
// margin, so the settlement RPC derives it server-side from the stored scores
// and the client never names its own reward. Keep this table and the `case`
// in migration_trophy_battle.sql identical.

export type TrophyTier = 'bronze' | 'silver' | 'gold'

export const TROPHY_VALUE: Record<TrophyTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
}

export const TROPHY_TONE: Record<TrophyTier, string> = {
  bronze: '#E0975A',
  silver: '#D8DCE6',
  gold: '#FFD650',
}

export const TROPHY_LABEL: Record<TrophyTier, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
}

/** Margin → tier. Below 1 is not a win and has no tier. */
export function trophyTier(margin: number): TrophyTier | null {
  if (margin >= 6) return 'gold'
  if (margin >= 3) return 'silver'
  if (margin >= 1) return 'bronze'
  return null
}

/** A win streak pays a bonus every third day in a row. */
export function streakBonus(winStreak: number): number {
  return winStreak > 0 && winStreak % 3 === 0 ? 2 : 0
}

/**
 * The loser is not sent home empty-handed when it was close: within 2 points,
 * having actually shown up (3+), is worth one trophy. Without this the losing
 * half of every day is dead time, which is the whole complaint about the old
 * 30-coin version.
 */
export function consolationTrophies(myScore: number, partnerScore: number): number {
  const margin = partnerScore - myScore
  return margin > 0 && margin <= 2 && myScore >= 3 ? 1 : 0
}
