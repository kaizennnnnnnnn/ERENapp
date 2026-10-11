'use client'

// Confirmation sheet for buying a locked skin with stardust. Opened from the
// Closet when a locked skin is tapped. Pure presentational — the parent owns the
// purchase call + result handling.
//
// In the Meadow look: a white sheet with the look on its tier's tint, the
// rarity as a tag, the price beside what you have, and Unlock as the leaf
// button pinned to the bottom. It stays mounted and keeps the last skin while
// it drops away, so a cancel and a purchase both close it the same way.

import { useEffect, useState } from 'react'
import { MeadowIcon, PrimaryButton, Sheet, Tag, M, RARITY_TAG, TYPE } from '@/components/meadow'
import { STARDUST_INK } from '@/components/rewards/rewardDisplay'
import { skinPrice, type SkinDef } from '@/lib/skins'
import type { GachaRarity } from '@/types'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { swapCatName } from '@/lib/catWords'

interface Props {
  /** The look being bought; null closes the sheet. */
  skin: SkinDef | null
  balance: number
  busy: boolean
  onBuy: () => void
  onClose: () => void
}

const RARITY_NAME: Record<GachaRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export default function SkinPurchaseSheet({ skin, balance, busy, onBuy, onClose }: Props) {
  const cat = useCat()
  const [shown, setShown] = useState(skin)
  useEffect(() => { if (skin) setShown(skin) }, [skin])
  if (!shown) return null

  const price = skinPrice(shown.rarity)
  const canAfford = balance >= price
  const short = Math.max(0, price - balance)
  const name = swapCatName(shown.name, cat)

  return (
    <Sheet open={!!skin} title={name} dismissible={!busy}
      onClose={() => { playSound('ui_modal_close'); onClose() }}
      footer={
        <PrimaryButton full busy={busy} disabled={!canAfford}
          icon={<MeadowIcon name="sparkle" size={20} mono color="#FFFFFF" />}
          onClick={() => { if (!busy && canAfford) onBuy() }}>
          {busy ? 'Unlocking...' : `Unlock for ${price}`}
        </PrimaryButton>
      }>
      <div className="relative flex items-center justify-center" style={{
        height: 200, borderRadius: 22, background: RARITY_TAG[shown.rarity].bg,
      }}>
        <img src={shown.thumb} alt="" draggable={false}
          style={{ maxHeight: '82%', maxWidth: '70%', objectFit: 'contain', imageRendering: 'auto' }} />
        <Tag tone={shown.rarity} caps size="sm" style={{ position: 'absolute', top: 12, left: 12, background: '#FFFFFF' }}>
          {RARITY_NAME[shown.rarity]}
        </Tag>
      </div>

      <div className="flex items-center justify-between" style={{ margin: '18px 4px 0', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>Price</span>
        <span className="inline-flex items-center" style={{ gap: 6, fontSize: 20, ...TYPE.number }}>
          <MeadowIcon name="sparkle" size={20} color={STARDUST_INK} />{price.toLocaleString('en-US')}
        </span>
      </div>
      <div className="flex items-center justify-between" style={{ margin: '8px 4px 0', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>You have</span>
        <span style={{ fontSize: 15, color: M.text2, ...TYPE.number }}>{balance.toLocaleString('en-US')}</span>
      </div>
      {!canAfford && (
        <p style={{ margin: '14px 4px 0', fontSize: 14, fontWeight: 700, color: M.danger }}>
          You need {short} more stardust. The Gacha and the reward road both give some.
        </p>
      )}
    </Sheet>
  )
}
