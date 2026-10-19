'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DONUT CASE PANEL — what the machine holds, before you spend anything on it.
// ──────────────────────────────────────────────────────────────────────────
// The first version of this was a lone FREE SPIN button on an empty card: you
// couldn't see a single donut until after you'd paid, so there was nothing to
// want. This shows the whole case up front — every donut in full colour, what
// each one DOES, and whether Eren has tasted it yet.
//
// So it's three things on one surface, which is right because they're the same
// question asked three ways: what's in there, what have I got, what's it worth
// spinning for.
//
// The three gacha-exclusive donuts are shown but marked — they're part of the
// collection, so hiding them would make the counter unwinnable-looking, but the
// machine can't drop them and the tile has to say so.
//
// A Meadow sheet: the case is a grid of soft tiles, a tap shows that donut in
// the card under it (one sheet, no nesting, and the spin button never moves),
// and the spin is the sheet's one primary button, pinned at the bottom.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { foodArt } from '@/lib/foodMeta'
import { DONUTS, MACHINE_DONUTS, SPIN_COST, TASTE_JOY, type DonutDef } from '@/lib/donuts'
import { DONUT_EFFECTS } from '@/lib/donutEffects'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { CheckDisc, M, MeadowIcon, PrimaryButton, Sheet, Tag } from '@/components/meadow'
import { STARDUST_INK } from '@/components/rewards/rewardDisplay'
import { titleCase } from './words'

/** Machine stock first — that's what the spin button is offering. */
const CASE_ORDER: DonutDef[] = [
  ...MACHINE_DONUTS,
  ...DONUTS.filter(d => d.source === 'gacha'),
]
const MACHINE_IDS: ReadonlySet<string> = new Set(MACHINE_DONUTS.map(d => d.id))

interface Props {
  open: boolean
  tasted: ReadonlySet<string>
  coins: number
  /** False while the free-spin cooldown is still being read, too. */
  freeReady: boolean
  loaded: boolean
  busy: boolean
  /** "6h 12m" until the free spin returns. */
  freeIn: string
  onSpin: () => void
  onClose: () => void
}

export default function DonutCasePanel({
  open, tasted, coins, freeReady, loaded, busy, freeIn, onSpin, onClose,
}: Props) {
  const [picked, setPicked] = useState<DonutDef | null>(null)
  const cat = useCat()
  const canPay = coins >= SPIN_COST
  const spinnable = loaded && !busy && (freeReady || canPay)

  // Held until the cooldown read lands, so a paid spin can never be offered
  // while a free one might be waiting.
  const footer = (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <PrimaryButton onClick={onSpin} disabled={!spinnable}
        icon={loaded && freeReady ? <MeadowIcon name="star" size={22} /> : undefined}>
        {!loaded ? 'Warming up...'
          : freeReady ? 'Free spin'
          : <span className="inline-flex items-center" style={{ gap: 8 }}>Spin<MeadowIcon name="coin" size={22} />{SPIN_COST}</span>}
      </PrimaryButton>
      {loaded && (
        <p style={{ margin: 0, textAlign: 'center', fontSize: 13, fontWeight: 600, color: M.text2 }}>
          {freeReady ? `After this one, a spin costs ${SPIN_COST}`
            : canPay ? `Free spin in ${freeIn}`
            : `Not enough coins. Free spin in ${freeIn}`}
        </p>
      )}
    </div>
  )

  return (
    <Sheet open={open} title="Donut machine" footer={footer}
      onClose={() => { playSound('ui_modal_close'); onClose() }}>
      <div className="flex items-center justify-between" style={{ marginTop: -4, gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: M.text2 }}>Every donut it holds</span>
        <Tag tone="love" size="sm" icon={<MeadowIcon name="heart" size={14} color="#FFFFFF" mono />}>
          {tasted.size} of {DONUTS.length} tasted
        </Tag>
      </div>

      {/* ── The case ── every donut, in colour, before you spend a coin. */}
      <div className="grid grid-cols-5" style={{ gap: 6, marginTop: 12 }}>
        {CASE_ORDER.map(d => {
          const has = tasted.has(d.id)
          const on = picked?.id === d.id
          return (
            <button key={d.id} type="button" aria-pressed={on} aria-label={d.name}
              onClick={() => { playSound('ui_tap'); setPicked(on ? null : d) }}
              className="m-press m-focus relative flex items-center justify-center" style={{
                aspectRatio: '1', padding: 4, borderRadius: 14, cursor: 'pointer',
                border: `2px solid ${on ? M.leaf : 'transparent'}`, background: on ? M.leafTint : M.soft,
              }}>
              <img src={foodArt(d.id)} alt="" draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              {has && <CheckDisc size={16} corner style={{ position: 'absolute', top: -4, right: -4 }} />}
              {!MACHINE_IDS.has(d.id) && (
                <span aria-hidden style={{
                  position: 'absolute', top: 4, left: 4, width: 8, height: 8, borderRadius: 999, background: STARDUST_INK,
                }} />
              )}
            </button>
          )
        })}
      </div>
      <p className="flex items-center flex-wrap" style={{ margin: '10px 2px 0', gap: '4px 14px', fontSize: 12, fontWeight: 700, color: M.text2 }}>
        <span className="inline-flex items-center" style={{ gap: 5 }}><CheckDisc size={14} />Tasted</span>
        <span className="inline-flex items-center" style={{ gap: 5 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: STARDUST_INK }} />
          Only from the gacha
        </span>
      </p>

      {/* ── The tapped donut, or the pitch when nothing is tapped. ── */}
      <div className="flex items-center" style={{ marginTop: 14, minHeight: 84, padding: 12, gap: 12, borderRadius: 20, background: M.soft }}>
        {picked ? (
          <>
            <img src={foodArt(picked.id)} alt="" width={56} height={56} draggable={false}
              style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: M.text }}>{picked.name}</p>
              <div className="flex flex-wrap" style={{ gap: 4, marginTop: 6 }}>
                <Tag size="sm" tone="leaf" icon={<MeadowIcon name="star" size={14} />}>{titleCase(picked.perk.label)}</Tag>
                {/* Taste changes the joy he actually gets, so it's stated. */}
                {picked.taste === 'loves' && <Tag size="sm" tone="epic">{cat.t('{He} loves it')} · joy x{TASTE_JOY.loves}</Tag>}
                {picked.taste === 'meh' && <Tag size="sm">{cat.t('Not {his} thing')}</Tag>}
                {/* The visible one: the only thing in the case you'd cross a room for. */}
                {picked.effect && <Tag size="sm" tone="amber">{DONUT_EFFECTS[picked.effect].blurb}</Tag>}
                {!MACHINE_IDS.has(picked.id) && <Tag size="sm">Only from the gacha</Tag>}
              </div>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: M.text2 }}>
            Tap a donut to see what it does.<br />
            A spin gives one of the {MACHINE_DONUTS.length} the machine holds.
          </p>
        )}
      </div>
    </Sheet>
  )
}
