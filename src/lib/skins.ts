import type { GachaItemDef, GachaRarity, EyeLayout, LidTone, FoodKey } from '@/types'
import { SKIN_DATA } from './skinsData'
import { FOOD_META } from './foodMeta'

// ═══════════════════════════════════════════════════════════════════════════
// SKINS — full-body Eren looks won from the Clothing gacha (and other ways).
// Each skin is the same front-facing sitting cat, so it slots straight into
// BlinkingEren (breathe + blink + tail-wiggle) the way every room sprite does.
// Asset pipeline: scripts/build_skins.cjs → public/skins/* + src/lib/skinsData.ts
// ═══════════════════════════════════════════════════════════════════════════

export interface SkinDef {
  id: string
  name: string
  rarity: GachaRarity
  set?: 'animal' | 'food'  // which skin gacha drops it (animal/food costumes)
  // BlinkingEren render inputs
  src: string            // tail-erased body (or full sprite when no tail layer)
  tailSrc?: string       // isolated tail layer (omitted → body breathes as one)
  tailOrigin?: string    // tail pivot, BlinkingEren box coords
  eyes?: Partial<EyeLayout> // per-skin eye overlay; omit → BlinkingEren default
  thumb: string          // full sprite for gacha reveal / collection / closet card
  aspect: number         // w/h of the trimmed sprite (card sizing)
  builtin?: boolean      // always owned, never a gacha drop (Classic look)
  // Non-gacha unlock route. 'drink' = earned the first time you feed the
  // matching SPECIAL EDITION can (see DRINK_UNLOCK_SKINS). These skins are out
  // of every banner pool AND out of the stardust shop on purpose.
  unlock?: 'drink' | 'jelly'
  // Poured-jelly gloss over the sprite (components/JellyCoat). Set only on the
  // Parlour reward; travels with the look to every surface that renders it.
  coat?: 'jelly'
  // Blink-lid palette. Omit to keep Eren's own fur tones; set only on a skin
  // that repaints his whole head (see LID_TONES below).
  lidTone?: LidTone
  // Vertical framing of the sprite's CAT inside its canvas, as fractions of
  // canvas height. The 21 gacha skins are trimmed tight (cat fills the canvas:
  // catFracH 1, botGap 0); Classic reuses padded erenGood. Used to size a skin
  // to match each room's default sprite (which carries padding). Defaults: 1/0.
  catFracH?: number      // cat height / canvas height
  botGap?: number        // empty space below the cat / canvas height
}

// The everyday look — always owned, selectable in any room. Uses BlinkingEren's
// built-in erenGood eye/tail defaults (eyes/tailOrigin omitted on purpose).
export const CLASSIC_SKIN: SkinDef = {
  id: 'classic',
  name: 'Classic Eren',
  rarity: 'common',
  src: '/erenGood_notail.png',
  tailSrc: '/erenGood_tail.png',
  thumb: '/erenGood.png',
  aspect: 0.671,
  builtin: true,
  // erenGood is padded, not tight — measured 76.1% cat height, 10.1% bottom gap.
  catFracH: 0.761,
  botGap: 0.101,
}

// Cache-buster for the skin PNGs. The SW serves images stale-while-revalidate,
// so re-running the pipeline (which overwrites /skins/* in place) would keep
// showing the OLD art — bump this whenever build_skins.cjs regenerates assets.
const SKIN_V = '19'
const v = (p?: string) => (p ? `${p}?v=${SKIN_V}` : p)

// Per-skin cat-body fraction override. The gacha skins are trimmed tight, so by
// default the cat IS the whole canvas (catFracH 1) and skinRoomFit sizes the
// canvas to the room's cat-height target. For a costume that's TALLER than the
// cat — banana's elongated peel — the cat fills only part of that tall canvas,
// so the default sizing shrinks the cat-inside (banana's face measured the
// smallest of all skins). Setting catFracH < 1 sizes the skin up so the cat
// matches the others; botGap stays 0 (paws at the canvas bottom), so the bigger
// box grows upward and the feet stay aligned.
const SKIN_CAT_FRAC: Record<string, number> = { banana: 0.8 }

// ─── Drink unlocks ───────────────────────────────────────────────────────────
// Two looks are NOT in any gacha and cost no stardust: the only way to wear them
// is to actually pour the can. Pour a Rainbow Monsta and Eren keeps the rainbow;
// pour a Gold Monsta and he keeps the gold. Once, the first time — after that the
// can is just a can again.
//
// Keyed by the FOOD id (the fridge/kitchen id), because that's what FeedScene has
// in hand the moment a can goes down. Everything else — the `unlock` flag that
// pulls the skin out of the banner pools, the closet's "how do I get this" hint,
// the collection's mystery card — is DERIVED from this one table, so a third
// special can is one line here and nothing else.
export const DRINK_UNLOCK_SKINS: Record<string, string> = {
  monsta_rainbow: 'rainbow',
  monsta_gold: 'gold',
}

const SKIN_UNLOCK_DRINK: Record<string, string> = Object.fromEntries(
  Object.entries(DRINK_UNLOCK_SKINS).map(([food, skin]) => [skin, food]))

