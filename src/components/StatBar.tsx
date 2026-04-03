'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  icon: string
  value: number          // 0–100
  color: string          // tailwind bg class
  bgColor: string
  animate?: boolean
  pixelIcon?: React.ReactNode
}

const SEGMENTS = 10

// Map Tailwind bg class → [lit hex, dim hex]
const COLOR_MAP: Record<string, [string, string]> = {
  'bg-pink-400':    ['#f472b6', '#fce7f3'],
  'bg-amber-400':   ['#fbbf24', '#fef3c7'],
  'bg-emerald-400': ['#34d399', '#d1fae5'],
  'bg-indigo-400':  ['#818cf8', '#e0e7ff'],
  'bg-sky-400':     ['#38bdf8', '#e0f2fe'],
  'bg-red-400':     ['#f87171', '#fee2e2'],
  'bg-green-400':   ['#4ade80', '#dcfce7'],
  'bg-purple-400':  ['#c084fc', '#f3e8ff'],
}

export default function StatBar({ label, icon, value, color, bgColor, animate = true, pixelIcon }: Props) {
  const clamped = Math.round(Math.max(0, Math.min(100, value)))
  const isLow = clamped < 30
  const isCritical = clamped < 15
  const litCount = Math.round((clamped / 100) * SEGMENTS)

  const [statLit, statDim] = COLOR_MAP[color] ?? ['#4ade80', '#bbf7d0']

  // Use stat's own color when healthy; shift to yellow/red as warning
  const segColor =
    clamped >= 60 ? statLit :
    clamped >= 30 ? '#facc15' :
    '#f87171'

  const dimColor =
    clamped >= 60 ? statDim :
    clamped >= 30 ? '#fef08a' :
    '#fecaca'

  return (
    <div className="stat-row">
      {/* Icon */}
      <div className={cn(
        'w-8 flex items-center justify-center flex-shrink-0',
        isCritical && animate && 'animate-heartbeat'
      )}>
        {pixelIcon ?? <span className="text-xl">{icon}</span>}
      </div>

      {/* Bar */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-pixel text-gray-500 tracking-tight">{label}</span>
          <span className={cn(
            'text-[10px] font-pixel',
            clamped >= 60 ? 'text-green-500' : clamped >= 30 ? 'text-yellow-500' : 'text-red-400'
          )}>
            {clamped}
          </span>
        </div>
        {/* Segmented pixel blocks */}
        <div className="flex gap-[3px]">
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <div
              key={i}
              className={cn('flex-1 transition-all duration-500', isLow && animate && i < litCount && 'animate-pulse-soft')}
              style={{
                height: 10,
                background: i < litCount ? segColor : dimColor,
                borderRadius: 2,
                boxShadow: i < litCount ? `0 1px 0 rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.35)` : 'none',
                transitionDelay: `${i * 30}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
