'use client'

// ─── ParlourView ────────────────────────────────────────────────────────────
// The Jelly Parlour hub in the Meadow look: the pink section ground, a back
// circle and the page title, then three white pieces — today's tray, the
// Super Jelly, and the two games — and at the foot of the page the cat
// minding the shop behind a counter, with the day's jellies in jars on the
// shelf behind him and one jar on the counter.
//
// Presentational only — the container (jelly/page.tsx) owns the tray, the duel
// standings, feeding and navigation, so this renders with mock data at mobile
// widths.

import BlinkingEren from '@/components/BlinkingEren'
import ParlourCase from './ParlourCase'
import ParlourMenu, { type ParlourGame } from './ParlourMenu'
import SuperJellyStand from './SuperJellyStand'
import type { JellyDef } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'
import { BackButton, GROUND, M, MeadowIcon, TINT, TYPE } from '@/components/meadow'
import { BRASS, BRASS_LT } from './parlourTheme'

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

/** Outline on the jars: the Meadow's ink, softened, so they sit with the white pieces. */
const JAR_LINE = 'rgba(47, 43, 40, 0.55)'

export default function ParlourView({
  tray, trayCount, traySize, supers, fed, feedGoal, ownsSkin, feeding, loaded, blocked,
  games, onPlay, onFeed, onOpenCloset, onBack,
}: Props) {
  return (
    <div className="meadow-root fixed inset-0 overflow-y-auto" style={{ background: GROUND.us }}>
      {/* One column at least as tall as the viewport, so the counter is the
          FLOOR of the page rather than a strip that stops mid-wall when the
          page is short. */}
      <div className="relative flex flex-col mx-auto" style={{ minHeight: '100%', maxWidth: 440 }}>
        <div style={{ padding: 'calc(var(--safe-top) + 8px) 16px 16px' }}>
          <BackButton onClick={() => { playSound('ui_back'); onBack() }} />
          <h1 style={{ ...TYPE.title, margin: '12px 0 16px', color: M.text }}>Jelly Parlour</h1>

          {/* ── Today's tray ── */}
          <ParlourCase tray={tray} count={trayCount} size={traySize} loading={!loaded} />
          {blocked ? (
            /* Without this the tray just sits at 0/5 for ever and every round
               quietly pays nothing — which reads as "the game is broken", not as
               "one SQL file has not been run yet". */
            <div role="alert" className="flex items-start" style={{
              gap: 10, margin: '10px 0 16px', padding: '12px 14px', borderRadius: 18, background: M.dangerTint,
            }}>
              <MeadowIcon name="flag" size={18} color={M.danger} mono style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, fontWeight: 600, color: M.text }}>
                The Parlour can&apos;t reach its shelf, so nothing you win will stick.
                Run <strong>supabase/migration_jelly_progress.sql</strong> once in the
                Supabase SQL editor.
              </p>
            </div>
          ) : (
            <p style={{ margin: '10px 4px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: M.text2 }}>
              The tray empties every night. Win a round to fill a slot.
            </p>
          )}

          {/* ── The Super Jelly ── */}
          <SuperJellyStand
            supers={supers} fed={fed} goal={feedGoal} ownsSkin={ownsSkin}
            busy={feeding} onFeed={onFeed} onOpenCloset={onOpenCloset} />

          {/* ── The games ── */}
          <div style={{ marginTop: 8 }}>
            <ParlourMenu games={games} loaded={loaded} onPlay={onPlay} />
          </div>
        </div>

        {/* ── The counter ── the cat minds the shop, drawn BEHIND the counter
            top, with the day's jellies in jars on the shelf behind him.
            `flex-1` on the spacer pins it to the floor at any content height. */}
        <div className="flex-1" />
        <div className="relative" aria-hidden style={{ marginTop: 8 }}>
          <div className="relative flex items-end justify-center" style={{ height: 168 }}>
            {/* The shelf behind him: three jars on a white plank. */}
            <div style={{ position: 'absolute', left: '9%', right: '9%', top: 4 }}>
              <div className="flex items-end justify-around">
                {tray.slice(1, 4).map(({ jelly }, i) => (
                  <Jar key={jelly.id} jelly={jelly} height={32 + (i % 2) * 6} />
                ))}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#FFFFFF', boxShadow: `0 3px 0 ${M.softLip}` }} />
            </div>

            {/* Pulled down so the counter top crosses his chest. */}
            <div style={{ marginBottom: -44, position: 'relative' }}>
              <BlinkingEren size={176} src="/erenGood_notail.png" tailSrc="/erenGood_tail.png" />
            </div>

            {/* A jar of the day's jellies on the counter beside him. */}
            {tray[0] && (
              <div style={{ position: 'absolute', right: 34, bottom: 3, zIndex: 1 }}>
                <span style={{
                  position: 'relative', display: 'block', width: 44, height: 52,
                  borderRadius: '10px 10px 14px 14px', background: 'rgba(255,255,255,0.6)',
                  border: `2.5px solid ${JAR_LINE}`, overflow: 'hidden',
                }}>
                  {tray.slice(0, 3).map(({ jelly }, i) => (
                    <img key={jelly.id} src={jelly.art} alt="" draggable={false} style={{
                      position: 'absolute', left: i % 2 ? 2 : 10, bottom: 1 + i * 14,
                      width: 26, height: 26, objectFit: 'contain', imageRendering: 'auto',
                    }} />
                  ))}
                  <span style={{
                    position: 'absolute', left: 5, top: 4, width: 7, height: 20,
                    borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
                  }} />
                </span>
                <span style={{
                  display: 'block', width: 50, height: 8, marginLeft: -3, marginTop: -2,
                  borderRadius: 4, background: `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})`,
                }} />
              </div>
            )}
          </div>

          {/* Counter top — the edge he stands behind, painted OVER the sprite
              so his paws don't hang down the front. A white slab with the
              Meadow lip, then a soft front down to the bottom of the screen. */}
          <div style={{
            position: 'relative', zIndex: 2, height: 16, background: '#FFFFFF',
            borderRadius: '8px 8px 0 0', boxShadow: `0 3px 0 ${M.softLip}`,
          }} />
          <div style={{
            position: 'relative', zIndex: 1, height: 'calc(var(--safe-bottom) + 76px)', background: TINT.soft,
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0 56px, ${M.hairline} 56px 58px)`,
          }} />
        </div>
      </div>
    </div>
  )
}

/** One jar on the back shelf: a brass lid on a clear jar with the jelly inside. */
function Jar({ jelly, height }: { jelly: JellyDef; height: number }) {
  return (
    <span className="relative block" style={{ width: 36 }}>
      <span style={{
        display: 'block', width: 30, height: 5, margin: '0 auto', borderRadius: '3px 3px 0 0',
        background: `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})`,
      }} />
      <span style={{
        position: 'relative', display: 'block', width: 36, height,
        borderRadius: '6px 6px 10px 10px', background: 'rgba(255,255,255,0.6)',
        border: `2.5px solid ${JAR_LINE}`, overflow: 'hidden',
      }}>
        <img src={jelly.art} alt="" draggable={false} style={{
          position: 'absolute', left: '50%', bottom: 1, width: 26, height: 26,
          marginLeft: -13, objectFit: 'contain', imageRendering: 'auto',
        }} />
        <span style={{
          position: 'absolute', left: 4, top: 4, width: 5, height: 12,
          borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
        }} />
      </span>
    </span>
  )
}
