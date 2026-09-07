'use client'

// ─── JumpPlatform ───────────────────────────────────────────────────────────
// One shelf in the storeroom shaft. Seven kinds.
//
// A platform is a SLAB, not the shop's pudding art shrunk down. The first build
// dropped jelly_*.png into a 76×26 box with objectFit:contain, which letterboxes
// a 1.18:1 portrait into a 31px-wide thumbnail floating in the middle of its own
// hitbox — so the thing you land on looked nothing like the thing you aimed at.
// These are drawn wide, sitting on a plate, in the flavour's own colour, so the
// whole 76px reads as ground.
//
// ── The rule every kind obeys ──────────────────────────────────────────────
// EACH KIND DIFFERS IN SHAPE, NOT ONLY COLOUR. At a screen's distance while
// falling, shape is all you get — and every one of these does something
// different when you land on it, so a misread is a death. Cream is a piped
// swirl; biscuit is a bitten slab; a slider wears brass rails; syrup hangs two
// frozen drips off its front edge; a lid is the only thing in the shaft with a
// triangle under it; a rack is bare wire in a frame.
//
//   JELLY   bounces, and stays. The baseline.
//   SLIDER  slides along its shelf. Stays.
//   CREAM   a much bigger bounce. The pressure valve.
//   CRUMB   cracks where you land, holds a beat, then drops. The ONLY platform
//           that ever goes away — see the note in page.tsx.
//   SYRUP   a weak bounce. Doesn't vanish, doesn't move: it just dumps you low,
//           and the camera never follows you down.
//   LID     a jar lid on a pivot. Land off-centre and it tips and throws you
//           that way; land on the fulcrum and it launches you like cream.
//   RACK    an oven rack on a duty cycle. Lit = a cream-strength launch,
//           cooling = an ordinary one. It ALWAYS catches you — a platform you
//           could fall through would be the crumb's lie told twice.
//   SOUR    not a shelf: a trap wearing a shelf's shape. It bites. It is dealt
//           BESIDE the real shelf, never instead of it (jumpFoes.ts), so it is
//           never the only way up — and it wears a face and a pulsing ring so
//           it can be told from the real one while falling.

import { memo } from 'react'
import type { JellyDef } from '@/lib/jellies'
import { INK } from './parlourTheme'

export type PlatKind = 'jelly' | 'slider' | 'cream' | 'crumb' | 'syrup' | 'lid' | 'rack' | 'sour'

export const PLAT_W = 76
export const PLAT_H = 26

interface Props {
  kind: PlatKind
  jelly: JellyDef
  /** CRUMB: landed on, cracks showing. */
  cracked: boolean
  /** LID: which way it tipped, once, for the rest of the run. */
  tip: -1 | 0 | 1
}

