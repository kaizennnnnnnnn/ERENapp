'use client'

// The kitchen's bottom-bar Fridge / Shop buttons: white Meadow tiles sitting
// on the room art (the over-art lip, no glow), each with its pixel icon on a
// tinted disc — cold blue for the fridge, warm amber for the shop — and the
// word under it. Tiles, not pills: two side-by-side pills plus the carried
// food and its arrows overran a 360px phone. The shop's tile turns leaf
// while its drawer is open.

import { IconFridge, IconCart } from '@/components/PixelIcons'
import { FONT_ROUNDED, M, TINT } from '@/components/meadow'

type Variant = 'fridge' | 'shop'

interface Props {
  variant: Variant
  onClick: () => void
  disabled?: boolean
  active?: boolean // shop drawer open
  label?: string // overrides the default Fridge / Shop text
}

export default function KitchenNavButton({ variant, onClick, disabled, active, label }: Props) {
  const isFridge = variant === 'fridge'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isFridge ? 'Open the fridge' : active ? 'Close the shop' : 'Open the shop'}
      aria-expanded={isFridge ? undefined : !!active}
      className="m-lip m-focus flex-shrink-0"
      style={{
        '--m-lip': M.overArtLip,
        '--m-lip-h': '3px',
        width: 68, height: 68, boxSizing: 'border-box', padding: '6px 0 0', border: 0, borderRadius: 20,
        background: active ? M.leafTint : '#FFFFFF',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        fontFamily: FONT_ROUNDED, fontSize: 12, fontWeight: 800, lineHeight: 1.2,
        color: active ? M.leafInk : M.text,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      } as React.CSSProperties}
    >
      <span aria-hidden className="flex items-center justify-center" style={{
        width: 36, height: 36, borderRadius: 999, background: isFridge ? TINT.blue : TINT.amber,
      }}>
        {isFridge ? <IconFridge size={22} /> : <IconCart size={22} />}
      </span>
      {label ?? (isFridge ? 'Fridge' : 'Shop')}
    </button>
  )
}
