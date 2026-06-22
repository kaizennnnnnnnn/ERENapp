'use client'

import { useMemo, type CSSProperties } from 'react'
import { useErenStats } from './useErenStats'
import { resolveRoomSkin, skinRoomFit } from '@/lib/skins'
import type { EyeLayout } from '@/types'

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

// Resolve a room's IDLE Eren sprite props: the skin assigned in the (shared,
// household) Closet, or the room's built-in default when none is set. Action
// poses (eat/wash/sleep cycles) are unaffected — they render their own
// PoseSprites. `fallback.eyes` should be a stable (module-level) reference so
// the memo holds and Feed/Play's per-frame render loops don't reconcile the
// sprite stack every frame.
export function useRoomEren(roomId: string, fallback: ErenSpriteProps): ErenSpriteProps {
  const { stats } = useErenStats()
  const skin = resolveRoomSkin(stats?.room_skins, roomId)
  const skinId = skin?.id ?? null
  return useMemo<ErenSpriteProps>(
    () => {
      if (!skin) return fallback
      const fit = skinRoomFit(skin, roomId)
      return {
        src: skin.src, tailSrc: skin.tailSrc, tailOrigin: skin.tailOrigin, eyes: skin.eyes,
        size: fit?.size,
        style: fit ? { transform: `translateY(${-fit.lift}px)` } : undefined,
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skinId, roomId, fallback.src, fallback.tailSrc, fallback.tailOrigin, fallback.eyes],
  )
}
