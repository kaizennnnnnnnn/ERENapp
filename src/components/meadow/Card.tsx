'use client'

// ─── Card + SectionLabel ─────────────────────────────────────────────────────
// In-app cards are white, radius 22, and have NO border and NO shadow: the
// section ground around them does the separating. On a white ground (the
// onboarding, a sheet) use `outlined`, which swaps in the 2px hairline.
// Stack cards with 12px gaps; start a new group with a SectionLabel.

import Link from 'next/link'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { FONT_ROUNDED, M, TYPE } from './tokens'
import { TextButton } from './Buttons'

export interface CardProps {
  children: ReactNode
  /** CSS padding. Default '16px 18px' (18 all round when outlined). */
  padding?: CSSProperties['padding']
  /** On a white ground: 2px hairline border instead of relying on the ground. */
  outlined?: boolean
  /** Make the whole card a link (the A3 note board) ... */
  href?: string
  /** ... or a button. */
  onClick?: MouseEventHandler<HTMLElement>
  ariaLabel?: string
  className?: string
  style?: CSSProperties
}

export function Card({ children, padding, outlined, href, onClick, ariaLabel, className, style }: CardProps) {
  const css: CSSProperties = {
    display: 'block',
    boxSizing: 'border-box',
    borderRadius: 22,
    background: '#FFFFFF',
    border: outlined ? `2px solid ${M.hairline}` : 0,
    padding: padding ?? (outlined ? 18 : '16px 18px'),
    color: M.text,
    textDecoration: 'none',
    ...style,
  }
  if (href) {
    return (
      <Link href={href} onClick={onClick} aria-label={ariaLabel} className={`m-press m-focus ${className ?? ''}`} style={css}>
        {children}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel}
        className={`m-press m-focus ${className ?? ''}`}
        style={{ width: '100%', textAlign: 'left', fontFamily: FONT_ROUNDED, cursor: 'pointer', ...css }}>
        {children}
      </button>
    )
  }
  return <div className={className} style={css}>{children}</div>
}

// ─── SectionLabel ────────────────────────────────────────────────────────────

export interface SectionLabelProps {
  children: ReactNode
  /** A green link on the right ("See all 16 >"). Switches to the 44px row layout. */
  action?: { label: string; href?: string; onClick?: MouseEventHandler<HTMLElement>; ariaLabel?: string }
  /** Quiet text on the right ("Resets in 4d 7h"). Also uses the 44px row layout. */
  trailing?: ReactNode
  /** Drop the space above (the first label under a title row). */
  flush?: boolean
  /** Heading level for screen readers; the look never changes. */
  as?: 'h2' | 'h3' | 'div'
  id?: string
  style?: CSSProperties
}

const LABEL_TEXT: CSSProperties = { ...TYPE.label, color: M.label, margin: 0 }

/**
 * The small uppercase group label. Plain: 24px above, 8px below (A2 "Your
 * cat"). With an action or trailing text it becomes a 44px row with 12px above
 * (A2 "Achievements ... See all 16"), exactly as the boards space them.
 */
export function SectionLabel({ children, action, trailing, flush, as = 'h2', id, style }: SectionLabelProps) {
  const Tag = as
  if (action || trailing) {
    return (
      <div style={{
        marginTop: flush ? 0 : 12, height: 44, padding: '0 0 0 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...style,
      }}>
        <Tag id={id} style={LABEL_TEXT}>{children}</Tag>
        {action ? (
          <TextButton href={action.href} onClick={action.onClick} ariaLabel={action.ariaLabel}
            size={14} chevron style={{ padding: '0 4px 0 8px', gap: 2 }}>
            {action.label}
          </TextButton>
        ) : (
          <span style={{ paddingRight: 8, fontSize: 13, fontWeight: 700, color: M.label, fontVariantNumeric: 'tabular-nums' }}>
            {trailing}
          </span>
        )}
      </div>
    )
  }
  return (
    <Tag id={id} style={{ ...LABEL_TEXT, marginTop: flush ? 0 : 24, padding: '0 8px 8px', ...style }}>
      {children}
    </Tag>
  )
}

/** A 1px divider for use inside a white card (#F0EDE7). */
export function Divider({ inset = 0, style }: { inset?: number; style?: CSSProperties }) {
  return <div aria-hidden style={{ height: 1, marginLeft: inset, background: M.divider, ...style }} />
}
