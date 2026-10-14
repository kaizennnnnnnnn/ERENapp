'use client'

// ═══════════════════════════════════════════════════════════════════════════
// CATNIP SHOP — where a won day turns into something you can see. (It was the
// Trophy Shop; the battle pays in catnip now. Code names kept the old word.)
//
// Three shelves, and they are deliberately different KINDS of thing rather
// than three drawers of the same cosmetic:
//   WEATHER    changes the sky outside every window, for both of you
//   POWERS     changes the next battle
//   PRESTIGE   changes your name
//
// WEARABLES USED TO BE A FOURTH SHELF HERE and now live in the Closet, next to
// the costume skins — which is where anyone looking for a hat actually goes,
// and it means the Closet's mirror shows the hat on the real cat in the real
// costume instead of on a 15px stand-in head.
//
// Nothing here is buyable with coins. That is the entire economic point: the
// daily battle is the only source of catnip, so the only way to own any of
// this is to have won days.
//
// A card is a picture, a claim, and ONE row of controls along the bottom. The
// first cut hung the equip toggle off the right-hand edge at 6px next to the
// price, and the result was a shop you could buy from but could not work out
// how to wear.
//
// In the Meadow look: white cards on the green section ground, the bought art
// (the machine, the power drawings, the nameplates) on a soft tile, rarity as
// a tag, and one leaf button per card for the thing you can do next.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCat } from '@/hooks/useCat'
import { useCare } from '@/contexts/CareContext'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyCosmetics } from '@/hooks/useTrophyCosmetics'
import {
  itemsOfKind, prestigeDef, PARTNER_ONLY_PRIVILEGES,
  type AnyShopItem, type ShopKind,
  type PrivilegeItem, type PrestigeItem, type MachinePartItem,
} from '@/lib/trophyShop'
import { MACHINE_PARTS, machineBuilt, partsInstalled, machineRemaining, partFitted } from '@/lib/weatherMachine'
import { IconFlask } from '@/components/PixelIcons'
import {
  M, TINT, TYPE, Card, CheckDisc, MeadowIcon, PrimaryButton, SecondaryButton, Segmented, Tag,
} from '@/components/meadow'
import ItemPreview from './ItemPreview'
import { TitlePlate, FramePlate } from './prestigeArt'
import PowerArt from './PowerArt'
import { playSound } from '@/lib/sounds'
import { useCouple } from '@/hooks/useCouple'

const TABS: { kind: ShopKind; label: string; sub: string }[] = [
  { kind: 'machine',   label: 'Machine',  sub: 'Four parts. Finish it and every sky is yours, for good.' },
  { kind: 'privilege', label: 'Powers',   sub: 'Spent on the battle, not worn.' },
  { kind: 'prestige',  label: 'Prestige', sub: 'Sits beside your name, everywhere.' },
]

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
  const { isSolo, partner } = useCouple()
  // The Lab is an OVERLAY mounted in the (app) layout next to this page, not a
  // route. It used to be linked as one — href="/care?room=chemistry" — and
  // /care is a server component whose entire body is redirect('/home'), so the
  // most prominent control on the machine shelf threw you out of the shop.
  const { openScene } = useCare()
  const items = useMemo(
    () => itemsOfKind(tab).filter(i =>
      !isSolo
      || !PARTNER_ONLY_PRIVILEGES.has(i.id)
      || trophies.owned.some(o => o.itemId === i.id && o.quantity > 0)),
    [tab, isSolo, trophies.owned],
  )
  const active = TABS.find(t => t.kind === tab)!
  const myName = profile?.name?.split(' ')[0] || 'You'
  const partnerName = partner?.name?.split(' ')[0] || null

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {/* ── Shelf picker ── */}
      <Segmented
        ariaLabel="Shelf"
        value={tab}
        onChange={k => { playSound('ui_tap'); onTab(k) }}
        options={TABS.map(t => {
          const stock = itemsOfKind(t.kind)
          // Parts are counted across the household — the whole point is that
          // either of us can pay for any of them. Powers and prestige stay
          // personal, because they are things YOU wear or spend.
          const own = t.kind === 'machine'
            ? (id: string) => partFitted(trophies.ours, id)
            : trophies.mine
          const have = stock.filter(i => own(i.id)).length
          return {
            value: t.kind,
            label: (
              <span>
                {t.label}
                <span style={{
                  marginLeft: 5, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                  color: have === stock.length ? M.leaf : M.faint,
                }}>{have}/{stock.length}</span>
              </span>
            ),
          }
        })}
      />

      <p style={{ margin: '0 8px', fontSize: 14, lineHeight: 1.4, fontWeight: 600, color: M.text2, textAlign: 'center' }}>
        {active.sub}
      </p>

      <ShelfSummary kind={tab} cos={cos} name={myName} trophies={trophies}
        onOpenLab={() => openScene('chemistry')} />

      {/* Day one is a wall of locked cards and no obvious way in. Say where
          catnip comes from, once, and only while there is none. */}
      {trophies.loaded && trophies.balance === 0 && (
        <Card padding="14px 16px" style={{ background: TINT.amber }}>
          <p className="flex items-center" style={{ margin: 0, gap: 8, ...TYPE.label, color: '#8A5A12' }}>
            <MeadowIcon name="catnip" size={20} />
            How to get catnip
          </p>
          {/* This used to tell a household of one that the battle "needs two
              people" and to go and invite someone. That stopped being true
              when Eren took the empty seat: they settle against him nightly
              and are paid in catnip for it. This panel is the only place in
              the app that explains where catnip comes from, so it was the
              worst possible place to be wrong. */}
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text }}>
            Win a day of the Care Battle. Ahead at midnight pays 1 catnip; lead by 3 pays 2, by 6 pays 3. Lose by two or less and you still get one.
          </p>
        </Card>
      )}

      {/* ── Shelf ── */}
      {items.map(item => (
        <ShopCard
          key={item.id}
          item={item}
          owned={item.kind === 'machine'
            ? partFitted(trophies.ours, item.id)
            : trophies.mine(item.id)}
          qty={trophies.qty(item.id)}
          partnerHas={!!user?.id && trophies.owned.some(o =>
            o.userId !== user.id && o.itemId === item.id && o.quantity > 0)}
          partnerName={partnerName}
          balance={trophies.balance}
          cos={cos}
          myName={myName}
          onBuy={() => onBuy(item)}
          onUse={() => onUse(item as PrivilegeItem)}
        />
      ))}
    </div>
  )
}

