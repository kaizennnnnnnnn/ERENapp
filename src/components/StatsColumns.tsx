'use client'

import { STAT_CONFIGS } from '@/types'
import type { ErenStats } from '@/types'

interface Props {
  stats: ErenStats
}

const SEGMENTS = 8

const COLOR_MAP: Record<string, [string, string]> = {
  'bg-pink-400':    ['#f472b6', '#fce7f3'],
  'bg-amber-400':   ['#fbbf24', '#fef3c7'],
  'bg-emerald-400': ['#34d399', '#d1fae5'],
  'bg-indigo-400':  ['#818cf8', '#e0e7ff'],
  'bg-sky-400':     ['#38bdf8', '#e0f2fe'],
}

export default function StatsColumns({ stats }: Props) {
  return (
    <div className="card mb-4 py-3">
      <div className="flex items-end justify-around gap-1">
        {STAT_CONFIGS.map(cfg => {
          const raw   = stats[cfg.key] ?? 0
          const value = Math.max(0, Math.min(100, raw))
          const lit   = Math.round((value / 100) * SEGMENTS)
          const isLow = value < 30
          const isCritical = value < 15

          const [litColor] = COLOR_MAP[cfg.color] ?? ['#4ade80', '#bbf7d0']
          const [, dimColor] = COLOR_MAP[cfg.color] ?? ['#4ade80', '#bbf7d0']

          const segColor =
            value >= 60 ? litColor :
            value >= 30 ? '#facc15' :
            '#f87171'

          const segDim =
            value >= 60 ? dimColor :
            value >= 30 ? '#fef08a' :
            '#fecaca'

          return (
            <div key={cfg.key} className="flex flex-col items-center gap-1.5" style={{ minWidth: 0, flex: 1 }}>
              {/* Icon */}
              <span
                className={isCritical ? 'animate-heartbeat' : ''}
                style={{ fontSize: 18, lineHeight: 1 }}
              >
                {cfg.icon}
              </span>

              {/* Vertical bar — segments stacked bottom→top */}
              <div className="flex flex-col-reverse gap-[3px]">
                {Array.from({ length: SEGMENTS }).map((_, i) => {
                  const filled = i < lit
                  return (
                    <div
                      key={i}
                      className={filled && isLow ? 'animate-pulse-soft' : ''}
                      style={{
                        width: 28,
                        height: 9,
                        borderRadius: 2,
                        background: filled ? segColor : segDim,
                        boxShadow: filled
                          ? `0 1px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)`
                          : 'none',
                        transition: 'background 0.4s',
                        transitionDelay: `${i * 35}ms`,
                      }}
                    />
                  )
                })}
              </div>

              {/* Label + value */}
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className="font-pixel"
                  style={{
                    fontSize: 6,
                    color: value >= 60 ? '#6B7280' : value >= 30 ? '#D97706' : '#EF4444',
                    lineHeight: 1,
                  }}
                >
                  {value}
                </span>
                <span className="font-pixel text-gray-400" style={{ fontSize: 5, lineHeight: 1 }}>
                  {cfg.label.slice(0, 5).toUpperCase()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
