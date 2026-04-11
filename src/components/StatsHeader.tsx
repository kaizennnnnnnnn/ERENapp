'use client'

import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { xpForNextLevel, totalXpForLevel } from '@/lib/tasks'

const MINI_STATS = [
  { key: 'happiness',     icon: '💕', label: 'HAPPY', color: '#f472b6', glow: 'rgba(244,114,182,0.4)' },
  { key: 'hunger',        icon: '🍗', label: 'FOOD',  color: '#fbbf24', glow: 'rgba(251,191,36,0.4)' },
  { key: 'energy',        icon: '⚡', label: 'ENERGY',color: '#34d399', glow: 'rgba(52,211,153,0.4)' },
  { key: 'sleep_quality', icon: '💤', label: 'SLEEP', color: '#818cf8', glow: 'rgba(129,140,248,0.4)' },
  { key: 'cleanliness',   icon: '🛁', label: 'CLEAN', color: '#38bdf8', glow: 'rgba(56,189,248,0.4)' },
] as const

export default function StatsHeader() {
  const { profile } = useAuth()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const { xp, level, coins } = useTasks()
  const { hideStats } = useCare()

  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))

  if (hideStats) return null

  return (
    <div className="w-full px-3 pt-3 pb-2 flex flex-col gap-2"
      style={{
        pointerEvents: 'auto',
        background: 'linear-gradient(180deg, rgba(18,10,35,0.92) 0%, rgba(18,10,35,0.85) 75%, rgba(18,10,35,0.5) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>

      {/* ── Row 1: Level badge + XP bar + Coins ── */}
      <div className="flex items-center gap-2">

        {/* Level badge */}
        <div className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
            border: '2px solid rgba(167,139,250,0.6)',
            boxShadow: '0 0 12px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
          <span className="font-pixel text-white" style={{ fontSize: 10, textShadow: '0 0 8px rgba(255,255,255,0.5)' }}>{level}</span>
        </div>

        {/* XP bar */}
        <div id="stats-xp-bar" className="flex-1 flex flex-col justify-center px-3 h-10"
          style={{
            background: 'rgba(15,10,30,0.55)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(167,139,250,0.25)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-pixel text-purple-300/80" style={{ fontSize: 6 }}>XP</span>
            <span className="font-pixel text-purple-300/60" style={{ fontSize: 5.5 }}>{xpIntoLevel}/{xpNeeded}</span>
          </div>
          <div className="w-full overflow-hidden relative" style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${xpPct}%`,
                background: 'linear-gradient(90deg, #7C3AED, #A78BFA, #C084FC)',
                boxShadow: '0 0 8px rgba(167,139,250,0.5)',
              }} />
            <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%)' }} />
          </div>
        </div>

        {/* Coins */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 h-10"
          style={{
            background: 'rgba(15,10,30,0.55)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(251,191,36,0.25)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
          <span style={{ fontSize: 16 }}>🪙</span>
          <span className="font-pixel text-yellow-300" style={{ fontSize: 10, textShadow: '0 0 6px rgba(251,191,36,0.4)' }}>{coins}</span>
        </div>
      </div>

      {/* ── Row 2: Care stat pills ── */}
      <div className="flex gap-1.5">
        {MINI_STATS.map(({ key, icon, color, glow }) => {
          const raw = stats ? (stats as unknown as Record<string, unknown>)[key] : 0
          const val = Math.round(Math.max(0, Math.min(100, (typeof raw === 'number' ? raw : 0))))
          const barColor = val >= 60 ? color : val >= 30 ? '#facc15' : '#f87171'
          const barGlow  = val >= 60 ? glow  : val >= 30 ? 'rgba(250,204,21,0.3)' : 'rgba(248,113,113,0.3)'

          return (
            <div key={key} className="flex-1 flex items-center gap-1 px-2 py-2"
              style={{
                background: 'rgba(15,10,30,0.50)',
                backdropFilter: 'blur(10px)',
                borderRadius: 10,
                border: `1px solid ${color}20`,
                boxShadow: `0 2px 6px rgba(0,0,0,0.15)`,
              }}>
              <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
              <div className="flex-1 overflow-hidden" style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{
                  width: `${val}%`, height: '100%', borderRadius: 3,
                  background: barColor,
                  boxShadow: `0 0 6px ${barGlow}`,
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
