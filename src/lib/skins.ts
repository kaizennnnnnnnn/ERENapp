import type { GachaItemDef, GachaRarity, EyeLayout } from '@/types'
import { SKIN_DATA } from './skinsData'

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
  // BlinkingEren render inputs
  src: string            // tail-erased body (or full sprite when no tail layer)
  tailSrc?: string       // isolated tail layer (omitted → body breathes as one)
  tailOrigin?: string    // tail pivot, BlinkingEren box coords
  eyes?: Partial<EyeLayout> // per-skin eye overlay; omit → BlinkingEren default
  thumb: string          // full sprite for gacha reveal / collection / closet card
  aspect: number         // w/h of the trimmed sprite (card sizing)
  builtin?: boolean      // always owned, never a gacha drop (Classic look)
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
const SKIN_V = '6'
const v = (p?: string) => (p ? `${p}?v=${SKIN_V}` : p)

// The 21 gacha skins, from the auto-generated render data.
export const GACHA_SKINS: SkinDef[] = SKIN_DATA.map(s => ({
  id: s.id,
  name: s.name,
  rarity: s.rarity,
  src: v(s.src)!,
  tailSrc: v(s.tailSrc),
  tailOrigin: s.tailOrigin,
  eyes: s.eyes,
  thumb: v(s.thumb)!,
  aspect: s.aspect,
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
  icon: '🐱',          // never shown — skin items render `image`
  image: s.thumb,
  skinId: s.id,
  description: RARITY_BLURB[s.rarity],
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
