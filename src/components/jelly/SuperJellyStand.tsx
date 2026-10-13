'use client'

// ─── SuperJellyStand ────────────────────────────────────────────────────────
// The Super Jelly, and the road to the cat's own jelly coat, as a white Meadow
// card. It has three faces and only ever shows one:
//
//   HOLDING   at least one Super Jelly. It stands on a warm tile; Feed Eren.
//   EMPTY     none in hand. An empty tile, and the reason: finish today's tray.
//   EARNED    the coat is already his. The card becomes the door to the closet.
//
// The empty face must never be a dead grey button the size of the primary
// action, the loudest "this app is broken" signal there is. It is a soft
// plaque with a lock that names what unlocks it.

import { memo } from 'react'
import SuperJelly from './SuperJelly'
import { Card, M, MeadowIcon, PrimaryButton, SecondaryButton, TINT, TYPE } from '@/components/meadow'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'

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
  const cat = useCat()

  return (
    <Card padding="14px">
      <div className="flex" style={{ gap: 14 }}>
        {/* The jelly on its tile, or the empty tile it will stand on. */}
        <div className="relative flex items-center justify-center flex-shrink-0" style={{
          width: 88, height: 88, borderRadius: 20,
          background: holding || ownsSkin ? TINT.amber : M.soft,
        }}>
          {holding || ownsSkin ? (
            <SuperJelly size={62} glow={false} />
          ) : (
            /* Not in hand yet: the jelly faded, like an unwon slot on the tray,
               so the tile shows what you are working towards. */
            <span style={{ opacity: 0.3, filter: 'saturate(0.35)', lineHeight: 0 }}>
              <SuperJelly size={62} glow={false} wobble={false} />
            </span>
          )}
          {/* How many are waiting. */}
          {supers > 1 && (
            <span style={{
              position: 'absolute', top: -6, right: -6, minWidth: 24, height: 24, boxSizing: 'border-box',
              padding: '0 6px', borderRadius: 999, background: M.love, border: '2px solid #FFFFFF',
              color: '#FFFFFF', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...TYPE.number,
            }}>×{supers}</span>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center" style={{ minWidth: 0 }}>
          <h2 className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 17, lineHeight: 1.2, fontWeight: 800 }}>
            <MeadowIcon name="crown" size={18} />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {ownsSkin ? cat.t('{name} Jelly') : 'Super Jelly'}
            </span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
            {ownsSkin
              ? cat.t('{He} earned the coat. It is waiting in the closet.')
              : holding
                ? cat.t('A whole day of jelly in one mould. Feed it to {him}.')
                : "Fill today's tray of five and one is yours."}
          </p>
        </div>
      </div>

      {/* The road: one step per feed. Shown in every state but the earned one
          — it is the only place the five-day shape of the unlock is visible. */}
      {!ownsSkin && (
        <div style={{ marginTop: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ ...TYPE.label, color: M.label }}>{cat.t('Fed to {him}')}</span>
            <span style={{ fontSize: 13, ...TYPE.number, color: M.text }}>{fed}/{goal}</span>
          </div>
          <div role="img" aria-label={`${fed} of ${goal} fed`} className="flex" style={{ gap: 4 }}>
            {Array.from({ length: goal }, (_, i) => (
              <span key={i} style={{
                flex: 1, height: 10, borderRadius: 999, background: i < fed ? M.love : M.track,
              }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {ownsSkin ? (
          <SecondaryButton size="lg" icon={<MeadowIcon name="dress" size={20} />}
            onClick={() => { playSound('ui_select'); onOpenCloset() }}>
            Wear it
          </SecondaryButton>
        ) : holding ? (
          <PrimaryButton busy={busy} icon={<MeadowIcon name="sparkle" size={20} color="#FFFFFF" mono />}
            onClick={() => { playSound('ui_select'); onFeed() }}>
            {busy ? 'Feeding...' : cat.t('Feed {name}')}
          </PrimaryButton>
        ) : (
          <div className="flex items-center justify-center" style={{
            minHeight: 50, boxSizing: 'border-box', padding: '8px 14px', gap: 8, borderRadius: 16,
            background: M.soft, fontSize: 15, lineHeight: 1.3, fontWeight: 700, color: M.text2, textAlign: 'center',
          }}>
            <MeadowIcon name="lock" size={18} color={M.text2} mono />
            {cat.t('Feed {name} once the tray is full')}
          </div>
        )}
      </div>
    </Card>
  )
})

export default SuperJellyStand
