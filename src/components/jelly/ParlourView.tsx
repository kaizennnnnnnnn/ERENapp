'use client'

// ─── ParlourView ────────────────────────────────────────────────────────────
// The Jelly Parlour hub, as a ROOM rather than a screen.
//
// The first build was mint gradient + white rounded cards + a padlock row, and
// it read exactly like the template it was: uniform radius, flat fills, nothing
// behind anything else. This version is furniture. A striped wall with a
// picture rail and wainscot, a stained display case with today's tray behind
// glass, a cloche on a pedestal, a chalkboard menu, and Eren actually BEHIND a
// counter — so depth comes from things overlapping in a place, not from a
// drop-shadow on a div.
//
// Presentational only — the container (jelly/page.tsx) owns the tray, the duel
// standings, feeding and navigation, so this renders with mock data at mobile
// widths.

import { ChevronLeft } from 'lucide-react'
import BlinkingEren from '@/components/BlinkingEren'
import { IconJelly } from '@/components/PixelIcons'
import ParlourCase from './ParlourCase'
import ParlourMenu, { type ParlourGame } from './ParlourMenu'
import SuperJellyStand from './SuperJellyStand'
import type { JellyDef } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'
import {
  INK, CREAM, WALL, WALL_STRIPE, WALL_DEEP, WOOD, WOOD_DK, WOOD_LT,
  BRASS, BRASS_LT, BRASS_DK, dropShadow,
} from './parlourTheme'

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
  onPlay: (id: 'slice' | 'jump') => void
  onFeed: () => void
  onOpenCloset: () => void
  onBack: () => void
}

