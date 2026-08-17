'use client'

// The four warmer pans on the left wall. Each pan is filled with its own
// seamless texture clipped to the pan's real outline; every scoop taken drops
// the level by a fifth, so the pan empties from the top the way a real one
// does and the leaning steel walls trim the surface as it falls.

import { TOPPINGS, panFill, type ToppingId } from './kioskShift'

interface Props {
  stock: Record<ToppingId, number>
  onTap: (id: ToppingId) => void
}

export default function ToppingTrays({ stock, onTap }: Props) {
  return (
    <>
      {TOPPINGS.map(t => {
        const left = stock[t.id]
        const { box, clip } = panFill(t.well, left)
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
