// ═══════════════════════════════════════════════════════════════════════════
// LANE RUNNER — spawn patterns.
//
// The spawner used to drop one random item into one random lane every N
// milliseconds. That is the cheapest possible level design: it produces no
// rhythm, no build-up, nothing to read ahead, and no moment you could describe
// to someone afterwards. Every run felt the same because statistically it was.
//
// A pattern is a small authored shape — a gate, a slalom, a run of coins
// threaded between two hazards. The spawner picks one, drops the whole shape
// at once, and waits for it to finish entering before choosing the next. That
// gives the road phrasing: a hard bit, a breather, a greedy bit.
//
// SAFETY INVARIANT, and the whole reason this file is data rather than random
// rolls: within any single row, at most two of the three lanes may hold a
// hazard, and consecutive hazard rows must share a free lane so the player can
// always walk a legal path through. Patterns are authored to satisfy this;
// `isPatternSafe` proves it, and a dev-time assertion runs over the library.
// ═══════════════════════════════════════════════════════════════════════════

import type { Hazard, Variant } from '@/components/games/LaneRunnerWorld'

export type Lane = 0 | 1 | 2
const LANES: Lane[] = [0, 1, 2]

export interface Placement {
  lane: Lane
  variant: Variant
  /** Distance above the pattern origin. 0 enters first. */
  dy: number
  /** Only for a roomba: which way it slides as it comes down. Set here rather
   *  than rolled at spawn time so a pattern can point it at something. */
  drift?: -1 | 1
}

export interface Pattern {
  name: string
  /** 0..1 run difficulty at which this becomes eligible. */
  from: number
  /** Relative pick weight once eligible. */
  weight: number
  build: (rng: () => number, hazard: () => Hazard) => Placement[]
}

/** Vertical gap between successive hazard rows. One row gap buys the player
 *  exactly ONE lane change — see `isPatternSafe`. */
export const ROW = 190
/** Coins sit much closer together — they are a trail to follow, not a wall. */
const COIN = 54

const pick = <T,>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]
const other = (rng: () => number, exclude: Lane[]): Lane =>
  pick(rng, LANES.filter(l => !exclude.includes(l)))
/** A lane exactly one step away. Gate openings shift by one, never two: with
 *  three lanes a two-step shift would demand two taps inside a single row gap,
 *  which at high speed is a death you cannot see coming. */
const adjacentTo = (rng: () => number, l: Lane): Lane =>
  l === 0 ? 1 : l === 2 ? 1 : (rng() < 0.5 ? 0 : 2)

