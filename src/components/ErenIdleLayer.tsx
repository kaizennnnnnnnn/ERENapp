'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { IconHeart, IconFish, IconMoon, IconStar, IconPaw, IconMeat } from './PixelIcons'

type IdleAnim =
  | 'lookLeft' | 'lookRight'
  | 'hop' | 'stretch' | 'wiggle'
  | 'think'

interface ThoughtBubble {
  id: number
  icon: ReactNode
}

const THOUGHT_ICONS = [
  <IconHeart key="h" size={14} />,
  <IconFish key="f" size={14} />,
  <IconMoon key="m" size={14} />,
  <IconStar key="s" size={14} />,
  <IconPaw key="p" size={14} />,
  <IconMeat key="d" size={14} />,
]

const ANIMS: IdleAnim[] = ['lookLeft', 'lookRight', 'hop', 'stretch', 'wiggle', 'think', 'think']

const ANIM_DURATION: Record<IdleAnim, number> = {
  lookLeft: 2200,
  lookRight: 2200,
  hop: 800,
  stretch: 1800,
  wiggle: 1200,
  think: 3000,
}

const ANIM_STYLE: Record<Exclude<IdleAnim, 'think'>, string> = {
  lookLeft:  'erenIdleLookLeft',
  lookRight: 'erenIdleLookRight',
  hop:       'erenIdleHop',
  stretch:   'erenIdleStretch',
  wiggle:    'erenIdleWiggle',
}

let bubbleId = 0

interface Props {
  children: ReactNode
  disabled?: boolean
}

export default function ErenIdleLayer({ children, disabled }: Props) {
  const [anim, setAnim] = useState<Exclude<IdleAnim, 'think'> | null>(null)
  const [thoughts, setThoughts] = useState<ThoughtBubble[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleNext = useCallback(() => {
    const delay = 12000 + Math.random() * 13000
    timerRef.current = setTimeout(() => {
      const pick = ANIMS[Math.floor(Math.random() * ANIMS.length)]

      if (pick === 'think') {
        const icon = THOUGHT_ICONS[Math.floor(Math.random() * THOUGHT_ICONS.length)]
        const id = ++bubbleId
        setThoughts(prev => [...prev, { id, icon }])
        setTimeout(() => setThoughts(prev => prev.filter(t => t.id !== id)), 3000)
      } else {
        setAnim(pick)
        setTimeout(() => setAnim(null), ANIM_DURATION[pick])
      }

      scheduleNext()
    }, delay)
  }, [])

  useEffect(() => {
    if (disabled) return
    scheduleNext()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [disabled, scheduleNext])

  return (
    <div className="relative">
      {/* Eren container — random idle animation overlay. Breathing lives
          inside BlinkingEren so it's shared across every room. */}
      <div style={{
        animation: anim ? `${ANIM_STYLE[anim]} ${ANIM_DURATION[anim]}ms ease-in-out` : undefined,
        transformOrigin: 'bottom center',
      }}>
        {children}
      </div>

      {/* Thought bubbles above Eren */}
      {thoughts.map(t => (
        <div key={t.id} className="absolute pointer-events-none"
          style={{
            top: -8, right: -6,
            animation: 'erenThoughtIn 3s ease-out forwards',
            zIndex: 20,
          }}>
          <div style={{
            width: 28, height: 28,
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 6,
            border: '2px solid #E8D0E0',
            boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {t.icon}
          </div>
          {/* Bubble tail dots */}
          <div style={{
            position: 'absolute', bottom: -4, left: 6,
            width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid #E8D0E0',
          }} />
          <div style={{
            position: 'absolute', bottom: -9, left: 3,
            width: 3, height: 3, borderRadius: '50%',
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid #E8D0E0',
          }} />
        </div>
      ))}

      <style jsx global>{`
        @keyframes erenIdleLookLeft {
          0%, 100% { transform: translateX(0); }
          20%, 80% { transform: translateX(-1.5px) rotate(-1deg); }
        }
        @keyframes erenIdleLookRight {
          0%, 100% { transform: translateX(0); }
          20%, 80% { transform: translateX(1.5px) rotate(1deg); }
        }
        @keyframes erenIdleHop {
          0%, 100% { transform: translateY(0); }
          30%      { transform: translateY(-12px); }
          50%      { transform: translateY(0); }
          65%      { transform: translateY(-5px); }
          80%      { transform: translateY(0); }
        }
        @keyframes erenIdleStretch {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          15%      { transform: scaleY(0.93) scaleX(1.04); }
          40%, 70% { transform: scaleY(1.06) scaleX(0.97); }
          85%      { transform: scaleY(0.97) scaleX(1.02); }
        }
        @keyframes erenIdleWiggle {
          0%, 100% { transform: rotate(0deg); }
          15%      { transform: rotate(-1.5deg); }
          30%      { transform: rotate(1.5deg); }
          45%      { transform: rotate(-1deg); }
          60%      { transform: rotate(1deg); }
          75%      { transform: rotate(-0.5deg); }
          90%      { transform: rotate(0deg); }
        }
        @keyframes erenThoughtIn {
          0%   { opacity: 0; transform: translateY(8px) scale(0.5); }
          15%  { opacity: 1; transform: translateY(0) scale(1); }
          75%  { opacity: 1; transform: translateY(-4px) scale(1); }
          100% { opacity: 0; transform: translateY(-12px) scale(0.7); }
        }
      `}</style>
    </div>
  )
}
