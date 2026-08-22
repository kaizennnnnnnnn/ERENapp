'use client'

// ─── CollectionView ──────────────────────────────────────────────────────────
// The vault: every skin and every can, owned or not. Sibling screen to the
// Closet, so it wears the same clothes — dark panel, CRT scanlines, gold rivets,
// rarity frames from lib/rarityFrame (one table, shared with the closet grid).
//
// What you DON'T own is blacked out: silhouette only, no name, a lock and a
// dimmed hint of its tier. A collection screen runs on the pull of its gaps, and
// a greyed-but-legible card gives away the thing it's asking you to chase.
// Tapping a locked card still answers the only question worth asking — where do
// I get it — via a small source sheet, so a locked tap is never a dead tap.
//
// Presentational only — the container (gacha/collection/page.tsx) owns the
// inventory data and the use/navigate actions. Kept pure so it can be
// screenshotted with mock ownership at mobile widths.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { RARITY_COLORS, getCategoryLabel, getItemsByCategory } from '@/lib/gacha'
import { frameFor, lockedArt } from '@/lib/rarityFrame'
import { skinUnlockDrink } from '@/lib/skins'
import { FOOD_META } from '@/lib/foodMeta'
import type { GachaCategory, GachaItemDef, FoodKey } from '@/types'
import { playSound } from '@/lib/sounds'
import {
  IconBook, IconCatFace, IconCan, IconLock, IconPaw, IconCake, IconCrown, IconSparkles,
} from '@/components/PixelIcons'

const PANEL = '#1B1233'
const PANEL_BORDER = '#4C1D95'

// Two tabs, because there are two kinds of drop left. The emoji tabs —
// outfits, decorations, backgrounds, recipes, emotes, frames — are gone along
// with the items that filled them.
const CATEGORIES: GachaCategory[] = ['skin', 'consumable']
const TAB_ICON: Record<GachaCategory, React.ComponentType<{ size?: number }>> = {
  skin: IconCatFace, consumable: IconCan,
}

// The skins tab is long enough to need shelves. SPECIAL leads because it's the
// only group you can't pull for — see `unlock` in lib/skins.ts.
const SKIN_SECTIONS = [
  { key: 'special', label: 'EARNED, NOT PULLED', Icon: IconCrown, match: (i: GachaItemDef) => !!i.unlock },
  { key: 'animal',  label: 'ANIMAL COSTUMES', Icon: IconPaw,   match: (i: GachaItemDef) => !i.unlock && i.skinSet === 'animal' },
  { key: 'food',    label: 'FOODSUITS',       Icon: IconCake,  match: (i: GachaItemDef) => !i.unlock && i.skinSet === 'food' },
]

