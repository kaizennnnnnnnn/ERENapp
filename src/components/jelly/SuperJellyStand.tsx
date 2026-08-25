'use client'

// ─── SuperJellyStand ────────────────────────────────────────────────────────
// The pedestal by the counter: the Super Jelly under a glass cloche, and the
// road to Eren's own jelly coat.
//
// This is the piece that makes the new progression legible in one glance —
// how many Super Jellies you're holding, what feeding one does for you, and how
// many feeds are left. It has three faces and only ever shows one:
//
//   HOLDING   at least one Super Jelly. Lit cloche, FEED EREN.
//   EMPTY     none in hand. Dim cloche, and the reason: finish today's tray.
//   EARNED    the coat is already his. The stand becomes the door to the closet.
//
// The empty face used to be the worst thing on the page: a grey ghost under a
// white dome, a row of flat grey lozenges, and a dead grey FEED button — three
// pieces of nothing stacked on the palest card in the room, which read as
// broken rather than as not-yet. It now shows a SHADOW where the jelly will
// stand (a placeholder, not a corpse), the app's shared SegmentMeter for the
// road, and a locked plaque that names what unlocks it.
//
// The cloche is drawn, not photographed: a dome of glass is two radial
// gradients and a highlight arc, which at this size reads better than any
// asset would.

import { memo } from 'react'
import SuperJelly from './SuperJelly'
import SegmentMeter, { type MeterPalette } from '@/components/care/SegmentMeter'
import { IconCrown, IconDress, IconSparkles, IconLock } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import {
  INK, CREAM, WOOD, WOOD_DK, WOOD_LT, BRASS, BRASS_LT, BRASS_DK,
  BERRY, BERRY_DK, dropShadow,
} from './parlourTheme'

/** The feed road, in the app's shared gauge chrome — berry filament in a
 *  recessed plum channel with brass rivets, so it belongs to the same family
 *  as the bathroom's SOAP meter and the playroom's ENERGY bar. */
const FEED_METER: MeterPalette = {
  fillHi: '#FF9EBC',
  fillBase: BERRY,
  fillLo: BERRY_DK,
  fillEdge: '#75173A',
  glow: 'rgba(225,76,124,0.6)',
  track: '#3E2833',
  trackEdge: '#26161F',
  groove: '#2A1A22',
  frame: INK,
  rivet: BRASS,
}

interface Props {
  supers: number
  fed: number
  goal: number
  ownsSkin: boolean
  busy: boolean
  onFeed: () => void
  onOpenCloset: () => void
}

