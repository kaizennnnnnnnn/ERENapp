// ═════════════════════════════════════════════════════════════════════════════
// DAILY WISH SYSTEM — Phase 3
//
// One wish rotates per local day, deterministic from (date, household). Both
// partners see the same wish on the same date. A wish is "granted" when the
// matching action lands (feed a specific food, finish a minigame, send a
// nudge, etc). Grants pay coins and feed the Memory Wall lifetime counter.
//
// The list itself is APPEND-ONLY — reordering or deleting entries shifts every
// household's history because rotation hashes against indices.
//
// FLAVOR-ONLY lines from the user's catalogue do NOT live here — they go in
// src/lib/flavorLines.ts (PR 5). The two files are siblings; this one only
// holds the wishes that have a real grant trigger.
// ═════════════════════════════════════════════════════════════════════════════

import type { FoodKey } from '@/types'

export type WishCategory = 'food' | 'activity' | 'mood' | 'couple' | 'rare'

/** Match grammar — string keys parsed by matchWish().
 *
 *   feed:<foodKey>          e.g. 'feed:salmon'
 *   feed:any                any food fed today
 *   feed:both               feed:any when needsBothActive=true
 *   feed:3unique            three distinct food keys today
 *   feed:all_inventory      every food in the fridge today
 *   play:any                any care play action OR any minigame completion
 *   play:<minigameId>       specific minigame
 *   wash | sleep | medicine the matching ACTION_CONFIGS action_type
 *   school                 a Serbian lesson finished today (eren:lesson-done)
 *   nudge:<nudgeId>         specific nudge sent (or partner sent, when needsBothActive=true)
 *   nudge:any               any nudge
 *   care:any                any of feed|play|sleep|wash|medicine
 *   care:5plus              5+ care actions in the day
 */
export type WishMatch = string

