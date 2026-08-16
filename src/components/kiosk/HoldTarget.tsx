'use client'

// Press-and-hold with a filling ring — restocking a pan from the fridge, or
// loading a fresh cone onto the spit. Letting go early rewinds, so a stray
// touch while swipin between walls can't silently restock anything.

import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'

interface Props {
  /** ms of unbroken hold before it fires. */
  duration?: number
  onComplete: () => void
  /** Ring + glow colour. */
  color?: string
  /** Ring diameter in px. */
  size?: number
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  'aria-label'?: string
}

export default function HoldTarget({
  duration = 900, onComplete, color = '#F59C45', size = 54,
  disabled, className, style, children, 'aria-label': ariaLabel,
}: Props) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const doneRef = useRef(false)

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setProgress(0)
  }, [])

  useEffect(() => stop, [stop])

  const begin = useCallback(() => {
    if (disabled || rafRef.current !== null) return
    doneRef.current = false
    startRef.current = performance.now()
    playSound('ui_tap')
    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / duration)
      setProgress(p)
      if (p >= 1) {
        if (!doneRef.current) { doneRef.current = true; onComplete() }
        rafRef.current = null
        setProgress(0)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [disabled, duration, onComplete, stop])

  const r = size / 2 - 3
  const circ = 2 * Math.PI * r

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
      style={{ position: 'absolute', border: 0, background: 'none', padding: 0, ...style }}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
    >
      {children}

      {progress > 0 && (
        <span aria-hidden style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: size, height: size, pointerEvents: 'none',
        }}>
          <svg width={size} height={size} style={{ display: 'block', filter: `drop-shadow(0 0 6px ${color}88)` }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>
        </span>
      )}
    </button>
  )
}
