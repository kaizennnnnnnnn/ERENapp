'use client'

// ─── ClosetView ──────────────────────────────────────────────────────────────
// Presentational closet UI. The container (closet/page.tsx) owns all data + the
// purchase/toast overlays; this component just renders and reports taps. Kept
// pure so it can be screenshotted with mock data at mobile widths.
//
// Layout, top → bottom:
//   • Header — back, title, stardust balance
//   • Room rail — 7 room portraits showing each room's CURRENT look; tap to dress
//   • Mirror — big live preview of the active room's cat + outfit name
//   • Wear-everywhere — one tap to put the active look in every room
//   • MINE / SHOP tabs — your looks (no scrolling) vs the locked catalog
//   • Grid — 3-col cards; locked cards are dark silhouettes with a stardust price
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties } from 'react'
import { ChevronLeft } from 'lucide-react'
import BlinkingEren from '@/components/BlinkingEren'
import {
  IconDress, IconSparkles, IconLock, IconPaw, IconCake, IconCart, IconCrown, IconHeart,
} from '@/components/PixelIcons'
import { resolveRoomSkin, skinRoomFit, skinPrice, type SkinDef, type RoomDef } from '@/lib/skins'
import type { GachaRarity } from '@/types'
import { playSound } from '@/lib/sounds'

// Default (revert) + Classic + each gacha skin become one of these. `key`
// doubles as the room_skins value: '' = the room's built-in default look.
export type ClosetCard = { key: string; skin: SkinDef | null; locked: boolean; isDefault?: boolean }

type ShopFilter = 'all' | 'animal' | 'food'

interface Props {
  rooms: RoomDef[]
  activeRoom: string
  onSelectRoom: (id: string) => void
  roomSkins: Record<string, string>
  previewSkin: SkinDef | null          // the active room's current look (null = default)
  selectedKey: string                  // active room's assigned key ('' = default)
  isUniform: boolean                   // is the active look already worn in every room?
  ownedCards: ClosetCard[]             // Default + Classic + owned skins (MINE tab)
  lockedCards: ClosetCard[]            // the locked catalogue (SHOP tab)
  newBadgeSkins: Set<string>
  stardust: number
  loading: boolean
  tab: 'mine' | 'shop'
  onTabChange: (tab: 'mine' | 'shop') => void
  onPick: (card: ClosetCard) => void
  onWearEverywhere: () => void
  onBack: () => void
}

const PANEL = '#1B1233'
const PANEL_BORDER = '#4C1D95'

