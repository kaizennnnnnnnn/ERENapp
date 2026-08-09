'use client'

// ═══════════════════════════════════════════════════════════════════════════
// GACHA ODDS SHEET — "what are my chances", per banner.
//
// The numbers come from bannerOdds(), which folds rollItem's tier-escalation
// the same way the machine does. That matters: printing the raw RARITY_WEIGHTS
// table here would be a lie on both skin banners, which have no common items —
// their whole 60% common slice lands on rare instead.
//
// Pity is deliberately worded "across all machines": user_gacha_state holds one
// pair of counters per USER, not per banner, so pulls on Snacks & Drinks push
// the FoodSuits counter too.
// ═══════════════════════════════════════════════════════════════════════════

import { playSound } from '@/lib/sounds'
import {
  bannerOdds, RARITY_COLORS, DUPLICATE_STARDUST,
  PITY_EPIC, PITY_LEGENDARY, PULL_COST_SINGLE, PULL_COST_TEN,
} from '@/lib/gacha'
import { Rivets } from '@/components/obsidian'

const GOLD = '#F5C842'
const INK_SOFT = 'rgba(233,222,255,0.62)'

function Corner({ v, h }: { v: 't' | 'b'; h: 'l' | 'r' }) {
  return (
    <span aria-hidden className="absolute" style={{
      width: 4, height: 4, background: GOLD, boxShadow: `0 0 3px ${GOLD}`,
      top: v === 't' ? 7 : undefined, bottom: v === 'b' ? 7 : undefined,
      left: h === 'l' ? 7 : undefined, right: h === 'r' ? 7 : undefined,
    }} />
  )
}

/** One line of small print under the table. */
function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start" style={{ gap: 7 }}>
      <span className="font-pixel flex-shrink-0" style={{ fontSize: 5.5, color: GOLD, letterSpacing: 1, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 10, lineHeight: 1.5, color: INK_SOFT }}>{children}</span>
    </div>
  )
}

export default function GachaOddsSheet({
  bannerId, bannerName, onClose,
}: {
  bannerId: string
  bannerName: string
  onClose: () => void
}) {
  const odds = bannerOdds(bannerId)
  // Widest row drives the bar scale, so the smallest tier still reads as a bar
  // rather than a 2px stub next to a 60% monster.
  const widest = Math.max(...odds.map(o => o.chance), 1)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 75, background: 'rgba(5,3,12,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={() => { playSound('ui_modal_close'); onClose() }}
    >
      <div
        className="relative w-full"
        style={{
          maxWidth: 300,
          background: 'radial-gradient(120% 90% at 50% 0%, #2A1B4A 0%, #160E2E 60%, #0B0717 100%)',
          border: `2px solid ${GOLD}`,
          borderRadius: 14,
          boxShadow: '0 0 22px rgba(245,200,66,0.35), 0 10px 30px rgba(0,0,0,0.6)',
          padding: '16px 15px 14px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <Corner v="t" h="l" /><Corner v="t" h="r" />
        <Corner v="b" h="l" /><Corner v="b" h="r" />

        {/* CRT scanlines — the app's "game panel" tell. */}
        <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
          borderRadius: 12,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0.16) 4px)',
        }} />

        <div className="relative text-center" style={{ marginBottom: 3 }}>
          <h2 className="font-pixel" style={{
            fontSize: 10, letterSpacing: 2, color: GOLD,
            textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
          }}>
            DROP RATES
          </h2>
        </div>
        <p className="relative text-center font-pixel" style={{
          fontSize: 6, letterSpacing: 1, color: INK_SOFT, marginBottom: 12,
        }}>
          {bannerName.toUpperCase()}
        </p>

        {/* ── The table ── */}
        <div className="relative flex flex-col" style={{ gap: 7, marginBottom: 13 }}>
          {odds.map(o => {
            const c = RARITY_COLORS[o.rarity]
            return (
              <div key={o.rarity}>
                <div className="flex items-baseline justify-between" style={{ marginBottom: 3 }}>
                  <span className="font-pixel" style={{
                    fontSize: 7, letterSpacing: 1.2, color: c.border,
                    textShadow: `0 0 8px ${c.glow}`,
                  }}>
                    {o.rarity.toUpperCase()}
                  </span>
                  <span className="font-pixel" style={{ fontSize: 8, color: '#FFFFFF' }}>
                    {o.chance.toFixed(o.chance < 10 ? 1 : 0)}%
                  </span>
                </div>
                <div style={{
                  height: 9, borderRadius: 3, overflow: 'hidden',
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{
                    width: `${(o.chance / widest) * 100}%`, height: '100%',
                    background: `linear-gradient(90deg, ${c.border}, ${c.bg})`,
                    boxShadow: `0 0 8px ${c.glow}`,
                  }} />
                </div>
                <p style={{ fontSize: 9, color: INK_SOFT, marginTop: 3 }}>
                  {o.items} {o.items === 1 ? 'item' : 'items'} · {(o.chance / o.items).toFixed(2)}% each
                </p>
              </div>
            )
          })}
        </div>

        <div aria-hidden style={{
          height: 2, marginBottom: 11,
          background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)`,
        }} />

        <div className="relative flex flex-col" style={{ gap: 8 }}>
          <Note label="PITY">
            An Epic or better lands within {PITY_EPIC} pulls, a Legendary within {PITY_LEGENDARY}.
            The counters are yours, not the machine&apos;s — pulls on every banner
            push them along.
          </Note>
          <Note label="x10">
            The 10th pull of a ten is always Rare or better.
          </Note>
          <Note label="DUPES">
            Pulling one you own pays stardust instead: {DUPLICATE_STARDUST.common} / {DUPLICATE_STARDUST.rare} / {DUPLICATE_STARDUST.epic} / {DUPLICATE_STARDUST.legendary}.
          </Note>
          <Note label="COST">
            {PULL_COST_SINGLE} coins a pull, {PULL_COST_TEN} for ten — one free.
          </Note>
        </div>

        <button
          onClick={() => { playSound('ui_modal_close'); onClose() }}
          className="relative w-full font-pixel active:translate-y-[2px] transition-transform"
          style={{
            marginTop: 14, height: 34, borderRadius: 5,
            border: '2px solid #050507',
            background: 'linear-gradient(180deg, #FFE08A 0%, #F5B73B 45%, #C77E16 100%)',
            boxShadow: '3px 3px 0 #050507, inset 0 1px 0 rgba(255,255,255,0.35)',
            fontSize: 8, letterSpacing: 1.5, color: '#3A2606',
          }}
        >
          <Rivets inset={3} size={2} />
          GOT IT
        </button>
      </div>
    </div>
  )
}
