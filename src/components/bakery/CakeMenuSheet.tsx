'use client'

// The bakery's cake menu, as a Meadow sheet: a two-column grid of soft tiles,
// each pastry's individual artwork with its name, line and price. A tap buys
// it for your fridge (he sells it, it flies off, coins burst),
// so a cake you can't afford is dimmed rather than tappable.

import { CAKES, type CakeDef } from '@/lib/cakes'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, Sheet, TYPE } from '@/components/meadow'
import CakeSprite from './CakeSprite'
import { titleCase } from './words'

interface Props {
  open: boolean
  coins: number
  busy: boolean
  error?: string | null
  onBuy: (cake: CakeDef) => void
  onClose: () => void
}

export default function CakeMenuSheet({ open, coins, busy, error, onBuy, onClose }: Props) {
  const cat = useCat()
  return (
    <Sheet open={open} title="Cakes" onClose={() => { playSound('ui_modal_close'); onClose() }}>
      {error && <p role="alert" style={{ margin: '0 0 12px', color: M.danger, fontSize: 14, fontWeight: 700 }}>{error}</p>}
      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        {CAKES.map(cake => {
          const afford = coins >= cake.price
          return (
            <button key={cake.id} type="button" onClick={() => onBuy(cake)} disabled={!afford || busy}
              aria-label={`${titleCase(cake.name)}, ${cake.price} coins`}
              className="m-press m-focus flex flex-col items-start" style={{
                padding: 12, gap: 8, minWidth: 0, border: 0, borderRadius: 20, background: M.soft, textAlign: 'left',
                fontFamily: 'inherit', color: M.text, cursor: afford && !busy ? 'pointer' : 'default',
                opacity: afford ? 1 : 0.45,
              }}>
              <span aria-hidden className="flex items-center justify-center" style={{ width: '100%', height: 104, flexShrink: 0 }}>
                <CakeSprite cake={cake} size={96} />
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2, minHeight: 36, overflowWrap: 'break-word' }}>{titleCase(cake.name)}</span>
              <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, color: M.text2, flex: 1 }}>{cake.blurb}</span>
              <span className="flex items-center" aria-label={`Hunger +${cake.hungerD}, happiness +${cake.happyD}`}
                style={{ gap: 12, fontSize: 12, fontWeight: 700 }}>
                <span className="inline-flex items-center" style={{ gap: 4, color: M.flame }}>
                  <MeadowIcon name="flame" size={13} />+{cake.hungerD}
                </span>
                <span className="inline-flex items-center" style={{ gap: 4, color: M.love }}>
                  <MeadowIcon name="heart" size={13} />+{cake.happyD}
                </span>
              </span>
              <span className="inline-flex items-center" style={{ gap: 5, fontSize: 15, ...TYPE.number }}>
                <MeadowIcon name="coin" size={18} />{cake.price}
              </span>
            </button>
          )
        })}
      </div>
      <p style={{ margin: '16px 0 4px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: M.text2 }}>
        {cat.t('{name} bakes with love.')}
      </p>
    </Sheet>
  )
}
