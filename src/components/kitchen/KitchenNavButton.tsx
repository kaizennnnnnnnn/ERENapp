'use client'

// The kitchen's bottom-bar FRIDGE / SHOP buttons — compact premium pixel pills
// matching the room-action buttons elsewhere. A light medallion holds the pixel
// fridge / cart icon (bobbing over a soft halo) with a small food-y accent: a
// cold snowflake twinkling on the fridge, a gold coin on the shop. Gold rivets,
// a glossy gradient, a hard drop shadow, and a springy designed press.
//
// Press / hover / shadow live in globals.css (`.kitchen-nav-btn`); motion
// reuses the shared `sleepBob` / `sleepGlow` / `sleepTwinkle` primitives. The
// hard drop-shadow colour is themed via the inline `--knav-ink` property.

import { IconFridge, IconCart } from '@/components/PixelIcons'

type Variant = 'fridge' | 'shop'

interface Props {
  variant: Variant
  onClick: () => void
  disabled?: boolean
  active?: boolean // shop drawer open
}

const PIXEL_FONT = '"Press Start 2P", monospace'

// Icy blue for the fridge, warm gold for the shop (deepened while the drawer is
// open). INK is the border + hard pixel drop shadow.
const FRIDGE = { hi: '#CDEBFF', mid: '#8FCBF2', lo: '#5BA3D9', ink: '#1A4E7A', text: '#0E3A5C', rivet: '#FFFFFF' }
const SHOP = { hi: '#FFE08A', mid: '#F5C842', lo: '#E8A020', ink: '#8A5410', text: '#5A3408', rivet: '#FFF6D0' }
const SHOP_OPEN = { ...SHOP, hi: '#E8A020', mid: '#D08810', lo: '#A86810' }

// Rivets tucked into the four inner corners (smaller — this is a compact pill).
const RIVETS = [
  { left: 4, top: 4 },
  { right: 4, top: 4 },
  { left: 4, bottom: 4 },
  { right: 4, bottom: 4 },
]

export default function KitchenNavButton({ variant, onClick, disabled, active }: Props) {
  const isFridge = variant === 'fridge'
  const p = isFridge ? FRIDGE : active ? SHOP_OPEN : SHOP

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isFridge ? 'Open the fridge' : 'Open the shop'}
      className="kitchen-nav-btn relative flex-shrink-0"
      style={{
        '--knav-ink': p.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 12px 7px 9px',
        background: `linear-gradient(180deg, ${p.hi} 0%, ${p.mid} 55%, ${p.lo} 100%)`,
        border: `2px solid ${p.ink}`,
        borderRadius: 11,
        color: p.text,
      } as React.CSSProperties}
    >
      {/* Corner rivets */}
      {RIVETS.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            ...pos,
            width: 2.5,
            height: 2.5,
            background: p.rivet,
            boxShadow: `1px 1px 0 ${p.ink}`,
          }}
        />
      ))}

      <IconBadge variant={variant} />

      <span
        style={{
          fontFamily: PIXEL_FONT,
          fontSize: 8,
          letterSpacing: 1,
          textShadow: '0 1px 0 rgba(255,255,255,0.4)',
        }}
      >
        {isFridge ? 'FRIDGE' : 'SHOP'}
      </span>
    </button>
  )
}

// Light medallion holding the pixel icon, bobbing over a soft halo, with a
// twinkling food-y accent at its corner.
function IconBadge({ variant }: { variant: Variant }) {
  const isFridge = variant === 'fridge'
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
          boxShadow: `0 0 6px 1.5px ${isFridge ? 'rgba(180,225,255,0.7)' : 'rgba(255,220,120,0.75)'}`,
          animation: 'sleepGlow 3.2s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: isFridge
            ? 'radial-gradient(circle at 50% 35%, #FFFFFF, #E6F4FF)'
            : 'radial-gradient(circle at 50% 35%, #FFFDF2, #FFF0C8)',
          border: `2px solid ${isFridge ? '#5BA3D9' : '#C88018'}`,
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'sleepBob 3s ease-in-out infinite',
        }}
      >
        {isFridge ? <IconFridge size={15} /> : <IconCart size={15} />}
        {isFridge ? <Snowflake /> : <Coin />}
      </span>
    </span>
  )
}

// A small four/diagonal-armed snowflake twinkling at the badge corner — "cold".
function Snowflake() {
  const arm = (style: React.CSSProperties) => (
    <span style={{ position: 'absolute', background: '#CFEBFF', borderRadius: 1, ...style }} />
  )
  return (
    <span
      aria-hidden
      style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, animation: 'sleepTwinkle 2.4s ease-in-out infinite' }}
    >
      {arm({ top: '50%', left: 0, right: 0, height: 1.5, transform: 'translateY(-50%)' })}
      {arm({ left: '50%', top: 0, bottom: 0, width: 1.5, transform: 'translateX(-50%)' })}
      {arm({ top: '50%', left: '50%', width: 8, height: 1.5, transform: 'translate(-50%,-50%) rotate(45deg)' })}
      {arm({ top: '50%', left: '50%', width: 8, height: 1.5, transform: 'translate(-50%,-50%) rotate(-45deg)' })}
    </span>
  )
}

// A small glinting gold coin at the badge corner — "buy".
function Coin() {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: -2,
        right: -3,
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, #FFE878, #D4A818)',
        border: '1px solid #A8780F',
        boxShadow: '1px 1px 0 rgba(0,0,0,0.2)',
      }}
    >
      <span style={{ position: 'absolute', top: 1.5, left: 2, width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.85)' }} />
    </span>
  )
}
