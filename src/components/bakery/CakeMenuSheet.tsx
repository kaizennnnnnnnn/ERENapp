'use client'

// The bakery's cake menu, as a Meadow sheet: a two-column grid of soft tiles,
// each cake on a white plate with its name, its line and its price. A tap buys
// it on the spot (cakes are flavour: he sells it, it flies off, coins burst),
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
  onBuy: (cake: CakeDef) => void
  onClose: () => void
}

export default function CakeMenuSheet({ open, coins, busy, onBuy, onClose }: Props) {
  const cat = useCat()
  return (
    <Sheet open={open} title="Cakes" onClose={() => { playSound('ui_modal_close'); onClose() }}>
      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        {CAKES.map(cake => {
          const afford = coins >= cake.price
          return (
            <button key={cake.id} type="button" onClick={() => onBuy(cake)} disabled={!afford || busy}
              aria-label={`${titleCase(cake.name)}, ${cake.price} coins`}
              className="m-press m-focus flex flex-col items-start" style={{
                padding: 12, gap: 8, border: 0, borderRadius: 20, background: M.soft, textAlign: 'left',
                fontFamily: 'inherit', color: M.text, cursor: afford && !busy ? 'pointer' : 'default',
                opacity: afford ? 1 : 0.45,
              }}>
              <span className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 999, background: '#FFFFFF' }}>
                <CakeSprite cake={cake} size={40} />
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{titleCase(cake.name)}</span>
              <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, color: M.text2, flex: 1 }}>{cake.blurb}</span>
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
