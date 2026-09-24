'use client'

// ─── Arcade (the Play tab), presentational ───────────────────────────────────
// Meadow board A5 on the mint ground: title + coins, the "games won this week"
// strip, the wish card when today's wish is a game, and every game as a
// 2-column grid of tiles with the player's best.
//
// Plain props only: app/(app)/games/page.tsx owns every fetch and hook and
// hands this the results, so the same view renders from demo data in a
// preview. Numbers the page has not loaded yet arrive as null and draw a dash,
// never a confident 0 or "not played".

import Link from 'next/link'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import {
  CoinChip, MeadowPage, PrimaryButton, SectionLabel, Tag,
  GAME_ICON, GAME_TINT, M, MeadowIcon, TINT, FONT_ROUNDED, TYPE,
} from '@/components/meadow'
import CatPortrait from '@/components/cat/CatPortrait'
import type { CatLook } from '@/lib/catIdentity'
import type { GameType } from '@/types'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ArcadeGame {
  id: GameType
  href: string
  title: string
}

/** Per-game personal bests. null = not known yet (loading or a failed read). */
export type ArcadeScores = Partial<Record<GameType, number>> | null

export type ArcadeWeek =
  /** Loading, or the partner could not be read: no numbers we would stand behind. */
  | { kind: 'unknown'; myColor: string }
  | { kind: 'duo'; myColor: string; myWins: number; partnerName: string; partnerColor: string; partnerWins: number }
  /** A household of one: the week is a variety goal, not a contest (lib/gameWeekly). */
  | { kind: 'solo'; myColor: string; played: number; target: number; coins: number }

export interface ArcadeWish {
  game: ArcadeGame
  catName: string
  /** The household's cat; null draws the classic coat. */
  catLook: CatLook | null
  granted: boolean
}

export interface ArcadeViewProps {
  /** Wallet balance; null until the profile has loaded. */
  coins: number | null
  week: ArcadeWeek
  /** Today's wish, only when it is a game. */
  wish: ArcadeWish | null
  games: readonly ArcadeGame[]
  scores: ArcadeScores
  onOpenWeek?: () => void
  onGameTap?: (game: ArcadeGame) => void
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ArcadeView({
  coins, week, wish, games, scores, onOpenWeek, onGameTap,
}: ArcadeViewProps) {
  // The wished game gets the big card, so the grid leaves it out (the board
  // lists ten tiles under a Yarn Pop wish).
  const grid = wish ? games.filter(g => g.id !== wish.game.id) : games
  return (
    <MeadowPage ground="play" title="Arcade" action={<CoinChip amount={coins} surface="ground" />}>
      <WeekStrip week={week} onOpen={onOpenWeek} />

      {wish && <WishCard wish={wish} scores={scores} onPlay={onGameTap} />}

      <SectionLabel>All games</SectionLabel>
      <div style={GRID}>
        {grid.map(game => (
          <Tile
            key={game.id}
            href={game.href}
            onClick={onGameTap ? () => onGameTap(game) : undefined}
            icon={<MeadowIcon name={GAME_ICON[game.id] ?? 'pad'} size={36} />}
            tint={GAME_TINT[game.id] ?? TINT.soft}
            title={game.title}
            detail={<BestLine id={game.id} scores={scores} />}
            ariaLabel={`${game.title}, ${bestSpeech(game.id, scores)}`}
          />
        ))}
      </div>
    </MeadowPage>
  )
}

const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }

// ─── Scores ──────────────────────────────────────────────────────────────────

/** "1 480": a no-break space groups thousands, as the board sets them. */
function fmt(n: number): string {
  return n.toLocaleString('en-US').replace(/,/g, ' ')
}

const NUM: CSSProperties = { fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }

/**
 * Tic-tac-toe saves how many games you had won that sitting, not points
 * (games/tic-tac-toe records `score = wins` on each win), so its best reads
 * "9 wins".
 */
