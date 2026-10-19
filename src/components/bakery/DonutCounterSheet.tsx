'use client'

// The bakery's donut counter, as a Meadow sheet: today's three donuts, one row
// each. Unlike the cakes these are real food, bought into your fridge, so a
// row leads with the donut and says what it does to him (hunger, the joy he
// actually gets after his taste, and its perk), with the price on the right
// as the thing you press. Above them, when the case turns over: it is not the
// same three tomorrow.

import { TASTE_JOY, type DonutDef } from '@/lib/donuts'
import { foodArt } from '@/lib/foodMeta'
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, Sheet, Tag, TYPE } from '@/components/meadow'
import { titleCase } from './words'

interface Props {
  open: boolean
  donuts: DonutDef[]
  coins: number
  busy: boolean
  /** "4h 12m" until the next batch; null before the clock is read. */
  batchIn: string | null
  onBuy: (donut: DonutDef) => void
  onClose: () => void
}

export default function DonutCounterSheet({ open, donuts, coins, busy, batchIn, onBuy, onClose }: Props) {
  return (
    <Sheet open={open} title="Donuts" onClose={() => { playSound('ui_modal_close'); onClose() }}>
      <p className="flex items-center" style={{ margin: '-4px 0 14px', gap: 6, fontSize: 14, fontWeight: 700, color: M.text2 }}>
        <MeadowIcon name="clock" size={18} color={M.text2} />
        {batchIn ? `Fresh today. A new batch in ${batchIn}` : 'Baking...'}
      </p>

      <div className="flex flex-col" style={{ gap: 10 }}>
        {donuts.map(d => {
          const afford = coins >= d.price
          return (
            <button key={d.id} type="button" onClick={() => onBuy(d)} disabled={!afford || busy}
              aria-label={`${d.name}, ${d.price} coins`}
              className="m-press m-focus flex items-center" style={{
                padding: 12, gap: 12, border: 0, borderRadius: 20, background: M.soft, textAlign: 'left',
                fontFamily: 'inherit', color: M.text, cursor: afford && !busy ? 'pointer' : 'default',
              }}>
              <img src={foodArt(d.id)} alt="" width={60} height={60} draggable={false}
                style={{ width: 60, height: 60, objectFit: 'contain', flexShrink: 0, opacity: afford ? 1 : 0.5 }} />
              <span className="flex-1 flex flex-col" style={{ minWidth: 0, gap: 3 }}>
                <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{d.name}</span>
                <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: M.text2 }}>{d.desc}</span>
                <span className="flex flex-wrap" style={{ gap: 4, marginTop: 4 }}>
                  <Tag size="sm" tone="amber">Hunger +{d.hungerD}</Tag>
                  {/* The joy he ACTUALLY gets: feeding scales it by his taste,
                      so the catalogue number would be wrong on every donut he
                      loves or won't touch. */}
                  <Tag size="sm" tone="epic">Joy +{Math.round(d.happyD * TASTE_JOY[d.taste])}</Tag>
                  {/* Its perk, on top of what it feeds: starred so it isn't
                      read as a second hunger or joy number. */}
                  <Tag size="sm" tone="leaf" icon={<MeadowIcon name="star" size={14} />}>{titleCase(d.perk.label)}</Tag>
                </span>
              </span>
              {/* The price is the button: it reads as one. */}
              <span className="inline-flex items-center justify-center flex-shrink-0" style={{
                height: 40, minWidth: 64, padding: '0 10px', gap: 4, borderRadius: 14, boxSizing: 'border-box',
                background: afford ? M.leaf : M.toggleOff, color: afford ? '#FFFFFF' : M.text2,
                boxShadow: afford ? `0 3px 0 ${M.leafLip}` : 'none', fontSize: 15, ...TYPE.number,
              }}>
                <MeadowIcon name="coin" size={18} />{d.price}
              </span>
            </button>
          )
        })}
      </div>

      <p className="flex items-center justify-center" style={{ margin: '16px 0 4px', gap: 6, fontSize: 13, fontWeight: 600, color: M.text2 }}>
        <MeadowIcon name="check" size={16} color={M.leaf} />
        Straight to your fridge
      </p>
    </Sheet>
  )
}
