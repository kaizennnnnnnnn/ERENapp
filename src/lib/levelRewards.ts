// ═══════════════════════════════════════════════════════════════════════════
// THE REWARD ROAD — one reward for each of the 100 player levels.
//
// Levels only come from quests (about 170 XP a day for an engaged player), and
// a level takes 100·L XP, so a level takes longer the higher it is. A reward
// is therefore worth about 20·L coins, which keeps the road paying the same
// per day of play at every height: roughly a sixth of what quests pay.
//
// Every fifth level is a milestone, worth two to three of its neighbours. The
// premium value goes into what coins can't buy: stardust, tickets, a skin you
// don't have yet, the three donuts the gacha keeps to itself (one taste each),
// and the Gold and Rainbow Purrbolts, whose first pour unlocks that look.
//
// Food lands in the claimer's own fridge pile. Skins are a box of a rarity,
// opened at claim time against what the household already owns. Never put a
// trophy, a Trophy Room item, a potion or an earned-only look here: those are
// minted somewhere else on purpose (see the Trophy Room and Jelly notes).
//
// Labels are built when shown (rewardLabel), not stored, so a renamed food
// (the cans became Purrbolts) or the household's own cat name is never stale.
// ═══════════════════════════════════════════════════════════════════════════

import type { FoodKey } from '@/types'
import { DONUTS } from './donuts'

export type SkinBoxRarity = 'rare' | 'epic' | 'legendary'

export type RewardItem =
  | { kind: 'coins'; amount: number }
  | { kind: 'stardust'; amount: number }
  | { kind: 'tickets'; amount: number }
  /** One entry per item: ['pizza', 'pizza'] is two pizzas. `pack` names a mix. */
  | { kind: 'food'; foods: FoodKey[]; pack?: string }
  | { kind: 'skin'; rarity: SkinBoxRarity }

export interface LevelReward {
  level: number
  /** The first item is the headline; the rest ride along with it. */
  items: RewardItem[]
  /** Every fifth level. */
  milestone: boolean
}

const coins = (amount: number): RewardItem => ({ kind: 'coins', amount })
const dust = (amount: number): RewardItem => ({ kind: 'stardust', amount })
const tickets = (amount: number): RewardItem => ({ kind: 'tickets', amount })
const food = (foods: FoodKey[], pack?: string): RewardItem => ({ kind: 'food', foods, pack })
const skin = (rarity: SkinBoxRarity): RewardItem => ({ kind: 'skin', rarity })

const WORLD_DISHES: FoodKey[] = [
  'pizza', 'ramen', 'cevapi', 'tacos', 'lasagna', 'nigiri', 'pad_thai', 'sarma', 'paella', 'gyoza',
  'carbonara', 'temaki', 'doner', 'stew', 'risotto', 'maki', 'xiaolongbao', 'wrap', 'meatballs', 'roast_chicken',
]
/** The eight everyday cans. Gold and Rainbow are kept for milestones. */
const PURRBOLTS: FoodKey[] = [
  'monsta_original', 'monsta_mango', 'monsta_loco', 'monsta_white',
  'monsta_pipeline', 'monsta_punch', 'monsta_rosa', 'monsta_peachy',
]
const BAKERY_DONUTS: FoodKey[] = DONUTS.filter(d => d.source === 'bakery').map(d => d.id)

/** `n` in a row from a list, starting at `from` and wrapping round. */
const take = (list: FoodKey[], from: number, n: number): FoodKey[] =>
  Array.from({ length: n }, (_, i) => list[(from + i) % list.length])

/** Coins up to a level's worth, after its items, in tens. */
const topUp = (level: number, itemsWorth: number): number =>
  Math.max(0, Math.round((20 * level - itemsWorth) / 10) * 10)

