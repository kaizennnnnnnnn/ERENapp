'use client'

// The prep wall: four warmer pans on the shelf, the sauce bottles standing on
// the counter under them, and the chip warmer at the far end.
//
// Each pan is filled with its own seamless texture clipped to the pan's real
// outline; every scoop taken drops the level by a fifth, so the pan empties
// the way a real one does and the leaning steel walls trim the surface as it
// falls.
//
// Three layers make a pan look like food rather than a cropped picture: the
// texture, clipped to a lumpy domed surface (see panFill); a gradient that
// puts the lamp on that surface and the pan's own far wall in shadow behind
// it; and a few loose pieces half-buried along the top. The pieces matter
// most — a silhouette of actual food across the top edge is what stops the
// eye reading the boundary as a crop.
//
// The bottles and the basket sit on the counter's own top surface (71.8% →
// 75.2% of the picture — a column scan, not a guess), so they stand on it
// instead of floating in front of it.

import {
  TOPPINGS, SAUCES, SAUCE_BOX, CHIPS_BOX, SIDE_BY_ID, MAX_USES, panFill,
  type MenuState, type SauceId, type SideId, type ToppingId,
} from './kioskShift'

/** Base size of one loose piece on a pile, in % of the picture's width —
 *  matched to how big a piece comes out in the pan's own fill texture, which
 *  is small. Each piece scales itself off this. */
const PIECE_CQI = 1.85

/** A scoop settles rather than snaps: the overshoot is what sells someone
 *  having just taken something out. Shared by the fill, its lighting and the
 *  pieces on top so the whole pile moves as one. */
const TRAY_EASE = 'clip-path 320ms cubic-bezier(0.34, 1.26, 0.64, 1),'
  + ' background-position 320ms ease-out,'
  + ' top 320ms cubic-bezier(0.34, 1.26, 0.64, 1),'
  + ' left 320ms cubic-bezier(0.34, 1.26, 0.64, 1)'

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
      {TOPPINGS.map((t, pan) => {
        const left = stock[t.id]
        const { box, clip, surfacePct, crest } = panFill(t.well, left, pan + 1)
        return (
          <div key={t.id}>
            {left > 0 && (
              <>
                <div aria-hidden style={{
                  position: 'absolute', ...box,
                  backgroundImage: `url(${t.fill})`,
                  backgroundSize: 'cover',
                  // Shifted a little further down with every scoop, so what
                  // you can see after one is a DIFFERENT arrangement of
                  // pieces rather than the same picture with less of it.
                  backgroundPosition: `center calc(100% + ${(MAX_USES - left) * 11}px)`,
                  clipPath: clip,
                  // Sit the food in the kiosk's own light rather than letting
                  // it glow brighter than the room it's standing in.
                  filter: 'brightness(0.88) saturate(0.95)',
                  pointerEvents: 'none',
                  transition: TRAY_EASE,
                }} />

                {/* The lamp on the surface, and the pan's own far wall
                    shading the back of the food. Same clip, so both stop
                    exactly where the food does. */}
                <div aria-hidden style={{
                  position: 'absolute', ...box,
                  clipPath: clip,
                  pointerEvents: 'none',
                  background: [
                    `linear-gradient(180deg,`
                    + ` rgba(255,247,228,0) ${Math.max(0, surfacePct - 3).toFixed(1)}%,`
                    + ` rgba(255,247,228,0.34) ${Math.min(100, surfacePct + 1).toFixed(1)}%,`
                    + ` rgba(255,247,228,0) ${Math.min(100, surfacePct + 11).toFixed(1)}%)`,
                    'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 32%)',
                  ].join(', '),
                  transition: TRAY_EASE,
                }} />

                {/* Loose pieces left sitting on the pile, half buried. A
                    silhouette of actual food along the top edge is what stops
                    it reading as a cropped picture. */}
                {crest.map((c, i) => (
                  <img key={i} src={t.sprite} alt="" aria-hidden draggable={false} style={{
                    position: 'absolute',
                    left: `${c.x}%`, top: `${c.y}%`,
                    width: `${(PIECE_CQI * c.scale).toFixed(2)}cqi`, height: 'auto',
                    transform: `translate(-50%, -50%) rotate(${c.rot.toFixed(1)}deg)`,
                    filter: 'brightness(0.9) saturate(0.95) drop-shadow(0 1px 1px rgba(0,0,0,0.55))',
                    pointerEvents: 'none',
                    transition: TRAY_EASE,
                  }} />
                ))}
              </>
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
