// ─── sliceCut ───────────────────────────────────────────────────────────────
// Where a jelly actually came apart.
//
// The first build split every jelly down the vertical middle — two halves
// clipped at 50% and pushed left and right — whatever angle you swung at. A
// diagonal flick produced a straight vertical cut, which is the single most
// obvious "the game isn't watching me" tell in a slicing game.
//
// A cut is now the real blade line, stored in the SPRITE's own coordinates:
//
//   n·q = c        q in the unit box (0..1 across the flyer), n a unit normal
//
// Sprite coordinates, not screen coordinates, because a flyer spins: the cut
// has to be baked into the jelly and turn with it, exactly as a real cut would.
// So the blade's normal is rotated by −spin when it is recorded, and from then
// on the clip needs no further maths.

export interface CutLine {
  /** Unit normal of the cut, in the sprite's own (rotated) frame. */
  nx: number
  ny: number
  /** Offset: the line is { q : nx·qx + ny·qy = c }, q in 0..1 box units. */
  c: number
}

/**
 * Record the blade segment A→B as a cut line on a flyer.
 *
 * `cx, cy` is the flyer's centre and `r` its radius, both in field pixels;
 * `spinDeg` is the rotation the sprite is currently drawn with.
 */
export function cutLineFor(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, r: number, spinDeg: number,
): CutLine {
  const dx = bx - ax, dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  // Normal of the blade, in field space.
  const nx = -dy / len, ny = dx / len
  // Signed distance from the jelly's centre to the blade line, along that
  // normal. This is the whole geometry of the cut: how far off-centre it fell.
  const dist = nx * cx + ny * cy - (nx * ax + ny * ay)

  // Undo the sprite's rotation so the line is stored in its own frame.
  const t = (-spinDeg * Math.PI) / 180
  const cos = Math.cos(t), sin = Math.sin(t)
  const lx = nx * cos - ny * sin
  const ly = nx * sin + ny * cos

  return { nx: lx, ny: ly, c: 0.5 * (lx + ly) - dist / (2 * r) }
}

/**
 * The half of the sprite box on one side of the cut, as a CSS polygon().
 *
 * Sutherland–Hodgman: walk the box's four edges, keep the corners on the wanted
 * side, and insert the point where the line crosses each edge it crosses. Two
 * calls with `positive` flipped give the two halves, and together they tile the
 * box exactly — no seam, no overlap, at any angle.
 *
 * Returns null when the line misses the box, so the caller can fall back to the
 * whole sprite rather than emit a degenerate polygon.
 */
export function halfPolygon(cut: CutLine, positive: boolean): string | null {
  const corners: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const sign = positive ? 1 : -1
  const side = (p: [number, number]) => sign * (cut.nx * p[0] + cut.ny * p[1] - cut.c)

  const out: [number, number][] = []
  for (let i = 0; i < 4; i++) {
    const cur = corners[i], next = corners[(i + 1) % 4]
    const dCur = side(cur), dNext = side(next)
    if (dCur >= 0) out.push(cur)
    if ((dCur >= 0) !== (dNext >= 0)) {
      const t = dCur / (dCur - dNext)
      out.push([cur[0] + (next[0] - cur[0]) * t, cur[1] + (next[1] - cur[1]) * t])
    }
  }
  if (out.length < 3) return null
  return `polygon(${out.map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`).join(', ')})`
}
