'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE TROPHY — the actual object a won day pays out.
//
// The first cut reused the 12x12 chrome icon at 78px on the verdict screen,
// which is why it read as a yellow lump: a silhouette drawn for 14px has no
// handles, no stem and no plinth to lose, so blowing it up only makes the
// missing detail obvious. This is a 26x27 grid instead — still pixel art,
// still hard-edged, but with room for a rim lip, two curled handles, a knop,
// a flared foot and an engraved plinth.
//
// Same silhouette in all three metals ON PURPOSE. A shelf of them should read
// as one object repeated, with rank carried by colour, not by shape. Gold and
// silver get a specular sweep; gold alone twinkles. Bronze gets neither, so
// the top of the case is visibly the loudest thing in it.
//
// The grid is drawn once into a run-length silhouette (`SILHOUETTE`) so the
// shine mask costs ~40 rects instead of a second copy of all ~370.
// ═══════════════════════════════════════════════════════════════════════════

import { memo, useId } from 'react'
import type { TrophyTier } from '@/lib/dailyTwist'

export const CUP_W = 26
export const CUP_H = 27
export const CUP_ASPECT = CUP_H / CUP_W

// O outline · D shade · M body · H light · W specular
// B plinth · b plinth top · K plinth foot · E engraved plate
const GRID = [
  '...OOOOOOOOOOOOOOOOOOOO...',
  '...OHHHHHHHHHHHHHHHHHHO...',
  '.OOOHWWMMMMMMMMMMMMMDDOOO.',
  'OH.OHWHMMMMMMMMMMMMMDDO.DO',
  'OH..OHMMMMMMMMMMMMMDDO..DO',
  'OH..OHMMMMMMMMMMMMMDDO..DO',
  '.OH..OHMMMMMMMMMMMDDO..DO.',
  '..OOOOHMMMMMMMMMMMDDOOOO..',
  '......OHMMMMMMMMMDDO......',
  '.......OHMMMMMMMDDO.......',
  '........OHMMMMMDDO........',
  '........OOOOOOOOOO........',
  '..........OHMMDO..........',
  '...........OHDO...........',
  '...........OHDO...........',
  '...........OHDO...........',
  '..........OHMMDO..........',
  '.........OHMMMMDO.........',
  '.......OHHHHHHHHHDO.......',
  '.......OHMMMMMMMMDO.......',
  '.......OOOOOOOOOOOO.......',
  '.....OOOOOOOOOOOOOOOO.....',
  '.....ObbbbbbbbbbbbbbO.....',
  '.....OBBEEEEEEEEEEBBO.....',
  '.....OBBEEEEEEEEEEBBO.....',
  '.....OBBKBBBBBBBBKBBO.....',
  '.....OOOOOOOOOOOOOOOO.....',
]

type Metal = Record<string, string>

const PLINTH: Metal = { B: '#31200F', b: '#5C3A1E', K: '#170D05' }

export const CUP_METAL: Record<TrophyTier, Metal> = {
  gold: {
    O: '#6B4200', D: '#D19A0B', M: '#FFC81E', H: '#FFE573', W: '#FFFDEB',
    E: '#C08A18', ...PLINTH,
  },
  silver: {
    O: '#454D5C', D: '#96A0B2', M: '#D2D9E4', H: '#F2F5FA', W: '#FFFFFF',
    E: '#8E99A8', ...PLINTH,
  },
  bronze: {
    O: '#48260A', D: '#A85F22', M: '#DE8C3E', H: '#F5B678', W: '#FFE1BC',
    E: '#96551E', ...PLINTH,
  },
}

/** Horizontal runs of drawn cells — the silhouette, for masking the shine. */
const SILHOUETTE: { x: number; y: number; w: number }[] = (() => {
  const runs: { x: number; y: number; w: number }[] = []
  GRID.forEach((row, y) => {
    let start = -1
    for (let x = 0; x <= row.length; x++) {
      const on = x < row.length && row[x] !== '.'
      if (on && start < 0) start = x
      else if (!on && start >= 0) { runs.push({ x: start, y, w: x - start }); start = -1 }
    }
  })
  return runs
})()

