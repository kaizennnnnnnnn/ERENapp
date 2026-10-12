'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'
import { useCloset } from '@/hooks/useCloset'
import { useAuth } from '@/hooks/useAuth'
import { useGacha } from '@/hooks/useGacha'
import { markSkinsSeen, readSeenSkins } from '@/hooks/useNewSkins'
import { useCat } from '@/hooks/useCat'
import { useIsDark } from '@/hooks/useIsDark'
import { useCouple } from '@/hooks/useCouple'
import { useRemembered, oneOf } from '@/hooks/useRemembered'
import { useJellies } from '@/hooks/useJellies'
import { useErenStats } from '@/hooks/useErenStats'
import { swapCatName } from '@/lib/catWords'
import {
  SKINNABLE_ROOMS, GACHA_SKINS, CLASSIC_SKIN, skinUnlockDrink, type SkinDef,
} from '@/lib/skins'
import { FOOD_META } from '@/lib/foodMeta'
import type { GachaRarity, FoodKey } from '@/types'
import SkinPurchaseSheet from '@/components/closet/SkinPurchaseSheet'
import RoomPickerSheet from '@/components/closet/RoomPickerSheet'
import SurpriseSheet, { type SurpriseScope } from '@/components/closet/SurpriseSheet'
import ClosetView, { type ClosetCard, type ClosetTab, type EarnProgress } from '@/components/closet/ClosetView'
import { playSound } from '@/lib/sounds'
import { M, personColor } from '@/components/meadow'

interface Toast { msg: string; action?: { label: string; run: () => void } }

// Rarest first — a player's prized looks lead in MY LOOKS, and the Shop reads
// aspirational top-down.
const RARITY_RANK: Record<GachaRarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
const byRarity = (a: SkinDef, b: SkinDef) =>
  RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.name.localeCompare(b.name)

