'use client'

// ═══════════════════════════════════════════════════════════════════════════
// FOOD STATS CARD — hold any food to see what it actually does.
// ──────────────────────────────────────────────────────────────────────────
// The shop card has room for two chips and the fridge tile has room for none,
// so most of what separates one food from another was invisible: weight, the
// donut perks, and the fact that Eren's taste changes what a donut is worth.
// This is where the whole number lives.
//
// It reads the same facts the FEEDING PATH reads — monstaBuff for the cans,
// getDonut for the donut perk and taste — rather than a second table of what
// foods are supposed to do. A stats card that can disagree with the food is
// worse than no stats card.
//
// A white Meadow card over the dimmed kitchen: the food on a soft tile, the
// numbers as quiet rows, the extras as tags. Tap anywhere to close.
// ═══════════════════════════════════════════════════════════════════════════

import FoodIcon from '@/components/care/FoodIcon'
import { getDonut, TASTE_JOY } from '@/lib/donuts'
import { DONUT_EFFECTS } from '@/lib/donutEffects'
import { monstaBuff } from '@/lib/monstaBuffs'
import { useCat } from '@/hooks/useCat'
import { M, MeadowIcon, Tag, TYPE } from '@/components/meadow'
import type { FoodKey } from '@/types'

export interface FoodStatItem {
  id: FoodKey
  name: string
  desc: string
  color: string
  price: number
  hungerD: number
  happyD: number
  weightD: number
}

interface Props {
  item: FoodStatItem
  /** Shown when the card is opened from the fridge, where you own some. */
  owned?: number
  onClose: () => void
}

/** One number, one label — the row shape the whole card is built from. */
function Stat({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex items-center" style={{ gap: 10, padding: '9px 12px', borderRadius: 14, background: M.soft }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: dot, flexShrink: 0 }} />
      <span className="flex-1" style={{ fontSize: 14, fontWeight: 700, color: M.text2 }}>{label}</span>
      <span style={{ fontSize: 15, ...TYPE.number, color: M.text }}>{value}</span>
    </div>
  )
}

export default function FoodStatsCard({ item, owned, onClose }: Props) {
  const cat = useCat()
  const donut = getDonut(item.id)
  const buff = monstaBuff(item.id) ?? donut?.perk
  const fx = donut?.effect ? DONUT_EFFECTS[donut.effect] : null

  // Donuts are worth what EREN thinks of them, not what the catalogue says:
  // the feeding path multiplies joy by taste, so printing the raw happyD here
  // would be a lie on a third of the case.
  const joy = donut ? Math.round(item.happyD * TASTE_JOY[donut.taste]) : item.happyD

  return (
    <div className="meadow-root fixed inset-0 z-[60] flex items-center justify-center"
      style={{ padding: '0 24px', background: 'rgba(47, 43, 40, 0.36)' }}
      onPointerDown={onClose}>

      <div role="dialog" aria-label={item.name} className="fs-card relative w-full" style={{
        maxWidth: 300, boxSizing: 'border-box', padding: '16px 16px 12px',
        background: '#FFFFFF', borderRadius: 28,
        animation: 'fsPop 200ms cubic-bezier(0.34,1.56,0.64,1) both',
      }}
        onPointerDown={e => e.stopPropagation()}
        onClick={onClose}>

        {/* ── Head ── the food, its name, and what it costs ── */}
        <div className="flex items-center" style={{ gap: 12 }}>
          <div className="flex-shrink-0 flex items-center justify-center" style={{
            width: 68, height: 68, borderRadius: 20, background: M.soft,
          }}>
            <FoodIcon id={item.id} color={item.color} size={56} />
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.2, fontWeight: 800, color: M.text }}>{item.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{item.desc}</p>
            <span className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 6 }}>
              <Tag size="sm" tone="amber" icon={<MeadowIcon name="coin" size={14} />} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {item.price}
              </Tag>
              {owned !== undefined && (
                <Tag size="sm" tone="soft" style={{ fontVariantNumeric: 'tabular-nums' }}>{owned} in your fridge</Tag>
              )}
            </span>
          </div>
        </div>

        {/* ── What it does to him ── */}
        <div className="flex flex-col" style={{ gap: 6, marginTop: 14 }}>
          <Stat label="Hunger" value={`+${item.hungerD}`} dot={M.flame} />
          {/* A plain meal is joyless by design (see SHOP_ITEMS) — a "+0" row
              reads as a bug, so it just isn't a row. */}
          {joy > 0 && <Stat label="Happiness" value={`+${joy}`} dot={M.love} />}
          <Stat label="Weight" value={`+${item.weightD.toFixed(2)} kg`} dot="#6FA3D2" />
          {monstaBuff(item.id) && <Stat label="Energy" value="Full" dot={M.energy} />}
        </div>

        {/* ── The one extra thing it does ── */}
        {(buff || fx) && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 4px 6px', ...TYPE.label, fontSize: 11, color: M.label }}>Special</p>
            <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
              {buff && <Tag size="sm" tone="leaf" caps>{buff.label}</Tag>}
              {/* The part you can see, with a dot of the effect's own colour
                  as a preview of what he's about to look like. */}
              {fx && (
                <Tag size="sm" tone="soft"
                  icon={<span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: fx.tone }} />}>
                  {fx.blurb}
                </Tag>
              )}
            </div>
          </div>
        )}

        {/* ── Taste ── why two donuts with the same joy aren't the same donut ── */}
        {donut && donut.taste !== 'likes' && (
          <p className="flex items-center" style={{
            margin: '12px 0 0', gap: 6, fontSize: 14, fontWeight: 700,
            color: donut.taste === 'loves' ? '#A2405F' : M.text2,
          }}>
            <MeadowIcon name="heart" size={16} color={donut.taste === 'loves' ? undefined : M.faint} mono={donut.taste !== 'loves'} />
            {donut.taste === 'loves'
              ? cat.t('{His} favourite: double joy')
              : cat.t('Not {his} thing: half joy')}
          </p>
        )}

        <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: M.faint }}>
          Tap anywhere to close
        </p>
      </div>

      {/* A plain <style>: the name comes from an inline style, which only
          reaches global keyframes (a scoped one never ran). */}
      <style>{`
        @keyframes fsPop {
          0%   { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) { .fs-card { animation: none !important; } }
      `}</style>
    </div>
  )
}
