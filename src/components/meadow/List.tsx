'use client'

// ─── Grouped lists (Settings) ────────────────────────────────────────────────
// ListGroup is one white card; ListRow is a 52px row inside it. Dividers are
// inserted between rows for you (inset past the icon tile when rows have
// icons). A row is a Link with `href`, a button with `onClick`, and a plain
// row when it only holds a Toggle or a trailing control.

import Link from 'next/link'
import { Children, Fragment, isValidElement, type CSSProperties, type MouseEventHandler, type ReactElement, type ReactNode } from 'react'
import { MeadowIcon, type MeadowIconName } from '@/components/PixelIcons'
import { Toggle, type ToggleProps } from './Controls'
import { FONT_ROUNDED, M } from './tokens'

// ─── IconTile ────────────────────────────────────────────────────────────────

export interface IconTileProps {
  icon: MeadowIconName
  /** Tile edge in px. 36 in list rows; 44-68 for card headers and game tiles. */
  size?: number
  bg?: string
  color?: string
  mono?: boolean
  iconSize?: number
  radius?: number
  style?: CSSProperties
}

/** A rounded square with one pixel icon centred in it. */
export function IconTile({ icon, size = 36, bg = M.soft, color, mono, iconSize, radius, style }: IconTileProps) {
  // The boards' radii for each tile size: 36->11, 44->14, 48->16, 52->16, 60->18, 68->20.
  const r = radius ?? (size <= 36 ? 11 : size <= 40 ? 12 : size <= 44 ? 14 : size <= 52 ? 16 : size <= 60 ? 18 : 20)
  const is = iconSize ?? (size >= 60 ? 36 : 24)
  return (
    <span aria-hidden style={{
      width: size, height: size, flexShrink: 0, borderRadius: r, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
    }}>
      <MeadowIcon name={icon} size={is} color={color} mono={mono} />
    </span>
  )
}

// ─── ListRow ─────────────────────────────────────────────────────────────────

export interface ListRowProps {
  label: ReactNode
  /** Small grey line under the label (the row grows to fit). */
  sublabel?: ReactNode
  /** A Meadow icon drawn in a 36px soft tile, or any node (an Avatar). */
  icon?: MeadowIconName | ReactNode
  /** Right-aligned quiet value ("Partner", "3"). */
  value?: ReactNode
  /** Grey chevron at the end. Defaults to true for href / onClick rows. */
  chevron?: boolean
  /** A switch at the end; the row itself is then not tappable. */
  toggle?: Omit<ToggleProps, 'ariaLabel'> & { ariaLabel?: string }
  /** Any control at the end (a copy button). */
  trailing?: ReactNode
  /** Red label and a red-tinted tile (Delete account). */
  destructive?: boolean
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  disabled?: boolean
  ariaLabel?: string
}

export function ListRow({
  label, sublabel, icon, value, chevron, toggle, trailing, destructive, href, onClick, disabled, ariaLabel,
}: ListRowProps) {
  const tappable = !toggle && !disabled && (href !== undefined || onClick !== undefined)
  const showChevron = chevron ?? tappable
  const ink = destructive ? M.danger : M.text
  const iconNode = typeof icon === 'string'
    ? <IconTile icon={icon as MeadowIconName} bg={destructive ? M.dangerTint : M.soft} color={destructive ? M.danger : M.text2} />
    : icon
  // Rows with a switch keep 16px on the right (the board); rows that end in a
  // 44px control give it the room instead.
  const padRight = toggle ? 16 : trailing ? 4 : 12
  const css: CSSProperties = {
    width: '100%', minHeight: 52, boxSizing: 'border-box',
    padding: `${sublabel ? 8 : 0}px ${padRight}px ${sublabel ? 8 : 0}px ${icon ? 12 : 16}px`,
    border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 12,
    fontFamily: FONT_ROUNDED, fontSize: 16, fontWeight: 700, color: ink, textAlign: 'left',
    textDecoration: 'none', cursor: tappable ? 'pointer' : 'default', opacity: disabled ? 0.45 : 1,
  }
  const body = (
    <>
      {iconNode}
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>{label}</span>
        {sublabel && <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, color: M.text2 }}>{sublabel}</span>}
      </span>
      {value !== undefined && value !== null && (
        <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 500, color: M.text2 }}>{value}</span>
      )}
      {trailing}
      {toggle && (
        <Toggle {...toggle} ariaLabel={toggle.ariaLabel ?? (typeof label === 'string' ? label : 'Toggle')} />
      )}
      {showChevron && <MeadowIcon name="chevronRight" size={20} color={M.faint} />}
    </>
  )
  if (tappable && href) {
    return <Link href={href} onClick={onClick} aria-label={ariaLabel} className="m-focus" style={css}>{body}</Link>
  }
  if (tappable) {
    return <button type="button" onClick={onClick} aria-label={ariaLabel} className="m-focus" style={css}>{body}</button>
  }
  return <div style={css}>{body}</div>
}

// ─── ListGroup ───────────────────────────────────────────────────────────────

export function ListGroup({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement[]
  // Dividers start at the label: past the 36px tile (12 + 36 + 12) when the
  // rows carry icons, else at the 16px text inset.
  const hasIcons = rows.some(r => (r.props as { icon?: unknown }).icon)
  const inset = hasIcons ? 60 : 16
  return (
    <div style={{ borderRadius: 22, background: '#FFFFFF', overflow: 'hidden', ...style }}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 && <div aria-hidden style={{ height: 1, marginLeft: inset, background: M.divider }} />}
          {row}
        </Fragment>
      ))}
    </div>
  )
}
