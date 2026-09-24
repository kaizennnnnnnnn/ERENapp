'use client'

// WeeklyChampionPopup — Monday-morning modal that surfaces last week's
// Care Battle result. Three variants:
//   - win  → trophy + 100-coin payout claim (one-shot)
//   - loss → quieter "good run" message, no payout
//   - tie  → neutral both-equal message, no payout
// Tapping ANY action stamps acknowledged=true server-side so the popup
// never reappears for that week, even on a fresh page load.
//
// Drawn in the Meadow look of the Us page: a white card over a dimmed page,
// one leaf button, no glow and no blur. It stays a centred modal (not a Meadow
// Sheet) because the coin burst has to paint above it, and a sheet's panel
// would trap that burst inside itself.

import { useEffect, useId, useRef, useState } from 'react'
import type { WeeklyBattleRow } from '@/lib/battleResults'
import { WEEKLY_PAYOUT_COINS } from '@/lib/battleResults'
import { IconTile, M, MeadowIcon, PrimaryButton, TINT, TYPE } from '@/components/meadow'
import { playSound } from '@/lib/sounds'
import CoinPayoutBurst from '@/components/CoinPayoutBurst'

interface Props {
  row: WeeklyBattleRow
  partnerFirstName: string
  onClaim: () => Promise<boolean>  // returns true if coins were credited
  onClose: () => void
}

/** "2026-W38" -> "Week 38". */
function weekLabel(isoWeek: string): string {
  const m = /W(\d+)/.exec(isoWeek)
  return m ? `Week ${Number(m[1])}` : isoWeek
}

export default function WeeklyChampionPopup({ row, partnerFirstName, onClaim, onClose }: Props) {
  const [claiming, setClaiming] = useState(false)
  const [paid, setPaid] = useState(row.payout_paid)
  // Coins credited on this tap. Non-null hands the screen to the payout burst,
  // which closes the popup when its counter lands.
  const [burst, setBurst] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (row.outcome === 'win') playSound('ui_modal_open')
    dialogRef.current?.focus({ preventScroll: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrimary = async () => {
    if (claiming || burst !== null) return
    setClaiming(true)
    const credited = await onClaim()
    if (credited) {
      // Coins are banked — let the player watch them land before we close.
      setPaid(true)
      setBurst(WEEKLY_PAYOUT_COINS)
      return
    }
    playSound('ui_modal_close')
    onClose()
  }

  // Backdrop taps (and Escape) dismiss, except mid-burst — there the burst
  // layer sits on top and owns the tap (tap-to-skip).
  const handleBackdrop = () => { if (burst === null) onClose() }
  const dismissRef = useRef(handleBackdrop)
  dismissRef.current = handleBackdrop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const isWin = row.outcome === 'win'
  const isTie = row.outcome === 'tie'

  const title = isWin ? 'Weekly champion' : isTie ? 'A perfect tie' : 'Good run'
  const subtitle = isWin
    ? "You won last week's care battle."
    : isTie
      ? `You and ${partnerFirstName} finished dead even.`
      : `${partnerFirstName} edged ahead last week.`

  return (
    <div
      className="meadow-root"
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 120, padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(47, 43, 40, 0.36)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, boxSizing: 'border-box', borderRadius: 28, background: '#FFFFFF',
          padding: '28px 24px 22px', textAlign: 'center', outline: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        <IconTile icon={isWin ? 'trophy' : isTie ? 'hearts' : 'heart'} size={68} bg={isWin ? TINT.amber : TINT.love} />
        <h2 id={titleId} style={{ margin: '16px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>{subtitle}</p>

        {/* Last week's two totals, the same read-out as the battle card. */}
        <div style={{
          marginTop: 18, width: '100%', boxSizing: 'border-box', padding: '12px 18px', borderRadius: 20,
          background: M.soft, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <FinalScore label="You" score={row.score} />
          <FinalScore label={partnerFirstName} score={row.partner_score} right />
        </div>

        <PrimaryButton
          onClick={handlePrimary}
          busy={claiming}
          icon={isWin && !paid ? <MeadowIcon name="coin" /> : undefined}
          style={{ marginTop: 20 }}
        >
          {isWin && !paid ? `Claim ${WEEKLY_PAYOUT_COINS} coins` : isWin ? 'Continue' : isTie ? 'Nice' : 'Next week'}
        </PrimaryButton>

        <span style={{ marginTop: 14, ...TYPE.label, color: M.label }}>{weekLabel(row.iso_week)}</span>
      </div>

      {burst !== null && <CoinPayoutBurst coins={burst} onDone={onClose} />}
    </div>
  )
}

function FinalScore({ label, score, right }: { label: string; score: number; right?: boolean }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: right ? 'flex-end' : 'flex-start', minWidth: 0 }}>
      <span style={{ fontSize: 13, lineHeight: 1.2, fontWeight: 700, color: M.text2 }}>{label}</span>
      <span style={{ fontSize: 32, lineHeight: 1.1, ...TYPE.number }}>{score}</span>
    </span>
  )
}
