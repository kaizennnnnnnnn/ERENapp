'use client'

// The vet room's "CHECK UP" button — a clinic-green slab dressed with vet
// props: a white clinic medallion cradling the pixel stethoscope on the left
// (gently thumping like a heartbeat), and a little EKG heart-monitor on the
// right (a mint vitals trace with a blip sweeping across its screen). Gold
// corner rivets, a glossy highlight, a hard drop shadow, and a springy
// designed press match the chemistry / bedroom buttons.
//
// Press / hover / shadow + the EKG sweep keyframe live in globals.css
// (`.checkup-btn`, `ekgSweep`); the badge reuses the shared `heartbeat` /
// `sleepGlow` motion primitives.

import { IconStethoscope } from '@/components/PixelIcons'

type CheckupState = 'check' | 'checking'

interface Props {
  state: CheckupState
  onClick: () => void
  disabled?: boolean
}

const PIXEL_FONT = '"Press Start 2P", monospace'

// Clinic-green palette. INK is the border + hard pixel drop shadow.
const HI = '#5BCD6B'
const MID = '#43A047'
const LO = '#2E7D32'
const INK = '#0E3D17'
const TEXT = '#F1FFF3'
const RIVET = '#FCD34D'
const MINT = '#86EFAC' // EKG trace
const SCREEN = '#0C2E14' // monitor screen

// Gold rivets tucked into the four inner corners.
const RIVETS = [
  { left: 6, top: 6 },
  { right: 6, top: 6 },
  { left: 6, bottom: 6 },
  { right: 6, bottom: 6 },
]

const LABEL: Record<CheckupState, string> = {
  check: 'CHECK UP',
  checking: 'EXAMINING...',
}

export default function CheckupButton({ state, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Give Eren a check-up"
      className="checkup-btn relative w-full max-w-xs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        background: `linear-gradient(180deg, ${HI} 0%, ${MID} 52%, ${LO} 100%)`,
        border: `3px solid ${INK}`,
        borderRadius: 9,
        color: TEXT,
      }}
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

      {/* ── Stethoscope medallion (left) ── */}
      <StethoscopeBadge />

      {/* ── Label (center) ── */}
      <span
        style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: PIXEL_FONT,
          fontSize: 11,
          lineHeight: 1,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
          textShadow: `0 2px 0 ${INK}`,
        }}
      >
        {LABEL[state]}
      </span>

      {/* ── EKG heart-monitor (right) ── */}
      <EkgMonitor />
    </button>
  )
}

// A round white clinic badge holding the pixel stethoscope, thumping gently
// like a heartbeat over a soft mint halo.
function StethoscopeBadge() {
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
          boxShadow: '0 0 8px 2px rgba(134,239,172,0.6)',
          animation: 'sleepGlow 3.2s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 35%, #FFFFFF, #E6F7EA)',
          border: `2px solid ${LO}`,
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'heartbeat 1.6s ease-in-out infinite',
        }}
      >
        <IconStethoscope size={20} />
      </span>
    </span>
  )
}

// A tiny heart-monitor: a dark screen with a mint EKG trace and a translucent
// blip sweeping left-to-right on a loop, like a vitals readout.
function EkgMonitor() {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 34,
        height: 22,
        borderRadius: 3,
        background: SCREEN,
        border: `1px solid ${LO}`,
        overflow: 'hidden',
        boxShadow: 'inset 0 0 4px rgba(0,0,0,0.6)',
      }}
    >
      <svg
        width="34"
        height="22"
        viewBox="0 0 34 22"
        style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 0 1px #86EFAC)' }}
      >
        <polyline
          points="0,12 7,12 10,12 12,4 14,18 16,12 23,12 26,9 34,12"
          fill="none"
          stroke={MINT}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          background: 'linear-gradient(90deg, rgba(134,239,172,0) 0%, rgba(134,239,172,0.5) 100%)',
          animation: 'ekgSweep 1.8s linear infinite',
        }}
      />
    </span>
  )
}