export interface Wish {
  id: string
  text: string
  category: WishCategory
  match: WishMatch
  needsLeader: boolean
  needsBothActive: boolean
  cooldownDays: number
  missingInventory: boolean
  coinReward: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Catalogue (append-only).
// ─────────────────────────────────────────────────────────────────────────────

export const WISHES: Wish[] = [
  // ── Food cravings — standard (18) ─────────────────────────────────────────
  { id: 'food-salmon',  text: "i'm craving salmon today.",
    category: 'food', match: 'feed:salmon',  needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-kibble',  text: "i want kibble. the crunchy kind.",
    category: 'food', match: 'feed:kibble',  needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-fish',    text: "could i have some fishi, please?",
    category: 'food', match: 'feed:fish',    needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-treat',   text: "a treattt. just one. promise.",
    category: 'food', match: 'feed:treat',   needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-tuna',    text: "tuna. please. tuna.",
    category: 'food', match: 'feed:tuna',    needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-steak',   text: "steaki day? steak day.",
    category: 'food', match: 'feed:steak',   needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-cream',   text: "some creami would be perfect right now.",
    category: 'food', match: 'feed:cream',   needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-biscuit', text: "can i have a biscuit pls pls?",
    category: 'food', match: 'feed:biscuit', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-shrimp',  text: "oi  i want shrimp.",
    category: 'food', match: 'feed:shrimp',  needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-chicken', text: "i miss the chicken.",
    category: 'food', match: 'feed:chicken', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-sausage', text: "sausage… pretty please?",
    category: 'food', match: 'feed:sausage', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-milk',    text: "some warm milk would be nice.",
    category: 'food', match: 'feed:milk',    needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-cheese',  text: " cheese day!",
    category: 'food', match: 'feed:cheese',  needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-yogurt',  text: "i want yogurt. the pink one.",
    category: 'food', match: 'feed:yogurt',  needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-cake',    text: "cake. don't tell anyone.",
    category: 'food', match: 'feed:cake',    needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-sushi',   text: "i'm in a sushi mood today.",
    category: 'food', match: 'feed:sushi',   needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-sardine', text: "i'm dreaming about sardines.",
    category: 'food', match: 'feed:sardine', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-egg',     text: "an egg would be perfect right now.",
    category: 'food', match: 'feed:egg',     needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },

  // ── Food cravings — sweet (4, added Phase 3) ──────────────────────────────
  { id: 'food-monster',    text: "Can i have a Monster zero suga one ",
    category: 'food', match: 'feed:monster',    needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-donut',      text: "Can i have a donut is yum",
    category: 'food', match: 'feed:donut',      needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-cookie',     text: "Cookie now..I need",
    category: 'food', match: 'feed:cookie',     needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'food-jelly-caka', text: "JELLY CAKA PLS",
    category: 'food', match: 'feed:jelly_caka', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },

  // ── Activity (8) ──────────────────────────────────────────────────────────
  { id: 'act-bath',         text: "could someone give me a bath? i feel sticky.",
    category: 'activity', match: 'wash', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'act-play-leader',  text: "play with me {leader}.",
    category: 'activity', match: 'play:any', needsLeader: true, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'act-sleepi',       text: "i'm sleepi. tuck me in early today.",
    category: 'activity', match: 'sleep', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'act-long-nap',     text: "i want a longg napppp. wake me at dinner.",
    category: 'activity', match: 'sleep', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'act-vet',          text: "i feel weird. take me to the vet.",
    category: 'activity', match: 'medicine', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'act-brush',        text: "please brush me. somewhere itches.",
    category: 'activity', match: 'wash', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'act-minigame-any', text: "i wanna play some mini games",
    category: 'activity', match: 'play:any', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'act-tictactoe',    text: "lets play the X O i never lose in that game ",
    category: 'activity', match: 'play:tic_tac_toe', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },

  // ── Mood (10) ─────────────────────────────────────────────────────────────
  { id: 'mood-company', text: "i just want company today.",
    category: 'mood', match: 'play:any', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-pet',     text: "pet me until i purr.",
    category: 'mood', match: 'play:any', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-centre',  text: "i want to be the centre of attention.",
    category: 'mood', match: 'play:any', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-bored',   text: "i'm bored. surprise me.",
    category: 'mood', match: 'play:any', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-quiet',   text: "a quiet day, please. don't wake me unless it's food.",
    category: 'mood', match: 'sleep', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-kisses',  text: "i want kisses. lots of them.",
    category: 'mood', match: 'nudge:kiss', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-lazy',    text: "i'm feeling lazy. let me sleep.",
    category: 'mood', match: 'sleep', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-sunbeam', text: "i want to lie in the sun. open the curtain.",
    category: 'mood', match: 'sleep', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-window',  text: "i want to watch the window today.",
    category: 'mood', match: 'sleep', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
  { id: 'mood-lap',     text: "can i sit on someone's lap forever?",
    category: 'mood', match: 'play:any', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },

  // ── Couple — both partners (6) ────────────────────────────────────────────
  { id: 'couple-see-both', text: "i want to see BOTH of you today.",
    category: 'couple', match: 'care:any',      needsLeader: false, needsBothActive: true, cooldownDays: 0, missingInventory: false, coinReward: 10 },
  { id: 'couple-loveyou',  text: "tell each other you love each other. in front of me.",
    category: 'couple', match: 'nudge:loveyou', needsLeader: false, needsBothActive: true, cooldownDays: 0, missingInventory: false, coinReward: 10 },
  { id: 'couple-nice',     text: "send each other something nice today.",
    category: 'couple', match: 'nudge:any',     needsLeader: false, needsBothActive: true, cooldownDays: 0, missingInventory: false, coinReward: 10 },
  { id: 'couple-kiss',     text: "i want a kiss from each of you.",
    category: 'couple', match: 'nudge:kiss',    needsLeader: false, needsBothActive: true, cooldownDays: 0, missingInventory: false, coinReward: 10 },
  { id: 'couple-feed',     text: "both of you, feed me at least once today.",
    category: 'couple', match: 'feed:both',     needsLeader: false, needsBothActive: true, cooldownDays: 0, missingInventory: false, coinReward: 10 },
  { id: 'couple-hug',      text: "i want a hug. one from each of you.",
    category: 'couple', match: 'nudge:any',     needsLeader: false, needsBothActive: true, cooldownDays: 0, missingInventory: false, coinReward: 10 },

  // ── Rare — cooldown-gated (4) ─────────────────────────────────────────────
  { id: 'rare-feast-3',   text: "i want a feast today — three different foods.",
    category: 'rare', match: 'feed:3unique',       needsLeader: false, needsBothActive: false, cooldownDays: 7,  missingInventory: false, coinReward: 15 },
  { id: 'rare-spoil',     text: "spoil me  today. i deserve it.",
    category: 'rare', match: 'care:5plus',         needsLeader: false, needsBothActive: false, cooldownDays: 7,  missingInventory: false, coinReward: 15 },
  { id: 'rare-all-foods', text: "i want every kind of food in my bowl.",
    category: 'rare', match: 'feed:all_inventory', needsLeader: false, needsBothActive: false, cooldownDays: 14, missingInventory: false, coinReward: 25 },
  { id: 'rare-king',      text: "today i am the king of this house.",
    category: 'rare', match: 'care:5plus',         needsLeader: false, needsBothActive: false, cooldownDays: 7,  missingInventory: false, coinReward: 15 },

  // ── Activity — appended later (must stay at the END: rotation hashes on index) ──
  { id: 'act-serbian',    text: "i'm also learning Serbian ALOO",
    category: 'activity', match: 'school', needsLeader: false, needsBothActive: false, cooldownDays: 0, missingInventory: false, coinReward: 5 },
]

// Always-eligible last-resort fallback. Same shape as mood-company but with a
// distinct id so we can spot fallbacks in analytics.
export const FALLBACK_WISH: Wish = {
  id: 'fallback-company',
  text: "i just want company today.",
  category: 'mood', match: 'play:any',
  needsLeader: false, needsBothActive: false,
  cooldownDays: 0, missingInventory: false, coinReward: 5,
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Deterministic rotation.
// ─────────────────────────────────────────────────────────────────────────────

/** djb2 string hash — small, fast, deterministic. */
function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h >>> 0
}

/** YYYY-MM-DD in the household's timezone (or UTC fallback). */
export function dateKey(d: Date, tz: string | null | undefined): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(d) // 'YYYY-MM-DD'
}

export interface EligibilityCtx {
  leaderName: string | null
  viewerName: string
  bothActiveLast48h: boolean
  fridgeKeys: Set<string>
  recentlyShown: Map<string, string> // wishId → last yyyy-mm-dd
  today: string                       // yyyy-mm-dd in household tz
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((da - db) / 86_400_000)
}

// Global floor on how often ANY wish can repeat — even ones with
// cooldownDays=0. Without this, the rotation converges on the same activity
// wish for days at a time when the fridge is sparse: every hash position
// inside the food band gets filtered, spills forward, and lands on the first
// always-eligible non-food wish (act-bath). 7 days × ~25 daily-eligible
// wishes leaves a comfortable margin before the fallback ever fires.
const MIN_REPEAT_GAP_DAYS = 7

export function isEligible(w: Wish, ctx: EligibilityCtx): boolean {
  if (w.missingInventory) return false
  if (w.needsLeader && !ctx.leaderName) return false
  // Leader-referencing wishes should not roll when the viewer IS the leader —
  // "play with me Jovan" addressed to Jovan reads as a self-directed plea.
  if (w.needsLeader && ctx.leaderName === ctx.viewerName) return false
  if (w.needsBothActive && !ctx.bothActiveLast48h) return false

  // Respect the wish's own cooldown AND the global floor — whichever is longer.
  const effectiveCooldown = Math.max(w.cooldownDays, MIN_REPEAT_GAP_DAYS)
  if (effectiveCooldown > 0) {
    const last = ctx.recentlyShown.get(w.id)
    if (last) {
      const days = dayDiff(ctx.today, last)
      if (days < effectiveCooldown) return false
    }
  }

  // Food wishes whose specific key isn't in either fridge skip — showing
  // "i want salmon" with no salmon to give feels punishing.
  if (w.category === 'food' && w.match.startsWith('feed:')) {
    const arg = w.match.slice(5)
    const wildcard = arg === 'any' || arg === 'both' || arg === '3unique' || arg === 'all_inventory'
    if (!wildcard && !ctx.fridgeKeys.has(arg)) return false
  }

  return true
}

/** Returns the wish for a given date + household. Deterministic stepping
 * scans WISHES from the hash-derived starting index forward until one passes
 * eligibility. Both partners compute the same ctx (same household) and
 * converge on the same wish.
 */
export function wishOfTheDay(opts: {
  date: Date
  householdId: string
  tz: string | null | undefined
  ctx: EligibilityCtx
}): Wish {
  const period = dateKey(opts.date, opts.tz)
  const key = `${period}::${opts.householdId}`
  const base = hashStr(key)

  for (let step = 0; step < WISHES.length; step++) {
    const wish = WISHES[(base + step) % WISHES.length]
    if (isEligible(wish, opts.ctx)) return wish
  }
  return FALLBACK_WISH
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Match function — what grants a given wish.
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyActions {
  feeds: FoodKey[]                          // foods YOU fed today
  partnerFeeds: FoodKey[]                   // foods PARTNER fed today
  cares: Array<'feed'|'play'|'sleep'|'wash'|'medicine'>
  partnerCares: Array<'feed'|'play'|'sleep'|'wash'|'medicine'>
  plays: string[]                           // minigame ids YOU completed today
  partnerPlays: string[]
  nudges: Set<string>                       // nudge ids YOU sent today
  partnerNudges: Set<string>
  fridgeKeys: Set<string>                   // union of both fridges
  // Serbian lessons YOU finished today. Lesson completion isn't a DB action
  // type, so (like feeds) only the local session is tracked — partner lessons
  // aren't broadcast. Optional so older callers/snapshots decode unchanged.
  schools?: number
}

export function matchWish(wish: Wish, a: DailyActions): boolean {
  // Bare-string matches first.
  if (wish.match === 'wash')     return a.cares.includes('wash')     || a.partnerCares.includes('wash')
  if (wish.match === 'sleep')    return a.cares.includes('sleep')    || a.partnerCares.includes('sleep')
  if (wish.match === 'medicine') return a.cares.includes('medicine') || a.partnerCares.includes('medicine')
  if (wish.match === 'school')   return (a.schools ?? 0) > 0

  const colon = wish.match.indexOf(':')
  if (colon < 0) return false
  const kind = wish.match.slice(0, colon)
  const arg = wish.match.slice(colon + 1)

  if (kind === 'feed') {
    const all = [...a.feeds, ...a.partnerFeeds]
    if (arg === 'any')           return all.length > 0
    if (arg === 'both')          return a.feeds.length > 0 && a.partnerFeeds.length > 0
    if (arg === '3unique')       return new Set(all).size >= 3
    if (arg === 'all_inventory') {
      if (a.fridgeKeys.size === 0) return false
      const fed = new Set<string>(all)
      const keys = Array.from(a.fridgeKeys)
      for (const k of keys) if (!fed.has(k)) return false
      return true
    }
    return (all as string[]).includes(arg)
  }

  if (kind === 'play') {
    // play matches a play care-action OR any minigame completion.
    const meCounts = a.plays.length > 0 || a.cares.includes('play')
    const partnerCounts = a.partnerPlays.length > 0 || a.partnerCares.includes('play')
    if (arg === 'any') {
      if (wish.needsBothActive) return meCounts && partnerCounts
      return meCounts || partnerCounts
    }
    // Specific minigame id, e.g. 'tic_tac_toe'.
    return a.plays.includes(arg) || a.partnerPlays.includes(arg)
  }

  if (kind === 'nudge') {
    if (wish.needsBothActive) {
      if (arg === 'any') return a.nudges.size > 0 && a.partnerNudges.size > 0
      return a.nudges.has(arg) && a.partnerNudges.has(arg)
    }
    if (arg === 'any') return a.nudges.size > 0 || a.partnerNudges.size > 0
    return a.nudges.has(arg) || a.partnerNudges.has(arg)
  }

  if (kind === 'care') {
    const myCount = a.cares.length
    const both = myCount + a.partnerCares.length
    if (arg === '5plus') return both >= 5
    if (arg === 'any') {
      if (wish.needsBothActive) return myCount > 0 && a.partnerCares.length > 0
      return both > 0
    }
  }

  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hint text — copy used by WishHintBanner inside care rooms.
//    Returns null when the wish has no in-room surface (couple/nudge wishes).
// ─────────────────────────────────────────────────────────────────────────────

export function wishHintRoom(wish: Wish): 'feed' | 'wash' | 'sleep' | 'play' | 'medicine' | null {
  if (wish.match === 'wash')     return 'wash'
  if (wish.match === 'sleep')    return 'sleep'
  if (wish.match === 'medicine') return 'medicine'
  if (wish.match.startsWith('feed:')) return 'feed'
  if (wish.match.startsWith('play:')) return 'play'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Leader substitution.
// ─────────────────────────────────────────────────────────────────────────────

/** Renders a wish's text with {leader} replaced. Pure function — caller is
 *  responsible for passing the right leader name from useCouple.lifetimeWLT.
 *  We tolerate authoring typos like "{leader}really" (missing space) by
 *  inserting one when the placeholder isn't followed by whitespace. */
export function renderWishText(wish: Wish, leaderName: string | null): string {
  if (!wish.text.includes('{leader}')) return wish.text
  if (!leaderName) return wish.text.replace(/\{leader\}\s*/g, '') // edge: should never roll, but be safe
  return wish.text.replace(/\{leader\}(\S)/g, `${leaderName} $1`).replace(/\{leader\}/g, leaderName)
}
