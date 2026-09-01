'use client'

// ═══════════════════════════════════════════════════════════════════════════
// TROPHY SHELF — the boards inside the case, and the cups standing on them.
//
// Drawn in code rather than shipped as art because it is not static: it shows
// the trophies you have actually won, so it has to be built from data.
//
// This file used to hold four other pieces — a neon sign, string lights, a
// rosette, bunting — for a shelf of room decor that has been removed. Hanging
// a bought prop on a painted wall never looked like anything but a sticker
// on somebody else's picture. What replaced it is components/weather, which
// changes what is OUTSIDE the window the artist already drew.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import type { TrophyTier } from '@/lib/dailyTwist'
import { CupGroup } from './TrophyCup'

export interface TrophyCounts {
  bronze: number
  silver: number
  gold: number
}

const SHELF_CAPACITY = 7
const CUP_W = 11.4
const PITCH = 12.6

export default memo(function TrophyShelf({ style, counts }: { style?: React.CSSProperties; counts?: TrophyCounts }) {
  const c = counts ?? { bronze: 0, silver: 0, gold: 0 }
  const line: TrophyTier[] = [
    ...Array(Math.min(c.gold, SHELF_CAPACITY)).fill('gold' as const),
    ...Array(Math.min(c.silver, SHELF_CAPACITY)).fill('silver' as const),
    ...Array(Math.min(c.bronze, SHELF_CAPACITY)).fill('bronze' as const),
  ].slice(0, SHELF_CAPACITY * 2)

  // The case grows a second board only once the first one is full. Two boards
  // from day one left the bottom half of the cabinet permanently empty, which
  // read as broken rather than as room to grow.
  const rows = line.length > SHELF_CAPACITY ? 2 : 1
  const boards = rows === 2 ? [27, 57] : [30]
  const H = rows === 2 ? 63 : 36

  return (
    <div style={{ ...style, position: 'relative' }}>
      <svg viewBox={`0 0 100 ${H}`} width="100%" shapeRendering="crispEdges" style={{ display: 'block' }}>
        {/* carcass */}
        <rect x="0" y="0" width="100" height={H} fill="#1B1008" />
        <rect x="2" y="1" width="96" height={H - 2} fill="#3B2413" />
        <rect x="4" y="3" width="92" height={H - 6} fill="#24160B" />
        {/* grain */}
        {[8, 17, 35, 44, 62].filter(y => y < H - 4).map(y => (
          <rect key={y} x="4" y={y} width="92" height="1" fill="#2E1C0E" />
        ))}
        {/* side posts, so it reads as a case and not a plank */}
        <rect x="2" y="1" width="3" height={H - 2} fill="#4A2D17" />
        <rect x="95" y="1" width="3" height={H - 2} fill="#160D06" />
        <rect x="2" y="1" width="96" height="2" fill="#5C3A1E" />

        {boards.map((y, row) => {
          const items = line.slice(row * SHELF_CAPACITY, (row + 1) * SHELF_CAPACITY)
          // Centred on the board rather than packed left, so four cups look
          // displayed and not abandoned.
          const span = items.length ? items.length * PITCH - (PITCH - CUP_W) : 0
          const x0 = (100 - span) / 2
          return (
            <g key={y}>
              {items.map((tier, i) => (
                <CupGroup key={i} tier={tier}
                  x={x0 + i * PITCH} y={y - CUP_W * 27 / 26} w={CUP_W} />
              ))}
              <rect x="5" y={y} width="90" height="1" fill="#C08B54" />
              <rect x="5" y={y + 1} width="90" height="3" fill="#8B5A2B" />
              <rect x="5" y={y + 4} width="90" height="2" fill="#160D06" />
            </g>
          )
        })}
      </svg>
    </div>
  )
})