export default function ClosetView({
  rooms, activeRoom, onSelectRoom, roomSkins, previewSkin, selectedKey, isUniform,
  ownedCards, lockedCards, newBadgeSkins, stardust, loading, tab, onTabChange, onPick, onWearEverywhere, onBack,
}: Props) {
  const [shopFilter, setShopFilter] = useState<ShopFilter>('all')

  const room = rooms.find(r => r.id === activeRoom) ?? rooms[0]
  const showWearEverywhere = !!selectedKey   // only meaningful for a real outfit
  const ownsAnySkin = ownedCards.length > 2  // beyond Default + Classic

  const animalLocked = lockedCards.filter(c => c.skin?.set === 'animal').length
  const foodLocked = lockedCards.filter(c => c.skin?.set === 'food').length
  const shopCards = shopFilter === 'all'
    ? lockedCards
    : lockedCards.filter(c => c.skin?.set === shopFilter)

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{
      background: 'radial-gradient(120% 80% at 50% 0%, #2A1B4A 0%, #160E2E 55%, #0B0717 100%)',
    }}>
      {/* CRT scanlines — the dark "game panel" convention */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
        zIndex: 1,
      }} />

      <div className="relative px-3 mx-auto" style={{
        zIndex: 2, maxWidth: 440,
        paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 'calc(var(--safe-bottom) + 20px)',
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
            <IconDress size={13} /> CLOSET
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5" aria-label={`Stardust: ${stardust}`} style={{
            background: PANEL, borderRadius: 8, border: `2px solid ${PANEL_BORDER}`, boxShadow: '0 2px 0 #2E1065',
          }}>
            <span className="sparkle-hue" aria-hidden="true"><IconSparkles size={14} /></span>
            <span className="font-pixel stardust-rainbow" style={{ fontSize: 8 }}>{stardust}</span>
          </div>
        </div>

        {/* ── Room rail ── each portrait shows that room's current outfit ── */}
        <SectionLabel icon={<IconHeart size={10} />}>PICK A ROOM</SectionLabel>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1.5 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {rooms.map(r => {
            const sk = resolveRoomSkin(roomSkins, r.id)
            return (
              <RoomChip key={r.id} room={r} thumb={sk?.thumb ?? r.defaultThumb}
                active={r.id === activeRoom}
                onClick={() => { playSound('ui_tap'); onSelectRoom(r.id) }} />
            )
          })}
        </div>

        {/* ── Mirror — live preview of the active room's look ── */}
        <div className="relative mx-auto mb-3" style={{ maxWidth: 360 }}>
          <div className="relative flex flex-col items-center" style={{
            height: 212, borderRadius: 16,
            background: 'radial-gradient(76% 64% at 50% 52%, rgba(124,58,237,0.32), rgba(11,7,23,0) 72%), linear-gradient(180deg, rgba(35,22,66,0.55), rgba(11,7,23,0.25))',
            border: '2px solid rgba(167,139,250,0.32)',
            boxShadow: 'inset 0 0 26px rgba(124,58,237,0.18)',
          }}>
            {/* gold rivets — premium card convention */}
            {([['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']] as const).map(([v, h], i) => (
              <div key={i} className="absolute" style={{
                width: 4, height: 4, background: '#F5C842', boxShadow: '0 0 3px rgba(245,200,66,0.8)',
                top: v === 't' ? 8 : undefined, bottom: v === 'b' ? 8 : undefined,
                left: h === 'l' ? 8 : undefined, right: h === 'r' ? 8 : undefined,
              }} />
            ))}

            {/* room name tag */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1" style={{
              top: 10, background: 'rgba(11,7,23,0.55)', border: '1.5px solid rgba(167,139,250,0.35)', borderRadius: 999,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F5C842', boxShadow: '0 0 4px #F5C842' }} />
              <span className="font-pixel" style={{ fontSize: 7, color: '#E9D5FF', letterSpacing: 0.5 }}>{room.label.toUpperCase()}</span>
            </div>

            {/* the cat, standing on a soft floor shadow — decorative; the ribbon below names the look */}
            <div className="flex-1 flex items-end justify-center w-full relative" aria-hidden="true" style={{ paddingBottom: 30 }}>
              <div className="absolute" style={{
                bottom: 26, width: 130, height: 16, borderRadius: '50%',
                background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.45), rgba(0,0,0,0))',
              }} />
              {previewSkin ? (
                <BlinkingEren key={previewSkin.id + activeRoom}
                  size={(skinRoomFit(previewSkin, activeRoom)?.size ?? 180) * 1.18}
                  src={previewSkin.src} tailSrc={previewSkin.tailSrc}
                  tailOrigin={previewSkin.tailOrigin} eyes={previewSkin.eyes} />
              ) : (
                <img src={room.defaultThumb} alt={`${room.label} default look`} draggable={false}
                  style={{ height: 190, objectFit: 'contain', imageRendering: 'auto' }} />
              )}
            </div>

            {/* outfit name ribbon */}
            <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1.5" style={{
              bottom: 12, maxWidth: '86%',
              background: 'linear-gradient(180deg, rgba(43,27,74,0.92), rgba(22,14,46,0.92))',
              border: '1.5px solid rgba(167,139,250,0.4)', borderRadius: 8,
              boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
            }}>
              <p className="font-pixel text-center whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 8, color: '#fff', letterSpacing: 0.3 }}>
                {previewSkin ? previewSkin.name.toUpperCase() : 'DEFAULT LOOK'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Wear in every room ── */}
        {showWearEverywhere && (
          <button onClick={() => { if (!isUniform) { playSound('ui_select'); onWearEverywhere() } }}
            disabled={isUniform}
            className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 active:translate-y-[1px] transition-transform"
            style={{
              maxWidth: 360, margin: '0 auto', display: 'flex',
              borderRadius: 10,
              background: isUniform ? 'rgba(34,197,94,0.14)' : 'linear-gradient(180deg, #8B5CF6, #6D28D9)',
              border: `2px solid ${isUniform ? 'rgba(34,197,94,0.55)' : '#A78BFA'}`,
              boxShadow: isUniform ? 'none' : '0 2px 0 #4C1D95, 0 0 14px rgba(139,92,246,0.45)',
            }}>
            {isUniform ? (
              <>
                <span style={{ fontSize: 11, color: '#4ADE80', lineHeight: 1 }}>✓</span>
                <span className="font-pixel" style={{ fontSize: 8, color: '#86EFAC', letterSpacing: 0.5 }}>WORN IN EVERY ROOM</span>
              </>
            ) : (
              <>
                <IconSparkles size={14} />
                <span className="font-pixel" style={{ fontSize: 8, color: '#fff', letterSpacing: 0.5 }}>WEAR IN EVERY ROOM</span>
              </>
            )}
          </button>
        )}

        {/* ── MINE / SHOP tabs ── */}
        <div role="tablist" aria-label="Outfit collection" className="flex p-1 mb-3 mx-auto" style={{
          maxWidth: 360, background: 'rgba(11,7,23,0.5)', borderRadius: 11, border: '1.5px solid rgba(167,139,250,0.2)',
        }}>
          <Tab active={tab === 'mine'} onClick={() => { playSound('ui_tap'); onTabChange('mine') }}
            icon={<IconHeart size={12} />} label="MY LOOKS" controls="closet-grid" />
          <Tab active={tab === 'shop'} onClick={() => { playSound('ui_tap'); onTabChange('shop') }}
            icon={<IconCart size={12} />} label="SHOP" badge={lockedCards.length} controls="closet-grid"
            ariaLabel={`Shop, ${lockedCards.length} locked outfits`} />
        </div>

        {/* ── SHOP filters ── */}
        {tab === 'shop' && lockedCards.length > 0 && (
          <div className="flex gap-1.5 mb-3 justify-center flex-wrap">
            <FilterChip active={shopFilter === 'all'} onClick={() => { playSound('ui_tap'); setShopFilter('all') }}
              label="ALL" count={lockedCards.length} />
            <FilterChip active={shopFilter === 'animal'} onClick={() => { playSound('ui_tap'); setShopFilter('animal') }}
              icon={<IconPaw size={11} />} label="ANIMALS" count={animalLocked} />
            <FilterChip active={shopFilter === 'food'} onClick={() => { playSound('ui_tap'); setShopFilter('food') }}
              icon={<IconCake size={11} />} label="FOODS" count={foodLocked} />
          </div>
        )}

        {/* ── Grid ── */}
        <div id="closet-grid" role="tabpanel" aria-label={tab === 'mine' ? 'My looks' : 'Shop'}>
        {loading ? (
          <p className="text-center font-pixel py-8" style={{ fontSize: 8, color: '#A78BFA' }}>LOADING…</p>
        ) : tab === 'mine' ? (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              {ownedCards.map(c => (
                <SkinCard key={c.key || 'default'} card={c} room={room}
                  selected={c.isDefault ? !selectedKey : selectedKey === c.key}
                  isNew={!c.isDefault && !c.skin?.builtin && !c.locked && newBadgeSkins.has(c.key)}
                  onClick={() => onPick(c)} />
              ))}
            </div>
            {!ownsAnySkin && (
              <EmptyHint>
                Win cute outfits in the <strong style={{ color: '#C4B5FD' }}>Gacha</strong>, or unlock them with
                stardust in the <strong style={{ color: '#C4B5FD' }}>Shop</strong> tab.
              </EmptyHint>
            )}
          </>
        ) : shopCards.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <IconCrown size={26} />
            <p className="font-pixel text-center" style={{ fontSize: 8, color: '#C4B5FD', lineHeight: 1.6 }}>
              YOU'VE COLLECTED<br />EVERY LOOK!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {shopCards.map(c => (
              <SkinCard key={c.key} card={c} room={room} selected={false} isNew={false} onClick={() => onPick(c)} />
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// ─── Room portrait chip ──────────────────────────────────────────────────────
function RoomChip({ room, thumb, active, onClick }: {
  room: RoomDef; thumb: string; active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} aria-pressed={active} aria-label={room.label}
      className="flex-shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-all"
      style={{ width: 58 }}>
      <div className="flex items-center justify-center" style={{
        width: 54, height: 54, borderRadius: 12,
        background: active
          ? 'radial-gradient(70% 70% at 50% 35%, rgba(167,139,250,0.45), rgba(124,58,237,0.18))'
          : 'rgba(255,255,255,0.05)',
        border: `2px solid ${active ? '#F5C842' : 'rgba(167,139,250,0.22)'}`,
        boxShadow: active ? '0 0 12px rgba(167,139,250,0.55), 0 2px 0 #2E1065' : 'none',
        transform: active ? 'translateY(-2px)' : 'none',
      }}>
        <img src={thumb} alt="" draggable={false}
          style={{ width: '78%', height: '78%', objectFit: 'contain', imageRendering: 'auto' }} />
      </div>
      <span className="font-pixel text-center leading-tight" style={{
        fontSize: 6, color: active ? '#fff' : '#9D8BC4', maxWidth: 58,
      }}>{room.label.toUpperCase()}</span>
    </button>
  )
}

