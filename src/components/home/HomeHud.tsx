'use client'

// ─── Home HUD row ────────────────────────────────────────────────────────────
// The strip under the stats header: the quests bar, then the room's own
// shortcuts (fortune gift when one is waiting, the Hallway, the Trophy Room,
// reminders, the Closet), then the co-op goal bar under it all.
//
// Us, Me and Rooms used to live in this row too. They are tabs of the bottom
// nav now (the Us tab carries the unread dot this row's heart used to), so
// the row keeps only what belongs to the living room.
//
// Presentational: the page wires the data and passes the two live pieces
// (the quests bar and the co-op bar) in as slots.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconBell, IconDress, IconGift, IconPhoto, IconTrophyTier } from '@/components/PixelIcons'
import { cuteBtn, CuteIcon } from '@/components/obsidian'
import { playSound } from '@/lib/sounds'
import { HEADER_CLEARANCE } from '@/components/meadow/tokens'

export interface HomeHudProps {
  /** The quests bar (TaskPanel compact); flexes to fill the row. */
  quests: ReactNode
  /** Under the row: the co-op goal bar. */
  footer?: ReactNode
  fortuneAvailable: boolean
  /** Spendable trophies; 0 hides the badge (pass 0 while unloaded, never a guess). */
  trophyBalance: number
  /** New, unseen skins; 0 hides the badge. */
  newSkinCount: number
  onOpenFortune: () => void
  onOpenReminders: () => void
}

const BADGE_RED = {
  width: 16, height: 16, background: '#FF1D5E', border: '2px solid #050507',
  boxShadow: '0 0 4px rgba(255,29,94,0.6)', borderRadius: 6,
} as const

export default function HomeHud({
  quests, footer, fortuneAvailable, trophyBalance, newSkinCount, onOpenFortune, onOpenReminders,
}: HomeHudProps) {
  const tap = () => playSound('ui_tap')
  return (
    <div className="absolute left-0 right-0 z-10 px-3" style={{ top: `calc(var(--safe-top) + ${HEADER_CLEARANCE}px)` }}>
      <div className="flex items-center gap-1">
        {/* Quests — flexes to take remaining space */}
        <div className="flex-1 min-w-0">{quests}</div>

        {fortuneAvailable && (
          <button type="button" onClick={onOpenFortune} aria-label="Fortune gift"
            className="w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
            style={{ ...cuteBtn('217,199,247'), animation: 'homeNavIn 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s backwards, pulse 2s ease-in-out 0.6s infinite' }}>
            <CuteIcon><IconGift size={22} /></CuteIcon>
          </button>
        )}
        <Link href="/hallway" onClick={tap} aria-label="The Hallway"
          className="home-nav-pop w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
          style={{ ...cuteBtn('191,224,255'), animationDelay: '0.2s' }}>
          <CuteIcon><IconPhoto size={22} /></CuteIcon>
        </Link>
        <Link href="/trophies" onClick={tap}
          aria-label={trophyBalance > 0 ? `Trophy room, ${trophyBalance} to spend` : 'Trophy room'}
          className="home-nav-pop w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
          style={{ ...cuteBtn('251,214,120'), animationDelay: '0.25s' }}>
          <CuteIcon><IconTrophyTier size={20} tier="gold" /></CuteIcon>
          {trophyBalance > 0 && (
            <div className="absolute -top-1 -right-1 flex items-center justify-center"
              style={{
                minWidth: 16, height: 16, padding: '0 3px',
                background: '#F5C842', border: '2px solid #050507',
                boxShadow: '0 0 5px rgba(245,200,66,0.65)', borderRadius: 6,
              }}>
              <span className="font-pixel" style={{ fontSize: 5, color: '#3A2400' }}>{trophyBalance}</span>
            </div>
          )}
        </Link>
        <button type="button" onClick={onOpenReminders} aria-label="Reminders"
          className="home-nav-pop w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
          style={{ ...cuteBtn('251,228,154'), animationDelay: '0.3s' }}>
          <CuteIcon><IconBell size={18} /></CuteIcon>
        </button>
        <Link href="/closet" onClick={tap}
          aria-label={newSkinCount > 0 ? `Closet, ${newSkinCount} new` : 'Closet'}
          className="home-nav-pop w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
          style={{ ...cuteBtn('199,225,255'), animationDelay: '0.35s' }}>
          <CuteIcon><IconDress size={20} /></CuteIcon>
          {/* New, unseen skins won from gacha — clears when the Closet opens. */}
          {newSkinCount > 0 && (
            <div className="absolute -top-1 -right-1 flex items-center justify-center" style={BADGE_RED}>
              <span className="font-pixel text-white" style={{ fontSize: 5 }}>{newSkinCount > 9 ? '9+' : newSkinCount}</span>
            </div>
          )}
        </Link>
      </div>

      {footer}
    </div>
  )
}
