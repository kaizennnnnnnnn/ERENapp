'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { isClassicLook, parseCatLook, type CatLook } from '@/lib/catIdentity'
import {
  catSpriteFailed, holdCatSprite, lookKey, peekCatSprite, releaseCatSprite, retainCatSprite,
  subscribeCatSprites, type CatSprite,
} from '@/lib/catRecolour'

export type { CatSprite }

/**
 * The validated look and its cache key, or null when it should draw as classic
 * Eren: no look, a malformed one (cat_look is jsonb the other phone writes),
 * or one whose colours are the classic's (isClassicLook, the same test
 * CatPortrait makes, so Home and every portrait agree on the cat).
 */
export function customLook(raw: unknown): { look: CatLook; key: string } | null {
  const look = parseCatLook(raw)
  if (!look || isClassicLook(look)) return null
  return { look, key: lookKey(look) }
}

export interface CatSpriteState {
  /**
   * The layers + blink lid to draw, or null for classic Eren. While a new
   * look decodes this stays on the last look this component showed, so a
   * partner's recolour swaps the cat once instead of blinking it out.
   */
  sprite: CatSprite | null
  /** The current look is still decoding. */
  pending: boolean
  /** The current look could not be decoded; callers fall back to classic. */
  failed: boolean
}

const subscribe = subscribeCatSprites
const none = () => null

/**
 * Decode a household's look into the two layers home draws (body without the
 * tail, and the tail, both drop-ins for the erenGood_* PNGs) plus a blink-lid
 * tone. The decode runs after mount, off the first paint, and is shared and
 * cached per look, so a look already decoded this session (say, built in
 * onboarding a minute ago) resolves on the very first render.
 */
export function useCatSpriteState(raw: unknown): CatSpriteState {
  const parsed = customLook(raw)
  const key = parsed?.key ?? null
  // The raw look is re-created by every stats refresh; the key is what
  // identifies it, so the parsed look only follows the key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const look = useMemo(() => parsed?.look ?? null, [key])

  useEffect(() => {
    if (!key || !look) return
    retainCatSprite(key, look)
    return () => releaseCatSprite(key)
  }, [key, look])

  const current = useSyncExternalStore(subscribe, () => (key ? peekCatSprite(key) : null), none)
  const failed = useSyncExternalStore(subscribe, () => (key ? catSpriteFailed(key) : false), () => false)

  // The look this component last showed. Held (so its URLs can't be revoked
  // under the <img>) until a newer one is on screen, or the look is cleared.
  const [shownKey, setShownKey] = useState<string | null>(null)
  useEffect(() => {
    if (!key) setShownKey(null)
    else if (current) setShownKey(key)
  }, [key, current])
  useEffect(() => {
    if (!shownKey || !holdCatSprite(shownKey)) return
    return () => releaseCatSprite(shownKey)
  }, [shownKey])
  const shown = useSyncExternalStore(subscribe, () => (shownKey ? peekCatSprite(shownKey) : null), none)

  return {
    sprite: key ? current ?? (failed ? null : shown) : null,
    pending: !!key && !current && !failed,
    failed,
  }
}

/** `{ src, tailSrc, lidTone }` for a custom look, or null (classic / not ready). */
export function useCatSprite(look: unknown): CatSprite | null {
  return useCatSpriteState(look).sprite
}
