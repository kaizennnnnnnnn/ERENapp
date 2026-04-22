'use client'

import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { xpForNextLevel, totalXpForLevel } from '@/lib/tasks'
import { IconHeart, IconMeat, IconLightning, IconMoon, IconDrop, IconCoin } from './PixelIcons'

const MINI_STATS = [
  { key: 'happiness',     Icon: IconHeart,     color: '#f472b6', glow: 'rgba(244,114,182,0.4)' },
  { key: 'hunger',        Icon: IconMeat,      color: '#fbbf24', glow: 'rgba(251,191,36,0.4)' },
  { key: 'energy',        Icon: IconLightning, color: '#34d399', glow: 'rgba(52,211,153,0.4)' },
  { key: 'sleep_quality', Icon: IconMoon,      color: '#818cf8', glow: 'rgba(129,140,248,0.4)' },
  { key: 'cleanliness',   Icon: IconDrop,      color: '#38bdf8', glow: 'rgba(56,189,248,0.4)' },
] as const

export default function StatsHeader() {
  const { profile } = useAuth()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const { xp, level, coins } = useTasks()
  const { hideStats, activeScene } = useCare()

  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))

  if (hideStats || activeScene === 'school') return null

  return (
    <div className="w-full px-3 pt-3 pb-2 flex flex-col gap-2"
      style={{
        pointerEvents: 'auto',
        background: 'linear-gradient(180deg, rgba(18,10,35,0.94) 0%, rgba(18,10,35,0.88) 75%, rgba(18,10,35,0.5) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>

      {/* ── Row 1: Level badge + XP bar + Coins ── */}
      <div className="flex items-center gap-2">

        {/* Level badge — pixel card style */}
        <div className="flex-shrink-0 flex items-center justify-center relative"
          style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
            border: '2px solid #4C1D95',
            boxShadow: '0 2px 0 #3B1674, inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.15)',
            imageRendering: 'pixelated',
          }}>
          <span className="font-pixel text-white" style={{
            fontSize: 13,
            textShadow: '1px 1px 0 #3B1674',
            letterSpacing: -1,
          }}>{level}</span>
        </div>

        {/* XP bar — pixel-style segmented */}
        <div id="stats-xp-bar" className="flex-1 flex flex-col justify-center px-2.5 h-10 relative"
          style={{
            background: 'rgba(8,5,20,0.75)',
            border: '2px solid rgba(167,139,250,0.35)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(167,139,250,0.15)',
          }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 1 }}>XP</span>
            <span className="font-pixel" style={{ fontSize: 5.5, color: '#A78BFA' }}>{xpIntoLevel}/{xpNeeded}</span>
          </div>
          {/* XP bar — chunky pixel style with segments */}
          <div className="w-full relative overflow-hidden" style={{
            height: 7,
            background: '#0F0820',
            border: '1px solid rgba(167,139,250,0.25)',
          }}>
            <div className="h-full transition-all duration-700 ease-out" style={{
              width: `${xpPct}%`,
              background: 'linear-gradient(180deg, #C084FC 0%, #A78BFA 50%, #7C3AED 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3)',
            }} />
            {/* Pixel stripes overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 6px, rgba(255,255,255,0.08) 6px 7px)',
            }} />
          </div>
        </div>

        {/* Coins — pixel card */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 h-10"
          style={{
            background: 'rgba(8,5,20,0.75)',
            border: '2px solid rgba(251,191,36,0.35)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(251,191,36,0.15)',
          }}>
          <IconCoin size={18} />
          <span className="font-pixel" style={{
            fontSize: 10,
            color: '#FDE68A',
            textShadow: '1px 1px 0 #7A4F00',
            letterSpacing: -0.5,
          }}>{coins}</span>
        </div>
      </div>

      {/* ── Row 2: Care stat pills with pixel icons ── */}
      <div className="flex gap-1.5">
        {MINI_STATS.map(({ key, Icon, color, glow }) => {
          const raw = stats ? (stats as unknown as Record<string, unknown>)[key] : 0
          const val = Math.round(Math.max(0, Math.min(100, (typeof raw === 'number' ? raw : 0))))
          const barColor = val >= 60 ? color : val >= 30 ? '#facc15' : '#f87171'
          const barGlow  = val >= 60 ? glow  : val >= 30 ? 'rgba(250,204,21,0.4)' : 'rgba(248,113,113,0.4)'

          return (
            <div key={key} className="flex-1 flex items-center gap-1.5 px-1.5 py-1.5"
              style={{
                background: 'rgba(8,5,20,0.7)',
                border: `2px solid ${color}33`,
                boxShadow: `0 2px 0 rgba(0,0,0,0.35), inset 0 1px 0 ${color}15`,
              }}>
              <Icon size={14} />
              <div className="flex-1 relative overflow-hidden" style={{
                height: 6,
                background: '#0F0820',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{
                  width: `${val}%`, height: '100%',
                  background: `linear-gradient(180deg, ${barColor} 0%, ${barColor} 50%, rgba(0,0,0,0.2) 100%)`,
                  boxShadow: `0 0 4px ${barGlow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
                  transition: 'width 0.6s ease-out',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
