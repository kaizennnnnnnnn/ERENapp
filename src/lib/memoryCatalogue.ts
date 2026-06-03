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

export type FrameKind = 'welcome' | 'first' | 'cumulative' | 'streak' | 'calendar' | 'couple' | 'rare'
export type Rarity    = 'common' | 'rare' | 'epic'

/** Care action types tracked in the interactions table. */
export type ActionType = 'feed' | 'play' | 'sleep' | 'wash' | 'medicine'

/** Compact icon ref. MemoryFrameCanvas maps these to actual pixel grids
 *  from PixelIcons.tsx. Keeping the catalogue free of React imports means
 *  it can be tree-shaken into server bundles (used by /api/decay).
 *
 *  Expanded in PR 8.5 to give each frame more visual identity — see the
 *  catalogue entries below for which icon pairs with which milestone. */
export type FrameIcon =
  | 'drumstick' | 'yarn' | 'moon' | 'bath' | 'pill'
  | 'heart' | 'wish' | 'cake' | 'person' | 'gift'
  | 'paw' | 'star' | 'fire' | 'crown' | 'lightning'
  | 'fish' | 'clock' | 'envelope' | 'controller' | 'sparkles'
  | 'crown_couple' | 'catface' | 'house' | 'stethoscope' | 'swords'

export interface FrameArt {
  icon: FrameIcon
  bg: string
  accent?: string
  /** Optional 1–3 character pip stamped in the corner of the frame (e.g.
   *  "10", "50", "1W", "3D"). Lets every cumulative + streak + calendar
   *  frame read distinctly without 50 unique pixel drawings. */
  badge?: string
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
  /** Seed frames inserted unconditionally by the catchup endpoint (PR 8)
   *  with unlocked_at = household.created_at. Never fire via on-event or
   *  sweep; both evaluators skip this predicate by design. */
  | { type: 'seed' }

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
  // ── Welcome seeds (1) ─ stamped by the catchup endpoint so a brand-new
  //                       wall always has at least one filled frame.
  { id: 'welcome-here', kind: 'welcome', rarity: 'common',
    title: 'Welcome',   hint: 'the day Eren came home.',
    art: { icon: 'house', ...CREAM },
    predicate: { type: 'seed' } },

  // ── Firsts (12) ─ each thematic icon + "1ST" badge
  { id: 'first-feed',     kind: 'first', rarity: 'common',
    title: 'First Meal', hint: 'the first time you fed Eren.',
    art: { icon: 'drumstick', ...GOLD, badge: '1ST' },
    predicate: { type: 'first', of: 'feed' } },
  { id: 'first-play',     kind: 'first', rarity: 'common',
    title: 'First Play', hint: 'first time the yarn came out.',
    art: { icon: 'yarn', ...PINK, badge: '1ST' },
    predicate: { type: 'first', of: 'play' } },
  { id: 'first-sleep',    kind: 'first', rarity: 'common',
    title: 'First Nap', hint: 'first bedtime tuck-in.',
    art: { icon: 'moon', ...INDIGO, badge: '1ST' },
    predicate: { type: 'first', of: 'sleep' } },
  { id: 'first-wash',     kind: 'first', rarity: 'common',
    title: 'First Bath', hint: 'first bubbles in the tub.',
    art: { icon: 'bath', ...SKY, badge: '1ST' },
    predicate: { type: 'first', of: 'wash' } },
  { id: 'first-medicine', kind: 'first', rarity: 'common',
    title: 'First Vet Visit', hint: 'first time you took care of a tummy ache.',
    art: { icon: 'stethoscope', ...GREEN, badge: '1ST' },
    predicate: { type: 'first', of: 'medicine' } },
  { id: 'first-pet',      kind: 'first', rarity: 'common',
    title: 'First Pet', hint: 'first tap on his little head.',
    art: { icon: 'paw', ...ROSE, badge: '1ST' },
    predicate: { type: 'first', of: 'pet' } },
  { id: 'first-nudge',    kind: 'first', rarity: 'common',
    title: 'First Eren Sent', hint: 'first time you sent Eren to your partner.',
    art: { icon: 'envelope', ...PINK, badge: '1ST' },
    predicate: { type: 'first', of: 'nudge' } },
  { id: 'first-wish',     kind: 'first', rarity: 'rare',
    title: 'First Wish', hint: 'the day you listened to what Eren wanted.',
    art: { icon: 'wish', ...GOLD, badge: '1ST' },
    predicate: { type: 'first', of: 'wish' } },
  { id: 'first-minigame', kind: 'first', rarity: 'common',
    title: 'First Game', hint: 'your first minigame finish.',
    art: { icon: 'controller', ...CREAM, badge: '1ST' },
    predicate: { type: 'first', of: 'minigame' } },
  { id: 'first-message',  kind: 'first', rarity: 'common',
    title: 'First Love Note', hint: 'first message in the journal.',
    art: { icon: 'heart', ...ROSE, badge: '1ST' },
    predicate: { type: 'first', of: 'message' } },
  { id: 'first-mood',     kind: 'first', rarity: 'common',
    title: 'First Mood', hint: 'first day you checked in with how you felt.',
    art: { icon: 'catface', ...CREAM, badge: '1ST' },
    predicate: { type: 'first', of: 'mood' } },
  { id: 'first-day',      kind: 'first', rarity: 'common',
    title: 'Day One', hint: 'the day Eren moved in.',
    art: { icon: 'sparkles', ...CREAM, badge: '1ST' },
    predicate: { type: 'first', of: 'day' } },

