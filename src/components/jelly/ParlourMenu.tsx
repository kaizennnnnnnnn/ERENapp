'use client'

// ─── ParlourMenu ────────────────────────────────────────────────────────────
// The two games as Arcade-style tiles, side by side: a little scene of the
// game (GameScene), the name and one line of what you do, your best, today's duel, and
// a leaf Play bar at the foot so the tile says it is a button.

import { memo } from 'react'
import GameScene from './GameScene'
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, SectionLabel, Tag, FONT_ROUNDED } from '@/components/meadow'

export interface ParlourGame {
  id: 'run' | 'jump'
  title: string
  /** One short line: what you do in it. */
  blurb: string
  best: number
  mineToday: number
  theirsToday: number
  theirName: string | null
}

interface Props {
  games: ParlourGame[]
  loaded: boolean
  onPlay: (id: 'run' | 'jump') => void
}

const ParlourMenu = memo(function ParlourMenu({ games, loaded, onPlay }: Props) {
  return (
    <section aria-labelledby="parlour-games">
      <SectionLabel id="parlour-games">Win a round</SectionLabel>
      {loaded ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {games.map(g => <GameTile key={g.id} game={g} onPlay={() => onPlay(g.id)} />)}
        </div>
      ) : (
        <p role="status" style={{ margin: 0, padding: '28px 0', textAlign: 'center', fontSize: 14, fontWeight: 700, color: M.text2 }}>
          Loading
        </p>
      )}
    </section>
  )
})

export default ParlourMenu

// ─── One game ────────────────────────────────────────────────────────────────
function GameTile({ game, onPlay }: { game: ParlourGame; onPlay: () => void }) {
  // Who leads today. Only meaningful once they have actually played: an
  // unplayed 0 is not a score you beat.
  const duel = game.theirName == null || game.theirsToday === 0
    ? null
    : game.mineToday > game.theirsToday ? 'ahead'
      : game.mineToday < game.theirsToday ? 'behind' : 'level'
  const theirFirst = (game.theirName ?? '').split(' ')[0]

  return (
    <button
      type="button"
      onClick={() => { playSound('ui_select'); onPlay() }}
      className="m-press m-focus"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0, boxSizing: 'border-box',
        padding: 12, border: 0, borderRadius: 22, background: '#FFFFFF', textAlign: 'left',
        fontFamily: FONT_ROUNDED, color: M.text, cursor: 'pointer',
      }}>
      {/* A little scene of the game itself. */}
      <GameScene game={game.id} />

      <span style={{ marginTop: 10, fontSize: 16, lineHeight: 1.2, fontWeight: 800 }}>{game.title}</span>
      <span style={{ marginTop: 2, fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{game.blurb}</span>

      <span className="flex flex-wrap" style={{ gap: 5, marginTop: 8 }}>
        <Tag size="sm" tone="soft" style={{ fontVariantNumeric: 'tabular-nums' }}>Best {game.best}</Tag>
        {duel ? (
          <Tag size="sm" tone={duel === 'ahead' ? 'leaf' : duel === 'behind' ? 'epic' : 'soft'}
            style={{ fontVariantNumeric: 'tabular-nums' }}>
            vs {theirFirst} {game.mineToday}–{game.theirsToday}
          </Tag>
        ) : game.mineToday > 0 ? (
          <Tag size="sm" tone="soft" style={{ fontVariantNumeric: 'tabular-nums' }}>Today {game.mineToday}</Tag>
        ) : null}
      </span>

      {/* The part that says the tile is a button. */}
      <span aria-hidden className="flex items-center justify-center" style={{
        marginTop: 'auto', paddingTop: 10,
      }}>
        <span className="flex items-center justify-center w-full" style={{
          height: 38, gap: 4, borderRadius: 12, background: M.leaf, boxShadow: `0 3px 0 ${M.leafLip}`,
          color: '#FFFFFF', fontSize: 15, fontWeight: 800,
        }}>
          Play
          <MeadowIcon name="chevronRight" size={18} color="#FFFFFF" mono />
        </span>
      </span>
    </button>
  )
}
