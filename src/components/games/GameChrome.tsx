'use client'

// ═══════════════════════════════════════════════════════════════════════════
// GameChrome — the Meadow frame every minigame wears around its own board.
//
// Each game used to draw its own dark pixel chrome: a purple back square, a
// pixel title plate, black stat chips, a gradient START slab and a glowing
// finish panel — thirteen slightly different copies of one idea. The board,
// the pieces and the scenery are each game's own art and stay that way; what
// sits AROUND them is this:
//
//   GameTopBar     back circle, the game's name in a white pill, an optional
//                  right-hand slot (a sound toggle, a help button).
//   GameStatRow    the row under it; GameStat is one white pill in it — an
//                  icon and a number, amber when it is hot, red when urgent.
//   GameStartCard  the card before a round: the name, a little picture, how to
//                  play, your best, and the one leaf Play button.
//   GameResultCard the card after: what happened, the score big, New best,
//                  a few stat tiles, the coin reward, Play again / Arcade.
//
// Everything is absolutely positioned inside the game's own `fixed inset-0`
// root, at the z-layers the games already use (bar 30, start 30, result 50),
// so a game swaps its chrome without restacking its board.
// ═══════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactNode } from 'react'
import {
  FONT_ROUNDED, M, MeadowIcon, PrimaryButton, RoundButton, SecondaryButton, Tag, TYPE,
} from '@/components/meadow'

/** Where the stat row starts: under the safe area and the 40px top bar. */
export const GAME_STATS_TOP = 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 60px)'
/** Where a board can start so it clears the bar AND the stat row. */
export const GAME_BOARD_TOP = 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 104px)'

const PILL: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box',
  height: 36, borderRadius: 999, background: '#FFFFFF',
  boxShadow: `0 3px 0 ${M.overArtLip}`,
  fontFamily: FONT_ROUNDED, color: M.text, whiteSpace: 'nowrap',
}

// ─── Top bar ────────────────────────────────────────────────────────────────

export function GameTopBar({ title, onBack, right, style }: {
  title: ReactNode
  onBack: () => void
  /** Up to a 40px-wide control on the right. Empty keeps the title centred. */
  right?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="meadow-root absolute inset-x-0 top-0 flex items-center" style={{
      zIndex: 30, gap: 8,
      padding: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 10px) 12px 0',
      pointerEvents: 'none', ...style,
    }}>
      <span style={{ pointerEvents: 'auto' }}>
        <RoundButton surface="art" size={40} ariaLabel="Back to the arcade" onClick={onBack}>
          <MeadowIcon name="chevronLeft" size={22} color={M.text} />
        </RoundButton>
      </span>
      <div className="flex-1 min-w-0 flex justify-center">
        <h1 style={{
          ...PILL, margin: 0, padding: '0 16px', maxWidth: '100%',
          fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </h1>
      </div>
      <span className="flex justify-end" style={{ width: 40, pointerEvents: 'auto' }}>{right}</span>
    </div>
  )
}

// ─── Stats ──────────────────────────────────────────────────────────────────

/** The row of stat pills under the top bar. Spread across, centred when one. */
export function GameStatRow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="meadow-root absolute inset-x-0 flex items-center justify-between" style={{
      top: GAME_STATS_TOP, zIndex: 20, gap: 8, padding: '0 12px', pointerEvents: 'none', ...style,
    }}>
      {children}
      <GameChromeStyles />
    </div>
  )
}

/** Spread onto a GameStat's style to make it throb while it's urgent. */
export const GAME_STAT_URGENT: CSSProperties = { animation: 'gkPulse 0.6s ease-in-out infinite' }

export type GameStatTone = 'plain' | 'hot' | 'warn' | 'good'

const TONE: Record<GameStatTone, { bg: string; ink: string }> = {
  plain: { bg: '#FFFFFF', ink: M.text },
  hot:   { bg: M.energyTint, ink: '#8A5A12' },
  warn:  { bg: M.dangerTint, ink: M.danger },
  good:  { bg: M.leafTint, ink: M.leafInk },
}

