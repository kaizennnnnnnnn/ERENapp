'use client'

// ─── Chips, tags, check disc, swatches ───────────────────────────────────────
// Chip   = a tappable pill that can be selected (name ideas, part tabs).
// Tag    = a static label pill (rarity, "Boy", "2 new"). Tags, never glows.
// CheckDisc = the leaf disc with a white check that marks a selection.
// Swatch = a round colour button (fur colours, accent colours).

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { FONT_ROUNDED, M, RARITY_TAG } from './tokens'

export interface ChipProps {
  children: ReactNode
  selected?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  icon?: ReactNode
  disabled?: boolean
  ariaLabel?: string
  style?: CSSProperties
}

/** 36px pill. Selected: leaf ring on leaf tint with dark-leaf ink. */
export function Chip({ children, selected, onClick, icon, disabled, ariaLabel, style }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="m-press m-focus"
      style={{
        height: 36,
        boxSizing: 'border-box',
        padding: '0 14px',
        border: `2px solid ${selected ? M.leaf : M.hairline}`,
        borderRadius: 999,
        background: selected ? M.leafTint : '#FFFFFF',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: FONT_ROUNDED,
        fontSize: 14,
        fontWeight: selected ? 800 : 700,
        color: selected ? M.leafInk : M.text,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

const TAG_TONE = {
  ...RARITY_TAG,
  soft: { bg: M.soft, ink: M.text },
  leaf: { bg: M.leafTint, ink: M.leafInk },
  amber: { bg: M.energyTint, ink: '#8A5A12' },
  love: { bg: M.love, ink: '#FFFFFF' },
} as const
export type TagTone = keyof typeof TAG_TONE

export interface TagProps {
  children: ReactNode
  /** common / rare / epic / legendary for rarity; soft ("Boy"), leaf, amber, love ("2 new"). */
  tone?: TagTone
  /** md = 28px (default), sm = 22px (the achievement shelf). */
  size?: 'md' | 'sm'
  /** Uppercase, tracked, 800: the rarity style. Off for words like "Boy". */
  caps?: boolean
  icon?: ReactNode
  style?: CSSProperties
}

export function Tag({ children, tone = 'soft', size = 'md', caps = false, icon, style }: TagProps) {
  const t = TAG_TONE[tone]
  const sm = size === 'sm'
  return (
    <span style={{
      height: sm ? 22 : 28,
      boxSizing: 'border-box',
      padding: sm ? '0 8px' : icon ? '0 10px 0 7px' : '0 10px',
      borderRadius: 999,
      background: t.bg,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: caps ? (sm ? 11 : 12) : 13,
      fontWeight: caps ? 800 : 700,
      letterSpacing: caps ? '0.04em' : undefined,
      textTransform: caps ? 'uppercase' : undefined,
      color: t.ink,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      ...style,
    }}>
      {icon}
      {children}
    </span>
  )
}

/**
 * The 24px leaf disc with a white pixel check. `corner` pins it to a tile's
 * top-right corner with a 2px white ring (position the parent relative).
 */
export function CheckDisc({ size = 24, corner = false, style }: { size?: number; corner?: boolean; style?: CSSProperties }) {
  return (
    <span aria-hidden style={{
      width: size,
      height: size,
      boxSizing: 'border-box',
      borderRadius: 999,
      background: M.leaf,
      border: corner ? '2px solid #FFFFFF' : undefined,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...(corner ? { position: 'absolute', right: -7, top: -7 } : {}),
      ...style,
    }}>
      <MeadowIcon name="check8" size={Math.round(size * 0.58)} />
    </span>
  )
}

export interface SwatchProps {
  color: string
  label: string
  selected?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  /** 40 for fur (default), 34 for the accent row. */
  size?: number
  /** Faint 2px edge so white and cream swatches don't vanish on white. Default true. */
  edged?: boolean
  role?: 'radio'
}

/** Selected = a white gap then a leaf ring, drawn as two hard box-shadows. */
export function Swatch({ color, label, selected, onClick, size = 40, edged = true, role }: SwatchProps) {
  return (
    <button
      type="button"
      role={role}
      aria-label={label}
      aria-pressed={role ? undefined : selected}
      aria-checked={role ? selected : undefined}
      onClick={onClick}
      className="m-focus"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        padding: 0,
        boxSizing: 'border-box',
        border: edged ? '2px solid rgba(47, 43, 40, 0.10)' : 0,
        borderRadius: 999,
        background: color,
        boxShadow: selected ? `0 0 0 3px #FFFFFF, 0 0 0 5px ${M.leaf}` : 'none',
        cursor: 'pointer',
      }}
    />
  )
}
