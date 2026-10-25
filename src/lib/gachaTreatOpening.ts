import type { GachaRarity } from '@/types'

export type TreatOpeningKind = 'parcel' | 'chef'
export const clampOpening = (n: number) => Math.max(0, Math.min(1, n))
export const easeOpening = (n: number) => 1 - Math.pow(1 - clampOpening(n), 3)

/** All times are relative to mount; a slow roll never opens an empty container. */
export function treatOpeningFrame(
  kind: TreatOpeningKind, elapsed: number, readyAt: number | null,
  rarity: GachaRarity | null, reduced: boolean,
) {
  const arrivalMs = reduced ? 120 : kind === 'parcel' ? 800 : 900
  const anticipationMs = reduced ? 80 : 420 + (rarity === 'legendary' ? 220 : 0)
  const openMs = reduced ? 150 : kind === 'parcel' ? 780 : 820
  const holdMs = reduced ? 120 : 350
  const fadeMs = reduced ? 100 : 250
  const ready = readyAt !== null && rarity !== null
  const windAt = ready ? Math.max(arrivalMs, readyAt) : Infinity
  const openAt = windAt + anticipationMs
  const fadeAt = openAt + openMs + holdMs
  return {
    arrival: clampOpening(elapsed / arrivalMs),
    wind: clampOpening((elapsed - windAt) / anticipationMs),
    open: clampOpening((elapsed - openAt) / openMs),
    fade: clampOpening((elapsed - fadeAt) / fadeMs),
    done: elapsed >= fadeAt + fadeMs,
    phase: elapsed < arrivalMs ? 'arriving'
      : !ready ? 'waiting'
      : elapsed < openAt ? 'anticipating'
      : elapsed < openAt + openMs ? 'opening'
      : elapsed < fadeAt ? 'presenting' : 'leaving',
  } as const
}

export type TreatOpeningFrame = ReturnType<typeof treatOpeningFrame>
