'use client'

// ─── ClosetView ──────────────────────────────────────────────────────────────
// Presentational closet UI. The container (closet/page.tsx) owns all data + the
// purchase/toast overlays; this component just renders and reports taps. Kept
// pure so it can be screenshotted with mock data at mobile widths.
//
// Layout, top → bottom:
//   • Title row — back, "Closet", stardust balance
//   • Mirror — the active room's cat on the meadow stage, the look's name and
//     rarity, and one tap to wear it in every room
//   • Room rail — each room's portrait in its CURRENT look; tap to dress it
//   • My looks / Shop — your looks and the locked catalogue
//   • Grid — 3-col cards; locked cards are silhouettes with their price
//
// In the Meadow look: the warm "me" ground, white cards, rarity as the soft
// tint behind the art and a tag (never a glow), the leaf ring and check for
// what the room is wearing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties, type ReactNode } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import {
  Card, CheckDisc, Chip, MeadowIcon, MeadowPage, Segmented, SecondaryButton, SectionLabel, Tag,
  M, RARITY_TAG, TYPE,
} from '@/components/meadow'
import { STARDUST_INK } from '@/components/rewards/rewardDisplay'
import { ROOM_FIT, skinRoomFit, resolveRoomSkin, skinPrice, type SkinDef, type RoomDef } from '@/lib/skins'
import type { GachaRarity } from '@/types'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { swapCatName } from '@/lib/catWords'

// Default (revert) + Classic + each gacha skin become one of these. `key`
// doubles as the room_skins value: '' = the room's built-in default look.
export type ClosetCard = { key: string; skin: SkinDef | null; locked: boolean; isDefault?: boolean }

type ShopFilter = 'all' | 'animal' | 'food'

export type ClosetTab = 'mine' | 'shop'

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
  ownedLoaded: boolean                 // owned set fetched OK at least once (vs a failed/empty fetch)
  tab: ClosetTab
  onTabChange: (tab: ClosetTab) => void
  onPick: (card: ClosetCard) => void
  onWearEverywhere: () => void
  onBack: () => void
}

const RARITY_NAME: Record<GachaRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

/** A locked look: its shape only, a soft shadow on its tier's tint. */
const SILHOUETTE = 'grayscale(1) brightness(0) opacity(0.2)'

