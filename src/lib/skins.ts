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
  aspect: 0.72,
  builtin: true,
}

// The 21 gacha skins, from the auto-generated render data.
export const GACHA_SKINS: SkinDef[] = SKIN_DATA.map(s => ({
  id: s.id,
  name: s.name,
  rarity: s.rarity,
  src: s.src,
  tailSrc: s.tailSrc,
  tailOrigin: s.tailOrigin,
  eyes: s.eyes,
  thumb: s.thumb,
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
