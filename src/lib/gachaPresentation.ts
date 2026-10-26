import type { GachaRarity } from '@/types'

export type GachaMachine = 'food' | 'animal' | 'foodsuits' | 'creatures'
export type AtlasRect = readonly [number, number, number, number]
export interface PresentationAtlas {
  src: string; lid: AtlasRect; body: AtlasRect
  serving?: { bodyWidth: number; bodyY: number; lidWidth: number; lidBaseY: number; shadowY: number }
}

// Separate alpha-bounded pieces in the original atlases; no painted prop is stretched open.
export const PRESENTATION_ATLASES: Record<string, PresentationAtlas> = {
  'box-common': { src: '/gacha/presentation/box-common.webp?v=1', lid: [121,226,1012,345], body: [122,686,1011,427] },
  'box-rare': { src: '/gacha/presentation/box-rare.webp?v=1', lid: [75,152,1105,437], body: [75,684,1104,463] },
  'box-epic': { src: '/gacha/presentation/box-epic.webp?v=1', lid: [52,143,1150,359], body: [54,622,1146,484] },
  'box-legendary': { src: '/gacha/presentation/box-legendary.webp?v=1', lid: [149,233,956,329], body: [134,647,986,420] },
  'chef': { src: '/gacha/presentation/chef.webp?v=1', lid: [87,19,1080,698], body: [27,738,1200,510] },
  'chef-epic': { src: '/gacha/presentation/chef-epic-v2.webp', lid: [57,22,1140,646], body: [48,684,1158,556],
    serving: { bodyWidth: 274, bodyY: -45, lidWidth: 270, lidBaseY: 42, shadowY: 92 } },
  'chef-legendary': { src: '/gacha/presentation/chef-legendary-v2.webp', lid: [176,4,899,692], body: [62,726,1130,499],
    serving: { bodyWidth: 280, bodyY: -43, lidWidth: 230, lidBaseY: 36, shadowY: 86 } },
}

export type SkinRoomVariant = 0 | 1 | 2
export interface SkinRewardRoom { id: string; name: string; variant: SkinRoomVariant }
type SkinRoomMachine = Exclude<GachaMachine, 'food'>
type SkinRoomRarity = Exclude<GachaRarity, 'common'>
function roomSet(machine: SkinRoomMachine, rarity: SkinRoomRarity, names: readonly [string,string,string]): readonly SkinRewardRoom[] {
  return names.map((name, variant) => ({ id: `${machine}-${rarity}-${variant}`, name, variant: variant as SkinRoomVariant }))
}
export const SKIN_REWARD_ROOMS = {
  animal: {
    rare: roomSet('animal','rare',['Knitting cottage','Reading nook','Vanity corner']),
    epic: roomSet('animal','epic',['Velvet atelier','Ribbon loft','Mirror studio']),
    legendary: roomSet('animal','legendary',['Royal dressing room','Pearl gallery','Crown lounge']),
  },
  foodsuits: {
    rare: roomSet('foodsuits','rare',['Kitchen nook','Baking pantry','Breakfast room']),
    epic: roomSet('foodsuits','epic',['Patisserie atelier','Tea salon','Confectionery studio']),
    legendary: roomSet('foodsuits','legendary',['Royal patisserie','Porcelain gallery','Celebration kitchen']),
  },
  creatures: {
    rare: roomSet('creatures','rare',['Fern den','Moonlit nook','Shell aquarium']),
    epic: roomSet('creatures','epic',['Enchanted greenhouse','Moonlit study','Coral conservatory']),
    legendary: roomSet('creatures','legendary',['Dragon sanctuary','Moonstone hall','Pearl grotto']),
  },
} satisfies Record<SkinRoomMachine, Record<SkinRoomRarity, readonly SkinRewardRoom[]>>

export function getSkinRoomPool(machine: GachaMachine, rarity: GachaRarity): readonly SkinRewardRoom[] {
  // The food machine has no rooms; current costume pools have no Common rewards.
  return machine === 'food' ? [] : SKIN_REWARD_ROOMS[machine][rarity === 'common' ? 'rare' : rarity]
}
export function getSkinRewardRoom(machine: GachaMachine, rarity: GachaRarity, variant: SkinRoomVariant = 0): SkinRewardRoom | null {
  return getSkinRoomPool(machine,rarity).find(room=>room.variant===variant) ?? null
}
export function pickSkinRewardRoom(machine: GachaMachine, rarity: GachaRarity, sample: number, previousId?: string): SkinRewardRoom | null {
  const pool = getSkinRoomPool(machine,rarity)
  if (!pool.length) return null
  const choices = pool.filter(room=>room.id!==previousId)
  return choices[Math.min(choices.length-1, Math.floor(Math.max(0,Math.min(1,sample))*choices.length))]
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
  const key = kind === 'chef' ? rarity === 'epic' || rarity === 'legendary' ? 'chef-' + rarity : 'chef' : 'box-' + (rarity ?? 'common')
  return PRESENTATION_ATLASES[key]
}
