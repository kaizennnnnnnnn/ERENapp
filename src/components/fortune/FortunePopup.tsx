'use client'

import { useState } from 'react'
import type { FortuneGiftDef } from '@/types'
import { RARITY_COLORS } from '@/lib/gacha'
import { useFortune } from '@/hooks/useFortune'
import { playSound } from '@/lib/sounds'

interface Props {
  onClose: () => void
}

export default function FortunePopup({ onClose }: Props) {
  const { canClaim, claiming, claimFortune } = useFortune()
  const [gift, setGift] = useState<FortuneGiftDef | null>(null)
  const [phase, setPhase] = useState<'intro' | 'opening' | 'reveal'>('intro')

  async function handleClaim() {
    if (!canClaim || claiming) return
    setPhase('opening')
    const result = await claimFortune()
    if (result) {
      setTimeout(() => {
        setGift(result)
        setPhase('reveal')
      }, 800)
    }
  }

  const colors = gift ? RARITY_COLORS[gift.rarity] : null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-xs mx-auto flex flex-col items-center gap-4 px-6">

        {/* Intro — Eren with gift */}
        {phase === 'intro' && (
          <>
            <div style={{ animation: 'fortuneFloat 2s ease-in-out infinite' }}>
              <img src="/erenGood.png" alt="Eren" draggable={false}
                style={{ width: 120, height: 120, objectFit: 'contain', imageRendering: 'pixelated' }} />
            </div>
            <div className="px-4 py-2 text-center"
              style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
              <p className="font-pixel text-amber-300 mb-1" style={{ fontSize: 8 }}>DAILY FORTUNE</p>
              <p className="text-xs text-white/60">Eren has a gift for you!</p>
            </div>
            {canClaim ? (
              <button onClick={() => { playSound('ui_tap'); handleClaim() }}
                className="w-full py-3 text-white active:translate-y-[2px] transition-transform"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 3, border: '2px solid #B45309', boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
                OPEN GIFT
              </button>
            ) : (
              <p className="font-pixel text-white/40" style={{ fontSize: 7 }}>ALREADY CLAIMED TODAY</p>
            )}
            <button onClick={() => { playSound('ui_modal_close'); onClose() }} className="font-pixel text-white/30" style={{ fontSize: 6 }}>CLOSE</button>
          </>
        )}

        {/* Opening animation */}
        {phase === 'opening' && (
          <div className="flex flex-col items-center gap-4">
            <div style={{
              width: 70, height: 70, borderRadius: 12,
              background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
              border: '3px solid #B45309',
              boxShadow: '0 0 30px rgba(245,158,11,0.5)',
              animation: 'giftShake 0.1s ease-in-out infinite',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 32 }}>🎁</span>
            </div>
            <p className="font-pixel text-amber-300 animate-pulse" style={{ fontSize: 7 }}>UNWRAPPING...</p>
          </div>
        )}

        {/* Reveal */}
        {phase === 'reveal' && gift && colors && (
          <button onClick={() => { playSound('ui_modal_close'); onClose() }} className="flex flex-col items-center gap-4 active:scale-95 transition-transform">
            <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
              <div className="absolute inset-0 rounded-full" style={{
                background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
                animation: 'pulseGlow 1.5s ease-in-out infinite',
              }} />
              <div className="rounded-2xl flex items-center justify-center"
                style={{
                  width: 80, height: 80, background: colors.bg,
                  border: `3px solid ${colors.border}`,
                  boxShadow: `0 0 20px ${colors.glow}`,
                  animation: 'itemBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                }}>
                <span style={{ fontSize: 36 }}>{gift.icon}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="font-pixel text-white mb-1" style={{ fontSize: 10 }}>{gift.name}</p>
              <p className="font-pixel mb-1" style={{ fontSize: 7, color: colors.text === '#6B7280' ? '#9CA3AF' : colors.text }}>
                {gift.rarity.toUpperCase()}
              </p>
              <p className="text-xs text-white/50">{gift.description}</p>
            </div>
            <p className="font-pixel text-white/30" style={{ fontSize: 6 }}>TAP TO CLOSE</p>
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes fortuneFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes giftShake {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
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
      `}</style>
    </div>
  )
}