/** Where an item actually comes from — the answer a locked tap is asking for. */
function sourceHint(item: GachaItemDef): string {
  if (item.category === 'consumable') return 'Pull it from the SNACKS & DRINKS machine.'
  if (item.unlock === 'jelly') {
    return 'Fill the Parlour tray of five in a day for a Super Jelly. Feed him five of those and the coat is his.'
  }
  const drink = item.skinId ? skinUnlockDrink(item.skinId) : undefined
  if (drink) return `Feed Eren a ${FOOD_META[drink as FoodKey].name}. The first can he finishes leaves its colours on him for good.`
  return item.skinSet === 'food'
    ? 'Pull it from the FOODSUITS machine, or unlock it with stardust in the Closet.'
    : 'Pull it from the KITTY COSTUMES machine, or unlock it with stardust in the Closet.'
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
  const tabOwned = items.filter(i => ownsItem(i.id)).length

  // Grids can't be drawn from an unconfirmed inventory: a 503 leaves `owns`
  // empty, which would black out a collection the household actually has.
  const gate = !ready

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{
      background: 'radial-gradient(120% 80% at 50% 0%, #2A1B4A 0%, #160E2E 55%, #0B0717 100%)',
    }}>
      {/* CRT scanlines — the dark "game panel" convention */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
        zIndex: 1,
      }} />

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 text-white px-4 py-2.5 whitespace-nowrap" style={{
          top: 'calc(var(--safe-top) + 12px)', zIndex: 70,
          background: PANEL, borderRadius: 8, border: `2px solid ${PANEL_BORDER}`,
          boxShadow: '3px 3px 0 rgba(0,0,0,0.45)', fontFamily: '"Press Start 2P"', fontSize: 7,
        }}>{toast}</div>
      )}

      <div className="relative px-3 mx-auto" style={{
        zIndex: 2, maxWidth: 440,
        paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)',
      }}>
        {/* ── Header ── */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => { playSound('ui_back'); onBack() }}
            aria-label="Back"
            className="flex items-center justify-center active:translate-y-[1px] transition-transform"
            style={{ width: 40, height: 40, background: PANEL, borderRadius: 9, border: `2px solid ${PANEL_BORDER}`, boxShadow: '0 2px 0 #2E1065' }}>
            <ChevronLeft size={17} className="text-purple-200" />
          </button>
          <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', fontSize: 8, padding: '5px 10px' }}>
            <IconBook size={13} /> COLLECTION
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{
            background: PANEL, borderRadius: 8, border: `2px solid ${PANEL_BORDER}`, boxShadow: '0 2px 0 #2E1065',
          }}>
            <span className="sparkle-hue" aria-hidden><IconSparkles size={13} /></span>
            <span className="font-pixel" style={{ fontSize: 8, color: '#E9D5FF' }}>{collectionPct}%</span>
          </div>
        </div>

        {/* ── Completion ── */}
        <div className="relative mb-4 px-3 py-3" style={{
          background: 'linear-gradient(180deg, rgba(35,22,66,0.6), rgba(11,7,23,0.35))',
          border: '2px solid rgba(167,139,250,0.28)', borderRadius: 12,
        }}>
          {([['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']] as const).map(([v, h], i) => (
            <span key={i} aria-hidden className="absolute" style={{
              width: 4, height: 4, background: '#F5C842', boxShadow: '0 0 3px rgba(245,200,66,0.8)',
              top: v === 't' ? 6 : undefined, bottom: v === 'b' ? 6 : undefined,
              left: h === 'l' ? 6 : undefined, right: h === 'r' ? 6 : undefined,
            }} />
          ))}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="font-pixel" style={{ fontSize: 7, color: '#9D8BC4', letterSpacing: 1 }}>COLLECTED</span>
            <span className="font-pixel" style={{ fontSize: 8, color: '#fff' }}>
              {ownedCount}<span style={{ color: '#6B5B8C' }}>/{totalItems}</span>
            </span>
          </div>
          <div className="h-3 overflow-hidden" style={{
            borderRadius: 999, background: 'rgba(11,7,23,0.7)', border: '1.5px solid rgba(167,139,250,0.2)',
          }}>
            <div className="h-full transition-all duration-700" style={{
              width: `${collectionPct}%`, borderRadius: 999,
              background: 'linear-gradient(90deg, #7C3AED, #A78BFA 60%, #F5C842)',
              boxShadow: '0 0 10px rgba(167,139,250,0.6)',
            }} />
          </div>
        </div>

        {/* ── Category tabs ── */}
        <div role="tablist" aria-label="Collection category" className="flex p-1 mb-3" style={{
          background: 'rgba(11,7,23,0.5)', borderRadius: 11, border: '1.5px solid rgba(167,139,250,0.2)',
        }}>
          {CATEGORIES.map(cat => {
            const Icon = TAB_ICON[cat]
            const active = tab === cat
            const total = getItemsByCategory(cat).length
            return (
              <button key={cat} role="tab" aria-selected={active} aria-controls="collection-grid"
                onClick={() => { playSound('ui_tap'); onTabChange(cat); onSelect(null) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 active:scale-[0.98] transition-all"
                style={{
                  borderRadius: 8,
                  background: active ? 'linear-gradient(135deg, #7C3AED, #A78BFA)' : 'transparent',
                  boxShadow: active ? '0 0 12px rgba(167,139,250,0.4)' : 'none',
                }}>
                <span aria-hidden className="inline-flex"><Icon size={12} /></span>
                <span className="font-pixel" style={{ fontSize: 8, color: active ? '#fff' : '#9D8BC4', letterSpacing: 0.5 }}>
                  {getCategoryLabel(cat).toUpperCase()}
                </span>
                <span aria-hidden className="font-pixel flex items-center justify-center" style={{
                  fontSize: 6, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 999,
                  background: active ? 'rgba(11,7,23,0.4)' : 'rgba(167,139,250,0.18)',
                  color: active ? '#E9D5FF' : '#9D8BC4',
                }}>{total}</span>
              </button>
            )
          })}
        </div>

        {/* ── Grid ── */}
        <div id="collection-grid" role="tabpanel" aria-label={getCategoryLabel(tab)}>
          {gate ? (
            <p className="text-center font-pixel py-10" style={{ fontSize: 8, color: '#A78BFA' }}>LOADING…</p>
          ) : tab === 'skin' ? (
            SKIN_SECTIONS.map(sec => {
              const rows = items.filter(sec.match)
              if (rows.length === 0) return null
              return (
                <section key={sec.key} className="mb-5">
                  <ShelfLabel Icon={sec.Icon} label={sec.label}
                    owned={rows.filter(i => ownsItem(i.id)).length} total={rows.length} />
                  <ItemGrid items={rows} ownsItem={ownsItem} getQuantity={getQuantity} onPick={onSelect} />
                </section>
              )
            })
          ) : (
            <>
              <ShelfLabel Icon={IconCan} label="THE CAN FAMILY" owned={tabOwned} total={items.length} />
              <ItemGrid items={items} ownsItem={ownsItem} getQuantity={getQuantity} onPick={onSelect} />
            </>
          )}
        </div>
      </div>

      {selected && (
        <ItemSheet
          item={selected}
          owned={ownsItem(selected.id)}
          quantity={getQuantity(selected.id)}
          onUse={() => { playSound('ui_tap'); onUse(selected) }}
          onCloset={() => { playSound('ui_tap'); onOpenCloset() }}
          onClose={() => { playSound('ui_modal_close'); onSelect(null) }}
        />
      )}
    </div>
  )
}

