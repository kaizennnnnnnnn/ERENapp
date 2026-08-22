'use client'

// ─── ParlourMenu ────────────────────────────────────────────────────────────
// The two games, written up as the shop's chalkboard menu.
//
// The first pass gave each game a flat pink/blue gradient card with a rounded
// play circle — two of the same object in two hues, which is exactly the
// "default card grid" the project's design rules ban. A menu board fixes it at
// the concept level: one piece of furniture, two ENTRIES on it, with the
// hierarchy coming from a served jelly on a plate, chalk-weight type, and a
// brass token you press.
//
// Chalk is faked with colour and a soft edge, not with a font — the app is
// pixel-typed everywhere and swapping typefaces here would break the room
// before it charmed anyone.

import { memo } from 'react'
import { JELLIES } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'
import {
  INK, CREAM, WOOD, WOOD_DK, WOOD_LT, SLATE, SLATE_LT, CHALK,
  BRASS, BRASS_LT, BRASS_DK, LEAF, BERRY_DK, dropShadow,
} from './parlourTheme'

export interface ParlourGame {
  id: 'slice' | 'jump'
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
  onPlay: (id: 'slice' | 'jump') => void
}

/** The jelly served on each game's plate. Fixed per game so the board is stable. */
const PLATE: Record<'slice' | 'jump', number> = { slice: 0, jump: 2 }

const ParlourMenu = memo(function ParlourMenu({ games, loaded, onPlay }: Props) {
  return (
    <div className="relative" style={{
      borderRadius: 10, padding: 6,
      background: `linear-gradient(180deg, ${WOOD_LT} 0%, ${WOOD} 46%, ${WOOD_DK} 100%)`,
      border: `3px solid ${INK}`, boxShadow: dropShadow(5),
    }}>
      <div className="relative overflow-hidden" style={{
        borderRadius: 5,
        background: `linear-gradient(180deg, ${SLATE_LT} 0%, ${SLATE} 30%, #1D262D 100%)`,
        border: `2px solid ${INK}`,
      }}>
        {/* Chalk dust smeared across the top — the thing that stops a dark
            rectangle reading as an empty div. */}
        <span aria-hidden style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(80% 30% at 22% 6%, rgba(234,242,245,0.09) 0%, rgba(234,242,245,0) 70%), ' +
            'radial-gradient(60% 26% at 78% 52%, rgba(234,242,245,0.07) 0%, rgba(234,242,245,0) 70%)',
        }} />

        {/* Header, hand-written on the slate. */}
        <div className="relative flex items-center justify-center gap-2 pt-2.5 pb-1.5">
          <Squiggle />
          <span className="font-pixel" style={{
            fontSize: 8, color: CHALK, letterSpacing: 1.4, opacity: 0.92,
          }}>TODAY WE PLAY</span>
          <Squiggle flip />
        </div>

        {loaded ? (
          <div className="relative">
            {games.map((g, i) => (
              <div key={g.id}>
                {i > 0 && (
                  <div aria-hidden style={{
                    height: 2, margin: '0 12px',
                    background: 'repeating-linear-gradient(90deg, rgba(234,242,245,0.24) 0 5px, transparent 5px 11px)',
                  }} />
                )}
                <MenuRow game={g} onPlay={() => onPlay(g.id)} />
              </div>
            ))}
          </div>
        ) : (
          <p className="relative text-center font-pixel py-10" style={{ fontSize: 8, color: 'rgba(234,242,245,0.5)' }}>
            LOADING…
          </p>
        )}
      </div>
    </div>
  )
})

export default ParlourMenu

