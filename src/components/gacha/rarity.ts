// Rarity colours for the Meadow gacha screens (the machines, the drop rates,
// the reveal, the collection). RARITY_TAG in the Meadow tokens is the TAG: a
// pale tint with a dark ink. A bar, a meter or a dot wants one solid middle
// tone instead, light enough to sit on white and dark enough to show on its own
// tint, and that is RARITY_FILL.

import type { GachaRarity } from '@/types'

export const RARITIES: readonly GachaRarity[] = ['common', 'rare', 'epic', 'legendary']

export const RARITY_NAME: Record<GachaRarity, string> = {
  common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
}

export const RARITY_FILL: Record<GachaRarity, string> = {
  common: '#BDB6AB',
  rare: '#5FA36F',
  epic: '#DB7B9C',
  legendary: '#F2B33D',
}
