'use client'

// The four warmer pans on the left wall. Each pan is filled with its own
// seamless texture clipped to the pan's quad; every scoop taken drops the
// level by a fifth, so the pan empties from the top the way a real one does.

import { TOPPINGS, MAX_USES, type ToppingId } from './kioskShift'

interface Props {
  stock: Record<ToppingId, number>
  onTap: (id: ToppingId) => void
}

/** Quad → the CSS box that contains it, plus a clip-path for the food inside
 *  it at the current level. Points are % of the picture; the polygon is % of
 *  the box, which is what clip-path wants. */
function fillGeometry(well: [number, number][], left: number) {
  const xs = well.map(p => p[0])
  const ys = well.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  const w = x1 - x0, h = y1 - y0

  const [tl, tr, br, bl] = well
  // Sink the top edge toward the floor of the pan as it's used up.
  const k = 1 - left / MAX_USES
  const lerp = (a: [number, number], b: [number, number]): [number, number] =>
    [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  const pts: [number, number][] = [lerp(tl, bl), lerp(tr, br), br, bl]

  const rel = pts.map(([x, y]) => `${((x - x0) / w * 100).toFixed(2)}% ${((y - y0) / h * 100).toFixed(2)}%`)
  return {
    box: { left: `${x0}%`, top: `${y0}%`, width: `${w}%`, height: `${h}%` },
    clip: `polygon(${rel.join(', ')})`,
  }
}

export default function ToppingTrays({ stock, onTap }: Props) {
  return (
    <>
      {TOPPINGS.map(t => {
        const left = stock[t.id]
        const { box, clip } = fillGeometry(t.well, left)
        return (
          <div key={t.id}>
            {left > 0 && (
              <div aria-hidden style={{
                position: 'absolute', ...box,
                backgroundImage: `url(${t.fill})`,
                backgroundSize: 'cover',
                backgroundPosition: 'bottom center',
                clipPath: clip,
                // Sit the food in the kiosk's own light rather than letting it
                // glow brighter than the room it's standing in.
                filter: 'brightness(0.88) saturate(0.95)',
                pointerEvents: 'none',
                transition: 'clip-path 220ms cubic-bezier(0.32, 0.72, 0, 1)',
              }} />
            )}

            <button
              type="button"
              aria-label={`Add ${t.label}`}
              onClick={() => onTap(t.id)}
              className="active:scale-95 transition-transform"
              style={{
                position: 'absolute', ...box,
                background: 'none', border: 0, padding: 0,
                // A hairline of pan-light so an empty well still reads as a
                // target you can aim at in a dark room.
                boxShadow: left > 0 ? 'none' : 'inset 0 0 0 2px rgba(245,156,69,0.28)',
                borderRadius: 4,
              }}
            />
          </div>
        )
      })}
    </>
  )
}
