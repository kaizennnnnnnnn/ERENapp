'use client'

// ═══════════════════════════════════════════════════════════════════════════
// TROPHY SHOP — where a won day turns into something you can see.
//
// Four shelves, and they are deliberately different KINDS of thing rather
// than four drawers of the same cosmetic:
//   DECOR      changes the house, for both of you
//   WEAR       changes the cat, for both of you
//   POWERS     changes the next battle
//   PRESTIGE   changes your name
//
// Nothing here is buyable with coins. That is the entire economic point: the
// daily battle is the only source of trophies, so the only way to own any of
// this is to have won days.
//
// A card is a picture, a claim, and ONE row of controls along the bottom. The
// first cut hung the equip toggle off the right-hand edge at 6px next to the
// price, and the result was a shop you could buy from but could not work out
// how to wear.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyCosmetics } from '@/hooks/useTrophyCosmetics'
import {
  itemsOfKind, SHOP_RARITY_COLORS,
  type AnyShopItem, type ShopKind, type DecorItem,
  type PrivilegeItem, type PrestigeItem,
} from '@/lib/trophyShop'
import { OBSIDIAN_BTN, Rivets, accentA } from '@/components/obsidian'
import {
  IconTrophyTier, IconShelf, IconDress, IconLightning, IconCrown, IconLock, IconCheck,
} from '@/components/PixelIcons'
import ItemPreview from './ItemPreview'
import { playSound } from '@/lib/sounds'

const TABS: { kind: ShopKind; label: string; icon: React.ReactNode; sub: string }[] = [
  { kind: 'decor',     label: 'DECOR',    icon: <IconShelf size={14} />,     sub: 'Hangs in a room. Both of you see it.' },
  { kind: 'accessory', label: 'WEAR',     icon: <IconDress size={14} />,     sub: 'Worn over any skin. Both of you see it.' },
  { kind: 'privilege', label: 'POWERS',   icon: <IconLightning size={14} />, sub: 'Spent on the battle, not on the mirror.' },
  { kind: 'prestige',  label: 'PRESTIGE', icon: <IconCrown size={14} />,     sub: 'Sits beside your name, everywhere.' },
]

const ROOM_LABEL: Record<string, string> = {
  feed: 'KITCHEN', play: 'PLAYROOM', sleep: 'BEDROOM', wash: 'BATHROOM',
}

interface Props {
  /** Which shelf is open. Owned by the page so the loadout strip can jump. */
  tab: ShopKind
  onTab(kind: ShopKind): void
  /** Opens the confirm sheet. Owned by the page so the sheet can portal. */
  onBuy(item: AnyShopItem): void
  /** Fires a privilege the player already owns. */
  onUse(item: PrivilegeItem): void
}

