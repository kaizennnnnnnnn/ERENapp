// How each daily twist looks in Meadow: its icon and tint, for the rule chips
// and rule cards on the morning verdict and the battle sheet.

import type { TwistId } from '@/lib/dailyTwist'
import { M, TINT, type MeadowIconName } from '@/components/meadow'

/** `color` recolours an icon whose own colour would say the wrong thing (the
 *  plus is drawn leaf green, "add"; on nurse day it is a red cross). */
export const TWIST_LOOK: Record<TwistId, { icon: MeadowIconName; tint: string; color?: string }> = {
  bath_day:   { icon: 'drop',    tint: TINT.sky },
  feast:      { icon: 'bowl',    tint: TINT.orange },
  playday:    { icon: 'paw',     tint: TINT.love },
  nap_day:    { icon: 'moon',    tint: TINT.lilac },
  nurse:      { icon: 'plus',    tint: TINT.danger, color: M.danger },
  double:     { icon: 'sparkle', tint: TINT.amber },
  full_house: { icon: 'star',    tint: TINT.amber },
  sprint:     { icon: 'bolt',    tint: TINT.orange },
}

/** "NURSE DAY" -> "Nurse day": the twist names are written for the pixel HUD. */
export function sentence(caps: string): string {
  return caps.charAt(0) + caps.slice(1).toLowerCase()
}
