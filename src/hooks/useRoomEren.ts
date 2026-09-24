'use client'

import { useMemo, type CSSProperties } from 'react'
import { useErenStats } from './useErenStats'
import { useCatSpriteState } from './useCatSprite'
import { resolveRoomSkin, skinRoomFit } from '@/lib/skins'
import type { EyeLayout, LidTone } from '@/types'

export interface ErenSpriteProps {
  src: string
  tailSrc?: string
  tailOrigin?: string
  eyes?: Partial<EyeLayout>
  // Rooms whose default sprite wears tinted eyewear (the chemistry goggles)
  // pass these; a skin returns them undefined so BlinkingEren uses its plain
  // gray-lid / white-glint defaults.
  lidColor?: string
  glintBackground?: string
  // Blink-lid palette. A skin that repaints Eren's whole head (Rainbow,
  // Golden) carries its own so the lid isn't a grey slab, and so does a
  // household's own cat (derived from its fur, see lidToneFor); every other
  // skin and every room default leaves it undefined for his own fur tones.
  lidTone?: LidTone
  coat?: 'jelly'
  // Chemistry passes this so its goggle-lens blink stays the recolorable bar
  // instead of the realistic fur-toned eye. Skins omit it → realistic blink.
  plainLid?: boolean
  // Set ONLY for an active skin: the per-room box size + vertical lift that
  // make the tightly-trimmed skin match the room default's cat size/feet. The
  // fallback (default look) leaves these undefined so the room's own size prop
  // stands. BlinkingEren spreads `style` onto its outer wrapper.
  size?: number
  style?: CSSProperties
}

// Rooms that draw the household's own cat (cat_look) when no costume is on.
// Only rooms whose idle sprite IS erenGood_notail + erenGood_tail can: those
// are the two layers the material maps recolour. Every other room paints its
// own pose art (erenSleep, the chef, ...), which has no map yet.
const OWN_CAT_ROOMS = new Set(['home'])

// While the household's cat is still decoding (first visit this session) the
// room must show NO cat rather than classic Eren: a tuxedo owner seeing a
// cream cat for half a second reads as "my cat got reset". Hidden, not
// unmounted, so the layout and BlinkingEren's decode-gated reveal hold.
const HIDDEN: CSSProperties = { visibility: 'hidden' }

export interface RoomErenState {
  sprite: ErenSpriteProps
  /**
   * True while the room has no cat to draw yet: the household's own cat is
   * decoding for the first time this session (~0.1s, up to ~0.5s on a slow
   * phone; after that it is cached). A room with a loader should hold the
   * loader until this clears — otherwise `sprite.src` changes after the room
   * is shown, and a preload keyed on it runs a second time. A later change
   * (the partner recolours the cat) keeps the old cat up until the new one is
   * ready, so this stays false then.
   */
  pending: boolean
}

// Resolve a room's IDLE Eren sprite props: the skin assigned in the (shared,
// household) Closet, else the household's own cat where the room can draw it,
// else the room's built-in default. Action poses (eat/wash/sleep cycles) are
// unaffected — they render their own PoseSprites. `fallback.eyes` should be a
// stable (module-level) reference so the memo holds and Feed/Play's per-frame
// render loops don't reconcile the sprite stack every frame.
export function useRoomErenState(roomId: string, fallback: ErenSpriteProps): RoomErenState {
  const { stats } = useErenStats()
  const skin = resolveRoomSkin(stats?.room_skins, roomId)
  // "Classic" in the Closet means no costume, and with no costume the room
  // shows the household's cat. The classic PNGs ARE that cat for a household
  // that never built one (cat_look null), so nothing changes for them.
  const costume = skin && skin.id !== 'classic' ? skin : null
  const ownCatRoom = OWN_CAT_ROOMS.has(roomId) && !costume
  const own = useCatSpriteState(ownCatRoom ? stats?.cat_look : null)
  const skinId = skin?.id ?? null
  const ownSrc = own.sprite?.src ?? null
  const pending = ownCatRoom && own.pending && !own.sprite
  const sprite = useMemo<ErenSpriteProps>(
    () => {
      if (own.sprite) {
        // Same canvas and geometry as erenGood_notail/_tail, so the room's
        // own size, eyes and tail pivot all hold; only the pixels and the lid
        // change.
        return { ...fallback, src: own.sprite.src, tailSrc: own.sprite.tailSrc, lidTone: own.sprite.lidTone }
      }
      if (pending) return { ...fallback, style: HIDDEN }
      if (!skin) return fallback
      const fit = skinRoomFit(skin, roomId)
      return {
        src: skin.src, tailSrc: skin.tailSrc, tailOrigin: skin.tailOrigin, eyes: skin.eyes,
        lidTone: skin.lidTone,
        coat: skin.coat,
        size: fit?.size,
        style: fit ? { transform: `translateY(${-fit.lift}px)` } : undefined,
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skinId, roomId, ownSrc, pending, fallback.src, fallback.tailSrc, fallback.tailOrigin, fallback.eyes],
  )
  return { sprite, pending }
}

export function useRoomEren(roomId: string, fallback: ErenSpriteProps): ErenSpriteProps {
  return useRoomErenState(roomId, fallback).sprite
}
