'use client'

// ─── CollectionView ──────────────────────────────────────────────────────────
// The gacha collection: every outfit and every snack, found or not. Sibling
// screen to the Closet, so it wears the same Meadow clothes: the Me page's
// ground, a white card for the count, a segmented switch, white tiles in a
// grid with each rarity's tint behind what you own.
//
// What you HAVEN'T found shows as its shape only, a faint shadow on grey, with
// a lock and no name. A collection runs on the pull of its gaps, and a legible
// card would give away the thing it's asking you to chase. Tapping one still
// answers the only question worth asking, where do I get it, in a sheet, so a
// locked tap is never a dead tap.
//
// Presentational only: the container (gacha/collection/page.tsx) owns the
// inventory data and the use/navigate actions. Kept pure so it can be
// screenshotted with mock ownership.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef } from 'react'
import { GACHA_FOOD_GRANT, getItemsByCategory } from '@/lib/gacha'
import { skinUnlockDrink } from '@/lib/skins'
import { FOOD_META } from '@/lib/foodMeta'
import type { GachaCategory, GachaItemDef, FoodKey } from '@/types'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { swapCatName } from '@/lib/catWords'
import CanFx, { hasCanFx } from '@/components/care/CanFx'
import { IconCan } from '@/components/PixelIcons'
import {
  Card, M, MeadowIcon, MeadowPage, Meter, PrimaryButton, RARITY_TAG, SectionLabel, Segmented, Sheet, Tag, TYPE,
} from '@/components/meadow'
import { RARITY_FILL } from '@/components/gacha/rarity'

/** A locked item: its shape only, a soft shadow (the Closet's silhouette). */
const SILHOUETTE = 'grayscale(1) brightness(0) opacity(0.2)'

const TAB_LABEL: Record<GachaCategory, string> = { skin: 'Outfits', consumable: 'Snacks' }

// The outfits tab is long enough to need shelves. Earned leads because it's
// the only group you can't pull for (see `unlock` in lib/skins.ts).
const SKIN_SECTIONS = [
  { key: 'special', label: 'Earned, not pulled', match: (i: GachaItemDef) => !!i.unlock },
  { key: 'animal', label: 'Kitty Costumes', match: (i: GachaItemDef) => !i.unlock && i.skinSet === 'animal' },
  { key: 'food', label: 'FoodSuits', match: (i: GachaItemDef) => !i.unlock && i.skinSet === 'food' },
]

/**
 * An item's picture, `fill` of its square box: shared by the tile and the
 * sheet. A special-edition can also brings its moving sparkles or rays
 * (CanFx), found through the fridge food the pull grants; they share the box
 * and the silhouette filter with the can, so a locked tile is one shape.
 */
function ItemArt({ item, fill, locked }: { item: GachaItemDef; fill: string; locked: boolean }) {
  const food = GACHA_FOOD_GRANT[item.id]
  const filter = locked ? SILHOUETTE : 'none'
  if (food === undefined || !hasCanFx(food)) return (
    <img src={item.image} alt="" draggable={false} style={{ width: fill, height: fill, objectFit: 'contain', filter }} />
  )
  return (
    <span style={{ position: 'relative', display: 'block', width: fill, height: fill, filter }}>
      <img src={item.image} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <CanFx id={food} />
    </span>
  )
}

/**
 * Where an item actually comes from: the answer a locked tap is asking for.
 * A lib/catWords template, like the item's description: fill it with cat.t.
 */
function sourceHint(item: GachaItemDef): string {
  if (item.category === 'consumable') return 'Pull it from the Snacks & Drinks machine.'
  if (item.unlock === 'jelly') {
    return 'Fill the Parlour tray of five in a day for a Super Jelly. Feed {him} five of those and {he} earns the coat.'
  }
  const drink = item.skinId ? skinUnlockDrink(item.skinId) : undefined
  if (drink) return `Feed {name} a ${FOOD_META[drink as FoodKey].name}. The first can {he} finishes leaves its colours on {him} for good.`
  return item.skinSet === 'food'
    ? 'Pull it from the FoodSuits machine, or unlock it with stardust in the Closet.'
    : 'Pull it from the Kitty Costumes machine, or unlock it with stardust in the Closet.'
}

interface Props {
  tab: GachaCategory
  onTabChange: (tab: GachaCategory) => void
  ownsItem: (id: string) => boolean
  getQuantity: (id: string) => number
  collectionPct: number
  ownedCount: number
  totalItems: number
  /** False until the inventory has been CONFIRMED fetched — a 503 leaves it
   *  empty, and drawing that would black out a collection you actually have. */
  ready: boolean
  selected: GachaItemDef | null
  onSelect: (item: GachaItemDef | null) => void
  onUse: (item: GachaItemDef) => void
  onOpenCloset: () => void
  onBack: () => void
  toast: string | null
}