/**
 * The cup as bare `<rect>`s, for a caller that already owns an `<svg>` — the
 * shelf draws seven of these inside one viewBox rather than nesting seven
 * SVGs.
 */
export function cupRects(tier: TrophyTier): React.ReactElement[] {
  const pal = CUP_METAL[tier]
  const out: React.ReactElement[] = []
  GRID.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let w = 1
      while (x + w < row.length && row[x + w] === ch) w++
      out.push(<rect key={`${x}-${y}`} x={x} y={y} width={w + 0.02} height={1.02} fill={pal[ch]} />)
      x += w
    }
  })
  return out
}

/** The cup positioned inside a caller's viewBox, scaled to `w` units wide. */
export function CupGroup({ tier, x, y, w }: {
  tier: TrophyTier; x: number; y: number; w: number
}) {
  const s = w / CUP_W
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{cupRects(tier)}</g>
}

interface Props {
  tier: TrophyTier
  /** Rendered height in px. Width follows the 26:27 grid. */
  size?: number
  /** Specular sweep. Defaults on for gold and silver above 26px. */
  shine?: boolean
  /** Twinkles around the rim. Defaults on for gold above 44px. */
  sparkle?: boolean
  /** Coloured bloom behind the cup. */
  glow?: boolean
}

export default memo(function TrophyCup({
  tier, size = 40, shine, sparkle, glow,
}: Props) {
  const uid = useId().replace(/[:]/g, '')
  const showShine = shine ?? (tier !== 'bronze' && size >= 26)
  const showSpark = sparkle ?? (tier === 'gold' && size >= 44)
  const pal = CUP_METAL[tier]

  return (
    <svg
      width={Math.round(size / CUP_ASPECT)}
      height={size}
      viewBox={`0 0 ${CUP_W} ${CUP_H}`}
      shapeRendering="crispEdges"
      style={{
        display: 'block',
        overflow: 'visible',
        filter: glow ? `drop-shadow(0 0 ${Math.round(size / 8)}px ${pal.M}66)` : undefined,
      }}
    >
      {cupRects(tier)}

      {showShine && (
        <>
          <mask id={`cs${uid}`}>
            {SILHOUETTE.map(r => (
              <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill="#fff" />
            ))}
          </mask>
          <g mask={`url(#cs${uid})`}>
            <rect
              className="tcSweep"
              x={-10} y={-4} width={5} height={CUP_H + 8}
              fill={pal.W} opacity={0.55}
              transform="skewX(-18)"
            />
          </g>
        </>
      )}

      {showSpark && [
        { x: 1.5, y: 3, d: 0 }, { x: 23, y: 1, d: 1.1 }, { x: 20, y: 9, d: 2.2 },
      ].map(s => (
        <g key={s.x} className="tcTwink" style={{ animationDelay: `${s.d}s` }}
          transform={`translate(${s.x} ${s.y})`}>
          <rect x={-0.5} y={-2} width={1} height={4} fill="#FFFDEB" />
          <rect x={-2} y={-0.5} width={4} height={1} fill="#FFFDEB" />
        </g>
      ))}

      <style>{`
        @keyframes tcSweepKf {
          0%, 62%  { transform: skewX(-18deg) translateX(0px); }
          92%,100% { transform: skewX(-18deg) translateX(46px); }
        }
        @keyframes tcTwinkKf {
          0%, 70%, 100% { opacity: 0; transform-box: fill-box; }
          82%           { opacity: 1; }
        }
        .tcSweep { animation: tcSweepKf 4.2s ease-in-out infinite; }
        .tcTwink { animation: tcTwinkKf 3.6s ease-in-out infinite; opacity: 0; }
        @media (prefers-reduced-motion: reduce) {
          .tcSweep, .tcTwink { animation: none; }
          .tcSweep { opacity: 0; }
        }
      `}</style>
    </svg>
  )
})