// ─── MINE / SHOP tab ─────────────────────────────────────────────────────────
function Tab({ active, onClick, icon, label, badge, controls, ariaLabel }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
  badge?: number; controls?: string; ariaLabel?: string
}) {
  return (
    <button onClick={onClick} role="tab" aria-selected={active} aria-controls={controls} aria-label={ariaLabel}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 active:scale-[0.98] transition-all relative"
      style={{
        borderRadius: 8,
        background: active ? 'linear-gradient(135deg, #7C3AED, #A78BFA)' : 'transparent',
        boxShadow: active ? '0 0 12px rgba(167,139,250,0.4)' : 'none',
      }}>
      <span aria-hidden="true" className="inline-flex">{icon}</span>
      <span className="font-pixel" style={{ fontSize: 8, color: active ? '#fff' : '#9D8BC4', letterSpacing: 0.5 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span aria-hidden="true" className="font-pixel flex items-center justify-center" style={{
          fontSize: 6, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 999,
          background: active ? 'rgba(11,7,23,0.4)' : 'rgba(167,139,250,0.18)',
          color: active ? '#E9D5FF' : '#9D8BC4',
        }}>{badge}</span>
      )}
    </button>
  )
}

// ─── Shop set-filter chip ────────────────────────────────────────────────────
function FilterChip({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; count: number
}) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="flex items-center gap-1 px-2.5 py-1.5 active:scale-95 transition-all"
      style={{
        borderRadius: 999,
        background: active ? 'linear-gradient(135deg, #7C3AED, #A78BFA)' : 'rgba(255,255,255,0.05)',
        border: `1.5px solid ${active ? '#C4B5FD' : 'rgba(167,139,250,0.22)'}`,
      }}>
      {icon}
      <span className="font-pixel" style={{ fontSize: 7, color: active ? '#fff' : '#9D8BC4', letterSpacing: 0.3 }}>{label}</span>
      <span className="font-pixel" style={{ fontSize: 6, color: active ? 'rgba(255,255,255,0.7)' : '#6B5B8C' }}>{count}</span>
    </button>
  )
}