export default function ClosetPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { user } = useAuth()
  const { owned, roomSkins, dressedBy, dress, assign, assignAll, favorites, toggleFavorite, loading, loaded, refetch } = useCloset()
  const { stardust, purchaseSkin } = useGacha()
  const cat = useCat()
  const isDark = useIsDark()
  const { partner } = useCouple()
  const jellies = useJellies()
  const { stats } = useErenStats()
  // Reopens on the room and tab you left it on (this phone only).
  const [activeRoom, setActiveRoom] = useRemembered('closet:room', SKINNABLE_ROOMS[0].id, oneOf(...SKINNABLE_ROOMS.map(r => r.id)))
  const [tab, setTab] = useRemembered<ClosetTab>('closet:tab', 'mine', oneOf('mine', 'shop'))
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const [buying, setBuying] = useState<SkinDef | null>(null)
  const [choosing, setChoosing] = useState<SkinDef | null>(null)
  const [surprising, setSurprising] = useState(false)
  const [busy, setBusy] = useState(false)

  // Per-card NEW badge: skins owned-but-unseen when the closet opened. Captured
  // once before markSkinsSeen clears the seen-set (effects run in declaration
  // order, so this must precede the mark effect below).
  const badgeCapturedRef = useRef(false)
  const [newBadgeSkins, setNewBadgeSkins] = useState<Set<string>>(new Set())

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  useEffect(() => {
    if (!loaded || !user?.id || badgeCapturedRef.current) return
    const stored = readSeenSkins(user.id)
    if (stored !== null) {
      const seen = new Set(stored)
      const fresh = new Set<string>()
      Array.from(owned).forEach(id => { if (!seen.has(id)) fresh.add(id) })
      if (fresh.size > 0) setNewBadgeSkins(fresh)
    }
    badgeCapturedRef.current = true
  }, [loaded, user?.id, owned]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the home badge once the closet has SUCCESSFULLY loaded (a 503 mustn't
  // blank the seen-set and make the whole collection look new again).
  useEffect(() => {
    if (loaded && user?.id) markSkinsSeen(user.id, Array.from(owned))
  }, [loaded, user?.id, owned])

  const selectedKey = roomSkins[activeRoom] ?? ''

  // How far along the earned looks are: Super Jellies fed out of five (and one
  // waiting in the Parlour), or the special can sitting in the fridge (yours
  // or the shared pile, the two FeedScene draws from).
  const earn = useMemo(() => {
    const out: Record<string, EarnProgress> = {}
    for (const s of GACHA_SKINS) {
      if (s.unlock === 'jelly') {
        out[s.id] = {
          how: cat.t('Feed {name} 5 Super Jellies'),
          count: jellies.loaded ? { at: Math.min(jellies.fed, jellies.feedGoal), of: jellies.feedGoal } : undefined,
          status: jellies.supers > 0 ? `${jellies.supers} waiting in the Parlour` : undefined,
          ready: jellies.supers > 0,
        }
        continue
      }
      const drink = skinUnlockDrink(s.id) as FoodKey | undefined
      if (!drink) continue
      const mine = (user?.id && stats?.food_by_user?.[user.id]?.[drink]) || 0
      const shared = stats?.food_inventory?.[drink] ?? 0
      out[s.id] = {
        how: cat.t(`Feed {name} a ${FOOD_META[drink].name}`),
        status: mine + shared > 0 ? 'One is in your fridge' : 'None in your fridge yet',
        ready: mine + shared > 0,
      }
    }
    return out
  }, [cat, jellies.loaded, jellies.fed, jellies.feedGoal, jellies.supers, stats?.food_by_user, stats?.food_inventory, user?.id])

  // The active look is "uniform" when every room already wears it — drives the
  // wear-everywhere button's done state.
  const isUniform = useMemo(
    () => !!selectedKey && SKINNABLE_ROOMS.every(r => (roomSkins[r.id] ?? '') === selectedKey),
    [roomSkins, selectedKey],
  )

  // The rooms the partner dressed last, for their initial on the room tile and
  // "Jovan dressed the Kitchen" on what it's wearing.
  const partnerPicks = useMemo(() => {
    const out: Record<string, { name: string; color: string }> = {}
    if (!partner || !dressedBy) return out
    const who = { name: (partner.name ?? 'Partner').split(' ')[0], color: personColor(partner.heart) }
    for (const r of SKINNABLE_ROOMS) if (dressedBy[r.id] === partner.id) out[r.id] = who
    return out
  }, [partner, dressedBy])

  // Favourites lead My looks, in the order they had when the closet opened:
  // hearting a look mid-visit must not yank it out from under the finger, so
  // the ordering only catches up on the next visit.
  const favOrder = useRef<Set<string> | null>(null)
  if (!favOrder.current && favorites) favOrder.current = new Set(favorites)
  const leadFavs = favOrder.current

  // MY LOOKS = Default, then the favourites, then Classic + owned skins.
  const ownedCards: ClosetCard[] = useMemo(() => {
    const looks: ClosetCard[] = [
      { key: 'classic', skin: CLASSIC_SKIN, locked: false },
      ...GACHA_SKINS.filter(s => owned.has(s.id)).sort(byRarity)
        .map(s => ({ key: s.id, skin: s, locked: false })),
    ]
    const fav = leadFavs ?? new Set<string>()
    return [
      { key: '', skin: null, locked: false, isDefault: true },
      ...looks.filter(c => fav.has(c.key)),
      ...looks.filter(c => !fav.has(c.key)),
    ]
  }, [owned, leadFavs])

  // SHOP = the locked catalogue, grouped animals→foods then rarest first.
  const lockedCards: ClosetCard[] = useMemo(() =>
    GACHA_SKINS.filter(s => !owned.has(s.id))
      .sort((a, b) => (a.set === b.set ? byRarity(a, b) : a.set === 'animal' ? -1 : 1))
      .map(s => ({ key: s.id, skin: s, locked: true })),
    [owned])

  // A toast with an action (Undo) stays long enough to reach for it.
  function showToast(msg: string, action?: Toast['action']) {
    setToast({ msg, action })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), action ? 5000 : 2200)
  }

  function pick(card: ClosetCard) {
    if (card.locked && card.skin) {
      // The earned looks aren't for sale at any price. Point at the door that
      // actually opens them instead of a sheet that couldn't complete.
      if (card.skin.unlock === 'jelly') {
        playSound('ui_tap')
        showToast(cat.t('Feed {name} 5 Super Jellies'))
        return
      }
      const drink = skinUnlockDrink(card.skin.id)
      if (drink) {
        playSound('ui_tap')
        showToast(cat.t(`Feed {name} a ${FOOD_META[drink as FoodKey].name}`))
        return
      }
      playSound('ui_modal_open')
      setBuying(card.skin)
      return
    }
    playSound('ui_select')
    assign(activeRoom, card.isDefault ? null : card.key)
  }

  // Every room in one look overwrites whatever each room had on, the
  // partner's picks included, so it comes with a way back: Undo puts every
  // room back exactly as it was.
  function wearEverywhere() {
    if (!selectedKey) return
    const before = Object.fromEntries(SKINNABLE_ROOMS.map(r => [r.id, roomSkins[r.id] ?? null]))
    assignAll(selectedKey)
    showToast('Worn in every room', {
      label: 'Undo',
      run: () => { playSound('ui_back'); dress(before); setToast(null) },
    })
  }

  // The room picker's changes in one write, with the same way back as
  // "Wear in every room".
  function applyRooms(changes: Record<string, string | null>) {
    const before = Object.fromEntries(Object.keys(changes).map(id => [id, roomSkins[id] ?? null]))
    const on = Object.values(changes).filter(Boolean).length
    playSound('ui_select')
    setChoosing(null)
    dress(changes)
    showToast(on === 0 ? 'Taken off' : `Put on in ${on} ${on === 1 ? 'room' : 'rooms'}`, {
      label: 'Undo',
      run: () => { playSound('ui_back'); dress(before); setToast(null) },
    })
  }

  // Let the closet pick. One room: any look you own (or any favourite) it
  // isn't wearing now. Every room: the pool shuffled and dealt out, so the
  // rooms differ from each other wherever there are enough looks to go round.
  function surprise(scope: SurpriseScope, favoritesOnly: boolean) {
    const pool = ownedCards.filter(c => !c.isDefault && (!favoritesOnly || favorites?.has(c.key))).map(c => c.key)
    const room = SKINNABLE_ROOMS.find(r => r.id === activeRoom)!
    const changes: Record<string, string | null> = {}
    if (scope === 'room') {
      const options = pool.filter(k => k !== selectedKey)
      if (options.length === 0) return
      changes[activeRoom] = options[Math.floor(Math.random() * options.length)]
    } else {
      const deck = [...pool]
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]
      }
      SKINNABLE_ROOMS.forEach((r, i) => { changes[r.id] = deck[i % deck.length] })
    }
    const before = Object.fromEntries(Object.keys(changes).map(id => [id, roomSkins[id] ?? null]))
    const one = scope === 'room' ? ownedCards.find(c => c.key === changes[activeRoom])?.skin : null
    playSound('level_up')
    setSurprising(false)
    dress(changes)
    showToast(one ? `The ${room.label} is wearing ${swapCatName(one.name, cat)}` : 'Every room has a new look', {
      label: 'Undo',
      run: () => { playSound('ui_back'); dress(before); setToast(null) },
    })
  }

  async function confirmBuy() {
    if (!buying || busy) return
    setBusy(true)
    const res = await purchaseSkin(buying.id, buying.rarity)
    setBusy(false)
    if (res.ok) {
      playSound('level_up')
      const skin = buying
      setBuying(null)
      assign(activeRoom, skin.id)   // unlock → try it on in the room you're viewing
      setTab('mine')                // the skin just left the Shop grid; show it in My Looks
      await refetch()
      showToast(`Now wearing ${swapCatName(skin.name, cat)}!`)
    } else if (res.reason === 'insufficient') {
      showToast('Not enough stardust')
    } else if (res.reason === 'already_owned') {
      setBuying(null)
      await refetch()
    } else {
      setBuying(null)
      showToast('Could not unlock. Try again.')
    }
  }

  return (
    <>
      <ClosetView
        rooms={SKINNABLE_ROOMS}
        activeRoom={activeRoom}
        onSelectRoom={setActiveRoom}
        roomSkins={roomSkins}
        selectedKey={selectedKey}
        isUniform={isUniform}
        ownedCards={ownedCards}
        lockedCards={lockedCards}
        newBadgeSkins={newBadgeSkins}
        stardust={stardust}
        loading={loading}
        ownedLoaded={loaded}
        tab={tab}
        onTabChange={setTab}
        onPick={pick}
        onWearEverywhere={wearEverywhere}
        onChooseRooms={c => setChoosing(c.skin)}
        onBack={() => router.back()}
        dark={isDark}
        earn={earn}
        favorites={favorites}
        onSurprise={() => setSurprising(true)}
        partnerPicks={partnerPicks}
        onToggleFavorite={async key => {
          playSound(favorites?.has(key) ? 'ui_tap' : 'ui_select')
          if (!(await toggleFavorite(key))) showToast('Could not save that favourite. Try again.')
        }}
      />

      <SurpriseSheet
        open={surprising}
        roomLabel={SKINNABLE_ROOMS.find(r => r.id === activeRoom)?.label ?? 'room'}
        canUseFavorites={(favorites?.size ?? 0) >= 2}
        onPick={surprise}
        onClose={() => setSurprising(false)}
      />

      <RoomPickerSheet
        skin={choosing}
        rooms={SKINNABLE_ROOMS}
        roomSkins={roomSkins}
        activeRoom={activeRoom}
        onApply={applyRooms}
        onClose={() => setChoosing(null)}
      />

      <SkinPurchaseSheet
        skin={buying}
        balance={stardust}
        busy={busy}
        onBuy={confirmBuy}
        onClose={() => { if (!busy) setBuying(null) }}
      />

      {toast && (
        // Centred by a full-width flex row, not a transform: one line when it
        // fits, wrapped when a long cat name ("Now wearing Fox Clementine The
        // Great!") won't. Only the pill catches taps, for its action.
        <div role="status" className="fixed inset-x-0 flex justify-center pointer-events-none"
          style={{ top: 'calc(var(--safe-top) + 12px)', zIndex: 90, padding: '0 16px' }}>
          <span className="meadow-root flex items-center" style={{
            pointerEvents: 'auto', gap: 14,
            padding: toast.action ? '6px 6px 6px 16px' : '10px 16px', borderRadius: 20, background: M.text, color: '#FFFFFF',
            fontSize: 14, lineHeight: 1.35, fontWeight: 700, textAlign: 'center', overflowWrap: 'anywhere',
          }}>
            {toast.msg}
            {toast.action && (
              <button type="button" onClick={toast.action.run} className="m-press m-focus" style={{
                height: 32, padding: '0 14px', border: 0, borderRadius: 14, background: 'rgba(255,255,255,0.16)',
                color: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}>{toast.action.label}</button>
            )}
          </span>
        </div>
      )}
    </>
  )
}
