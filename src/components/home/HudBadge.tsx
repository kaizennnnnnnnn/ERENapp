// ─── Home row badges ─────────────────────────────────────────────────────────
// The count on one of home's round shortcuts: a small pill on its top-right
// corner with a white ring, like the reward count on the top bar's level ring.
// The button it sits on must be position: relative.

import type { ReactNode } from 'react'
import { M, TYPE } from '@/components/meadow'

/** Home row's round shortcuts, and the quests pill's height beside them. */
export const HUD_BUTTON = 36

export default function HudBadge({ children, bg = M.love, ink = '#FFFFFF' }: {
  children: ReactNode
  bg?: string
  ink?: string
}) {
  return (
    <span aria-hidden style={{
      position: 'absolute', top: -7, right: -9,
      minWidth: 20, height: 20, boxSizing: 'border-box', padding: '0 5px',
      borderRadius: 999, background: bg, border: '2px solid #FFFFFF',
      color: ink, fontSize: 11, lineHeight: '16px', textAlign: 'center', whiteSpace: 'nowrap',
      ...TYPE.number,
    }}>{children}</span>
  )
}
