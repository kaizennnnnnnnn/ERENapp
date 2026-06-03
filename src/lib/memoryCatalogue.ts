// ═════════════════════════════════════════════════════════════════════════════
// MEMORY WALL CATALOGUE — Phase 3 PR 6
//
// The picture-frame ledger that lives in the Hallway swipe-room. Frames unlock
// the first time their predicate matches, never again — one row per
// (household, frame_id) in memory_frames, enforced by the table's PK.
//
// The catalogue is APPEND-ONLY. Reordering or deleting entries is fine for
// CSS, but the `id` strings are user-visible (stored in memory_frames.frame_id)
// — never rename them.
//
// Each frame carries:
//   • id              stable string key, also used as memory_frames.frame_id
//   • kind            top-level category for grouping in the wall UI
//   • rarity          common | rare | epic — drives border tint + push copy
//   • title           short display label
//   • hint            one-line flavor text shown in the detail modal
//   • art             icon ref + bg palette (PR 7 renders this via canvas)
//   • predicate       discriminated-union evaluator spec (memoryChecks.ts)
//
// Predicates fall into two evaluation contexts:
//   • on-event (memoryChecks#checkActionUnlocks etc.) — fires inside the app
//     when an action lands. Carries enough metric data to evaluate cheaply.
//   • on-sweep (memoryChecks#runMemorySweep) — fires from /api/decay. Owns
//     streak/calendar/rare frames that need broader queries.
//
// PR 8 will add 2–3 "welcome" seed frames stamped at signup; they aren't in
// this catalogue because they don't have a predicate — they're force-inserted.
// ═════════════════════════════════════════════════════════════════════════════

export type FrameKind = 'first' | 'cumulative' | 'streak' | 'calendar' | 'couple' | 'rare'
export type Rarity    = 'common' | 'rare' | 'epic'

/** Care action types tracked in the interactions table. */
export type ActionType = 'feed' | 'play' | 'sleep' | 'wash' | 'medicine'

/** Compact icon ref. PR 7's MemoryFrameCanvas maps these to actual pixel
 *  grids from PixelIcons.tsx. Keeping the catalogue free of React imports
 *  means it can be tree-shaken into server bundles (used by /api/decay). */
export type FrameIcon =
  | 'drumstick' | 'yarn' | 'moon' | 'bath' | 'pill'
  | 'heart' | 'wish' | 'cake' | 'person' | 'gift'

export interface FrameArt {
  icon: FrameIcon
  bg: string
  accent?: string
}

// ─── Predicates ──────────────────────────────────────────────────────────────

export type Predicate =
  /** First time the household logs an action of `of` type. */
  | { type: 'first', of: ActionType | 'pet' | 'nudge' | 'wish' | 'minigame' | 'message' | 'mood' | 'day' }
  /** Lifetime care count (sum of all action types) ≥ value. */
  | { type: 'cares', count: number }
  /** Per-action lifetime count ≥ value. */
  | { type: 'metric', metric: ActionType, count: number }
  /** Lifetime nudges sent (couple_journal where via_eren) ≥ value. */
  | { type: 'nudges', count: number }
  /** Lifetime wishes granted (households.wishes_granted_count) ≥ value. */
  | { type: 'wishes', count: number }
  /** Lifetime minigame completions (game_scores rows) ≥ value. */
  | { type: 'minigames', count: number }
  /** Consecutive-day care streak from the cared-every-day perspective. */
  | { type: 'streak', days: number }
  /** Date-based, fires on the calendar day a household crosses it. */
  | { type: 'calendar', when:
      | 'app_week_1' | 'app_month_1' | 'app_month_3' | 'app_month_6' | 'app_year_1'
      | 'eren_birthday' | 'couple_anniversary'
    }
  /** Joint partner activity. */
  | { type: 'couple', kind: 'both_cared_same_day' | 'both_cared_7_streak' | 'nudges_traded_10' | 'nudges_traded_50' | 'first_paired' }
  /** Heavy rare frames evaluated on the sweep. */
  | { type: 'rare', kind: 'all_minigames' | 'all_rooms_in_day' | 'all_foods_in_week' | 'perfect_week' }

