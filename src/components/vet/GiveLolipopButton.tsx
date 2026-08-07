'use client'

// The vet room's "GIVE LOLIPOP" button — what replaces GIVE MEDICINE when the
// checkup comes back clean, so a healthy cat isn't a dead end.
//
// Built as the medicine button's opposite number: same slab, same rivets, same
// medallion-and-drift layout, but candy pink instead of get-well purple, and
// little hearts drifting up instead of health crosses. Sharing the silhouette
// is the point — one is treatment, one is a treat, and they're the same
// gesture at the same moment in the visit.
//
// Reuses the medicine keyframes (medShake / medRise / medPop) from globals.css
// rather than minting near-identical ones.

import { IconLolipop, IconHeart } from '@/components/PixelIcons'

const PIXEL_FONT = '"Press Start 2P", monospace'

// Candy pink. INK = border, SHADOW = hard pixel drop shadow.
const HI = '#FF9EC4'
const MID = '#F4629B'
const LO = '#C62E68'
const INK = '#7A1038'
const SHADOW = '#5A0A28'
const TEXT = '#FFF4F8'
const RIVET = '#FCD34D'
const SWEET = '#FFE08A' // drifting hearts

const RIVETS = [
  { left: 6, top: 6 },
  { right: 6, top: 6 },
  { left: 6, bottom: 6 },
  { right: 6, bottom: 6 },
]

type LolipopState = 'give' | 'giving'

interface Props {
  state: LolipopState
  onClick: () => void
  disabled?: boolean
}

export default function GiveLolipopButton({ state, onClick, disabled }: Props) {
  const giving = state === 'giving'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Give Eren a lolipop"
      className="medicine-btn relative w-full max-w-xs"
      style={{
        '--med-ink': SHADOW,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        background: `linear-gradient(180deg, ${HI} 0%, ${MID} 52%, ${LO} 100%)`,
        border: `3px solid ${INK}`,
        borderRadius: 9,
        color: TEXT,
        opacity: disabled ? 0.75 : 1,
      } as React.CSSProperties}
    >
      {RIVETS.map((pos, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', ...pos, width: 3, height: 3,
          background: RIVET, boxShadow: `1px 1px 0 ${INK}`,
        }} />
      ))}

      <LolipopBadge giving={giving} />

      <span style={{
        flex: 1, textAlign: 'center',
        fontFamily: PIXEL_FONT, fontSize: 10, lineHeight: 1, letterSpacing: 1,
        whiteSpace: 'nowrap', textShadow: `0 2px 0 ${INK}`,
      }}>
        {giving ? 'UNWRAPPING...' : 'GIVE LOLIPOP'}
      </span>

      <HeartRise />
    </button>
  )
}

// White sweet-shop disc holding the pixel lolipop, rocking like it's being
// twirled — faster while it's being handed over.
function LolipopBadge({ giving }: { giving: boolean }) {
  return (
    <span aria-hidden style={{
      position: 'relative', flexShrink: 0, width: 34, height: 34,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        position: 'absolute', inset: 3, borderRadius: '50%',
        boxShadow: '0 0 8px 2px rgba(255,182,209,0.7)',
        animation: 'sleepGlow 3.2s ease-in-out infinite',
      }} />
      <span style={{
        position: 'relative', width: 30, height: 30, borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 35%, #FFFFFF, #FFEDF4)',
        border: `2px solid ${LO}`,
        boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: giving ? 'medShake 0.45s ease-in-out infinite' : 'medShake 2.6s ease-in-out infinite',
      }}>
        <IconLolipop size={20} />
      </span>
    </span>
  )
}

// Three little hearts drifting up — the treat version of the medicine
// button's health crosses.
function HeartRise() {
  return (
    <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: 26, height: 30 }}>
      <SweetHeart style={{ left: 2,  animationDelay: '0s'   }} />
      <SweetHeart style={{ left: 10, animationDelay: '0.6s' }} />
      <SweetHeart style={{ left: 17, animationDelay: '1.2s' }} />
    </span>
  )
}

// A 3-block pixel heart: two shoulders and a point, rising via `medRise`.
function SweetHeart({ style }: { style: React.CSSProperties }) {
  const blk: React.CSSProperties = { position: 'absolute', background: SWEET, width: 3, height: 3 }
  return (
    <span style={{
      position: 'absolute', bottom: 0, width: 8, height: 8,
      animation: 'medRise 1.9s ease-in-out infinite',
      ...style,
    }}>
      <span style={{ ...blk, left: 0, top: 0 }} />
      <span style={{ ...blk, left: 4, top: 0 }} />
      <span style={{ ...blk, left: 0, top: 3, width: 7 }} />
      <span style={{ ...blk, left: 2, top: 5 }} />
    </span>
  )
}

// ── Result chip ─────────────────────────────────────────────────────────────
// Replaces the button once he's had it. Also stands in on a later visit the
// same day, so "he already had one" is a visible state rather than a button
// that mysteriously isn't there.

const PINK = { hi: '#FFA8CB', mid: '#F4629B', lo: '#C62E68', ink: '#7A1038', shadow: '#5A0A28', text: '#FFF4F8' }

export function LolipopBanner({ alreadyToday }: { alreadyToday: boolean }) {
  return (
    <div
      className="relative w-full max-w-xs"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        padding: '10px 14px',
        background: `linear-gradient(180deg, ${PINK.hi} 0%, ${PINK.mid} 55%, ${PINK.lo} 100%)`,
        border: `2px solid ${PINK.ink}`,
        borderRadius: 9,
        boxShadow: `0 4px 0 ${PINK.shadow}, 0 7px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.4)`,
        color: PINK.text,
        animation: 'medPop 340ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      <Twinkle style={{ top: -3, left: 10,  animationDelay: '0s'   }} />
      <Twinkle style={{ top: -3, right: 12, animationDelay: '0.7s' }} />

      <span aria-hidden style={{
        position: 'relative', flexShrink: 0, width: 24, height: 24,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          position: 'absolute', inset: 1, borderRadius: '50%',
          boxShadow: '0 0 7px 1.5px rgba(255,255,255,0.55)',
          animation: 'sleepGlow 3s ease-in-out infinite',
        }} />
        <span style={{
          position: 'relative', width: 22, height: 22, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 35%, #FFFFFF, #FFF2F7)',
          border: `2px solid ${PINK.lo}`,
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'heartbeat 1.6s ease-in-out infinite',
        }}>
          {alreadyToday ? <IconLolipop size={14} /> : <IconHeart size={14} />}
        </span>
      </span>

      <span style={{
        fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 1, lineHeight: 1,
        whiteSpace: 'nowrap', textShadow: `0 2px 0 ${PINK.shadow}`,
      }}>
        {alreadyToday ? 'ONE A DAY!' : 'LOLIPOP GIVEN!'}
      </span>
    </div>
  )
}

function Twinkle({ style }: { style: React.CSSProperties }) {
  const arm: React.CSSProperties = { position: 'absolute', background: '#FFF4C2', borderRadius: 0.5 }
  return (
    <span aria-hidden style={{
      position: 'absolute', width: 7, height: 7,
      animation: 'sleepTwinkle 1.8s ease-in-out infinite', ...style,
    }}>
      <span style={{ ...arm, top: '50%', left: 0, right: 0, height: 1.5, transform: 'translateY(-50%)' }} />
      <span style={{ ...arm, left: '50%', top: 0, bottom: 0, width: 1.5, transform: 'translateX(-50%)' }} />
    </span>
  )
}
