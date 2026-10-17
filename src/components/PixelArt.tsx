import { memo, type CSSProperties } from 'react'

// ─── Pix ─────────────────────────────────────────────────────────────────────
// Pixel art of any size from a grid of letters and a palette: one <rect> per
// horizontal run of a colour, like MeadowIcon, '.' for transparent. The width
// is `size`; the height follows the grid's own proportions.

export type Pal = Record<string, string>

export const Pix = memo(function Pix({ grid, pal, size, style }: { grid: string[]; pal: Pal; size: number; style?: CSSProperties }) {
  const w = grid[0].length
  const h = grid.length
  const rects: JSX.Element[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let e = x + 1
      while (e < row.length && row[e] === ch) e++
      if (pal[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={e - x} height={1} fill={pal[ch]} />)
      x = e
    }
  })
  return (
    <svg aria-hidden width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges"
      style={{ display: 'block', overflow: 'visible', ...style }}>
      {rects}
    </svg>
  )
})