// ─── One entry ───────────────────────────────────────────────────────────────
function MenuRow({ game, onPlay }: { game: ParlourGame; onPlay: () => void }) {
  const jelly = JELLIES[PLATE[game.id]]
  // Who leads today. Only meaningful once she has actually played — an unplayed
  // 0 is not a score you beat.
  const duel = game.theirName == null || game.theirsToday === 0
    ? null
    : game.mineToday > game.theirsToday ? 'ahead'
      : game.mineToday < game.theirsToday ? 'behind' : 'level'

  return (
    <button onClick={() => { playSound('ui_select'); onPlay() }}
      className="relative w-full flex items-center gap-2.5 text-left px-2.5 py-2.5 active:translate-y-[1px] transition-transform">
      {/* Served on a plate. */}
      <span className="relative flex items-end justify-center flex-shrink-0" style={{ width: 46, height: 46 }}>
        <span aria-hidden style={{
          position: 'absolute', bottom: 0, width: 44, height: 10, borderRadius: '50%',
          background: `linear-gradient(180deg, ${CREAM}, #C9BBAE)`, border: `2px solid ${INK}`,
        }} />
        <span aria-hidden style={{
          position: 'absolute', bottom: 4, width: 40, height: 30, borderRadius: '50%',
          background: `radial-gradient(50% 60% at 50% 70%, ${jelly.colour}55, ${jelly.colour}00 72%)`,
        }} />
        <img src={jelly.art} alt="" draggable={false} style={{
          position: 'relative', width: 40, height: 40, marginBottom: 4,
          objectFit: 'contain', imageRendering: 'auto',
          animation: 'parlourJiggle 2.8s ease-in-out infinite',
        }} />
      </span>

      <span className="flex-1" style={{ minWidth: 0 }}>
        <span className="block font-pixel" style={{
          fontSize: 9, color: CHALK, letterSpacing: 0.5, marginBottom: 3,
          textShadow: '0 1px 0 rgba(0,0,0,0.55)',
        }}>{game.title}</span>
        <span className="block" style={{
          fontSize: 9.5, lineHeight: 1.4, color: 'rgba(234,242,245,0.66)', marginBottom: 5, paddingRight: 30,
        }}>{game.blurb}</span>

        <span className="flex items-center gap-1.5 flex-wrap">
          <Chip label="BEST" value={game.best} />
          {duel ? (
            <Chip
              label={`vs ${(game.theirName ?? '').slice(0, 7).toUpperCase()}`}
              value={`${game.mineToday}-${game.theirsToday}`}
              tone={duel === 'ahead' ? 'good' : duel === 'behind' ? 'bad' : 'even'}
            />
          ) : game.mineToday > 0 ? (
            <Chip label="TODAY" value={game.mineToday} />
          ) : null}
        </span>
      </span>

      {/* Brass token. Pressed, not tapped. */}
      <span aria-hidden className="absolute flex items-center justify-center" style={{
        right: 10, bottom: 12, width: 27, height: 27, borderRadius: '50%',
        background: `linear-gradient(180deg, ${BRASS_LT} 0%, ${BRASS} 55%, ${BRASS_DK} 100%)`,
        border: `2.5px solid ${INK}`, boxShadow: dropShadow(2),
      }}>
        <span style={{ fontSize: 10, color: INK, lineHeight: 1, marginLeft: 2 }}>&#9654;</span>
      </span>
    </button>
  )
}

function Chip({ label, value, tone = 'plain' }: {
  label: string; value: string | number; tone?: 'plain' | 'good' | 'bad' | 'even'
}) {
  const bg = tone === 'good' ? LEAF
    : tone === 'bad' ? BERRY_DK
      : tone === 'even' ? '#546C7E' : 'rgba(255,255,255,0.11)'
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-1" style={{
      background: bg, borderRadius: 5, border: '1.5px solid rgba(0,0,0,0.3)',
    }}>
      <span className="font-pixel" style={{ fontSize: 5, color: 'rgba(255,255,255,0.72)' }}>{label}</span>
      <span className="font-pixel" style={{ fontSize: 7, color: '#fff' }}>{value}</span>
    </span>
  )
}

function Squiggle({ flip = false }: { flip?: boolean }) {
  return (
    <span aria-hidden style={{
      width: 26, height: 3, borderRadius: 2, opacity: 0.5,
      background: `linear-gradient(${flip ? 270 : 90}deg, rgba(234,242,245,0) 0%, ${CHALK} 100%)`,
    }} />
  )
}
