'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PIXEL FORM PRIMITIVES — the onboarding + login surfaces share these so the
// auth flow speaks the same language as the rest of the app: dark obsidian
// wells, Press Start 2P labels, dock-style buttons with hard shadows.
// The button recipe is the home dock's (dockBtnBase/Gloss/Label), rehomed
// here so auth pages don't import from a page module.
// ═══════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactNode } from 'react'

// ── Page background layers (rewards-page recipe) ──

export const ONB_BG: CSSProperties = {
  background: 'radial-gradient(ellipse at top, #2D1659 0%, #1A0A33 55%, #0F0620 100%)',
}

/** Drifting starfield — transform-based (composited), same trick as rewards. */
export function Starfield() {
  return (
    <>
      <style>{`
        @keyframes onbStarDrift {
          from { transform: translateX(0); }
          to   { transform: translateX(140px); }
        }
      `}</style>
      <div aria-hidden className="fixed inset-0 pointer-events-none opacity-40" style={{
        left: -140,
        backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px), radial-gradient(circle, #A78BFA 1px, transparent 1px)',
        backgroundSize: '34px 34px, 52px 52px',
        backgroundPosition: '140px 0, 158px 24px',
        animation: 'onbStarDrift 26s linear infinite',
        willChange: 'transform',
      }} />
    </>
  )
}

/** CRT scanlines over the whole screen. */
export function Scanlines() {
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none" style={{
      background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0.16) 4px)',
    }} />
  )
}

// ── Buttons (home dock recipe) ──

const BTN_GRADIENTS = {
  gold: 'linear-gradient(180deg, #FFE08A 0%, #F5B73B 45%, #C77E16 100%)',
  pink: 'linear-gradient(180deg, #FBCFE8 0%, #F472B6 45%, #DB2777 100%)',
  dark: 'linear-gradient(180deg, #2A2438 0%, #161222 100%)',
} as const

export const dockBtnBase: CSSProperties = {
  height: 46,
  borderRadius: 5,
  border: '2px solid #050507',
  boxShadow:
    '3px 3px 0 #050507, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.25)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  position: 'relative',
  overflow: 'hidden',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  width: '100%',
}

export const dockBtnGloss: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background:
    'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%)',
  borderRadius: 4,
}

export const dockBtnLabel: CSSProperties = {
  fontFamily: '"Press Start 2P"',
  fontSize: 8,
  letterSpacing: 1,
  color: '#FBF1D9',
  textShadow: '1px 1px 0 rgba(0,0,0,0.65)',
  position: 'relative',
  zIndex: 1,
}

export function PixelButton({
  children,
  onClick,
  variant = 'gold',
  type = 'button',
  disabled = false,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: keyof typeof BTN_GRADIENTS
  type?: 'button' | 'submit'
  disabled?: boolean
  style?: CSSProperties
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="active:translate-y-[2px] active:shadow-none transition-transform"
      style={{
        ...dockBtnBase,
        background: BTN_GRADIENTS[variant],
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <div style={dockBtnGloss} />
      <span style={dockBtnLabel}>{children}</span>
    </button>
  )
}

// ── Inputs ──

export const inputLabelStyle: CSSProperties = {
  fontFamily: '"Press Start 2P"',
  fontSize: 7,
  letterSpacing: 1.5,
  color: '#C9B8E8',
  display: 'block',
  marginBottom: 6,
}

// 16px input text is deliberate: anything smaller triggers iOS Safari's
// focus auto-zoom. Pixel font is for the label only.
export const inputWellStyle: CSSProperties = {
  width: '100%',
  background: '#0B0B10',
  border: '2px solid #050507',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(var(--accent-rgb), 0.25)',
  borderRadius: 4,
  padding: '12px 12px',
  fontSize: 16,
  color: '#F4EDFF',
  outline: 'none',
  caretColor: 'var(--accent-hi)',
}

export function PixelInput({
  label,
  suffix,
  ...inputProps
}: {
  label: string
  suffix?: ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'block' }}>
      <span style={inputLabelStyle}>{label}</span>
      <div style={{ position: 'relative' }}>
        <input
          {...inputProps}
          onFocus={e => {
            // Scroll the focused field clear of the iOS keyboard.
            const el = e.currentTarget
            setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)
            inputProps.onFocus?.(e)
          }}
          style={{ ...inputWellStyle, paddingRight: suffix ? 44 : 12, ...inputProps.style }}
        />
        {suffix && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            {suffix}
          </div>
        )}
      </div>
    </label>
  )
}

// ── Error strip ──

export function PixelError({ children }: { children: ReactNode }) {
  return (
    <div className="relative" style={{
      background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
      border: '2px solid #7A2030',
      boxShadow: '2px 2px 0 #050507, inset 0 1px 0 rgba(255,255,255,0.05)',
      borderRadius: 4,
      padding: '10px 12px',
      fontFamily: '"Press Start 2P"',
      fontSize: 7,
      lineHeight: 1.8,
      letterSpacing: 0.5,
      color: '#FF9B9B',
    }}>
      {children}
    </div>
  )
}

// ── Tiny text link ──

export function PixelLink({
  children,
  onClick,
  href,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
}) {
  const style: CSSProperties = {
    fontFamily: '"Press Start 2P"',
    fontSize: 7,
    letterSpacing: 1,
    color: '#A78BFA',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(167,139,250,0.4)',
    paddingBottom: 2,
    cursor: 'pointer',
    background: 'none',
  }
  if (href) return <a href={href} style={style}>{children}</a>
  return <button type="button" onClick={onClick} style={style}>{children}</button>
}
