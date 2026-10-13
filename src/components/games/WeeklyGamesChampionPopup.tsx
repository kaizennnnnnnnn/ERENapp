'use client'

// WeeklyGamesChampionPopup — surfaces last week's ARCADE result on load.
// The metric is GAMES WON (who took the higher score in more games), not a
// summed score. Everyone gets a payout: champion/tie = 100, loser = 25.
// Tapping any action (or outside the card) stamps acknowledged=true
// server-side so it never reappears for that week.
//
// Drawn like couple/WeeklyChampionPopup, its care-battle twin: a white Meadow
// card over a dimmed page, one leaf button, no glow and no blur. A centred
// modal rather than a Sheet so the coin burst can paint above it.

import { useEffect, useId, useRef, useState } from 'react'
import type { WeeklyGameRow } from '@/lib/gameWeekly'
import { SOLO_VARIETY_TARGET } from '@/lib/gameRewards'
import { IconTile, M, MeadowIcon, PrimaryButton, TINT, TYPE } from '@/components/meadow'
import { playSound } from '@/lib/sounds'
import CoinPayoutBurst from '@/components/CoinPayoutBurst'

interface Props {
  row: WeeklyGameRow
  partnerFirstName: string
  /** Household of one: the week was a variety goal, not a contest. */
  solo?: boolean
  onClaim: () => Promise<number>   // returns coins credited (0 if nothing/already)
  onClose: () => void
}

/** "2026-W38" -> "Week 38". */
function weekLabel(isoWeek: string): string {
  const m = /W(\d+)/.exec(isoWeek)
  return m ? `Week ${Number(m[1])}` : isoWeek
}

export default function WeeklyGamesChampionPopup({ row, partnerFirstName, solo = false, onClaim, onClose }: Props) {
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
    if (credited > 0) {
      // Coins are banked — let the player watch them land before we close.
      setPaid(true)
      setBurst(credited)
      return
    }
    playSound('ui_modal_close')
    onClose()
  }

  // Escape does what a tap outside does: the same as the button.
  const primaryRef = useRef(handlePrimary)
  primaryRef.current = handlePrimary
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') primaryRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const isWin = row.outcome === 'win'
  const isTie = row.outcome === 'tie'

  // Solo, `games_won` is the number of DIFFERENT games played (with no
  // opponent every game with a score counts), and the week was a variety goal
  // rather than a contest — so nothing here may name or imply a second player.
  const title = solo
    ? (isWin ? 'Arcade explorer' : 'Good games')
    : isWin ? 'Games champion' : isTie ? 'Dead heat' : 'Good games'
  const subtitle = solo
    ? (isWin
        ? `You played ${row.games_won} different games last week!`
        : `You played ${row.games_won} of ${SOLO_VARIETY_TARGET} different games.`)
    : isWin
      ? 'You won more games last week!'
      : isTie
        ? `You and ${partnerFirstName} won the same number of games.`
        : `${partnerFirstName} won more games last week.`

  const canClaim = !paid && row.payout_coins > 0

  return (
    <div
      className="meadow-root"
      onClick={handlePrimary}
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
        <IconTile icon={isWin ? 'trophy' : 'pad'} size={68} bg={isWin ? TINT.amber : isTie ? TINT.soft : TINT.lilac} />
        <h2 id={titleId} style={{ margin: '16px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>{subtitle}</p>

        {/* Games won. Solo there is no VS — just the count against the goal,
            or "You 4 vs Partner 0" reads as a no-show opponent. */}
        <div style={{
          marginTop: 18, width: '100%', boxSizing: 'border-box', padding: '12px 18px', borderRadius: 20,
          background: M.soft,
        }}>
          {solo ? (
            <span style={{ display: 'block', fontSize: 32, lineHeight: 1.1, ...TYPE.number }}>
              {row.games_won}
              <span style={{ fontSize: 17, color: M.text2 }}> of {SOLO_VARIETY_TARGET}</span>
            </span>
          ) : (
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FinalScore label="You" score={row.games_won} />
              <FinalScore label={partnerFirstName} score={row.partner_games_won} right />
            </span>
          )}
          <span style={{ display: 'block', marginTop: 4, ...TYPE.label, color: M.label }}>
            {solo ? 'Different games played' : 'Games won'}
          </span>
        </div>

        <PrimaryButton
          onClick={handlePrimary}
          busy={claiming}
          icon={canClaim ? <MeadowIcon name="coin" /> : undefined}
          style={{ marginTop: 20 }}
        >
          {canClaim ? `Claim ${row.payout_coins} coins` : isWin ? 'Continue' : isTie ? 'Nice' : 'Next week'}
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