function BestLine({ id, scores }: { id: GameType; scores: ArcadeScores }) {
  if (scores === null) return <>Best <span style={NUM}>-</span></>
  const best = scores[id]
  if (!best) return <>Not played yet</>
  if (id === 'tic_tac_toe') return <><span style={NUM}>{fmt(best)}</span> {best === 1 ? 'win' : 'wins'}</>
  return <>Best <span style={NUM}>{fmt(best)}</span></>
}

function bestSpeech(id: GameType, scores: ArcadeScores): string {
  if (scores === null) return 'best score loading'
  const best = scores[id]
  if (!best) return 'not played yet'
  return id === 'tic_tac_toe' ? `best ${best} ${best === 1 ? 'win' : 'wins'} in one sitting` : `best ${best}`
}

// ─── Games won this week ─────────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0 }} />
}

const BIG_NUM: CSSProperties = { fontSize: 18, ...TYPE.number }

function WeekStrip({ week, onOpen }: { week: ArcadeWeek; onOpen?: () => void }) {
  let label: string
  let row: ReactNode
  let speech: string
  if (week.kind === 'solo') {
    const done = week.played >= week.target
    label = 'Different games this week'
    speech = done
      ? `${week.played} different games played this week, ${week.coins} coins on Monday`
      : `${week.played} of ${week.target} different games played this week, ${week.coins} coins at ${week.target}`
    // One player, so no "You" and no person dot (those tell two players
    // apart): the count alone fits a 360px phone, and the prize line gives
    // way with an ellipsis on anything narrower instead of wrapping.
    row = (
      <>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span style={BIG_NUM}>{week.played}</span>
          {!done && <span style={{ color: M.text2 }}>of {week.target}</span>}
        </span>
        <span aria-hidden style={{ color: M.faint }}>·</span>
        <span style={{
          color: done ? M.leaf : M.text2, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {done ? `${week.coins} coins on Monday` : `${week.coins} coins at ${week.target}`}
        </span>
      </>
    )
  } else if (week.kind === 'duo') {
    label = 'Games won this week'
    speech = `Games won this week: you ${week.myWins}, ${week.partnerName} ${week.partnerWins}`
    row = (
      <>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Dot color={week.myColor} />You <span style={BIG_NUM}>{week.myWins}</span>
        </span>
        <span aria-hidden style={{ color: M.faint }}>·</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Dot color={week.partnerColor} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{week.partnerName}</span>
          <span style={BIG_NUM}>{week.partnerWins}</span>
        </span>
      </>
    )
  } else {
    label = 'Games won this week'
    speech = 'Games won this week, loading'
    row = (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Dot color={week.myColor} />You <span style={BIG_NUM}>-</span>
      </span>
    )
  }

  const body = (
    <>
      <span aria-hidden style={{
        flex: '0 0 auto', width: 44, height: 44, borderRadius: 14, background: TINT.amber,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MeadowIcon name="trophy" />
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, lineHeight: 1.2, fontWeight: 700, color: M.text2 }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, minWidth: 0 }}>
          {row}
        </span>
      </span>
      {/* The strip opens the full weekly scoreboard (per-game standings, the
          reset countdown, last week's prize), which otherwise only the
          playroom reaches; the chevron says it is tappable. */}
      {onOpen && <MeadowIcon name="chevronRight" size={20} color={M.faint} style={{ flexShrink: 0 }} />}
    </>
  )
  const css: CSSProperties = {
    width: '100%', marginTop: 16, height: 72, boxSizing: 'border-box', borderRadius: 22, background: '#FFFFFF',
    padding: onOpen ? '0 12px 0 14px' : '0 18px 0 14px', border: 0,
    display: 'flex', alignItems: 'center', gap: 14, color: M.text, textAlign: 'left', fontFamily: FONT_ROUNDED,
  }
  if (!onOpen) return <div role="group" aria-label={speech} style={css}>{body}</div>
  return (
    <button type="button" onClick={onOpen} aria-label={`${speech}. Open the weekly scoreboard`}
      className="m-press m-focus" style={{ ...css, cursor: 'pointer' }}>
      {body}
    </button>
  )
}

// ─── Today's wish, when it is a game ─────────────────────────────────────────
// The scene is anchored to the card's bottom-right so it stays grounded on a
// narrow phone and when a long name ("Purr-fect Memory") wraps the title onto
// a second line and the card grows. Offsets are the board's (card 358 x 200).

function WishCard({ wish, scores, onPlay }: {
  wish: ArcadeWish
  scores: ArcadeScores
  onPlay?: (game: ArcadeGame) => void
}) {
  const { game } = wish
  return (
    <section aria-label={`${wish.catName}'s wish today: ${game.title}`} style={{
      position: 'relative', marginTop: 12, minHeight: 200, boxSizing: 'border-box', borderRadius: 22,
      background: '#FFFFFF', overflow: 'hidden', padding: 18, display: 'flex',
    }}>
      <div aria-hidden style={{ position: 'absolute', right: -72, bottom: -90, width: 280, height: 140, borderRadius: '50%', background: M.hill }} />
      <div aria-hidden style={{ position: 'absolute', right: 48, bottom: 16, width: 84, height: 12, borderRadius: '50%', background: M.hillShadow }} />
      <span aria-hidden style={{ position: 'absolute', right: 16, bottom: 26 }}><MeadowIcon name="tuft" /></span>
      <CatPortrait look={wish.catLook} width={110} height={148} style={{ position: 'absolute', right: 28, bottom: 22 }} />
      <span aria-hidden style={{ position: 'absolute', right: 140, bottom: 18 }}>
        <MeadowIcon name={GAME_ICON[game.id] ?? 'pad'} size={36} />
      </span>

      <div style={{ position: 'relative', flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {wish.granted ? (
          <Tag tone="leaf" caps icon={<MeadowIcon name="check" size={14} color={M.leaf} />} style={WISH_TAG}>
            Wish granted
          </Tag>
        ) : (
          <Tag tone="amber" caps icon={<MeadowIcon name="star" size={14} />} style={WISH_TAG}>
            {`${wish.catName}'s wish today`}
          </Tag>
        )}
        {/* Clear of the cat, whose box starts 138px from the card's right
            edge: a long name wraps instead of running under the cat. */}
        <h2 style={{ margin: '10px 0 0', maxWidth: 'calc(100% - 120px)', fontSize: 28, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.01em' }}>
          {game.title}
        </h2>
        <span style={{ marginTop: 2, fontSize: 14, fontWeight: 700, color: M.text2 }}>
          <BestLine id={game.id} scores={scores} />
        </span>
        {/* Pushes Play to the card's floor, and keeps it off the score line
            when a wrapped title grows the card. */}
        <span aria-hidden style={{ flex: '1 0 14px' }} />
        <PrimaryButton size="md" href={game.href} onClick={onPlay ? () => onPlay(game) : undefined}
          ariaLabel={`Play ${game.title}`} style={{ marginBottom: 4 }}>
          Play
        </PrimaryButton>
      </div>
    </section>
  )
}

// The board's wish tag is a hair smaller than the kit's md tag: 26 tall, 11px.
const WISH_TAG: CSSProperties = { height: 26, fontSize: 11, letterSpacing: '0.05em', padding: '0 10px 0 7px', maxWidth: '100%' }

// ─── Tile (a game) ───────────────────────────────────────────────────────────

function Tile({ href, onClick, icon, tint, title, detail, ariaLabel }: {
  href: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  icon: ReactNode
  tint: string
  title: string
  detail: ReactNode
  ariaLabel?: string
}) {
  return (
    <Link href={href} onClick={onClick} aria-label={ariaLabel} className="m-press m-focus" style={{
      height: 128, boxSizing: 'border-box', borderRadius: 22, background: '#FFFFFF', padding: '14px 14px 14px 16px',
      display: 'flex', flexDirection: 'column', textDecoration: 'none', color: M.text, minWidth: 0,
    }}>
      <span aria-hidden style={{
        width: 52, height: 52, borderRadius: 16, background: tint, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
      }}>
        {icon}
      </span>
      <span style={{
        marginTop: 'auto', fontSize: 15, lineHeight: 1.25, fontWeight: 800,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {title}
      </span>
      <span style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: M.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {detail}
      </span>
    </Link>
  )
}
