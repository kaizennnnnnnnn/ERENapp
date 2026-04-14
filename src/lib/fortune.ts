import type { FortuneGiftDef, GachaRarity } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY FORTUNE — Eren gives you a random gift every day
// ═══════════════════════════════════════════════════════════════════════════════

export const FORTUNE_GIFTS: FortuneGiftDef[] = [
  // ── Coin bags ──
  { id: 'fortune_coins_10',     name: 'Small Coin Pouch',     icon: '💰', rarity: 'common',    description: '10 coins!',               coinValue: 10 },
  { id: 'fortune_coins_25',     name: 'Coin Bag',             icon: '💰', rarity: 'common',    description: '25 coins!',               coinValue: 25 },
  { id: 'fortune_coins_50',     name: 'Heavy Coin Bag',       icon: '💰', rarity: 'rare',      description: '50 coins!',               coinValue: 50 },
  { id: 'fortune_coins_100',    name: 'Golden Coin Chest',    icon: '🪙', rarity: 'epic',      description: '100 coins!',              coinValue: 100 },
  { id: 'fortune_coins_250',    name: 'Royal Treasury',       icon: '👑', rarity: 'legendary', description: '250 coins!',              coinValue: 250 },

  // ── Stardust ──
  { id: 'fortune_dust_5',       name: 'Stardust Pinch',       icon: '✨', rarity: 'common',    description: '5 stardust.',             stardustValue: 5 },
  { id: 'fortune_dust_15',      name: 'Stardust Vial',        icon: '✨', rarity: 'rare',      description: '15 stardust.',            stardustValue: 15 },
  { id: 'fortune_dust_40',      name: 'Stardust Crystal',     icon: '💎', rarity: 'epic',      description: '40 stardust.',            stardustValue: 40 },

  // ── Gacha tickets ──
  { id: 'fortune_ticket_1',     name: 'Gacha Ticket',         icon: '🎟️', rarity: 'rare',      description: 'One free gacha pull!',    gachaTickets: 1 },
  { id: 'fortune_ticket_3',     name: 'Ticket Bundle',        icon: '🎫', rarity: 'epic',      description: 'Three free gacha pulls!', gachaTickets: 3 },
  { id: 'fortune_ticket_10',    name: 'Golden Ticket',        icon: '🌟', rarity: 'legendary', description: 'Ten free gacha pulls!',   gachaTickets: 10 },

  // ── Decorative keepsakes (stored in inventory) ──
  { id: 'fortune_lucky_paw',    name: 'Lucky Paw Charm',      icon: '🐾', rarity: 'common',    description: 'A tiny charm from Eren. Keep it safe!' },
  { id: 'fortune_yarn_ball',    name: 'Golden Yarn Ball',     icon: '🧶', rarity: 'common',    description: 'A shiny yarn ball Eren found.' },
  { id: 'fortune_star_fragment', name: 'Star Fragment',       icon: '⭐', rarity: 'rare',      description: 'A glowing piece of a fallen star.' },
  { id: 'fortune_moon_stone',   name: 'Moonstone',            icon: '🌙', rarity: 'rare',      description: 'A smooth stone that glows at night.' },
  { id: 'fortune_crystal_fish', name: 'Crystal Fish',         icon: '💠', rarity: 'epic',      description: 'A beautifully crafted crystal fish.' },
  { id: 'fortune_eren_feather', name: 'Eren\'s Whisker',      icon: '🪶', rarity: 'epic',      description: 'A rare whisker from Eren. Very lucky!' },
  { id: 'fortune_golden_bell',  name: 'Golden Bell',          icon: '🔔', rarity: 'legendary', description: 'A magical bell that rings by itself.' },
]

const FORTUNE_WEIGHTS: Record<GachaRarity, number> = {
  common: 55, rare: 30, epic: 12, legendary: 3,
}

export function rollFortuneGift(): FortuneGiftDef {
  // Pick rarity
  const total = FORTUNE_WEIGHTS.common + FORTUNE_WEIGHTS.rare + FORTUNE_WEIGHTS.epic + FORTUNE_WEIGHTS.legendary
  const roll = Math.random() * total
  let rarity: GachaRarity = 'common'
  if (roll < FORTUNE_WEIGHTS.legendary) rarity = 'legendary'
  else if (roll < FORTUNE_WEIGHTS.legendary + FORTUNE_WEIGHTS.epic) rarity = 'epic'
  else if (roll < FORTUNE_WEIGHTS.legendary + FORTUNE_WEIGHTS.epic + FORTUNE_WEIGHTS.rare) rarity = 'rare'

  const pool = FORTUNE_GIFTS.filter(g => g.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function canClaimFortune(lastClaim: string | null): boolean {
  if (!lastClaim) return true
  const last = new Date(lastClaim)
  const now = new Date()
  // Can claim if it's a new calendar day
  return last.toDateString() !== now.toDateString()
}