// ─── What this shelf already has on ──────────────────────────────────────────
// The old build put every slot in the game in one panel above the shop, which
// was a wall of blocks nobody read. Each shelf now answers only its own
// question, in one line, right where you would act on it.

export function ShelfSummary({ kind, cos, name, trophies, onOpenLab }: {
  kind: ShopKind
  cos: ReturnType<typeof useTrophyCosmetics>
  name: string
  trophies: ReturnType<typeof useTrophies>
  /** Opens the Lab. Optional so the screenshot harness can still render this
   *  strip without the app's CareProvider — see scripts/tro_preview_page. */
  onOpenLab?(): void
}) {
  if (kind === 'machine') {
    // Buying a part and USING the machine are deliberately different places:
    // one is a shop, the other is a machine standing on a floor with seven
    // dials on it. Saying so here is the whole reason this strip exists — plus
    // how far off the build is, which is the only number this shelf is about.
    const installed = partsInstalled(trophies.ours)
    const built = machineBuilt(trophies.ours)
    return (
      <Card padding="12px 14px 12px 12px" onClick={() => { playSound('ui_tap'); onOpenLab?.() }}>
        <span className="flex items-center" style={{ gap: 12 }}>
          <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
            width: 48, height: 48, borderRadius: 16, background: TINT.lilac,
          }}>
            <IconFlask size={26} />
          </span>
          <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 800, color: M.text }}>
              {built ? 'The machine is built' : `The machine: ${installed} of ${MACHINE_PARTS.length} fitted`}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
              {built
                ? 'In the Lab. Pick which sky hangs outside each window.'
                : `In the Lab. ${machineRemaining(trophies.ours)} catnip of parts still missing.`}
            </span>
            {!built && (
              <span aria-hidden className="flex" style={{ gap: 4, marginTop: 6 }}>
                {MACHINE_PARTS.map((p, i) => (
                  <span key={p.id} style={{
                    flex: 1, height: 6, borderRadius: 3, background: i < installed ? M.leaf : M.track,
                  }} />
                ))}
              </span>
            )}
          </span>
          <MeadowIcon name="chevronRight" size={22} color={M.faint} />
        </span>
      </Card>
    )
  }

  if (kind === 'prestige') {
    const title = prestigeDef(cos.myTitle)
    const frame = prestigeDef(cos.myFrame)
    return (
      <Card padding="12px 16px 16px">
        <p style={{ margin: 0, ...TYPE.label, fontSize: 11, color: M.label, textAlign: 'center' }}>
          Right now you look like
        </p>
        <div className="flex flex-col items-center" style={{ gap: 8, marginTop: 10 }}>
          {frame?.slot === 'frame'
            ? <FramePlate tone={frame.value} name={name} scale={7} />
            : <span style={{ fontSize: 20, fontWeight: 800, color: M.text }}>{name}</span>}
          {title?.slot === 'title' && (
            <TitlePlate value={title.value} focus={title.focus} scale={5}
              glory={title.rarity === 'legendary'} />
          )}
        </div>
      </Card>
    )
  }

  // Powers are consumables, so the useful summary is what is banked.
  const banked = itemsOfKind('privilege')
    .map(i => ({ i: i as PrivilegeItem, n: trophies.qty(i.id) }))
    .filter(x => x.n > 0)
  if (!banked.length) return null
  return (
    <Card padding="10px 16px">
      <span className="flex items-center flex-wrap" style={{ gap: 12 }}>
        <span style={{ ...TYPE.label, fontSize: 11, color: M.label }}>Banked</span>
        {banked.map(({ i, n }) => (
          <span key={i.id} className="flex items-center" style={{ gap: 5 }}>
            <PowerArt id={i.privilege} width={20} />
            <span style={{ fontSize: 14, ...TYPE.number, color: M.text }}>×{n}</span>
          </span>
        ))}
      </span>
    </Card>
  )
}

