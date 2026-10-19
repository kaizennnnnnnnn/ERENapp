'use client'

// ═══════════════════════════════════════════════════════════════════════════
// The gacha machine page's controls, in Meadow: white pieces with the over-art
// lip, floating on the machines' paintings like the home screen's buttons.
//
//   top      back · coins · stardust · tickets (only when you hold some)
//            collection · the machine switcher · drop rates
//   bottom   one card: how far each guarantee is, then Pull 1 / Pull 10
//
// The switcher names the machine you're on and shows where it sits among the
// three; its arrows step one machine over, for anyone who doesn't think to
// swipe the painting. The pity counts are said as "Epic in 12" (the pulls
// left) with a meter that fills as it comes, instead of "EPIC 18/30", which
// left the subtraction to you.
//
// Presentational: the page owns the data and the deck. Everything here sits
// in the page's root layer, OUTSIDE the swipeable deck's transformed layers
// (see the note above the HUD in gacha/page.tsx), and lets swipes through
// wherever there's no control.
// ═══════════════════════════════════════════════════════════════════════════

import type { CSSProperties } from 'react'
import { FONT_ROUNDED, M, MeadowIcon, Meter, RoundButton, TYPE } from '@/components/meadow'
import { STARDUST_INK } from '@/components/rewards/rewardDisplay'
import { PITY_EPIC, PITY_LEGENDARY, PULL_COST_SINGLE, PULL_COST_TEN } from '@/lib/gacha'
import GachaPullButton from './GachaPullButton'
import { RARITY_FILL } from './rarity'

interface Props {
  machines: ReadonlyArray<{ id: string; name: string }>
  index: number
  onGo: (i: number) => void
  coins: number
  stardust: number
  tickets: number
  /** Pulls since the last epic / legendary. */
  pityEpic: number
  pityLegendary: number
  pulling: boolean
  onBack: () => void
  onCollection: () => void
  onOdds: () => void
  onPull: (count: 1 | 10) => void
}

const LIP = `0 3px 0 ${M.overArtLip}`
const LIVE: CSSProperties = { pointerEvents: 'auto' }
// The balance pills, a size down from the kit's CoinChip: three of them and
// the back button have to fit a 360px phone with a five-digit balance.
const PILL: CSSProperties = {
  ...LIVE, height: 36, boxSizing: 'border-box', padding: '0 12px 0 7px', gap: 5, borderRadius: 999,
  background: '#FFFFFF', boxShadow: LIP, fontFamily: FONT_ROUNDED, fontSize: 15, color: M.text, whiteSpace: 'nowrap',
}