export default function ParlourView({
  tray, trayCount, traySize, supers, fed, feedGoal, ownsSkin, feeding, loaded, blocked,
  games, onPlay, onFeed, onOpenCloset, onBack,
}: Props) {
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: WALL }}>
      {/* ── The room ── fixed behind the scroll, so the wall doesn't slide. */}
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Wallpaper: wide soft stripes. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(90deg, ${WALL} 0 18px, ${WALL_STRIPE} 18px 36px)`,
        }} />
        {/* Picture rail. */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 'calc(var(--safe-top) + 62px)', height: 6,
          background: `linear-gradient(180deg, ${WOOD_LT}, ${WOOD_DK})`,
          borderTop: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`, opacity: 0.9,
        }} />
        {/* Corner shade so the room has a light source instead of flat fill. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(94% 58% at 50% 8%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 52%), radial-gradient(120% 80% at 50% 110%, ${WALL_DEEP}88 0%, rgba(0,0,0,0) 62%)`,
        }} />
        {/* Sugar dust — four motes, not forty. */}
        {[{ l: '11%', t: '30%', d: '0s' }, { l: '84%', t: '24%', d: '1.1s' },
          { l: '24%', t: '72%', d: '0.6s' }, { l: '73%', t: '80%', d: '1.7s' }].map((m, i) => (
          <span key={i} style={{
            position: 'absolute', left: m.l, top: m.t, width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 6px rgba(255,255,255,0.85)',
            animation: `parlourDust 4.2s ease-in-out ${m.d} infinite`,
          }} />
        ))}
      </div>

      {/* One column at least as tall as the viewport, so the counter is the
          FLOOR of the room rather than a strip that stops mid-wall when the
          page is short. */}
      <div className="relative flex flex-col mx-auto" style={{ zIndex: 2, minHeight: '100%', maxWidth: 440 }}>
      <div className="px-3" style={{
        paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 14,
      }}>
        {/* ── Header ── the sign hangs from the rail and swings a little. */}
        <div className="flex items-start gap-2" style={{ marginBottom: 26 }}>
          <button onClick={() => { playSound('ui_back'); onBack() }} aria-label="Back"
            className="flex items-center justify-center active:translate-y-[1px] transition-transform flex-shrink-0"
            style={{
              width: 38, height: 38, background: CREAM, borderRadius: 8,
              border: `3px solid ${INK}`, boxShadow: dropShadow(3),
            }}>
            <ChevronLeft size={17} style={{ color: INK }} />
          </button>

          <div className="flex-1 flex justify-center" style={{ minWidth: 0 }}>
            <div className="relative" style={{
              transformOrigin: 'top center',
              animation: 'parlourSignSway 5.4s ease-in-out infinite',
            }}>
              {/* Two little chains up to the rail. */}
              {[-26, 26].map(x => (
                <span key={x} aria-hidden style={{
                  position: 'absolute', left: `calc(50% + ${x}px)`, top: -14, width: 2, height: 16,
                  background: BRASS_DK,
                }} />
              ))}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5" style={{
                background: `linear-gradient(180deg, ${WOOD_LT} 0%, ${WOOD} 100%)`,
                borderRadius: 7, border: `3px solid ${INK}`, boxShadow: dropShadow(3),
              }}>
                <span style={{ animation: 'dockJellyWobble 1.9s ease-in-out infinite', display: 'inline-flex' }}>
                  <IconJelly size={13} />
                </span>
                <span className="font-pixel" style={{
                  fontSize: 8, color: BRASS_LT, letterSpacing: 0.8, textShadow: `1px 1px 0 ${INK}`,
                }}>JELLY PARLOUR</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 px-2 py-1.5 flex-shrink-0"
            aria-label={`${trayCount} of ${traySize} on today's tray`}
            style={{ background: CREAM, borderRadius: 8, border: `3px solid ${INK}`, boxShadow: dropShadow(3) }}>
            <span className="font-pixel" style={{ fontSize: 9, color: INK }}>{trayCount}</span>
            <span className="font-pixel" style={{ fontSize: 7, color: '#B39684' }}>/{traySize}</span>
          </div>
        </div>

        {/* ── The case ── */}
        <ParlourCase tray={tray} count={trayCount} size={traySize} loading={!loaded} />
        {blocked ? (
          /* Without this the tray just sits at 0/5 for ever and every round
             quietly pays nothing — which reads as "the game is broken", not as
             "one SQL file has not been run yet". */
          <div className="flex items-start gap-2 px-3 py-2.5" style={{
            margin: '8px 0 14px', borderRadius: 10,
            background: '#FFF1E2', border: `2px dashed ${INK}55`,
          }}>
            <span style={{ marginTop: 1 }}><IconJelly size={13} /></span>
            <p style={{ fontSize: 9.5, lineHeight: 1.45, color: '#8A5A3C' }}>
              The Parlour can&apos;t reach its shelf, so nothing you win will stick.
              Run <strong>supabase/migration_jelly_progress.sql</strong> once in the
              Supabase SQL editor.
            </p>
          </div>
        ) : (
          <p className="text-center" style={{ fontSize: 8.5, color: '#9A7484', margin: '7px 0 14px' }}>
            The tray empties every night. Win a round to fill a slot.
          </p>
        )}

        {/* ── The stand ── */}
        <div style={{ marginBottom: 14 }}>
          <SuperJellyStand
            supers={supers} fed={fed} goal={feedGoal} ownsSkin={ownsSkin}
            busy={feeding} onFeed={onFeed} onOpenCloset={onOpenCloset} />
        </div>

        {/* ── The menu ── */}
        <ParlourMenu games={games} loaded={loaded} onPlay={onPlay} />
      </div>

      {/* ── The counter ── Eren minds the shop. He is drawn BEHIND the counter
          top, which is the one real overlap in the layout and the reason the
          page ends in a place instead of on empty wall. `flex-1` on the spacer
          above pins it to the floor of the room at any content height. */}
      <div className="flex-1" />
      <div className="relative" aria-hidden style={{ zIndex: 1 }}>
        <div className="relative flex items-end justify-center" style={{ height: 168 }}>
          {/* Back-bar shelf. Eren stands in FRONT of it, which is the second
              real overlap in the room and what turns the empty wall above the
              counter into depth. */}
          <div style={{ position: 'absolute', left: '9%', right: '9%', top: 6 }}>
            <div className="flex items-end justify-around">
              {tray.slice(1, 4).map(({ jelly }, i) => (
                <span key={jelly.id} style={{
                  position: 'relative', display: 'block', width: 32, height: 34 + (i % 2) * 6,
                  borderRadius: '5px 5px 8px 8px',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.26) 100%)',
                  border: `2.5px solid ${INK}`, overflow: 'hidden',
                }}>
                  <img src={jelly.art} alt="" draggable={false} style={{
                    position: 'absolute', left: 2, bottom: 1, width: 24, height: 24,
                    objectFit: 'contain', imageRendering: 'auto',
                  }} />
                  <span style={{
                    position: 'absolute', left: 3, top: 3, width: 5, height: 12,
                    borderRadius: '50%', background: 'rgba(255,255,255,0.78)',
                  }} />
                </span>
              ))}
            </div>
            <div style={{
              height: 8, borderRadius: 2,
              background: `linear-gradient(180deg, ${WOOD_LT}, ${WOOD_DK})`,
              border: `2.5px solid ${INK}`,
            }} />
          </div>

          {/* Pulled down so the counter top crosses his chest. */}
          <div style={{ marginBottom: -44, position: 'relative' }}>
            <BlinkingEren size={176} src="/erenGood_notail.png" tailSrc="/erenGood_tail.png" />
          </div>

          {/* A jar of the day's jellies, standing on the counter beside him. */}
          {tray[0] && (
            <div style={{ position: 'absolute', right: 34, bottom: 3, zIndex: 1 }}>
              <span style={{
                position: 'relative', display: 'block', width: 44, height: 52,
                borderRadius: '8px 8px 12px 12px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.3) 100%)',
                border: `3px solid ${INK}`, overflow: 'hidden',
              }}>
                {tray.slice(0, 3).map(({ jelly }, i) => (
                  <img key={jelly.id} src={jelly.art} alt="" draggable={false} style={{
                    position: 'absolute', left: i % 2 ? 2 : 10, bottom: 1 + i * 14,
                    width: 26, height: 26, objectFit: 'contain', imageRendering: 'auto',
                  }} />
                ))}
                <span style={{
                  position: 'absolute', left: 5, top: 4, width: 7, height: 20,
                  borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
                }} />
              </span>
              <span style={{
                display: 'block', width: 50, height: 8, marginLeft: -3, marginTop: -2,
                borderRadius: 3, background: `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})`,
                border: `2.5px solid ${INK}`,
              }} />
            </div>
          )}
        </div>

        {/* Counter top — the edge he stands behind. Positioned so it paints
            OVER the sprite: without this his paws hang down the front panel. */}
        <div style={{
          position: 'relative', zIndex: 2,
          height: 15,
          background: `linear-gradient(180deg, ${WOOD_LT} 0%, ${WOOD} 100%)`,
          borderTop: `3px solid ${INK}`, borderBottom: `3px solid ${INK}`,
        }} />
        {/* Panelled front, tall enough to read as furniture. */}
        <div style={{
          position: 'relative', zIndex: 2,
          height: 'calc(var(--safe-bottom) + 76px)',
          background: `linear-gradient(180deg, ${WOOD} 0%, ${WOOD_DK} 100%)`,
        }}>
          <div style={{
            height: '100%', margin: '0 16px',
            borderLeft: `3px solid rgba(0,0,0,0.16)`, borderRight: `3px solid rgba(0,0,0,0.16)`,
            background: 'repeating-linear-gradient(90deg, transparent 0 54px, rgba(0,0,0,0.14) 54px 57px)',
          }} />
        </div>
      </div>
      </div>
    </div>
  )
}
