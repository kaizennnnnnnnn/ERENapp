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

        {/* Level badge — pixel card with gold rivet corners */}
        <div className="flex-shrink-0 relative"
          style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #D8B4FE 0%, #A78BFA 35%, #7C3AED 100%)',
            border: '2px solid #4C1D95',
            boxShadow: '0 3px 0 #2E0F5C, inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.2), 0 0 8px rgba(167,139,250,0.35)',
            imageRendering: 'pixelated',
          }}>
          {/* Gold rivet corners */}
          <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />
          <div style={{ position: 'absolute', top: 2, right: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, left: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-pixel" style={{ fontSize: 4, color: '#FFD760', letterSpacing: 1.5, lineHeight: 1, marginBottom: 2, textShadow: '1px 1px 0 #3B1674' }}>LVL</span>
            <span className="font-pixel text-white" style={{
              fontSize: 14,
              textShadow: '1px 1px 0 #3B1674, 0 0 4px rgba(255,255,255,0.4)',
              letterSpacing: -0.5,
              lineHeight: 1,
            }}>{level}</span>
          </div>
        </div>

        {/* XP bar — premium segmented with glowing tip */}
        <div id="stats-xp-bar" className="flex-1 flex flex-col justify-center px-2.5 h-10 relative"
          style={{
            background: 'linear-gradient(180deg, rgba(14,8,30,0.92) 0%, rgba(24,14,46,0.92) 100%)',
            border: '2px solid rgba(167,139,250,0.5)',
            boxShadow: '0 3px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(167,139,250,0.22), 0 0 10px rgba(124,58,237,0.18)',
          }}>
          {/* Corner ticks */}
          <div style={{ position: 'absolute', top: 1, left: 1, width: 3, height: 3, background: 'rgba(167,139,250,0.6)' }} />
          <div style={{ position: 'absolute', top: 1, right: 1, width: 3, height: 3, background: 'rgba(167,139,250,0.6)' }} />

          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <div style={{ width: 4, height: 4, background: '#FFD700', boxShadow: '0 0 4px #FFD70099' }} />
              <span className="font-pixel" style={{ fontSize: 7, color: '#F5F0FF', letterSpacing: 2, textShadow: '1px 1px 0 #2E0F5C, 0 0 4px rgba(167,139,250,0.6)' }}>XP</span>
            </div>
            <span className="font-pixel" style={{ fontSize: 6.5, color: '#FFD760', textShadow: '1px 1px 0 rgba(0,0,0,0.6)', letterSpacing: 0.5 }}>
              {xpIntoLevel}<span style={{ color: '#8060A8' }}>/</span>{xpNeeded}
            </span>
          </div>

          {/* XP progress bar — thicker with glowing tip */}
          <div className="w-full relative overflow-hidden" style={{
            height: 10,
            background: 'linear-gradient(180deg, #030108 0%, #0F0820 100%)',
            border: '1px solid rgba(167,139,250,0.35)',
            boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(167,139,250,0.15)',
          }}>
            {/* Filled portion */}
            <div className="h-full transition-all duration-700 ease-out relative" style={{
              width: `${xpPct}%`,
              background: 'linear-gradient(180deg, #F0DDFF 0%, #C084FC 18%, #A78BFA 45%, #7C3AED 78%, #4C1D95 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.35)',
            }}>
              {/* Glowing leading edge */}
              {xpPct > 2 && xpPct < 100 && (
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 2,
                  background: 'linear-gradient(180deg, #FFFFFF, #E5C8FF)',
                  boxShadow: '0 0 6px #D8B4FE, 0 0 10px rgba(167,139,250,0.8)',
                }} />
              )}
            </div>

            {/* Segmented notches every 10% */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,0.4) calc(10% - 1px) 10%)',
            }} />

            {/* Top scanline shine */}
            <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
              height: 2,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12), transparent)',
            }} />
          </div>
        </div>

        {/* Coins — pixel card */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 h-10 relative"
          style={{
            background: 'linear-gradient(180deg, rgba(14,8,30,0.92) 0%, rgba(24,14,46,0.92) 100%)',
            border: '2px solid rgba(251,191,36,0.5)',
            boxShadow: '0 3px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(251,191,36,0.22), 0 0 8px rgba(245,158,11,0.2)',
          }}>
          {/* Corner ticks */}
          <div style={{ position: 'absolute', top: 1, left: 1, width: 3, height: 3, background: 'rgba(251,191,36,0.6)' }} />
          <div style={{ position: 'absolute', top: 1, right: 1, width: 3, height: 3, background: 'rgba(251,191,36,0.6)' }} />
          <IconCoin size={18} />
          <span className="font-pixel" style={{
            fontSize: 10,
            color: '#FDE68A',
            textShadow: '1px 1px 0 #7A4F00, 0 0 4px rgba(253,224,71,0.5)',
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
