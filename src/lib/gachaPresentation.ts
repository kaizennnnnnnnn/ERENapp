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

export const GACHA_SCENES: Record<GachaMachine, {
  src: string; name: string; accent: string; fabric: string; dark: string;
  grounds: Record<GachaRarity, string>;
}> = {
  food: { src: '/gacha/presentation/scene-food.webp?v=1', name: 'Cafe counter', accent: '#B95B68', fabric: '#F0B6AE', dark: '#653F46',
    grounds: { common: '#F4F2EE', rare: '#E9F2ED', epic: '#F8E8E9', legendary: '#FCF0D9' } },
  animal: { src: '/gacha/presentation/scene-animal.webp?v=1', name: 'Dressing room', accent: '#886B9D', fabric: '#C9B1D3', dark: '#503B61',
    grounds: { common: '#F3EFF5', rare: '#EEEAF6', epic: '#F2E6EE', legendary: '#F6EFD9' } },
  foodsuits: { src: '/gacha/presentation/scene-foodsuits.webp?v=1', name: 'Bakery workbench', accent: '#B67258', fabric: '#EAB5A0', dark: '#735348',
    grounds: { common: '#F0F3EF', rare: '#E6F1EF', epic: '#F5E8E1', legendary: '#FAEFD9' } },
  creatures: { src: '/gacha/presentation/scene-creatures.webp?v=1', name: 'Storybook nook', accent: '#6C835B', fabric: '#B7C49F', dark: '#414F3C',
    grounds: { common: '#EFF1E9', rare: '#EBF0E3', epic: '#EEE7E1', legendary: '#F3EDDA' } },
}

export const RARITY_PRESENTATION = {
  common: { trim: '#C4B4A0', seal: '#829E8B', level: 0 },
  rare: { trim: '#71916A', seal: '#3D7950', level: 1 },
  epic: { trim: '#B88550', seal: '#A04F72', level: 2 },
  legendary: { trim: '#B88A37', seal: '#36766E', level: 3 },
} as const

export function getTreatAtlas(kind: 'parcel' | 'chef', rarity: GachaRarity | null): PresentationAtlas {
  return PRESENTATION_ATLASES[kind === 'chef' ? 'chef' : 'box-' + (rarity ?? 'common')]
}
