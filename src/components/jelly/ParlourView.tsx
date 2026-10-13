'use client'

// ─── ParlourView ────────────────────────────────────────────────────────────
// The Jelly Parlour hub: a Meadow page on the pink section ground. One card
// tells the whole loop (ParlourTray: today's five in an arch over the Super
// Jelly they make, the feed button, the road to the coat), and the two games
// sit under it as tiles, the way you win the five.
//
// Presentational only — the container (jelly/page.tsx) owns the tray, the duel
// standings, feeding and navigation, so this renders with mock data at mobile
// widths.

import ParlourTray from './ParlourTray'
import ParlourMenu, { type ParlourGame } from './ParlourMenu'
import type { JellyDef } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, MeadowPage } from '@/components/meadow'

export type { ParlourGame }

interface Props {
  tray: { jelly: JellyDef; filled: boolean }[]
  trayCount: number
  traySize: number
  supers: number
  fed: number
  feedGoal: number
  ownsSkin: boolean
  feeding: boolean
  loaded: boolean
  /** The Parlour's tables are missing; say so instead of showing an empty tray. */
  blocked: boolean
  games: ParlourGame[]
  onPlay: (id: 'run' | 'jump') => void
  onFeed: () => void
  onOpenCloset: () => void
  onBack: () => void
}

export default function ParlourView({
  tray, trayCount, traySize, supers, fed, feedGoal, ownsSkin, feeding, loaded, blocked,
  games, onPlay, onFeed, onOpenCloset, onBack,
}: Props) {
  return (
    <MeadowPage ground="us" title="Jelly Parlour" withNav={false}
      back={{ onClick: () => { playSound('ui_back'); onBack() } }}>
      {blocked && (
        /* Without this the tray just sits at 0/5 for ever and every round
           quietly pays nothing — which reads as "the game is broken", not as
           "one SQL file has not been run yet". */
        <div role="alert" className="flex items-start" style={{
          gap: 10, marginBottom: 12, padding: '12px 14px', borderRadius: 18, background: M.dangerTint,
        }}>
          <MeadowIcon name="flag" size={18} color={M.danger} mono style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, fontWeight: 600, color: M.text }}>
            The Parlour can&apos;t reach its shelf, so nothing you win will stick.
            Run <strong>supabase/migration_jelly_progress.sql</strong> once in the
            Supabase SQL editor.
          </p>
        </div>
      )}

      <ParlourTray
        tray={tray} count={trayCount} size={traySize}
        supers={supers} fed={fed} goal={feedGoal} ownsSkin={ownsSkin}
        busy={feeding} loading={!loaded} onFeed={onFeed} onOpenCloset={onOpenCloset} />

      <ParlourMenu games={games} loaded={loaded} onPlay={onPlay} />
    </MeadowPage>
  )
}
