'use client'

// The lab's other half-width slab: Eren's Brew. It shares one row with
// PERIODIC TABLE and borrows its whole construction — same height, same
// rivets, same press, same 30x34 tile — so the two read as a pair of controls
// on one bench rather than one button and a bolted-on afterthought.
//
// Where the table button is lab-lime and clinical, this one is potion-violet:
// a filled beaker with a drifting liquid line, and vapour curling off it. That
// single visual difference carries "this is the fun one" without needing a
// second shape language.

interface Props {
  onClick: () => void
  /** Fills the beaker green once today's order is filled. */
  done?: boolean
}

// Potion violet over a deep plum ink, so it separates from the lime table
// button on both the day and night room art.
const VIO_HI = '#C4A7F5'
const VIO_MID = '#A855F7'
const VIO_LO = '#7C3AED'
const INK = '#2A0F4D'
const RIVET = '#FCD34D'

const PIXEL_FONT = '"Press Start 2P", monospace'

const RIVETS = [
  { left: 5, top: 5 },
  { right: 5, top: 5 },
  { left: 5, bottom: 5 },
  { right: 5, bottom: 5 },
]

// Vapour curling off the beaker. Reuses the table button's bubble keyframe —
// same drift, and one fewer near-identical animation in globals.css.
const WISPS = [
  { left: -8, size: 4, delay: '0.2s', dur: '2.2s' },
  { left: 1, size: 3, delay: '0.9s', dur: '1.9s' },
  { left: 8, size: 5, delay: '1.5s', dur: '2.5s' },
]

export default function BrewButton({ onClick, done }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Eren's Brew"
      className="chem-table-btn relative flex-1 min-w-0"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 10px',
        background: `linear-gradient(180deg, ${VIO_HI} 0%, ${VIO_MID} 48%, ${VIO_LO} 100%)`,
        border: `3px solid ${INK}`,
        borderRadius: 9,
        color: '#FDF7FF',
        // The hard drop shadow is themed per-button via this custom property.
        ['--chem-ink' as string]: INK,
      }}
    >
      {RIVETS.map((p, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', ...p, width: 3, height: 3,
          background: RIVET, boxShadow: `1px 1px 0 ${INK}`,
        }} />
      ))}

      {/* ── Beaker + its vapour (left) ── */}
      <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: 30, height: 34 }}>
        <BeakerTile done={done} />
        {WISPS.map((w, i) => (
          <span key={i} style={{
            position: 'absolute', top: -1, left: `calc(50% + ${w.left}px)`,
            width: w.size, height: w.size, borderRadius: '50%',
            background: 'rgba(245,225,255,0.95)',
            border: `1px solid ${INK}`,
            animation: `chemBubbleRise ${w.dur} ease-in ${w.delay} infinite`,
          }} />
        ))}
      </span>

      {/* ── Label (fills the rest) ── */}
      <span style={{
        flex: 1, minWidth: 0, textAlign: 'center',
        fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 1.6, letterSpacing: 0.5,
        textShadow: `0 2px 0 ${INK}`,
      }}>
        EREN&apos;S
        <br />
        BREW
      </span>
    </button>
  )
}

// A squat beaker half-full of potion, tilted like a sticker and bobbing. The
// liquid line is a flat band — no gradient — so it stays readable at 30px.
function BeakerTile({ done }: { done?: boolean }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', inset: 0, display: 'block',
      background: 'linear-gradient(180deg, #FBF5FF 0%, #EDE0FC 100%)',
      border: `2px solid ${INK}`,
      borderRadius: 3,
      boxShadow: `2px 2px 0 ${INK}`,
      animation: 'chemTileBob 2.6s ease-in-out infinite',
      overflow: 'hidden',
    }}>
      {/* glossy top highlight, matching the table button's tile */}
      <span style={{ position: 'absolute', top: 2, left: 2, right: 2, height: 3, background: 'rgba(255,255,255,0.7)' }} />
      {/* potion body */}
      <span style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: done ? 22 : 14,
        // Cyan, NOT the slab's own violet. A purple potion on a purple button
        // samples correctly and still reads as one flat shape — the lime button
        // only gets away with its white tile because it contrasts.
        background: done ? '#4ADE80' : '#22D3EE',
        transition: 'height 300ms ease, background 300ms ease',
      }} />
      {/* meniscus */}
      <span style={{
        position: 'absolute', left: 0, right: 0, bottom: done ? 22 : 14, height: 3,
        background: done ? '#BBF7D0' : '#A5F3FC',
        transition: 'bottom 300ms ease, background 300ms ease',
      }} />
      {/* two bubbles inside the glass */}
      <span style={{
        position: 'absolute', left: 7, bottom: 5, width: 4, height: 4, borderRadius: '50%',
        background: 'rgba(255,255,255,0.85)',
        animation: 'chemBubbleRise 1.9s ease-in 0.3s infinite',
      }} />
      <span style={{
        position: 'absolute', left: 17, bottom: 3, width: 3, height: 3, borderRadius: '50%',
        background: 'rgba(255,255,255,0.75)',
        animation: 'chemBubbleRise 2.3s ease-in 1.1s infinite',
      }} />
    </span>
  )
}