export const PATTERNS: Pattern[] = [
  {
    name: 'single',
    from: 0,
    weight: 26,
    build: (rng, hazard) => [{ lane: pick(rng, LANES), variant: hazard(), dy: 0 }],
  },
  {
    name: 'coinRun',
    from: 0,
    weight: 20,
    build: rng => {
      const lane = pick(rng, LANES)
      return Array.from({ length: 5 }, (_, i) => ({ lane, variant: 'coin' as Variant, dy: i * COIN }))
    },
  },
  {
    name: 'coinArc',
    from: 0,
    weight: 14,
    build: rng => {
      // Sweeps across the lanes, so collecting it is a deliberate weave rather
      // than holding one lane.
      const start = pick(rng, LANES)
      const dir = start === 0 ? 1 : start === 2 ? -1 : (rng() < 0.5 ? 1 : -1)
      const lanes: Lane[] = [start, (start + dir) as Lane, (start + dir) as Lane, start]
      return lanes.map((lane, i) => ({ lane, variant: 'coin' as Variant, dy: i * COIN }))
    },
  },
  {
    name: 'preyRun',
    from: 0.05,
    weight: 10,
    build: rng => {
      const lane = pick(rng, LANES)
      return [
        { lane, variant: 'mouse', dy: 0 },
        { lane, variant: 'mouse', dy: COIN * 1.4 },
        { lane, variant: 'mouse', dy: COIN * 2.8 },
      ]
    },
  },
  {
    name: 'gate',
    from: 0.12,
    weight: 22,
    build: (rng, hazard) => {
      // Two hazards, one gap. The gap is the whole idea, so it must be obvious.
      const free = pick(rng, LANES)
      return LANES.filter(l => l !== free).map(lane => ({ lane, variant: hazard(), dy: 0 }))
    },
  },
  {
    name: 'treatGate',
    from: 0.18,
    weight: 16,
    build: (rng, hazard) => {
      // Same as a gate, but the safe lane pays. Threading it correctly should
      // feel rewarded, not merely survived.
      const free = pick(rng, LANES)
      return [
        ...LANES.filter(l => l !== free).map(lane => ({ lane, variant: hazard(), dy: 0 })),
        { lane: free, variant: 'fish' as Variant, dy: 26 },
      ]
    },
  },
  {
    name: 'slalom',
    from: 0.3,
    weight: 18,
    build: (rng, hazard) => {
      const a = pick(rng, LANES)
      const b = other(rng, [a])
      const c = other(rng, [b])
      return [
        { lane: a, variant: hazard(), dy: 0 },
        { lane: b, variant: hazard(), dy: ROW },
        { lane: c, variant: hazard(), dy: ROW * 2 },
      ]
    },
  },
  {
    name: 'baitedGate',
    from: 0.34,
    weight: 12,
    build: (rng, hazard) => {
      // Coins lead into a lane that is about to close. You get paid for
      // reading ahead rather than for chasing the trail blindly.
      const trap = pick(rng, LANES)
      const free = other(rng, [trap])
      return [
        { lane: trap, variant: 'coin', dy: 0 },
        { lane: trap, variant: 'coin', dy: COIN },
        { lane: trap, variant: 'coin', dy: COIN * 2 },
        ...LANES.filter(l => l !== free).map(lane => ({ lane, variant: hazard(), dy: COIN * 2 + ROW })),
      ]
    },
  },
  {
    name: 'doubleGate',
    from: 0.5,
    weight: 14,
    build: (rng, hazard) => {
      // The second gate never reuses the first one's opening, so it is always
      // a real lane change and never a hold-still — but it shifts by exactly
      // one lane, so it is always ONE tap.
      const free1 = pick(rng, LANES)
      const free2 = adjacentTo(rng, free1)
      return [
        ...LANES.filter(l => l !== free1).map(lane => ({ lane, variant: hazard(), dy: 0 })),
        ...LANES.filter(l => l !== free2).map(lane => ({ lane, variant: hazard(), dy: ROW })),
      ]
    },
  },
  {
    name: 'threadTheNeedle',
    from: 0.62,
    weight: 10,
    build: (rng, hazard) => {
      // Hardest shape in the library: three gates in a row, each opening
      // shifted, with the payout sitting in the last one.
      const f1 = pick(rng, LANES)
      const f2 = adjacentTo(rng, f1)
      const f3 = adjacentTo(rng, f2)
      return [
        ...LANES.filter(l => l !== f1).map(lane => ({ lane, variant: hazard(), dy: 0 })),
        ...LANES.filter(l => l !== f2).map(lane => ({ lane, variant: hazard(), dy: ROW })),
        ...LANES.filter(l => l !== f3).map(lane => ({ lane, variant: hazard(), dy: ROW * 2 })),
        { lane: f3, variant: 'fish' as Variant, dy: ROW * 2 + 30 },
      ]
    },
  },

  // ── The two that move ──────────────────────────────────────────────────────
  // Every shape above is a static wall: you read the gap and take it. These
  // two ask a different question. The roomba's lane is a moving target, so you
  // have to read a trajectory; the crow's lane is YOUR lane, so you have to
  // bait it and step off late. Both are authored solo — one hazard, two clear
  // lanes — because neither can be proved safe by `isPatternSafe`, which
  // reasons about hazards that stay where they are put.

  {
    name: 'roombaSweep',
    from: 0.12,
    weight: 14,
    build: rng => {
      // Always starts on an edge and sweeps inward, so the drift is never a
      // guess about which way it will bounce.
      const lane: Lane = rng() < 0.5 ? 0 : 2
      return [{ lane, variant: 'roomba' as Variant, dy: 0, drift: lane === 0 ? 1 : -1 }]
    },
  },
  {
    name: 'roombaLure',
    from: 0.34,
    weight: 11,
    build: rng => {
      // Coins laid in the lane it is sliding INTO. Greed says hold the lane;
      // the arrow says you have about a second. That tension is the point.
      const lane: Lane = rng() < 0.5 ? 0 : 2
      const drift: -1 | 1 = lane === 0 ? 1 : -1
      const into = (lane + drift) as Lane
      return [
        { lane, variant: 'roomba' as Variant, dy: 0, drift },
        ...Array.from({ length: 4 }, (_, i) => ({
          lane: into, variant: 'coin' as Variant, dy: 40 + i * COIN,
        })),
      ]
    },
  },
  {
    name: 'crowDive',
    from: 0.3,
    weight: 12,
    build: rng => [{ lane: pick(rng, LANES), variant: 'crow' as Variant, dy: 0 }],
  },
  {
    name: 'crowBait',
    from: 0.55,
    weight: 9,
    build: rng => {
      // The fish is the bait: stand still long enough to take it and the crow
      // has already committed to that lane.
      const lane = pick(rng, LANES)
      return [
        { lane: other(rng, [lane]), variant: 'crow' as Variant, dy: 0 },
        { lane, variant: 'fish' as Variant, dy: 70 },
      ]
    },
  },
]

