import type { CSSProperties } from 'react'
import { FONT_ROUNDED, M } from '@/components/meadow/tokens'

// The owner's nighttime Meadow variant stays inside the kiosk.
export const KIOSK = {
  ground: '#171E1A', surface: '#222B25', raised: '#303B32', line: '#49564B',
  text: '#F2F5ED', muted: '#BAC5BA', faint: '#A6B3A6', leaf: '#9BD3A5',
  leafFace: M.leaf, leafLip: M.leafLip, coin: '#F4C572', danger: '#F2A49B',
  lip: '#101611', scrim: 'rgba(9, 14, 11, 0.78)',
} as const

export const kioskPanel: CSSProperties = {
  background: KIOSK.surface, color: KIOSK.text, border: `1px solid ${KIOSK.line}`,
  borderRadius: 8, boxShadow: `0 3px 0 ${KIOSK.lip}`,
}
export const kioskSecondary: CSSProperties = {
  background: KIOSK.raised, color: KIOSK.text,
  '--m-lip': KIOSK.lip,
} as CSSProperties
export const kioskRound: CSSProperties = { ...kioskSecondary, border: `1px solid ${KIOSK.line}` }
export const kioskLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: KIOSK.muted, letterSpacing: 0 }

export const KIOSK_CSS = `
.kiosk-theme { font-family: ${FONT_ROUNDED}; color: ${KIOSK.text}; letter-spacing: 0; color-scheme: dark; }
.kiosk-theme button, .kiosk-theme input { font-family: inherit; letter-spacing: 0; }
.kiosk-theme button:focus-visible, .kiosk-theme input:focus-visible { outline: 3px solid ${KIOSK.leaf}; outline-offset: 3px; }
.kiosk-theme button[disabled] { cursor: default; }
.kiosk-special-board[open] .kiosk-special-chevron { transform: rotate(90deg); }
.kiosk-shift-book[open] .kiosk-book-chevron { transform: rotate(90deg); }
.kiosk-theme summary:focus-visible { outline: 3px solid ${KIOSK.leaf}; outline-offset: 3px; border-radius: 6px; }
.kiosk-theme summary::-webkit-details-marker { display: none; }
.kiosk-stations [role="radio"] { color: ${KIOSK.muted} !important; background: transparent !important; box-shadow: none !important; }
.kiosk-stations [role="radio"][aria-checked="true"] { color: ${KIOSK.text} !important; background: ${KIOSK.raised} !important; box-shadow: 0 2px 0 ${KIOSK.lip} !important; }
.kiosk-theme .kiosk-note-input::placeholder { color: ${KIOSK.faint}; opacity: 1; }
.kiosk-action-tooltip { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); padding: 6px 9px; border-radius: 6px; background: ${KIOSK.ground}; color: ${KIOSK.text}; font-size: 12px; font-weight: 700; white-space: nowrap; pointer-events: none; opacity: 0; }
.kiosk-icon-tool:hover .kiosk-action-tooltip, .kiosk-icon-tool:focus-visible .kiosk-action-tooltip { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .kiosk-theme *, .kiosk-theme *::before, .kiosk-theme *::after { animation-duration: 1ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
}
`
