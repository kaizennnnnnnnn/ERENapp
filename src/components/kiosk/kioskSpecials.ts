import { GACHA_SKINS, type SkinDef } from '@/lib/skins'
import type { MenuState, Order, Wrap } from './kioskShift'

interface Recipe { id: string; name: string; wrap: Wrap }

const RECIPES: Recipe[] = [
  { id: 'garlic-garden', name: 'Garlic garden', wrap: { toppings: ['lettuce', 'tomato'], sauce: 'garlic', without: null } },
  { id: 'chilli-crunch', name: 'Chilli crunch', wrap: { toppings: ['tomato', 'onion'], sauce: 'chilli', without: null } },
  { id: 'cheesy-moon', name: 'Cheesy moon', wrap: { toppings: ['cheese', 'onion'], sauce: 'garlic', without: null } },
  { id: 'midnight-melt', name: 'Midnight melt', wrap: { toppings: ['cheese', 'tomato'], sauce: 'chilli', without: null } },
  { id: 'green-crunch', name: 'Green crunch', wrap: { toppings: ['lettuce', 'onion'], sauce: 'garlic', without: null } },
  { id: 'firecracker', name: 'Firecracker', wrap: { toppings: ['cheese', 'onion'], sauce: 'chilli', without: null } },
  { id: 'house-favourite', name: 'House favourite', wrap: { toppings: ['lettuce', 'cheese'], sauce: 'garlic', without: null } },
]
const GUESTS = GACHA_SKINS.filter(skin => skin.set === 'animal')
  .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export interface NightlySpecial {
  id: string
  date: string
  name: string
  wrap: Wrap
  customer: SkinDef
}

/** Calendar arithmetic in UTC avoids a different rotation across DST changes. */
export function nightlySpecialFor(date: string, menu: MenuState): NightlySpecial | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null
  const recipes = RECIPES.filter(recipe => !recipe.wrap.sauce || menu.sauces.includes(recipe.wrap.sauce))
  if (!recipes.length || !GUESTS.length) return null
  const day = Math.floor(ms / 86_400_000)
  const index = (length: number, offset = 0) => ((day + offset) % length + length) % length
  const recipe = recipes[index(recipes.length)]
  return { id: `${date}:${recipe.id}`, date, name: recipe.name,
    wrap: { ...recipe.wrap, toppings: [...recipe.wrap.toppings] }, customer: GUESTS[index(GUESTS.length, 11)] }
}

export function specialOrder(special: NightlySpecial): Order {
  return { kind: 'order', wraps: [{ ...special.wrap, toppings: [...special.wrap.toppings] }], sides: [],
    customer: special.customer, line: `the ${special.name.toLowerCase()}, please.`, usual: false,
    mood: 'normal', chat: [], late: false, special: { id: special.id, name: special.name } }
}
