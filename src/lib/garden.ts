// ═══════════════════════════════════════════════════════════════════════════
// THE GARDEN — what grows, how fast, and in which colours.
//
// The rules live in supabase/migration_garden.sql (garden_tend picks the
// colour when a flower opens); this file is the same table for the client to
// draw. Keep the species, NEED and colour keys identical to the SQL.
// ═══════════════════════════════════════════════════════════════════════════

export type Species = 'daisy' | 'tulip' | 'sunflower'
export type Rarity = 'common' | 'rare' | 'mixed'

/** A row of public.garden_plants. */
export interface GardenPlant {
  id: string
  household_id: string
  slot: number
  species: Species
  planted_by: string | null
  planted_day: string
  growth: number
  together_days: number
  water_day: string | null
  watered_by: string[]
  rained_day: string | null
  color: string | null
  rarity: Rarity | null
  bloomed_at: string | null
  picked_by: string | null
  picked_at: string | null
  vase_of: string | null
  placed_at: string | null
  created_at: string
}

export const BEDS = 6
export const COLUMNS = 3

/** Waterings until it opens. Two people a day = twice as fast. */
export const NEED: Record<Species, number> = { daisy: 2, tulip: 3, sunflower: 5 }

export interface FlowerColour {
  key: string
  name: string
  rarity: Rarity
  /** Palette for the flower's own letters in its grid (see FLOWER_GRID). */
  pal: Record<string, string>
}

const LEAF = { G: '#3F8452', g: '#8DBF8E' }

export const SPECIES: Record<Species, { name: string; plural: string; blurb: string; colours: FlowerColour[] }> = {
  daisy: {
    name: 'Daisy', plural: 'Daisies', blurb: 'Quick to open. Two waterings.',
    colours: [
      { key: 'pink',    name: 'Pink-tip', rarity: 'common', pal: { W: '#FFFFFF', w: '#F6BCCD', Y: '#F2B33D', y: '#C98C1E' } },
      { key: 'butter',  name: 'Butter',   rarity: 'common', pal: { W: '#FFF3C4', w: '#F2D27A', Y: '#F08A3C', y: '#C96A2A' } },
      { key: 'lilac',   name: 'Lilac',    rarity: 'common', pal: { W: '#EFE6FA', w: '#B79BD9', Y: '#F2B33D', y: '#C98C1E' } },
      { key: 'moonlit', name: 'Moonlit',  rarity: 'rare',   pal: { W: '#DCE8F5', w: '#6FA3D2', Y: '#FFFFFF', y: '#A9CBEA' } },
      { key: 'peach',   name: 'Peach',    rarity: 'mixed',  pal: { W: '#FFE0CF', w: '#F6A98A', Y: '#E57C9F', y: '#C95A80' } },
    ],
  },
  tulip: {
    name: 'Tulip', plural: 'Tulips', blurb: 'Three waterings.',
    colours: [
      { key: 'pink',   name: 'Pink',   rarity: 'common', pal: { P: '#E57C9F', p: '#C95A80', l: '#F6BCCD' } },
      { key: 'red',    name: 'Red',    rarity: 'common', pal: { P: '#E0574A', p: '#B5392F', l: '#F29B8E' } },
      { key: 'lemon',  name: 'Lemon',  rarity: 'common', pal: { P: '#F7C04A', p: '#D89A1E', l: '#FFE3A0' } },
      { key: 'violet', name: 'Violet', rarity: 'rare',   pal: { P: '#9B7BD1', p: '#6E52A8', l: '#C9B6EC' } },
      { key: 'flame',  name: 'Flame',  rarity: 'mixed',  pal: { P: '#F08A3C', p: '#E0574A', l: '#F7C04A' } },
    ],
  },
  sunflower: {
    name: 'Sunflower', plural: 'Sunflowers', blurb: 'Slow. Five waterings, worth it.',
    colours: [
      { key: 'classic', name: 'Classic', rarity: 'common', pal: { Y: '#F7C04A', y: '#E39A2E', B: '#8A5A3C', b: '#5E3B26' } },
      { key: 'sunset',  name: 'Sunset',  rarity: 'common', pal: { Y: '#F08A3C', y: '#C96A2A', B: '#5E3B26', b: '#3A2418' } },
      { key: 'rosy',    name: 'Rosy',    rarity: 'common', pal: { Y: '#F6BCCD', y: '#E57C9F', B: '#8A5A3C', b: '#5E3B26' } },
      { key: 'snow',    name: 'Snow',    rarity: 'rare',   pal: { Y: '#FFFFFF', y: '#DCE8F5', B: '#F2B33D', b: '#C98C1E' } },
      { key: 'dusk',    name: 'Dusk',    rarity: 'mixed',  pal: { Y: '#B79BD9', y: '#8E6FC0', B: '#F08A3C', b: '#C96A2A' } },
    ],
  },
}

export const SPECIES_ORDER: Species[] = ['daisy', 'tulip', 'sunflower']

export function colourOf(species: Species, key: string | null): FlowerColour {
  const list = SPECIES[species].colours
  return list.find(c => c.key === key) ?? list[0]
}

/** "a violet tulip", "a pink-tip daisy" — for notes and toasts. */
export function flowerPhrase(p: Pick<GardenPlant, 'species' | 'color'>): string {
  const c = colourOf(p.species, p.color)
  const words = `${c.name.toLowerCase()} ${SPECIES[p.species].name.toLowerCase()}`
  return `${/^[aeiou]/.test(words) ? 'an' : 'a'} ${words}`
}

export type Stage = 'seed' | 'sprout' | 'bud' | 'bloom'

export function stageOf(p: GardenPlant): Stage {
  if (p.bloomed_at) return 'bloom'
  const need = NEED[p.species]
  if (p.growth <= 0) return 'seed'
  if (p.growth >= need - 1) return 'bud'
  return 'sprout'
}

/** Who has watered this plant today (watered_by only means today on water_day). */
export function wateredToday(p: GardenPlant, today: string | null): string[] {
  return today && p.water_day === today ? p.watered_by : []
}

export function rainedToday(p: GardenPlant, today: string | null): boolean {
  return !!today && p.rained_day === today
}

/** Beds touching this one (left, right, above, below): where mixed colours come from. */
export function neighbours(slot: number): number[] {
  const out: number[] = []
  if (slot % COLUMNS > 0) out.push(slot - 1)
  if (slot % COLUMNS < COLUMNS - 1) out.push(slot + 1)
  if (slot - COLUMNS >= 0) out.push(slot - COLUMNS)
  if (slot + COLUMNS < BEDS) out.push(slot + COLUMNS)
  return out
}
