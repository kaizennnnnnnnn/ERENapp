'use client'

// WeeklyChampionPopup — Monday-morning modal that surfaces last week's
// Care Battle result. Three variants:
//   - win  → trophy + 100-coin payout claim (one-shot)
//   - loss → quieter "good run" message, no payout
//   - tie  → neutral both-equal message, no payout
// Tapping ANY action stamps acknowledged=true server-side so the popup
// never reappears for that week, even on a fresh page load.

import { useEffect, useState } from 'react'
import type { WeeklyBattleRow } from '@/lib/battleResults'
import { WEEKLY_PAYOUT_COINS } from '@/lib/battleResults'
import {
  PINK, PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN,
  Rivets, pinkText, accentA,
} from '@/components/obsidian'
import { IconCrown, IconCoin, IconSwords, IconHeart } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

interface Props {
  row: WeeklyBattleRow
  partnerFirstName: string
  onClaim: () => Promise<boolean>  // returns true if coins were credited
  onClose: () => void
}

export default function WeeklyChampionPopup({ row, partnerFirstName, onClaim, onClose }: Props) {
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
    if (credited) setPaid(true)
    onClose()
  }

  const isWin  = row.outcome === 'win'
  const isLoss = row.outcome === 'loss'
  const isTie  = row.outcome === 'tie'

  // ── Theme per outcome ──
  const accent = isWin
    ? { rgb: '255,215,80', hi: '#FFD650', glow: 'rgba(255,215,80,0.45)' }
    : isTie
      ? { rgb: '180,180,200', hi: '#D8D8E0', glow: 'rgba(180,180,200,0.35)' }
      : { rgb: '167,139,250', hi: '#C4B5FD', glow: 'rgba(167,139,250,0.4)' }

  const title = isWin
    ? 'WEEKLY CHAMPION'
    : isTie
      ? 'A PERFECT TIE'
      : 'GOOD RUN'

  const subtitle = isWin
    ? 'You won last week\'s Care Battle!'
    : isTie
      ? `You and ${partnerFirstName} finished dead even.`
      : `${partnerFirstName} edged ahead last week.`

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-5"
      style={{
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(2px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 220ms ease-out',
      }}
      onClick={onClose}
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

        {/* Diagonal scanline overlay — same as Care Battle for continuity */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${accent.hi} 0, ${accent.hi} 2px, transparent 2px, transparent 8px)`,
        }} />

        <div className="relative text-center">
          {/* Crown / icon */}
          <div className="flex justify-center mb-3" style={{ filter: `drop-shadow(0 0 8px ${accent.glow})` }}>
            {isWin
              ? <IconCrown size={48} />
              : isTie
                ? <IconSwords size={40} />
                : <IconHeart size={40} />}
          </div>

          {/* Title */}
          <p className="font-pixel" style={{
            fontSize: 12, letterSpacing: 2.5, color: accent.hi,
            textShadow: `0 0 6px ${accent.glow}`,
            marginBottom: 6,
          }}>{title}</p>

          {/* Subtitle */}
          <p className="text-sm mb-4" style={{ color: PINK_LO }}>
            {subtitle}
          </p>

          {/* Score line */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="text-center">
              <p className="font-pixel" style={{ fontSize: 5, color: PINK_HI, letterSpacing: 1.5, marginBottom: 2 }}>YOU</p>
              <p className="font-pixel" style={{ fontSize: 22, lineHeight: 1, ...pinkText }}>{row.score}</p>
            </div>
            <span className="font-pixel" style={{ fontSize: 9, color: '#7A6A75' }}>VS</span>
            <div className="text-center">
              <p className="font-pixel" style={{ fontSize: 5, color: '#C4B5FD', letterSpacing: 1.5, marginBottom: 2 }}>
                {partnerFirstName.toUpperCase()}
              </p>
              <p className="font-pixel" style={{ fontSize: 22, lineHeight: 1, color: '#D8B4FE' }}>{row.partner_score}</p>
            </div>
          </div>

          {/* Action button */}
          {isWin && !paid && (
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
                CLAIM +{WEEKLY_PAYOUT_COINS}
              </span>
            </button>
          )}
          {(!isWin || paid) && (
            <button
              onClick={handlePrimary}
              className="w-full px-4 py-3 relative active:translate-y-[1px] transition-transform"
              style={{
                ...OBSIDIAN_BTN,
                border: `1px solid ${accent.hi}`,
              }}
            >
              <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 1.5, ...pinkText }}>
                {isWin ? 'CONTINUE' : isTie ? 'NICE' : 'NEXT WEEK'}
              </span>
            </button>
          )}

          {/* Hairline week label */}
          <p className="font-pixel mt-3" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 1.5 }}>
            {row.iso_week}
          </p>
        </div>
      </div>
    </div>
  )
}