/** How far below the origin the pattern's last item sits — the spawner holds
 *  off until the whole shape has entered the field. */
export function patternSpan(items: Placement[]): number {
  return items.reduce((m, p) => Math.max(m, p.dy), 0)
}

/** Proves the safety invariant for a built pattern: every hazard row leaves at
 *  least one lane open, and adjacent hazard rows share an open lane so a legal
 *  path exists through the whole shape. */
export function isPatternSafe(items: Placement[], isHazard: (v: Variant) => boolean): boolean {
  const rows = new Map<number, Set<Lane>>()
  for (const p of items) {
    if (!isHazard(p.variant)) continue
    const row = rows.get(p.dy) ?? new Set<Lane>()
    row.add(p.lane)
    rows.set(p.dy, row)
  }
  const ordered = Array.from(rows.entries()).sort((a, b) => a[0] - b[0])

  // Walk the rows carrying the set of lanes the player could legally occupy.
  // Budget is distance-aware: rows stacked at the same dy allow no movement at
  // all, and each ROW of separation buys exactly one lane change. Anything
  // that empties the set is a shape with no path through it.
  let reachable: Lane[] = [...LANES]
  let prevDy: number | null = null
  for (const [dy, blocked] of ordered) {
    const steps = prevDy === null ? LANES.length : Math.floor((dy - prevDy) / ROW)
    if (steps > 0) {
      const spread = new Set<Lane>()
      for (const l of reachable) {
        for (const c of LANES) if (Math.abs(c - l) <= steps) spread.add(c)
      }
      reachable = Array.from(spread)
    }
    reachable = reachable.filter(l => !blocked.has(l))
    if (reachable.length === 0) return false
    prevDy = dy
  }
  return true
}

export function eligiblePatterns(difficulty: number): Pattern[] {
  return PATTERNS.filter(p => difficulty >= p.from)
}

export function choosePattern(rng: () => number, difficulty: number): Pattern {
  const pool = eligiblePatterns(difficulty)
  const total = pool.reduce((s, p) => s + p.weight, 0)
  let r = rng() * total
  for (const p of pool) {
    r -= p.weight
    if (r <= 0) return p
  }
  return pool[pool.length - 1]
}
