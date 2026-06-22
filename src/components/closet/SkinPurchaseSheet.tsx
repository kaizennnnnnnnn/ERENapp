'use client'

// Confirmation sheet for buying a locked skin with stardust. Opened from the
// Closet when a locked skin is tapped. Pure presentational — the parent owns the
// purchase call + result handling.

import { IconSparkles } from '@/components/PixelIcons'
import { RARITY_COLORS } from '@/lib/gacha'
import type { SkinDef } from '@/lib/skins'
import { playSound } from '@/lib/sounds'

interface Props {
  skin: SkinDef
  price: number
  balance: number
  busy: boolean
  onBuy: () => void
  onClose: () => void
}

export default function SkinPurchaseSheet({ skin, price, balance, busy, onBuy, onClose }: Props) {
  const colors = RARITY_COLORS[skin.rarity]
  const canAfford = balance >= price
  const short = Math.max(0, price - balance)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 60, background: 'rgba(5,3,12,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!busy) { playSound('ui_modal_close'); onClose() } }}
    >
      <div
        className="relative w-full"
        style={{
          maxWidth: 290,
          background: 'radial-gradient(120% 90% at 50% 0%, #2A1B4A 0%, #160E2E 60%, #0B0717 100%)',
          border: `2px solid ${colors.border}`,
          borderRadius: 14,
          boxShadow: `0 0 22px ${colors.glow}, 0 10px 30px rgba(0,0,0,0.6)`,
          padding: 18,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* gold corner pixels — premium card convention */}
        {[['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']].map(([v, h], i) => (
          <div key={i} className="absolute" style={{
            width: 4, height: 4, background: '#F5C842', boxShadow: '0 0 3px #F5C842',
            top: v === 't' ? 7 : undefined, bottom: v === 'b' ? 7 : undefined,
            left: h === 'l' ? 7 : undefined, right: h === 'r' ? 7 : undefined,
          }} />
        ))}

        {/* Rarity ribbon */}
        <div className="flex justify-center mb-2">
          <span className="font-pixel px-2.5 py-1" style={{
            fontSize: 6, letterSpacing: 1.5, color: colors.text,
            background: colors.bg, border: `1.5px solid ${colors.border}`, borderRadius: 4,
            textShadow: '0 1px 0 rgba(255,255,255,0.3)',
          }}>{skin.rarity.toUpperCase()}</span>
        </div>

        {/* Skin preview */}
        <div className="flex items-center justify-center mb-2" style={{ height: 120 }}>
          <img src={skin.thumb} alt={skin.name} draggable={false}
            style={{
              maxHeight: '100%', maxWidth: '80%', objectFit: 'contain', imageRendering: 'pixelated',
              filter: `drop-shadow(0 4px 10px ${colors.glow})`,
            }} />
        </div>

        <p className="font-pixel text-center" style={{ fontSize: 9, color: '#E9D5FF', marginBottom: 12 }}>
          {skin.name.toUpperCase()}
        </p>

        {/* Price + balance */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="font-pixel" style={{ fontSize: 6, color: '#9A8AB5', letterSpacing: 1 }}>PRICE</span>
          <div className="flex items-center gap-1">
            <IconSparkles size={14} />
            <span className="font-pixel" style={{ fontSize: 11, color: '#C4B5FD', textShadow: '0 0 4px rgba(167,139,250,0.6)' }}>{price}</span>
          </div>
        </div>
        <p className="text-center font-pixel" style={{
          fontSize: 6, letterSpacing: 1, marginBottom: 14,
          color: canAfford ? '#7A8A6A' : '#C25A7A',
        }}>
          {canAfford ? `YOU HAVE ${balance}` : `NEED ${short} MORE (YOU HAVE ${balance})`}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { if (!busy) { playSound('ui_back'); onClose() } }}
            disabled={busy}
            className="flex-1 py-2.5 font-pixel active:translate-y-[1px] transition-transform disabled:opacity-50"
            style={{
              fontSize: 7, letterSpacing: 1, color: '#C4B5FD',
              background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(167,139,250,0.3)', borderRadius: 6,
            }}
          >CANCEL</button>
          <button
            onClick={() => { if (!busy && canAfford) onBuy() }}
            disabled={busy || !canAfford}
            className="flex-1 py-2.5 font-pixel active:translate-y-[1px] transition-transform"
            style={{
              fontSize: 7, letterSpacing: 1, color: canAfford ? '#3a2400' : '#5A4A55',
              background: canAfford
                ? 'linear-gradient(180deg, #FDE68A 0%, #F5C842 55%, #B45309 100%)'
                : 'rgba(255,255,255,0.05)',
              border: `2px solid ${canAfford ? '#7a4a08' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 6,
              boxShadow: canAfford ? '0 2px 0 #5e3906, 0 0 12px rgba(245,200,66,0.5)' : 'none',
              opacity: busy ? 0.6 : 1,
              cursor: canAfford && !busy ? 'pointer' : 'not-allowed',
            }}
          >{busy ? '…' : canAfford ? 'UNLOCK' : 'LOCKED'}</button>
        </div>
      </div>
    </div>
  )
}
