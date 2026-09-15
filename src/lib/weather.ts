// ═══════════════════════════════════════════════════════════════════════════
// WEATHER — what the sky is doing outside each room's window.
//
// This replaces the room-decor shelf. Decor asked you to hang a rosette on the
// bathroom wall, which is a sticker on somebody else's painting; weather
// changes what is OUTSIDE, which the art already has a hole for. Every room in
// the game has a window, and until now every one of them showed the same
// painted afternoon forever.
//
// NOTHING HERE IS FOR SALE. Skies were once bought one at a time — ten cards,
// ten prices, and a picker that was mostly padlocks, which made the sky a
// wardrobe. What you work toward now is the MACHINE (see lib/weatherMachine):
// build its four parts and every sky below is yours at once, forever. So these
// entries carry no price and no rarity; they are a catalogue, not a shelf.
//
// A sky is then set per room from the machine in the Lab, so the household can
// have a thunderstorm over the bath and a sunrise over breakfast. `clear` is
// what the artist painted and is never gated — it is the absence of a layer,
// not a layer.
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

export interface WeatherDef {
  id: WeatherId
  /** Picker label. */
  name: string
  /** One line. Say what you will SEE, not what it is called. */
  blurb: string
  /** Drives the picker chip and the thumbnail's sky. */
  tone: string
  /** There is a sun painted in this one. See skyBlockedIn. */
  sun?: boolean
}

export const WEATHER: WeatherDef[] = [
  {
    id: 'clear', name: 'Clear', tone: '#8FD3FF',
    blurb: 'The afternoon the room was painted in.',
  },
  {
    id: 'rain', name: 'Rain', tone: '#7FA8D8',
    blurb: 'Steady grey rain, and drops crawling down the glass.',
  },
  {
    id: 'snow', name: 'Snowfall', tone: '#DCEBFF',
    blurb: 'Fat slow flakes, and the light going pale and blue.',
  },
  {
    id: 'sunrise', name: 'Sunrise', tone: '#FFB56B', sun: true,
    blurb: 'A low gold sun coming up, warming the whole pane.',
  },
  {
    id: 'sunset', name: 'Sunset', tone: '#FF7E6B', sun: true,
    blurb: 'Orange going to rose going to violet, and then it is evening.',
  },
  {
    id: 'petals', name: 'Petal Drift', tone: '#FFAFCB',
    blurb: 'Somebody is losing a cherry tree somewhere upwind.',
  },
  {
    id: 'storm', name: 'Thunderstorm', tone: '#9BA8E8',
    blurb: 'Hard rain, and every so often the whole window goes white.',
  },
  {
    id: 'fireflies', name: 'Fireflies', tone: '#FFE28A',
    blurb: 'Dusk, and a dozen little lights that will not hold still.',
  },
  {
    id: 'meteors_gold', name: 'Meteor Shower', tone: '#FFD86B',
    blurb: 'A clear night and gold streaks going over, one after another.',
  },
  {
    id: 'meteors_rose', name: 'Rose Meteors', tone: '#FF8FC8',
    blurb: 'The same sky, falling pink. Nobody can explain it.',
  },
  {
    id: 'aurora', name: 'Aurora', tone: '#63F0C0',
    blurb: 'Green and violet curtains, moving like they are breathing.',
  },
]

export const WEATHER_BY_ID: Record<WeatherId, WeatherDef> =
  Object.fromEntries(WEATHER.map(w => [w.id, w])) as Record<WeatherId, WeatherDef>

export function weatherDef(id: string | null | undefined): WeatherDef | null {
  if (!id) return null
  return WEATHER_BY_ID[id as WeatherId] ?? null
}

// ─── Where a sky may hang ────────────────────────────────────────────────────
// Almost anywhere. Rain, snow and petals are semi-transparent washes laid over
// whatever the artist painted, so they sit correctly over an afternoon and over
// a midnight alike. The two SUN skies are not: sunrise and sunset paint a graded
// sky at 0.92 opacity with a disc travelling through it, i.e. they replace the
// sky rather than tint it.
//
// The bedroom is the one room with no day picture at all. SleepScene mounts
// RoomWeather with `dark` hard-coded true and roomWindows points its night cut
// back at its day cut, because the room was painted after dark — lamp lit,
// crescent moon in the arch. A sunset in that window is a sun setting behind a
// moon, which is why it looked wrong rather than merely bright.
//
// So the rule is one property of the SKY crossed with one property of the ROOM,
// and it lives here rather than in the picker because the picker is not the only
// thing that has to obey it: a map saved before the rule existed still has a
// sunset on the bedroom, and RoomWeather has to refuse to draw that too.

/** Rooms whose art is painted after dark and never lights up. */
export const NIGHT_ONLY_ROOMS: readonly string[] = ['sleep']

export function roomIsNightOnly(room: string): boolean {
  return NIGHT_ONLY_ROOMS.includes(room)
}

/**
 * Why this sky cannot hang in this window, or null if it can. Returns the
 * REASON rather than a boolean so the one sentence the player reads lives next
 * to the rule that produced it and the two cannot drift apart.
 */
export function skyBlockedIn(room: string, id: string | null | undefined): string | null {
  const def = weatherDef(id)
  if (!def || !def.sun || !roomIsNightOnly(room)) return null
  return 'No sun in here - this room is always night.'
}
