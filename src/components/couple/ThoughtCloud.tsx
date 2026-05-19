'use client'

// Floating thought-cloud that sits next to Eren on the home screen. Idle
// state shows three pulsing dots ("Eren is thinking of you"). Click it and
// it expands into two smaller clouds:
//   • Message cloud — small text input. Sends a journal message to the
//     partner; they see "Eren has a message for you" via ErenMessagePopup.
//   • Gift cloud — picks one food from YOUR personal fridge pile and sends
//     it as a gift; qty is moved from your pile → partner's pile, and a
//     journal row with `gift_item` is created so the popup can show it.
//
// All persistence is delegated to hooks (useCouple.sendMessage,
// useErenStats.giftFood). This component is presentation + orchestration.

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { playSound } from '@/lib/sounds'
import type { FoodInventory, FoodKey } from '@/types'

const FOOD_META: Record<FoodKey, { name: string; color: string }> = {
  kibble: { name: 'Kibble',    color: '#F5C842' },
  fish:   { name: 'Fish',      color: '#6BAED6' },
  treat:  { name: 'Cat Treat', color: '#FF6B9D' },
  tuna:   { name: 'Tuna Can',  color: '#E8A020' },
  steak:  { name: 'Steak',     color: '#CC3333' },
  cream:  { name: 'Cream',     color: '#A78BFA' },
}

const FOOD_ORDER: FoodKey[] = ['kibble', 'fish', 'treat', 'tuna', 'steak', 'cream']

