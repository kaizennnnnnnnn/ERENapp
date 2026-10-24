'use client'

// ═══════════════════════════════════════════════════════════════════════════
// GACHA ODDS SHEET — "what are my chances", per machine, as a Meadow sheet.
//
// The numbers come from bannerOdds(), which folds rollItem's tier-escalation
// the same way the machine does. That matters: printing the raw RARITY_WEIGHTS
// table here would be a lie on both skin banners, which have no common items —
// their whole 60% common slice lands on rare instead.
//
// Shape: one bar carries the whole 100% at a glance, then a row per rarity
// carries the numbers, then the rules, one short line each. This is a thing
// you glance at before spending 50 coins, not something you read. One line
// stays a footnote because it's a real gotcha: pity lives on the PERSON, not
// the machine, so pulls on one machine count towards every machine.
// ═══════════════════════════════════════════════════════════════════════════

import { playSound } from '@/lib/sounds'
import { bannerOdds, DUPLICATE_STARDUST, PITY_EPIC, PITY_LEGENDARY } from '@/lib/gacha'
import { Divider, M, MeadowIcon, PrimaryButton, Sheet, Tag, TYPE, type MeadowIconName } from '@/components/meadow'
import { STARDUST_INK } from '@/components/rewards/rewardDisplay'
import { RARITY_FILL } from './rarity'

export default function GachaOddsSheet({
  open, bannerId, bannerName, onClose,
}: {
  open: boolean
  bannerId: string
  bannerName: string
  onClose: () => void
}) {
  const odds = bannerOdds(bannerId)
  const close = () => { playSound('ui_modal_close'); onClose() }
  const pct = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)}%`

  const rules: Array<{ icon: MeadowIconName; color?: string; text: string }> = [
    { icon: 'star', text: `An Epic or better by pull ${PITY_EPIC}` },
    { icon: 'crown', text: `A Legendary by pull ${PITY_LEGENDARY}` },
    { icon: 'gift', text: 'Every Pull 10 has a Rare or better' },
    { icon: 'sparkle', color: STARDUST_INK, text: `A duplicate turns into ${DUPLICATE_STARDUST.rare} to ${DUPLICATE_STARDUST.legendary} stardust` },
  ]

  return (
    <Sheet open={open} onClose={close} title="Drop rates"
      footer={<PrimaryButton onClick={close}>Got it</PrimaryButton>}>
      <p style={{ margin: '-4px 0 0', fontSize: 15, fontWeight: 600, color: M.text2 }}>{bannerName}</p>

      {/* The whole 100%, one bar, rarest last. */}
      <div aria-hidden className="flex" style={{ marginTop: 16, height: 14, borderRadius: 999, overflow: 'hidden', gap: 2, background: M.track }}>
        {[...odds].reverse().map(o => (
          <span key={o.rarity} style={{ width: `${o.chance}%`, minWidth: 4, background: RARITY_FILL[o.rarity] }} />
        ))}
      </div>

      <div style={{ marginTop: 14, borderRadius: 20, background: M.soft, padding: '4px 16px' }}>
        {odds.map((o, i) => (
          <div key={o.rarity}>
            {i > 0 && <Divider style={{ background: '#E9E4DC' }} />}
            <div className="flex items-center" style={{ minHeight: 52, gap: 10 }}>
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, background: RARITY_FILL[o.rarity], flexShrink: 0 }} />
              <Tag tone={o.rarity} caps size="sm">{o.rarity}</Tag>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: M.text2 }}>
                {o.items} {o.items === 1 ? 'item' : 'items'}
              </span>
              <span style={{ fontSize: 18, color: M.text, ...TYPE.number }}>{pct(o.chance)}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ ...TYPE.label, color: M.label, margin: '22px 0 4px 4px' }}>Guarantees</h3>
      {rules.map(r => (
        <div key={r.text} className="flex items-center" style={{ gap: 12, minHeight: 44, padding: '0 4px' }}>
          <MeadowIcon name={r.icon} size={22} color={r.color} />
          <span style={{ fontSize: 15, fontWeight: 600, color: M.text, lineHeight: 1.35 }}>{r.text}</span>
        </div>
      ))}
      <p style={{ margin: '10px 4px 4px', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: M.text2 }}>
        The count towards a guarantee is shared by all machines.
      </p>
    </Sheet>
  )
}
