import type { GachaRarity } from '@/types'

export type TreatOpeningKind = 'parcel' | 'chef'
export const clampOpening = (n: number) => Math.max(0, Math.min(1, n))
export const easeOpening = (n: number) => 1 - Math.pow(1 - clampOpening(n), 3)

export const CHEF_OPENINGS = {
  original: { name: 'Classic lift', anticipation: 0, open: 0, hold: 0, releaseAt: 0 },
  'double-peek': { name: 'Double peek', anticipation: 80, open: 280, hold: 80, releaseAt: .4 },
  'ribbon-fan': { name: 'Ribbon fan', anticipation: 100, open: 240, hold: 100, releaseAt: .18 },
  'golden-fountain': { name: 'Golden fountain', anticipation: 180, open: 180, hold: 150, releaseAt: .18 },
  'royal-procession': { name: 'Royal procession', anticipation: 220, open: 240, hold: 160, releaseAt: .38 },
} as const
export type ChefOpeningVariant = keyof typeof CHEF_OPENINGS
const CHEF_POOLS: Record<GachaRarity, readonly ChefOpeningVariant[]> = {
  common: ['original'], rare: ['original'],
  epic: ['original', 'double-peek', 'ribbon-fan'],
  legendary: ['original', 'golden-fountain', 'royal-procession'],
}

export function chefOpeningPool(rarity: GachaRarity): readonly ChefOpeningVariant[] { return CHEF_POOLS[rarity] }

/** Cosmetic selection has its own random sample and never consumes the reward RNG. */
export function pickChefOpening(rarity: GachaRarity, sample: number, previous?: string): ChefOpeningVariant {
  const pool = chefOpeningPool(rarity)
  const choices = pool.length === 1 ? pool : pool.filter(id => id !== previous)
  return choices[Math.min(choices.length - 1, Math.floor(clampOpening(sample) * choices.length))]
}

export function chefLidPose(rarity: GachaRarity | null, open: number, wind: number, reduced: boolean, variant: ChefOpeningVariant = 'original') {
  const p = clampOpening(open), e = easeOpening(p)
  if (reduced) return { x: 0, y: -8 * e, angle: 0, alpha: 1 - e }
  const tier = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0
  let x: number, y: number, angle: number
  if (variant === 'double-peek') {
    const peek = (at: number, length: number) => Math.pow(Math.sin(Math.PI * clampOpening((p - at) / length)), 2)
    const exit = easeOpening((p - .4) / .6)
    x = -180 * exit
    y = -10 * peek(0, .18) - 19 * peek(.2, .18) - 145 * exit
    angle = .025 * peek(0, .18) - .04 * peek(.2, .18) - .15 * exit
  } else if (variant === 'ribbon-fan') {
    const exit = easeOpening((p - .5) / .5)
    x = -180 * exit; y = -72 * easeOpening(p / .5) - 65 * exit
    angle = .08 * Math.sin(p * Math.PI) - .18 * exit
  } else if (variant === 'golden-fountain') {
    const rise = easeOpening((p - .42) / .58), exit = easeOpening((p - .65) / .35)
    x = 168 * exit; y = -25 * easeOpening(p / .2) - 160 * rise
    angle = .13 * exit
  } else if (variant === 'royal-procession') {
    const exit = easeOpening((p - .76) / .24)
    x = -175 * exit
    y = -18 * easeOpening(p / .25) - 146 * easeOpening((p - .38) / .42)
    angle = -.14 * exit
  } else {
    // Keep the approved rarity-specific classic paths exactly as they were.
    const sweep = tier === 3 ? easeOpening((p - .38) / .62) : e
    const lift = tier === 3 ? easeOpening(p / .65) : e
    x = (tier === 0 ? 120 : 190) * sweep; y = (tier === 3 ? -165 : -125) * lift
    angle = tier === 2 ? Math.sin(p * Math.PI) * -.22 + e * .16 : tier === 3 ? .07 * sweep : .12 * e
  }
  y += Math.sin(wind * Math.PI * (4 + tier * 2)) * (1 + tier * .6) * (1 - e)
  return { x, y, angle, alpha: 1 }
}

/** All times are relative to mount; a slow roll never opens an empty container. */
export function treatOpeningFrame(
  kind: TreatOpeningKind, elapsed: number, readyAt: number | null,
  rarity: GachaRarity | null, reduced: boolean, variant: ChefOpeningVariant = 'original',
) {
  const tier = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0
  const style = kind === 'chef' && rarity && chefOpeningPool(rarity).includes(variant) ? CHEF_OPENINGS[variant] : CHEF_OPENINGS.original
  const arrivalMs = reduced ? 120 : kind === 'parcel' ? 700 : 760
  const anticipationMs = reduced ? 80 : [280, 360, 500, 660][tier] + style.anticipation
  const openMs = reduced ? 150 : [640, 760, 900, 1060][tier] + style.open
  const holdMs = reduced ? 120 : [160, 220, 300, 400][tier] + style.hold
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
    release: clampOpening((elapsed - openAt - openMs * style.releaseAt) / (openMs * (1 - style.releaseAt))),
    releaseMs: Math.max(0, elapsed - openAt - openMs * style.releaseAt),
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
