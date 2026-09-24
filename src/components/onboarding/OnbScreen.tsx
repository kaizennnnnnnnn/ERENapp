'use client'

// ─── OnbScreen ───────────────────────────────────────────────────────────────
// The white Meadow onboarding screen (boards O2..O8): a 44px back circle at
// the top left, an optional link at the top right, the heading at y112, the
// content from y160, and the one green button pinned 34px off the bottom.
//
// It scrolls, on purpose. The builder alone is ~568px tall, so on a phone
// shorter than the boards' 844 the content has to move up under the pinned
// button instead of being clipped by it. And a document-scrolling column (not
// position:fixed) is what lets the iOS keyboard push a focused field into
// view. `.meadow-page` gives both: on a phone the document scrolls; inside the
// desktop phone frame the screen becomes the frame's own scroller. The footer
// is sticky, so the button stays put while the content scrolls under it.
//
// A swipe to the right anywhere outside a sideways scroller or a text field
// goes back, like the prototype.

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { BackButton, M, TYPE } from '@/components/meadow'

const TOP = 'max(56px, calc(var(--safe-top, 0px) + 12px))'
const BOTTOM = 'max(34px, env(safe-area-inset-bottom, 0px))'

interface Props {
  /** Shows the back circle; also what a swipe to the right does. */
  onBack?: () => void
  /** A back circle that is a link to the parent route instead (the auth pages). */
  backHref?: string
  backLabel?: string
  /** Top-right link ("Fine-tune colours", "Log in instead"). */
  topRight?: ReactNode
  title?: ReactNode
  /** Long cat names step the heading down a size instead of truncating it. */
  titleSize?: number
  subtitle?: ReactNode
  /** Distance from the top bar to the content (60 puts the content at y160; 88 with a subtitle, y188). */
  headHeight?: number
  children: ReactNode
  /** The pinned actions: notes, a text button, the primary button. */
  footer?: ReactNode
  /** Fade-and-rise the content in (the step changed). */
  enter?: boolean
  contentStyle?: CSSProperties
}

export default function OnbScreen({
  onBack, backHref, backLabel = 'Back', topRight, title, titleSize = 26, subtitle, headHeight,
  children, footer, enter = true, contentStyle,
}: Props) {
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const down = (e: PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement | null
    swipe.current = onBack && !t?.closest('input, textarea, .scrollbar-hide, [data-hscroll]')
      ? { x: e.clientX, y: e.clientY }
      : null
  }
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const p = swipe.current
    swipe.current = null
    if (!p || !onBack) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (dx > 70 && Math.abs(dy) < dx * 0.75) onBack()
  }

  const head = headHeight ?? (subtitle ? 88 : 60)

  return (
    <div
      className="meadow-page"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={() => { swipe.current = null }}
      style={{ padding: 0, background: M.ground, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: '1 0 auto', paddingTop: TOP }}>
        <div style={{
          height: 44, padding: '0 16px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {onBack || backHref
            ? <BackButton surface="white" label={backLabel} onClick={onBack} href={backHref} />
            : <span />}
          {topRight}
        </div>
        {title !== undefined && (
          <div style={{ minHeight: head, boxSizing: 'border-box', padding: '12px 24px 0' }}>
            <h1 style={{
              ...TYPE.heading, fontSize: titleSize, margin: 0, color: M.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ ...TYPE.body, margin: '5px 0 0', color: M.text2 }}>{subtitle}</p>
            )}
          </div>
        )}
        <div style={{
          paddingBottom: 12,
          animation: enter ? 'mgTileIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both' : undefined,
          ...contentStyle,
        }}>
          {children}
        </div>
      </div>
      {footer && (
        <div style={{
          position: 'sticky', bottom: 0, zIndex: 2, flexShrink: 0, background: M.ground,
          padding: `12px 24px ${BOTTOM}`, display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}

/** A quiet line of copy in the footer or under a field (13/1.4, grey). */
export function Note({ children, center, style, role }: {
  children: ReactNode; center?: boolean; style?: CSSProperties; role?: 'alert' | 'status'
}) {
  return (
    <p role={role} style={{
      margin: 0, fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: M.text2,
      textAlign: center ? 'center' : 'left', ...style,
    }}>
      {children}
    </p>
  )
}

/** A failed action, said plainly, in the danger ink. */
export function ErrorLine({ children, center, style }: { children: ReactNode; center?: boolean; style?: CSSProperties }) {
  return (
    <p role="alert" style={{
      margin: 0, fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger,
      textAlign: center ? 'center' : 'left', ...style,
    }}>
      {children}
    </p>
  )
}

/** The field label the boards use (12px caps), bound to its input. */
export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', ...TYPE.label, color: M.label, margin: '0 4px 6px' }}>
      {children}
    </label>
  )
}

/**
 * A form with two fields only submits on Enter if it has a submit button. The
 * real button lives in the pinned footer, outside the form, so this invisible
 * one stands in for it (not display:none, which some browsers skip).
 */
export function ImplicitSubmit() {
  return (
    <button type="submit" tabIndex={-1} aria-hidden style={{
      position: 'absolute', width: 1, height: 1, padding: 0, border: 0, opacity: 0, pointerEvents: 'none',
    }} />
  )
}