export default function ClosetView({
  rooms, activeRoom, onSelectRoom, roomSkins, previewSkin, selectedKey, isUniform,
  ownedCards, lockedCards, newBadgeSkins, stardust, loading, ownedLoaded, tab, onTabChange, onPick, onWearEverywhere, onBack,
}: Props) {
  const [shopFilter, setShopFilter] = useState<ShopFilter>('all')
  const cat = useCat()

  const room = rooms.find(r => r.id === activeRoom) ?? rooms[0]
  const showWearEverywhere = !!selectedKey   // only meaningful for a real outfit
  const ownsAnySkin = ownedCards.length > 2  // beyond Default + Classic

  const animalLocked = lockedCards.filter(c => c.skin?.set === 'animal').length
  const foodLocked = lockedCards.filter(c => c.skin?.set === 'food').length
  const shopCards = shopFilter === 'all'
    ? lockedCards
    : lockedCards.filter(c => c.skin?.set === shopFilter)

  const lookName = previewSkin ? swapCatName(previewSkin.name, cat) : 'Default look'
  const filter = (f: ShopFilter) => () => { playSound('ui_tap'); setShopFilter(f) }

  return (
    <MeadowPage ground="me" title="Closet" withNav={false}
      back={{ onClick: () => { playSound('ui_back'); onBack() }, label: 'Back' }}
      action={<StardustChip amount={stardust} />}>

      {/* ── Mirror — the active room's look ── */}
      <Card padding={12} style={{ marginTop: 18 }}>
        <Mirror skin={previewSkin} room={room} />
        <div style={{ padding: '14px 6px 2px' }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 20, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lookName}
            </span>
            {previewSkin && <Tag tone={previewSkin.rarity} caps size="sm">{RARITY_NAME[previewSkin.rarity]}</Tag>}
          </div>
          <div style={{ marginTop: 2, fontSize: 14, fontWeight: 600, color: M.text2 }}>In the {room.label}</div>

          {showWearEverywhere && (isUniform ? (
            <div className="flex items-center justify-center" style={{ marginTop: 14, height: 46, gap: 8, borderRadius: 14, background: M.leafTint }}>
              <CheckDisc size={22} />
              <span style={{ fontSize: 15, fontWeight: 800, color: M.leafInk }}>Worn in every room</span>
            </div>
          ) : (
            <SecondaryButton size="md" full style={{ marginTop: 14 }}
              icon={<MeadowIcon name="home" size={18} />}
              onClick={() => { playSound('ui_select'); onWearEverywhere() }}>
              Wear in every room
            </SecondaryButton>
          ))}
        </div>
      </Card>

      {/* ── Room rail ── each portrait shows that room's current outfit ── */}
      <SectionLabel>Pick a room</SectionLabel>
      <div className="flex overflow-x-auto" style={{ gap: 10, margin: '0 -16px', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {rooms.map(r => {
          const sk = resolveRoomSkin(roomSkins, r.id)
          return (
            <RoomTile key={r.id} room={r} thumb={sk?.thumb ?? r.defaultThumb}
              active={r.id === activeRoom}
              onClick={() => { playSound('ui_tap'); onSelectRoom(r.id) }} />
          )
        })}
      </div>

      {/* ── My looks / Shop ── */}
      <Segmented<ClosetTab>
        ariaLabel="Outfit collection"
        value={tab}
        onChange={t => { playSound('ui_tap'); onTabChange(t) }}
        style={{ marginTop: 24, background: '#FFFFFF' }}
        options={[
          { value: 'mine', label: <>My looks<Count n={ownedCards.length} /></> },
          { value: 'shop', label: <>Shop<Count n={lockedCards.length} /></> },
        ]}
      />

      {/* ── Shop filters ── */}
      {tab === 'shop' && ownedLoaded && !loading && lockedCards.length > 0 && (
        <div className="flex overflow-x-auto" style={{ gap: 8, margin: '12px -16px 0', padding: '0 16px', scrollbarWidth: 'none' }}>
          <Chip selected={shopFilter === 'all'} onClick={filter('all')}>All</Chip>
          <Chip selected={shopFilter === 'animal'} onClick={filter('animal')}
            icon={<MeadowIcon name="paw" size={16} />}>Animals<Count n={animalLocked} /></Chip>
          <Chip selected={shopFilter === 'food'} onClick={filter('food')}
            icon={<MeadowIcon name="bowl" size={16} />}>Foods<Count n={foodLocked} /></Chip>
        </div>
      )}

      {/* ── Grid ── */}
      <div id="closet-grid" aria-label={tab === 'mine' ? 'My looks' : 'Shop'} style={{ marginTop: 14 }}>
        {loading || (tab === 'shop' && !ownedLoaded) ? (
          // Gate the Shop on a CONFIRMED owned set. A failed/incomplete fetch
          // leaves owned empty, which would otherwise render the whole catalogue
          // as buyable — including skins the household already owns.
          <p role="status" style={{ margin: '32px 0', textAlign: 'center', fontSize: 14, fontWeight: 600, color: M.text2 }}>
            Loading your closet...
          </p>
        ) : tab === 'mine' ? (
          <>
            <Grid>
              {ownedCards.map(c => (
                <SkinCard key={c.key || 'default'} card={c} room={room}
                  selected={c.isDefault ? !selectedKey : selectedKey === c.key}
                  isNew={!c.isDefault && !c.skin?.builtin && !c.locked && newBadgeSkins.has(c.key)}
                  onClick={() => onPick(c)} />
              ))}
            </Grid>
            {!ownsAnySkin && (
              <p style={{ margin: '20px auto 0', maxWidth: 290, textAlign: 'center', fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
                Win cute outfits in the <strong style={{ color: M.text }}>Gacha</strong>, or unlock them with
                stardust in the <strong style={{ color: M.text }}>Shop</strong>.
              </p>
            )}
          </>
        ) : shopCards.length === 0 ? (
          <Card style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <MeadowIcon name="crown" size={28} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>You&apos;ve collected every look.</span>
          </Card>
        ) : (
          <Grid>
            {shopCards.map(c => (
              <SkinCard key={c.key} card={c} room={room} selected={false} isNew={false} onClick={() => onPick(c)} />
            ))}
          </Grid>
        )}
      </div>
    </MeadowPage>
  )
}

// ─── Mirror ──────────────────────────────────────────────────────────────────
// The cat on the meadow stage, sized and lifted the way the room draws him
// (lib/skins ROOM_FIT), so his feet land on the shadow in any look.

const MIRROR_H = 236
/** From the stage's bottom edge up to where the feet stand. */
const FEET = 30
/** A size up on the room's own, so the look is the thing you see. */
const ZOOM = 1.15

function Mirror({ skin, room }: { skin: SkinDef | null; room: RoomDef }) {
  const fit = ROOM_FIT[room.id] ?? ROOM_FIT.home
  // How much of the art's own canvas runs below the feet.
  const below = skin ? skin.botGap ?? 0 : fit.botGap
  // Zoomed, but never so big the top of the art (the Kitchen's toque) is cut
  // off by the stage.
  const size = Math.round(Math.min(
    (skin ? skinRoomFit(skin, room.id)?.size ?? fit.size : fit.size) * ZOOM,
    (MIRROR_H - FEET - 6) / (1 - below),
  ))
  const gap = size * below
  const box: CSSProperties = {
    position: 'absolute', left: '50%', bottom: FEET - gap, width: size, height: size, transform: 'translateX(-50%)',
  }
  return (
    <div aria-hidden style={{ position: 'relative', height: MIRROR_H, borderRadius: 18, background: M.soft, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 'calc(50% - 280px)', top: MIRROR_H - 72, width: 560, height: 220, borderRadius: '50%', background: M.hill }} />
      <div style={{ position: 'absolute', left: 'calc(50% - 70px)', top: MIRROR_H - FEET - 8, width: 140, height: 16, borderRadius: '50%', background: M.hillShadow }} />
      <span style={{ position: 'absolute', left: 16, top: MIRROR_H - 58 }}><MeadowIcon name="daisy" size={30} /></span>
      <span style={{ position: 'absolute', left: 46, top: MIRROR_H - 44 }}><MeadowIcon name="tuft" size={30} /></span>
      <span style={{ position: 'absolute', right: 48, top: MIRROR_H - 44 }}><MeadowIcon name="tuft" size={30} /></span>
      <span style={{ position: 'absolute', right: 16, top: MIRROR_H - 62 }}><MeadowIcon name="daisy" size={30} /></span>
      {skin ? (
        <div style={box}>
          <BlinkingEren key={skin.id + room.id} size={size}
            src={skin.src} tailSrc={skin.tailSrc} tailOrigin={skin.tailOrigin}
            eyes={skin.eyes} lidTone={skin.lidTone} coat={skin.coat} />
        </div>
      ) : (
        <img src={room.defaultThumb} alt="" draggable={false}
          style={{ ...box, objectFit: 'contain', objectPosition: 'bottom', imageRendering: 'auto' }} />
      )}
    </div>
  )
}

// ─── Room tile ───────────────────────────────────────────────────────────────
function RoomTile({ room, thumb, active, onClick }: {
  room: RoomDef; thumb: string; active: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={room.label}
      className="m-press m-focus flex-shrink-0 flex flex-col items-center"
      style={{ width: 70, gap: 6, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
      <span className="flex items-center justify-center" style={{
        width: 64, height: 64, boxSizing: 'border-box', borderRadius: 18,
        background: active ? M.leafTint : '#FFFFFF',
        border: `2px solid ${active ? M.leaf : '#FFFFFF'}`,
      }}>
        <img src={thumb} alt="" draggable={false}
          style={{ width: '82%', height: '82%', objectFit: 'contain', imageRendering: 'auto' }} />
      </span>
      <span style={{
        fontSize: 12, fontWeight: active ? 800 : 700, color: active ? M.leafInk : M.text2,
        maxWidth: 70, textAlign: 'center', lineHeight: 1.2,
      }}>{room.label}</span>
    </button>
  )
}

// ─── Look card ───────────────────────────────────────────────────────────────
function SkinCard({ card, room, selected, isNew, onClick }: {
  card: ClosetCard; room: RoomDef; selected: boolean; isNew: boolean; onClick: () => void
}) {
  const rarity: GachaRarity = card.skin ? card.skin.rarity : 'common'
  const thumb = card.isDefault ? room.defaultThumb : card.skin!.thumb
  const cat = useCat()
  const skinName = swapCatName(card.skin?.name ?? '', cat)
  // An EARNED look (poured can, completed jelly shelf) can't be bought at any
  // price — the card says so, never a stardust number that would be a lie.
  const earned = card.locked && !!card.skin?.unlock
  const ariaLabel = card.isDefault
    ? `Default look${selected ? ', equipped' : ''}`
    : card.locked
      ? earned
        ? 'Locked look — earned by playing, not bought'
        : `${skinName}, locked — ${skinPrice(card.skin!.rarity)} stardust to unlock`
      : `${skinName}${selected ? ', equipped' : ''}${isNew ? ', new' : ''}`

  return (
    <button type="button" onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={card.locked ? undefined : selected}
      aria-haspopup={card.locked ? 'dialog' : undefined}
      className="m-press m-focus relative flex flex-col"
      style={{
        boxSizing: 'border-box', padding: 6, gap: 6, borderRadius: 20, background: '#FFFFFF',
        border: `2px solid ${selected ? M.leaf : '#FFFFFF'}`, cursor: 'pointer', textAlign: 'center',
      }}>
      <span className="relative flex items-center justify-center" style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: 14, background: card.isDefault ? M.soft : RARITY_TAG[rarity].bg,
      }}>
        {/* Absolute: a percentage height doesn't resolve against an
            aspect-ratio box, and a tall sprite would spill out of it. */}
        <img src={thumb} alt="" draggable={false} style={{
          position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain', imageRendering: 'auto',
          filter: card.locked ? SILHOUETTE : undefined,
        }} />
        {card.locked && (
          <span className="absolute flex items-center justify-center" style={{
            width: 30, height: 30, borderRadius: 999, background: '#FFFFFF',
          }}>
            <MeadowIcon name="lock" size={16} color={M.text2} />
          </span>
        )}
      </span>

      <span className="flex items-center justify-center" style={{ minHeight: 34, padding: '0 2px 2px', gap: 4 }}>
        {card.locked ? (
          earned ? (
            <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Earn it</span>
          ) : (
            <Price n={skinPrice(card.skin!.rarity)} />
          )
        ) : (
          <span style={{ fontSize: 13, lineHeight: 1.2, fontWeight: 700, color: M.text, overflowWrap: 'anywhere' }}>
            {card.isDefault ? 'Default' : skinName}
          </span>
        )}
      </span>

      {selected && <CheckDisc corner />}
      {isNew && !selected && (
        <Tag tone="love" size="sm" style={{ position: 'absolute', top: -8, left: -6 }}>New</Tag>
      )}
    </button>
  )
}

// ─── Small shared bits ───────────────────────────────────────────────────────
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3" style={{ gap: 10 }}>{children}</div>
}

function Count({ n }: { n: number }) {
  return <span style={{ marginLeft: 6, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
}

function Price({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 4, fontSize: 14, color: M.text, ...TYPE.number }}>
      <MeadowIcon name="sparkle" size={14} color={STARDUST_INK} />{n}
    </span>
  )
}

function StardustChip({ amount }: { amount: number }) {
  return (
    <span role="img" aria-label={`Stardust: ${amount}`} className="inline-flex items-center" style={{
      height: 40, boxSizing: 'border-box', padding: '0 14px 0 10px', gap: 6, borderRadius: 999,
      background: '#FFFFFF', boxShadow: `0 3px 0 ${M.groundLip}`, fontSize: 16, ...TYPE.number,
    }}>
      <MeadowIcon name="sparkle" size={20} color={STARDUST_INK} />
      {amount.toLocaleString('en-US')}
    </span>
  )
}