const SuperJellyStand = memo(function SuperJellyStand({
  supers, fed, goal, ownsSkin, busy, onFeed, onOpenCloset,
}: Props) {
  const holding = supers > 0

  return (
    <div className="relative flex items-stretch gap-3 p-3" style={{
      borderRadius: 12,
      background: ownsSkin
        ? 'linear-gradient(180deg, #FFF0D2 0%, #F6DCA6 100%)'
        : 'linear-gradient(180deg, #FFF8EE 0%, #F0D8C8 100%)',
      border: `3px solid ${INK}`,
      boxShadow: dropShadow(5),
    }}>
      {/* Gold rivets at the inner corners — the "premium card" tell used on
          every other earned thing in the app. */}
      {[['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].map(([x, y]) => (
        <span key={`${x}${y}`} aria-hidden style={{
          position: 'absolute', width: 3, height: 3, background: BRASS, [x]: 5, [y]: 5,
        } as React.CSSProperties} />
      ))}

      {/* ── The cloche ── */}
      <div className="relative flex flex-col items-center justify-end" style={{ width: 84, flexShrink: 0 }}>
        <div className="relative flex items-end justify-center" style={{ width: 78, height: 76 }}>
          {/* Dome. Empty means EMPTY — clear glass over an unoccupied plinth,
              which is a thing a shop actually looks like. The earlier attempts
              (a grey copy of the jelly, then a smoked dome) both landed on the
              same grey egg, and a grey egg reads as a broken image. */}
          <span aria-hidden style={{
            position: 'absolute', left: 2, right: 2, bottom: 6, height: 68,
            borderRadius: '50% 50% 14% 14%',
            background: holding
              ? 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(255,236,200,0.18) 44%, rgba(255,214,150,0.12) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.14) 40%, rgba(58,31,43,0.05) 100%)',
            border: `2px solid ${holding ? 'rgba(58,31,43,0.55)' : 'rgba(58,31,43,0.34)'}`,
            boxShadow: holding
              ? '0 0 14px rgba(255,190,90,0.5)'
              : 'inset 0 -10px 12px -10px rgba(58,31,43,0.35)',
          }} />
          {/* Two highlights: a long streak down the shoulder and a small dot
              opposite. One blob reads as an egg; two read as curved glass. */}
          <span aria-hidden style={{
            position: 'absolute', left: 16, top: 13, width: 5, height: 30, zIndex: 3,
            borderRadius: '50%', transform: 'rotate(15deg)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.1) 100%)',
          }} />
          <span aria-hidden style={{
            position: 'absolute', right: 19, top: 24, width: 3, height: 9, zIndex: 3,
            borderRadius: '50%', background: 'rgba(255,255,255,0.55)', transform: 'rotate(15deg)',
          }} />

          {holding ? (
            <div style={{ marginBottom: 12 }}>
              <SuperJelly size={54} />
            </div>
          ) : (
            /* The plinth under the glass, with nothing on it. */
            <span aria-hidden style={{
              position: 'absolute', bottom: 11, width: 42, height: 7, borderRadius: '50%',
              background: 'radial-gradient(50% 50% at 50% 50%, rgba(58,31,43,0.22) 0%, rgba(58,31,43,0) 72%)',
            }} />
          )}

          {/* Rim where the glass meets the plinth. */}
          <span aria-hidden style={{
            position: 'absolute', left: 4, right: 4, bottom: 5, height: 3, borderRadius: 2,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.5), rgba(58,31,43,0.25))',
          }} />

          {/* How many are waiting. */}
          {supers > 1 && (
            <span className="absolute font-pixel flex items-center justify-center" style={{
              right: -2, top: 2, minWidth: 18, height: 18, padding: '0 3px', zIndex: 4,
              fontSize: 7, color: CREAM, background: BERRY, borderRadius: 9,
              border: `2px solid ${INK}`,
            }}>×{supers}</span>
          )}
        </div>

        {/* Plinth — a slab on a narrower base, so it stands rather than floats. */}
        <div aria-hidden className="flex flex-col items-center" style={{ width: '100%' }}>
          <div style={{
            width: 76, height: 8, borderRadius: '3px 3px 1px 1px',
            background: `linear-gradient(180deg, ${WOOD_LT}, ${WOOD})`,
            border: `2px solid ${INK}`,
          }} />
          <div style={{
            width: 56, height: 6, borderRadius: '0 0 3px 3px',
            background: `linear-gradient(180deg, ${WOOD}, ${WOOD_DK})`,
            borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`,
          }} />
        </div>
      </div>

      {/* ── Copy + action ── */}
      <div className="flex-1 flex flex-col justify-center" style={{ minWidth: 0 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <IconCrown size={12} />
          <span className="font-pixel" style={{ fontSize: 8, color: INK, letterSpacing: 0.4 }}>
            {ownsSkin ? 'EREN JELLY' : 'SUPER JELLY'}
          </span>
        </div>

        <p style={{ fontSize: 9.5, lineHeight: 1.45, color: '#6E4E3F', marginBottom: 8 }}>
          {ownsSkin
            ? 'He earned the coat. It is waiting in the closet.'
            : holding
              ? 'A whole day of jelly in one mould. Feed it to him.'
              : "Fill today's tray of five and one is yours."}
        </p>

        {/* The road: one segment per feed. Shown in every state — it is the
            only place the five-day shape of the unlock is visible. */}
        {!ownsSkin && (
          <div style={{ marginBottom: 9 }}>
            <SegmentMeter
              label="FED TO EREN"
              value={goal > 0 ? (fed / goal) * 100 : 0}
              valueText={`${fed}/${goal}`}
              segments={goal}
              palette={FEED_METER}
              labelColor="#8A6353"
              valueColor={INK}
            />
          </div>
        )}

        {ownsSkin ? (
          <ActionButton label="WEAR IT" icon={<IconDress size={12} />} tone="brass"
            onClick={() => { playSound('ui_select'); onOpenCloset() }} />
        ) : (
          <ActionButton
            label={busy ? 'FEEDING…' : 'FEED EREN'}
            icon={busy || holding ? <IconSparkles size={12} /> : <IconLock size={11} />}
            tone={holding ? 'berry' : 'locked'}
            disabled={!holding || busy}
            onClick={() => { playSound('ui_select'); onFeed() }} />
        )}
      </div>
    </div>
  )
})

export default SuperJellyStand

function ActionButton({ label, icon, tone, disabled = false, onClick }: {
  label: string
  icon: React.ReactNode
  tone: 'berry' | 'brass' | 'locked'
  disabled?: boolean
  onClick: () => void
}) {
  // The locked face is deliberately NOT a greyed-out button. A dead slab the
  // size of the primary action is the single loudest "this app is broken"
  // signal there is; a dashed plaque with a lock reads as a door you haven't
  // opened yet.
  const locked = tone === 'locked'
  const bg = tone === 'berry' ? `linear-gradient(180deg, #FF8FB0, ${BERRY})`
    : tone === 'brass' ? `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})`
      : 'rgba(58,31,43,0.06)'
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center justify-center gap-1.5 active:translate-y-[1px] transition-transform"
      style={{
        padding: locked ? '7px 0' : '8px 0',
        borderRadius: 9,
        background: bg,
        border: locked ? `2px dashed rgba(58,31,43,0.42)` : `2.5px solid ${INK}`,
        boxShadow: locked ? undefined : dropShadow(3),
      }}>
      <span style={{ opacity: locked ? 0.55 : 1, display: 'inline-flex' }}>{icon}</span>
      <span className="font-pixel" style={{
        fontSize: 8, letterSpacing: 0.4,
        color: tone === 'brass' ? INK : locked ? 'rgba(58,31,43,0.52)' : CREAM,
        textShadow: tone === 'berry' ? `1px 1px 0 ${BERRY_DK}` : undefined,
      }}>{label}</span>
    </button>
  )
}
