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
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyCosmetics } from '@/hooks/useTrophyCosmetics'
import {
  itemsOfKind, SHOP_RARITY_COLORS,
  type AnyShopItem, type ShopKind, type DecorItem,
  type AccessoryItem, type PrivilegeItem, type PrestigeItem,
} from '@/lib/trophyShop'
import { OBSIDIAN_FACE, OBSIDIAN_BTN, Rivets, accentA } from '@/components/obsidian'
import {
  IconTrophyTier, IconShelf, IconDress, IconLightning, IconCrown, IconLock, IconCheck,
} from '@/components/PixelIcons'
import DecorArt from './DecorArt'
import AccessoryThumb from './AccessoryThumb'
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
  /** Opens the confirm sheet. Owned by the page so the sheet can portal. */
  onBuy(item: AnyShopItem): void
  /** Fires a privilege the player already owns. */
  onUse(item: PrivilegeItem): void
}

export default function TrophyShopView({ onBuy, onUse }: Props) {
  const { user } = useAuth()
  const trophies = useTrophies()
  const cos = useTrophyCosmetics()
  const [tab, setTab] = useState<ShopKind>('decor')

  const items = useMemo(() => itemsOfKind(tab), [tab])
  const active = TABS.find(t => t.kind === tab)!

  return (
    <div className="flex flex-col gap-3">
      {/* ── Shelf picker ── */}
      <div className="flex gap-1.5">
        {TABS.map(t => {
          const on = t.kind === tab
          return (
            <button
              key={t.kind}
              onClick={() => { playSound('ui_tap'); setTab(t.kind) }}
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
            </button>
          )
        })}
      </div>

      <p className="text-center text-[10px]" style={{ color: '#8B7F9B' }}>{active.sub}</p>

      {/* ── Shelf ── */}
      <div className="flex flex-col gap-2">
        {items.map(item => {
          const owned = trophies.mine(item.id)
          const qty = trophies.qty(item.id)
          const partnerHas = trophies.owned.some(o =>
            o.userId !== user?.id && o.itemId === item.id && o.quantity > 0)
          return (
            <ShopCard
              key={item.id}
              item={item}
              owned={owned}
              qty={qty}
              partnerHas={partnerHas}
              balance={trophies.balance}
              cos={cos}
              onBuy={() => onBuy(item)}
              onUse={() => onUse(item as PrivilegeItem)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── One card ────────────────────────────────────────────────────────────────

function ShopCard({
  item, owned, qty, partnerHas, balance, cos, onBuy, onUse,
}: {
  item: AnyShopItem
  owned: boolean
  qty: number
  partnerHas: boolean
  balance: number
  cos: ReturnType<typeof useTrophyCosmetics>
  onBuy(): void
  onUse(): void
}) {
  const rc = SHOP_RARITY_COLORS[item.rarity]
  const affordable = balance >= item.price
  const buyable = !owned || item.stackable === true

  return (
    <div className="relative flex gap-3 px-3 py-2.5" style={{
      ...OBSIDIAN_BTN,
      border: owned ? `1.5px solid ${rc.border}` : '1px solid rgba(255,255,255,0.06)',
      background: owned
        ? `linear-gradient(135deg, ${rc.bg} 0%, #050507 100%)`
        : OBSIDIAN_BTN.background as string,
      boxShadow: owned
        ? `0 0 10px ${rc.glow}, ${OBSIDIAN_BTN.boxShadow}`
        : OBSIDIAN_BTN.boxShadow as string,
    }}>
      {owned && <Rivets inset={2} size={2} />}

      {/* Preview */}
      <div className="flex-shrink-0 flex items-center justify-center" style={{
        width: 54, height: 54,
        background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.05) 0%, transparent 70%)',
        opacity: owned ? 1 : 0.62,
      }}>
        <Preview item={item} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-pixel truncate" style={{
            fontSize: 7, letterSpacing: 1, color: owned ? rc.text : '#C4B8D0',
          }}>{item.name.toUpperCase()}</span>
          {qty > 1 && (
            <span className="font-pixel" style={{ fontSize: 6, color: '#FFD650' }}>x{qty}</span>
          )}
        </div>
        <p className="text-[10px] leading-snug" style={{ color: '#8B7F9B' }}>{item.blurb}</p>
        <Where item={item} />
        {partnerHas && !owned && (
          <p className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#C9B4FF' }}>
            THEY ALREADY HAVE THIS
          </p>
        )}
      </div>

      {/* Action */}
      <div className="flex-shrink-0 flex flex-col items-end justify-center gap-1.5" style={{ minWidth: 62 }}>
        {buyable && (
          <button
            onClick={() => { playSound(affordable ? 'ui_select' : 'ui_tap'); if (affordable) onBuy() }}
            disabled={!affordable}
            className="px-2 py-1.5 flex items-center gap-1 active:translate-y-[1px] transition-transform"
            style={{
              background: affordable
                ? 'linear-gradient(180deg, #FDE68A 0%, #F5C842 55%, #B45309 100%)'
                : 'rgba(255,255,255,0.05)',
              border: `1.5px solid ${affordable ? '#7a4a08' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 3,
              opacity: affordable ? 1 : 0.55,
            }}
          >
            <IconTrophyTier size={10} tier="gold" />
            <span className="font-pixel" style={{
              fontSize: 8, color: affordable ? '#3A2400' : '#7A7286',
            }}>{item.price}</span>
          </button>
        )}
        <EquipButton item={item} owned={owned} cos={cos} onUse={onUse} />
      </div>
    </div>
  )
}

/** Where a bought thing will show up — the answer to "and then what". */
function Where({ item }: { item: AnyShopItem }) {
  if (item.kind === 'decor') {
    return (
      <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#6E6080' }}>
        {ROOM_LABEL[(item as DecorItem).room] ?? (item as DecorItem).room.toUpperCase()}
      </span>
    )
  }
  if (item.kind === 'privilege') {
    const p = item as PrivilegeItem
    return (
      <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#6E6080' }}>
        {p.minutes === 0 ? 'ONE SHOT' : p.minutes >= 60 ? `${Math.round(p.minutes / 60)}H` : `${p.minutes}M`}
      </span>
    )
  }
  return null
}

// ─── Equip / use ─────────────────────────────────────────────────────────────

function EquipButton({
  item, owned, cos, onUse,
}: {
  item: AnyShopItem
  owned: boolean
  cos: ReturnType<typeof useTrophyCosmetics>
  onUse(): void
}) {
  if (!owned) {
    return (
      <span style={{ opacity: 0.3 }}><IconLock size={11} /></span>
    )
  }

  if (item.kind === 'accessory') {
    const on = cos.accessory === item.id
    return (
      <Toggle on={on} onLabel="WORN" offLabel="WEAR"
        onClick={() => { playSound('ui_tap'); cos.wear(on ? null : item.id) }} />
    )
  }

  if (item.kind === 'decor') {
    const d = item as DecorItem
    const on = cos.decor[d.room] === item.id
    return (
      <Toggle on={on} onLabel="UP" offLabel="HANG"
        onClick={() => { playSound('ui_tap'); cos.place(d.room, on ? null : item.id) }} />
    )
  }

  if (item.kind === 'prestige') {
    const p = item as PrestigeItem
    const on = p.slot === 'title' ? cos.myTitle === item.id : cos.myFrame === item.id
    return (
      <Toggle on={on} onLabel="ON" offLabel="EQUIP"
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
      className="px-2 py-1 active:translate-y-[1px] transition-transform"
      style={{
        border: '1.5px solid #63F094',
        borderRadius: 3,
        background: 'rgba(99,240,148,0.10)',
      }}
    >
      <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: '#63F094' }}>USE</span>
    </button>
  )
}

function Toggle({
  on, onLabel, offLabel, onClick,
}: { on: boolean; onLabel: string; offLabel: string; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 flex items-center gap-1 active:translate-y-[1px] transition-transform"
      style={{
        border: `1.5px solid ${on ? '#63F094' : 'rgba(255,255,255,0.18)'}`,
        borderRadius: 3,
        background: on ? 'rgba(99,240,148,0.12)' : 'rgba(255,255,255,0.03)',
      }}
    >
      {on && <IconCheck size={8} />}
      <span className="font-pixel" style={{
        fontSize: 6, letterSpacing: 1, color: on ? '#63F094' : '#B4A8C4',
      }}>{on ? onLabel : offLabel}</span>
    </button>
  )
}

// ─── Previews ────────────────────────────────────────────────────────────────

function Preview({ item }: { item: AnyShopItem }) {
  if (item.kind === 'decor') {
    return <DecorArt art={(item as DecorItem).art} width={50} muted />
  }
  if (item.kind === 'accessory') {
    return <AccessoryThumb art={(item as AccessoryItem).art} size={42} />
  }
  if (item.kind === 'privilege') {
    return <span style={{ filter: 'drop-shadow(0 0 6px rgba(99,240,148,0.4))' }}><IconLightning size={30} /></span>
  }
  const p = item as PrestigeItem
  if (p.slot === 'title') {
    return (
      <span className="font-pixel text-center" style={{
        fontSize: 5, letterSpacing: 0.5, color: SHOP_RARITY_COLORS[item.rarity].text,
        lineHeight: 1.5, padding: '2px 3px',
        border: `1px solid ${SHOP_RARITY_COLORS[item.rarity].border}`,
        borderRadius: 2,
      }}>{p.value}</span>
    )
  }
  return <FrameSwatch tone={p.value} />
}

/** A nameplate frame, shown around a stand-in name. */
export function FrameSwatch({ tone, label = 'NAME' }: { tone: string; label?: string }) {
  const skin = FRAME_SKINS[tone] ?? FRAME_SKINS.bronze
  return (
    <span className="relative inline-flex items-center justify-center px-1.5 py-1" style={{
      border: `2px solid ${skin.border}`,
      borderRadius: 2,
      background: skin.bg,
      boxShadow: `0 0 8px ${skin.glow}`,
      overflow: 'hidden',
    }}>
      {skin.shine && (
        <span aria-hidden className="absolute inset-0" style={{
          background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%)',
          animation: 'frameShine 3.4s ease-in-out infinite',
        }} />
      )}
      <span className="font-pixel relative" style={{ fontSize: 5, letterSpacing: 1, color: skin.text }}>
        {label}
      </span>
      <style>{`
        @keyframes frameShine {
          0%, 25%   { transform: translateX(-130%); }
          70%, 100% { transform: translateX(130%); }
        }
      `}</style>
    </span>
  )
}

export const FRAME_SKINS: Record<string, {
  border: string; bg: string; glow: string; text: string; shine?: boolean
}> = {
  bronze: {
    border: '#8A4B18', bg: 'linear-gradient(180deg, rgba(224,151,90,0.18) 0%, #0A0710 100%)',
    glow: 'rgba(224,151,90,0.25)', text: '#E0975A',
  },
  silver: {
    border: '#8B93A3', bg: 'linear-gradient(180deg, rgba(216,220,230,0.16) 0%, #0A0710 100%)',
    glow: 'rgba(216,220,230,0.25)', text: '#D8DCE6',
  },
  gold: {
    border: '#F5C842', bg: 'linear-gradient(180deg, rgba(245,200,66,0.18) 0%, #0A0710 100%)',
    glow: 'rgba(245,200,66,0.35)', text: '#FDE68A', shine: true,
  },
  champion: {
    border: '#FFD700', bg: 'linear-gradient(180deg, rgba(255,215,0,0.24) 0%, rgba(255,140,40,0.10) 60%, #0A0710 100%)',
    glow: 'rgba(255,215,0,0.55)', text: '#FFF4A3', shine: true,
  },
}
