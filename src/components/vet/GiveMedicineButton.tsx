'use client'

// The vet room's "GIVE MEDICINE" button + the status chip that replaces it once
// the dose is taken — both dressed in the same get-well purple. The button wears
// a white clinic medallion cradling the pixel pill on the left (rattling like a
// shaken bottle, faster while dosing), with three mint health-crosses floating
// up on the right like the cat is already mending. The result chip springs in:
// a heart + "ALL GOOD!" when Eren was healthy, a pill + "MEDICINE GIVEN!" once
// treated, with celebratory twinkles.
//
// Press / hover / shadow + the medShake / medRise / medPop keyframes live in
// globals.css (`.medicine-btn`) for the same Next 14 SWC multi-shadow `:active`
// panic reason as the other room buttons; badges reuse the shared heartbeat /
// sleepGlow / sleepTwinkle primitives. The hard drop-shadow colour is themed via
// the inline `--med-ink` custom property.

import { IconPill, IconHeart } from '@/components/PixelIcons'

const PIXEL_FONT = '"Press Start 2P", monospace'

// Get-well purple. INK = border, SHADOW = hard pixel drop shadow.
const HI = '#C97FDB'
const MID = '#AB47BC'
const LO = '#7B1FA2'
const INK = '#4A148C'
const SHADOW = '#38006B'
const TEXT = '#FBF1FF'
const RIVET = '#FCD34D'
const HEAL = '#6EE7B7' // mint health-cross

// Gold rivets tucked into the four inner corners.
const RIVETS = [
  { left: 6, top: 6 },
  { right: 6, top: 6 },
  { left: 6, bottom: 6 },
  { right: 6, bottom: 6 },
]

type MedState = 'give' | 'giving'

interface Props {
  state: MedState
  onClick: () => void
  disabled?: boolean
}

export default function GiveMedicineButton({ state, onClick, disabled }: Props) {
  const giving = state === 'giving'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Give Eren medicine"
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
      } as React.CSSProperties}
    >
      {/* Gold rivets — premium-card corner studs */}
      {RIVETS.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            ...pos,
            width: 3,
            height: 3,
            background: RIVET,
            boxShadow: `1px 1px 0 ${INK}`,
          }}
        />
      ))}

      {/* ── Pill medallion (left) ── */}
      <PillBadge giving={giving} />

      {/* ── Label (center) ── */}
      <span
        style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: PIXEL_FONT,
          fontSize: 10,
          lineHeight: 1,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
          textShadow: `0 2px 0 ${INK}`,
        }}
      >
        {giving ? 'GIVING...' : 'GIVE MEDICINE'}
      </span>

      {/* ── Floating health-crosses (right) ── */}
      <CrossRise />
    </button>
  )
}

// A round white clinic badge holding the pixel pill, rattling like a shaken
// bottle over a soft lavender halo — faster while the dose is being given.
function PillBadge({ giving }: { giving: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 3,
          borderRadius: '50%',
          boxShadow: '0 0 8px 2px rgba(216,180,254,0.65)',
          animation: 'sleepGlow 3.2s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 35%, #FFFFFF, #F3E5FB)',
          border: `2px solid ${LO}`,
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: giving ? 'medShake 0.45s ease-in-out infinite' : 'medShake 2.6s ease-in-out infinite',
        }}
      >
        <IconPill size={20} />
      </span>
    </span>
  )
}

// Three little mint "+" crosses drifting up and fading, staggered — the cat
// already on the mend. Echoes the bedroom button's rising "Zzz".
function CrossRise() {
  return (
    <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: 26, height: 30 }}>
      <HealCross style={{ left: 2,  animationDelay: '0s'   }} />
      <HealCross style={{ left: 10, animationDelay: '0.6s' }} />
      <HealCross style={{ left: 17, animationDelay: '1.2s' }} />
    </span>
  )
}

// One "+" cross built from a horizontal + vertical bar, rising via `medRise`.
function HealCross({ style }: { style: React.CSSProperties }) {
  const bar: React.CSSProperties = {
    position: 'absolute',
    background: HEAL,
    borderRadius: 1,
    boxShadow: '0 0 2px rgba(110,231,183,0.9)',
  }
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 0,
        width: 8,
        height: 8,
        animation: 'medRise 1.9s ease-in-out infinite',
        ...style,
      }}
    >
      <span style={{ ...bar, top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)' }} />
      <span style={{ ...bar, left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%)' }} />
    </span>
  )
}

// ── Result chip ─────────────────────────────────────────────────────────────
// Replaces the button once the visit resolves: green + heart for a clean bill
// of health, purple + pill once the dose is taken. Springs in via `medPop`.

const GREEN = { hi: '#66BB6A', mid: '#4CAF50', lo: '#388E3C', ink: '#1B5E20', shadow: '#145218', text: '#F0FFF2' }
const PURPLE = { hi: '#B968C9', mid: '#AB47BC', lo: '#7B1FA2', ink: '#4A148C', shadow: '#38006B', text: '#FBF1FF' }

export function MedicineResultBanner({ healthy }: { healthy: boolean }) {
  const p = healthy ? GREEN : PURPLE
  return (
    <div
      className="relative w-full max-w-xs"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        padding: '10px 14px',
        background: `linear-gradient(180deg, ${p.hi} 0%, ${p.mid} 55%, ${p.lo} 100%)`,
        border: `2px solid ${p.ink}`,
        borderRadius: 9,
        boxShadow: `0 4px 0 ${p.shadow}, 0 7px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.4)`,
        color: p.text,
        animation: 'medPop 340ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Celebratory corner twinkles */}
      <Twinkle style={{ top: -3, left: 10,  animationDelay: '0s'   }} />
      <Twinkle style={{ top: -3, right: 12, animationDelay: '0.7s' }} />

      <ResultBadge healthy={healthy} ink={p.lo} />

      <span
        style={{
          fontFamily: PIXEL_FONT,
          fontSize: 9,
          letterSpacing: 1,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          textShadow: `0 2px 0 ${p.shadow}`,
        }}
      >
        {healthy ? 'ALL GOOD!' : 'MEDICINE GIVEN!'}
      </span>
    </div>
  )
}

// White disc with the outcome icon, beating gently like a pulse.
function ResultBadge({ healthy, ink }: { healthy: boolean; ink: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 1,
          borderRadius: '50%',
          boxShadow: '0 0 7px 1.5px rgba(255,255,255,0.55)',
          animation: 'sleepGlow 3s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 35%, #FFFFFF, #F2F7F2)',
          border: `2px solid ${ink}`,
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'heartbeat 1.6s ease-in-out infinite',
        }}
      >
        {healthy ? <IconHeart size={14} /> : <IconPill size={14} />}
      </span>
    </span>
  )
}

// A small four-point twinkle (reusing the morning-sparkle motion).
function Twinkle({ style }: { style: React.CSSProperties }) {
  const arm: React.CSSProperties = { position: 'absolute', background: '#FFF4C2', borderRadius: 0.5 }
  return (
    <span
      aria-hidden
      style={{ position: 'absolute', width: 7, height: 7, animation: 'sleepTwinkle 1.8s ease-in-out infinite', ...style }}
    >
      <span style={{ ...arm, top: '50%', left: 0, right: 0, height: 1.5, transform: 'translateY(-50%)' }} />
      <span style={{ ...arm, left: '50%', top: 0, bottom: 0, width: 1.5, transform: 'translateX(-50%)' }} />
    </span>
  )
}
