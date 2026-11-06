import type { CSSProperties } from 'react'
import { M } from './tokens'

/** The owning button supplies the accessible reason in its label. */
export default function NotificationDot({ style }: { style?: CSSProperties }) {
  return <span aria-hidden style={{
    position: 'absolute', top: -3, right: -3, width: 12, height: 12, boxSizing: 'border-box',
    borderRadius: 999, background: M.love, border: '2px solid #FFFFFF', pointerEvents: 'none', ...style,
  }} />
}
