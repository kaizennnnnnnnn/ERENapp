'use client'

// The flask on Eren's bench — pixel art, not vector.
//
// It used to be a smooth SVG outline with a translucent white wash, which on
// the dark palette read as a grey blob sitting in the middle of the screen. Now
// it's drawn on a 22-wide pixel grid like everything else in this app: one cell
// of ink for the glass, hard steps down the shoulders, and a liquid line that
// snaps to whole rows as slots fill instead of sliding smoothly. A 1px outline
// at ~6x scale is exactly the chunky edge the rest of the UI has.
//
// The silhouette is generated from a per-row edge table rather than a hand-typed
// character grid — 21 rows of 22 characters is a thing you get wrong once and
// then can't find.

import { useMemo } from 'react'

interface Props {
  /** 0–1. Snaps to whole pixel rows. */
  fill: number
  deep: string
  light: string
  ink: string
  /** Empty-glass tint, behind the liquid. */
  glass?: string
  /** Everything's in — glow and fizz harder. */
  done?: boolean
  /** Wrong ingredient just went in — puff of soot over the mouth. */
  soot?: boolean
  /** Cell size in CSS px. The flask is 22 cells wide. */
  cell?: number
}

// Ink column on each side, row by row: lip, neck, then the body opening out.
const EDGES: [number, number][] = [
  [6, 15], [6, 15],                                   // lip
  [8, 13], [8, 13], [8, 13], [8, 13],                 // neck
  [7, 14], [7, 14],
  [6, 15], [6, 15],
  [5, 16], [5, 16],
  [4, 17], [4, 17],
  [3, 18], [3, 18],
  [2, 19], [2, 19],
  [1, 20], [1, 20],
  [1, 20],                                            // floor, solid
]

const GRID_W = 22
const GRID_H = EDGES.length
const FLOOR_ROW = GRID_H - 1
/** Liquid never climbs past the shoulders — a full flask stops here. */
const BRIM_ROW = 7

/** Glass highlight, two cells down the upper-left of the body. */
const SHINE: [number, number][] = [[8, 8], [7, 9], [7, 10]]

// Bubble columns and their timing. Each rises from the floor to the surface.
const BUBBLES = [
  { col: 8,  delay: '0s',    dur: '2.0s' },
  { col: 11, delay: '0.5s',  dur: '2.4s' },
  { col: 14, delay: '1.1s',  dur: '1.7s' },
  { col: 10, delay: '1.6s',  dur: '2.2s' },
]

const SOOT = [
  { col: 7,  row: -3, size: 2, delay: '0s' },
  { col: 10, row: -4, size: 2, delay: '0.06s' },
  { col: 13, row: -3, size: 2, delay: '0.12s' },
]

type Cell = { x: number; y: number; fill: string }

export default function BrewFlask({
  fill, deep, light, ink, glass = 'rgba(255,255,255,0.10)', done, soot, cell = 6,
}: Props) {
  // Liquid surface, snapped to a whole row. `fill` 0 sits on the floor.
  const clamped = Math.max(0, Math.min(1, fill))
  const level = FLOOR_ROW - Math.round((FLOOR_ROW - BRIM_ROW) * clamped)

  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = []
    const shine = new Set(SHINE.map(([x, y]) => `${x},${y}`))

    for (let y = 0; y < GRID_H; y++) {
      const [l, r] = EDGES[y]
      const [pl, pr] = y > 0 ? EDGES[y - 1] : EDGES[0]
      const inks = new Set<number>([l, r])
      // Where the wall steps INWARD, the row above would spill out sideways —
      // cap the gap with ink so the lip actually closes onto the neck.
      if (pl < l) for (let x = pl; x <= l; x++) inks.add(x)
      if (pr > r) for (let x = r; x <= pr; x++) inks.add(x)

      if (y === FLOOR_ROW) {
        for (let x = l; x <= r; x++) out.push({ x, y, fill: ink })
        continue
      }
      for (let x = l; x <= r; x++) {
        if (inks.has(x)) { out.push({ x, y, fill: ink }); continue }
        const wet = y >= level
        const isSurface = wet && y === level
        out.push({
          x, y,
          fill: wet ? (isSurface ? light : deep)
            : shine.has(`${x},${y}`) ? 'rgba(255,255,255,0.55)'
            : glass,
        })
      }
    }
    return out
  }, [level, deep, light, ink, glass])

  const w = GRID_W * cell
  const h = GRID_H * cell

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${GRID_W} ${GRID_H}`}
      shapeRendering="crispEdges"
      style={{
        overflow: 'visible',
        imageRendering: 'pixelated',
        filter: done ? `drop-shadow(0 0 ${cell}px ${light})` : undefined,
        transition: 'filter 320ms steps(4)',
      }}
      aria-hidden
    >
      {cells.map(c => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.fill} />
      ))}

      {/* Bubbles climb from the floor to the current surface. Whole cells, so
          they read as pixels rather than dots. */}
      {clamped > 0 && BUBBLES.map((b, i) => (
        <rect
          key={`b${i}`}
          x={b.col} y={FLOOR_ROW - 2} width={1} height={1}
          fill={light} fillOpacity="0.95"
          style={{
            animation: `brewBubble ${done ? '1.1s' : b.dur} steps(6) ${b.delay} infinite`,
            ['--brew-rise' as string]: `${-(FLOOR_ROW - level - 2)}px`,
          }}
        />
      ))}

      {/* Two sparks over a finished brew. */}
      {done && [[5, 4], [17, 6]].map(([x, y], i) => (
        <rect
          key={`s${i}`} x={x} y={y} width={1} height={1} fill={light}
          style={{ animation: `brewSpark 1.4s steps(3) ${i * 0.45}s infinite` }}
        />
      ))}

      {soot && SOOT.map((s, i) => (
        <rect
          key={`k${i}`}
          x={s.col} y={s.row} width={s.size} height={s.size}
          fill="#6B7280" fillOpacity="0.9"
          style={{ animation: `brewSoot 620ms steps(5) ${s.delay} both` }}
        />
      ))}
    </svg>
  )
}
