'use client'

// ─── Home HUD row ────────────────────────────────────────────────────────────
// The strip under the stats header: the quests bar, then the room's own
// shortcuts (today's wish, the fortune gift when one is waiting, the Hallway,
// the bucket list, the Catnip Shop, reminders, the Closet), then the co-op
// goal bar under it all.
//
// Us, Me and Rooms used to live in this row too. They are tabs of the bottom
// nav now (the Us tab carries the unread dot this row's heart used to), so
// the row keeps only what belongs to the living room.
//
// In the Meadow look: white pieces over the room art, like the top bar's (the
// over-art lip, no border, no glow). The quests pill takes what's left of the
// row; each shortcut is a white circle with its icon in colour, and a count
// rides on it as a small ringed badge.
//
// Presentational: the page wires the data and passes the two live pieces
// (the quests bar and the co-op bar) in as slots.

import type { ReactNode } from 'react'
import { playSound } from '@/lib/sounds'
import { HEADER_CLEARANCE, M, MeadowIcon, RoundButton } from '@/components/meadow'
import WishButton, { type WishButtonProps } from './WishButton'
import HudBadge, { HUD_BUTTON } from './HudBadge'

export interface HomeHudProps {
  /** The quests bar (TaskPanel); flexes to fill the row. */
  quests: ReactNode
  /** Under the row: the co-op goal bar. */
  footer?: ReactNode
  /** Today's wish; null while it loads (or on a day without one). */
  wish: WishButtonProps | null
  fortuneAvailable: boolean
  /** Spendable catnip (stored as profiles.trophies); 0 hides the badge (pass 0 while unloaded, never a guess). */
  trophyBalance: number
  /** New, unseen skins; 0 hides the badge. */
  newSkinCount: number
  /** Plans the partner added since this phone last opened the list; 0 hides the badge. */
  newPlanCount: number
  onOpenFortune: () => void
  onOpenReminders: () => void
}

export default function HomeHud({
  quests, footer, wish, fortuneAvailable, trophyBalance, newSkinCount, newPlanCount, onOpenFortune, onOpenReminders,
}: HomeHudProps) {
  const tap = () => playSound('ui_tap')
  // The pop-in, one after another along the row. position: relative holds
  // each badge to its circle.
  const pop = (delay: number) => ({ position: 'relative' as const, animationDelay: `${delay}s` })
  return (
    <div className="meadow-root absolute left-0 right-0 z-10"
      style={{ top: `calc(var(--safe-top) + ${HEADER_CLEARANCE}px)`, padding: '0 16px' }}>
      {/* relative: the wish card folds out under the whole row. */}
      <div className="relative flex items-center" style={{ gap: 6 }}>
        {/* Quests — flexes to take remaining space */}
        <div className="flex-1 min-w-0">{quests}</div>

        {wish && <WishButton {...wish} />}

        {fortuneAvailable && (
          <RoundButton surface="art" size={HUD_BUTTON} ariaLabel="Fortune gift" onClick={onOpenFortune}
            className="home-nav-pop" style={pop(0.15)}>
            {/* Hops while it waits to be opened. */}
            <span style={{ display: 'block', lineHeight: 0, animation: 'hudGiftHop 1.6s 0.6s infinite' }}>
              <MeadowIcon name="gift" size={20} />
            </span>
          </RoundButton>
        )}
        <RoundButton surface="art" size={HUD_BUTTON} href="/hallway" onClick={tap} ariaLabel="The Hallway"
          className="home-nav-pop" style={pop(0.2)}>
          <MeadowIcon name="photo" size={20} color="#6FA3D2" />
        </RoundButton>
        <RoundButton surface="art" size={HUD_BUTTON} href="/bucket-list" onClick={tap}
          ariaLabel={newPlanCount > 0 ? `Bucket list, ${newPlanCount} new` : 'Bucket list'}
          className="home-nav-pop" style={pop(0.22)}>
          <MeadowIcon name="checklist" size={20} />
          {newPlanCount > 0 && <HudBadge>{newPlanCount > 9 ? '9+' : newPlanCount}</HudBadge>}
        </RoundButton>
        <RoundButton surface="art" size={HUD_BUTTON} href="/trophies" onClick={tap}
          ariaLabel={trophyBalance > 0 ? `Catnip shop, ${trophyBalance} catnip to spend` : 'Catnip shop'}
          className="home-nav-pop" style={pop(0.25)}>
          <MeadowIcon name="catnip" size={22} />
          {trophyBalance > 0 && <HudBadge bg={M.leaf}>{trophyBalance}</HudBadge>}
        </RoundButton>
        <RoundButton surface="art" size={HUD_BUTTON} onClick={onOpenReminders} ariaLabel="Reminders"
          className="home-nav-pop" style={pop(0.3)}>
          <MeadowIcon name="bell" size={20} color={M.energy} />
        </RoundButton>
        <RoundButton surface="art" size={HUD_BUTTON} href="/closet" onClick={tap}
          ariaLabel={newSkinCount > 0 ? `Closet, ${newSkinCount} new` : 'Closet'}
          className="home-nav-pop" style={pop(0.35)}>
          <MeadowIcon name="dress" size={20} />
          {/* New, unseen skins won from gacha — clears when the Closet opens. */}
          {newSkinCount > 0 && <HudBadge>{newSkinCount > 9 ? '9+' : newSkinCount}</HudBadge>}
        </RoundButton>
      </div>

      {footer}
    </div>
  )
}