// ─── Rarity frame ────────────────────────────────────────────────────────────
// Prestige escalates: common (plain) → rare (calm blue hint) → epic (purple
// gradient frame + glow + corner gems) → legendary (gold gradient frame + 4
// rivets + a slow shimmer). Locked cards keep their dark silhouette fill and
// only take a DIMMED rarity border, so a locked legendary still teases gold
// without competing with the looks you actually own.
type CardFrame = { style: CSSProperties; rivets: boolean; gems: boolean; shine: boolean }

function frameFor(rarity: GachaRarity, locked: boolean): CardFrame {
  if (locked) {
    const dim: Record<GachaRarity, string> = {
      legendary: '#7A5E1A', epic: '#4E3E78', rare: 'rgba(96,165,250,0.30)', common: 'rgba(124,58,237,0.22)',
    }
    return { style: { background: 'rgba(11,7,23,0.55)', border: `2px solid ${dim[rarity]}` }, rivets: false, gems: false, shine: false }
  }
  switch (rarity) {
    case 'legendary':
      return {
        style: {
          border: '2px solid transparent',
          background:
            'radial-gradient(116% 86% at 50% 26%, rgba(245,200,66,0.24), rgba(20,12,40,0.5) 76%) padding-box, ' +
            'linear-gradient(155deg, #FFF1C2 0%, #F5C842 42%, #B45309 100%) border-box',
          boxShadow: '0 0 15px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,245,200,0.35)',
        },
        rivets: true, gems: false, shine: true,
      }
    case 'epic':
      return {
        style: {
          border: '2px solid transparent',
          background:
            'radial-gradient(116% 86% at 50% 26%, rgba(167,139,250,0.18), rgba(20,12,40,0.42) 78%) padding-box, ' +
            'linear-gradient(155deg, #E4DBFF 0%, #A78BFA 55%, #7C3AED 100%) border-box',
          boxShadow: '0 0 10px rgba(167,139,250,0.34)',
        },
        rivets: false, gems: true, shine: false,
      }
    case 'rare':
      return { style: { border: '2px solid rgba(96,165,250,0.5)', background: 'rgba(96,165,250,0.07)' }, rivets: false, gems: false, shine: false }
    default:
      return { style: { border: '2px solid rgba(167,139,250,0.18)', background: 'rgba(255,255,255,0.05)' }, rivets: false, gems: false, shine: false }
  }
}