// ─── Jelly unlock ────────────────────────────────────────────────────────────
// The third non-gacha look, and the only one that isn't earned in the kitchen:
// win all five jellies in the Parlour (lib/jellies.ts) and Eren keeps one of his
// own. It also carries `coat: 'jelly'` — the gloss that makes him read as set
// gelatin wherever he's rendered.
export const JELLY_SKIN = 'jelly'

// ─── Lid tones ───────────────────────────────────────────────────────────────
// A closed eyelid is fur, so it has to be the colour of the face wearing it.
// Every costume skin keeps Eren's own ragdoll brow — the costume is a hat or a
// suit, his face is still his face. The two drink unlocks are the exception:
// they repaint the whole head, so a default lid reads as a grey-brown slab
// dropped on a rainbow. Each gets its own, shaded top-to-bottom so the lid still
// sits in shadow the way a real lid does instead of glowing flat.
const LID_TONES: Record<string, LidTone> = {
  rainbow: {
    // The spectrum runs left→right to match the fur, under a heavy vertical
    // shade. The shade is the whole trick: without it the lid reads as a glossy
    // marble sitting on his face instead of skin folded over an eye.
    base: 'linear-gradient(180deg, rgba(26,6,44,0.10) 0%, rgba(26,6,44,0.52) 100%), ' +
      'linear-gradient(90deg, #FF5C7A 0%, #FFB255 18%, #FFF06B 36%, #63F094 55%, #4FD8FF 76%, #BB78FF 100%)',
    sheen: 'linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0))',
    seam: '#240938',
    flat: '#7B45B4',
  },
  gold: {
    base: 'linear-gradient(180deg, #E4C173 0%, #C08F26 52%, #5E3405 100%)',
    sheen: 'linear-gradient(180deg, rgba(255,250,222,0.26), rgba(255,250,222,0))',
    seam: '#331D03',
    flat: '#B5851A',
  },
}

/** The can that unlocks this skin, or undefined for an ordinary gacha look. */
export const skinUnlockDrink = (skinId: string): string | undefined => SKIN_UNLOCK_DRINK[skinId]

// The gacha skins (animal + food sets), from the auto-generated render data.
export const GACHA_SKINS: SkinDef[] = SKIN_DATA.map(s => ({
  id: s.id,
  name: s.name,
  rarity: s.rarity,
  set: s.set,
  unlock: SKIN_UNLOCK_DRINK[s.id] ? ('drink' as const)
    : s.id === JELLY_SKIN ? ('jelly' as const) : undefined,
  coat: s.id === JELLY_SKIN ? ('jelly' as const) : undefined,
  lidTone: LID_TONES[s.id],
  src: v(s.src)!,
  tailSrc: v(s.tailSrc),
  tailOrigin: s.tailOrigin,
  eyes: s.eyes,
  thumb: v(s.thumb)!,
  aspect: s.aspect,
  catFracH: SKIN_CAT_FRAC[s.id],
}))

export const ALL_SKINS: SkinDef[] = [CLASSIC_SKIN, ...GACHA_SKINS]

const SKIN_BY_ID: Record<string, SkinDef> = Object.fromEntries(ALL_SKINS.map(s => [s.id, s]))

export function getSkin(id: string | null | undefined): SkinDef | undefined {
  if (!id) return undefined
  return SKIN_BY_ID[id]
}

// ─── Gacha integration ───────────────────────────────────────────────────────
// Each skin becomes a gacha item id `skin_<id>`; the inventory stores that id.
// `skinId` keys back into the catalogue for the animated render.
export const SKIN_ITEM_PREFIX = 'skin_'
export const skinItemId = (skinId: string) => `${SKIN_ITEM_PREFIX}${skinId}`
export const itemIdToSkinId = (itemId: string) =>
  itemId.startsWith(SKIN_ITEM_PREFIX) ? itemId.slice(SKIN_ITEM_PREFIX.length) : null

// ─── Stardust shop ─────────────────────────────────────────────────────────
// Buy a skin outright with stardust (the gacha duplicate currency) instead of
// pulling for it. There are no common gacha skins, so rare/epic/legendary covers
// every skin (animal + food). Kept here so the closet UI and the purchase RPC
// reason about one map.
export const SKIN_STARDUST_PRICE: Record<GachaRarity, number> = {
  common: 50, rare: 100, epic: 150, legendary: 200,
}
export const skinPrice = (rarity: GachaRarity): number => SKIN_STARDUST_PRICE[rarity]

const RARITY_BLURB: Record<GachaRarity, string> = {
  common: 'A cosy everyday look.',
  rare: 'A rare costume look — wear it in any room from the Closet.',
  epic: 'An epic costume look — wear it in any room from the Closet.',
  legendary: 'A legendary full costume — wear it in any room from the Closet.',
}

