'use client'

// ─── JumpFoe ────────────────────────────────────────────────────────────────
// The art for one hazard. Behaviour and the fairness rules live in jumpFoes.ts;
// this file only draws.
//
// Three nested transform channels, and the reason is the trap this repo keeps
// re-finding: a CSS animation on `transform` beats an inline `transform`. So —
//   the WRAPPER (page.tsx) is positioned by the loop,
//   the FLIP span carries scaleX for direction, written by the loop,
//   the innermost span carries the idle keyframe (hover, flap, shiver).
// Put any two of those on one element and one of them silently stops.
//
// Palettes ≤ 6 colours, 2–3px INK, no blur. Every foe is a different
// SILHOUETTE at 20px, because that is the distance at which it gets read.

import { memo } from 'react'
import type { FoeKind } from './jumpFoes'
import { INK } from './parlourTheme'

const STRIPE = '#F4C542'
const WING = 'rgba(232,244,255,0.78)'

/** Which creature patrols each zone's storeys. Same rule, four silhouettes. */
export type FlierSkin = 'wasp' | 'bat' | 'moth' | 'firefly'
export const FLIER_SKIN: FlierSkin[] = ['wasp', 'bat', 'moth', 'firefly']

function Wasp({ hover }: { hover: boolean }) {
  return (
    <span style={{ position: 'absolute', inset: 0, animation: hover ? 'jumpHover 520ms steps(2, end) infinite' : undefined }}>
      {/* Wings first, so the body sits on them. */}
      {[-1, 1].map(s => (
        <span key={s} style={{
          position: 'absolute', left: 11 + s * 6 - 6, top: -5, width: 12, height: 9,
          borderRadius: '60% 60% 40% 40%', background: WING, border: `2px solid ${INK}`,
          transform: `rotate(${s * -18}deg)`,
          animation: hover ? 'jumpFlap 120ms steps(2, end) infinite' : undefined,
        }} />
      ))}
      <span style={{
        position: 'absolute', left: 0, top: 2, width: 22, height: 14, borderRadius: '45% 55% 55% 45%',
        border: `2.5px solid ${INK}`, overflow: 'hidden',
        background: `repeating-linear-gradient(90deg, ${STRIPE} 0 4px, ${INK} 4px 7px)`,
      }} />
      {/* Head + eye. */}
      <span style={{ position: 'absolute', left: -4, top: 4, width: 9, height: 9, borderRadius: '50%', background: INK }} />
      <span style={{ position: 'absolute', left: -2, top: 6, width: 3, height: 3, borderRadius: '50%', background: '#FFF8EE' }} />
      {/* Sting. The tell that says "don't". */}
      <span style={{
        position: 'absolute', left: 21, top: 8, width: 6, height: 4, background: INK,
        clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
      }} />
    </span>
  )
}

function Beetle({ walk }: { walk: boolean }) {
  return (
    <span style={{ position: 'absolute', inset: 0, animation: walk ? 'jumpHover 300ms steps(2, end) infinite' : undefined }}>
      <span style={{
        position: 'absolute', left: 2, top: 1, width: 16, height: 12, borderRadius: '50% 50% 30% 30%',
        background: 'linear-gradient(180deg, #B8322F 0%, #6E1A1C 100%)', border: `2.5px solid ${INK}`,
      }} />
      {/* Wing-case seam. */}
      <span style={{ position: 'absolute', left: 9.5, top: 3, width: 2, height: 9, background: INK, opacity: 0.8 }} />
      <span style={{ position: 'absolute', left: -3, top: 5, width: 7, height: 7, borderRadius: '50%', background: INK }} />
      {/* Legs — three ticks a side, the thing that makes it read as a bug. */}
      {[3, 9, 15].map(x => (
        <span key={x} style={{ position: 'absolute', left: x, top: 12, width: 2, height: 4, background: INK }} />
      ))}
    </span>
  )
}

function Drop() {
  return (
    <span style={{
      position: 'absolute', left: -7, top: -9, width: 14, height: 18,
      borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%',
      background: 'linear-gradient(180deg, #7A3E22 0%, #3A1D14 100%)', border: `2.5px solid ${INK}`,
    }}>
      <span style={{ position: 'absolute', left: 3, top: 5, width: 3, height: 5, borderRadius: 2, background: 'rgba(255,214,150,0.7)' }} />
    </span>
  )
}

function Spout() {
  // A brass spout tucked under the shelf above — the SOURCE, so the column
  // reads as "something drips here" before the first drop ever falls.
  return (
    <span style={{ position: 'absolute', left: -9, top: -8, width: 18, height: 9 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '0 0 6px 6px',
        background: 'linear-gradient(180deg, #F3CE78, #9A6E1E)', border: `2.5px solid ${INK}`,
      }} />
      <span style={{ position: 'absolute', left: 6, bottom: -3, width: 6, height: 3, background: '#3A1D14' }} />
    </span>
  )
}

