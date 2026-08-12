// ─── Seeded RNG ──────────────────────────────────────────────────────────────
// Deterministic randomness from a string seed. Both people in the household run
// these on their own device and have to land on the same answer, so nothing in
// here may touch Math.random or the clock — the seed is the whole input.
//
// Used by Eren's daily persona (lib/erenPersona) and the bakery's daily donut
// batch (lib/donuts). Same day in → same result out, on both phones, all day.

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T,>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)]

export function shuffled<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * A stable per-day seed in the viewer's own timezone.
 *
 * Deliberately NOT `toISOString().slice(0,10)`: that's UTC, so a household two
 * hours ahead would flip the day mid-evening and see tomorrow's batch while it's
 * still today for them.
 */
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
