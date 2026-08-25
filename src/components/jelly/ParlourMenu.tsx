'use client'

// ─── ParlourMenu ────────────────────────────────────────────────────────────
// The two games, written up as the shop's chalkboard menu.
//
// The first pass gave each game a flat pink/blue gradient card with a rounded
// play circle — two of the same object in two hues, which is exactly the
// "default card grid" the project's design rules ban. A menu board fixes it at
// the concept level: one piece of furniture, two ENTRIES on it.
//
// The second pass had the opposite failure: the entries were bare text on the
// slate with a 27px brass disc floating at the bottom-right corner, and nobody
// could tell they were buttons. Rows now sit on the board as raised TICKETS
// with a tear-off brass stub — a light panel on a dark board, a hard pixel
// shadow underneath, a press that actually moves, and a stub the width of a
// thumb that says PLAY. The whole ticket is the hit target; the stub is only
// how it announces itself.
//
// Chalk is faked with colour and a soft edge, not with a font — the app is
// pixel-typed everywhere and swapping typefaces here would break the room
// before it charmed anyone.

import { memo } from 'react'
import { JELLIES } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'
import {
  INK, CREAM, WOOD, WOOD_DK, WOOD_LT, SLATE, SLATE_LT, CHALK,
  BRASS, BRASS_LT, BRASS_DK, LEAF, BERRY_DK,
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
      borderRadius: 10, padding: 5,
      background: `linear-gradient(180deg, ${WOOD_LT} 0%, ${WOOD} 46%, ${WOOD_DK} 100%)`,
      border: `3px solid ${INK}`, boxShadow: `0 5px 0 ${INK}`,
    }}>
      <div className="relative overflow-hidden" style={{
        borderRadius: 5, padding: '0 7px 8px',
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
        <div className="relative flex items-center justify-center gap-2 pt-2.5 pb-2">
          <Squiggle />
          <span className="font-pixel" style={{
            fontSize: 8, color: CHALK, letterSpacing: 1.4, opacity: 0.92,
          }}>TODAY WE PLAY</span>
          <Squiggle flip />
        </div>

        {loaded ? (
          <div className="relative flex flex-col gap-2.5">
            {games.map(g => <MenuTicket key={g.id} game={g} onPlay={() => onPlay(g.id)} />)}
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

// ─── One ticket ──────────────────────────────────────────────────────────────
function MenuTicket({ game, onPlay }: { game: ParlourGame; onPlay: () => void }) {
  const jelly = JELLIES[PLATE[game.id]]
  // Who leads today. Only meaningful once she has actually played — an unplayed
  // 0 is not a score you beat.
  const duel = game.theirName == null || game.theirsToday === 0
    ? null
    : game.mineToday > game.theirsToday ? 'ahead'
      : game.mineToday < game.theirsToday ? 'behind' : 'level'

  return (
    <button
      onClick={() => { playSound('ui_select'); onPlay() }}
      aria-label={`Play ${game.title}`}
      className="parlour-ticket relative w-full flex items-stretch text-left overflow-hidden"
      style={{
        borderRadius: 8, border: `2.5px solid ${INK}`,
        background: 'linear-gradient(180deg, #45596A 0%, #354753 46%, #2A3843 100%)',
      }}>
      {/* Body */}
      <span className="flex-1 flex items-center gap-2.5 py-2.5 pl-2.5 pr-2" style={{ minWidth: 0 }}>
        {/* Served on a plate. */}
        <span className="relative flex items-end justify-center flex-shrink-0" style={{ width: 44, height: 44 }}>
          <span aria-hidden style={{
            position: 'absolute', bottom: 0, width: 42, height: 10, borderRadius: '50%',
            background: `linear-gradient(180deg, ${CREAM}, #C9BBAE)`, border: `2px solid ${INK}`,
          }} />
          <span aria-hidden style={{
            position: 'absolute', bottom: 4, width: 38, height: 30, borderRadius: '50%',
            background: `radial-gradient(50% 60% at 50% 70%, ${jelly.colour}66, ${jelly.colour}00 72%)`,
          }} />
          <img src={jelly.art} alt="" draggable={false} style={{
            position: 'relative', width: 38, height: 38, marginBottom: 4,
            objectFit: 'contain', imageRendering: 'auto',
            animation: 'parlourJiggle 2.8s ease-in-out infinite',
          }} />
        </span>

        <span className="flex-1" style={{ minWidth: 0 }}>
          <span className="block font-pixel" style={{
            fontSize: 9, color: CHALK, letterSpacing: 0.5, marginBottom: 3,
            textShadow: '0 1.5px 0 rgba(0,0,0,0.6)',
          }}>{game.title}</span>
          <span className="block" style={{
            fontSize: 9.5, lineHeight: 1.4, color: 'rgba(234,242,245,0.74)', marginBottom: 5,
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
      </span>

      {/* Tear-off stub. The whole ticket is tappable; this is the part that
          says so — full-height brass, a perforation, and a thumb-sized arrow. */}
      <span aria-hidden className="relative flex flex-col items-center justify-center flex-shrink-0" style={{
        width: 58, gap: 4,
        background: `linear-gradient(180deg, ${BRASS_LT} 0%, ${BRASS} 46%, ${BRASS_DK} 100%)`,
        borderLeft: `2.5px solid ${INK}`,
      }}>
        {/* Perforation. */}
        <span style={{
          position: 'absolute', left: 3, top: 4, bottom: 4, width: 2,
          background: `repeating-linear-gradient(180deg, ${INK}66 0 4px, transparent 4px 9px)`,
        }} />
        {/* A slow gleam travelling across the brass, so the stub reads as the
            live thing on the board rather than a printed panel. */}
        <span style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <span style={{
            position: 'absolute', top: -10, bottom: -10, width: 16,
            background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
            animation: 'parlourStubGleam 3.6s ease-in-out infinite',
          }} />
        </span>
        <span style={{
          position: 'relative', width: 0, height: 0, marginLeft: 3,
          borderTop: '9px solid transparent', borderBottom: '9px solid transparent',
          borderLeft: `13px solid ${INK}`,
        }} />
        <span className="relative font-pixel" style={{ fontSize: 7, color: INK, letterSpacing: 1 }}>PLAY</span>
      </span>
    </button>
  )
}

function Chip({ label, value, tone = 'plain' }: {
  label: string; value: string | number; tone?: 'plain' | 'good' | 'bad' | 'even'
}) {
  const bg = tone === 'good' ? LEAF
    : tone === 'bad' ? BERRY_DK
      : tone === 'even' ? '#546C7E' : 'rgba(12,18,23,0.5)'
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-1" style={{
      background: bg, borderRadius: 5,
      border: `1.5px solid ${tone === 'plain' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.35)'}`,
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