function SpiderBody() {
  // The shiver runs off `--shiver` (running / paused), written to the wrapper
  // by the loop in the last 7% of the cycle — the tell before it drops.
  return (
    <span style={{
      position: 'absolute', left: -11, top: -9, width: 22, height: 18,
      animation: 'jumpShiver 90ms steps(2, end) infinite',
      animationPlayState: 'var(--shiver, paused)',
    }}>
      {/* Legs: four each side, drawn as INK ticks fanned out. */}
      {[-1, 1].map(s => [0, 1, 2, 3].map(i => (
        <span key={`${s}${i}`} style={{
          position: 'absolute', left: 11 + s * 8 - 1.5, top: 3 + i * 3.5, width: 3, height: 9,
          background: INK, transformOrigin: 'top center',
          transform: `rotate(${s * (34 + i * 16)}deg)`,
        }} />
      )))}
      <span style={{
        position: 'absolute', left: 4, top: 3, width: 14, height: 13, borderRadius: '50%',
        background: 'linear-gradient(180deg, #4A3A5A, #1E1826)', border: `2.5px solid ${INK}`,
      }} />
      {/* Two eyes, lit. */}
      {[7, 12].map(x => (
        <span key={x} style={{ position: 'absolute', left: x, top: 7, width: 3, height: 3, borderRadius: '50%', background: '#FF4D6D' }} />
      ))}
    </span>
  )
}

function Bat({ hover }: { hover: boolean }) {
  return (
    <span style={{ position: 'absolute', inset: 0, animation: hover ? 'jumpHover 480ms steps(2, end) infinite' : undefined }}>
      {[-1, 1].map(s => (
        <span key={s} style={{
          position: 'absolute', left: 11 + s * 9 - 8, top: 0, width: 16, height: 12,
          background: '#5A3A78', border: `2.5px solid ${INK}`,
          clipPath: s < 0
            ? 'polygon(100% 0, 100% 100%, 60% 70%, 30% 100%, 0 60%, 20% 20%)'
            : 'polygon(0 0, 0 100%, 40% 70%, 70% 100%, 100% 60%, 80% 20%)',
          animation: hover ? 'jumpFlap 140ms steps(2, end) infinite' : undefined,
        }} />
      ))}
      <span style={{ position: 'absolute', left: 6, top: 3, width: 10, height: 12, borderRadius: '50% 50% 40% 40%', background: INK }} />
      {[8, 12].map(x => (
        <span key={x} style={{ position: 'absolute', left: x, top: 6, width: 2, height: 2, background: '#FFE6F0' }} />
      ))}
    </span>
  )
}

function Moth({ hover }: { hover: boolean }) {
  return (
    <span style={{ position: 'absolute', inset: 0, animation: hover ? 'jumpHover 600ms steps(2, end) infinite' : undefined }}>
      {[-1, 1].map(s => (
        <span key={s} style={{
          position: 'absolute', left: 11 + s * 8 - 8, top: -1, width: 16, height: 14,
          borderRadius: s < 0 ? '70% 30% 30% 60%' : '30% 70% 60% 30%',
          background: 'linear-gradient(180deg, #F2E2C4, #B8955E)', border: `2.5px solid ${INK}`,
          animation: hover ? 'jumpFlap 180ms steps(2, end) infinite' : undefined,
        }}>
          <span style={{ position: 'absolute', left: 5, top: 4, width: 5, height: 5, borderRadius: '50%', background: '#6E4A2A', border: `1.5px solid ${INK}` }} />
        </span>
      ))}
      <span style={{ position: 'absolute', left: 8, top: 2, width: 6, height: 12, borderRadius: 3, background: '#5A3E22', border: `2px solid ${INK}` }} />
    </span>
  )
}

function Firefly({ hover }: { hover: boolean }) {
  return (
    <span style={{ position: 'absolute', inset: 0, animation: hover ? 'jumpHover 700ms steps(2, end) infinite' : undefined }}>
      <span style={{
        position: 'absolute', left: 4, top: 3, width: 14, height: 10, borderRadius: '50%',
        background: '#2A2038', border: `2.5px solid ${INK}`,
      }} />
      {/* The lantern. It is the only foe that GLOWS, and the glow is the tell. */}
      <span style={{
        position: 'absolute', left: 13, top: 4, width: 8, height: 8, borderRadius: '50%',
        background: '#FFF3A6', border: `2px solid ${INK}`,
        boxShadow: '0 0 10px #FFE96A, 0 0 22px rgba(255,233,106,0.55)',
        animation: hover ? 'jumpFlap 260ms steps(2, end) infinite' : undefined,
      }} />
      {[-1, 1].map(s => (
        <span key={s} style={{
          position: 'absolute', left: 9 + s * 4 - 4, top: -4, width: 9, height: 7,
          borderRadius: '60% 60% 40% 40%', background: WING, border: `2px solid ${INK}`, transform: `rotate(${s * -20}deg)`,
        }} />
      ))}
    </span>
  )
}

interface Props {
  kind: FoeKind
  skin: FlierSkin
  /** Idle keyframes off — positions still update, they are gameplay. */
  reduced: boolean
}

export const FoeSprite = memo(function FoeSprite({ kind, skin, reduced }: Props) {
  const anim = !reduced
  if (kind === 'wasp') return <Wasp hover={anim} />
  if (kind === 'beetle') return <Beetle walk={anim} />
  if (kind === 'flier') {
    if (skin === 'bat') return <Bat hover={anim} />
    if (skin === 'moth') return <Moth hover={anim} />
    if (skin === 'firefly') return <Firefly hover={anim} />
    return <Wasp hover={anim} />
  }
  return null
})

export { Drop, Spout, SpiderBody }
