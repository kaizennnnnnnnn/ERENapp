'use client'

// ─── Read-outs ───────────────────────────────────────────────────────────────
// Meter, LevelRing, CoinChip, StatTile and Avatar: the pieces that show a
// number or a person. Numbers are always 800 with tabular figures so they
// don't jitter as they change.

import Link from 'next/link'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { FONT_ROUNDED, M, TYPE } from './tokens'

// ─── Meter ───────────────────────────────────────────────────────────────────

export interface MeterProps {
  /** 0..1 (clamped). */
  value: number
  /** Leaf for "fine", energy amber for the one low need, love for streak splits. */
  color?: string
  height?: number
  width?: CSSProperties['width']
  track?: string
  /** When given, the meter is announced as a progressbar with this name. */
  label?: string
  style?: CSSProperties
}

export function Meter({ value, color = M.leaf, height = 8, width = '100%', track = M.track, label, style }: MeterProps) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <span
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block', width, height, borderRadius: 999, background: track, overflow: 'hidden', flexShrink: 0, ...style }}
    >
      <span style={{ display: 'block', width: `${v * 100}%`, height, borderRadius: 999, background: color }} />
    </span>
  )
}

// ─── LevelRing ───────────────────────────────────────────────────────────────

export interface LevelRingProps {
  level: number
  /** Progress through the current level, 0..1. */
  progress: number
  size?: number
  /** 'art' = over room art (hard over-art lip); 'white' = on white (hairline ring); 'ground' = plain. */
  surface?: 'art' | 'white' | 'ground'
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  /** e.g. "Level 17, 650 of 1700 XP". Defaults to "Level N". */
  ariaLabel?: string
  style?: CSSProperties
}

/** The level number inside a thin leaf progress ring (the home header avatar). */
export function LevelRing({ level, progress, size = 48, surface = 'art', href, onClick, ariaLabel, style }: LevelRingProps) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))
  const stroke = 4
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const shadow = surface === 'art' ? `0 3px 0 ${M.overArtLip}` : surface === 'white' ? `0 0 0 2px ${M.hairline}` : 'none'
  const css: CSSProperties = {
    position: 'relative', width: size, height: size, flexShrink: 0, borderRadius: 999, background: '#FFFFFF',
    boxShadow: shadow, display: 'flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', color: M.text, padding: 0, border: 0, fontFamily: FONT_ROUNDED,
    cursor: href || onClick ? 'pointer' : undefined, ...style,
  }
  const body = (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ position: 'absolute', left: 0, top: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={M.track} strokeWidth={stroke} />
        {p > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={M.leaf} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${(c * p).toFixed(1)} ${c.toFixed(1)}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </svg>
      <span style={{ position: 'relative', fontSize: Math.round(size * 0.354), lineHeight: 1, ...TYPE.number }}>{level}</span>
    </>
  )
  const label = ariaLabel ?? `Level ${level}`
  if (href) return <Link href={href} onClick={onClick} aria-label={label} className="m-press m-focus" style={css}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} aria-label={label} className="m-press m-focus" style={css}>{body}</button>
  return <span role="img" aria-label={label} style={css}>{body}</span>
}

// ─── CoinChip ────────────────────────────────────────────────────────────────

export interface CoinChipProps {
  amount: number | null
  /** 'art' = over room art (lip); 'ground' = plain white on a section colour; 'white' = hairline on white. */
  surface?: 'art' | 'ground' | 'white'
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  style?: CSSProperties
}

