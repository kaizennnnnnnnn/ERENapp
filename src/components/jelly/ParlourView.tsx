'use client'

// ─── ParlourView ────────────────────────────────────────────────────────────
// The Jelly Parlour hub: the shelf of five, and the two ways to win one.
//
// Deliberately the LIGHT room. The closet and the collection are the dark
// game-panel screens; a sweet shop that opened into the same purple would read
// as one more vault. Mint and cream, with the jelly art doing the colour work.
//
// Presentational only — the container (jelly/page.tsx) owns ownership, duel
// standings and navigation, so this renders with mock data at mobile widths.

import { ChevronLeft } from 'lucide-react'
import BlinkingEren from '@/components/BlinkingEren'
import { IconJelly, IconSparkles, IconLock, IconCrown, IconDress } from '@/components/PixelIcons'
import type { JellyDef } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'

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
  shelf: { jelly: JellyDef; owned: boolean }[]
  ownedCount: number
  total: number
  complete: boolean
  ownsSkin: boolean
  loaded: boolean
  games: ParlourGame[]
  onPlay: (id: 'slice' | 'jump') => void
  onOpenCloset: () => void
  onBack: () => void
}

const INK = '#2C4A38'
const CREAM = '#FFFDF6'

export default function ParlourView({
  shelf, ownedCount, total, complete, ownsSkin, loaded, games, onPlay, onOpenCloset, onBack,
}: Props) {
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{
      background: 'radial-gradient(120% 70% at 50% 0%, #F4FFF8 0%, #DDF7E7 46%, #B9E9CF 100%)',
    }}>
      {/* Sugar dust — the parlour's ambience, four elements rather than forty. */}
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {[{ l: '12%', t: '18%', d: '0s' }, { l: '82%', t: '26%', d: '1.1s' },
          { l: '26%', t: '68%', d: '0.6s' }, { l: '71%', t: '78%', d: '1.7s' }].map((m, i) => (
          <span key={i} style={{
            position: 'absolute', left: m.l, top: m.t, width: 6, height: 6, borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 6px rgba(255,255,255,0.8)',
            animation: `parlourDust 4.2s ease-in-out ${m.d} infinite`,
          }} />
        ))}
      </div>

      <div className="relative px-3 mx-auto" style={{
        zIndex: 2, maxWidth: 440,
        paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)',
      }}>
        {/* ── Header ── */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => { playSound('ui_back'); onBack() }} aria-label="Back"
            className="flex items-center justify-center active:translate-y-[1px] transition-transform"
            style={{ width: 40, height: 40, background: CREAM, borderRadius: 9, border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}` }}>
            <ChevronLeft size={17} style={{ color: INK }} />
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5" style={{
            background: 'linear-gradient(180deg, #4FD68A, #2FA765)', borderRadius: 9,
            border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}`,
          }}>
            <span style={{ animation: 'dockJellyWobble 1.9s ease-in-out infinite', display: 'inline-flex' }}>
              <IconJelly size={14} />
            </span>
            <span className="font-pixel" style={{ fontSize: 8, color: CREAM, letterSpacing: 0.5 }}>JELLY PARLOUR</span>
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1 px-2.5 py-1.5" aria-label={`${ownedCount} of ${total} jellies`} style={{
            background: CREAM, borderRadius: 9, border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}`,
          }}>
            <span className="font-pixel" style={{ fontSize: 9, color: INK }}>{ownedCount}</span>
            <span className="font-pixel" style={{ fontSize: 7, color: '#7FA890' }}>/{total}</span>
          </div>
        </div>

        {/* ── The shelf ── */}
        <SectionLabel>THE JELLY SHELF</SectionLabel>
        <div className="relative mb-4 px-2 pt-3 pb-2" style={{
          background: CREAM, borderRadius: 14, border: `3px solid ${INK}`, boxShadow: `0 4px 0 ${INK}`,
        }}>
          <div className="flex justify-between gap-1">
            {shelf.map(({ jelly, owned }) => (
              <div key={jelly.id} className="flex-1 flex flex-col items-center gap-1" style={{ minWidth: 0 }}>
                <div className="relative flex items-end justify-center" style={{
                  width: '100%', aspectRatio: '1', borderRadius: 10,
                  background: owned
                    ? `radial-gradient(60% 55% at 50% 62%, ${jelly.colour}33, rgba(255,255,255,0) 72%)`
                    : 'rgba(44,74,56,0.06)',
                }}>
                  {owned ? (
                    <img src={jelly.art} alt="" draggable={false} style={{
                      width: '90%', height: '90%', objectFit: 'contain', imageRendering: 'auto',
                      animation: 'parlourJiggle 2.6s ease-in-out infinite',
                    }} />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                      <IconLock size={16} />
                    </span>
                  )}
                </div>
                <span className="font-pixel text-center leading-tight" style={{
                  fontSize: 5, color: owned ? INK : '#A8C0B2', minHeight: 12,
                }}>{owned ? jelly.name.split(' ')[0].toUpperCase() : '???'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Set reward ── */}
        {complete && ownsSkin ? (
          <button onClick={() => { playSound('ui_select'); onOpenCloset() }}
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 active:translate-y-[1px] transition-transform"
            style={{
              borderRadius: 12, background: 'linear-gradient(180deg, #FF7FA6, #E14C7C)',
              border: `3px solid ${INK}`, boxShadow: `0 4px 0 ${INK}`,
            }}>
            <IconDress size={14} />
            <span className="font-pixel" style={{ fontSize: 8, color: CREAM, letterSpacing: 0.5 }}>WEAR EREN JELLY</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5" style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 12, border: '2px dashed rgba(44,74,56,0.3)',
          }}>
            <IconCrown size={16} />
            <p style={{ fontSize: 10, lineHeight: 1.5, color: '#4A6B58' }}>
              Collect all {total} and Eren keeps a jelly of his own —
              <strong style={{ color: INK }}> {total - ownedCount} to go</strong>.
            </p>
          </div>
        )}

        {/* ── The two games ── */}
        <SectionLabel>PICK A GAME</SectionLabel>
        {!loaded ? (
          <p className="text-center font-pixel py-8" style={{ fontSize: 8, color: '#6E9781' }}>LOADING…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {games.map(g => <GameCard key={g.id} game={g} onPlay={() => onPlay(g.id)} />)}
          </div>
        )}

        {/* ── The counter ── Eren minds the shop. Decorative: he's the reason
            the room is warm, and he fills the tail of a short page so it ends
            on something alive rather than on empty mint. */}
        <div className="relative mt-6 flex items-end justify-center" aria-hidden style={{ height: 150 }}>
          <span style={{
            position: 'absolute', bottom: 26, width: 128, height: 14, borderRadius: '50%',
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(44,74,56,0.28), rgba(44,74,56,0))',
          }} />
          <div style={{ marginBottom: 12 }}>
            <BlinkingEren size={150} src="/erenGood_notail.png" tailSrc="/erenGood_tail.png" />
          </div>
          {/* A jelly set out on the counter beside him, still wobbling. */}
          {shelf[0] && (
            <img src={shelf[0].jelly.art} alt="" draggable={false} style={{
              position: 'absolute', right: '18%', bottom: 24, width: 44, height: 44,
              objectFit: 'contain', imageRendering: 'auto',
              animation: 'parlourJiggle 2.9s ease-in-out 0.4s infinite',
            }} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Game card ───────────────────────────────────────────────────────────────
function GameCard({ game, onPlay }: { game: ParlourGame; onPlay: () => void }) {
  const theme = game.id === 'slice'
    ? { a: '#FF8FA8', b: '#E14C7C' }
    : { a: '#7FD4F5', b: '#3F9FD1' }
  // Who leads today. Only meaningful once she has actually played — an
  // unplayed 0 is not a score you beat.
  const duel = game.theirName == null || game.theirsToday === 0
    ? null
    : game.mineToday > game.theirsToday ? 'ahead'
      : game.mineToday < game.theirsToday ? 'behind' : 'level'

  return (
    <button onClick={() => { playSound('ui_select'); onPlay() }}
      className="relative w-full text-left active:translate-y-[2px] transition-transform"
      style={{
        borderRadius: 14, padding: 12,
        background: `linear-gradient(180deg, ${theme.a}, ${theme.b})`,
        border: `3px solid ${INK}`, boxShadow: `0 5px 0 ${INK}`,
      }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ animation: 'parlourJiggle 2.2s ease-in-out infinite', display: 'inline-flex' }}>
          <IconJelly size={16} />
        </span>
        <span className="font-pixel" style={{ fontSize: 10, color: CREAM, letterSpacing: 0.5, textShadow: `1px 1px 0 ${INK}` }}>
          {game.title}
        </span>
      </div>
      <p style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(255,255,255,0.94)', marginBottom: 8, paddingRight: 34 }}>
        {game.blurb}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Chip label="BEST" value={game.best} />
        {duel ? (
          <Chip
            label={`TODAY vs ${(game.theirName ?? '').slice(0, 8).toUpperCase()}`}
            value={`${game.mineToday}-${game.theirsToday}`}
            tone={duel === 'ahead' ? 'good' : duel === 'behind' ? 'bad' : 'even'}
          />
        ) : game.mineToday > 0 ? (
          <Chip label="TODAY" value={game.mineToday} />
        ) : null}
      </div>

      <span aria-hidden className="absolute flex items-center justify-center" style={{
        right: 12, bottom: 12, width: 26, height: 26, borderRadius: '50%',
        background: CREAM, border: `2.5px solid ${INK}`,
      }}>
        <span style={{ fontSize: 10, color: INK, lineHeight: 1, marginLeft: 2 }}>&#9654;</span>
      </span>
    </button>
  )
}

function Chip({ label, value, tone = 'plain' }: {
  label: string; value: string | number; tone?: 'plain' | 'good' | 'bad' | 'even'
}) {
  const bg = tone === 'good' ? '#2FA765'
    : tone === 'bad' ? '#C4453F'
      : tone === 'even' ? '#6E7F98' : 'rgba(0,0,0,0.28)'
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-1" style={{ background: bg, borderRadius: 6 }}>
      <span className="font-pixel" style={{ fontSize: 5, color: 'rgba(255,255,255,0.75)' }}>{label}</span>
      <span className="font-pixel" style={{ fontSize: 7, color: '#fff' }}>{value}</span>
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 px-0.5">
      <IconSparkles size={10} />
      <span className="font-pixel" style={{ fontSize: 7, color: '#5C806C', letterSpacing: 1 }}>{children}</span>
    </div>
  )
}