export interface MemoryFrame {
  id: string
  kind: FrameKind
  rarity: Rarity
  title: string
  hint: string
  art: FrameArt
  predicate: Predicate
}

// Palettes — shared so frames in the same family render consistently.
const GOLD   = { bg: '#3A2E10', accent: '#F5C842' }
const PINK   = { bg: '#3A1024', accent: '#FF6B9D' }
const INDIGO = { bg: '#1A1A3A', accent: '#818CF8' }
const SKY    = { bg: '#102A3A', accent: '#38BDF8' }
const GREEN  = { bg: '#102A1A', accent: '#34D399' }
const RUBY   = { bg: '#3A1010', accent: '#FF4D6D' }
const CREAM  = { bg: '#2A2A20', accent: '#FFE7A8' }
const ROSE   = { bg: '#3A1A24', accent: '#FF9DBE' }

// ─── Catalogue (append-only) ─────────────────────────────────────────────────

export const MEMORY_FRAMES: MemoryFrame[] = [
  // ── Firsts (12) ───────────────────────────────────────────────────────────
  { id: 'first-feed',     kind: 'first', rarity: 'common',
    title: 'First Meal', hint: 'the first time you fed Eren.',
    art: { icon: 'drumstick', ...GOLD },
    predicate: { type: 'first', of: 'feed' } },
  { id: 'first-play',     kind: 'first', rarity: 'common',
    title: 'First Play', hint: 'first time the yarn came out.',
    art: { icon: 'yarn', ...PINK },
    predicate: { type: 'first', of: 'play' } },
  { id: 'first-sleep',    kind: 'first', rarity: 'common',
    title: 'First Nap', hint: 'first bedtime tuck-in.',
    art: { icon: 'moon', ...INDIGO },
    predicate: { type: 'first', of: 'sleep' } },
  { id: 'first-wash',     kind: 'first', rarity: 'common',
    title: 'First Bath', hint: 'first bubbles in the tub.',
    art: { icon: 'bath', ...SKY },
    predicate: { type: 'first', of: 'wash' } },
  { id: 'first-medicine', kind: 'first', rarity: 'common',
    title: 'First Vet Visit', hint: 'first time you took care of a tummy ache.',
    art: { icon: 'pill', ...GREEN },
    predicate: { type: 'first', of: 'medicine' } },
  { id: 'first-pet',      kind: 'first', rarity: 'common',
    title: 'First Pet', hint: 'first tap on his little head.',
    art: { icon: 'heart', ...ROSE },
    predicate: { type: 'first', of: 'pet' } },
  { id: 'first-nudge',    kind: 'first', rarity: 'common',
    title: 'First Eren Sent', hint: 'first time you sent Eren to your partner.',
    art: { icon: 'heart', ...PINK },
    predicate: { type: 'first', of: 'nudge' } },
  { id: 'first-wish',     kind: 'first', rarity: 'rare',
    title: 'First Wish', hint: 'the day you listened to what Eren wanted.',
    art: { icon: 'wish', ...GOLD },
    predicate: { type: 'first', of: 'wish' } },
  { id: 'first-minigame', kind: 'first', rarity: 'common',
    title: 'First Game', hint: 'your first minigame finish.',
    art: { icon: 'yarn', ...CREAM },
    predicate: { type: 'first', of: 'minigame' } },
  { id: 'first-message',  kind: 'first', rarity: 'common',
    title: 'First Love Note', hint: 'first message in the journal.',
    art: { icon: 'heart', ...ROSE },
    predicate: { type: 'first', of: 'message' } },
  { id: 'first-mood',     kind: 'first', rarity: 'common',
    title: 'First Mood', hint: 'first day you checked in with how you felt.',
    art: { icon: 'person', ...CREAM },
    predicate: { type: 'first', of: 'mood' } },
  { id: 'first-day',      kind: 'first', rarity: 'common',
    title: 'Day One', hint: 'the day Eren moved in.',
    art: { icon: 'cake', ...CREAM },
    predicate: { type: 'first', of: 'day' } },

  // ── Cumulative cares (5) ──────────────────────────────────────────────────
  { id: 'cares-10',  kind: 'cumulative', rarity: 'common',
    title: 'Ten Cares', hint: 'ten little acts of care.',
    art: { icon: 'heart', ...GOLD },
    predicate: { type: 'cares', count: 10 } },
  { id: 'cares-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Cares', hint: 'fifty quiet moments looking after him.',
    art: { icon: 'heart', ...GOLD },
    predicate: { type: 'cares', count: 50 } },
  { id: 'cares-100', kind: 'cumulative', rarity: 'rare',
    title: 'Hundred Cares', hint: 'a hundred small kindnesses.',
    art: { icon: 'heart', ...GOLD },
    predicate: { type: 'cares', count: 100 } },
  { id: 'cares-250', kind: 'cumulative', rarity: 'epic',
    title: 'Two-Fifty Cares', hint: 'two hundred fifty. that\'s a lot of love.',
    art: { icon: 'heart', ...GOLD },
    predicate: { type: 'cares', count: 250 } },
  { id: 'cares-500', kind: 'cumulative', rarity: 'epic',
    title: 'Five Hundred Cares', hint: 'five hundred. he\'ll never forget.',
    art: { icon: 'heart', ...RUBY },
    predicate: { type: 'cares', count: 500 } },

  // ── Per-metric cumulative (10) ───────────────────────────────────────────
  { id: 'feeds-10',     kind: 'cumulative', rarity: 'common',
    title: 'Ten Meals',  hint: 'ten meals served.',
    art: { icon: 'drumstick', ...GOLD },
    predicate: { type: 'metric', metric: 'feed', count: 10 } },
  { id: 'feeds-50',     kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Meals', hint: 'fifty meals later. a happy belly.',
    art: { icon: 'drumstick', ...GOLD },
    predicate: { type: 'metric', metric: 'feed', count: 50 } },
  { id: 'plays-10',     kind: 'cumulative', rarity: 'common',
    title: 'Ten Plays',  hint: 'ten play sessions in the books.',
    art: { icon: 'yarn', ...PINK },
    predicate: { type: 'metric', metric: 'play', count: 10 } },
  { id: 'plays-50',     kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Plays', hint: 'fifty rounds of zoomies.',
    art: { icon: 'yarn', ...PINK },
    predicate: { type: 'metric', metric: 'play', count: 50 } },
  { id: 'sleeps-10',    kind: 'cumulative', rarity: 'common',
    title: 'Ten Naps',   hint: 'ten naps tucked in.',
    art: { icon: 'moon', ...INDIGO },
    predicate: { type: 'metric', metric: 'sleep', count: 10 } },
  { id: 'sleeps-50',    kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Naps', hint: 'fifty cozy bedtimes.',
    art: { icon: 'moon', ...INDIGO },
    predicate: { type: 'metric', metric: 'sleep', count: 50 } },
  { id: 'washes-10',    kind: 'cumulative', rarity: 'common',
    title: 'Ten Baths',  hint: 'ten splashy baths.',
    art: { icon: 'bath', ...SKY },
    predicate: { type: 'metric', metric: 'wash', count: 10 } },
  { id: 'washes-50',    kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Baths', hint: 'fifty clean coats.',
    art: { icon: 'bath', ...SKY },
    predicate: { type: 'metric', metric: 'wash', count: 50 } },
  { id: 'medicines-10', kind: 'cumulative', rarity: 'rare',
    title: 'Ten Cures',  hint: 'ten times you nursed him back.',
    art: { icon: 'pill', ...GREEN },
    predicate: { type: 'metric', metric: 'medicine', count: 10 } },
  { id: 'medicines-25', kind: 'cumulative', rarity: 'epic',
    title: 'Twenty-Five Cures', hint: 'twenty-five rescues.',
    art: { icon: 'pill', ...GREEN },
    predicate: { type: 'metric', metric: 'medicine', count: 25 } },

  // ── Wishes cumulative (4) ────────────────────────────────────────────────
  { id: 'wishes-5',   kind: 'cumulative', rarity: 'common',
    title: 'Five Wishes',  hint: 'five wishes listened to.',
    art: { icon: 'wish', ...GOLD },
    predicate: { type: 'wishes', count: 5 } },
  { id: 'wishes-25',  kind: 'cumulative', rarity: 'rare',
    title: 'Twenty-Five Wishes', hint: 'twenty-five granted little wants.',
    art: { icon: 'wish', ...GOLD },
    predicate: { type: 'wishes', count: 25 } },
  { id: 'wishes-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Wishes', hint: 'fifty wishes — half a hundred.',
    art: { icon: 'wish', ...GOLD },
    predicate: { type: 'wishes', count: 50 } },
  { id: 'wishes-100', kind: 'cumulative', rarity: 'epic',
    title: 'Hundred Wishes', hint: 'one hundred. you really listen.',
    art: { icon: 'wish', ...RUBY },
    predicate: { type: 'wishes', count: 100 } },

  // ── Nudges traded (3) ────────────────────────────────────────────────────
  { id: 'nudges-10',  kind: 'cumulative', rarity: 'common',
    title: 'Ten Sent Erens', hint: 'ten little Erens flying between you.',
    art: { icon: 'heart', ...PINK },
    predicate: { type: 'nudges', count: 10 } },
  { id: 'nudges-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Sent Erens', hint: 'fifty quick affections.',
    art: { icon: 'heart', ...PINK },
    predicate: { type: 'nudges', count: 50 } },
  { id: 'nudges-100', kind: 'cumulative', rarity: 'epic',
    title: 'Hundred Sent Erens', hint: 'one hundred little notes via him.',
    art: { icon: 'heart', ...PINK },
    predicate: { type: 'nudges', count: 100 } },

  // ── Minigames cumulative (3) ─────────────────────────────────────────────
  { id: 'minigames-10',  kind: 'cumulative', rarity: 'common',
    title: 'Ten Games',  hint: 'ten minigames cleared.',
    art: { icon: 'yarn', ...CREAM },
    predicate: { type: 'minigames', count: 10 } },
  { id: 'minigames-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Games', hint: 'fifty minigames mastered.',
    art: { icon: 'yarn', ...CREAM },
    predicate: { type: 'minigames', count: 50 } },
  { id: 'minigames-100', kind: 'cumulative', rarity: 'epic',
    title: 'Hundred Games', hint: 'one hundred. you live for these.',
    art: { icon: 'yarn', ...CREAM },
    predicate: { type: 'minigames', count: 100 } },

  // ── Streaks (4) ──────────────────────────────────────────────────────────
  { id: 'streak-3',  kind: 'streak', rarity: 'common',
    title: 'Three-Day Streak', hint: 'three days in a row of care.',
    art: { icon: 'heart', ...GOLD },
    predicate: { type: 'streak', days: 3 } },
  { id: 'streak-7',  kind: 'streak', rarity: 'rare',
    title: 'One-Week Streak', hint: 'a full week, never missed.',
    art: { icon: 'heart', ...GOLD },
    predicate: { type: 'streak', days: 7 } },
  { id: 'streak-14', kind: 'streak', rarity: 'rare',
    title: 'Two-Week Streak', hint: 'two weeks of showing up.',
    art: { icon: 'heart', ...RUBY },
    predicate: { type: 'streak', days: 14 } },
  { id: 'streak-30', kind: 'streak', rarity: 'epic',
    title: 'Month-Long Streak', hint: 'thirty unbroken days.',
    art: { icon: 'heart', ...RUBY },
    predicate: { type: 'streak', days: 30 } },

  // ── Calendar (7) ─────────────────────────────────────────────────────────
  { id: 'app-week-1',   kind: 'calendar', rarity: 'common',
    title: 'First Week', hint: 'one week with Eren.',
    art: { icon: 'cake', ...CREAM },
    predicate: { type: 'calendar', when: 'app_week_1' } },
  { id: 'app-month-1',  kind: 'calendar', rarity: 'common',
    title: 'One Month', hint: 'a whole month with this little guy.',
    art: { icon: 'cake', ...CREAM },
    predicate: { type: 'calendar', when: 'app_month_1' } },
  { id: 'app-month-3',  kind: 'calendar', rarity: 'rare',
    title: 'Three Months', hint: 'three months. routine, now.',
    art: { icon: 'cake', ...GOLD },
    predicate: { type: 'calendar', when: 'app_month_3' } },
  { id: 'app-month-6',  kind: 'calendar', rarity: 'rare',
    title: 'Half a Year', hint: 'six months of looking after him together.',
    art: { icon: 'cake', ...GOLD },
    predicate: { type: 'calendar', when: 'app_month_6' } },
  { id: 'app-year-1',   kind: 'calendar', rarity: 'epic',
    title: 'One Year', hint: 'one full year with Eren in the house.',
    art: { icon: 'cake', ...RUBY },
    predicate: { type: 'calendar', when: 'app_year_1' } },
  { id: 'eren-birthday',       kind: 'calendar', rarity: 'rare',
    title: 'Eren\'s Birthday', hint: 'his special day.',
    art: { icon: 'cake', ...PINK },
    predicate: { type: 'calendar', when: 'eren_birthday' } },
  { id: 'couple-anniversary',  kind: 'calendar', rarity: 'epic',
    title: 'Anniversary', hint: 'your anniversary, marked.',
    art: { icon: 'heart', ...RUBY },
    predicate: { type: 'calendar', when: 'couple_anniversary' } },

  // ── Couple (5) ───────────────────────────────────────────────────────────
  { id: 'couple-paired',           kind: 'couple', rarity: 'common',
    title: 'A Pair', hint: 'the day the two of you paired up here.',
    art: { icon: 'heart', ...ROSE },
    predicate: { type: 'couple', kind: 'first_paired' } },
  { id: 'couple-both-cared',       kind: 'couple', rarity: 'common',
    title: 'Tag Team', hint: 'first day you BOTH cared for him.',
    art: { icon: 'heart', ...PINK },
    predicate: { type: 'couple', kind: 'both_cared_same_day' } },
  { id: 'couple-both-cared-7',     kind: 'couple', rarity: 'rare',
    title: 'A Week as Two', hint: 'a full week where you both showed up.',
    art: { icon: 'heart', ...PINK },
    predicate: { type: 'couple', kind: 'both_cared_7_streak' } },
  { id: 'couple-nudges-traded-10', kind: 'couple', rarity: 'common',
    title: 'Ten Erens Each', hint: 'you\'ve each sent him at least ten times.',
    art: { icon: 'heart', ...ROSE },
    predicate: { type: 'couple', kind: 'nudges_traded_10' } },
  { id: 'couple-nudges-traded-50', kind: 'couple', rarity: 'rare',
    title: 'Fifty Erens Each', hint: 'fifty each. you both speak through him.',
    art: { icon: 'heart', ...ROSE },
    predicate: { type: 'couple', kind: 'nudges_traded_50' } },

  // ── Rare (4) ─────────────────────────────────────────────────────────────
  { id: 'rare-all-minigames',  kind: 'rare', rarity: 'epic',
    title: 'Game Master', hint: 'you\'ve played every minigame at least once.',
    art: { icon: 'yarn', ...RUBY },
    predicate: { type: 'rare', kind: 'all_minigames' } },
  { id: 'rare-all-rooms-day',  kind: 'rare', rarity: 'rare',
    title: 'Five-Room Day', hint: 'fed, washed, played, slept, cured — all in one day.',
    art: { icon: 'gift', ...GOLD },
    predicate: { type: 'rare', kind: 'all_rooms_in_day' } },
  { id: 'rare-all-foods-week', kind: 'rare', rarity: 'epic',
    title: 'Full Pantry Week', hint: 'every food in the fridge fed within seven days.',
    art: { icon: 'drumstick', ...RUBY },
    predicate: { type: 'rare', kind: 'all_foods_in_week' } },
  { id: 'rare-perfect-week',   kind: 'rare', rarity: 'epic',
    title: 'Perfect Week', hint: 'a week where every single day had care.',
    art: { icon: 'heart', ...RUBY },
    predicate: { type: 'rare', kind: 'perfect_week' } },
]

/** Lookup by id — small linear scan; catalogue is tiny. */
export function frameById(id: string): MemoryFrame | null {
  return MEMORY_FRAMES.find(f => f.id === id) ?? null
}
