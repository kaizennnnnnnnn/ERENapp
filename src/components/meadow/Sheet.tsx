'use client'

// ─── Sheet ───────────────────────────────────────────────────────────────────
// The Meadow bottom sheet: a white panel with 28px top corners that rises over
// a dimmed page. Used for the Rooms picker, "See all 16", the month of moods,
// the journal, the cat builder, confirmations.
//
// Behaviour a sheet owes the person using it:
//   * closes on the backdrop, the close button and Escape (unless the caller
//     says it must not be dismissed mid-save);
//   * takes focus when it opens, keeps Tab inside itself, and hands focus back
//     to whatever opened it when it closes;
//   * holds the page still underneath while open;
//   * renders into .app-container, so on desktop it stays inside the phone
//     frame (that element's transform scopes position:fixed) instead of
//     spreading across the browser window;
//   * swallows touch events at its root: React bubbles portal events to the
//     React parent, and on /home that parent is PageSwiper, which would read a
//     sideways drag inside the sheet as a swipe into the Kitchen.

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { MeadowIcon } from '@/components/PixelIcons'
import { RoundButton } from './Buttons'
import { FONT_ROUNDED, M } from './tokens'

const EXIT_MS = 180
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

// Two sheets can be open at once (a confirm over a list). The page unlocks
// only when the last one closes, and only the TOP sheet answers Escape and
// holds focus, so closing the confirm doesn't also close the list under it.
const openStack: string[] = []
function pushSheet(id: string) {
  openStack.push(id)
  document.documentElement.classList.add('m-scroll-lock')
}
function popSheet(id: string) {
  const i = openStack.lastIndexOf(id)
  if (i >= 0) openStack.splice(i, 1)
  if (openStack.length === 0) document.documentElement.classList.remove('m-scroll-lock')
}
const isTopSheet = (id: string) => openStack[openStack.length - 1] === id

export interface SheetProps {
  open: boolean
  onClose: () => void
  /** Shown as the sheet's heading and used as its accessible name. */
  title?: ReactNode
  /** Accessible name when there is no visible title. */
  ariaLabel?: string
  children: ReactNode
  /** Pinned under the scrolling body (a primary button). */
  footer?: ReactNode
  /** false while a save is in flight: backdrop, Escape and close do nothing. Default true. */
  dismissible?: boolean
  /** The round close button in the header. Default true. */
  showClose?: boolean
  /** Element to focus on open (an input). Defaults to the sheet itself. */
  initialFocus?: RefObject<HTMLElement>
  /** Default: all but the top 56px of the screen. */
  maxHeight?: CSSProperties['maxHeight']
  bodyStyle?: CSSProperties
  /** Default 85: above the nav (45) and the home header (60), under the cloud transition (100). */
  zIndex?: number
}

export function Sheet({
  open, onClose, title, ariaLabel, children, footer, dismissible = true, showClose = true,
  initialFocus, maxHeight = 'calc(100% - 56px)', bodyStyle, zIndex = 85,
}: SheetProps) {
  const [host, setHost] = useState<Element | null>(null)
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // The host only exists in the browser; resolving it after mount keeps the
  // server render and the first client render identical.
  useEffect(() => {
    setHost(document.querySelector('.app-container') ?? document.body)
  }, [])

  // Stay mounted through the exit animation, then unmount.
  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    if (!mounted) return
    setClosing(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => { setMounted(false); setClosing(false) }, reduced ? 0 : EXIT_MS)
    return () => clearTimeout(t)
  }, [open, mounted])

  // Keep the latest handlers reachable from the document listeners below
  // without re-subscribing them on every render.
  const dismissRef = useRef<() => void>(() => {})
  useEffect(() => {
    dismissRef.current = () => { if (dismissible && open) onClose() }
  }, [dismissible, open, onClose])

  // Focus in on open, back out on close; lock the page while open. Waits for
  // `mounted` so the panel exists when focus is moved into it.
  useEffect(() => {
    if (!open || !host || !mounted) return
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pushSheet(titleId)
    const raf = requestAnimationFrame(() => {
      const target = initialFocus?.current ?? panelRef.current
      target?.focus({ preventScroll: true })
    })
    // Escape from anywhere, and focus that wanders out (a click on the page
    // behind, a screen reader jump) is brought back, for the top sheet only.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isTopSheet(titleId)) { e.preventDefault(); dismissRef.current() }
    }
    const onFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current
      if (!panel || !isTopSheet(titleId)) return
      if (e.target instanceof Node && !panel.contains(e.target)) panel.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      popSheet(titleId)
      const back = restoreRef.current
      if (back && document.contains(back)) back.focus({ preventScroll: true })
    }
  }, [open, host, mounted, initialFocus, titleId])

  if (!mounted || !host) return null

  const dismiss = () => dismissRef.current()

  // Tab cycles inside the panel (Escape is handled at the document).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement)
    if (items.length === 0) { e.preventDefault(); return }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && (active === last || active === panelRef.current)) {
      e.preventDefault(); first.focus()
    }
  }

  const stop = (e: SyntheticEvent) => e.stopPropagation()
  const hasHeader = title !== undefined || showClose
  const safeBottom = 'env(safe-area-inset-bottom, 0px)'

  return createPortal(
    <div
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      className="meadow-root"
      style={{ position: 'fixed', inset: 0, zIndex, fontFamily: FONT_ROUNDED, color: M.text }}
    >
      <div
        aria-hidden
        onClick={dismiss}
        style={{ position: 'absolute', inset: 0, background: 'rgba(47, 43, 40, 0.36)' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        aria-label={title === undefined ? ariaLabel : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={closing ? 'm-sheet-out' : 'm-sheet-in'}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight,
          display: 'flex', flexDirection: 'column', background: '#FFFFFF',
          borderRadius: '28px 28px 0 0', outline: 'none',
        }}
      >
        <div aria-hidden style={{ width: 40, height: 5, borderRadius: 999, background: M.toggleOff, margin: '10px auto 0', flexShrink: 0 }} />
        {hasHeader && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px 0 24px', minHeight: 48, flexShrink: 0 }}>
            <h2 id={titleId} style={{ margin: 0, flex: '1 1 auto', minWidth: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {title}
            </h2>
            {showClose && (
              <RoundButton ariaLabel="Close" surface="white" size={40} onClick={dismiss}>
                <MeadowIcon name="close" size={20} color={M.text} />
              </RoundButton>
            )}
          </div>
        )}
        <div style={{
          flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
          padding: `12px 20px ${footer ? '12px' : `calc(24px + ${safeBottom})`}`, ...bodyStyle,
        }}>
          {children}
        </div>
        {footer && (
          <div style={{ flexShrink: 0, padding: `8px 24px calc(24px + ${safeBottom})` }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    host,
  )
}
