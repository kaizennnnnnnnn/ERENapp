'use client'

import { useState, useEffect } from 'react'
import type { GachaPullResult } from '@/types'
import { RARITY_COLORS } from '@/lib/gacha'

interface Props {
  results: GachaPullResult[]
  onDone: () => void
}

export default function PullAnimation({ results, onDone }: Props) {
  const [phase, setPhase] = useState<'capsule' | 'reveal' | 'done'>('capsule')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showItem, setShowItem] = useState(false)

  useEffect(() => {
    // Capsule shake, then reveal
    const t = setTimeout(() => { setPhase('reveal'); setShowItem(true) }, 1200)
    return () => clearTimeout(t)
  }, [])

  const current = results[currentIdx]
  if (!current) { onDone(); return null }

  const colors = RARITY_COLORS[current.item.rarity]

  function nextItem() {
    if (currentIdx < results.length - 1) {
      setShowItem(false)
      setTimeout(() => {
        setCurrentIdx(i => i + 1)
        setShowItem(true)
      }, 200)
    } else {
      onDone()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>

      {/* Capsule phase */}
      {phase === 'capsule' && (
        <div className="flex flex-col items-center gap-4">
          <div style={{
            width: 80, height: 100, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            background: `linear-gradient(135deg, ${colors.bg}, white)`,
            border: `3px solid ${colors.border}`,
            boxShadow: `0 0 30px ${colors.glow}, 0 0 60px ${colors.glow}`,
            animation: 'capsuleShake 0.15s ease-in-out infinite',
          }} />
          <p className="font-pixel text-white/60" style={{ fontSize: 7 }}>OPENING...</p>
        </div>
      )}

      {/* Reveal phase */}
      {phase === 'reveal' && showItem && (
        <button onClick={nextItem} className="flex flex-col items-center gap-4 active:scale-95 transition-transform w-full max-w-xs px-6">
          {/* Rarity burst */}
          <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
            <div className="absolute inset-0 rounded-full" style={{
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
              animation: 'pulseGlow 1.5s ease-in-out infinite',
            }} />
            <div className="relative flex items-center justify-center rounded-2xl"
              style={{
                width: 90, height: 90,
                background: colors.bg,
                border: `3px solid ${colors.border}`,
                boxShadow: `0 0 20px ${colors.glow}`,
                animation: 'itemBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}>
              <span style={{ fontSize: 40 }}>{current.item.icon}</span>
            </div>
          </div>

          {/* Item info */}
          <div className="text-center" style={{ animation: 'fadeUp 0.4s ease-out 0.2s both' }}>
            {current.isNew && (
              <span className="font-pixel px-2 py-0.5 mb-2 inline-block" style={{
                fontSize: 7, color: '#FBBF24', background: 'rgba(251,191,36,0.15)',
                borderRadius: 4, border: '1px solid rgba(251,191,36,0.4)',
              }}>NEW!</span>
            )}
            <p className="font-pixel text-white mb-1" style={{ fontSize: 10 }}>{current.item.name}</p>
            <p className="font-pixel mb-1" style={{ fontSize: 7, color: colors.text === '#6B7280' ? '#9CA3AF' : colors.text }}>
              {current.item.rarity.toUpperCase()}
            </p>
            <p className="text-xs text-white/50">{current.item.description}</p>

            {current.stardustGained > 0 && (
              <p className="font-pixel text-purple-300 mt-2" style={{ fontSize: 7 }}>
                +{current.stardustGained} stardust (duplicate)
              </p>
            )}
            {current.isPity && (
              <p className="font-pixel text-amber-300 mt-1" style={{ fontSize: 6 }}>PITY BONUS!</p>
            )}
          </div>

          {/* Counter */}
          {results.length > 1 && (
            <p className="font-pixel text-white/40" style={{ fontSize: 6 }}>
              {currentIdx + 1} / {results.length} — TAP TO CONTINUE
            </p>
          )}
          {results.length === 1 && (
            <p className="font-pixel text-white/40" style={{ fontSize: 6 }}>TAP TO CLOSE</p>
          )}
        </button>
      )}

      {/* Skip button for multi-pull */}
      {phase === 'reveal' && results.length > 1 && currentIdx < results.length - 1 && (
        <button onClick={onDone}
          className="absolute bottom-8 font-pixel text-white/30 active:text-white/60"
          style={{ fontSize: 6 }}>
          SKIP ALL
        </button>
      )}

      <style jsx>{`
        @keyframes capsuleShake {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes itemBounceIn {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
