// ═══════════════════════════════════════════════════════════════════════════
// PIXEL GRID — the renderer behind every non-12x12 pixel drawing.
//
// PixelIcons owns the 12x12 chrome icons and draws them itself. Anything
// bigger or non-square (accessories, trophy-shop powers, title plates) is a
// ragged grid of characters plus a small palette, and they all wanted the same
// twenty lines of "turn a grid into rects". This is that, once.
//
// Rows may be ragged; the viewBox takes the widest.
// ═══════════════════════════════════════════════════════════════════════════

export interface PixelArt {
  grid: string[]
  palette: Record<string, string>
}

/** Grid aspect (height / width) — how tall a piece is for a given width. */
export function gridAspect(grid: string[]): number {
  return grid.length / Math.max(...grid.map(r => r.length))
}

/**
 * The grid as bare `<rect>`s, for a caller that already owns an `<svg>` and
 * wants to compose (an accessory sitting on a head, a shelf of trophies).
 * Runs of the same character merge into one rect, which roughly halves the
 * node count on the wide flat pieces (shields, plinths, banners).
 */
export function pixelRects(
  { grid, palette }: PixelArt, keyPrefix = '',
): React.ReactElement[] {
  const rects: React.ReactElement[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      const color = palette[ch]
      if (!color) { x++; continue }
      let w = 1
      while (x + w < row.length && row[x + w] === ch) w++
      rects.push(
        <rect key={`${keyPrefix}${x}-${y}`} x={x} y={y}
          width={w + 0.02} height={1.02} fill={color} />,
      )
      x += w
    }
  })
  return rects
}

/** Fills its box. */
export function PixelGrid({ grid, palette, style }: PixelArt & {
  style?: React.CSSProperties
}) {
  const cols = Math.max(...grid.map(r => r.length))
  const rects = pixelRects({ grid, palette })
  return (
    <svg
      viewBox={`0 0 ${cols} ${grid.length}`}
      width="100%" height="100%"
      shapeRendering="crispEdges"
      style={{ display: 'block', overflow: 'visible', ...style }}
      aria-hidden
    >
      {rects}
    </svg>
  )
}
