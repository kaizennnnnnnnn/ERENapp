'use client'

// ─── ClosetView ──────────────────────────────────────────────────────────────
// Presentational closet UI. The container (closet/page.tsx) owns all data + the
// purchase/toast overlays; this component just renders and reports taps. Kept
// pure so it can be screenshotted with mock data at mobile widths.
//
// Layout, top → bottom:
//   • Title row — back, "Closet", stardust balance
//   • Room rail — each room's portrait in its CURRENT look; tap to dress it
//   • My looks / Shop — your looks and the locked catalogue
//   • Carousel — one look at a time, swiped sideways: the cat wearing it on
//     the meadow stage, its name and rarity, and the one thing to do with it
//     (wear it, wear it everywhere, unlock it, or how to earn it)
//   • Strip — every look small, to jump straight to one
//
// In the Meadow look: the warm "me" ground, white cards, rarity as the soft
// tint behind the cat and a tag (never a glow), leaf for what the room is
// wearing.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import {
  Card, CheckDisc, Chip, MeadowIcon, MeadowPage, PrimaryButton, Segmented, SecondaryButton, SectionLabel, Tag, TextButton,
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
type RarityFilter = 'all' | GachaRarity

export type ClosetTab = 'mine' | 'shop'

interface Props {
  rooms: RoomDef[]
  activeRoom: string
  onSelectRoom: (id: string) => void
  roomSkins: Record<string, string>
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
const RARITIES: GachaRarity[] = ['common', 'rare', 'epic', 'legendary']

/** The Default look has no skin; it files under common, like Classic. */
const rarityOf = (c: ClosetCard): GachaRarity => c.skin?.rarity ?? 'common'

/** A locked look: its shape only, a soft shadow on its tier's tint. */
const SILHOUETTE = 'grayscale(1) brightness(0) opacity(0.2)'

/** The carousel's cards and the space between them. */
const CARD_W = 272
const CARD_GAP = 12

export default function ClosetView({
  rooms, activeRoom, onSelectRoom, roomSkins, selectedKey, isUniform,
  ownedCards, lockedCards, newBadgeSkins, stardust, loading, ownedLoaded, tab, onTabChange, onPick, onWearEverywhere, onBack,
}: Props) {
  const [shopFilter, setShopFilter] = useState<ShopFilter>('all')
  const [rarity, setRarity] = useState<RarityFilter>('all')
  const [index, setIndex] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const room = rooms.find(r => r.id === activeRoom) ?? rooms[0]
  const ownsAnySkin = ownedCards.length > 2  // beyond Default + Classic

  // The tab's looks, narrowed by rarity (both tabs) and by set (the Shop).
  // Each chip counts what it would show alongside the other filter, so a
  // count never promises cards that tapping it won't bring.
  const base = tab === 'mine' ? ownedCards : lockedCards
  const inSet = (c: ClosetCard, f: ShopFilter) => tab === 'mine' || f === 'all' || c.skin?.set === f
  const inRarity = (c: ClosetCard, r: RarityFilter) => r === 'all' || rarityOf(c) === r
  const rarityCount = (r: GachaRarity) => base.filter(c => inSet(c, shopFilter) && inRarity(c, r)).length
  const setCount = (f: ShopFilter) => base.filter(c => inSet(c, f) && inRarity(c, rarity)).length
  const filtered = rarity !== 'all' || (tab === 'shop' && shopFilter !== 'all')

  // A Shop gated on a CONFIRMED owned set: a failed/incomplete fetch leaves
  // owned empty, which would otherwise show the whole catalogue as buyable,
  // including skins the household already owns.
  const ready = !loading && (tab === 'mine' || ownedLoaded)
  const cards = base.filter(c => inSet(c, shopFilter) && inRarity(c, rarity))
  const isWorn = (c: ClosetCard) => !c.locked && (c.isDefault ? !selectedKey : selectedKey === c.key)
  const at = Math.min(index, Math.max(0, cards.length - 1))

  // Where the carousel opens: on what the room is wearing (My looks), or at the
  // start (Shop). Re-centred when the room, the tab or the filter changes, or
  // the room puts on something else; never just because the list re-rendered.
  const centreOn = tab === 'mine' ? Math.max(0, cards.findIndex(isWorn)) : 0
  const centreKey = tab === 'mine'
    ? `mine:${room.id}:${selectedKey}:${rarity}:${ready}`
    : `shop:${shopFilter}:${rarity}:${ready}`
  useLayoutEffect(() => {
    const rail = railRef.current
    if (rail) rail.scrollLeft = centreOn * (CARD_W + CARD_GAP)
    setIndex(centreOn)
  }, [centreKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Which card is in the middle, as the rail is swiped.
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  function onRailScroll() {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const rail = railRef.current
      if (!rail) return
      const i = Math.round(rail.scrollLeft / (CARD_W + CARD_GAP))
      setIndex(Math.max(0, Math.min(cards.length - 1, i)))
    })
  }

  // Keep the strip's chosen thumb in view, without moving the page itself.
  useEffect(() => {
    const strip = stripRef.current
    const thumb = strip?.children[at] as HTMLElement | undefined
    if (!strip || !thumb) return
    strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' })
  }, [at])

  function jump(i: number) {
    playSound('ui_tap')
    railRef.current?.scrollTo({ left: i * (CARD_W + CARD_GAP), behavior: 'smooth' })
  }

  // Tapping the chosen chip again lets it go; All lets both go.
  const pickSet = (f: ShopFilter) => () => { playSound('ui_tap'); setShopFilter(cur => cur === f ? 'all' : f) }
  const pickRarity = (r: GachaRarity) => () => { playSound('ui_tap'); setRarity(cur => cur === r ? 'all' : r) }
  const showAll = () => { playSound('ui_tap'); setRarity('all'); setShopFilter('all') }

  return (
    <MeadowPage ground="me" title="Closet" withNav={false}
      back={{ onClick: () => { playSound('ui_back'); onBack() }, label: 'Back' }}
      action={<StardustChip amount={stardust} />}>

      {/* ── Room rail ── each portrait shows that room's current outfit ── */}
      <SectionLabel style={{ marginTop: 16 }}>Pick a room</SectionLabel>
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
        style={{ marginTop: 16, background: '#FFFFFF' }}
        options={[
          { value: 'mine', label: <>My looks<Count n={ownedCards.length} /></> },
          { value: 'shop', label: <>Shop<Count n={lockedCards.length} /></> },
        ]}
      />

      {/* ── Filters: rarity on both tabs, then the Shop's animals / foods ── */}
      {ready && base.length > 0 && (
        <div role="group" aria-label="Filter looks" className="flex items-center overflow-x-auto"
          style={{ gap: 8, margin: '12px -16px 0', padding: '0 16px', scrollbarWidth: 'none' }}>
          <Chip selected={!filtered} onClick={showAll}>All</Chip>
          {RARITIES.map(r => {
            const n = rarityCount(r)
            return (
              <Chip key={r} selected={rarity === r} onClick={pickRarity(r)} disabled={n === 0 && rarity !== r}
                icon={<RarityDot rarity={r} />}>
                {RARITY_NAME[r]}<Count n={n} />
              </Chip>
            )
          })}
          {tab === 'shop' && (
            <>
              <span aria-hidden style={{ flexShrink: 0, width: 2, height: 20, borderRadius: 1, background: M.softLip }} />
              <Chip selected={shopFilter === 'animal'} onClick={pickSet('animal')}
                icon={<MeadowIcon name="paw" size={16} />}>Animals<Count n={setCount('animal')} /></Chip>
              <Chip selected={shopFilter === 'food'} onClick={pickSet('food')}
                icon={<MeadowIcon name="bowl" size={16} />}>Foods<Count n={setCount('food')} /></Chip>
            </>
          )}
        </div>
      )}

      {/* ── The looks ── */}
      {!ready ? (
        <p role="status" style={{ margin: '48px 0', textAlign: 'center', fontSize: 14, fontWeight: 600, color: M.text2 }}>
          Loading your closet...
        </p>
      ) : base.length === 0 ? (
        <Card style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <MeadowIcon name="crown" size={28} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>You&apos;ve collected every look.</span>
        </Card>
      ) : cards.length === 0 ? (
        <Card style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {tab === 'mine' ? 'None of your looks match.' : 'Nothing in the shop matches.'}
          </span>
          <TextButton size={15} onClick={showAll}>Show all</TextButton>
        </Card>
      ) : (
        <>
          <div ref={railRef} onScroll={onRailScroll} role="group" aria-roledescription="carousel"
            aria-label={tab === 'mine' ? 'My looks' : 'Shop'}
            className="flex overflow-x-auto"
            style={{
              gap: CARD_GAP, margin: '14px -16px 0', padding: `4px calc(50% - ${CARD_W / 2}px) 8px`,
              scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
            }}>
            {cards.map((c, i) => (
              <LookCard key={c.key || 'default'} card={c} room={room} live={i === at}
                position={`${i + 1} of ${cards.length}`}
                worn={isWorn(c)} uniform={isUniform}
                isNew={!c.isDefault && !c.skin?.builtin && !c.locked && newBadgeSkins.has(c.key)}
                onPick={() => onPick(c)}
                onWearEverywhere={() => { playSound('ui_select'); onWearEverywhere() }} />
            ))}
          </div>

          {/* ── Every look small, to jump to one ── */}
          <div className="flex items-center justify-between" style={{ margin: '10px 8px 8px' }}>
            <span style={{ ...TYPE.label, color: M.label }}>{tab === 'mine' ? (filtered ? 'Matching looks' : 'All your looks') : (filtered ? 'Matching in the shop' : 'All in the shop')}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: M.label, fontVariantNumeric: 'tabular-nums' }}>
              {at + 1} of {cards.length}
            </span>
          </div>
          <div ref={stripRef} className="flex overflow-x-auto"
            style={{ gap: 8, margin: '0 -16px', padding: '4px 16px 6px', scrollbarWidth: 'none' }}>
            {cards.map((c, i) => (
              <Thumb key={c.key || 'default'} card={c} room={room} active={i === at} worn={isWorn(c)}
                onClick={() => jump(i)} />
            ))}
          </div>

          {tab === 'mine' && !ownsAnySkin && (
            <p style={{ margin: '16px auto 0', maxWidth: 290, textAlign: 'center', fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
              Win cute outfits in the <strong style={{ color: M.text }}>Gacha</strong>, or unlock them with
              stardust in the <strong style={{ color: M.text }}>Shop</strong>.
            </p>
          )}
        </>
      )}
    </MeadowPage>
  )
}

// ─── Look card ───────────────────────────────────────────────────────────────
// One look in the carousel: the cat wearing it, what it's called, and the one
// thing to do with it.

function LookCard({ card, room, live, position, worn, uniform, isNew, onPick, onWearEverywhere }: {
  card: ClosetCard
  room: RoomDef
  /** The card in the middle: its cat blinks and breathes; the rest hold still. */
  live: boolean
  position: string
  worn: boolean
  /** The room's look is worn in every room. */
  uniform: boolean
  isNew: boolean
  onPick: () => void
  onWearEverywhere: () => void
}) {
  const cat = useCat()
  const skin = card.isDefault ? null : card.skin
  // An EARNED look (poured can, completed jelly shelf) can't be bought at any
  // price: the card says how to earn it, never a stardust number that would
  // be a lie.
  const earned = card.locked && !!card.skin?.unlock
  const name = card.locked ? 'Mystery look' : card.isDefault ? 'Default look' : swapCatName(card.skin!.name, cat)
  const price = card.locked && !earned ? skinPrice(card.skin!.rarity) : 0

  let note: ReactNode
  if (worn) {
    note = (
      <span className="inline-flex items-center" style={{ gap: 6, color: M.leafInk }}>
        <CheckDisc size={18} />{uniform && !card.isDefault ? 'Worn in every room' : `Worn in the ${room.label}`}
      </span>
    )
  } else if (card.locked) {
    note = earned ? 'Earned by playing, not bought' : 'Unlock it with stardust'
  } else {
    note = 'In your closet'
  }

  let action: ReactNode
  if (card.locked) {
    action = earned
      ? <SecondaryButton size="md" full onClick={onPick}>How to earn it</SecondaryButton>
      : (
        <PrimaryButton size="md" full onClick={onPick}
          icon={<MeadowIcon name="sparkle" size={18} mono color="#FFFFFF" />}>
          Unlock for {price}
        </PrimaryButton>
      )
  } else if (!worn) {
    action = <PrimaryButton size="md" full onClick={onPick}>Wear it</PrimaryButton>
  } else if (!card.isDefault && !uniform) {
    action = (
      <SecondaryButton size="md" full onClick={onWearEverywhere} icon={<MeadowIcon name="home" size={18} />}>
        Wear in every room
      </SecondaryButton>
    )
  } else {
    // Worn, and nothing more to do with it: a quiet face in the button's place,
    // so every card is the same height.
    action = (
      <span className="flex items-center justify-center" style={{ height: 46, borderRadius: 14, background: M.leafTint, fontSize: 15, fontWeight: 800, color: M.leafInk }}>
        Wearing it
      </span>
    )
  }

  return (
    <div aria-roledescription="slide" aria-label={`${name}, ${position}`}
      className="flex-shrink-0 flex flex-col"
      style={{
        width: CARD_W, boxSizing: 'border-box', padding: 10, borderRadius: 24, background: '#FFFFFF',
        scrollSnapAlign: 'center',
        border: `2px solid ${worn ? M.leaf : '#FFFFFF'}`,
      }}>
      <LookStage skin={skin} room={room} locked={card.locked} live={live}
        tint={skin ? RARITY_TAG[skin.rarity].bg : M.soft}>
        {skin && (
          <Tag tone={skin.rarity} caps size="sm" style={{ position: 'absolute', top: 10, right: 10, background: '#FFFFFF' }}>
            {RARITY_NAME[skin.rarity]}
          </Tag>
        )}
        {isNew && <Tag tone="love" size="sm" style={{ position: 'absolute', top: 10, left: 10 }}>New</Tag>}
      </LookStage>

      <div style={{ padding: '12px 4px 0' }}>
        <div style={{ fontSize: 19, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ marginTop: 3, height: 20, fontSize: 14, fontWeight: 700, color: M.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</div>
      </div>
      <div style={{ marginTop: 12 }}>{action}</div>
    </div>
  )
}

// ─── Look stage ──────────────────────────────────────────────────────────────
// The cat on the meadow stage, sized and lifted the way the room draws him
// (lib/skins ROOM_FIT), so his feet land on the shadow in any look.

const STAGE_H = 188
/** From the stage's bottom edge up to where the feet stand. */
const FEET = 28
/** A size up on the room's own, so the look is the thing you see. */
const ZOOM = 1.1

function LookStage({ skin, room, locked, live, tint, children }: {
  skin: SkinDef | null; room: RoomDef; locked: boolean; live: boolean; tint: string; children?: ReactNode
}) {
  const fit = ROOM_FIT[room.id] ?? ROOM_FIT.home
  // How much of the art's own canvas runs below the feet.
  const below = skin ? skin.botGap ?? 0 : fit.botGap
  // Zoomed, but never so big the top of the art (the Kitchen's toque) is cut
  // off by the stage.
  const size = Math.round(Math.min(
    (skin ? skinRoomFit(skin, room.id)?.size ?? fit.size : fit.size) * ZOOM,
    (STAGE_H - FEET - 6) / (1 - below),
  ))
  const box: CSSProperties = {
    position: 'absolute', left: '50%', bottom: FEET - size * below, width: size, height: size, transform: 'translateX(-50%)',
  }
  return (
    <div style={{ position: 'relative', height: STAGE_H, borderRadius: 18, background: tint, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', left: 'calc(50% - 280px)', top: STAGE_H - 70, width: 560, height: 220, borderRadius: '50%', background: M.hill }} />
      <div aria-hidden style={{ position: 'absolute', left: 'calc(50% - 64px)', top: STAGE_H - FEET - 8, width: 128, height: 16, borderRadius: '50%', background: M.hillShadow }} />
      <span aria-hidden style={{ position: 'absolute', left: 12, top: STAGE_H - 56 }}><MeadowIcon name="daisy" size={28} /></span>
      <span aria-hidden style={{ position: 'absolute', left: 40, top: STAGE_H - 42 }}><MeadowIcon name="tuft" size={28} /></span>
      <span aria-hidden style={{ position: 'absolute', right: 42, top: STAGE_H - 42 }}><MeadowIcon name="tuft" size={28} /></span>
      <span aria-hidden style={{ position: 'absolute', right: 12, top: STAGE_H - 60 }}><MeadowIcon name="daisy" size={28} /></span>
      {skin && live && !locked ? (
        <div aria-hidden style={box}>
          <BlinkingEren key={skin.id + room.id} size={size}
            src={skin.src} tailSrc={skin.tailSrc} tailOrigin={skin.tailOrigin}
            eyes={skin.eyes} lidTone={skin.lidTone} coat={skin.coat} />
        </div>
      ) : (
        <img src={skin ? skin.thumb : room.defaultThumb} alt="" draggable={false}
          style={{ ...box, objectFit: 'contain', objectPosition: 'bottom', imageRendering: 'auto', filter: locked ? SILHOUETTE : undefined }} />
      )}
      {locked && (
        <span aria-hidden className="absolute flex items-center justify-center" style={{
          left: 'calc(50% - 22px)', top: 'calc(50% - 22px)', width: 44, height: 44, borderRadius: 999, background: '#FFFFFF',
        }}>
          <MeadowIcon name="lock" size={22} color={M.text2} />
        </span>
      )}
      {children}
    </div>
  )
}

// ─── Strip thumb ─────────────────────────────────────────────────────────────
function Thumb({ card, room, active, worn, onClick }: {
  card: ClosetCard; room: RoomDef; active: boolean; worn: boolean; onClick: () => void
}) {
  const cat = useCat()
  const skin = card.isDefault ? null : card.skin
  const label = card.locked ? 'Mystery look' : card.isDefault ? 'Default look' : swapCatName(card.skin!.name, cat)
  return (
    <button type="button" onClick={onClick} aria-label={`${label}${worn ? ', wearing' : ''}`} aria-current={active || undefined}
      className="m-press m-focus relative flex-shrink-0"
      style={{
        width: 52, height: 52, boxSizing: 'border-box', padding: 0, borderRadius: 16, cursor: 'pointer',
        background: skin ? RARITY_TAG[skin.rarity].bg : M.soft,
        border: `2px solid ${active ? M.leaf : '#FFFFFF'}`,
      }}>
      <img src={skin ? skin.thumb : room.defaultThumb} alt="" draggable={false} style={{
        position: 'absolute', inset: '8%', width: '84%', height: '84%', objectFit: 'contain', imageRendering: 'auto',
        filter: card.locked ? SILHOUETTE : undefined,
      }} />
      {worn && <CheckDisc corner size={20} />}
    </button>
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
        width: 60, height: 60, boxSizing: 'border-box', borderRadius: 18,
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

// ─── Small shared bits ───────────────────────────────────────────────────────
/** A rarity's tint with its ink round the edge, the tag's two colours. */
function RarityDot({ rarity }: { rarity: GachaRarity }) {
  const t = RARITY_TAG[rarity]
  return <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, background: t.bg, boxShadow: `inset 0 0 0 2px ${t.ink}` }} />
}

function Count({ n }: { n: number }) {
  return <span style={{ marginLeft: 6, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
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