export default function CollectionView({
  tab, onTabChange, ownsItem, getQuantity, collectionPct, ownedCount, totalItems,
  ready, selected, onSelect, onUse, onOpenCloset, onBack, toast,
}: Props) {
  const items = useMemo(() => getItemsByCategory(tab), [tab])
  const owned = (list: GachaItemDef[]) => list.filter(i => ownsItem(i.id)).length

  return (
    <MeadowPage ground="me" title="Collection" withNav={false}
      back={{ onClick: () => { playSound('ui_back'); onBack() }, label: 'Back' }}>

      {/* ── How much you've found ── */}
      <Card style={{ marginTop: 16 }}>
        <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
          <span style={{ ...TYPE.label, color: M.label }}>Found</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>
            {ready ? `${collectionPct}%` : ''}
          </span>
        </div>
        <div style={{ marginTop: 4, fontSize: 30, lineHeight: 1.15, ...TYPE.number, color: M.text }}>
          {ready ? ownedCount : '-'}
          <span style={{ fontSize: 18, color: M.text2 }}> of {totalItems}</span>
        </div>
        <Meter value={ready ? collectionPct / 100 : 0} style={{ marginTop: 12 }} label="Collection found" />
      </Card>

      <Segmented<GachaCategory>
        ariaLabel="Collection category"
        value={tab}
        onChange={t => { playSound('ui_tap'); onTabChange(t); onSelect(null) }}
        style={{ marginTop: 16, background: '#FFFFFF' }}
        options={(['skin', 'consumable'] as const).map(c => ({
          value: c,
          label: <>{TAB_LABEL[c]}<Count n={getItemsByCategory(c).length} /></>,
        }))}
      />

      {/* ── The shelves ── */}
      {!ready ? (
        <p role="status" style={{ margin: '48px 0', textAlign: 'center', fontSize: 14, fontWeight: 600, color: M.text2 }}>
          Loading your collection...
        </p>
      ) : tab === 'skin' ? (
        SKIN_SECTIONS.map(sec => {
          const rows = items.filter(sec.match)
          if (rows.length === 0) return null
          return (
            <section key={sec.key}>
              <SectionLabel trailing={`${owned(rows)} of ${rows.length}`}>{sec.label}</SectionLabel>
              <ItemGrid items={rows} ownsItem={ownsItem} getQuantity={getQuantity} onPick={onSelect} />
            </section>
          )
        })
      ) : (
        <section>
          <SectionLabel trailing={`${owned(items)} of ${items.length}`}>Cans and treats</SectionLabel>
          <ItemGrid items={items} ownsItem={ownsItem} getQuantity={getQuantity} onPick={onSelect} />
        </section>
      )}

      <ItemSheet
        item={selected}
        ownsItem={ownsItem}
        getQuantity={getQuantity}
        onUse={item => { playSound('ui_tap'); onUse(item) }}
        onCloset={() => { playSound('ui_tap'); onOpenCloset() }}
        onClose={() => { playSound('ui_modal_close'); onSelect(null) }}
      />

      {toast && (
        <div role="status" className="fixed inset-x-0 flex justify-center pointer-events-none"
          style={{ top: 'calc(var(--safe-top) + 12px)', zIndex: 90, padding: '0 16px' }}>
          <span className="meadow-root" style={{
            padding: '10px 16px', borderRadius: 20, background: M.text, color: '#FFFFFF',
            fontSize: 14, lineHeight: 1.35, fontWeight: 700, textAlign: 'center', overflowWrap: 'anywhere',
          }}>{toast}</span>
        </div>
      )}
    </MeadowPage>
  )
}

