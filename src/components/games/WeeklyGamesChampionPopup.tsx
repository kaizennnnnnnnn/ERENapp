'use client'

// WeeklyGamesChampionPopup — surfaces last week's ARCADE result on load.
// The metric is GAMES WON (who took the higher score in more games), not a
// summed score. Everyone gets a payout: champion/tie = 100, loser = 25.
// Tapping any action stamps acknowledged=true server-side so it never
// reappears for that week. Mirrors couple/WeeklyChampionPopup.

import { useEffect, useState } from 'react'
import type { WeeklyGameRow } from '@/lib/gameWeekly'
import {
  PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN,
  Rivets, pinkText,
} from '@/components/obsidian'
import { IconCrown, IconCoin, IconController } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

interface Props {
  row: WeeklyGameRow
  partnerFirstName: string
  onClaim: () => Promise<number>   // returns coins credited (0 if nothing/already)
  onClose: () => void
}

export default function WeeklyGamesChampionPopup({ row, partnerFirstName, onClaim, onClose }: Props) {
  const [claiming, setClaiming] = useState(false)
  const [paid, setPaid] = useState(row.payout_paid)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (row.outcome === 'win') playSound('ui_modal_open')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrimary = async () => {
    if (claiming) return
    setClaiming(true)
    playSound('ui_modal_close')
    const credited = await onClaim()
    if (credited > 0) setPaid(true)
    onClose()
  }

  const isWin = row.outcome === 'win'
  const isTie = row.outcome === 'tie'

  const accent = isWin
    ? { hi: '#FFD650', glow: 'rgba(255,215,80,0.45)' }
    : isTie
      ? { hi: '#D8D8E0', glow: 'rgba(180,180,200,0.35)' }
      : { hi: '#C4B5FD', glow: 'rgba(167,139,250,0.4)' }

  const title = isWin ? 'GAMES CHAMPION' : isTie ? 'DEAD HEAT' : 'GOOD GAMES'
  const subtitle = isWin
    ? 'You won more games last week!'
    : isTie
      ? `You and ${partnerFirstName} won the same number of games.`
      : `${partnerFirstName} won more games last week.`

  const canClaim = !paid && row.payout_coins > 0

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-5"
      style={{
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(2px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 220ms ease-out',
      }}
      onClick={handlePrimary}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-[340px] p-5"
        style={{
          ...OBSIDIAN_FACE,
          border: `2px solid ${accent.hi}`,
          boxShadow: `0 0 24px ${accent.glow}, 0 8px 32px rgba(0,0,0,0.6)`,
          transform: mounted ? 'scale(1)' : 'scale(0.85)',
          transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <Rivets inset={4} size={3} />

        <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${accent.hi} 0, ${accent.hi} 2px, transparent 2px, transparent 8px)`,
        }} />

        <div className="relative text-center">
          <div className="flex justify-center mb-3" style={{ filter: `drop-shadow(0 0 8px ${accent.glow})` }}>
            {isWin ? <IconCrown size={48} /> : <IconController size={40} />}
          </div>

          <p className="font-pixel" style={{
            fontSize: 12, letterSpacing: 2.5, color: accent.hi,
            textShadow: `0 0 6px ${accent.glow}`, marginBottom: 6,
          }}>{title}</p>

          <p className="text-sm mb-4" style={{ color: PINK_LO }}>{subtitle}</p>

          {/* Games-won line */}
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="text-center">
              <p className="font-pixel" style={{ fontSize: 5, color: PINK_HI, letterSpacing: 1.5, marginBottom: 2 }}>YOU</p>
              <p className="font-pixel" style={{ fontSize: 22, lineHeight: 1, ...pinkText }}>{row.games_won}</p>
            </div>
            <span className="font-pixel" style={{ fontSize: 9, color: '#7A6A75' }}>VS</span>
            <div className="text-center">
              <p className="font-pixel" style={{ fontSize: 5, color: '#C4B5FD', letterSpacing: 1.5, marginBottom: 2 }}>
                {partnerFirstName.toUpperCase()}
              </p>
              <p className="font-pixel" style={{ fontSize: 22, lineHeight: 1, color: '#D8B4FE' }}>{row.partner_games_won}</p>
            </div>
          </div>
          <p className="font-pixel mb-5" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 2 }}>GAMES WON</p>

          {canClaim ? (
            <button
              onClick={handlePrimary}
              disabled={claiming}
              className="w-full px-4 py-3 flex items-center justify-center gap-2 relative active:translate-y-[1px] transition-transform"
              style={{
                ...OBSIDIAN_BTN,
                border: `1.5px solid ${accent.hi}`,
                boxShadow: `0 0 14px ${accent.glow}, ${OBSIDIAN_BTN.boxShadow}`,
                opacity: claiming ? 0.6 : 1,
              }}
            >
              <Rivets inset={3} size={2} />
              <IconCoin size={14} />
              <span className="font-pixel" style={{
                fontSize: 9, letterSpacing: 1.5, color: accent.hi,
                textShadow: `0 0 6px ${accent.glow}`,
              }}>
                CLAIM +{row.payout_coins}
              </span>
            </button>
          ) : (
            <button
              onClick={handlePrimary}
              className="w-full px-4 py-3 relative active:translate-y-[1px] transition-transform"
              style={{ ...OBSIDIAN_BTN, border: `1px solid ${accent.hi}` }}
            >
              <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 1.5, ...pinkText }}>
                {isWin ? 'CONTINUE' : isTie ? 'NICE' : 'NEXT WEEK'}
              </span>
            </button>
          )}

          <p className="font-pixel mt-3" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 1.5 }}>
            {row.iso_week}
          </p>
        </div>
      </div>
    </div>
  )
}