export default function TrophyShopView({ tab, onTab, onBuy, onUse }: Props) {
  const { user, profile } = useAuth()
  const trophies = useTrophies()
  const cos = useTrophyCosmetics()
  const { partner } = useCouple()
  const partnerPresent = !!partner?.id

  const items = useMemo(() => itemsOfKind(tab), [tab])
  // A solo household has no battle, so nothing here can ever be earned — say
  // that instead of showing a price list with no way to pay it.
  const hasPartner = trophies.owned.some(o => o.userId !== user?.id) || partnerPresent
  const active = TABS.find(t => t.kind === tab)!
  const myName = profile?.name?.split(' ')[0] || 'YOU'

  return (
    <div className="flex flex-col gap-3">
      {/* ── Shelf picker ── */}
      <div className="flex gap-1.5">
        {TABS.map(t => {
          const on = t.kind === tab
          const stock = itemsOfKind(t.kind)
          const have = stock.filter(i => trophies.mine(i.id)).length
          return (
            <button
              key={t.kind}
              onClick={() => { playSound('ui_tap'); onTab(t.kind) }}
              className="flex-1 flex flex-col items-center gap-1 py-2 relative active:translate-y-[1px] transition-transform"
              style={{
                ...OBSIDIAN_BTN,
                border: on ? `1.5px solid ${accentA(0.9)}` : '1px solid rgba(255,255,255,0.07)',
                boxShadow: on
                  ? `0 0 12px ${accentA(0.3)}, ${OBSIDIAN_BTN.boxShadow}`
                  : OBSIDIAN_BTN.boxShadow as string,
                opacity: on ? 1 : 0.62,
              }}
            >
              {on && <Rivets inset={2} size={2} />}
              <span style={{ filter: on ? undefined : 'grayscale(0.7) brightness(0.8)' }}>{t.icon}</span>
              <span className="font-pixel" style={{
                fontSize: 5, letterSpacing: 1, color: on ? '#FFD9EC' : '#8B7F9B',
              }}>{t.label}</span>
              <span className="font-pixel" style={{
                fontSize: 5, color: have ? '#63F094' : '#5E5470',
              }}>{have}/{stock.length}</span>
            </button>
          )
        })}
      </div>

      <p className="text-center text-[10px]" style={{ color: '#8B7F9B' }}>{active.sub}</p>

      {/* Day one is a wall of locked cards and no obvious way in. Say where
          trophies come from, once, and only while there are none. */}
      {trophies.loaded && trophies.balance === 0 && (
        <div className="px-3 py-2.5 text-center" style={{
          border: '1px dashed rgba(245,200,66,0.35)',
          background: 'rgba(245,200,66,0.05)',
          borderRadius: 4,
        }}>
          <p className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#F5C842', marginBottom: 4 }}>
            HOW TO GET TROPHIES
          </p>
          <p className="text-[10px]" style={{ color: '#B4A8C4' }}>
            {hasPartner
              ? 'Win a day of the Care Battle. Ahead at midnight pays bronze; lead by 3 pays silver, by 6 pays gold. Lose by two or less and you still get one.'
              : 'The Care Battle needs two people. Invite your partner from the couple screen and the days start counting.'}
          </p>
        </div>
      )}

      {/* ── Shelf ── */}
      <div className="flex flex-col gap-2.5">
        {items.map(item => (
          <ShopCard
            key={item.id}
            item={item}
            owned={trophies.mine(item.id)}
            qty={trophies.qty(item.id)}
            partnerHas={trophies.owned.some(o =>
              o.userId !== user?.id && o.itemId === item.id && o.quantity > 0)}
            balance={trophies.balance}
            cos={cos}
            myName={myName}
            onBuy={() => onBuy(item)}
            onUse={() => onUse(item as PrivilegeItem)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── One card ────────────────────────────────────────────────────────────────
// Exported so a throwaway preview route can render one without the page's
// providers — see scripts/tro_preview_page.tsx.txt and scripts/shoot_tro.js.

export function ShopCard({
  item, owned, qty, partnerHas, balance, cos, myName, onBuy, onUse,
}: {
  item: AnyShopItem
  owned: boolean
  qty: number
  partnerHas: boolean
  balance: number
  cos: ReturnType<typeof useTrophyCosmetics>
  myName: string
  onBuy(): void
  onUse(): void
}) {
  const rc = SHOP_RARITY_COLORS[item.rarity]
  const affordable = balance >= item.price
  const buyable = !owned || item.stackable === true
  const banner = item.kind === 'prestige'

  return (
    <div className="relative flex flex-col" style={{
      ...OBSIDIAN_BTN,
      border: owned ? `1.5px solid ${rc.border}` : '1px solid rgba(255,255,255,0.06)',
      background: owned
        ? `linear-gradient(135deg, ${rc.bg} 0%, #050507 100%)`
        : OBSIDIAN_BTN.background as string,
      boxShadow: owned
        ? `0 0 10px ${rc.glow}, ${OBSIDIAN_BTN.boxShadow}`
        : OBSIDIAN_BTN.boxShadow as string,
      overflow: 'hidden',
    }}>
      {owned && <Rivets inset={2} size={2} />}

      {/* A nameplate is a banner, not an icon: boxed into the 78px thumb
          column it clipped UNDEFEATED to UNDEFEATI. Prestige gets the full
          width of the card and the thumb column is dropped. */}
      {banner && (
        <div className="flex justify-center px-3 pt-3" style={{ opacity: owned ? 1 : 0.85 }}>
          <ItemPreview item={item} size={78} name={myName} />
        </div>
      )}

      <div className="flex gap-3 px-3 pt-3 pb-2.5">
        {!banner && (
          /* Preview — sized so a room diorama and a worn hat both read. */
          <div className="flex-shrink-0 flex items-center justify-center" style={{
            width: 78, minHeight: 62,
            opacity: owned ? 1 : 0.85,
          }}>
            <ItemPreview item={item} size={78} name={myName} />
          </div>
        )}

        {/* Text */}
        <div className={`flex-1 min-w-0 flex flex-col justify-center gap-1${banner ? ' items-center text-center' : ''}`}>
          <div className="flex items-center gap-1.5">
            <span className="font-pixel truncate" style={{
              fontSize: 7, letterSpacing: 1, color: owned ? rc.text : '#D6CBE2',
            }}>{item.name.toUpperCase()}</span>
            {qty > 1 && (
              <span className="font-pixel flex-shrink-0" style={{ fontSize: 6, color: '#FFD650' }}>x{qty}</span>
            )}
          </div>
          <p className="text-[10px] leading-snug" style={{ color: '#9A8EAA' }}>{item.blurb}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-pixel px-1 py-0.5" style={{
              fontSize: 5, letterSpacing: 1, color: rc.text,
              background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 2,
            }}>{item.rarity.toUpperCase()}</span>
            <Where item={item} />
          </div>
          {partnerHas && !owned && (
            <p className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#C9B4FF' }}>
              THEY ALREADY HAVE THIS
            </p>
          )}
        </div>
      </div>

      {/* ── Action rail ── */}
      <div className="flex items-stretch gap-2 px-3 py-2" style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.32)',
      }}>
        {buyable ? (
          <button
            onClick={() => { playSound(affordable ? 'ui_select' : 'ui_tap'); if (affordable) onBuy() }}
            disabled={!affordable}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 active:translate-y-[1px] transition-transform"
            style={{
              minWidth: 84,
              background: affordable
                ? 'linear-gradient(180deg, #FDE68A 0%, #F5C842 55%, #B45309 100%)'
                : 'rgba(255,255,255,0.05)',
              border: `1.5px solid ${affordable ? '#7a4a08' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 3,
              opacity: affordable ? 1 : 0.55,
            }}
          >
            <IconTrophyTier size={12} tier="gold" />
            <span className="font-pixel" style={{
              fontSize: 8, color: affordable ? '#3A2400' : '#7A7286',
            }}>{item.price}</span>
            <span className="font-pixel" style={{
              fontSize: 6, letterSpacing: 1, color: affordable ? '#5C3B02' : '#7A7286',
            }}>{owned ? 'AGAIN' : 'BUY'}</span>
          </button>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5" style={{
            border: `1.5px solid ${rc.border}`, borderRadius: 3, background: rc.bg,
          }}>
            <IconCheck size={9} />
            <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: rc.text }}>OWNED</span>
          </span>
        )}

        <div className="flex-1 flex items-center justify-end">
          <EquipControl item={item} owned={owned} cos={cos} onUse={onUse} />
        </div>
      </div>
    </div>
  )
}

/** Where a bought thing will show up — the answer to "and then what". */
function Where({ item }: { item: AnyShopItem }) {
  const chip = (text: string) => (
    <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#7E7090' }}>
      {text}
    </span>
  )
  if (item.kind === 'decor') return chip(ROOM_LABEL[(item as DecorItem).room] ?? '')
  if (item.kind === 'accessory') return chip('ON EREN')
  if (item.kind === 'privilege') {
    const p = item as PrivilegeItem
    return chip(p.minutes === 0 ? 'ONE SHOT'
      : p.minutes >= 60 ? `LASTS ${Math.round(p.minutes / 60)}H` : `LASTS ${p.minutes}M`)
  }
  return chip((item as PrestigeItem).slot === 'title' ? 'UNDER YOUR NAME' : 'AROUND YOUR NAME')
}

// ─── Equip / use ─────────────────────────────────────────────────────────────

function EquipControl({
  item, owned, cos, onUse,
}: {
  item: AnyShopItem
  owned: boolean
  cos: ReturnType<typeof useTrophyCosmetics>
  onUse(): void
}) {
  if (!owned) {
    return (
      <span className="flex items-center gap-1.5" style={{ opacity: 0.4 }}>
        <IconLock size={11} />
        <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#7A7286' }}>
          LOCKED
        </span>
      </span>
    )
  }

  if (item.kind === 'accessory') {
    const on = cos.accessory === item.id
    return (
      <Toggle on={on} onLabel="WEARING" offLabel="PUT IT ON"
        onClick={() => { playSound('ui_tap'); cos.wear(on ? null : item.id) }} />
    )
  }

  if (item.kind === 'decor') {
    const d = item as DecorItem
    const on = cos.decor[d.room] === item.id
    return (
      <Toggle on={on} onLabel="HANGING" offLabel="HANG IT UP"
        onClick={() => { playSound('ui_tap'); cos.place(d.room, on ? null : item.id) }} />
    )
  }

  if (item.kind === 'prestige') {
    const p = item as PrestigeItem
    const on = p.slot === 'title' ? cos.myTitle === item.id : cos.myFrame === item.id
    return (
      <Toggle on={on} onLabel="EQUIPPED" offLabel="EQUIP"
        onClick={() => {
          playSound('ui_tap')
          if (p.slot === 'title') cos.setTitle(on ? null : item.id)
          else cos.setFrame(on ? null : item.id)
        }} />
    )
  }

  // Privilege — a consumable, so the button spends one.
  return (
    <button
      onClick={() => { playSound('ui_select'); onUse() }}
      className="px-3 py-1.5 flex items-center gap-1.5 active:translate-y-[1px] transition-transform"
      style={{
        border: '1.5px solid #63F094',
        borderRadius: 3,
        background: 'linear-gradient(180deg, rgba(99,240,148,0.22) 0%, rgba(99,240,148,0.06) 100%)',
        boxShadow: '0 0 8px rgba(99,240,148,0.22)',
      }}
    >
      <IconLightning size={10} />
      <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#A7F3C0' }}>
        USE ONE
      </span>
    </button>
  )
}

function Toggle({
  on, onLabel, offLabel, onClick,
}: { on: boolean; onLabel: string; offLabel: string; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 flex items-center gap-1.5 active:translate-y-[1px] transition-transform"
      style={{
        border: `1.5px solid ${on ? '#63F094' : 'rgba(255,255,255,0.28)'}`,
        borderRadius: 3,
        background: on
          ? 'linear-gradient(180deg, rgba(99,240,148,0.24) 0%, rgba(99,240,148,0.06) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow: on ? '0 0 8px rgba(99,240,148,0.22)' : undefined,
      }}
    >
      {on && <IconCheck size={9} />}
      <span className="font-pixel" style={{
        fontSize: 7, letterSpacing: 1, color: on ? '#A7F3C0' : '#D6CBE2',
      }}>{on ? onLabel : offLabel}</span>
    </button>
  )
}