// ─── Shelf label ─────────────────────────────────────────────────────────────
function ShelfLabel({ Icon, label, owned, total }: {
  Icon: React.ComponentType<{ size?: number }>; label: string; owned: number; total: number
}) {
  const complete = owned === total
  return (
    <div className="flex items-center gap-1.5 mb-2 px-0.5">
      <Icon size={11} />
      <span className="font-pixel" style={{ fontSize: 7, color: '#9D8BC4', letterSpacing: 1 }}>{label}</span>
      <span className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.28), transparent)' }} />
      <span className="font-pixel" style={{ fontSize: 6, color: complete ? '#F5C842' : '#6B5B8C' }}>
        {owned}/{total}
      </span>
    </div>
  )
}

// ─── Grid ────────────────────────────────────────────────────────────────────
function ItemGrid({ items, ownsItem, getQuantity, onPick }: {
  items: GachaItemDef[]
  ownsItem: (id: string) => boolean
  getQuantity: (id: string) => number
  onPick: (item: GachaItemDef) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map(item => (
        <ItemCard key={item.id} item={item} owned={ownsItem(item.id)}
          quantity={getQuantity(item.id)} onClick={() => { playSound('ui_modal_open'); onPick(item) }} />
      ))}
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────
function ItemCard({ item, owned, quantity, onClick }: {
  item: GachaItemDef; owned: boolean; quantity: number; onClick: () => void
}) {
  const locked = !owned
  const frame = frameFor(item.rarity, locked)
  const byDrink = item.unlock === 'drink'

  return (
    <button onClick={onClick}
      aria-label={locked ? `Locked ${item.rarity} ${item.category}` : item.name}
      className="relative flex flex-col items-center gap-1 p-1.5 active:scale-95 transition-all"
      style={{ ...frame.style, borderRadius: 10 }}>

      {/* legendary shimmer — clipped so it can't spill onto the badges */}
      {frame.shine && (
        <span aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 10 }}>
          <span className="absolute" style={{
            top: 0, bottom: 0, left: 0, width: '42%',
            background: 'linear-gradient(100deg, transparent 0%, rgba(255,248,214,0.55) 50%, transparent 100%)',
            animation: 'closetLegendShine 3.6s ease-in-out infinite',
          }} />
        </span>
      )}

      {/* legendary rivets (4) / epic gems (2 bottom) — quiet metal detail */}
      {frame.rivets && ([['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']] as const).map(([v, h], i) => (
        <span key={`rv${i}`} aria-hidden className="absolute pointer-events-none" style={{
          width: 3, height: 3, background: '#FFE9A8', boxShadow: '0 0 3px rgba(245,200,66,0.9)',
          top: v === 't' ? 4 : undefined, bottom: v === 'b' ? 4 : undefined,
          left: h === 'l' ? 4 : undefined, right: h === 'r' ? 4 : undefined,
        }} />
      ))}
      {frame.gems && ([['b', 'l'], ['b', 'r']] as const).map(([, h], i) => (
        <span key={`gm${i}`} aria-hidden className="absolute pointer-events-none" style={{
          width: 3, height: 3, background: '#C4B5FD', boxShadow: '0 0 3px rgba(167,139,250,0.85)',
          bottom: 4, left: h === 'l' ? 4 : undefined, right: h === 'r' ? 4 : undefined,
        }} />
      ))}

      <div className="flex items-center justify-center" style={{ width: '100%', aspectRatio: '1' }}>
        <img src={item.image} alt="" draggable={false} style={{
          width: '88%', height: '88%', objectFit: 'contain',
          // Skins are hi-res PNGs downscaled ~6x — pixelated would crawl a seam
          // on them. Only the can art is true pixel art.
          imageRendering: item.category === 'skin' ? 'auto' : 'pixelated',
          filter: locked ? lockedArt : 'none',
        }} />
      </div>

      <span className="font-pixel text-center leading-tight" style={{
        fontSize: 5.5, color: locked ? '#5B4E7A' : '#E9D5FF', minHeight: 12,
      }}>{locked ? '???' : item.name.toUpperCase()}</span>

      {locked && (
        <>
          <span aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: 14 }}>
            <IconLock size={18} />
          </span>
          {/* A can badge marks the one route stardust can't buy. */}
          {byDrink && (
            <span aria-hidden className="absolute -top-1.5 -right-1.5 flex items-center justify-center px-1 py-0.5" style={{
              background: '#3A2A05', border: '1.5px solid #F5C842', borderRadius: 6, boxShadow: '0 1px 0 #2E1065',
            }}>
              <IconCan size={9} />
            </span>
          )}
        </>
      )}

      {owned && item.category === 'consumable' && (
        <span className="absolute -top-1.5 -right-1.5 font-pixel flex items-center justify-center px-1" style={{
          fontSize: 6, minHeight: 15, color: '#fff',
          background: PANEL, border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 6, boxShadow: '0 1px 0 #2E1065',
        }}>x{quantity}</span>
      )}
    </button>
  )
}

