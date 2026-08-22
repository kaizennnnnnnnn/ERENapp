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
// The cloche is drawn, not photographed: a dome of glass is two radial
// gradients and a highlight arc, which at this size reads better than any
// asset would.

import { memo } from 'react'
import SuperJelly from './SuperJelly'
import { IconCrown, IconDress, IconSparkles } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import {
  INK, CREAM, WOOD, WOOD_DK, WOOD_LT, BRASS, BRASS_LT, BRASS_DK,
  BERRY, BERRY_DK, dropShadow,
} from './parlourTheme'

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
        ? `linear-gradient(180deg, #FFF0D2 0%, #F6DCA6 100%)`
        : `linear-gradient(180deg, #FFF8EE 0%, #F3DFD3 100%)`,
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
      <div className="relative flex flex-col items-center justify-end" style={{ width: 86, flexShrink: 0 }}>
        <div className="relative flex items-end justify-center" style={{ width: 78, height: 72 }}>
          {/* Dome */}
          <span aria-hidden style={{
            position: 'absolute', left: 0, right: 0, bottom: 6, height: 66,
            borderRadius: '50% 50% 12% 12%',
            background: holding
              ? 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,236,200,0.16) 46%, rgba(255,214,150,0.1) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(120,100,110,0.1) 100%)',
            border: `2px solid ${holding ? 'rgba(58,31,43,0.5)' : 'rgba(58,31,43,0.3)'}`,
            boxShadow: holding ? '0 0 14px rgba(255,190,90,0.5)' : undefined,
          }} />
          {/* Highlight arc on the glass */}
          <span aria-hidden style={{
            position: 'absolute', left: 13, top: 8, width: 15, height: 26,
            borderRadius: '50%', background: 'rgba(255,255,255,0.62)',
            transform: 'rotate(16deg)',
          }} />

          {holding ? (
            <div style={{ marginBottom: 12 }}>
              <SuperJelly size={54} />
            </div>
          ) : (
            <span aria-hidden style={{
              marginBottom: 16, opacity: 0.32, filter: 'grayscale(1)',
            }}>
              <SuperJelly size={48} glow={false} wobble={false} />
            </span>
          )}

          {/* How many are waiting. */}
          {supers > 1 && (
            <span className="absolute font-pixel flex items-center justify-center" style={{
              right: -2, top: 2, minWidth: 18, height: 18, padding: '0 3px',
              fontSize: 7, color: CREAM, background: BERRY, borderRadius: 9,
              border: `2px solid ${INK}`,
            }}>×{supers}</span>
          )}
        </div>

        {/* Pedestal */}
        <div aria-hidden style={{
          width: 74, height: 9, borderRadius: 3,
          background: `linear-gradient(180deg, ${WOOD_LT}, ${WOOD_DK})`,
          border: `2px solid ${INK}`,
        }} />
      </div>

      {/* ── Copy + action ── */}
      <div className="flex-1 flex flex-col justify-center" style={{ minWidth: 0 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <IconCrown size={12} />
          <span className="font-pixel" style={{ fontSize: 8, color: INK, letterSpacing: 0.4 }}>
            {ownsSkin ? 'EREN JELLY' : 'SUPER JELLY'}
          </span>
        </div>

        <p style={{ fontSize: 9.5, lineHeight: 1.45, color: '#7A5B4C', marginBottom: 7 }}>
          {ownsSkin
            ? 'He earned the coat. It is waiting in the closet.'
            : holding
              ? 'A whole day of jelly in one mould. Feed it to him.'
              : "Fill today's tray of five and one is yours."}
        </p>

        {/* The road: one spoon per feed. Shown in every state — it is the only
            place the five-day shape of the unlock is visible. */}
        {!ownsSkin && (
          <div className="flex items-center gap-1.5 mb-2">
            {Array.from({ length: goal }).map((_, i) => (
              <span key={i} style={{
                flex: 1, height: 8, borderRadius: 3,
                background: i < fed ? `linear-gradient(180deg, ${BERRY}, ${BERRY_DK})` : 'rgba(58,31,43,0.13)',
                border: `2px solid ${i < fed ? INK : 'transparent'}`,
              }} />
            ))}
            <span className="font-pixel" style={{ fontSize: 7, color: '#9A7A68' }}>{fed}/{goal}</span>
          </div>
        )}

        {ownsSkin ? (
          <ActionButton label="WEAR IT" icon={<IconDress size={12} />} tone="brass"
            onClick={() => { playSound('ui_select'); onOpenCloset() }} />
        ) : (
          <ActionButton
            label={busy ? 'FEEDING…' : 'FEED EREN'}
            icon={<IconSparkles size={12} />}
            tone={holding ? 'berry' : 'dim'}
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
  tone: 'berry' | 'brass' | 'dim'
  disabled?: boolean
  onClick: () => void
}) {
  const bg = tone === 'berry' ? `linear-gradient(180deg, #FF8FB0, ${BERRY})`
    : tone === 'brass' ? `linear-gradient(180deg, ${BRASS_LT}, ${BRASS})`
      : 'linear-gradient(180deg, #DCCDC2, #C3B0A3)'
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center justify-center gap-1.5 py-2 active:translate-y-[1px] transition-transform"
      style={{
        borderRadius: 9, background: bg,
        border: `2.5px solid ${disabled ? 'rgba(58,31,43,0.4)' : INK}`,
        boxShadow: disabled ? undefined : dropShadow(3),
        opacity: disabled ? 0.75 : 1,
      }}>
      {icon}
      <span className="font-pixel" style={{
        fontSize: 8, letterSpacing: 0.4,
        color: tone === 'brass' ? INK : tone === 'dim' ? '#6E5A50' : CREAM,
        textShadow: tone === 'berry' ? `1px 1px 0 ${BERRY_DK}` : undefined,
      }}>{label}</span>
    </button>
  )
}