// ─── One card ────────────────────────────────────────────────────────────────
// Exported so a throwaway preview route can render one without the page's
// providers — see scripts/tro_preview_page.tsx.txt and scripts/shoot_tro.js.

export function ShopCard({
  item, owned, qty, partnerHas, partnerName = null, balance, cos, myName, onBuy, onUse,
}: {
  item: AnyShopItem
  owned: boolean
  qty: number
  partnerHas: boolean
  /** Who "they" are on the partner line. Null falls back to "Your partner". */
  partnerName?: string | null
  balance: number
  cos: ReturnType<typeof useTrophyCosmetics>
  myName: string
  onBuy(): void
  onUse(): void
}) {
  const cat = useCat()
  const affordable = balance >= item.price
  const buyable = !owned || item.stackable === true
  const banner = item.kind === 'prestige'
  const them = partnerName ?? 'Your partner'

  return (
    <Card padding={14}>
      {/* A nameplate is a banner, not an icon: boxed into the thumb column it
          clipped UNDEFEATED to UNDEFEATI. Prestige gets the full width of the
          card and the thumb column is dropped. */}
      {banner && (
        <div className="flex items-center justify-center" style={{
          minHeight: 64, padding: '14px 10px', marginBottom: 12, borderRadius: 18, background: M.soft,
          opacity: owned ? 1 : 0.9,
        }}>
          <ItemPreview item={item} size={78} name={myName.toUpperCase()} />
        </div>
      )}

      <div className="flex" style={{ gap: 14 }}>
        {!banner && (
          /* Preview — sized so the machine with its one lit part still reads. */
          <div className="flex-shrink-0 flex items-center justify-center" style={{
            width: 84, minHeight: 96, borderRadius: 18, background: M.soft,
          }}>
            <ItemPreview item={item} size={item.kind === 'machine' ? 66 : 84} name={myName.toUpperCase()} />
          </div>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ gap: 4 }}>
          <span className="flex items-center" style={{ gap: 6 }}>
            <span style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 800, color: M.text, overflowWrap: 'anywhere' }}>
              {cat.t(item.name)}
            </span>
            {qty > 1 && <Tag size="sm" tone="amber" style={{ fontVariantNumeric: 'tabular-nums' }}>×{qty}</Tag>}
          </span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
            {cat.t(item.blurb)}
          </p>
          <span className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 4 }}>
            <Tag size="sm" tone={item.rarity} caps>{item.rarity}</Tag>
            <Tag size="sm" tone="soft">{where(item)}</Tag>
          </span>
          {partnerHas && (item.kind === 'machine' || !owned) && (
            <p className="flex items-center" style={{ margin: '4px 0 0', gap: 5, fontSize: 13, fontWeight: 700, color: M.text2 }}>
              <MeadowIcon name="heart" size={14} />
              {item.kind === 'machine' ? `${them} fitted this one` : `${them} already has this`}
            </p>
          )}
        </div>
      </div>

      {/* ── Action row ── */}
      <div className="flex items-center" style={{
        gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${M.divider}`,
      }}>
        <div className="flex-1 min-w-0 flex items-center">
          <Status item={item} owned={owned} buyable={buyable} />
          <EquipControl item={item} owned={owned} cos={cos} onUse={onUse} />
        </div>
        {buyable && (
          <PrimaryButton
            size="sm"
            disabled={!affordable}
            onClick={() => { playSound('ui_select'); onBuy() }}
            ariaLabel={`${owned ? 'Buy another' : 'Buy'} for ${item.price} catnip`}
            style={{ paddingLeft: 16, paddingRight: 6 }}
          >
            {owned ? 'Again' : 'Buy'}
            <PriceChip price={item.price} />
          </PrimaryButton>
        )}
      </div>
    </Card>
  )
}

/** The price inside the leaf button: the real green leaf on a white pill, so
 *  it reads as catnip (a white leaf on green reads as a heart). */
export function PriceChip({ price }: { price: number }) {
  return (
    <span className="flex items-center" style={{
      height: 32, gap: 3, padding: '0 10px 0 5px', borderRadius: 10, background: '#FFFFFF',
      color: M.leafInk, fontSize: 15, ...TYPE.number,
    }}>
      <MeadowIcon name="catnip" size={22} />
      {price}
    </span>
  )
}

/** Where a bought thing will show up — the answer to "and then what". */
function where(item: AnyShopItem): string {
  if (item.kind === 'machine') {
    return `Part ${(item as MachinePartItem).order + 1} of ${MACHINE_PARTS.length}`
  }
  if (item.kind === 'privilege') {
    const p = item as PrivilegeItem
    return p.minutes === 0 ? 'One shot'
      : p.minutes >= 60 ? `Lasts ${Math.round(p.minutes / 60)}h` : `Lasts ${p.minutes}m`
  }
  return (item as PrestigeItem).slot === 'title' ? 'Under your name' : 'Around your name'
}

/** The left of the action row when there is nothing left to buy. */
function Status({ item, owned, buyable }: { item: AnyShopItem; owned: boolean; buyable: boolean }) {
  // A machine part is bolted on the moment it is bought, so its state is
  // where it went, not that you own it.
  if (item.kind === 'machine') {
    return owned
      ? <StatusLine icon={<CheckDisc size={22} />} ink={M.leafInk}>Fitted in the Lab</StatusLine>
      : <StatusLine ink={M.text2}>Not fitted yet</StatusLine>
  }
  if (!buyable) return <StatusLine icon={<CheckDisc size={22} />} ink={M.leafInk}>Yours</StatusLine>
  return null
}

function StatusLine({ icon, ink, children }: { icon?: ReactNode; ink: string; children: ReactNode }) {
  return (
    <span className="flex items-center" style={{ gap: 7, fontSize: 14, fontWeight: 800, color: ink }}>
      {icon}
      {children}
    </span>
  )
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
  // MACHINE PARTS ARE CHECKED FIRST, and that ordering is the whole point. A
  // part is bolted on the moment it is bought: there is nothing to equip and —
  // critically — nothing to SPEND, because without this branch a part fell
  // through to the privilege control below and got a USE ONE button that
  // decremented the row to zero, un-building a part the household paid for.
  // Its fitted/not-fitted line is drawn by Status instead.
  if (item.kind === 'machine' || !owned) return null

  if (item.kind === 'prestige') {
    const p = item as PrestigeItem
    const on = p.slot === 'title' ? cos.myTitle === item.id : cos.myFrame === item.id
    const toggle = () => {
      playSound('ui_tap')
      if (p.slot === 'title') cos.setTitle(on ? null : item.id)
      else cos.setFrame(on ? null : item.id)
    }
    return on ? (
      <SecondaryButton size="sm" onClick={toggle} ariaLabel={`Wearing ${item.name}. Take it off`}
        icon={<CheckDisc size={20} />} style={{ marginLeft: 'auto', paddingLeft: 12 }}>
        Wearing
      </SecondaryButton>
    ) : (
      <PrimaryButton size="sm" onClick={toggle} style={{ marginLeft: 'auto' }}>Wear it</PrimaryButton>
    )
  }

  // Privilege — a consumable, so the button spends one.
  return (
    <SecondaryButton size="sm" onClick={() => { playSound('ui_select'); onUse() }}
      icon={<MeadowIcon name="bolt" size={20} />} style={{ paddingLeft: 12 }}>
      Use one
    </SecondaryButton>
  )
}