// ─── Skin / look card ────────────────────────────────────────────────────────
function SkinCard({ card, room, selected, isNew, onClick }: {
  card: ClosetCard; room: RoomDef; selected: boolean; isNew: boolean; onClick: () => void
}) {
  const rarity: GachaRarity = card.skin ? card.skin.rarity : 'common'
  const frame = frameFor(rarity, card.locked)
  const thumb = card.isDefault ? room.defaultThumb : card.skin!.thumb
  const name = card.isDefault ? 'DEFAULT' : card.skin!.name.toUpperCase()
  const ariaLabel = card.isDefault
    ? `Default look${selected ? ', equipped' : ''}`
    : card.locked
      ? `${card.skin!.name}, locked — ${skinPrice(card.skin!.rarity)} stardust to unlock`
      : `${card.skin!.name}${selected ? ', equipped' : ''}${isNew ? ', new' : ''}`
  // Equipped marker is rarity-neutral (green ring + check) so it reads clearly
  // even on a gold legendary card.
  const boxShadow = selected
    ? ['0 0 0 2px #0B0717', '0 0 0 3.5px #34D399', frame.style.boxShadow].filter(Boolean).join(', ')
    : frame.style.boxShadow

  return (
    <button onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={card.locked ? undefined : selected}
      aria-haspopup={card.locked ? 'dialog' : undefined}
      className="relative flex flex-col items-center gap-1 p-1.5 active:scale-95 transition-all"
      style={{ ...frame.style, borderRadius: 10, boxShadow }}>

      {/* legendary shimmer — clipped to the card so it can't spill onto the badges */}
      {frame.shine && (
        <span className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ borderRadius: 10 }}>
          <span className="absolute" style={{
            top: 0, bottom: 0, left: 0, width: '42%',
            background: 'linear-gradient(100deg, transparent 0%, rgba(255,248,214,0.55) 50%, transparent 100%)',
            animation: 'closetLegendShine 3.6s ease-in-out infinite',
          }} />
        </span>
      )}

      {/* legendary rivets (4) / epic gems (2 bottom) — quiet metal detail */}
      {frame.rivets && ([['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']] as const).map(([v, h], i) => (
        <span key={`rv${i}`} className="absolute pointer-events-none" style={{
          width: 3, height: 3, background: '#FFE9A8', boxShadow: '0 0 3px rgba(245,200,66,0.9)',
          top: v === 't' ? 4 : undefined, bottom: v === 'b' ? 4 : undefined,
          left: h === 'l' ? 4 : undefined, right: h === 'r' ? 4 : undefined,
        }} />
      ))}
      {frame.gems && ([['b', 'l'], ['b', 'r']] as const).map(([, h], i) => (
        <span key={`gm${i}`} className="absolute pointer-events-none" style={{
          width: 3, height: 3, background: '#C4B5FD', boxShadow: '0 0 3px rgba(167,139,250,0.85)',
          bottom: 4, left: h === 'l' ? 4 : undefined, right: h === 'r' ? 4 : undefined,
        }} />
      ))}

      <div className="flex items-center justify-center" style={{ width: '100%', aspectRatio: '1' }}>
        <img src={thumb} alt="" draggable={false}
          style={{
            width: '90%', height: '90%', objectFit: 'contain', imageRendering: 'auto',
            filter: card.locked ? 'grayscale(1) brightness(0.22) contrast(0.85)' : 'none',
          }} />
      </div>
      <span className="font-pixel text-center leading-tight" style={{
        fontSize: 5.5, color: card.locked ? '#5B4E7A' : '#E9D5FF', minHeight: 12,
      }}>{card.locked ? '???' : name}</span>

      {/* locked → lock badge + stardust price */}
      {card.locked && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: 14 }}>
            <IconLock size={18} />
          </div>
          {card.skin && (
            <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1 py-0.5" style={{
              background: PANEL, border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 6, boxShadow: '0 1px 0 #2E1065',
            }}>
              <span className="sparkle-hue"><IconSparkles size={8} /></span>
              <span className="font-pixel stardust-rainbow" style={{ fontSize: 5.5 }}>{skinPrice(card.skin.rarity)}</span>
            </div>
          )}
        </>
      )}

      {/* selected check */}
      {selected && (
        <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center" style={{
          width: 17, height: 17, background: '#22C55E', borderRadius: '50%', border: '2px solid #0B0717',
        }}>
          <span style={{ fontSize: 9, color: '#fff', lineHeight: 1 }}>✓</span>
        </div>
      )}

      {/* unseen-won badge */}
      {isNew && !selected && (
        <div className="absolute -top-1.5 -left-1.5 flex items-center justify-center px-1 py-0.5" style={{
          background: '#FF1D5E', border: '1.5px solid #8B0026', borderRadius: 4, boxShadow: '0 1px 0 #5C021F',
        }}>
          <span className="font-pixel" style={{ fontSize: 5, color: '#fff', letterSpacing: 0.5 }}>NEW</span>
        </div>
      )}
    </button>
  )
}

// ─── Small shared bits ───────────────────────────────────────────────────────
function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 px-0.5">
      {icon}
      <span className="font-pixel" style={{ fontSize: 7, color: '#9D8BC4', letterSpacing: 1 }}>{children}</span>
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center mx-auto mt-5" style={{
      maxWidth: 280, fontSize: 11, lineHeight: 1.7, color: '#8B7BA8',
    }}>{children}</p>
  )
}
