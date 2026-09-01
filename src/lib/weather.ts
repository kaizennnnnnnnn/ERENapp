// ═══════════════════════════════════════════════════════════════════════════
// WEATHER — what the sky is doing outside each room's window.
//
// This replaces the room-decor shelf. Decor asked you to hang a rosette on the
// bathroom wall, which is a sticker on somebody else's painting; weather
// changes what is OUTSIDE, which the art already has a hole for. Every room in
// the game has a window, and until now every one of them showed the same
// painted afternoon forever.
//
// A sky is bought once with trophies and then set per room from the machine in
// the Lab, so the household can have a thunderstorm over the bath and a
// sunrise over breakfast. `clear` is what the artist painted and is always
// owned — it is the absence of a layer, not a layer.
// ═══════════════════════════════════════════════════════════════════════════

export type WeatherId =
  | 'clear'
  | 'rain'
  | 'snow'
  | 'sunrise'
  | 'sunset'
  | 'storm'
  | 'petals'
  | 'fireflies'
  | 'meteors_gold'
  | 'meteors_rose'
  | 'aurora'

export type WeatherRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface WeatherDef {
  id: WeatherId
  /** Shop and picker label. */
  name: string
  /** One line. Say what you will SEE, not what it is called. */
  blurb: string
  /** Trophies. `clear` is free and never listed. */
  price: number
  rarity: WeatherRarity
  /** Drives the picker chip and the thumbnail's sky. */
  tone: string
  /** True for the ones that darken the room's own light. */
  night?: boolean
}

/** The shop item id for a sky. Kept derivable so nothing has to hold a map. */
export function weatherItemId(id: WeatherId): string {
  return `wx_${id}`
}

export function weatherFromItemId(itemId: string): WeatherId | null {
  if (!itemId.startsWith('wx_')) return null
  const id = itemId.slice(3) as WeatherId
  return id in WEATHER_BY_ID ? id : null
}

export const WEATHER: WeatherDef[] = [
  {
    id: 'clear', name: 'Clear', price: 0, rarity: 'common', tone: '#8FD3FF',
    blurb: 'The afternoon the room was painted in. Always yours.',
  },
  {
    id: 'rain', name: 'Rain', price: 8, rarity: 'common', tone: '#7FA8D8',
    blurb: 'Steady grey rain, and drops crawling down the glass.',
  },
  {
    id: 'snow', name: 'Snowfall', price: 8, rarity: 'common', tone: '#DCEBFF',
    blurb: 'Fat slow flakes, and the light going pale and blue.',
  },
  {
    id: 'sunrise', name: 'Sunrise', price: 14, rarity: 'rare', tone: '#FFB56B',
    blurb: 'A low gold sun coming up, warming the whole pane.',
  },
  {
    id: 'sunset', name: 'Sunset', price: 14, rarity: 'rare', tone: '#FF7E6B',
    blurb: 'Orange going to rose going to violet, and then it is evening.',
  },
  {
    id: 'petals', name: 'Petal Drift', price: 14, rarity: 'rare', tone: '#FFAFCB',
    blurb: 'Somebody is losing a cherry tree somewhere upwind.',
  },
  {
    id: 'storm', name: 'Thunderstorm', price: 22, rarity: 'epic', tone: '#9BA8E8',
    blurb: 'Hard rain, and every so often the whole window goes white.',
  },
  {
    id: 'fireflies', name: 'Fireflies', price: 22, rarity: 'epic', tone: '#FFE28A',
    night: true,
    blurb: 'Dusk, and a dozen little lights that will not hold still.',
  },
  {
    id: 'meteors_gold', name: 'Meteor Shower', price: 22, rarity: 'epic', tone: '#FFD86B',
    night: true,
    blurb: 'A clear night and gold streaks going over, one after another.',
  },
  {
    id: 'meteors_rose', name: 'Rose Meteors', price: 22, rarity: 'epic', tone: '#FF8FC8',
    night: true,
    blurb: 'The same sky, falling pink. Nobody can explain it.',
  },
  {
    id: 'aurora', name: 'Aurora', price: 40, rarity: 'legendary', tone: '#63F0C0',
    night: true,
    blurb: 'Green and violet curtains, moving like they are breathing.',
  },
]

export const WEATHER_BY_ID: Record<WeatherId, WeatherDef> =
  Object.fromEntries(WEATHER.map(w => [w.id, w])) as Record<WeatherId, WeatherDef>

/** Everything except `clear`, which is not for sale. */
export const WEATHER_FOR_SALE = WEATHER.filter(w => w.id !== 'clear')

export function weatherDef(id: string | null | undefined): WeatherDef | null {
  if (!id) return null
  return WEATHER_BY_ID[id as WeatherId] ?? null
}

export const WEATHER_RARITY_PRICE: Record<WeatherRarity, number> = {
  common: 8, rare: 14, epic: 22, legendary: 40,
}
