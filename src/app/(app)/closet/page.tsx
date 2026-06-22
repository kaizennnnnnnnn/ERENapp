'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useCare } from '@/contexts/CareContext'
import { useCloset } from '@/hooks/useCloset'
import { useAuth } from '@/hooks/useAuth'
import { useGacha } from '@/hooks/useGacha'
import { markSkinsSeen } from '@/hooks/useNewSkins'
import {
  SKINNABLE_ROOMS, GACHA_SKINS, CLASSIC_SKIN, getSkin, resolveRoomSkin, skinRoomFit,
  skinPrice, type SkinDef,
} from '@/lib/skins'
import { RARITY_COLORS } from '@/lib/gacha'
import BlinkingEren from '@/components/BlinkingEren'
import { IconLock, IconDress, IconSparkles } from '@/components/PixelIcons'
import SkinPurchaseSheet from '@/components/closet/SkinPurchaseSheet'
import { playSound } from '@/lib/sounds'

// Cards shown for the active room: Default (revert) + Classic + the 21 gacha
// skins. `key` doubles as the room_skins value ('' = default, else the skin id).
type CardEntry = { key: string; skin: SkinDef | null; locked: boolean; isDefault?: boolean }

export default function ClosetPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { user } = useAuth()
  const { owned, roomSkins, assign, loading, loaded, refetch } = useCloset()
  const { stardust, purchaseSkin } = useGacha()
  const [activeRoom, setActiveRoom] = useState(SKINNABLE_ROOMS[0].id)
  const [toast, setToast] = useState<string | null>(null)
  // Skin awaiting purchase confirmation in the stardust shop sheet.
  const [buying, setBuying] = useState<SkinDef | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  // Opening the Closet IS "checking out" the new looks — clear the home badge.
  // Mark the household-union set the grid actually shows, gated on a SUCCESSFUL
  // owned-load so a transient 503 (empty owned) can't blank the seen-set and make
  // the whole collection look new again.
  useEffect(() => {
    if (loaded && user?.id) markSkinsSeen(user.id, Array.from(owned))
  }, [loaded, user?.id, owned])

  const room = SKINNABLE_ROOMS.find(r => r.id === activeRoom)!
  const assignedId = roomSkins[activeRoom] // undefined = default
  const previewSkin = resolveRoomSkin(roomSkins, activeRoom) // SkinDef | null

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  function pick(entry: CardEntry) {
    if (entry.locked && entry.skin) {
      // Locked → offer to buy it with stardust instead of only pointing at gacha.
      playSound('ui_modal_open')
      setBuying(entry.skin)
      return
    }
    playSound('ui_select')
    assign(activeRoom, entry.isDefault ? null : entry.key)
  }

  async function confirmBuy() {
    if (!buying || busy) return
    setBusy(true)
    const res = await purchaseSkin(buying.id, buying.rarity)
    setBusy(false)
    if (res.ok) {
      playSound('level_up')
      const name = buying.name
      setBuying(null)
      await refetch()          // unlock the card (owned set now includes it)
      showToast(`Unlocked ${name}!`)
    } else if (res.reason === 'insufficient') {
      showToast('Not enough stardust')
    } else if (res.reason === 'already_owned') {
      setBuying(null)
      await refetch()
    } else {
      showToast('Could not unlock — try again')
    }
  }

  const cards: CardEntry[] = [
    { key: '', skin: null, locked: false, isDefault: true },
    { key: 'classic', skin: CLASSIC_SKIN, locked: false },
    ...GACHA_SKINS.map(s => ({ key: s.id, skin: s, locked: !owned.has(s.id) })),
  ]
  const isSelected = (e: CardEntry) => e.isDefault ? !assignedId : assignedId === e.key

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{
      background: 'radial-gradient(120% 80% at 50% 0%, #2A1B4A 0%, #160E2E 55%, #0B0717 100%)',
    }}>
      {/* CRT scanlines — the dark "game panel" convention */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)',
        zIndex: 1,
      }} />

      <div className="relative px-3" style={{ zIndex: 2, paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => { playSound('ui_back'); router.back() }}
            className="flex items-center justify-center active:translate-y-[1px] transition-transform"
            style={{ width: 32, height: 32, background: '#1B1233', borderRadius: 6, border: '2px solid #4C1D95', boxShadow: '0 2px 0 #2E1065' }}>
            <ChevronLeft size={16} className="text-purple-200" />
          </button>
          <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}>
            <IconDress size={12} /> CLOSET
          </span>
          <div className="flex-1" />
          {/* Stardust balance — what you can spend in the shop */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{
            background: '#1B1233', borderRadius: 6, border: '2px solid #4C1D95', boxShadow: '0 2px 0 #2E1065',
          }}>
            <IconSparkles size={13} />
            <span className="font-pixel" style={{ fontSize: 8, color: '#C4B5FD', textShadow: '0 0 3px rgba(167,139,250,0.5)' }}>{stardust}</span>
          </div>
        </div>

        {/* Room pills */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {SKINNABLE_ROOMS.map(r => {
            const on = r.id === activeRoom
            const sk = resolveRoomSkin(roomSkins, r.id)
            return (
              <button key={r.id} onClick={() => { playSound('ui_tap'); setActiveRoom(r.id) }}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 active:scale-95 transition-all"
                style={{
                  background: on ? 'linear-gradient(135deg, #7C3AED, #A78BFA)' : 'rgba(255,255,255,0.06)',
                  borderRadius: 4,
                  border: `2px solid ${on ? '#C4B5FD' : 'rgba(167,139,250,0.25)'}`,
                  boxShadow: on ? '0 0 10px rgba(167,139,250,0.5)' : 'none',
                }}>
                <img src={sk?.thumb ?? r.defaultThumb} alt="" draggable={false}
                  style={{ width: 18, height: 18, objectFit: 'contain', imageRendering: 'pixelated' }} />
                <span className="font-pixel whitespace-nowrap" style={{ fontSize: 6, color: on ? '#fff' : '#C4B5FD' }}>{r.label.toUpperCase()}</span>
              </button>
            )
          })}
        </div>

        {/* Preview */}
        <div className="relative mx-auto mb-4 flex flex-col items-center justify-end"
          style={{
            maxWidth: 320, height: 220,
            background: 'radial-gradient(80% 70% at 50% 38%, rgba(124,58,237,0.28), rgba(11,7,23,0) 70%)',
            border: '2px solid rgba(167,139,250,0.3)', borderRadius: 12,
          }}>
          {/* gold corner pixels */}
          {[[6, 6], [6, 'r'], ['b', 6], ['b', 'r']].map((c, i) => (
            <div key={i} className="absolute" style={{
              width: 4, height: 4, background: '#F5C842',
              top: c[0] === 'b' ? undefined : 6, bottom: c[0] === 'b' ? 6 : undefined,
              left: c[1] === 'r' ? undefined : 6, right: c[1] === 'r' ? 6 : undefined,
            }} />
          ))}
          <div className="flex-1 flex items-end justify-center w-full pb-1">
            {previewSkin ? (
              // Size the preview to how it'll actually look in the selected
              // room (matches the room default's cat), scaled up a touch so the
              // showcase fills the card.
              <BlinkingEren key={previewSkin.id + activeRoom}
                size={(skinRoomFit(previewSkin, activeRoom)?.size ?? 180) * 1.15}
                src={previewSkin.src} tailSrc={previewSkin.tailSrc}
                tailOrigin={previewSkin.tailOrigin} eyes={previewSkin.eyes} />
            ) : (
              // Default look — the room's native sprite (may be a special pose),
              // shown as-is so "Default" reads as the current look.
              <img src={room.defaultThumb} alt="" draggable={false}
                style={{ height: 180, objectFit: 'contain', imageRendering: 'pixelated' }} />
            )}
          </div>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center">
            <p className="font-pixel" style={{ fontSize: 7, color: '#C4B5FD' }}>{room.label.toUpperCase()}</p>
            <p className="font-pixel mt-0.5" style={{ fontSize: 6, color: 'rgba(255,255,255,0.55)' }}>
              {previewSkin ? previewSkin.name.toUpperCase() : 'DEFAULT LOOK'}
            </p>
          </div>
        </div>

        {/* Skins grid */}
        {loading ? (
          <p className="text-center font-pixel" style={{ fontSize: 7, color: '#A78BFA' }}>LOADING…</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {cards.map(e => {
              const sel = isSelected(e)
              const colors = e.skin ? RARITY_COLORS[e.skin.rarity] : RARITY_COLORS.common
              return (
                <button key={e.key || 'default'} onClick={() => pick(e)}
                  className="relative flex flex-col items-center gap-1 p-1.5 active:scale-95 transition-all"
                  style={{
                    background: sel ? 'rgba(167,139,250,0.22)' : 'rgba(255,255,255,0.05)',
                    borderRadius: 6,
                    border: `2px solid ${sel ? '#C4B5FD' : e.locked ? 'rgba(255,255,255,0.1)' : colors.border + '88'}`,
                    boxShadow: sel ? '0 0 10px rgba(167,139,250,0.55)' : 'none',
                  }}>
                  <div className="flex items-center justify-center" style={{ width: '100%', aspectRatio: '1' }}>
                    <img src={e.isDefault ? room.defaultThumb : e.skin!.thumb} alt="" draggable={false}
                      style={{
                        width: '92%', height: '92%', objectFit: 'contain', imageRendering: 'pixelated',
                        filter: e.locked ? 'grayscale(1) brightness(0.45)' : 'none',
                        opacity: e.locked ? 0.7 : 1,
                      }} />
                  </div>
                  <span className="font-pixel text-center leading-tight" style={{ fontSize: 5, color: e.locked ? '#6B7280' : '#E9D5FF' }}>
                    {(e.isDefault ? 'DEFAULT' : e.skin!.name).toUpperCase()}
                  </span>
                  {e.locked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IconLock size={16} />
                    </div>
                  )}
                  {/* Stardust price — tap a locked skin to buy it */}
                  {e.locked && e.skin && (
                    <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1 py-0.5"
                      style={{ background: '#1B1233', border: '1.5px solid #4C1D95', borderRadius: 5, boxShadow: '0 1px 0 #2E1065' }}>
                      <IconSparkles size={8} />
                      <span className="font-pixel" style={{ fontSize: 5, color: '#C4B5FD' }}>{skinPrice(e.skin.rarity)}</span>
                    </div>
                  )}
                  {sel && (
                    <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center"
                      style={{ width: 16, height: 16, background: '#22C55E', borderRadius: '50%', border: '2px solid #0B0717' }}>
                      <span style={{ fontSize: 8, color: '#fff', lineHeight: 1 }}>✓</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Stardust purchase sheet */}
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-white px-4 py-2.5 whitespace-nowrap" style={{
          zIndex: 50, background: '#1F1F2E', borderRadius: 3, border: '2px solid #3A3A5E',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7,
        }}>{toast}</div>
      )}
    </div>
  )
}