// ── The first 25: what a player actually meets in their first half year ─────
const EARLY: Record<number, RewardItem[]> = {
  1:  [coins(100)],
  2:  [food(['pizza', 'cevapi', 'ramen'], 'World dishes')],
  3:  [coins(60)],
  4:  [food(['donut_red_velvet', 'donut_sakura', 'donut_maple_bacon'], 'Bakery box')],
  5:  [food(['monsta_original']), tickets(1), coins(100)],
  6:  [coins(120)],
  7:  [food(['lasagna', 'nigiri', 'tacos', 'gyoza'], 'World dishes'), coins(50)],
  8:  [coins(160)],
  9:  [food(['monsta_mango', 'monsta_loco'], 'Purrbolt pack')],
  10: [skin('rare'), tickets(3), dust(50), coins(200)],
  11: [coins(220)],
  12: [food(['donut_tiger']), coins(200)],
  13: [coins(260)],
  14: [food(['carbonara', 'pad_thai', 'sarma', 'paella', 'temaki', 'meatballs'], 'World dishes'), coins(130)],
  15: [food(['monsta_gold']), tickets(2), dust(75), coins(300)],
  16: [coins(320)],
  17: [food(['donut_honey', 'donut_caramel', 'donut_matcha', 'donut_ube', 'donut_mochi'], 'Bakery box'), coins(180)],
  18: [coins(360)],
  19: [food(['donut_arcade']), coins(320)],
  20: [food(['monsta_rainbow']), tickets(5), dust(100), coins(400)],
  21: [coins(420)],
  22: [food(['donut_neon']), coins(380)],
  23: [coins(460)],
  24: [food(['monsta_white', 'monsta_pipeline', 'monsta_punch'], 'Purrbolt pack'), coins(180)],
  25: [skin('epic'), tickets(5), dust(150), coins(500)],
}

// ── Milestones from 30 on ───────────────────────────────────────────────────
// Three legendary boxes, not more: the gacha has five legendary looks, and a
// box whose rarity the household already owns in full pays stardust instead,
// which is a let-down at a milestone.
const MILESTONES: Record<number, RewardItem[]> = {
  30:  [tickets(5), dust(150), coins(600)],
  35:  [food(['monsta_rosa', 'monsta_peachy'], 'Purrbolt pack'), tickets(6), dust(200), coins(700)],
  40:  [skin('epic'), tickets(8), dust(200), coins(800)],
  45:  [food(['monsta_gold']), tickets(6), dust(250), coins(900)],
  50:  [skin('legendary'), tickets(10), dust(400), coins(1000)],
  55:  [tickets(8), dust(300), coins(1100)],
  60:  [skin('epic'), tickets(8), dust(300), coins(1200)],
  65:  [food(['monsta_rainbow']), tickets(10), dust(350), coins(1300)],
  70:  [skin('epic'), tickets(10), dust(350), coins(1400)],
  75:  [skin('legendary'), tickets(15), dust(600), coins(1500)],
  80:  [tickets(12), dust(400), coins(1600)],
  85:  [skin('epic'), tickets(12), dust(450), coins(1700)],
  90:  [food(['monsta_gold', 'monsta_rainbow'], 'Purrbolt pack'), tickets(15), dust(500), coins(1800)],
  95:  [tickets(15), dust(550), coins(1900)],
  100: [skin('legendary'), tickets(25), dust(1000), coins(2500)],
}

/** Levels 26-100 between milestones: a pattern over each ten, with coins
 *  making up the rest of the level's worth. Each kind of pack carries on
 *  through its list from where the last one stopped, so no two packs in a
 *  row hold the same things (level 27's cans pick up after level 24's). */
function laterLevel(level: number): RewardItem[] {
  const cans = level >= 70 ? 5 : level >= 40 ? 4 : 3
  const stardust = level >= 60 ? 100 : level >= 40 ? 75 : 50
  const ten = Math.floor(level / 10)
  switch (level % 10) {
    case 1: return [food(take(WORLD_DISHES, (ten - 3) * 6 + 13, 6), 'World dishes'), coins(topUp(level, 150))]
    case 2:
    case 7: {
      // Three on per pack: three shares nothing with eight, so the starting
      // flavour walks through all of them instead of bouncing between two.
      const pack = (ten - 2) * 2 + (level % 10 === 7 ? 0 : -1)
      return [food(take(PURRBOLTS, 6 + pack * 3, cans), 'Purrbolt pack'), coins(topUp(level, 100 * cans))]
    }
    case 4:
    case 9: return [dust(stardust), coins(topUp(level, stardust * 2.5))]
    case 6: return [food(take(BAKERY_DONUTS, (ten - 2) * 5 + 8, 5), 'Bakery box'), coins(topUp(level, 150))]
    default: return [coins(20 * level)]
  }
}

function rewardFor(level: number): LevelReward {
  const items = EARLY[level] ?? MILESTONES[level] ?? laterLevel(level)
  return { level, items, milestone: level % 5 === 0 }
}

export const LEVEL_REWARDS: LevelReward[] = Array.from({ length: 100 }, (_, i) => rewardFor(i + 1))

export const MAX_LEVEL = LEVEL_REWARDS.length
