'use client'

// Comic-book thinking cloud that floats above Eren on the home screen.
// Three interaction states:
//
//   1. 'idle'    — a single small cloud with three pulsing dots and two
//                  trailing puffs leading down to Eren's head. Looks like
//                  he's thinking of someone.
//   2. 'split'   — tap the idle cloud and it splits in place into two
//                  smaller side-by-side clouds: ✉ message and 🎁 gift.
//   3. 'message' — opens the message composer modal.
//   4. 'gift'    — opens the gift picker modal.
//
// All persistence delegates to hooks (useCouple.sendMessage,
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

type Mode = 'idle' | 'split' | 'message' | 'gift'

export default function ThoughtCloud() {
  const { user, profile } = useAuth()
  const { partner, sendMessage } = useCouple()
  const { stats, giftFood } = useErenStats(profile?.household_id ?? null)

  const [mode, setMode] = useState<Mode>('idle')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

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
    setTimeout(() => setMode('idle'), 700)
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
    setTimeout(() => setMode('idle'), 800)
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE 1 — idle: single small cloud above Eren
  // ═══════════════════════════════════════════════════════════════════
  if (mode === 'idle') {
    return (
      <CloudAnchor>
        <button
          onClick={() => { playSound('ui_modal_open'); setMode('split') }}
          className="active:scale-95 transition-transform"
          style={{ background: 'transparent', border: 'none', padding: 0 }}
          aria-label="Open Eren's thought"
        >
          <ThinkBubble size={48}>
            <div className="flex items-center justify-center gap-[3px] h-full">
              <Dot delay={0} />
              <Dot delay={0.18} />
              <Dot delay={0.36} />
            </div>
          </ThinkBubble>
        </button>
      </CloudAnchor>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE 2 — split: two side-by-side mini clouds
  // ═══════════════════════════════════════════════════════════════════
  if (mode === 'split') {
    return (
      <>
        {/* tap-anywhere-else dismisses */}
        <div className="fixed inset-0 z-[5]" onClick={() => { playSound('ui_modal_close'); setMode('idle') }} />

        <CloudAnchor>
          <div className="flex items-center gap-3" style={{ animation: 'tcSplitIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <button
              onClick={() => { playSound('ui_tap'); setMode('message') }}
              className="active:scale-95 transition-transform"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              aria-label="Send a message"
            >
              <ThinkBubble size={52} tint="#A78BFA">
                <span style={{ fontSize: 22 }}>✉</span>
              </ThinkBubble>
            </button>
            <button
              onClick={() => { playSound('ui_tap'); setMode('gift') }}
              className="active:scale-95 transition-transform"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              aria-label="Send a gift"
            >
              <ThinkBubble size={52} tint="#F5C842">
                <span style={{ fontSize: 20 }}>🎁</span>
              </ThinkBubble>
            </button>
          </div>
        </CloudAnchor>

        <style jsx global>{`
          @keyframes tcSplitIn {
            0%   { transform: scale(0.4); opacity: 0; }
            60%  { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE 3 / 4 — composer modal (message or gift)
  // ═══════════════════════════════════════════════════════════════════
  const tint = mode === 'message' ? '#A78BFA' : '#F5C842'
  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={() => { playSound('ui_modal_close'); setMode('idle') }}
      />

      <div
        className="fixed left-1/2 z-[61] flex flex-col items-center gap-2 px-3"
        style={{ top: '20%', transform: 'translateX(-50%)', width: 'min(92vw, 360px)' }}
        onClick={e => e.stopPropagation()}
      >
        <ThinkBubble size={null} fullWidth tint={tint}>
          {noPartner ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-600">
                Invite your partner first so Eren can deliver this.
              </p>
            </div>
          ) : mode === 'message' ? (
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
                autoFocus
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
                  Your fridge is empty. Buy something in the Kitchen first!
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
        </ThinkBubble>

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

// CloudAnchor positions its child directly above Eren on the home screen.
// Eren sits at bottom: 10% with a ~200 px sprite, so its top edge lands
// around bottom: 38-42 % depending on viewport height. This anchors the
// thought to that band, centered horizontally.
function CloudAnchor({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute z-[4] pointer-events-none"
      style={{
        bottom: '44%',
        left: '50%',
        transform: 'translateX(-50%)',
        animation: 'tcDrift 3.6s ease-in-out infinite',
      }}
    >
      {/* trailing puffs leading down to Eren's head — a comic "thinking" tell */}
      <div className="absolute" style={{ left: '50%', bottom: -12, transform: 'translateX(-50%)' }}>
        <Puff size={12} />
      </div>
      <div className="absolute" style={{ left: '50%', bottom: -22, transform: 'translateX(-220%)' }}>
        <Puff size={7} />
      </div>

      <div className="relative pointer-events-auto">
        {children}
      </div>

      <style jsx>{`
        @keyframes tcDrift {
          0%, 100% { transform: translate(-50%, 0); }
          50%      { transform: translate(-50%, -4px); }
        }
      `}</style>
    </div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 5, height: 5,
        background: '#7C3AED',
        animation: 'tcDotPulse 1.1s ease-in-out infinite',
        animationDelay: `${delay}s`,
      }}
    />
  )
}

function Puff({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: '#FFFFFF',
        border: '2px solid #D8C8F0',
        boxShadow: '1px 1px 0 #BFA8E0',
      }}
    />
  )
}

// Comic-book "thinking" cloud — a rounded body with three soft bumps on top
// to give the cartoon-cloud silhouette. Size fixed (idle/split) or fluid
// (composer pane).
function ThinkBubble({ size, fullWidth, tint = '#D8C8F0', children }: {
  size: number | null
  fullWidth?: boolean
  tint?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : size ?? 'auto',
        height: size ?? 'auto',
        background: '#FFFFFF',
        border: `2.5px solid ${tint}`,
        borderRadius: 22,
        boxShadow: `3px 3px 0 ${tint}AA, 0 6px 18px rgba(120,90,200,0.18)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size ? 0 : undefined,
      }}
    >
      {/* Top puffs — three bumps for the cartoon cloud silhouette */}
      <span style={{
        position: 'absolute', top: -8, left: '18%',
        width: 14, height: 14,
        background: '#FFFFFF',
        border: `2.5px solid ${tint}`,
        borderRadius: '50%',
        zIndex: -1,
      }} />
      <span style={{
        position: 'absolute', top: -12, left: '44%',
        width: 18, height: 18,
        background: '#FFFFFF',
        border: `2.5px solid ${tint}`,
        borderRadius: '50%',
        zIndex: -1,
      }} />
      <span style={{
        position: 'absolute', top: -8, right: '20%',
        width: 12, height: 12,
        background: '#FFFFFF',
        border: `2.5px solid ${tint}`,
        borderRadius: '50%',
        zIndex: -1,
      }} />
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