// ─── Detail / source sheet ───────────────────────────────────────────────────
function ItemSheet({ item, owned, quantity, onUse, onCloset, onClose }: {
  item: GachaItemDef; owned: boolean; quantity: number
  onUse: () => void; onCloset: () => void; onClose: () => void
}) {
  const colors = RARITY_COLORS[item.rarity]

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6"
      role="dialog" aria-modal="true"
      style={{ zIndex: 60, background: 'rgba(5,3,12,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="relative w-full flex flex-col items-center gap-3" style={{
        maxWidth: 290, padding: 18, borderRadius: 14,
        background: 'radial-gradient(120% 90% at 50% 0%, #2A1B4A 0%, #160E2E 60%, #0B0717 100%)',
        border: `2px solid ${owned ? colors.border : 'rgba(167,139,250,0.3)'}`,
        boxShadow: `0 0 22px ${owned ? colors.glow : 'rgba(0,0,0,0.4)'}, 0 10px 30px rgba(0,0,0,0.6)`,
      }} onClick={e => e.stopPropagation()}>
        {([['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']] as const).map(([v, h], i) => (
          <span key={i} aria-hidden className="absolute" style={{
            width: 4, height: 4, background: '#F5C842', boxShadow: '0 0 3px #F5C842',
            top: v === 't' ? 7 : undefined, bottom: v === 'b' ? 7 : undefined,
            left: h === 'l' ? 7 : undefined, right: h === 'r' ? 7 : undefined,
          }} />
        ))}

        <span className="font-pixel px-2.5 py-1" style={{
          fontSize: 6, letterSpacing: 1.5, color: owned ? colors.text : '#9D8BC4',
          background: owned ? colors.bg : 'rgba(255,255,255,0.06)',
          border: `1.5px solid ${owned ? colors.border : 'rgba(167,139,250,0.3)'}`, borderRadius: 4,
        }}>{owned ? item.rarity.toUpperCase() : 'LOCKED'}</span>

        <div className="flex items-center justify-center" style={{
          width: 92, height: 92, borderRadius: 12,
          background: owned ? 'rgba(255,255,255,0.05)' : 'rgba(6,4,14,0.7)',
          border: `2px solid ${owned ? colors.border : 'rgba(167,139,250,0.22)'}`,
        }}>
          <img src={item.image} alt="" draggable={false} style={{
            width: '86%', height: '86%', objectFit: 'contain',
            imageRendering: item.category === 'skin' ? 'auto' : 'pixelated',
            filter: owned ? 'none' : lockedArt,
          }} />
        </div>

        <p className="font-pixel text-center" style={{ fontSize: 9, color: '#fff', lineHeight: 1.5 }}>
          {owned ? item.name.toUpperCase() : '???'}
        </p>
        <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.65, color: '#B9A6DE' }}>
          {owned ? item.description : sourceHint(item)}
        </p>

        {owned && item.category === 'skin' && (
          <button onClick={onCloset}
            className="w-full py-2.5 active:translate-y-[1px] transition-transform"
            style={{
              borderRadius: 10, background: 'linear-gradient(180deg, #8B5CF6, #6D28D9)',
              border: '2px solid #A78BFA', boxShadow: '0 2px 0 #4C1D95',
            }}>
            <span className="font-pixel" style={{ fontSize: 8, color: '#fff', letterSpacing: 0.5 }}>OPEN CLOSET</span>
          </button>
        )}

        {owned && item.category === 'consumable' && (
          <>
            <p className="font-pixel" style={{ fontSize: 6, color: '#6B5B8C' }}>OWNED: {quantity}</p>
            <button onClick={onUse} disabled={quantity <= 0}
              className="w-full py-2.5 active:translate-y-[1px] transition-transform disabled:opacity-40"
              style={{
                borderRadius: 10, background: 'linear-gradient(180deg, #22C55E, #16A34A)',
                border: '2px solid #4ADE80', boxShadow: '0 2px 0 #166534',
              }}>
              <span className="font-pixel" style={{ fontSize: 8, color: '#fff', letterSpacing: 0.5 }}>USE ITEM</span>
            </button>
          </>
        )}

        <button onClick={onClose} className="font-pixel" style={{ fontSize: 6, color: '#6B5B8C', letterSpacing: 0.5 }}>CLOSE</button>
      </div>
    </div>
  )
}
