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
// ═══════════════════════════════════════════════════════════════════════════

import FoodIcon from '@/components/care/FoodIcon'
import { getDonut, TASTE_JOY } from '@/lib/donuts'
import { DONUT_EFFECTS } from '@/lib/donutEffects'
import { monstaBuff } from '@/lib/monstaBuffs'
import { IconCoin } from '@/components/PixelIcons'
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
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between" style={{
      padding: '5px 7px', borderRadius: 4,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 0.8, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 0.5, color: tone }}>{value}</span>
    </div>
  )
}

export default function FoodStatsCard({ item, owned, onClose }: Props) {
  const donut = getDonut(item.id)
  const buff = monstaBuff(item.id) ?? donut?.perk
  const fx = donut?.effect ? DONUT_EFFECTS[donut.effect] : null

  // Donuts are worth what EREN thinks of them, not what the catalogue says:
  // the feeding path multiplies joy by taste, so printing the raw happyD here
  // would be a lie on a third of the case.
  const joy = donut ? Math.round(item.happyD * TASTE_JOY[donut.taste]) : item.happyD

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      style={{ background: 'rgba(8,4,14,0.72)', animation: 'fsFade 140ms ease-out' }}
      onPointerDown={onClose}>

      <div className="relative w-full" style={{
        maxWidth: 250,
        padding: '13px 13px 12px',
        background: 'linear-gradient(180deg, #241C3A 0%, #140F24 100%)',
        border: `2px solid ${item.color}`,
        borderRadius: 9,
        boxShadow: `4px 4px 0 rgba(0,0,0,0.5), 0 0 26px ${item.color}44`,
        animation: 'fsPop 200ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
        onPointerDown={e => e.stopPropagation()}>

        {/* Gold rivets — the app's tell for a card worth reading. */}
        {[0, 1, 2, 3].map(i => (
          <span key={i} className="absolute" style={{
            width: 2, height: 2, background: '#FBBF24', opacity: 0.8,
            top: i < 2 ? 4 : undefined, bottom: i < 2 ? undefined : 4,
            left: i % 2 === 0 ? 4 : undefined, right: i % 2 === 0 ? undefined : 4,
          }} />
        ))}

        {/* ── Head ── the food, its name, and what it costs ── */}
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 flex items-center justify-center" style={{
            width: 56, height: 56, borderRadius: 7,
            background: `radial-gradient(circle at 40% 34%, ${item.color}33, ${item.color}0D)`,
            border: `1px solid ${item.color}55`,
          }}>
            <FoodIcon id={item.id} color={item.color} size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-pixel" style={{ fontSize: 9, lineHeight: 1.35, color: '#FFF7E6', letterSpacing: 0.5 }}>
              {item.name.toUpperCase()}
            </p>
            <p style={{ fontSize: 10, lineHeight: 1.3, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
              {item.desc}
            </p>
            <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 6, color: '#F5C842', marginTop: 5 }}>
              <IconCoin size={8} />{item.price}
              {owned !== undefined && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{owned} IN FRIDGE</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* ── What it does to him ── */}
        <div className="flex flex-col gap-1" style={{ marginTop: 10 }}>
          <Stat label="HUNGER" value={`+${item.hungerD}`} tone="#F0A868" />
          {/* A plain meal is joyless by design (see SHOP_ITEMS) — a "+0" row
              reads as a bug, so it just isn't a row. */}
          {joy > 0 && <Stat label="HAPPINESS" value={`+${joy}`} tone="#F58AB4" />}
          <Stat label="WEIGHT" value={`+${item.weightD.toFixed(2)} KG`} tone="#9FD9F0" />
          {monstaBuff(item.id) && <Stat label="ENERGY" value="FULL" tone="#D9F06A" />}
        </div>

        {/* ── The one extra thing it does ── */}
        {(buff || fx) && (
          <div style={{ marginTop: 9 }}>
            <p className="font-pixel" style={{ fontSize: 5.5, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
              SPECIAL
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {buff && (
                <span className="font-pixel inline-block" style={{
                  padding: '5px 7px', fontSize: 6.5, letterSpacing: 0.8, color: '#BBF7D0',
                  background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 4,
                }}>
                  {buff.label}
                </span>
              )}
              {/* The part you can see. Painted in the effect's own colour, so
                  the chip is a preview of what he's about to look like. */}
              {fx && (
                <span className="font-pixel inline-block" style={{
                  padding: '5px 7px', fontSize: 6.5, letterSpacing: 0.8, color: fx.tone,
                  background: `${fx.tone}1F`, border: `1px solid ${fx.tone}99`, borderRadius: 4,
                  boxShadow: `0 0 10px ${fx.tone}44`,
                }}>
                  {fx.blurb.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Taste ── why two donuts with the same joy aren't the same donut ── */}
        {donut && donut.taste !== 'likes' && (
          <p className="font-pixel" style={{
            fontSize: 6, lineHeight: 1.5, letterSpacing: 0.5, marginTop: 9,
            color: donut.taste === 'loves' ? '#FFD9E4' : '#A79B90',
          }}>
            {donut.taste === 'loves'
              ? `HIS FAVOURITE — DOUBLE JOY`
              : `NOT HIS THING — HALF JOY`}
          </p>
        )}

        <p className="font-pixel text-center" style={{ fontSize: 5.5, letterSpacing: 1, color: 'rgba(255,255,255,0.28)', marginTop: 11 }}>
          TAP TO CLOSE
        </p>
      </div>

      <style jsx>{`
        @keyframes fsFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fsPop {
          0%   { transform: scale(0.88); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