  // ── Cumulative cares (5) ─ same heart family + count badges
  { id: 'cares-10',  kind: 'cumulative', rarity: 'common',
    title: 'Ten Cares', hint: 'ten little acts of care.',
    art: { icon: 'heart', ...GOLD, badge: '10' },
    predicate: { type: 'cares', count: 10 } },
  { id: 'cares-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Cares', hint: 'fifty quiet moments looking after him.',
    art: { icon: 'heart', ...GOLD, badge: '50' },
    predicate: { type: 'cares', count: 50 } },
  { id: 'cares-100', kind: 'cumulative', rarity: 'rare',
    title: 'Hundred Cares', hint: 'a hundred small kindnesses.',
    art: { icon: 'heart', ...GOLD, badge: '100' },
    predicate: { type: 'cares', count: 100 } },
  { id: 'cares-250', kind: 'cumulative', rarity: 'epic',
    title: 'Two-Fifty Cares', hint: 'two hundred fifty. that\'s a lot of love.',
    art: { icon: 'crown', ...GOLD, badge: '250' },
    predicate: { type: 'cares', count: 250 } },
  { id: 'cares-500', kind: 'cumulative', rarity: 'epic',
    title: 'Five Hundred Cares', hint: 'five hundred. he\'ll never forget.',
    art: { icon: 'crown', ...RUBY, badge: '500' },
    predicate: { type: 'cares', count: 500 } },

  // ── Per-metric (10) ─ thematic icon + count badge
  { id: 'feeds-10',     kind: 'cumulative', rarity: 'common',
    title: 'Ten Meals',  hint: 'ten meals served.',
    art: { icon: 'drumstick', ...GOLD, badge: '10' },
    predicate: { type: 'metric', metric: 'feed', count: 10 } },
  { id: 'feeds-50',     kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Meals', hint: 'fifty meals later. a happy belly.',
    art: { icon: 'fish', ...GOLD, badge: '50' },
    predicate: { type: 'metric', metric: 'feed', count: 50 } },
  { id: 'plays-10',     kind: 'cumulative', rarity: 'common',
    title: 'Ten Plays',  hint: 'ten play sessions in the books.',
    art: { icon: 'yarn', ...PINK, badge: '10' },
    predicate: { type: 'metric', metric: 'play', count: 10 } },
  { id: 'plays-50',     kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Plays', hint: 'fifty rounds of zoomies.',
    art: { icon: 'paw', ...PINK, badge: '50' },
    predicate: { type: 'metric', metric: 'play', count: 50 } },
  { id: 'sleeps-10',    kind: 'cumulative', rarity: 'common',
    title: 'Ten Naps',   hint: 'ten naps tucked in.',
    art: { icon: 'moon', ...INDIGO, badge: '10' },
    predicate: { type: 'metric', metric: 'sleep', count: 10 } },
  { id: 'sleeps-50',    kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Naps', hint: 'fifty cozy bedtimes.',
    art: { icon: 'star', ...INDIGO, badge: '50' },
    predicate: { type: 'metric', metric: 'sleep', count: 50 } },
  { id: 'washes-10',    kind: 'cumulative', rarity: 'common',
    title: 'Ten Baths',  hint: 'ten splashy baths.',
    art: { icon: 'bath', ...SKY, badge: '10' },
    predicate: { type: 'metric', metric: 'wash', count: 10 } },
  { id: 'washes-50',    kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Baths', hint: 'fifty clean coats.',
    art: { icon: 'sparkles', ...SKY, badge: '50' },
    predicate: { type: 'metric', metric: 'wash', count: 50 } },
  { id: 'medicines-10', kind: 'cumulative', rarity: 'rare',
    title: 'Ten Cures',  hint: 'ten times you nursed him back.',
    art: { icon: 'pill', ...GREEN, badge: '10' },
    predicate: { type: 'metric', metric: 'medicine', count: 10 } },
  { id: 'medicines-25', kind: 'cumulative', rarity: 'epic',
    title: 'Twenty-Five Cures', hint: 'twenty-five rescues.',
    art: { icon: 'stethoscope', ...GREEN, badge: '25' },
    predicate: { type: 'metric', metric: 'medicine', count: 25 } },

