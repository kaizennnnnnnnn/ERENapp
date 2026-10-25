import type { GachaRarity } from '@/types'

export type GachaMachine = 'food' | 'animal' | 'foodsuits' | 'creatures'
export type AtlasRect = readonly [number, number, number, number]
export interface PresentationAtlas { src: string; lid: AtlasRect; body: AtlasRect }

// Separate alpha-bounded pieces in the original atlases; no painted prop is stretched open.
export const PRESENTATION_ATLASES: Record<string, PresentationAtlas> = {
  'box-common': { src: '/gacha/presentation/box-common.webp?v=1', lid: [121,226,1012,345], body: [122,686,1011,427] },
  'box-rare': { src: '/gacha/presentation/box-rare.webp?v=1', lid: [75,152,1105,437], body: [75,684,1104,463] },
  'box-epic': { src: '/gacha/presentation/box-epic.webp?v=1', lid: [52,143,1150,359], body: [54,622,1146,484] },
  'box-legendary': { src: '/gacha/presentation/box-legendary.webp?v=1', lid: [149,233,956,329], body: [134,647,986,420] },
  'chef': { src: '/gacha/presentation/chef.webp?v=1', lid: [87,19,1080,698], body: [27,738,1200,510] },
}

export const GACHA_REVEAL_THEMES = {
  food: { ground: '#EFF5F3', ink: '#378C82', secondary: '#E78A98', motif: 'fizz' },
  animal: { ground: '#F6F0F4', ink: '#B86991', secondary: '#879FC5', motif: 'stitch' },
  foodsuits: { ground: '#F3F5F0', ink: '#719C82', secondary: '#DF898A', motif: 'steam' },
  creatures: { ground: '#F0F4EE', ink: '#6B9562', secondary: '#D09A54', motif: 'leaf' },
} as const

// Rarity changes the choreography, not just the colour or particle count.
export const RARITY_MOTION = {
  common: { sequence: 'pop', duration: 1000, settle: 0 },
  rare: { sequence: 'double-pulse', duration: 1600, settle: 100 },
  epic: { sequence: 'ribbon-sweep', duration: 2300, settle: 220 },
  legendary: { sequence: 'gather-and-coronate', duration: 3100, settle: 520 },
} as const

export const RARITY_PRESENTATION = {
  common: { trim: '#C4B4A0', seal: '#829E8B', level: 0 },
  rare: { trim: '#71916A', seal: '#3D7950', level: 1 },
  epic: { trim: '#B88550', seal: '#A04F72', level: 2 },
  legendary: { trim: '#B88A37', seal: '#36766E', level: 3 },
} as const

export function getTreatAtlas(kind: 'parcel' | 'chef', rarity: GachaRarity | null): PresentationAtlas {
  return PRESENTATION_ATLASES[kind === 'chef' ? 'chef' : 'box-' + (rarity ?? 'common')]
}
