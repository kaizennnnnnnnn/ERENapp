'use client'

// Purchase confirmation. Small on purpose — the shop card already made the
// case; this is the "are you sure, that is three won days" beat, plus the one
// place a server refusal gets explained instead of silently doing nothing.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTrophies } from '@/hooks/useTrophies'
import { useAuth } from '@/hooks/useAuth'
import { SHOP_RARITY_COLORS, type AnyShopItem } from '@/lib/trophyShop'
import ItemPreview from './ItemPreview'
import TrophyCup from './TrophyCup'
import { playSound } from '@/lib/sounds'

const REFUSAL: Record<string, string> = {
  insufficient: 'Not enough trophies. Win a day.',
  already_owned: 'You already own this one.',
  // A machine part is owned by the HOUSE, so the server answers already_owned
  // for one your partner paid for — where "you already own this" would be a lie
  // and, worse, would read as a bug.
  already_owned_machine: 'That part is already fitted. Nothing more to pay.',
  unknown_item: 'The shop does not stock that. Try again after a reload.',
  offline: 'Could not reach the shop. Try again in a moment.',
}

export default function TrophyBuySheet({
  item, onClose, z = 140,
}: {
  item: AnyShopItem
  onClose(): void
  /** Stacking level. The Lab's weather machine opens this from inside its own
   *  z-150 panel, and both portal to <body> — without a lift the sheet would
   *  confirm a purchase underneath the screen that asked for it. */
  z?: number
}) {
  const trophies = useTrophies()
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const rc = SHOP_RARITY_COLORS[item.rarity]
  const short = Math.max(0, item.price - trophies.balance)
  const affordable = short === 0

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError(null)
    const r = await trophies.buy(item.id)
    setBusy(false)
    if (r.ok) {
      playSound('ui_modal_open')
      setDone(true)
      setTimeout(onClose, 900)
      return
    }
    playSound('ui_tap')
    const key = r.reason === 'already_owned' && item.kind === 'machine'
      ? 'already_owned_machine' : r.reason
    setError(REFUSAL[key] ?? REFUSAL.offline)
  }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.74)', zIndex: z }}
      onClick={() => { if (!busy) onClose() }}>
      <div onClick={e => e.stopPropagation()}
        className="relative w-full p-4 flex flex-col items-center gap-3"
        style={{
          maxWidth: 290,
          background: 'radial-gradient(120% 90% at 50% 0%, #2A1B4A 0%, #160E2E 60%, #0B0717 100%)',
          border: `2px solid ${rc.border}`,
          borderRadius: 12,
          boxShadow: `0 0 22px ${rc.glow}, 0 10px 30px rgba(0,0,0,0.6)`,
        }}>
        {[['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']].map(([v, h], i) => (
          <div key={i} className="absolute" style={{
            width: 4, height: 4, background: '#F5C842', boxShadow: '0 0 3px #F5C842',
            top: v === 't' ? 7 : undefined, bottom: v === 'b' ? 7 : undefined,
            left: h === 'l' ? 7 : undefined, right: h === 'r' ? 7 : undefined,
          }} />
        ))}

        <span className="font-pixel px-2.5 py-1" style={{
          fontSize: 6, letterSpacing: 1.5, color: rc.text,
          background: rc.bg, border: `1.5px solid ${rc.border}`, borderRadius: 4,
        }}>{item.rarity.toUpperCase()}</span>

        <div className="flex items-center justify-center" style={{ minHeight: 86 }}>
          <ItemPreview item={item} size={104} name={profile?.name?.split(' ')[0] || 'YOU'} />
        </div>

        <p className="font-pixel text-center" style={{ fontSize: 9, letterSpacing: 1.5, color: rc.text }}>
          {item.name.toUpperCase()}
        </p>
        <p className="text-center text-[11px]" style={{ color: '#B4A8C4' }}>{item.blurb}</p>

        {error && (
          <p className="text-center text-[11px]" style={{ color: '#FF8DA1' }}>{error}</p>
        )}

        <button
          onClick={confirm}
          disabled={!affordable || busy || done}
          className="w-full px-4 py-3 flex items-center justify-center gap-2 active:translate-y-[1px] transition-transform"
          style={{
            background: affordable && !done
              ? 'linear-gradient(180deg, #FDE68A 0%, #F5C842 55%, #B45309 100%)'
              : done
                ? 'linear-gradient(180deg, #A7F3B0 0%, #34D399 55%, #065F46 100%)'
                : 'rgba(255,255,255,0.05)',
            border: `2px solid ${affordable || done ? '#7a4a08' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 6,
            opacity: busy ? 0.6 : 1,
          }}>
          {!done && <TrophyCup tier="gold" size={15} shine={false} />}
          <span className="font-pixel" style={{
            fontSize: 9, letterSpacing: 1, color: affordable || done ? '#2A1A00' : '#7A7286',
          }}>
            {done ? 'BOUGHT' : busy ? '...' : `SPEND ${item.price}`}
          </span>
        </button>

        <p className="text-center text-[10px]" style={{ color: '#8B7F9B' }}>
          {affordable
            ? `You have ${trophies.balance}.`
            : `Need ${short} more (you have ${trophies.balance}).`}
        </p>
      </div>
    </div>,
    document.body,
  )
}
