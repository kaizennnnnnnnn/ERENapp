// ─── Bakery cake catalogue ────────────────────────────────────────────────
// Pure data — no React, no Supabase. Each entry describes a cake the
// player can buy at the bakery: a stable id, display name, price in
// coins, and its palette. Artwork is shared by the menu and sell animation.
//
// Buying a pastry stocks the buyer's fridge under its stable foodId.
// The kitchen, gift pickers and bakery all read this same catalogue.
// ──────────────────────────────────────────────────────────────────────────

import type { CakeKey } from '@/types'

export interface CakeDef {
  id:    string
  foodId: CakeKey
  name:  string
  price: number
  /** Two-line description shown under the cake name. Keep ≤ 36 chars. */
  blurb: string
  hungerD: number
  happyD: number
  weightD: number
  /** Flavour palette retained for cake accents (light/main/dark). */
  light: string
  main:  string
  dark:  string
  /** Sprinkle / accent colour. */
  accent: string
}

export const CAKES: CakeDef[] = [
  {
    id: 'strawberry',
    foodId: 'cake_strawberry',
    name: 'Strawberry Shortcake',
    hungerD: 18,
    happyD: 36,
    weightD: 0.07,
    price: 60,
    blurb: 'Pink frosting with fresh berries.',
    light: '#FBCFE8',
    main:  '#EC4899',
    dark:  '#9D174D',
    accent: '#DC2626',
  },
  {
    id: 'chocolate',
    foodId: 'cake_chocolate',
    name: 'Chocolate Fudge',
    hungerD: 20,
    happyD: 40,
    weightD: 0.08,
    price: 90,
    blurb: 'Rich cocoa & dark ganache.',
    light: '#A16207',
    main:  '#7C2D12',
    dark:  '#451A03',
    accent: '#FCD34D',
  },
  {
    id: 'vanilla',
    foodId: 'cake_vanilla',
    name: 'Vanilla Cupcake',
    hungerD: 12,
    happyD: 28,
    weightD: 0.04,
    price: 50,
    blurb: 'Cream frosting & rainbow sprinkles.',
    light: '#FFFFFF',
    main:  '#FEF3C7',
    dark:  '#D97706',
    accent: '#A78BFA',
  },
  {
    id: 'matcha',
    foodId: 'cake_matcha',
    name: 'Matcha Roll',
    hungerD: 16,
    happyD: 34,
    weightD: 0.05,
    price: 110,
    blurb: 'Tea-infused sponge with cream.',
    light: '#A7F3D0',
    main:  '#34D399',
    dark:  '#047857',
    accent: '#FFFFFF',
  },
  {
    id: 'blueberry',
    foodId: 'cake_blueberry',
    name: 'Blueberry Tart',
    hungerD: 15,
    happyD: 32,
    weightD: 0.04,
    price: 95,
    blurb: 'Buttery crust, ripe berries.',
    light: '#BFDBFE',
    main:  '#3B82F6',
    dark:  '#1E40AF',
    accent: '#FBBF24',
  },
  {
    id: 'macaron',
    foodId: 'cake_macaron',
    name: 'Macaron Stack',
    hungerD: 12,
    happyD: 38,
    weightD: 0.04,
    price: 140,
    blurb: 'Three pastel almond macarons.',
    light: '#FDE68A',
    main:  '#F472B6',
    dark:  '#A78BFA',
    accent: '#67E8F9',
  },
  {
    id: 'tiramisu',
    foodId: 'cake_tiramisu',
    name: 'Tiramisu',
    hungerD: 18,
    happyD: 42,
    weightD: 0.06,
    price: 170,
    blurb: 'Coffee-soaked, dusted with cocoa.',
    light: '#FBCFE8',
    main:  '#A16207',
    dark:  '#451A03',
    accent: '#FFFFFF',
  },
  {
    id: 'royal',
    foodId: 'cake_royal',
    name: 'Royal Golden Cake',
    hungerD: 24,
    happyD: 55,
    weightD: 0.1,
    price: 250,
    blurb: 'Ornate, gold-leafed showpiece.',
    light: '#FEF3C7',
    main:  '#FBBF24',
    dark:  '#92400E',
    accent: '#FFFFFF',
  },
  {
    id: 'honey_hive',
    foodId: 'cake_honey_hive',
    name: 'Honey Hive',
    hungerD: 20,
    happyD: 42,
    weightD: 0.07,
    price: 180,
    blurb: 'Honey sponge & tiny sugar bees.',
    light: '#FFF0B5',
    main: '#E8AF32',
    dark: '#8C531C',
    accent: '#FFF9E6',
  },
  {
    id: 'moonbeam',
    foodId: 'cake_moonbeam',
    name: 'Moonbeam Cake',
    hungerD: 20,
    happyD: 44,
    weightD: 0.07,
    price: 200,
    blurb: 'Vanilla, teal icing & a sweet moon.',
    light: '#D8F1E9',
    main: '#267E8B',
    dark: '#174A58',
    accent: '#F7D56B',
  },
  {
    id: 'moss_cottage',
    foodId: 'cake_moss_cottage',
    name: 'Moss Cottage',
    hungerD: 20,
    happyD: 43,
    weightD: 0.07,
    price: 190,
    blurb: 'Pistachio with a sugar-cottage roof.',
    light: '#E2EDAE',
    main: '#9DB34F',
    dark: '#536A2E',
    accent: '#DF6152',
  },
  {
    id: 'lily_pond',
    foodId: 'cake_lily_pond',
    name: 'Lily Pond',
    hungerD: 18,
    happyD: 40,
    weightD: 0.06,
    price: 170,
    blurb: 'Pistachio, jelly & a fondant frog.',
    light: '#E1EDD2',
    main: '#A5BD78',
    dark: '#5A783F',
    accent: '#65C8CF',
  },
]

const CAKE_ART_V = 1

/** Shared cache-versioned artwork for the bakery menu and purchase fly-up. */
export const cakeArt = (id: string): string => `/cakes/${id}.png?v=${CAKE_ART_V}`

export function getCake(id: string): CakeDef | undefined {
  return CAKES.find(c => c.id === id)
}

export function getCakeByFoodId(foodId: string): CakeDef | undefined {
  return CAKES.find(c => c.foodId === foodId)
}