/**
 * One stat: an icon and a value, optionally a quiet label ("Combo"). `pulse`
 * is a key — bump it to replay a little pop when the value changes.
 */
export function GameStat({ icon, label, value, tone = 'plain', pulse, ariaLabel, style }: {
  icon?: ReactNode
  label?: ReactNode
  value: ReactNode
  tone?: GameStatTone
  pulse?: number
  ariaLabel?: string
  style?: CSSProperties
}) {
  const t = TONE[tone]
  return (
    <span key={pulse} role={ariaLabel ? 'status' : undefined} aria-label={ariaLabel} style={{
      ...PILL, gap: 6, padding: icon ? '0 14px 0 8px' : '0 14px', background: t.bg, color: t.ink,
      fontSize: 16, ...TYPE.number,
      animation: pulse ? 'gkPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
      transition: 'background 0.2s ease, color 0.2s ease',
      ...style,
    }}>
      {icon}
      {label && <span style={{ fontSize: 13, fontWeight: 700, color: tone === 'plain' ? M.text2 : t.ink }}>{label}</span>}
      {value}
    </span>
  )
}

/** A quiet pill at the foot of the board ("Flips 12 · Pairs 3/6"). */
export function GameFootnote({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="meadow-root absolute left-1/2 flex items-center" style={{
      ...PILL, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', transform: 'translateX(-50%)',
      zIndex: 20, height: 32, padding: '0 14px', gap: 6,
      fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums',
      pointerEvents: 'none', ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Start card ─────────────────────────────────────────────────────────────

export function GameStartCard({ title, art, children, best, extra, onStart, startLabel = 'Play', startDisabled, style }: {
  title: ReactNode
  /** A little picture of the game: its pieces in a row, a sprite. */
  art?: ReactNode
  /** How to play, a sentence or two. */
  children?: ReactNode
  /** Your best so far; hidden when 0 or missing. */
  best?: number | null
  /** Anything else the game needs to ask first (difficulty, a mode). */
  extra?: ReactNode
  onStart: () => void
  startLabel?: ReactNode
  startDisabled?: boolean
  style?: CSSProperties
}) {
  return (
    // pointer-events-none on the full-screen layer so it never sits over the
    // top bar's back button and swallows its taps; the card opts back in.
    <div className="meadow-root absolute inset-0 flex items-center justify-center" style={{
      zIndex: 30, padding: '0 20px', pointerEvents: 'none', ...style,
    }}>
      <div className="flex flex-col items-center text-center" style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 340, boxSizing: 'border-box',
        padding: '22px 20px 18px', borderRadius: 28, background: '#FFFFFF',
        boxShadow: `0 4px 0 ${M.overArtLip}`,
        animation: 'gkCardIn 0.28s cubic-bezier(0.34,1.4,0.64,1) both',
      }}>
        <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.2, fontWeight: 800, color: M.text }}>{title}</h2>
        {art && <div className="flex items-center justify-center flex-wrap" style={{ gap: 6, marginTop: 14 }}>{art}</div>}
        {children && (
          <div style={{ marginTop: 12, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>{children}</div>
        )}
        {best != null && best > 0 && (
          <Tag size="sm" tone="legendary" icon={<MeadowIcon name="trophy" size={14} />}
            style={{ marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
            Your best {best}
          </Tag>
        )}
        {extra && <div style={{ width: '100%', marginTop: 14 }}>{extra}</div>}
        <PrimaryButton onClick={onStart} disabled={startDisabled} style={{ marginTop: 18 }}>
          {startLabel}
        </PrimaryButton>
      </div>
      <GameChromeStyles />
    </div>
  )
}

/** A piece of the game on a soft tile, for a start card's `art` row. */
export function GameArtTile({ children, size = 40, tint = M.soft }: { children: ReactNode; size?: number; tint?: string }) {
  return (
    <span aria-hidden className="flex items-center justify-center" style={{
      width: size, height: size, borderRadius: 12, background: tint, flexShrink: 0,
    }}>
      {children}
    </span>
  )
}

// ─── Result card ────────────────────────────────────────────────────────────

export interface GameResultStat { label: ReactNode; value: ReactNode }

export function GameResultCard({
  headline, score, scoreLabel, newBest, best, stats, reward, children,
  onAgain, onBack, againLabel = 'Play again', backLabel = 'Arcade', style,
}: {
  /** What happened, in a few words: "Purr-fect!", "Time's up". */
  headline: ReactNode
  score: ReactNode
  /** Under the number when it isn't plainly points ("pairs", "seconds"). */
  scoreLabel?: ReactNode
  newBest?: boolean
  /** Shown as "Best N" when it isn't a new best. */
  best?: number | null
  stats?: GameResultStat[]
  /** The <GameCoinReward/> for this round, when there is one. */
  reward?: ReactNode
  /** Anything a game adds under the stats (a duel line, a hint). */
  children?: ReactNode
  onAgain: () => void
  onBack: () => void
  againLabel?: ReactNode
  backLabel?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="meadow-root absolute inset-0 flex items-center justify-center" style={{
      zIndex: 50, padding: '0 20px', background: 'rgba(47, 43, 40, 0.36)', ...style,
    }}>
      <div role="dialog" aria-modal="true" aria-label="Round over" className="flex flex-col items-center text-center" style={{
        width: '100%', maxWidth: 340, maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box',
        padding: '22px 18px 16px', borderRadius: 28, background: '#FFFFFF',
        animation: 'gkCardIn 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
      }}>
        <p style={{ margin: 0, ...TYPE.label, color: M.label }}>{headline}</p>
        <p style={{ margin: '6px 0 0', fontSize: 48, lineHeight: 1.05, ...TYPE.number, color: M.text }}>{score}</p>
        {scoreLabel && <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: M.text2 }}>{scoreLabel}</p>}
        {newBest ? (
          <Tag size="sm" tone="legendary" icon={<MeadowIcon name="trophy" size={14} />} style={{ marginTop: 10 }}>
            New best
          </Tag>
        ) : best != null && best > 0 ? (
          <Tag size="sm" tone="soft" style={{ marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>Best {best}</Tag>
        ) : null}

        {stats && stats.length > 0 && (
          <div className="grid w-full" style={{
            gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0, 1fr))`, gap: 8, marginTop: 16,
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{ padding: '10px 6px', borderRadius: 16, background: M.soft }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: M.text2 }}>{s.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 18, ...TYPE.number, color: M.text }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {children && <div style={{ width: '100%', marginTop: 12 }}>{children}</div>}
        {reward && <div style={{ width: '100%', marginTop: 14 }}>{reward}</div>}

        <div className="flex w-full" style={{ gap: 8, marginTop: 18 }}>
          <PrimaryButton size="md" full onClick={onAgain}
            icon={<MeadowIcon name="replay" size={20} color="#FFFFFF" mono />}
            style={{ flex: '1 1 0', padding: '0 12px' }}>
            {againLabel}
          </PrimaryButton>
          <SecondaryButton size="md" onClick={onBack} style={{ padding: '0 16px' }}>
            {backLabel}
          </SecondaryButton>
        </div>
      </div>
      <GameChromeStyles />
    </div>
  )
}

/** The kit's keyframes, as a plain <style>: they are named from inline
 *  styles, which only reach global keyframes (styled-jsx would hash them). */
function GameChromeStyles() {
  return (
    <style>{`
      @keyframes gkCardIn {
        0%   { transform: scale(0.94) translateY(8px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes gkPop {
        0%   { transform: scale(1); }
        40%  { transform: scale(1.12); }
        100% { transform: scale(1); }
      }
      /* For an urgent stat (the last ten seconds): GAME_STAT_URGENT. */
      @keyframes gkPulse {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.06); }
      }
      @media (prefers-reduced-motion: reduce) {
        [style*="gkCardIn"], [style*="gkPop"], [style*="gkPulse"] { animation: none !important; }
      }
    `}</style>
  )
}
