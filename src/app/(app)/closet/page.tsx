'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'
import { useCloset } from '@/hooks/useCloset'
import { useAuth } from '@/hooks/useAuth'
import { useGacha } from '@/hooks/useGacha'
import { markSkinsSeen, readSeenSkins } from '@/hooks/useNewSkins'
import {
  SKINNABLE_ROOMS, GACHA_SKINS, CLASSIC_SKIN, resolveRoomSkin, skinPrice, type SkinDef,
} from '@/lib/skins'
import type { GachaRarity } from '@/types'
import SkinPurchaseSheet from '@/components/closet/SkinPurchaseSheet'
import ClosetView, { type ClosetCard } from '@/components/closet/ClosetView'
import { playSound } from '@/lib/sounds'

// Rarest first — a player's prized looks lead in MY LOOKS, and the Shop reads
// aspirational top-down.
const RARITY_RANK: Record<GachaRarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
const byRarity = (a: SkinDef, b: SkinDef) =>
  RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.name.localeCompare(b.name)

export default function ClosetPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { user } = useAuth()
  const { owned, roomSkins, assign, assignAll, loading, loaded, refetch } = useCloset()
  const { stardust, purchaseSkin } = useGacha()
  const [activeRoom, setActiveRoom] = useState(SKINNABLE_ROOMS[0].id)
  const [tab, setTab] = useState<'mine' | 'shop'>('mine')
  const [toast, setToast] = useState<string | null>(null)
  const [buying, setBuying] = useState<SkinDef | null>(null)
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

  const previewSkin = resolveRoomSkin(roomSkins, activeRoom)
  const selectedKey = roomSkins[activeRoom] ?? ''

  // The active look is "uniform" when every room already wears it — drives the
  // wear-everywhere button's done state.
  const isUniform = useMemo(
    () => !!selectedKey && SKINNABLE_ROOMS.every(r => (roomSkins[r.id] ?? '') === selectedKey),
    [roomSkins, selectedKey],
  )

  // MY LOOKS = Default + Classic + owned skins (the daily driver, no scrolling).
  const ownedCards: ClosetCard[] = useMemo(() => [
    { key: '', skin: null, locked: false, isDefault: true },
    { key: 'classic', skin: CLASSIC_SKIN, locked: false },
    ...GACHA_SKINS.filter(s => owned.has(s.id)).sort(byRarity)
      .map(s => ({ key: s.id, skin: s, locked: false })),
  ], [owned])

  // SHOP = the locked catalogue, grouped animals→foods then rarest first.
  const lockedCards: ClosetCard[] = useMemo(() =>
    GACHA_SKINS.filter(s => !owned.has(s.id))
      .sort((a, b) => (a.set === b.set ? byRarity(a, b) : a.set === 'animal' ? -1 : 1))
      .map(s => ({ key: s.id, skin: s, locked: true })),
    [owned])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  function pick(card: ClosetCard) {
    if (card.locked && card.skin) {
      playSound('ui_modal_open')
      setBuying(card.skin)
      return
    }
    playSound('ui_select')
    assign(activeRoom, card.isDefault ? null : card.key)
  }

  function wearEverywhere() {
    if (!selectedKey) return
    assignAll(selectedKey)
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
      showToast(`Now wearing ${skin.name}!`)
    } else if (res.reason === 'insufficient') {
      showToast('Not enough stardust')
    } else if (res.reason === 'already_owned') {
      setBuying(null)
      await refetch()
    } else {
      setBuying(null)
      showToast('Could not unlock — try again')
    }
  }

  return (
    <>
      <ClosetView
        rooms={SKINNABLE_ROOMS}
        activeRoom={activeRoom}
        onSelectRoom={setActiveRoom}
        roomSkins={roomSkins}
        previewSkin={previewSkin}
        selectedKey={selectedKey}
        isUniform={isUniform}
        ownedCards={ownedCards}
        lockedCards={lockedCards}
        newBadgeSkins={newBadgeSkins}
        stardust={stardust}
        loading={loading}
        tab={tab}
        onTabChange={setTab}
        onPick={pick}
        onWearEverywhere={wearEverywhere}
        onBack={() => router.back()}
      />

      {buying && (
        <SkinPurchaseSheet
          skin={buying}
          price={skinPrice(buying.rarity)}
          balance={stardust}
          busy={busy}
          onBuy={confirmBuy}
          onClose={() => { if (!busy) setBuying(null) }}
        />
      )}

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-white px-4 py-2.5 whitespace-nowrap" style={{
          zIndex: 70, background: '#1F1F2E', borderRadius: 3, border: '2px solid #3A3A5E',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7,
        }}>{toast}</div>
      )}
    </>
  )
}
