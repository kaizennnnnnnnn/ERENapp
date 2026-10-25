import type { GachaRarity } from '@/types'

export type TreatOpeningKind = 'parcel' | 'chef'
export const clampOpening = (n: number) => Math.max(0, Math.min(1, n))
export const easeOpening = (n: number) => 1 - Math.pow(1 - clampOpening(n), 3)

/** All times are relative to mount; a slow roll never opens an empty container. */
export function treatOpeningFrame(
  kind: TreatOpeningKind, elapsed: number, readyAt: number | null,
  rarity: GachaRarity | null, reduced: boolean,
) {
  const tier = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0
  const arrivalMs = reduced ? 120 : kind === 'parcel' ? 700 : 760
  const anticipationMs = reduced ? 80 : [280, 360, 500, 660][tier]
  const openMs = reduced ? 150 : [640, 760, 900, 1060][tier]
  const holdMs = reduced ? 120 : [160, 220, 300, 400][tier]
  const fadeMs = reduced ? 100 : 200
  const ready = readyAt !== null && rarity !== null
  const windAt = ready ? Math.max(arrivalMs, readyAt) : Infinity
  const openAt = windAt + anticipationMs
  const fadeAt = openAt + openMs + holdMs
  return {
    arrival: clampOpening(elapsed / arrivalMs),
    wind: clampOpening((elapsed - windAt) / anticipationMs),
    open: clampOpening((elapsed - openAt) / openMs),
    burstMs: Math.max(0, elapsed - openAt),
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
