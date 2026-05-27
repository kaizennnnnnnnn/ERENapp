'use client'

import { useEffect, useState, useCallback } from 'react'
import { OBSIDIAN_FACE, Rivets, PINK, PINK_HI, PINK_LO, accentA } from './obsidian'
import { IconTrophy, IconFire, IconCoin } from './PixelIcons'
import { playSound } from '@/lib/sounds'
import type { AchievementDef } from '@/lib/achievements'

interface ToastItem {
  id: number
  type: 'achievement' | 'streak'
  title: string
  coins: number
  streakCount?: number
}

let toastId = 0

export default function AchievementToast() {
  const [items, setItems] = useState<ToastItem[]>([])

  const pushToast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = ++toastId
    setItems(prev => [...prev, { ...item, id }])
    playSound('ui_notification_ping')
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  useEffect(() => {
    const onAchievement = (e: Event) => {
      const detail = (e as CustomEvent<{ achievements: AchievementDef[] }>).detail
      for (const a of detail.achievements) {
        pushToast({ type: 'achievement', title: a.title, coins: a.coins })
      }
    }
    const onStreak = (e: Event) => {
      const detail = (e as CustomEvent<{ milestones: number[]; coins: number; streak: number }>).detail
      pushToast({
        type: 'streak',
        title: `${detail.streak}-Day Streak!`,
        coins: detail.coins,
        streakCount: detail.streak,
      })
    }

    window.addEventListener('eren:achievement-unlocked', onAchievement)
    window.addEventListener('eren:streak-milestone', onStreak)
    return () => {
      window.removeEventListener('eren:achievement-unlocked', onAchievement)
      window.removeEventListener('eren:streak-milestone', onStreak)
    }
  }, [pushToast])

  if (items.length === 0) return null

  return (
    <div className="fixed left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
      style={{ top: 'calc(var(--safe-top) + 8px)', zIndex: 70 }}>
      {items.map(item => (
        <div
          key={item.id}
          className="relative flex items-center"
          style={{
            ...OBSIDIAN_FACE,
            padding: '8px 14px',
            gap: 10,
            border: item.type === 'achievement'
              ? '1.5px solid rgba(251,191,36,0.5)'
              : '1.5px solid rgba(255,107,0,0.5)',
            boxShadow: item.type === 'achievement'
              ? `0 4px 20px rgba(251,191,36,0.3), ${OBSIDIAN_FACE.boxShadow}`
              : `0 4px 20px rgba(255,107,0,0.3), ${OBSIDIAN_FACE.boxShadow}`,
            animation: 'achToastIn 0.35s ease-out',
            maxWidth: 300,
            pointerEvents: 'auto',
          }}
        >
          <Rivets inset={3} />

          <div style={{
            filter: item.type === 'achievement'
              ? 'drop-shadow(0 0 5px rgba(251,191,36,0.5))'
              : 'drop-shadow(0 0 5px rgba(255,107,0,0.5))',
          }}>
            {item.type === 'achievement' ? <IconTrophy size={24} /> : <IconFire size={24} />}
          </div>

          <div className="flex flex-col" style={{ gap: 2 }}>
            <span className="font-pixel" style={{
              fontSize: 5, letterSpacing: 1.5, lineHeight: 1,
              color: item.type === 'achievement' ? '#FBBF24' : '#FF6B00',
              textShadow: item.type === 'achievement'
                ? '0 0 6px rgba(251,191,36,0.5)'
                : '0 0 6px rgba(255,107,0,0.5)',
            }}>
              {item.type === 'achievement' ? 'ACHIEVEMENT UNLOCKED' : 'STREAK MILESTONE'}
            </span>
            <span className="font-pixel" style={{
              fontSize: 7, letterSpacing: 1, lineHeight: 1.2,
              background: `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK} 60%, ${PINK_LO} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {item.title.toUpperCase()}
            </span>
            {item.coins > 0 && (
              <div className="flex items-center" style={{ gap: 3 }}>
                <IconCoin size={10} />
                <span className="font-pixel" style={{
                  fontSize: 6, color: '#FFD700',
                  textShadow: '0 0 4px rgba(255,215,0,0.4)',
                }}>+{item.coins}</span>
              </div>
            )}
          </div>
        </div>
      ))}

      <style jsx global>{`
        @keyframes achToastIn {
          0%   { opacity: 0; transform: translateY(-20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
