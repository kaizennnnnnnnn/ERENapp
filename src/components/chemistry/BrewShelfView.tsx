'use client'

// The shelf behind the bench: bottles you're holding, and the twelve-potion
// collection underneath.
//
// This is the half of Eren's Brew that answers "what do I do with the potion" —
// a finished order becomes a real bottle that sits here until you pour it, and
// pouring is capped at one a day so a two-minute puzzle can't refill every care
// stat in the app on demand. Extra batches are still worth brewing: they stock
// tomorrow's choice and they're the only way to finish the collection.

import { useState } from 'react'
import { IconLock, IconPaw } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { POTIONS, POTION_BY_ID, GRADES, type Potion } from '@/lib/chemistry/potions'
import { canPour, SHELF_MAX, type ShelfState } from '@/lib/chemistry/brewShelf'
import BrewFlask from './BrewFlask'
import { PixelPanel, PixelButton, PixelLabel, PIXEL_FONT, BODY_FONT, hard, type PixelSkin } from './pixel'

interface Props {
  skin: PixelSkin
  shelf: ShelfState
  dailyKey: string
  /** Pour bottle `index` for Eren. The parent owns the animation + the perk. */
  onPour: (index: number) => void
  busy: boolean
}

export default function BrewShelfView({ skin, shelf, dailyKey, onPour, busy }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const pourable = canPour(shelf, dailyKey)
  const pick = selected !== null ? shelf.bottles[selected] : undefined
  const pickPotion = pick ? POTION_BY_ID[pick.potionId] : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Bottles in hand ── */}
      <PixelPanel skin={skin} rivets>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <PixelLabel color={skin.gold} size={8}>THE SHELF</PixelLabel>
          <PixelLabel color={skin.fgDim}>{shelf.bottles.length} / {SHELF_MAX}</PixelLabel>
        </div>

        {shelf.bottles.length === 0 ? (
          <p style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 1.5, color: skin.fgDim, margin: 0 }}>
            Nothing bottled yet. Fill an order at the bench and the potion lands here.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {shelf.bottles.map((b, i) => {
              const potion = POTION_BY_ID[b.potionId]
              if (!potion) return null
              const on = selected === i
              return (
                <button
                  key={`${b.potionId}-${i}`}
                  type="button"
                  onClick={() => { playSound('ui_tap'); setSelected(on ? null : i) }}
                  aria-label={`${potion.name}, ${GRADES[b.grade].label}`}
                  className="chem-pixel-btn"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '6px 2px 5px',
                    background: on ? skin.raised : skin.panelLo,
                    border: `2px solid ${on ? skin.gold : skin.edge}`,
                    boxShadow: on ? hard(skin.ink, 2) : 'none',
                  }}
                >
                  <BrewFlask fill={1} deep={potion.deep} light={potion.light} ink={skin.glassEdge} cell={2} />
                  <span style={{
                    fontFamily: PIXEL_FONT, fontSize: 5, letterSpacing: 0.4,
                    color: GRADES[b.grade].color,
                  }}>
                    {GRADES[b.grade].label}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {pickPotion && (
          <div style={{ marginTop: 11, borderTop: `2px solid ${skin.edge}`, paddingTop: 10 }}>
            <div style={{ fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 1.6, color: skin.fg }}>
              {pickPotion.name.toUpperCase()}
            </div>
            <div style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 1.45, color: skin.fgDim, marginTop: 5 }}>
              {pickPotion.blurb}
            </div>
            <PixelButton
              skin={skin}
              tone={pourable ? '#4ADE80' : undefined}
              disabled={!pourable || busy}
              onClick={() => { if (selected !== null) { setSelected(null); onPour(selected) } }}
              style={{ width: '100%', marginTop: 10 }}
            >
              <IconPaw size={14} />
              {pourable ? 'POUR IT FOR EREN' : 'ALREADY POURED TODAY'}
            </PixelButton>
            {!pourable && (
              <div style={{ fontFamily: BODY_FONT, fontSize: 11, color: skin.fgDim, marginTop: 6, textAlign: 'center' }}>
                One pour a day. The bottle keeps.
              </div>
            )}
          </div>
        )}
      </PixelPanel>

      {/* ── The collection ── */}
      <PixelPanel skin={skin}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <PixelLabel color={skin.gold} size={8}>THE RECIPE BOOK</PixelLabel>
          <PixelLabel color={skin.fgDim}>{shelf.brewed.length} / {POTIONS.length}</PixelLabel>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {POTIONS.map(p => (
            <CollectionCell key={p.id} potion={p} known={shelf.brewed.includes(p.id)} skin={skin} />
          ))}
        </div>
      </PixelPanel>
    </div>
  )
}

/** One recipe. Unknown ones show a locked silhouette — a legible grey card
 *  would give away the thing it's asking you to chase. */
function CollectionCell({ potion, known, skin }: { potion: Potion; known: boolean; skin: PixelSkin }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '8px 4px 6px',
      background: skin.panelLo,
      border: `2px solid ${skin.edge}`,
      opacity: known ? 1 : 0.72,
    }}>
      {known ? (
        <BrewFlask fill={1} deep={potion.deep} light={potion.light} ink={skin.glassEdge} cell={2} />
      ) : (
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <BrewFlask fill={1} deep={skin.edge} light={skin.edge} ink={skin.glassEdge} cell={2} />
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <IconLock size={16} />
          </span>
        </div>
      )}
      <span style={{
        fontFamily: PIXEL_FONT, fontSize: 5, letterSpacing: 0.3, lineHeight: 1.7,
        color: known ? skin.fg : skin.fgDim, textAlign: 'center',
      }}>
        {known ? potion.name.toUpperCase() : '? ? ?'}
      </span>
      <span style={{
        fontFamily: PIXEL_FONT, fontSize: 5, letterSpacing: 0.2, lineHeight: 1.6,
        color: known ? potion.light : 'transparent', textAlign: 'center',
      }}>
        {known ? potion.effect : '—'}
      </span>
    </div>
  )
}