  // ── Wishes (4)
  { id: 'wishes-5',   kind: 'cumulative', rarity: 'common',
    title: 'Five Wishes',  hint: 'five wishes listened to.',
    art: { icon: 'wish', ...GOLD, badge: '5' },
    predicate: { type: 'wishes', count: 5 } },
  { id: 'wishes-25',  kind: 'cumulative', rarity: 'rare',
    title: 'Twenty-Five Wishes', hint: 'twenty-five granted little wants.',
    art: { icon: 'star', ...GOLD, badge: '25' },
    predicate: { type: 'wishes', count: 25 } },
  { id: 'wishes-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Wishes', hint: 'fifty wishes — half a hundred.',
    art: { icon: 'sparkles', ...GOLD, badge: '50' },
    predicate: { type: 'wishes', count: 50 } },
  { id: 'wishes-100', kind: 'cumulative', rarity: 'epic',
    title: 'Hundred Wishes', hint: 'one hundred. you really listen.',
    art: { icon: 'crown', ...RUBY, badge: '100' },
    predicate: { type: 'wishes', count: 100 } },

  // ── Nudges traded (3) ─ envelope family
  { id: 'nudges-10',  kind: 'cumulative', rarity: 'common',
    title: 'Ten Sent Erens', hint: 'ten little Erens flying between you.',
    art: { icon: 'envelope', ...PINK, badge: '10' },
    predicate: { type: 'nudges', count: 10 } },
  { id: 'nudges-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Sent Erens', hint: 'fifty quick affections.',
    art: { icon: 'envelope', ...PINK, badge: '50' },
    predicate: { type: 'nudges', count: 50 } },
  { id: 'nudges-100', kind: 'cumulative', rarity: 'epic',
    title: 'Hundred Sent Erens', hint: 'one hundred little notes via him.',
    art: { icon: 'envelope', ...RUBY, badge: '100' },
    predicate: { type: 'nudges', count: 100 } },

  // ── Minigames (3) ─ controller family
  { id: 'minigames-10',  kind: 'cumulative', rarity: 'common',
    title: 'Ten Games',  hint: 'ten minigames cleared.',
    art: { icon: 'controller', ...CREAM, badge: '10' },
    predicate: { type: 'minigames', count: 10 } },
  { id: 'minigames-50',  kind: 'cumulative', rarity: 'rare',
    title: 'Fifty Games', hint: 'fifty minigames mastered.',
    art: { icon: 'controller', ...CREAM, badge: '50' },
    predicate: { type: 'minigames', count: 50 } },
  { id: 'minigames-100', kind: 'cumulative', rarity: 'epic',
    title: 'Hundred Games', hint: 'one hundred. you live for these.',
    art: { icon: 'crown', ...CREAM, badge: '100' },
    predicate: { type: 'minigames', count: 100 } },

  // ── Streaks (4) ─ fire family + day badges
  { id: 'streak-3',  kind: 'streak', rarity: 'common',
    title: 'Three-Day Streak', hint: 'three days in a row of care.',
    art: { icon: 'fire', ...GOLD, badge: '3D' },
    predicate: { type: 'streak', days: 3 } },
  { id: 'streak-7',  kind: 'streak', rarity: 'rare',
    title: 'One-Week Streak', hint: 'a full week, never missed.',
    art: { icon: 'fire', ...GOLD, badge: '7D' },
    predicate: { type: 'streak', days: 7 } },
  { id: 'streak-14', kind: 'streak', rarity: 'rare',
    title: 'Two-Week Streak', hint: 'two weeks of showing up.',
    art: { icon: 'fire', ...RUBY, badge: '14D' },
    predicate: { type: 'streak', days: 14 } },
  { id: 'streak-30', kind: 'streak', rarity: 'epic',
    title: 'Month-Long Streak', hint: 'thirty unbroken days.',
    art: { icon: 'lightning', ...RUBY, badge: '30D' },
    predicate: { type: 'streak', days: 30 } },

