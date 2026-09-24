'use client'

// ─── MeadowPage ──────────────────────────────────────────────────────────────
// The shell every in-app Meadow page sits in (A2 Me, A3 Us, A4 Settings, A5
// Play): a flat, full-bleed section colour, 16px side margins, and the title
// row the boards share. Content below it is yours: cards with 12px gaps,
// SectionLabels between groups.
//
// Title row, two shapes:
//   no `back`:  [ h1 Title ................. action ]       (Me, Us, Play)
//   `back`:     [ (<) .......................  action ]    (Settings, pushed
//               h1 Title                                    from another page)
//
// The bottom is padded to clear the BottomNav when the page shows it
// (`withNav`, default on). The nav's visibility itself is decided by the nav
// (routes + useHideBottomNav), not here.

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { BackButton } from './Buttons'
import { GROUND, M, NAV_PAGE_PADDING, TYPE, type GroundName } from './tokens'

export interface MeadowPageProps {
  /** A section name (us / me / settings / play / white) or any colour. */
  ground?: GroundName | (string & {})
  title?: ReactNode
  /** Shows the 44px back circle above the title. Pass the PARENT route. */
  back?: { href?: string; onClick?: MouseEventHandler<HTMLElement>; label?: string }
  /** Right side of the title row: a RoundButton (gear), a CoinChip, avatars. */
  action?: ReactNode
  /** Pad the bottom to clear the nav. Default true. */
  withNav?: boolean
  children: ReactNode
  /** id for the h1, e.g. to label a region. */
  titleId?: string
  style?: CSSProperties
}

export function MeadowPage({
  ground = 'white', title, back, action, withNav = true, children, titleId, style,
}: MeadowPageProps) {
  const bg = (GROUND as Record<string, string>)[ground] ?? ground
  const h1: CSSProperties = { ...TYPE.title, margin: 0, color: M.text }
  return (
    <div className="meadow-page" style={{
      background: bg,
      paddingBottom: withNav ? NAV_PAGE_PADDING : 'calc(32px + env(safe-area-inset-bottom, 0px))',
      ...style,
    }}>
      {back ? (
        <>
          <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <BackButton href={back.href} onClick={back.onClick} label={back.label} />
            {action}
          </div>
          {title !== undefined && (
            <h1 id={titleId} style={{ ...h1, marginTop: 12, paddingLeft: 8 }}>{title}</h1>
          )}
        </>
      ) : (title !== undefined || action) && (
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, gap: 12 }}>
          <h1 id={titleId} style={{ ...h1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
