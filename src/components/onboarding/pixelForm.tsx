'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PIXEL FORM PRIMITIVES — the onboarding + login surfaces share these so the
// auth flow speaks the same language as the rest of the app: dark obsidian
// wells, Press Start 2P labels, dock-style buttons with hard shadows.
// The button recipe is the home dock's (dockBtnBase/Gloss/Label), rehomed
// here so auth pages don't import from a page module.
// ═══════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactNode } from 'react'
import SparkleField from '@/components/SparkleField'
import { IconCheck } from '@/components/PixelIcons'

// ── Page background layers ──

// Two gradients, not one: a cool violet dome plus a warm ember low on the
// horizon. A single radial reads as a default dark theme; the second light
// source is what makes it look like a night rather than a background-color.
export const ONB_BG: CSSProperties = {
  background: [
    'radial-gradient(ellipse 120% 55% at 50% 108%, rgba(236,72,153,0.20) 0%, transparent 70%)',
    'radial-gradient(ellipse 90% 60% at 50% -10%, #3A1C6E 0%, transparent 72%)',
    'linear-gradient(180deg, #241046 0%, #170A31 48%, #0C0519 100%)',
  ].join(','),
}

const STAR_HUES = ['#FFE9A8', '#FFFFFF', '#C4B0FF', '#F9A8D4']

/**
 * Night sky behind the auth + onboarding steps.
 *
 * Was a repeating radial-gradient lattice — a perfect 34px grid of dots that
 * read as polka-dot wallpaper. Now a scattered field over a slow parallax
 * drift, so the stars sit at real distances from each other.
 */
export function Starfield() {
  return (
    <>
      <style>{`
        @keyframes onbStarDrift {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(60px, 0, 0); }
        }
      `}</style>
      <div aria-hidden className="fixed pointer-events-none" style={{
        inset: '-4% -18%',
        animation: 'onbStarDrift 90s linear infinite alternate',
        willChange: 'transform',
      }}>
        <SparkleField colors={STAR_HUES} count={46} seed={0xE2E4} minSize={2} maxSize={7}
          edgeBias={0.35} className="absolute inset-0" />
      </div>
      <div aria-hidden className="fixed pointer-events-none" style={{
        inset: '-6% -10%',
        animation: 'onbStarDrift 150s linear infinite alternate-reverse',
        willChange: 'transform',
        opacity: 0.55,
      }}>
        <SparkleField colors={STAR_HUES} count={30} seed={0x9A17} minSize={1.5} maxSize={3.5}
          edgeBias={0.2} className="absolute inset-0" />
      </div>
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
  newTab = false,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
  /** Open in a new tab. Use for the legal documents: following them in-place
   *  would throw away a half-typed signup form. */
  newTab?: boolean
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
  if (href) {
    return (
      <a href={href} style={style} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    )
  }
  return <button type="button" onClick={onClick} style={style}>{children}</button>
}

// ── Checkbox ──

/**
 * A checkbox in the same obsidian-well language as PixelInput. The real
 * <input> stays in the DOM (visually hidden, not display:none) so it keeps
 * its role, its label association and its keyboard behaviour — the drawn
 * square is decoration on top.
 */
export function PixelCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
      <span style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{
            position: 'absolute', width: 22, height: 22, margin: 0,
            opacity: 0, cursor: 'pointer',
          }}
        />
        <span aria-hidden style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22,
          background: checked ? 'linear-gradient(180deg, #FFE08A 0%, #F5B73B 45%, #C77E16 100%)' : '#0B0B10',
          border: '2px solid #050507',
          boxShadow: checked
            ? '2px 2px 0 #050507, inset 0 1px 0 rgba(255,255,255,0.35)'
            : 'inset 0 2px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--accent-rgb), 0.25)',
          borderRadius: 3,
        }}>
          {checked && <IconCheck size={14} tone="#2A1A05" />}
        </span>
      </span>
      <span style={{ fontSize: 12, lineHeight: 1.6, color: '#C9B8E8' }}>{children}</span>
    </label>
  )
}
