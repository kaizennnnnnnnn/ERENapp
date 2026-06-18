'use client'

import { useMemo } from 'react'
import { useErenStats } from './useErenStats'
import { resolveRoomSkin } from '@/lib/skins'
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
    () => skin ? { src: skin.src, tailSrc: skin.tailSrc, tailOrigin: skin.tailOrigin, eyes: skin.eyes } : fallback,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skinId, fallback.src, fallback.tailSrc, fallback.tailOrigin, fallback.eyes],
  )
}
