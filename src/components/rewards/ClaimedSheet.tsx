'use client'

// ─── What a claim paid ───────────────────────────────────────────────────────
// Item by item, new looks first (they're the surprise in a box), then the
// food, tickets, stardust and coins. Keeps the last result while it slides
// away, so the sheet doesn't empty itself on the way out.

import { useEffect, useState, type ReactNode } from 'react'
import FoodIcon from '@/components/care/FoodIcon'
import { Divider, PrimaryButton, Sheet, M, RARITY_TAG, TINT } from '@/components/meadow'
import { useCat } from '@/hooks/useCat'
import { swapCatName } from '@/lib/catWords'
import type { SkinDef } from '@/lib/skins'
import type { SkinBoxRarity } from '@/lib/levelRewards'
import type { FoodKey } from '@/types'
import { RARITY_NAME, RewardTile, fmt, foodTitle } from './rewardDisplay'

export interface ClaimResult {
  from: number
  to: number
  coins: number
  stardust: number
  tickets: number
  foods: FoodKey[]
  /** The looks the boxes opened to. */
  skins: SkinDef[]
  /** Stardust paid instead of a box whose rarity the household already owns
   *  every look of. Included in `stardust`. */
  boxDust: number
  /** The boxes that paid it, by rarity. */
  converted: SkinBoxRarity[]
}

/** "legendary", "epic and legendary". */
function kinds(rarities: SkinBoxRarity[]): string {
  const names = Array.from(new Set(rarities)).map(r => RARITY_NAME[r].toLowerCase())
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
}

export default function ClaimedSheet({ result, onClose }: { result: ClaimResult | null; onClose: () => void }) {
  const cat = useCat()
  const [shown, setShown] = useState(result)
  useEffect(() => { if (result) setShown(result) }, [result])

  const rows: { key: string; art: ReactNode; title: string; note?: string }[] = []
  if (shown) {
    for (const s of shown.skins) {
      rows.push({
        key: `skin-${s.id}`,
        art: (
          <span aria-hidden style={{ width: 48, height: 48, borderRadius: 16, background: RARITY_TAG[s.rarity].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={s.thumb} alt="" draggable={false} style={{ width: 40, height: 40, objectFit: 'contain', imageRendering: 'auto' }} />
          </span>
        ),
        title: swapCatName(s.name, cat),
        note: 'A new look, in your Closet',
      })
    }
    const counts = new Map<FoodKey, number>()
    for (const f of shown.foods) counts.set(f, (counts.get(f) ?? 0) + 1)
    counts.forEach((n, key) => rows.push({
      key: `food-${key}`,
      art: (
        <span aria-hidden style={{ width: 48, height: 48, borderRadius: 16, background: TINT.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FoodIcon id={key} size={38} />
        </span>
      ),
      title: n > 1 ? `${foodTitle(key)} ×${n}` : foodTitle(key),
      note: 'In your fridge',
    }))
    if (shown.tickets > 0) rows.push({
      key: 'tickets', art: <RewardTile item={{ kind: 'tickets', amount: shown.tickets }} size={48} />,
      title: shown.tickets === 1 ? '1 gacha ticket' : `${shown.tickets} gacha tickets`, note: 'Each one is a free pull',
    })
    if (shown.stardust > 0) rows.push({
      key: 'stardust', art: <RewardTile item={{ kind: 'stardust', amount: shown.stardust }} size={48} />,
      title: `${fmt(shown.stardust)} stardust`,
      note: shown.boxDust > 0
        ? `${fmt(shown.boxDust)} of it in place of ${shown.converted.length === 1 ? 'a skin' : `${shown.converted.length} skins`}: `
          + `your home already has every ${kinds(shown.converted)} look`
        : 'Spend it on looks in the Closet',
    })
    if (shown.coins > 0) rows.push({
      key: 'coins', art: <RewardTile item={{ kind: 'coins', amount: shown.coins }} size={48} />,
      title: `${fmt(shown.coins)} coins`,
    })
  }

  const levels = shown ? (shown.from === shown.to ? `Level ${shown.to}` : `Levels ${shown.from} to ${shown.to}`) : ''

  return (
    <Sheet open={result !== null} onClose={onClose} title="Rewards claimed"
      footer={<PrimaryButton onClick={onClose}>Nice!</PrimaryButton>}>
      <p style={{ margin: '0 4px 8px', fontSize: 15, fontWeight: 600, color: M.text2 }}>{levels}</p>
      <div role="list" style={{ margin: '0 4px' }}>
        {rows.map((r, i) => (
          <div key={r.key} role="listitem">
            {i > 0 && <Divider inset={62} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' }}>
              {r.art}
              <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 800, overflowWrap: 'anywhere' }}>{r.title}</span>
                {r.note && <span style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{r.note}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
