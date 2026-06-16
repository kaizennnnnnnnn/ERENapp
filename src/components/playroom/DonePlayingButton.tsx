'use client'

// The playroom's "DONE PLAYING" button — a playful slab dressed with cat-play
// props: a cream medallion stamped with a pink paw on the left, and the room's
// own pink ball bouncing (with a squash + ground shadow) on the right. It turns
// green for the "GREAT SESSION!" finish, and fades while still locked (no
// throws yet). Gold rivets, a glossy gradient, a hard drop shadow, and a springy
// designed press match the chemistry / bedroom / vet buttons.
//
// Press / hover / shadow + the ball bounce/shadow keyframes live in globals.css
// (`.play-btn`, `playBounce`, `playShadow`); the paw badge reuses the shared
// `sleepBob` / `sleepGlow` primitives. The hard drop-shadow colour is themed
// (purple play / green done) via the inline `--play-ink` custom property.

import { IconPaw } from '@/components/PixelIcons'

type PlayState = 'locked' | 'ready' | 'saving' | 'done'

interface Props {
  state: PlayState
  onClick: () => void
  disabled?: boolean
}

const PIXEL_FONT = '"Press Start 2P", monospace'

// Playful purple for the active session; green for the finish. INK is the
// border + hard pixel drop shadow.
const PURPLE = { hi: '#C99CFA', mid: '#A855F7', lo: '#7C3AED', ink: '#3B1A6E', text: '#FBF5FF' }
const GREEN = { hi: '#86EFAC', mid: '#4ADE80', lo: '#16A34A', ink: '#0F3D17', text: '#F0FFF4' }
const RIVET = '#FCD34D'

// Gold rivets tucked into the four inner corners.
const RIVETS = [
  { left: 6, top: 6 },
  { right: 6, top: 6 },
  { left: 6, bottom: 6 },
  { right: 6, bottom: 6 },
]

const LABEL: Record<PlayState, string> = {
  locked: 'DONE PLAYING',
  ready: 'DONE PLAYING',
  saving: 'SAVING...',
  done: 'GREAT SESSION!',
}

export default function DonePlayingButton({ state, onClick, disabled }: Props) {
  const p = state === 'done' ? GREEN : PURPLE

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Finish the play session"
      className="play-btn relative w-full max-w-xs"
      style={{
        '--play-ink': p.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        background: `linear-gradient(180deg, ${p.hi} 0%, ${p.mid} 52%, ${p.lo} 100%)`,
        border: `3px solid ${p.ink}`,
        borderRadius: 9,
        color: p.text,
        // Locked (no throws yet) fades to read as "not ready" without changing
        // the slab's hue.
        opacity: state === 'locked' ? 0.55 : 1,
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
            boxShadow: `1px 1px 0 ${p.ink}`,
          }}
        />
      ))}

      {/* ── Paw medallion (left) ── */}
      <PawBadge />

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
          textShadow: `0 2px 0 ${p.ink}`,
        }}
      >
        {LABEL[state]}
      </span>

      {/* ── Bouncing ball (right) ── */}
      <BouncingBall />
    </button>
  )
}

// A round cream badge stamped with the pink pixel paw, bobbing gently over a
// soft purple halo.
function PawBadge() {
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
          boxShadow: '0 0 8px 2px rgba(192,132,252,0.6)',
          animation: 'sleepGlow 3.2s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 35%, #FFFFFF, #F3E8FF)',
          border: '2px solid #7C3AED',
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'sleepBob 3s ease-in-out infinite',
        }}
      >
        <IconPaw size={18} />
      </span>
    </span>
  )
}

// The room's pink ball, bouncing with a squash on contact and a ground shadow
// that widens and darkens as it lands.
function BouncingBall() {
  return (
    <span
      aria-hidden
      style={{ position: 'relative', flexShrink: 0, width: 30, height: 34, display: 'inline-block' }}
    >
      <span
        style={{
          position: 'absolute',
          bottom: 3,
          left: '50%',
          width: 16,
          height: 4,
          marginLeft: -8,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.4)',
          animation: 'playShadow 1.1s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: 7,
          left: '50%',
          width: 15,
          height: 15,
          marginLeft: -7.5,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #FF9EC8, #FF3E80)',
          border: '1.5px solid #CC1A55',
          boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.55)',
          transformOrigin: 'bottom center',
          animation: 'playBounce 1.1s ease-in-out infinite',
        }}
      />
    </span>
  )
}