export default function ThoughtCloud() {
  const { user, profile } = useAuth()
  const { partner, sendMessage } = useCouple()
  const { stats, giftFood } = useErenStats(profile?.household_id ?? null)

  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activePane, setActivePane] = useState<'message' | 'gift'>('message')

  // Toast auto-clears after 2.4s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  // My personal pile only — gifts can't be sent from the legacy shared pool.
  const myPile: FoodInventory = (user?.id && stats?.food_by_user?.[user.id]) || {}
  const giftableKeys: FoodKey[] = FOOD_ORDER.filter(k => (myPile[k] ?? 0) > 0)

  const noPartner = !partner

  async function handleSendMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    await sendMessage(text.trim(), null)
    setText('')
    setToast('Eren will deliver it 💌')
    setSending(false)
    setTimeout(() => setOpen(false), 700)
  }

  async function handleSendGift(key: FoodKey) {
    if (sending || !user?.id || !partner?.id) return
    setSending(true)
    const moved = await giftFood(user.id, partner.id, key)
    if (!moved) {
      setToast(`No ${FOOD_META[key].name} to give`)
      setSending(false)
      return
    }
    await sendMessage('', { key, qty: 1 })
    setToast(`Sent ${FOOD_META[key].name} 🎁`)
    setSending(false)
    setTimeout(() => setOpen(false), 800)
  }

  // ─── Floating idle cloud ─────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
        className="absolute z-[6] active:scale-95 transition-transform"
        style={{
          // Sits to the upper-right of Eren, drifting gently.
          bottom: '28%', right: '14%',
          animation: 'tcDrift 3.2s ease-in-out infinite',
          // Reset the inherited button styling — this is a custom shape.
          background: 'transparent', border: 'none', padding: 0,
        }}
        aria-label="Eren is thinking — open message"
      >
        <CloudShape size={64}>
          <div className="flex items-center justify-center gap-[3px] h-full">
            <Dot delay={0} />
            <Dot delay={0.18} />
            <Dot delay={0.36} />
          </div>
        </CloudShape>
        {/* trailing puffs leading down toward Eren */}
        <CloudPuff size={12} style={{ position: 'absolute', bottom: -6, left: '32%' }} />
        <CloudPuff size={7}  style={{ position: 'absolute', bottom: -14, left: '24%' }} />
        <style jsx>{`
          @keyframes tcDrift {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-4px); }
          }
        `}</style>
      </button>
    )
  }

  // ─── Expanded — two smaller clouds side-by-side ──────────────────────
  return (
    <>
      {/* Backdrop — taps outside dismiss */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={() => { playSound('ui_modal_close'); setOpen(false) }}
      />

      <div
        className="fixed left-1/2 z-[61] flex flex-col items-center gap-3 px-3"
        style={{ top: '18%', transform: 'translateX(-50%)', width: 'min(92vw, 380px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Tabs above the cloud — message / gift toggle */}
        <div className="flex gap-2 mb-1">
          <TabButton active={activePane === 'message'} onClick={() => setActivePane('message')} label="MESSAGE" color="#A78BFA" />
          <TabButton active={activePane === 'gift'}    onClick={() => setActivePane('gift')}    label="GIFT"    color="#F5C842" />
        </div>

        <CloudShape size={null} fullWidth>
          {noPartner ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-600">
                Invite your partner first so Eren can deliver this.
              </p>
            </div>
          ) : activePane === 'message' ? (
            <div className="px-4 py-3 flex flex-col gap-2">
              <p className="font-pixel text-purple-500 text-center" style={{ fontSize: 6 }}>
                EREN WILL DELIVER THIS TO {partner?.name?.toUpperCase().split(' ')[0] ?? 'THEM'}
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="thinking of you…"
                maxLength={200}
                rows={3}
                className="w-full p-2 text-sm text-gray-700 resize-none focus:outline-none"
                style={{
                  background: '#FFF',
                  border: '2px dashed #E0CCFF',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => { playSound('ui_tap'); handleSendMessage() }}
                disabled={!text.trim() || sending}
                className="self-end px-4 py-2 text-white active:translate-y-[1px] disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #C084FC, #A78BFA)',
                  borderRadius: 4,
                  border: '2px solid #7C3AED',
                  boxShadow: '0 2px 0 #5B21B6',
                  fontFamily: '"Press Start 2P"',
                  fontSize: 7,
                }}
              >
                {sending ? '...' : 'SEND ✉'}
              </button>
            </div>
          ) : (
            <div className="px-3 py-3 flex flex-col gap-2">
              <p className="font-pixel text-amber-600 text-center" style={{ fontSize: 6 }}>
                PICK FROM YOUR FRIDGE
              </p>
              {giftableKeys.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-3">
                  Your fridge is empty. Buy something in the Kitchen shop first!
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {giftableKeys.map(key => {
                    const meta = FOOD_META[key]
                    const qty = myPile[key] ?? 0
                    return (
                      <button
                        key={key}
                        onClick={() => { playSound('ui_tap'); handleSendGift(key) }}
                        disabled={sending}
                        className="flex flex-col items-center gap-1 p-2 active:translate-y-[1px] disabled:opacity-50 transition-transform"
                        style={{
                          background: `${meta.color}18`,
                          border: `2px solid ${meta.color}66`,
                          borderRadius: 6,
                          boxShadow: `2px 2px 0 ${meta.color}44`,
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: `radial-gradient(circle at 35% 30%, ${meta.color}, ${meta.color}88)`,
                          border: `2px solid ${meta.color}`,
                        }} />
                        <span className="text-[10px] font-bold" style={{ color: meta.color }}>{meta.name}</span>
                        <span className="text-[9px] text-gray-500">×{qty}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </CloudShape>

        {toast && (
          <div className="px-3 py-1.5 text-white text-xs"
            style={{
              background: '#1F1F2E',
              borderRadius: 4,
              boxShadow: '2px 2px 0 rgba(0,0,0,0.4)',
            }}>
            {toast}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 6, height: 6,
        background: '#7C3AED',
        animation: `tcDotPulse 1.1s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  )
}

function TabButton({ active, onClick, label, color }: {
  active: boolean
  onClick: () => void
  label: string
  color: string
}) {
  return (
    <button
      onClick={() => { playSound('ui_tap'); onClick() }}
      className="px-3 py-1.5 transition-all active:translate-y-[1px]"
      style={{
        background: active ? color : '#FFF',
        color: active ? '#FFF' : color,
        border: `2px solid ${color}`,
        borderRadius: 4,
        boxShadow: active ? `0 2px 0 ${color}AA` : `0 2px 0 ${color}55`,
        fontFamily: '"Press Start 2P"',
        fontSize: 7,
        letterSpacing: 1,
      }}>
      {label}
    </button>
  )
}

function CloudPuff({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F5F0FF 100%)',
        border: '2px solid #E0CCFF',
        boxShadow: '1px 1px 0 #D0BBE8',
        ...style,
      }}
    />
  )
}

// A cloud-shaped container — three soft "bumps" on top via radial gradients
// + a rounded pill body. Either fixed-size (idle bubble) or fluid (expanded).
function CloudShape({ size, fullWidth, children }: {
  size: number | null
  fullWidth?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : size ?? 'auto',
        minHeight: size ?? undefined,
        background: '#FFFFFF',
        border: '2.5px solid #E0CCFF',
        borderRadius: 22,
        boxShadow: '3px 3px 0 #D0BBE8, 0 6px 18px rgba(120,90,200,0.18)',
        padding: size ? 0 : undefined,
        display: 'flex', alignItems: 'stretch', justifyContent: 'stretch',
      }}
    >
      {/* Top puff bumps for the cartoon-cloud silhouette */}
      <div style={{
        position: 'absolute',
        top: -8, left: '18%',
        width: 18, height: 18,
        background: '#FFFFFF',
        border: '2.5px solid #E0CCFF',
        borderRadius: '50%',
        zIndex: -1,
      }} />
      <div style={{
        position: 'absolute',
        top: -14, left: '42%',
        width: 22, height: 22,
        background: '#FFFFFF',
        border: '2.5px solid #E0CCFF',
        borderRadius: '50%',
        zIndex: -1,
      }} />
      <div style={{
        position: 'absolute',
        top: -10, right: '20%',
        width: 16, height: 16,
        background: '#FFFFFF',
        border: '2.5px solid #E0CCFF',
        borderRadius: '50%',
        zIndex: -1,
      }} />
      <div style={{
        flex: 1,
        width: '100%',
        minHeight: size ?? undefined,
      }}>
        {children}
      </div>
      <style jsx global>{`
        @keyframes tcDotPulse {
          0%, 100% { transform: translateY(0) scale(1);   opacity: 0.55; }
          50%      { transform: translateY(-2px) scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
