'use client'

// ─── ParlourMenu ────────────────────────────────────────────────────────────
// The two games, as white Meadow cards under "Today we play". Each card is
// one button: the game's jelly served on its plate, the name and what you do,
// your best and today's duel as tags, and the leaf play circle on the right
// that says the card is something you tap.

import { memo } from 'react'
import { JELLIES } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, SectionLabel, Tag, FONT_ROUNDED } from '@/components/meadow'

export interface ParlourGame {
  id: 'run' | 'jump'
  title: string
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

/** The jelly served on each game's plate. Fixed per game so the board is stable. */
const PLATE: Record<'run' | 'jump', number> = { run: 0, jump: 2 }

const ParlourMenu = memo(function ParlourMenu({ games, loaded, onPlay }: Props) {
  return (
    <section aria-labelledby="parlour-games">
      <SectionLabel id="parlour-games">Today we play</SectionLabel>
      {loaded ? (
        <div className="flex flex-col" style={{ gap: 10 }}>
          {games.map(g => <GameCard key={g.id} game={g} onPlay={() => onPlay(g.id)} />)}
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
function GameCard({ game, onPlay }: { game: ParlourGame; onPlay: () => void }) {
  const jelly = JELLIES[PLATE[game.id]]
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
      className="m-press m-focus w-full flex items-center text-left"
      style={{
        gap: 12, padding: 12, border: 0, borderRadius: 22, background: '#FFFFFF',
        fontFamily: FONT_ROUNDED, color: M.text, cursor: 'pointer',
      }}>
      {/* Served on its plate. */}
      <span className="relative flex items-end justify-center flex-shrink-0" style={{
        width: 64, height: 64, borderRadius: 18, background: `${jelly.colour}2E`,
      }}>
        <span aria-hidden style={{
          position: 'absolute', bottom: 8, width: 46, height: 9, borderRadius: '50%', background: '#FFFFFF',
        }} />
        <img src={jelly.art} alt="" draggable={false} style={{
          position: 'relative', width: 44, height: 44, marginBottom: 11,
          objectFit: 'contain', imageRendering: 'auto',
          animation: 'parlourJiggle 2.8s ease-in-out infinite',
        }} />
      </span>

      <span className="flex-1" style={{ minWidth: 0 }}>
        <span className="block" style={{ fontSize: 17, lineHeight: 1.2, fontWeight: 800 }}>{game.title}</span>
        <span className="block" style={{ marginTop: 3, fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
          {game.blurb}
        </span>
        <span className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 8 }}>
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
      </span>

      {/* The play circle: the part that says the card is a button. */}
      <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
        width: 44, height: 44, borderRadius: 999, background: M.leaf, boxShadow: `0 3px 0 ${M.leafLip}`,
      }}>
        <MeadowIcon name="chevronRight" size={24} color="#FFFFFF" mono />
      </span>
    </button>
  )
}