export const SKIN_GACHA_ITEMS: GachaItemDef[] = GACHA_SKINS.map(s => ({
  id: skinItemId(s.id),
  name: s.name,
  category: 'skin',
  rarity: s.rarity,
  image: s.thumb,
  skinId: s.id,
  skinSet: s.set,      // scopes the item to its banner (animal vs food)
  // A drink-unlock skin stays in the CATALOGUE (the collection screen still
  // tracks it, the closet still lists it) but `unlock` keeps it out of every
  // banner pool — see bannerFilter in lib/gacha.ts.
  unlock: s.unlock,
  description: s.unlock === 'jelly'
    ? 'Win all five jellies in the Jelly Parlour and Eren keeps one of his own.'
    : s.unlock === 'drink'
      ? `Feed Eren a ${FOOD_META[skinUnlockDrink(s.id) as FoodKey].name} to keep this look.`
      : RARITY_BLURB[s.rarity],
}))

// ─── Rooms ───────────────────────────────────────────────────────────────────
// Rooms whose idle Eren can be re-skinned. ids match CareContext scene ids /
// the home room. `defaultThumb` is the room's built-in look (the "Default"
// option in the closet). Action poses (eat/wash/sleep cycles) are unaffected.
export interface RoomDef {
  id: string
  label: string
  defaultThumb: string
}

export const SKINNABLE_ROOMS: RoomDef[] = [
  { id: 'home',      label: 'Living Room', defaultThumb: '/erenGood.png' },
  { id: 'feed',      label: 'Kitchen',     defaultThumb: '/ErenCook.png' },
  { id: 'play',      label: 'Play Room',   defaultThumb: '/ErenBell.png' },
  { id: 'sleep',     label: 'Bedroom',     defaultThumb: '/erenSleep.png' },
  { id: 'wash',      label: 'Bathroom',    defaultThumb: '/ErenBathroomHat.png' },
  { id: 'chemistry', label: 'Lab',         defaultThumb: '/ErenLab.png' },
  { id: 'vet',       label: 'Vet',         defaultThumb: '/ErenVet.png' },
  // The attic has no themed pose of its own — he sits as himself there, same
  // as the living room, so it shows the plain look as its default.
  { id: 'talk',      label: 'Attic',       defaultThumb: '/erenGood.png' },
]

// Per-room fit: the BlinkingEren `size` each room renders its default sprite
// at, plus that sprite's measured cat framing (cat height + bottom gap as
// fractions of canvas height, from scripts/measure_frames.cjs). A skin is
// sized so its cat matches the room default's cat, and lifted so the feet line
// up. NOTE: `size` must stay in sync with the room's BlinkingEren size prop.
export interface RoomFit { size: number; catFracH: number; botGap: number }
// `size` is the room's BlinkingEren size; `catFracH` targets the room's CAT
// BODY height (~150px on screen, consistent across rooms since it's the same
// cat). Kitchen (chef toque) and Bedroom (nightcap, curled) measure tall
// silhouettes, so their catFracH is set to the BODY fraction (not the hat-
// inflated bbox) — otherwise a body-dominant skin renders far too big there.
export const ROOM_FIT: Record<string, RoomFit> = {
  home:      { size: 200, catFracH: 0.761, botGap: 0.101 },
  feed:      { size: 210, catFracH: 0.715, botGap: 0.075 },
  play:      { size: 200, catFracH: 0.751, botGap: 0.115 },
  sleep:     { size: 230, catFracH: 0.655, botGap: 0.120 },
  wash:      { size: 200, catFracH: 0.776, botGap: 0.101 },
  chemistry: { size: 230, catFracH: 0.640, botGap: 0.165 },
  vet:       { size: 200, catFracH: 0.750, botGap: 0.136 },
  // The attic paints the SAME sprite as home (erenGood_notail), so its cat
  // framing is home's measurement verbatim; only the room's BlinkingEren size
  // differs (210 there, 200 here). Not a guess — copying the numbers is
  // correct precisely because it's the same art.
  talk:      { size: 210, catFracH: 0.761, botGap: 0.101 },
}

// Compute the BlinkingEren box size + vertical lift (px) to render `skin` in
// `roomId` so its cat matches that room's default sprite in both height and
// foot position. Returns null if the room has no fit data (render as-is).
export function skinRoomFit(skin: SkinDef, roomId: string): { size: number; lift: number } | null {
  const fit = ROOM_FIT[roomId]
  if (!fit) return null
  const sc = skin.catFracH ?? 1   // skin cat fill (gacha skins are tight = 1)
  const sb = skin.botGap ?? 0
  const size = Math.round((fit.size * fit.catFracH) / sc)
  const lift = Math.round(fit.size * fit.botGap - size * sb)
  return { size, lift }
}

// Resolve a room's assigned skin from the household room_skins map. Returns the
// SkinDef to render, or null when the room should keep its built-in default.
// A stale id (skin removed from the catalogue) safely falls back to default.
export function resolveRoomSkin(
  roomSkins: Record<string, string> | null | undefined,
  roomId: string,
): SkinDef | null {
  const id = roomSkins?.[roomId]
  if (!id || id === 'classic') return id === 'classic' ? CLASSIC_SKIN : null
  return getSkin(id) ?? null
}
