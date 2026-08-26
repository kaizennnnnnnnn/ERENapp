'use client'

// The prep wall: four warmer pans on the shelf, the sauce bottles standing on
// the counter under them, and the chip warmer at the far end.
//
// Each pan is filled with its own seamless texture clipped to the pan's real
// outline; every scoop taken drops the level by a fifth, so the pan empties
// from the top the way a real one does and the leaning steel walls trim the
// surface as it falls.
//
// The bottles and the basket sit on the counter's own top surface (71.8% →
// 75.2% of the picture — a column scan, not a guess), so they stand on it
// instead of floating in front of it.

import {
  TOPPINGS, SAUCES, SAUCE_BOX, CHIPS_BOX, SIDE_BY_ID, panFill,
  type MenuState, type SauceId, type SideId, type ToppingId,
} from './kioskShift'

interface Props {
  stock: Record<ToppingId, number>
  /** What's on the menu tonight — a bottle you haven't unlocked isn't on the
   *  counter at all. */
  menu: MenuState
  /** The sauce already on the wrap in your hands. */
  sauce: SauceId | null
  /** Sides already on the tray. */
  sides: SideId[]
  onTap: (id: ToppingId) => void
  onSauce: (id: SauceId) => void
  onSide: (id: SideId) => void
}

export default function ToppingTrays({ stock, menu, sauce, sides, onTap, onSauce, onSide }: Props) {
  const chipsOn = menu.sides.includes('chips')
  const gotChips = sides.includes('chips')

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

      {/* ══ SAUCE ══ tap to squeeze it on; tap the same bottle again to wipe
          it off, which is the only way back from the wrong one short of the
          bin. The one in use stands a little taller and keeps a lit ring. */}
      {SAUCES.filter(s => menu.sauces.includes(s.id)).map(s => {
        const on = sauce === s.id
        return (
          <button
            key={s.id}
            type="button"
            aria-label={on ? `Wipe off the ${s.label} sauce` : `Squeeze on ${s.label} sauce`}
            aria-pressed={on}
            onClick={() => onSauce(s.id)}
            className="active:scale-95 transition-transform"
            style={{
              position: 'absolute',
              left: `${s.x}%`, top: `${SAUCE_BOX.top}%`, width: `${SAUCE_BOX.width}%`,
              transform: `translateX(-50%) translateY(${on ? -4 : 0}%)`,
              transition: 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)',
              background: 'none', border: 0, padding: 0,
              zIndex: 4,
            }}
          >
            <img src={s.sprite} alt="" draggable={false} style={{
              display: 'block', width: '100%', height: 'auto',
              filter: on
                ? 'brightness(1.06) drop-shadow(0 0 7px rgba(245,156,69,0.75)) drop-shadow(2px 3px 2px rgba(0,0,0,0.6))'
                : 'brightness(0.86) saturate(0.94) drop-shadow(2px 3px 2px rgba(0,0,0,0.6))',
            }} />
          </button>
        )
      })}

      {/* ══ CHIPS ══ a side, not a filling — it goes in the bag beside the
          wrap. Dimmed once one's already on the tray. */}
      {chipsOn && (
        <button
          type="button"
          aria-label="Take a carton of chips"
          onClick={() => onSide('chips')}
          className="active:scale-95 transition-transform"
          style={{
            position: 'absolute',
            left: `${CHIPS_BOX.x}%`, top: `${CHIPS_BOX.top}%`, width: `${CHIPS_BOX.width}%`,
            transform: 'translateX(-50%)',
            background: 'none', border: 0, padding: 0,
            zIndex: 4,
          }}
        >
          <img src={SIDE_BY_ID.chips.sprite} alt="" draggable={false} style={{
            display: 'block', width: '100%', height: 'auto',
            filter: gotChips
              ? 'brightness(0.45) saturate(0.5) drop-shadow(2px 3px 2px rgba(0,0,0,0.6))'
              : 'brightness(0.9) drop-shadow(2px 3px 2px rgba(0,0,0,0.6))',
            transition: 'filter 220ms ease',
          }} />
        </button>
      )}
    </>
  )
}
