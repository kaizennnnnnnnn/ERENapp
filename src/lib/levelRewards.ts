// ═══════════════════════════════════════════════════════════════════════════
// LEVEL REWARD CONFIG — 100 levels, mix of coins, food, stardust, tickets
// Milestones every 10 / 25 levels upgrade to bigger or rarer rewards.
// ═══════════════════════════════════════════════════════════════════════════

export type LevelRewardKind = 'coins' | 'stardust' | 'tickets' | 'food'
export type FoodKind = 'kibble' | 'fish' | 'treat' | 'tuna' | 'steak' | 'cream'

export interface LevelReward {
  level: number
  kind: LevelRewardKind
  amount: number
  food?: FoodKind
  label: string
  isMilestone: boolean   // 10-mark
  isMega: boolean        // 25-mark
}

// ── Hand-crafted overrides ──────────────────────────────────────────────────
// Levels not in this map get generated programmatically below.
const OVERRIDES: Record<number, Omit<LevelReward, 'level'>> = {
  // ── Early game hooks ───────────────────────────────────────────────────
  3:   { kind: 'food',    amount: 2, food: 'kibble', label: '2× Kibble',     isMilestone: false, isMega: false },
  5:   { kind: 'stardust',amount: 10,                label: '10 Stardust',    isMilestone: false, isMega: false },
  7:   { kind: 'food',    amount: 1, food: 'fish',   label: 'Fish',           isMilestone: false, isMega: false },
  10:  { kind: 'tickets', amount: 1,                 label: 'Gacha Ticket',   isMilestone: true,  isMega: false },

  // ── Tier 2: 11-25 ──────────────────────────────────────────────────────
  13:  { kind: 'food',    amount: 2, food: 'treat',  label: '2× Treat',       isMilestone: false, isMega: false },
  15:  { kind: 'stardust',amount: 20,                label: '20 Stardust',    isMilestone: false, isMega: false },
  17:  { kind: 'food',    amount: 2, food: 'fish',   label: '2× Fish',        isMilestone: false, isMega: false },
  20:  { kind: 'tickets', amount: 2,                 label: '2× Gacha Tickets',isMilestone: true, isMega: false },
  25:  { kind: 'stardust',amount: 100,               label: '100 Stardust ✦', isMilestone: true,  isMega: true  },

  // ── Tier 3: 26-50 ──────────────────────────────────────────────────────
  28:  { kind: 'food',    amount: 1, food: 'tuna',   label: 'Tuna Can',       isMilestone: false, isMega: false },
  30:  { kind: 'tickets', amount: 2,                 label: '2× Gacha Tickets',isMilestone: true, isMega: false },
  33:  { kind: 'food',    amount: 3, food: 'fish',   label: '3× Fish',        isMilestone: false, isMega: false },
  35:  { kind: 'stardust',amount: 40,                label: '40 Stardust',    isMilestone: false, isMega: false },
  40:  { kind: 'tickets', amount: 3,                 label: '3× Gacha Tickets',isMilestone: true, isMega: false },
  45:  { kind: 'food',    amount: 1, food: 'cream',  label: 'Cream',          isMilestone: false, isMega: false },
  50:  { kind: 'tickets', amount: 5,                 label: '5× Gacha Tickets ★', isMilestone: true, isMega: true },

  // ── Tier 4: 51-75 ──────────────────────────────────────────────────────
  55:  { kind: 'stardust',amount: 80,                label: '80 Stardust',    isMilestone: false, isMega: false },
  60:  { kind: 'tickets', amount: 4,                 label: '4× Gacha Tickets',isMilestone: true, isMega: false },
  65:  { kind: 'food',    amount: 1, food: 'steak',  label: 'Steak',          isMilestone: false, isMega: false },
  70:  { kind: 'tickets', amount: 5,                 label: '5× Gacha Tickets',isMilestone: true, isMega: false },
  75:  { kind: 'stardust',amount: 200,               label: '200 Stardust ✦', isMilestone: true,  isMega: true  },

  // ── Tier 5: 76-100 ─────────────────────────────────────────────────────
  80:  { kind: 'tickets', amount: 6,                 label: '6× Gacha Tickets',isMilestone: true, isMega: false },
  85:  { kind: 'food',    amount: 2, food: 'steak',  label: '2× Steak',       isMilestone: false, isMega: false },
  88:  { kind: 'stardust',amount: 120,               label: '120 Stardust',   isMilestone: false, isMega: false },
  90:  { kind: 'tickets', amount: 8,                 label: '8× Gacha Tickets',isMilestone: true, isMega: false },
  95:  { kind: 'food',    amount: 3, food: 'cream',  label: '3× Cream',       isMilestone: false, isMega: false },
  100: { kind: 'tickets', amount: 15,                label: '15× LEGENDARY TICKETS ★', isMilestone: true, isMega: true },
}

const FOOD_ROTATION: FoodKind[] = ['kibble', 'fish', 'treat', 'tuna', 'steak', 'cream']

function generateReward(level: number): LevelReward {
  if (level in OVERRIDES) return { level, ...OVERRIDES[level] }

  // Food every 4th
  if (level % 4 === 0) {
    const food = FOOD_ROTATION[Math.floor(level / 4) % FOOD_ROTATION.length]
    const amount = 1 + Math.floor(level / 30)
    return {
      level, kind: 'food', food, amount,
      label: `${amount > 1 ? amount + '× ' : ''}${cap(food)}`,
      isMilestone: false, isMega: false,
    }
  }

  // Stardust every 6th (non-milestone, non-food)
  if (level % 6 === 0) {
    const amount = 10 + Math.floor(level / 6) * 5
    return { level, kind: 'stardust', amount, label: `${amount} Stardust`, isMilestone: false, isMega: false }
  }

  // Default: coins — scale from ~15 to ~550
  const amount = 10 + Math.floor(level * 5)
  return { level, kind: 'coins', amount, label: `${amount} Coins`, isMilestone: false, isMega: false }
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export const LEVEL_REWARDS: LevelReward[] = Array.from({ length: 100 }, (_, i) => generateReward(i + 1))

export const MAX_LEVEL = LEVEL_REWARDS.length

export function getReward(level: number): LevelReward | null {
  if (level < 1 || level > MAX_LEVEL) return null
  return LEVEL_REWARDS[level - 1]
}
