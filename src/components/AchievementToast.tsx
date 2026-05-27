'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { OBSIDIAN_FACE, Rivets, PINK_HI, PINK_LO, PINK } from './obsidian'
import { IconTrophy, IconFire, IconCoin } from './PixelIcons'
import { playSound } from '@/lib/sounds'
import type { AchievementDef } from '@/lib/achievements'
import { RARITY_COLORS } from '@/lib/achievements'

interface ToastItem {
  id: number
  type: 'achievement' | 'streak'
  title: string
  coins: number
  streakCount?: number
  rarity?: AchievementDef['rarity']
  exiting?: boolean
}

let toastId = 0

export default function AchievementToast() {
  const [items, setItems] = useState<ToastItem[]>([])
  const queueRef = useRef<Omit<ToastItem, 'id'>[]>([])
  const processingRef = useRef(false)

  const showNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      processingRef.current = false
      return
    }
    processingRef.current = true
    const item = queueRef.current.shift()!
    const id = ++toastId
    setItems(prev => [...prev, { ...item, id }])
    playSound('ui_notification_ping')

    // Start exit animation after 2.8s, remove after 3.3s
    setTimeout(() => setItems(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t)), 2800)
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
      // Show next after a small gap
      setTimeout(showNext, 200)
    }, 3300)
  }, [])

  const enqueue = useCallback((item: Omit<ToastItem, 'id'>) => {
    queueRef.current.push(item)
    if (!processingRef.current) showNext()
  }, [showNext])

  useEffect(() => {
    const onAchievement = (e: Event) => {
      const detail = (e as CustomEvent<{ achievements: AchievementDef[] }>).detail
      for (const a of detail.achievements) {
        enqueue({ type: 'achievement', title: a.title, coins: a.coins, rarity: a.rarity })
      }
    }
    const onStreak = (e: Event) => {
      const detail = (e as CustomEvent<{ milestones: number[]; coins: number; streak: number }>).detail
      enqueue({
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
  }, [enqueue])

  if (items.length === 0) return null

  return (
    <div className="fixed left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
      style={{ top: 'calc(var(--safe-top) + 8px)', zIndex: 70 }}>
      {items.map(item => {
        const isAch = item.type === 'achievement'
        const rc = isAch && item.rarity ? RARITY_COLORS[item.rarity] : null
        const accentColor = rc ? rc.border : 'rgba(255,107,0,0.5)'
        const glowColor = rc ? rc.glow : 'rgba(255,107,0,0.3)'
        const labelColor = rc ? rc.text : '#FF6B00'

        return (
          <div
            key={item.id}
            className="relative flex items-center"
            style={{
              ...OBSIDIAN_FACE,
              padding: '10px 16px',
              gap: 12,
              border: `1.5px solid ${accentColor}`,
              boxShadow: `0 4px 24px ${glowColor}, 0 0 0 1px rgba(0,0,0,0.3), ${OBSIDIAN_FACE.boxShadow}`,
              animation: item.exiting ? 'achToastOut 0.5s ease-in forwards' : 'achToastIn 0.4s cubic-bezier(0.16,1,0.3,1)',
              maxWidth: 320,
              pointerEvents: 'auto',
            }}
          >
            <Rivets inset={3} />

            <div style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}>
              {isAch ? <IconTrophy size={28} /> : <IconFire size={28} />}
            </div>

            <div className="flex flex-col" style={{ gap: 3 }}>
              <span className="font-pixel" style={{
                fontSize: 5, letterSpacing: 2, lineHeight: 1,
                color: labelColor,
                textShadow: `0 0 8px ${glowColor}`,
              }}>
                {isAch ? 'ACHIEVEMENT UNLOCKED' : 'STREAK MILESTONE'}
              </span>
              <span className="font-pixel" style={{
                fontSize: 8, letterSpacing: 1, lineHeight: 1.2,
                background: `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK} 60%, ${PINK_LO} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {item.title.toUpperCase()}
              </span>
              {item.coins > 0 && (
                <div className="flex items-center" style={{ gap: 4 }}>
                  <IconCoin size={10} />
                  <span className="font-pixel" style={{
                    fontSize: 7, color: '#FFD700',
                    textShadow: '0 0 6px rgba(255,215,0,0.5)',
                  }}>+{item.coins}</span>
                  {isAch && item.rarity && (
                    <span className="font-pixel ml-1" style={{
                      fontSize: 5, color: labelColor, letterSpacing: 1,
                      textTransform: 'uppercase', opacity: 0.7,
                    }}>{item.rarity}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <style jsx global>{`
        @keyframes achToastIn {
          0%   { opacity: 0; transform: translateY(-24px) scale(0.85); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes achToastOut {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-16px) scale(0.9); }
        }
      `}</style>
    </div>
  )
}