/** Coin + balance pill. `amount` null (not loaded) shows a dash, never a confident 0. */
export function CoinChip({ amount, surface = 'ground', href, onClick, style }: CoinChipProps) {
  const text = amount === null ? '-' : amount.toLocaleString('en-US').replace(/,/g, ' ')
  const css: CSSProperties = {
    height: 40, boxSizing: 'border-box', padding: '0 16px 0 9px', borderRadius: 999, background: '#FFFFFF',
    boxShadow: surface === 'art' ? `0 3px 0 ${M.overArtLip}` : 'none',
    border: surface === 'white' ? `2px solid ${M.hairline}` : 0,
    display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: M.text,
    fontFamily: FONT_ROUNDED, fontSize: 17, ...TYPE.number, flexShrink: 0,
    cursor: href || onClick ? 'pointer' : undefined, ...style,
  }
  const label = amount === null ? 'Coins loading' : `${amount} coins`
  const body = <><MeadowIcon name="coin" />{text}</>
  if (href) return <Link href={href} onClick={onClick} aria-label={label} className="m-press m-focus" style={css}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} aria-label={label} className="m-press m-focus" style={css}>{body}</button>
  return <span role="img" aria-label={label} style={css}>{body}</span>
}

// ─── StatTile ────────────────────────────────────────────────────────────────

export interface StatTileProps {
  label: string
  /** The big number; compose units with <StatUnit>. */
  value: ReactNode
  /** Grey line at the bottom ("650 / 1700 XP", "days in a row"). */
  footer?: ReactNode
  /** A meter above the footer (the XP bar). */
  meter?: { value: number; color?: string; label?: string }
  height?: number
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  style?: CSSProperties
}

/** The A2 2x2 stat card: uppercase label, a 36px number, a meter and/or footer pinned low. */
export function StatTile({ label, value, footer, meter, height = 132, href, onClick, style }: StatTileProps) {
  const css: CSSProperties = {
    height, boxSizing: 'border-box', borderRadius: 22, background: '#FFFFFF', padding: '16px 18px',
    display: 'flex', flexDirection: 'column', textAlign: 'left', color: M.text, textDecoration: 'none',
    border: 0, fontFamily: FONT_ROUNDED, width: '100%', ...style,
  }
  const body = (
    <>
      <span style={{ ...TYPE.label, color: M.label }}>{label}</span>
      {/* Baseline row with no gap, so 11<StatUnit>h</StatUnit>55 sets like the
          board. An icon after the number wants alignSelf: 'center' + a margin. */}
      <span style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', fontSize: 36, lineHeight: 1.1, ...TYPE.number }}>
        {value}
      </span>
      {meter && (
        <Meter value={meter.value} color={meter.color} label={meter.label} style={{ marginTop: 'auto' }} />
      )}
      {footer && (
        <span style={{
          marginTop: meter ? 6 : 'auto', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums',
        }}>
          {footer}
        </span>
      )}
    </>
  )
  if (href) return <Link href={href} onClick={onClick} className="m-press m-focus" style={css}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className="m-press m-focus" style={{ cursor: 'pointer', ...css }}>{body}</button>
  return <div style={css}>{body}</div>
}

/** The small unit inside a big number: 11<StatUnit>h</StatUnit>55<StatUnit last>m</StatUnit>. */
export function StatUnit({ children, last, size = 20, color }: { children: ReactNode; last?: boolean; size?: number; color?: string }) {
  return (
    <span style={{ fontSize: size, margin: last ? '0 0 0 2px' : '0 6px 0 2px', color }}>{children}</span>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export interface AvatarProps {
  /** The person's name; the first letter is drawn. */
  name: string | null | undefined
  /** Their household colour: personColor(profile.heart). */
  color: string
  size?: number
  /** A ring in the ground colour, for overlapping pairs (A3 header: 3px #F8DEDA). */
  ring?: string
  ringWidth?: number
  /** Defaults to 40% of the size. */
  fontSize?: number
  style?: CSSProperties
}

/** An initial in a filled circle. Decorative: put the name in nearby text or an aria-label. */
export function Avatar({ name, color, size = 44, ring, ringWidth = 3, fontSize, style }: AvatarProps) {
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?'
  return (
    <span aria-hidden style={{
      width: size, height: size, flexShrink: 0, boxSizing: 'border-box', borderRadius: 999, background: color,
      border: ring ? `${ringWidth}px solid ${ring}` : undefined,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT_ROUNDED, fontSize: fontSize ?? Math.round(size * 0.4), fontWeight: 800, color: '#FFFFFF', lineHeight: 1,
      ...style,
    }}>
      {initial}
    </span>
  )
}