function Count({ n }: { n: number }) {
  return <span style={{ marginLeft: 6, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
}

// ─── Grid ────────────────────────────────────────────────────────────────────
function ItemGrid({ items, ownsItem, getQuantity, onPick }: {
  items: GachaItemDef[]
  ownsItem: (id: string) => boolean
  getQuantity: (id: string) => number
  onPick: (item: GachaItemDef) => void
}) {
  return (
    <div className="grid grid-cols-3" style={{ gap: 10 }}>
      {items.map(item => (
        <ItemTile key={item.id} item={item} owned={ownsItem(item.id)} quantity={getQuantity(item.id)}
          onClick={() => { playSound('ui_modal_open'); onPick(item) }} />
      ))}
    </div>
  )
}

// ─── Tile ────────────────────────────────────────────────────────────────────
function ItemTile({ item, owned, quantity, onClick }: {
  item: GachaItemDef; owned: boolean; quantity: number; onClick: () => void
}) {
  const cat = useCat()
  const name = swapCatName(item.name, cat)
  const can = item.category === 'consumable'
  return (
    <button type="button" onClick={onClick}
      aria-label={owned ? `${name}, ${item.rarity}${can ? `, ${quantity} left` : ''}` : `Not found yet, ${item.rarity}`}
      className="m-press m-focus relative flex flex-col" style={{
        padding: 6, gap: 6, border: 0, borderRadius: 18, background: '#FFFFFF',
        fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', minWidth: 0,
      }}>
      <span className="relative flex items-center justify-center" style={{
        width: '100%', aspectRatio: '1', borderRadius: 13, background: owned ? RARITY_TAG[item.rarity].bg : M.soft,
      }}>
        <ItemArt item={item} fill="84%" locked={!owned} />
        {!owned && (
          <span aria-hidden className="absolute flex items-center justify-center" style={{
            right: 5, top: 5, width: 24, height: 24, borderRadius: 999, background: '#FFFFFF',
          }}>
            <MeadowIcon name="lock" size={14} />
          </span>
        )}
        {/* Earned by pouring a can: the one route stardust can't buy. */}
        {!owned && item.unlock === 'drink' && (
          <span aria-hidden className="absolute flex items-center justify-center" style={{
            left: 5, top: 5, width: 24, height: 24, borderRadius: 999, background: '#FFFFFF',
          }}>
            <IconCan size={14} />
          </span>
        )}
        {owned && can && (
          <span className="absolute" style={{
            right: 5, top: 5, minWidth: 24, height: 22, boxSizing: 'border-box', padding: '0 7px', borderRadius: 999,
            background: M.text, color: '#FFFFFF', fontSize: 12, fontWeight: 800, lineHeight: '22px', textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}>x{quantity}</span>
        )}
      </span>
      {/* Two lines for the name, so "Original Purrbolt" reads whole. */}
      <span className="flex items-start" style={{ gap: 5, padding: '0 3px 3px', minWidth: 0, minHeight: 29 }}>
        <span aria-hidden style={{ width: 8, height: 8, marginTop: 3, flexShrink: 0, borderRadius: 999, background: RARITY_FILL[item.rarity] }} />
        <span style={{
          fontSize: 12, fontWeight: 700, lineHeight: 1.2, color: owned ? M.text : M.faint, minWidth: 0,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere',
        }}>{owned ? name : '???'}</span>
      </span>
    </button>
  )
}

// ─── Detail / source sheet ───────────────────────────────────────────────────
function ItemSheet({ item: picked, ownsItem, getQuantity, onUse, onCloset, onClose }: {
  item: GachaItemDef | null
  ownsItem: (id: string) => boolean
  getQuantity: (id: string) => number
  onUse: (item: GachaItemDef) => void; onCloset: () => void; onClose: () => void
}) {
  const cat = useCat()
  // The last item shown, so the sheet slides away still showing it rather
  // than going blank for its closing frames.
  const last = useRef(picked)
  if (picked) last.current = picked
  const item = picked ?? last.current
  const owned = item ? ownsItem(item.id) : false
  const quantity = item ? getQuantity(item.id) : 0
  const can = item?.category === 'consumable'
  const footer = !item ? null
    : owned && !can ? <PrimaryButton onClick={onCloset}>Open the Closet</PrimaryButton>
    : owned && can ? <PrimaryButton onClick={() => onUse(item)} disabled={quantity <= 0}>Use one</PrimaryButton>
    : <PrimaryButton onClick={onClose}>Got it</PrimaryButton>
  return (
    <Sheet open={!!picked} onClose={onClose} title={item ? (owned ? swapCatName(item.name, cat) : 'Not found yet') : ''} footer={footer}>
      {item && (
        <div className="flex flex-col items-center" style={{ textAlign: 'center', paddingBottom: 4 }}>
          <span className="relative flex items-center justify-center" style={{
            width: 132, height: 132, borderRadius: 24, background: owned ? RARITY_TAG[item.rarity].bg : M.soft,
          }}>
            <ItemArt item={item} fill="84%" locked={!owned} />
          </span>
          <div className="flex items-center justify-center" style={{ gap: 6, marginTop: 14 }}>
            <Tag tone={item.rarity} caps>{item.rarity}</Tag>
            {!owned && <Tag icon={<MeadowIcon name="lock" size={16} />}>Locked</Tag>}
            {owned && can && <Tag tone="soft">{quantity} left</Tag>}
          </div>
          <p style={{ margin: '12px 0 0', maxWidth: 320, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
            {cat.t(owned ? item.description : sourceHint(item))}
          </p>
        </div>
      )}
    </Sheet>
  )
}
