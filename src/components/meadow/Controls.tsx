'use client'

// ─── Form controls ───────────────────────────────────────────────────────────
// Segmented (Boy | Girl, pattern), Toggle (the settings switches), TextField
// (the big rounded input with a leaf focus ring) and OptionRow (a 64px
// onboarding choice with the check disc).

import { forwardRef, useId, useRef, useState, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { MeadowIcon, type MeadowIconName } from '@/components/PixelIcons'
import { CheckDisc } from './Chips'
import { FONT_ROUNDED, M, TYPE } from './tokens'

// ─── Segmented ───────────────────────────────────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  disabled?: boolean
  style?: CSSProperties
}

/**
 * A radio group drawn as a soft track with the chosen option lifted onto a
 * white face with a 2px lip. Arrow keys move the choice, like native radios.
 */
export function Segmented<T extends string>({ options, value, onChange, ariaLabel, disabled, style }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-disabled={disabled || undefined} style={{
      display: 'flex', height: 44, boxSizing: 'border-box', padding: 4, borderRadius: 14,
      background: M.soft, gap: 4, opacity: disabled ? 0.5 : 1, ...style,
    }}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => { if (!on) onChange(o.value) }}
            onKeyDown={e => onKey(e, i)}
            className="m-focus"
            style={{
              flex: '1 1 0', minWidth: 0, border: 0, borderRadius: 11,
              background: on ? '#FFFFFF' : 'transparent',
              boxShadow: on ? `0 2px 0 ${M.softLip}` : 'none',
              fontFamily: FONT_ROUNDED, fontSize: 15, fontWeight: on ? 800 : 700,
              color: on ? M.text : M.text2, cursor: disabled ? 'default' : 'pointer',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

export interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** Required: a switch has no visible text of its own. */
  ariaLabel: string
  disabled?: boolean
  /** A write is in flight: shown as-is, taps ignored. */
  busy?: boolean
}

/** 52x32 switch: leaf when on, #E3DED6 when off, white 26px knob. */
export function Toggle({ checked, onChange, ariaLabel, disabled, busy }: ToggleProps) {
  const inert = disabled || busy
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => { if (!inert) onChange(!checked) }}
      className="m-focus"
      style={{
        position: 'relative', flexShrink: 0, width: 52, height: 32, padding: 0, border: 0,
        borderRadius: 999, background: checked ? M.leaf : M.toggleOff,
        cursor: inert ? 'default' : 'pointer', opacity: disabled ? 0.45 : busy ? 0.7 : 1,
      }}
    >
      <span aria-hidden style={{
        position: 'absolute', left: 3, top: 3, width: 26, height: 26, borderRadius: 999,
        background: '#FFFFFF', transform: checked ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }} />
    </button>
  )
}

// ─── TextField ───────────────────────────────────────────────────────────────

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'style'> {
  /** The small uppercase label above the field. */
  label?: string
  /** Shown under the field in red; also marks the input aria-invalid. */
  error?: string | null
  /** Quiet help under the field (hidden while an error shows). */
  hint?: ReactNode
  /** Something inside the field's right edge (a CheckDisc when the value is good). */
  trailing?: ReactNode
  /** md = 44px (inline rename in a card); lg = 56px (onboarding). */
  size?: 'md' | 'lg'
  style?: CSSProperties
  inputStyle?: CSSProperties
}

/**
 * The Meadow input: 2px hairline border that turns leaf with a 4px leaf-tint
 * ring on focus. The label is a real <label>, and the error is announced.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, trailing, size = 'lg', style, inputStyle, id, onFocus, onBlur, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const msgId = `${inputId}-msg`
  const [focused, setFocused] = useState(false)
  const lg = size === 'lg'
  const ring = error ? M.danger : focused ? M.leaf : M.hairline
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {label && <label htmlFor={inputId} style={{ ...TYPE.label, color: M.label }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          onFocus={e => { setFocused(true); onFocus?.(e) }}
          onBlur={e => { setFocused(false); onBlur?.(e) }}
          className="m-input"
          style={{
            width: '100%',
            height: lg ? 56 : 44,
            boxSizing: 'border-box',
            padding: `0 ${trailing ? 52 : lg ? 18 : 12}px 0 ${lg ? 18 : 12}px`,
            border: `2px solid ${ring}`,
            borderRadius: lg ? 16 : 12,
            background: '#FFFFFF',
            boxShadow: focused && !error ? `0 0 0 ${lg ? 4 : 3}px ${M.leafTint}` : 'none',
            fontFamily: FONT_ROUNDED,
            fontSize: lg ? 19 : 20,
            fontWeight: lg ? 700 : 800,
            color: M.text,
            caretColor: M.leaf,
            outline: 'none',
            ...inputStyle,
          }}
          {...rest}
        />
        {trailing && (
          <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
            {trailing}
          </span>
        )}
      </div>
      {(error || hint) && (
        <span id={msgId} role={error ? 'alert' : undefined} style={{
          fontSize: 13, lineHeight: 1.4, fontWeight: error ? 700 : 500, color: error ? M.danger : M.text2,
        }}>
          {error || hint}
        </span>
      )}
    </div>
  )
})

// ─── OptionRow ───────────────────────────────────────────────────────────────

export interface OptionRowProps {
  label: ReactNode
  icon?: MeadowIconName
  selected: boolean
  onClick: () => void
  style?: CSSProperties
}

/** A 64px choice row: 2px ring (leaf when chosen) and the check disc on the right. */
export function OptionRow({ label, icon, selected, onClick, style }: OptionRowProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="m-press m-focus"
      style={{
        width: '100%', height: 64, boxSizing: 'border-box', padding: '0 16px',
        border: `2px solid ${selected ? M.leaf : M.hairline}`, borderRadius: 20, background: '#FFFFFF',
        display: 'flex', alignItems: 'center', gap: 14, fontFamily: FONT_ROUNDED, fontSize: 17,
        fontWeight: 700, color: M.text, textAlign: 'left', cursor: 'pointer', ...style,
      }}
    >
      {icon && <MeadowIcon name={icon} color={M.text2} />}
      <span style={{ flex: '1 1 auto' }}>{label}</span>
      {selected && <CheckDisc />}
    </button>
  )
}
