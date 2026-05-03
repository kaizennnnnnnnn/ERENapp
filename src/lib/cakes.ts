// ─── Bakery cake catalogue ────────────────────────────────────────────────
// Pure data — no React, no Supabase. Each entry describes a cake the
// player can buy at the bakery: a stable id, display name, price in
// coins, and a small palette used by the cake-tile renderer.
//
// Cakes here are *flavour* for now: buying one debits coins and plays
// Eren's "sell" animation, nothing more. The data shape is open enough
// to add a `food` link or a collection flag later without touching the
// page that consumes it.
// ──────────────────────────────────────────────────────────────────────────

export interface CakeDef {
  id:    string
  name:  string
  price: number
  /** Two-line description shown under the cake name. Keep ≤ 36 chars. */
  blurb: string
  /** Three-tier palette used by the cake sprite (light/main/dark). */
  light: string
  main:  string
  dark:  string
  /** Sprinkle / accent colours for the cake-tile renderer. */
  accent: string
}

export const CAKES: CakeDef[] = [
  {
    id: 'strawberry',
    name: 'STRAWBERRY SHORTCAKE',
    price: 60,
    blurb: 'Pink frosting with fresh berries.',
    light: '#FBCFE8',
    main:  '#EC4899',
    dark:  '#9D174D',
    accent: '#DC2626',
  },
  {
    id: 'chocolate',
    name: 'CHOCOLATE FUDGE',
    price: 90,
    blurb: 'Rich cocoa & dark ganache.',
    light: '#A16207',
    main:  '#7C2D12',
    dark:  '#451A03',
    accent: '#FCD34D',
  },
  {
    id: 'vanilla',
    name: 'VANILLA CUPCAKE',
    price: 50,
    blurb: 'Cream frosting & rainbow sprinkles.',
    light: '#FFFFFF',
    main:  '#FEF3C7',
    dark:  '#D97706',
    accent: '#A78BFA',
  },
  {
    id: 'matcha',
    name: 'MATCHA ROLL',
    price: 110,
    blurb: 'Tea-infused sponge with cream.',
    light: '#A7F3D0',
    main:  '#34D399',
    dark:  '#047857',
    accent: '#FFFFFF',
  },
  {
    id: 'blueberry',
    name: 'BLUEBERRY TART',
    price: 95,
    blurb: 'Buttery crust, ripe berries.',
    light: '#BFDBFE',
    main:  '#3B82F6',
    dark:  '#1E40AF',
    accent: '#FBBF24',
  },
  {
    id: 'macaron',
    name: 'MACARON STACK',
    price: 140,
    blurb: 'Pastel almond cookies, tower of three.',
    light: '#FDE68A',
    main:  '#F472B6',
    dark:  '#A78BFA',
    accent: '#67E8F9',
  },
  {
    id: 'tiramisu',
    name: 'TIRAMISU',
    price: 170,
    blurb: 'Coffee-soaked, dusted with cocoa.',
    light: '#FBCFE8',
    main:  '#A16207',
    dark:  '#451A03',
    accent: '#FFFFFF',
  },
  {
    id: 'royal',
    name: 'ROYAL GOLDEN CAKE',
    price: 250,
    blurb: 'Ornate, gold-leafed showpiece.',
    light: '#FEF3C7',
    main:  '#FBBF24',
    dark:  '#92400E',
    accent: '#FFFFFF',
  },
]

export function getCake(id: string): CakeDef | undefined {
  return CAKES.find(c => c.id === id)
}
