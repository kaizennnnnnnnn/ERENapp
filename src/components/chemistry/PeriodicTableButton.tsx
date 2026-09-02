'use client'

// The chemistry room's study button. A lime "reagent" slab dressed up with
// chemistry props: a real periodic-table cell on the left (Er · 68, Erbium —
// and a quiet wink at Eren), a two-line pixel label, and a fizz of bubbles
// rising off the cell.
//
// HALF-WIDTH BY CONSTRUCTION. It shares one row with EREN'S BREW, so every
// measurement here is sized for ~144px — the narrowest it can be on a 360px
// phone. That is what retired the big bubbling flask that used to sit on the
// right: at half width the label had nowhere to go, and a flask nobody can
// read is just an expensive 30px. The fizz moved onto the cell instead, which
// is where it was coming from anyway.
//
// Press / hover / shadow states + the bubble and tile keyframes live in
// globals.css (`.chem-table-btn`, `chemBubbleRise`, `chemTileBob`).

interface Props {
  onClick: () => void
}

// Lab palette — lime reagent green over a dark olive ink for the border and
// hard pixel drop shadow. Reads cleanly on both the day and night room art.
const LIME_HI = '#A3E635'
const LIME_MID = '#84CC16'
const LIME_LO = '#65A30D'
const INK = '#1B2E05' // dark olive — border + drop shadow
const RIVET = '#FCD34D' // gold corner studs

const PIXEL_FONT = '"Press Start 2P", monospace'

// Bubbles fizzing off the top of the element cell. Staggered so it never
// pulses in lockstep. `left` = px offset from the cell's centre.
const BUBBLES = [
  { left: -8, size: 4, delay: '0s', dur: '1.8s' },
  { left: 0, size: 3, delay: '0.65s', dur: '2.1s' },
  { left: 7, size: 5, delay: '1.15s', dur: '1.55s' },
]

// Gold rivets tucked into the four inner corners.
const RIVETS = [
  { left: 5, top: 5 },
  { right: 5, top: 5 },
  { left: 5, bottom: 5 },
  { right: 5, bottom: 5 },
]

export default function PeriodicTableButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open the periodic table"
      className="chem-table-btn relative flex-1 min-w-0"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 10px',
        background: `linear-gradient(180deg, ${LIME_HI} 0%, ${LIME_MID} 48%, ${LIME_LO} 100%)`,
        border: `3px solid ${INK}`,
        borderRadius: 9,
        color: '#fffef2',
      }}
    >
      {/* Gold rivets — premium-card corner studs */}
      {RIVETS.map((p, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            ...p,
            width: 3,
            height: 3,
            background: RIVET,
            boxShadow: `1px 1px 0 ${INK}`,
          }}
        />
      ))}

      {/* ── Element cell + its fizz (left) ── */}
      <span
        aria-hidden
        style={{ position: 'relative', flexShrink: 0, width: 30, height: 34 }}
      >
        <ElementTile />
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: -1,
              left: `calc(50% + ${b.left}px)`,
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background: 'rgba(224,252,182,0.95)',
              border: `1px solid ${INK}`,
              animation: `chemBubbleRise ${b.dur} ease-in ${b.delay} infinite`,
            }}
          />
        ))}
      </span>

      {/* ── Label (fills the rest) ── */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'center',
          fontFamily: PIXEL_FONT,
          fontSize: 8,
          lineHeight: 1.6,
          letterSpacing: 0.5,
          textShadow: `0 2px 0 ${INK}`,
        }}
      >
        PERIODIC
        <br />
        TABLE
      </span>
    </button>
  )
}

// A miniature periodic-table cell: atomic number top-left, big element symbol
// centred, category colour dot bottom-right. Tilted like a sticker and gently
// bobbing for life.
function ElementTile() {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        display: 'block',
        background: 'linear-gradient(180deg, #FBFFE8 0%, #ECFCCB 100%)',
        border: `2px solid ${INK}`,
        borderRadius: 3,
        boxShadow: `2px 2px 0 ${INK}`,
        animation: 'chemTileBob 2.6s ease-in-out infinite',
      }}
    >
      {/* glossy top highlight */}
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          right: 2,
          height: 3,
          background: 'rgba(255,255,255,0.7)',
        }}
      />
      {/* element symbol — centred in the cell */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 4,
          fontFamily: PIXEL_FONT,
          fontSize: 13,
          lineHeight: 1,
          color: INK,
        }}
      >
        Er
      </span>
      {/* atomic number — top-left corner */}
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          fontFamily: PIXEL_FONT,
          fontSize: 5,
          lineHeight: 1,
          color: LIME_LO,
        }}
      >
        68
      </span>
      {/* category dot (lanthanide indigo) */}
      <span
        style={{
          position: 'absolute',
          bottom: 3,
          right: 3,
          width: 4,
          height: 4,
          background: '#818cf8',
          boxShadow: `1px 1px 0 ${INK}`,
        }}
      />
    </span>
  )
}