export default function GachaHud({
  machines, index, onGo, coins, stardust, tickets, pityEpic, pityLegendary, pulling,
  onBack, onCollection, onOdds, onPull,
}: Props) {
  const machine = machines[index]
  return (
    <>
      {/* ── Top ── */}
      <div className="meadow-root absolute inset-x-0 top-0 z-30" style={{
        padding: 'calc(var(--safe-top) + 10px) 16px 0', pointerEvents: 'none',
      }}>
        <div className="flex items-center" style={{ gap: 6 }}>
          <RoundButton surface="art" ariaLabel="Back" onClick={onBack} style={LIVE}>
            <MeadowIcon name="chevronLeft" color={M.text} />
          </RoundButton>
          <div className="flex-1" />
          <Balance icon="coin" amount={coins} label="coins" />
          <Balance icon="sparkle" color={STARDUST_INK} amount={stardust} label="stardust" />
          {tickets > 0 && <Balance icon="ticket" amount={tickets} label={tickets === 1 ? 'ticket' : 'tickets'} />}
        </div>

        <div className="flex items-center" style={{ gap: 8, marginTop: 10 }}>
          <RoundButton surface="art" ariaLabel="Collection" onClick={onCollection} style={LIVE}>
            <MeadowIcon name="book" />
          </RoundButton>

          {/* The machine switcher. */}
          <div role="group" aria-label="Machines" className="flex-1 flex items-center" style={{
            ...LIVE, minWidth: 0, height: 52, padding: '0 4px', borderRadius: 999, background: '#FFFFFF', boxShadow: LIP,
          }}>
            <Step dir="prev" hidden={index === 0} onClick={() => onGo(index - 1)} />
            <div className="flex-1 flex flex-col items-center" style={{ minWidth: 0, gap: 5 }}>
              <span aria-live="polite" style={{
                fontFamily: FONT_ROUNDED, fontSize: 15, fontWeight: 800, color: M.text, lineHeight: 1.1,
                maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{machine.name}</span>
              <span className="flex" style={{ gap: 5 }}>
                {machines.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => onGo(i)} aria-label={m.name}
                    aria-current={i === index || undefined} className="m-focus" style={{
                      width: i === index ? 16 : 6, height: 6, padding: 0, border: 0, borderRadius: 999,
                      background: i === index ? M.leaf : M.softLip, cursor: 'pointer',
                    }} />
                ))}
              </span>
            </div>
            <Step dir="next" hidden={index === machines.length - 1} onClick={() => onGo(index + 1)} />
          </div>

          <RoundButton surface="art" ariaLabel="Drop rates" onClick={onOdds} style={LIVE}>
            <MeadowIcon name="dice" />
          </RoundButton>
        </div>
      </div>

      {/* ── Bottom: the guarantees, then the pulls ── */}
      <div className="meadow-root absolute inset-x-0 bottom-0 z-30" style={{
        padding: '0 16px calc(var(--safe-bottom) + 16px)', pointerEvents: 'none',
      }}>
        <div style={{ ...LIVE, maxWidth: 440, margin: '0 auto', borderRadius: 24, background: '#FFFFFF', boxShadow: LIP, padding: '14px 14px 16px' }}>
          <div className="flex" style={{ gap: 16, padding: '0 4px' }}>
            <Pity label="Epic" left={PITY_EPIC - pityEpic} of={PITY_EPIC} color={RARITY_FILL.epic} />
            <Pity label="Legendary" left={PITY_LEGENDARY - pityLegendary} of={PITY_LEGENDARY} color={RARITY_FILL.legendary} />
          </div>
          <div className="flex" style={{ gap: 10, marginTop: 14 }}>
            <GachaPullButton tier="single" cost={PULL_COST_SINGLE} showTicket={tickets > 0}
              disabled={pulling || (coins < PULL_COST_SINGLE && tickets <= 0)} onClick={() => onPull(1)} />
            <GachaPullButton tier="ten" cost={PULL_COST_TEN}
              disabled={pulling || coins < PULL_COST_TEN} onClick={() => onPull(10)} />
          </div>
        </div>
      </div>
    </>
  )
}

function Balance({ icon, color, amount, label }: { icon: 'coin' | 'sparkle' | 'ticket'; color?: string; amount: number; label: string }) {
  return (
    <span role="img" aria-label={`${amount} ${label}`} className="inline-flex items-center" style={{ ...PILL, ...TYPE.number }}>
      <MeadowIcon name={icon} size={20} color={color} />
      {amount.toLocaleString('en-US').replace(/,/g, ' ')}
    </span>
  )
}

function Step({ dir, hidden, onClick }: { dir: 'prev' | 'next'; hidden: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={hidden} tabIndex={hidden ? -1 : undefined}
      aria-label={dir === 'prev' ? 'Previous machine' : 'Next machine'}
      className="m-press m-focus flex items-center justify-center" style={{
        width: 36, height: 36, flexShrink: 0, padding: 0, border: 0, borderRadius: 999, background: M.soft,
        visibility: hidden ? 'hidden' : 'visible', cursor: 'pointer',
      }}>
      <MeadowIcon name={dir === 'prev' ? 'chevronLeft' : 'chevronRight'} size={22} color={M.text} />
    </button>
  )
}

/** "Epic in 12" over a meter that fills as the guarantee comes closer. `left`
 *  counts the guaranteed pull itself: 1 means the very next one. */
function Pity({ label, left, of, color }: { label: string; left: number; of: number; color: string }) {
  const n = Math.max(1, left)
  return (
    <div className="flex-1" style={{ minWidth: 0 }}>
      <div className="flex items-baseline justify-between" style={{ gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: M.text }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {n === 1 ? 'next pull' : `in ${n}`}
        </span>
      </div>
      <Meter value={(of - n) / of} color={color} height={6} label={`${label} guaranteed in ${n} pulls`} />
    </div>
  )
}
