'use client'

// ─── Meadow buttons ──────────────────────────────────────────────────────────
// One leaf-green lipped PrimaryButton per screen; a soft SecondaryButton for
// the quieter action; TextButton for links like "Not now"; RoundButton for the
// 44px circles (back, gear, shuffle). Every one renders a Next <Link> when
// given `href`, else a <button type="button">.
//
// The lip is a solid offset shadow driven by .m-lip in globals.css, so a press
// sinks the face half the lip height instead of fading or scaling.

import Link from 'next/link'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { FONT_ROUNDED, M } from './tokens'

type Variant = 'primary' | 'secondary' | 'danger' | 'dark'
type Size = 'lg' | 'md' | 'sm'

const FACE: Record<Variant, { bg: string; lip: string; ink: string }> = {
  primary:   { bg: M.leaf, lip: M.leafLip, ink: '#FFFFFF' },
  secondary: { bg: M.soft, lip: M.softLip, ink: M.text },
  danger:    { bg: M.danger, lip: '#932F26', ink: '#FFFFFF' },
  dark:      { bg: M.text, lip: '#000000', ink: '#FFFFFF' },
}

// lg = the pinned onboarding/primary button (54 tall), md = in-card action
// (A5 "Play", 46), sm = compact (A2 "Edit", 44 with a 3px lip).
const SIZE: Record<Size, { height: number; radius: number; font: number; padX: number; lip: number; gap: number }> = {
  lg: { height: 54, radius: 16, font: 17, padX: 20, lip: 4, gap: 10 },
  md: { height: 46, radius: 14, font: 16, padX: 26, lip: 4, gap: 8 },
  sm: { height: 44, radius: 14, font: 15, padX: 18, lip: 3, gap: 8 },
}

export interface ButtonProps {
  children: ReactNode
  /** Renders a Next Link instead of a button. */
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  /** A leading icon: a node, e.g. <MeadowIcon name="heart" mono color="#fff" />. */
  icon?: ReactNode
  size?: Size
  /** Stretch to the container width. Default true for lg, false otherwise. */
  full?: boolean
  disabled?: boolean
  /** Shows the label dimmed and blocks taps while an action is in flight. */
  busy?: boolean
  type?: 'button' | 'submit'
  ariaLabel?: string
  className?: string
  style?: CSSProperties
}

function LippedButton({
  variant, children, href, onClick, icon, size = 'lg', full, disabled, busy,
  type = 'button', ariaLabel, className, style,
}: ButtonProps & { variant: Variant }) {
  const face = FACE[variant]
  const s = SIZE[size]
  const inert = disabled || busy
  const css = {
    '--m-lip': face.lip,
    '--m-lip-h': `${s.lip}px`,
    width: (full ?? size === 'lg') ? '100%' : undefined,
    height: s.height,
    boxSizing: 'border-box',
    padding: `0 ${s.padX}px`,
    border: 0,
    borderRadius: s.radius,
    background: face.bg,
    color: face.ink,
    fontFamily: FONT_ROUNDED,
    fontSize: s.font,
    fontWeight: 800,
    lineHeight: 1.2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    textDecoration: 'none',
    cursor: inert ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : busy ? 0.75 : 1,
    whiteSpace: 'nowrap',
    ...style,
  } as CSSProperties
  const cls = `m-lip m-focus ${className ?? ''}`
  const body = <>{icon}{children}</>

  if (href && !inert) {
    return (
      <Link href={href} onClick={onClick} aria-label={ariaLabel} className={cls} style={css}>
        {body}
      </Link>
    )
  }
  return (
    <button
      type={type}
      onClick={inert ? undefined : onClick}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      className={cls}
      style={css}
    >
      {body}
    </button>
  )
}

export function PrimaryButton(props: ButtonProps) {
  return <LippedButton variant="primary" {...props} />
}

export function SecondaryButton(props: ButtonProps) {
  return <LippedButton variant="secondary" {...props} />
}

/** Red lipped button for the one irreversible confirm (delete account, leave home). */
export function DangerButton(props: ButtonProps) {
  return <LippedButton variant="danger" {...props} />
}

