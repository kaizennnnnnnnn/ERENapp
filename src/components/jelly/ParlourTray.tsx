'use client'

// ─── ParlourTray ────────────────────────────────────────────────────────────
// The Parlour's whole loop in one picture: today's five jellies in an arch
// over the Super Jelly they make. Win a round and a jelly in the arch lights
// up; light all five and the Super Jelly under them comes alive and can be fed
// to the cat; five feeds and the jelly coat is his.
//
// It replaced a tray card, a Super Jelly card and a counter with the cat
// behind it, stacked down a long page — three boxes that each told a third of
// the story. Here the five-make-one idea is the layout itself.
//
// An unwon jelly stays in the arch, faded: you can see which flavour is
// missing, which is the thing a player looks for. The Super Jelly is faded the
// same way until you hold one, so it shows what you are working towards.

import { memo } from 'react'
import type { JellyDef } from '@/lib/jellies'
import SuperJelly from './SuperJelly'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import { Card, M, MeadowIcon, PrimaryButton, SecondaryButton, Tag, TINT, TYPE } from '@/components/meadow'

interface Props {
  tray: { jelly: JellyDef; filled: boolean }[]
  count: number
  size: number
  supers: number
  fed: number
  goal: number
  ownsSkin: boolean
  busy: boolean
  /** Ownership is still being confirmed — draw the arch, not a wrong answer. */
  loading: boolean
  onFeed: () => void
  onOpenCloset: () => void
}

/** Where each of the five sits on the arch: centre x as a %, centre y in px. */
const ARCH = [
  { x: 10, y: 112 },
  { x: 27, y: 52 },
  { x: 50, y: 30 },
  { x: 73, y: 52 },
  { x: 90, y: 112 },
]
const ARCH_H = 186
const SLOT = 56

const ParlourTray = memo(function ParlourTray({
  tray, count, size, supers, fed, goal, ownsSkin, busy, loading, onFeed, onOpenCloset,
}: Props) {
  const cat = useCat()
  const holding = supers > 0
  const full = count >= size

  return (
    <Card padding="16px 16px 18px" style={{ borderRadius: 28 }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, ...TYPE.label, color: M.label }}>Today&apos;s tray</h2>
        <Tag size="sm" tone={full ? 'leaf' : 'soft'} style={{ fontVariantNumeric: 'tabular-nums' }}
          icon={full ? <MeadowIcon name="check" size={14} color={M.leaf} /> : undefined}>
          {loading ? '–' : count}/{size}
        </Tag>
      </div>

      {/* ── The arch ── */}
      <div className="relative" style={{ height: ARCH_H, margin: '4px 0 0' }}>
        {tray.map(({ jelly, filled }, i) => {
          const lit = filled && !loading
          const at = ARCH[i] ?? ARCH[ARCH.length - 1]
          return (
            <span key={jelly.id} style={{
              position: 'absolute', left: `${at.x}%`, top: at.y - SLOT / 2,
              width: SLOT, height: SLOT, marginLeft: -SLOT / 2, borderRadius: 999,
              background: lit ? `${jelly.colour}33` : M.soft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={jelly.art} alt="" draggable={false} style={{
                width: 42, height: 42, objectFit: 'contain', imageRendering: 'auto',
                filter: lit ? undefined : 'saturate(0.35)',
                opacity: lit ? 1 : 0.32,
                animation: lit ? 'parlourJiggle 2.6s ease-in-out infinite' : undefined,
              }} />
              {lit && (
                <span aria-hidden style={{
                  position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 999,
                  background: M.leaf, border: '2px solid #FFFFFF', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MeadowIcon name="check" size={10} color="#FFFFFF" mono />
                </span>
              )}
              <span className="sr-only">{lit ? `${jelly.name}, won` : `${jelly.name}, not won yet`}</span>
            </span>
          )
        })}

        {/* The Super Jelly the five make, on its warm stand. */}
        <span aria-hidden className="absolute flex flex-col items-center" style={{
          left: '50%', bottom: 0, transform: 'translateX(-50%)',
        }}>
          <span style={{
            opacity: holding || ownsSkin ? 1 : 0.3,
            filter: holding || ownsSkin ? undefined : 'saturate(0.35)',
            lineHeight: 0, position: 'relative', zIndex: 1, marginBottom: -10,
          }}>
            <SuperJelly size={104} glow={false} wobble={holding || ownsSkin} />
          </span>
          <span style={{
            width: 132, height: 22, borderRadius: '50%',
            background: holding || ownsSkin ? TINT.amber : M.soft,
          }} />
          {supers > 1 && (
            <span style={{
              position: 'absolute', top: -4, right: -14, minWidth: 26, height: 24, boxSizing: 'border-box',
              padding: '0 6px', borderRadius: 999, background: M.love, border: '2px solid #FFFFFF',
              color: '#FFFFFF', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2, ...TYPE.number,
            }}>×{supers}</span>
          )}
        </span>
      </div>

      {/* ── What it means right now ── */}
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 19, lineHeight: 1.25, fontWeight: 800 }}>
          {ownsSkin ? cat.t('The jelly coat is {his}')
            : holding ? (supers > 1 ? `${supers} Super Jellies are ready` : 'A Super Jelly is ready')
              : full ? 'Tray complete'
                : 'Win five for a Super Jelly'}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
          {ownsSkin ? cat.t('{He} ate five Super Jellies. The coat is in the closet.')
            : holding ? cat.t('A whole day of jelly in one mould. Feed it to {him}.')
              : 'Win a round to light a jelly. The tray empties every night.'}
        </p>
      </div>

      {(holding || ownsSkin) && (
        <div style={{ marginTop: 14 }}>
          {ownsSkin ? (
            <SecondaryButton size="lg" icon={<MeadowIcon name="dress" size={20} />}
              onClick={() => { playSound('ui_select'); onOpenCloset() }}>
              Wear it
            </SecondaryButton>
          ) : (
            <PrimaryButton busy={busy} icon={<MeadowIcon name="sparkle" size={20} color="#FFFFFF" mono />}
              onClick={() => { playSound('ui_select'); onFeed() }}>
              {busy ? 'Feeding...' : cat.t('Feed {name}')}
            </PrimaryButton>
          )}
        </div>
      )}

      {/* ── The road to the coat: one step per feed ── */}
      {!ownsSkin && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${M.divider}` }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
            <span style={{ ...TYPE.label, color: M.label }}>{cat.t('Fed to {him}')}</span>
            <span style={{ fontSize: 13, ...TYPE.number }}>{fed}/{goal}</span>
          </div>
          <div role="img" aria-label={`${fed} of ${goal} fed`} className="flex" style={{ gap: 4 }}>
            {Array.from({ length: goal }, (_, i) => (
              <span key={i} style={{ flex: 1, height: 10, borderRadius: 999, background: i < fed ? M.love : M.track }} />
            ))}
          </div>
          <p style={{ margin: '7px 0 0', fontSize: 13, fontWeight: 600, color: M.text2 }}>
            {cat.t('Five feeds and the jelly coat is {his}.')}
          </p>
        </div>
      )}
    </Card>
  )
})

export default ParlourTray
