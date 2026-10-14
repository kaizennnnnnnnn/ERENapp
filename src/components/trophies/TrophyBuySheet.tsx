'use client'

// Purchase confirmation. Small on purpose — the shop card already made the
// case; this is the "are you sure, that is three won days" beat, plus the one
// place a server refusal gets explained instead of silently doing nothing.
//
// A white Meadow card over a dimmed screen, like the gift and fortune cards:
// the item on a soft stage, its rarity as a tag, one leaf button that spends.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTrophies } from '@/hooks/useTrophies'
import { useAuth } from '@/hooks/useAuth'
import { useCat } from '@/hooks/useCat'
import type { AnyShopItem } from '@/lib/trophyShop'
import ItemPreview from './ItemPreview'
import { PriceChip } from './TrophyShopView'
import { M, MeadowIcon, PrimaryButton, Tag, TextButton } from '@/components/meadow'
import { playSound } from '@/lib/sounds'

const REFUSAL: Record<string, string> = {
  insufficient: 'Not enough catnip. Win a day.',
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
  const cat = useCat()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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

  const close = () => { if (!busy) { playSound('ui_modal_close'); onClose() } }

  return createPortal(
    <div className="meadow-root fixed inset-0 flex items-center justify-center"
      style={{ padding: '0 20px', background: 'rgba(47, 43, 40, 0.36)', zIndex: z }}
      onClick={close}>
      <div onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={`Buy ${cat.t(item.name)}`}
        className="trophy-card w-full flex flex-col items-center"
        style={{
          maxWidth: 340, boxSizing: 'border-box', padding: '20px 20px 14px',
          borderRadius: 28, background: '#FFFFFF',
          animation: 'trophyCardPop 0.26s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        }}>
        <div className="w-full flex items-center justify-center" style={{
          position: 'relative', minHeight: 120, padding: '18px 12px', boxSizing: 'border-box',
          borderRadius: 22, background: M.soft,
        }}>
          <Tag size="sm" tone={item.rarity} caps style={{ position: 'absolute', top: 10, left: 10 }}>
            {item.rarity}
          </Tag>
          <ItemPreview item={item} size={104} name={(profile?.name?.split(' ')[0] || 'You').toUpperCase()} />
        </div>

        <h2 style={{ margin: '16px 0 0', fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: M.text, textAlign: 'center' }}>
          {cat.t(item.name)}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
          {cat.t(item.blurb)}
        </p>

        {error && (
          <p role="alert" style={{
            margin: '12px 0 0', padding: '8px 12px', borderRadius: 14, width: '100%', boxSizing: 'border-box',
            background: M.dangerTint, color: M.danger, fontSize: 14, fontWeight: 700, textAlign: 'center',
          }}>{error}</p>
        )}

        <PrimaryButton
          onClick={confirm}
          disabled={!affordable && !done}
          busy={busy || done}
          icon={done ? <MeadowIcon name="check" size={20} color="#FFFFFF" mono /> : undefined}
          style={{ marginTop: 16 }}>
          {done ? 'Bought' : <>Spend <PriceChip price={item.price} /></>}
        </PrimaryButton>

        <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 600, color: M.text2, textAlign: 'center' }}>
          {affordable
            ? `You have ${trophies.balance} catnip.`
            : `Need ${short} more catnip (you have ${trophies.balance}).`}
        </p>

        <TextButton tone="muted" onClick={close} disabled={busy}>Not now</TextButton>
      </div>

      {/* A plain <style>: the name comes from an inline style, which only
          reaches global keyframes. */}
      <style>{`
        @keyframes trophyCardPop {
          0%   { transform: scale(0.94) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) { .trophy-card { animation: none !important; } }
      `}</style>
    </div>,
    document.body,
  )
}