// ─── TextButton ──────────────────────────────────────────────────────────────

export interface TextButtonProps {
  children: ReactNode
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  /** 'leaf' = the green link ("I have an invite code"); 'muted' = "Not now". */
  tone?: 'leaf' | 'muted' | 'danger'
  icon?: ReactNode
  /** Put a small chevron after the label (A2 "See all 16 >"). */
  chevron?: boolean
  size?: number
  disabled?: boolean
  ariaLabel?: string
  className?: string
  style?: CSSProperties
}

const TEXT_TONE = { leaf: M.leaf, muted: M.text2, danger: M.danger } as const

export function TextButton({
  children, href, onClick, tone = 'leaf', icon, chevron, size = 15, disabled, ariaLabel, className, style,
}: TextButtonProps) {
  const ink = TEXT_TONE[tone]
  const css: CSSProperties = {
    minHeight: 44,
    padding: '0 8px',
    border: 0,
    background: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontFamily: FONT_ROUNDED,
    fontSize: size,
    fontWeight: tone === 'muted' ? 700 : 800,
    color: ink,
    textDecoration: 'none',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
    ...style,
  }
  const body = (
    <>
      {icon}
      {children}
      {chevron && <MeadowIcon name="chevronRight" size={size + 4} color={ink} style={{ marginLeft: -4 }} />}
    </>
  )
  const cls = `m-press m-focus ${className ?? ''}`
  if (href && !disabled) {
    return <Link href={href} onClick={onClick} aria-label={ariaLabel} className={cls} style={css}>{body}</Link>
  }
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled}
      aria-label={ariaLabel} className={cls} style={css}>
      {body}
    </button>
  )
}

// ─── RoundButton ─────────────────────────────────────────────────────────────

export interface RoundButtonProps {
  children: ReactNode
  /** Required: these buttons are icons only. */
  ariaLabel: string
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  /**
   * What it sits on. 'ground' = white with a faint lip on a section colour (the
   * A2 gear, A4 back); 'white' = soft grey, no lip, on white (onboarding back);
   * 'art' = white with the over-art lip on room art; 'stage' = white with the
   * soft lip on the grey stage (Shuffle).
   */
  surface?: 'ground' | 'white' | 'art' | 'stage'
  size?: number
  expanded?: boolean
  className?: string
  style?: CSSProperties
}

const ROUND_SURFACE = {
  ground: { bg: '#FFFFFF', lip: M.groundLip },
  white: { bg: M.soft, lip: null },
  art: { bg: '#FFFFFF', lip: M.overArtLip },
  stage: { bg: '#FFFFFF', lip: M.softLip },
} as const

export function RoundButton({
  children, ariaLabel, href, onClick, surface = 'ground', size = 44, expanded, className, style,
}: RoundButtonProps) {
  const s = ROUND_SURFACE[surface]
  const css = {
    ...(s.lip ? { '--m-lip': s.lip, '--m-lip-h': '3px' } : {}),
    width: size,
    height: size,
    flexShrink: 0,
    padding: 0,
    border: 0,
    borderRadius: 999,
    background: s.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
    ...style,
  } as CSSProperties
  const cls = `${s.lip ? 'm-lip' : 'm-press'} m-focus ${className ?? ''}`
  if (href) {
    return <Link href={href} onClick={onClick} aria-label={ariaLabel} className={cls} style={css}>{children}</Link>
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} aria-expanded={expanded}
      className={cls} style={css}>
      {children}
    </button>
  )
}

/**
 * The 44px back circle. Give it the PARENT route as `href`, never rely on
 * router.back(): a page opened from a push notification has no history, and a
 * back() there does nothing (see /hallway's fix).
 */
export function BackButton({ href, onClick, surface = 'ground', label = 'Back' }: {
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  surface?: RoundButtonProps['surface']
  label?: string
}) {
  return (
    <RoundButton ariaLabel={label} href={href} onClick={onClick} surface={surface}>
      <MeadowIcon name="chevronLeft" color={M.text} />
    </RoundButton>
  )
}