function PlatformInner({ kind, jelly, cracked, tip }: Props) {
  if (kind === 'cream') {
    return (
      <span style={{ position: 'absolute', inset: 0 }}>
        <span style={{
          position: 'absolute', left: 3, right: 3, bottom: 1, height: 13, borderRadius: 999,
          background: 'linear-gradient(180deg, #FFFDF6 0%, #E9D3B8 100%)',
          border: `3px solid ${INK}`,
        }} />
        {[15, 30, 46, 61].map((x, i) => (
          <span key={x} style={{
            position: 'absolute', left: x - 8, bottom: 9 + (i % 2) * 5,
            width: 17, height: 17, borderRadius: '50%',
            background: 'linear-gradient(180deg, #FFFFFF, #EFDCC4)',
            border: `3px solid ${INK}`,
          }} />
        ))}
      </span>
    )
  }

  if (kind === 'crumb') {
    return (
      <span style={{ position: 'absolute', inset: 0 }}>
        {/* A bite out of the top-right, cut with clip-path rather than painted
            over — a "bite" drawn as a background-coloured circle only works on a
            flat backdrop, and this one has lamps on it. */}
        <span style={{
          position: 'absolute', left: 2, right: 2, bottom: 2, height: 19, borderRadius: 6,
          background: 'linear-gradient(180deg, #E8BC85 0%, #B37E45 100%)',
          border: `3px solid ${INK}`,
          clipPath: 'polygon(0% 0%, 72% 0%, 76% 40%, 88% 42%, 92% 0%, 100% 0%, 100% 100%, 0% 100%)',
        }} />
        {[[16, 9], [30, 13], [45, 8], [56, 12]].map(([x, y]) => (
          <span key={x} style={{
            position: 'absolute', left: x, bottom: y, width: 4, height: 4, borderRadius: 1,
            background: 'rgba(88,50,18,0.75)',
          }} />
        ))}
        {/* Split lines, the instant it is landed on. This is the whole point of
            CRUMB_HOLD_MS: the player gets a frame where the biscuit is visibly
            broken, so what happens next is something they watched rather than
            something that happened to them. */}
        {cracked && (
          <>
            <span style={{ position: 'absolute', left: 24, bottom: 3, width: 3, height: 17, background: INK, transform: 'rotate(9deg)' }} />
            <span style={{ position: 'absolute', left: 49, bottom: 3, width: 3, height: 17, background: INK, transform: 'rotate(-13deg)' }} />
            <span style={{ position: 'absolute', left: 33, bottom: 11, width: 14, height: 2.5, background: INK, transform: 'rotate(6deg)' }} />
          </>
        )}
      </span>
    )
  }

  if (kind === 'lid') {
    // The only thing in the shaft with a triangle under it, and the only slab
    // thinner than it is round. transformOrigin on the wrapper is already
    // 'center bottom' — exactly the fulcrum — so the tilt rotates for free.
    return (
      <span style={{ position: 'absolute', inset: 0 }}>
        {/* Fulcrum. Drawn first so the disc sits on it. */}
        <span style={{
          position: 'absolute', left: '50%', marginLeft: -5, bottom: 0,
          width: 10, height: 9, background: INK,
          clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
        }} />
        <span style={{
          position: 'absolute', left: 0, right: 0, bottom: 7, height: 14, borderRadius: 999,
          background: 'linear-gradient(180deg, #F8DC92 0%, #E0A93E 52%, #9A6E1E 100%)',
          border: `3px solid ${INK}`, overflow: 'hidden',
        }}>
          {/* Knurl ticks along the rim — brass, and obviously metal. */}
          {[8, 20, 32, 44, 56, 68].map(x => (
            <span key={x} style={{ position: 'absolute', left: x, top: 0, width: 2, height: 5, background: 'rgba(58,31,43,0.55)' }} />
          ))}
        </span>
        {/* The dead zone, marked. Landing between these two notches is the
            payout, so the player has to be able to SEE where it is. */}
        {[-11, 11].map(dx => (
          <span key={dx} style={{
            position: 'absolute', left: `calc(50% + ${dx}px)`, bottom: 18, width: 3, height: 5,
            marginLeft: -1.5, background: INK,
          }} />
        ))}
        {tip !== 0 && (
          <span style={{
            position: 'absolute', left: tip < 0 ? 4 : undefined, right: tip > 0 ? 4 : undefined,
            bottom: 20, width: 9, height: 3, background: INK, opacity: 0.6,
          }} />
        )}
      </span>
    )
  }

  if (kind === 'sour') {
    // The same dome as a jelly — that is the point of a trap — but sallow,
    // with a mouth, and a warning ring the real ones never wear. The ring is
    // the Jelly Slice `sourPulse`, so the two games share one word for "bad".
    return (
      <span style={{ position: 'absolute', inset: 0 }}>
        <span aria-hidden style={{
          position: 'absolute', left: -6, right: -6, top: -8, bottom: -3, borderRadius: 999,
          border: '2.5px solid #B7E24A', opacity: 0.6,
          animation: 'sourPulse 640ms ease-in-out infinite',
        }} />
        <span style={{
          position: 'absolute', left: 1, right: 1, bottom: 1, height: 21,
          borderRadius: '13px 13px 5px 5px',
          background: 'linear-gradient(180deg, #A9C84A 0%, #7E9A2C 55%, rgba(0,0,0,0.32) 100%)',
          border: `3px solid ${INK}`, overflow: 'hidden',
        }}>
          <span style={{
            position: 'absolute', left: 4, right: 4, top: 2, height: 6, borderRadius: 999,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.08))',
          }} />
          {/* Eyes and a row of TEETH — a face, so it is a THING, not a shelf.
              The teeth are cream on an INK gum: INK alone vanished into the
              slab's dark lower half, and a trap that can't be read is a tax. */}
          {[22, 44].map(x => (
            <span key={x} style={{ position: 'absolute', left: x, top: 6, width: 5, height: 5, borderRadius: '50%', background: INK }} />
          ))}
          <span style={{ position: 'absolute', left: 18, top: 12, width: 34, height: 7, borderRadius: '2px 2px 4px 4px', background: INK }}>
            <span style={{
              position: 'absolute', left: 2, right: 2, top: 1, height: 4, background: '#FFF8EE',
              clipPath: 'polygon(0 0, 100% 0, 100% 35%, 90% 100%, 80% 35%, 70% 100%, 60% 35%, 50% 100%, 40% 35%, 30% 100%, 20% 35%, 10% 100%, 0 35%)',
            }} />
          </span>
        </span>
        <span style={{
          position: 'absolute', left: '50%', top: 0, width: 11, height: 7, marginLeft: -5,
          borderRadius: '60% 20% 60% 20%', background: '#5E6B1E', border: `2px solid ${INK}`,
        }} />
      </span>
    )
  }

  if (kind === 'rack') {
    // Bare wire in a brass frame. `--on` is written straight to the wrapper by
    // the game loop, so the duty cycle costs no React at all.
    return (
      <span style={{ position: 'absolute', inset: 0 }}>
        <span style={{
          position: 'absolute', left: 0, right: 0, bottom: 2, height: 20, borderRadius: 4,
          border: `3px solid ${INK}`,
          background: 'linear-gradient(180deg, rgba(255,150,60,calc(0.42 * var(--on, 1))) 0%, rgba(200,70,20,calc(0.30 * var(--on, 1))) 100%)',
          boxShadow: 'inset 0 0 10px rgba(255,160,70,calc(0.75 * var(--on, 1)))',
          overflow: 'hidden',
        }}>
          {[9, 21, 33, 45, 57].map(x => (
            <span key={x} style={{
              position: 'absolute', left: x, top: 0, bottom: 0, width: 3,
              background: '#C9B79A',
              boxShadow: '0 0 6px rgba(255,170,80,calc(0.9 * var(--on, 0)))',
            }} />
          ))}
          {/* One horizontal wire, INSIDE the frame — it can never be mistaken
              for a top face because the frame's own border is above it. */}
          <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2.5, background: '#C9B79A', opacity: 0.8 }} />
        </span>
        {/* The tell. Pulses only while it is cooling toward an ordinary bounce. */}
        <span style={{
          position: 'absolute', left: '50%', marginLeft: -4, bottom: 24,
          width: 8, height: 4, borderRadius: 2, background: '#FF9A3C',
          border: `2px solid ${INK}`,
          opacity: 'var(--on, 1)' as unknown as number,
          animation: 'jumpRackWarn 260ms steps(2, end) infinite',
          // The loop writes `running` / `paused` into --warn, so the tell
          // pulses without a single React render.
          animationPlayState: 'var(--warn, paused)',
        }} />
      </span>
    )
  }

  const syrup = kind === 'syrup'
  return (
    <span style={{ position: 'absolute', inset: 0 }}>
      {kind === 'slider' && (
        // Rails, so a moving shelf announces itself before it moves.
        <span style={{
          position: 'absolute', left: -5, right: -5, bottom: 0, height: 6, borderRadius: 3,
          background: 'linear-gradient(180deg, #F3CE78, #9A6E1E)', border: `2.5px solid ${INK}`,
        }} />
      )}
      {/* The slab: the flavour's colour, domed like the mould it came out of.
          A syrup slab is the same mould under a dark glaze — same silhouette,
          unmistakably wetter and heavier. */}
      <span style={{
        position: 'absolute', left: 1, right: 1, bottom: kind === 'slider' ? 5 : 1, height: 21,
        borderRadius: '13px 13px 5px 5px',
        background: syrup
          ? `linear-gradient(180deg, #4A2A1E 0%, ${jelly.colour} 30%, #3A1D14 78%, rgba(0,0,0,0.5) 100%)`
          : `linear-gradient(180deg, ${jelly.colour} 0%, ${jelly.colour} 55%, rgba(0,0,0,0.28) 100%)`,
        border: `3px solid ${INK}`,
        overflow: 'hidden',
      }}>
        {/* Wet top face. */}
        <span style={{
          position: 'absolute', left: 4, right: 4, top: 2, height: 6, borderRadius: 999,
          background: syrup
            ? 'linear-gradient(180deg, rgba(255,214,150,0.85), rgba(255,214,150,0.10))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.12))',
        }} />
        {/* Mould flutes. */}
        {[22, 50, 78].map(pct => (
          <span key={pct} style={{
            position: 'absolute', left: `${pct}%`, top: 5, bottom: 0, width: 2,
            background: 'rgba(255,255,255,0.22)',
          }} />
        ))}
      </span>
      {/* Two frozen drips off the front edge — the syrup tell, and the only
          thing in the shaft that hangs BELOW its own slab. */}
      {syrup && [20, 52].map((x, i) => (
        <span key={x} style={{
          position: 'absolute', left: x, bottom: -5 - i * 2, width: 7, height: 10 + i * 3,
          borderRadius: '40% 40% 52% 52%',
          background: 'linear-gradient(180deg, #6B3A22, #3A1D14)',
          border: `2px solid ${INK}`,
        }} />
      ))}
      {/* The leaf off the shop art, so a slab still reads as one of the five. */}
      <span style={{
        position: 'absolute', left: '50%', top: 0, width: 11, height: 7, marginLeft: -5,
        borderRadius: '60% 20% 60% 20%', background: syrup ? '#2F6B1C' : '#4E9E2E',
        border: `2px solid ${INK}`,
      }} />
    </span>
  )
}

export const Platform = memo(PlatformInner)

/**
 * A sugar cube, strung on the arc between two shelves.
 *
 * Deliberately NOT slab-shaped and deliberately small: it must never be read as
 * something you could land on. It is the only thing in the shaft that spins.
 */
export const SUGAR_SIZE = 15

export const Sugar = memo(function Sugar() {
  return (
    <span style={{
      position: 'absolute', inset: 0, borderRadius: 3,
      background: 'linear-gradient(145deg, #FFFFFF 0%, #FFF3D6 46%, #E4C79A 100%)',
      border: `2.5px solid ${INK}`,
      boxShadow: '0 0 10px rgba(255,240,200,0.6)',
    }}>
      <span style={{ position: 'absolute', left: 2, top: 2, width: 4, height: 3, background: 'rgba(255,255,255,0.9)', borderRadius: 1 }} />
    </span>
  )
})
