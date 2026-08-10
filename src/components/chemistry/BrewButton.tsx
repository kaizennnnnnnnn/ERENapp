'use client'

// The lab's second slab: Eren's Brew. Sits above the PERIODIC TABLE button and
// borrows its whole construction — same height, same rivets, same press — so
// the two read as a pair of controls on one bench rather than one button and a
// bolted-on afterthought.
//
// Where the table button is lab-lime and clinical, this one is potion-violet:
// a filled beaker with a drifting liquid line on the left, and a wisp of vapour
// curling off the right. The single visual difference carries "this is the fun
// one" without needing a second shape language.

import { IconSparkles } from '@/components/PixelIcons'

interface Props {
  onClick: () => void
  /** Dims the badge to a done-state tick once today's order is filled. */
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
  { left: 6, top: 6 },
  { right: 6, top: 6 },
  { left: 6, bottom: 6 },
  { right: 6, bottom: 6 },
]

// Vapour curling off the beaker. Reuses the table button's bubble keyframe —
// same drift, and one fewer near-identical animation in globals.css.
const WISPS = [
  { left: -5, size: 4, delay: '0.2s', dur: '2.2s' },
  { left: 3,  size: 3, delay: '0.9s', dur: '1.9s' },
  { left: 7,  size: 5, delay: '1.5s', dur: '2.5s' },
]

export default function BrewButton({ onClick, done }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Eren's Brew"
      className="chem-table-btn relative w-full max-w-xs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
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

      <BeakerTile done={done} />

      <span style={{
        flex: 1, textAlign: 'center',
        fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 1.6, letterSpacing: 1,
        textShadow: `0 2px 0 ${INK}`,
      }}>
        EREN&apos;S
        <br />
        BREW
      </span>

      {/* Vapour + a sparkle, the "todays order" cue */}
      <span aria-hidden style={{
        position: 'relative', flexShrink: 0, width: 30, height: 34,
        display: 'inline-flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        {WISPS.map((w, i) => (
          <span key={i} style={{
            position: 'absolute', top: 1, left: `calc(50% + ${w.left}px)`,
            width: w.size, height: w.size, borderRadius: '50%',
            background: 'rgba(245,225,255,0.95)',
            border: `1px solid ${INK}`,
            animation: `chemBubbleRise ${w.dur} ease-in ${w.delay} infinite`,
          }} />
        ))}
        <IconSparkles size={26} />
      </span>
    </button>
  )
}

// A squat beaker half-full of potion, tilted like a sticker and bobbing. The
// liquid line is a flat band — no gradient — so it stays readable at 36px.
function BeakerTile({ done }: { done?: boolean }) {
  return (
    <span aria-hidden style={{
      position: 'relative', flexShrink: 0, width: 36, height: 40, display: 'block',
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
        position: 'absolute', left: 0, right: 0, bottom: 0, height: done ? 26 : 17,
        // Cyan, NOT the slab's own violet. A purple potion on a purple button
        // samples correctly and still reads as one flat shape — the lime button
        // only gets away with its white tile because it contrasts.
        background: done ? '#4ADE80' : '#22D3EE',
        transition: 'height 300ms ease, background 300ms ease',
      }} />
      {/* meniscus */}
      <span style={{
        position: 'absolute', left: 0, right: 0, bottom: done ? 26 : 17, height: 3,
        background: done ? '#BBF7D0' : '#A5F3FC',
        transition: 'bottom 300ms ease, background 300ms ease',
      }} />
      {/* two bubbles inside the glass */}
      <span style={{
        position: 'absolute', left: 9, bottom: 6, width: 4, height: 4, borderRadius: '50%',
        background: 'rgba(255,255,255,0.85)',
        animation: 'chemBubbleRise 1.9s ease-in 0.3s infinite',
      }} />
      <span style={{
        position: 'absolute', left: 20, bottom: 4, width: 3, height: 3, borderRadius: '50%',
        background: 'rgba(255,255,255,0.75)',
        animation: 'chemBubbleRise 2.3s ease-in 1.1s infinite',
      }} />
    </span>
  )
}