  // ── Calendar (7) ─ clock / cake family + time badges
  { id: 'app-week-1',  kind: 'calendar', rarity: 'common',
    title: 'First Week', hint: 'one week with Eren.',
    art: { icon: 'clock', ...CREAM, badge: '1W' },
    predicate: { type: 'calendar', when: 'app_week_1' } },
  { id: 'app-month-1', kind: 'calendar', rarity: 'common',
    title: 'One Month', hint: 'a whole month with this little guy.',
    art: { icon: 'clock', ...CREAM, badge: '1M' },
    predicate: { type: 'calendar', when: 'app_month_1' } },
  { id: 'app-month-3', kind: 'calendar', rarity: 'rare',
    title: 'Three Months', hint: 'three months. routine, now.',
    art: { icon: 'clock', ...GOLD, badge: '3M' },
    predicate: { type: 'calendar', when: 'app_month_3' } },
  { id: 'app-month-6', kind: 'calendar', rarity: 'rare',
    title: 'Half a Year', hint: 'six months of looking after him together.',
    art: { icon: 'clock', ...GOLD, badge: '6M' },
    predicate: { type: 'calendar', when: 'app_month_6' } },
  { id: 'app-year-1',  kind: 'calendar', rarity: 'epic',
    title: 'One Year', hint: 'one full year with Eren in the house.',
    art: { icon: 'crown', ...RUBY, badge: '1Y' },
    predicate: { type: 'calendar', when: 'app_year_1' } },
  { id: 'eren-birthday',      kind: 'calendar', rarity: 'rare',
    title: 'Eren\'s Birthday', hint: 'his special day.',
    art: { icon: 'cake', ...PINK, badge: 'B' },
    predicate: { type: 'calendar', when: 'eren_birthday' } },
  { id: 'couple-anniversary', kind: 'calendar', rarity: 'epic',
    title: 'Anniversary', hint: 'your anniversary, marked.',
    art: { icon: 'crown_couple', ...RUBY },
    predicate: { type: 'calendar', when: 'couple_anniversary' } },

  // ── Couple (5)
  { id: 'couple-paired',           kind: 'couple', rarity: 'common',
    title: 'A Pair', hint: 'the day the two of you paired up here.',
    art: { icon: 'crown_couple', ...ROSE },
    predicate: { type: 'couple', kind: 'first_paired' } },
  { id: 'couple-both-cared',       kind: 'couple', rarity: 'common',
    title: 'Tag Team', hint: 'first day you BOTH cared for him.',
    art: { icon: 'crown_couple', ...PINK, badge: '2' },
    predicate: { type: 'couple', kind: 'both_cared_same_day' } },
  { id: 'couple-both-cared-7',     kind: 'couple', rarity: 'rare',
    title: 'A Week as Two', hint: 'a full week where you both showed up.',
    art: { icon: 'crown_couple', ...PINK, badge: '7D' },
    predicate: { type: 'couple', kind: 'both_cared_7_streak' } },
  { id: 'couple-nudges-traded-10', kind: 'couple', rarity: 'common',
    title: 'Ten Erens Each', hint: 'you\'ve each sent him at least ten times.',
    art: { icon: 'envelope', ...ROSE, badge: '10' },
    predicate: { type: 'couple', kind: 'nudges_traded_10' } },
  { id: 'couple-nudges-traded-50', kind: 'couple', rarity: 'rare',
    title: 'Fifty Erens Each', hint: 'fifty each. you both speak through him.',
    art: { icon: 'envelope', ...ROSE, badge: '50' },
    predicate: { type: 'couple', kind: 'nudges_traded_50' } },

  // ── Rare (4) ─ special icons + symbols
  { id: 'rare-all-minigames',  kind: 'rare', rarity: 'epic',
    title: 'Game Master', hint: 'you\'ve played every minigame at least once.',
    art: { icon: 'swords', ...RUBY, badge: 'ALL' },
    predicate: { type: 'rare', kind: 'all_minigames' } },
  { id: 'rare-all-rooms-day',  kind: 'rare', rarity: 'rare',
    title: 'Five-Room Day', hint: 'fed, washed, played, slept, cured — all in one day.',
    art: { icon: 'house', ...GOLD, badge: '5' },
    predicate: { type: 'rare', kind: 'all_rooms_in_day' } },
  { id: 'rare-all-foods-week', kind: 'rare', rarity: 'epic',
    title: 'Full Pantry Week', hint: 'every food in the fridge fed within seven days.',
    art: { icon: 'gift', ...RUBY, badge: 'ALL' },
    predicate: { type: 'rare', kind: 'all_foods_in_week' } },
  { id: 'rare-perfect-week',   kind: 'rare', rarity: 'epic',
    title: 'Perfect Week', hint: 'a week where every single day had care.',
    art: { icon: 'star', ...RUBY, badge: 'PRF' },
    predicate: { type: 'rare', kind: 'perfect_week' } },
]

/** Lookup by id — small linear scan; catalogue is tiny. */
export function frameById(id: string): MemoryFrame | null {
  return MEMORY_FRAMES.find(f => f.id === id) ?? null
}
