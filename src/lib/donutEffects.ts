// ═══════════════════════════════════════════════════════════════════════════
// DONUT EFFECTS — the part of a donut you can SEE.
// ──────────────────────────────────────────────────────────────────────────
// Every donut already had a perk, and every perk already worked: feedWithFood
// applies happiness, hunger, sleep, cleanliness, weight and cure, and FeedScene
// pays out the coin ones. But all twenty-seven of them were NUMBERS. You fed
// him a Neon Slime donut described as "It glows. Probably fine." and a bar
// moved. Nothing about him looked any different.
//
// So this is the other half: a handful of donuts now leave a mark on Eren for a
// while. It's stored on the HOUSEHOLD row rather than per user, so if she feeds
// him the neon one and you open the app ten minutes later, you find your cat
// glowing and have to ask what she did.
//
// Deliberately only on the four donuts that have earned it — the three gacha
// exclusives and Gold Leaf. An effect on all twenty-seven would be wallpaper.
// ═══════════════════════════════════════════════════════════════════════════

export type DonutEffectId = 'glow' | 'gilded' | 'confetti' | 'zoomies'

export interface DonutEffectDef {
  id: DonutEffectId
  /** Shouted on the feeding toast. */
  label: string
  /** One line, for the shop card and the bakery case. */
  blurb: string
  /** Drives the aura, the particles and the glow. */
  tone: string
  ms: number
}

const MIN = 60_000

export const DONUT_EFFECTS: Record<DonutEffectId, DonutEffectDef> = {
  glow: {
    id: 'glow', label: 'HE IS GLOWING', blurb: 'He glows for 10 minutes',
    tone: '#5BE81E', ms: 10 * MIN,
  },
  gilded: {
    id: 'gilded', label: 'GILDED', blurb: 'Gold sparks for 10 minutes',
    tone: '#FBBF24', ms: 10 * MIN,
  },
  confetti: {
    id: 'confetti', label: 'PIXEL PARTY', blurb: 'Confetti for 10 minutes',
    tone: '#E31E5A', ms: 10 * MIN,
  },
  zoomies: {
    id: 'zoomies', label: 'ZOOMIES', blurb: 'The zoomies, for 8 minutes',
    tone: '#E8891E', ms: 8 * MIN,
  },
}

/** What's stored on the household row. */
export interface ActiveDonutEffect {
  id: string
  /** ISO. Past = nothing is running. */
  until: string
}

/**
 * The effect that is running RIGHT NOW, or null.
 *
 * Everything reads through this rather than trusting the column, because the
 * column is only ever written — nothing clears it when it lapses. An unknown
 * id (a row written by a newer build) reads as nothing rather than throwing.
 */
export function liveDonutEffect(
  active: ActiveDonutEffect | null | undefined,
  now = Date.now(),
): DonutEffectDef | null {
  if (!active?.id || !active.until) return null
  const def = DONUT_EFFECTS[active.id as DonutEffectId]
  if (!def) return null
  const until = new Date(active.until).getTime()
  if (!Number.isFinite(until) || until <= now) return null
  return def
}

/** Milliseconds left, 0 when nothing is running. */
export function effectRemaining(
  active: ActiveDonutEffect | null | undefined,
  now = Date.now(),
): number {
  if (!liveDonutEffect(active, now)) return 0
  return Math.max(0, new Date(active!.until).getTime() - now)
}
