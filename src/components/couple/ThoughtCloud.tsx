'use client'

// Comic-book thinking cloud that floats above Eren on the home screen.
// Four interaction states:
//
//   1. 'idle'    — a small scalloped cloud with three pulsing dots and two
//                  trailing puffs leading down to Eren's head. Tap to open.
//   2. 'split'   — the cloud splits in place into two side-by-side mini
//                  clouds: ✉ message / 🎁 gift. Pick one.
//   3. 'message' — full message composer modal.
//   4. 'gift'    — full gift picker modal.
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

// The visual band where the cloud floats — % from the bottom of the viewport.
// Eren sits at bottom: 10 % with a 200 px sprite, so his head is roughly at
// bottom: 36-40 % depending on viewport height. We sit the cloud just above
// his head (lower number = closer to him).
const CLOUD_BOTTOM = '40%'

// z-index stack: split overlay sits above the room HUD but below full modals.
const Z_BACKDROP = 55
const Z_CLOUD = 56
const Z_MODAL = 61

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
      <CloudAnchor zIndex={4}>
        <button
          onClick={() => { playSound('ui_modal_open'); setMode('split') }}
          className="active:scale-95 transition-transform pointer-events-auto"
          style={{ background: 'transparent', border: 'none', padding: 0 }}
          aria-label="Open Eren's thought"
        >
          <ThinkBubble width={72} height={44}>
            <div className="flex items-center justify-center gap-[3px] h-full">
              <Dot delay={0} />
              <Dot delay={0.18} />
              <Dot delay={0.36} />
            </div>
          </ThinkBubble>
        </button>
        <TrailingPuffs />
      </CloudAnchor>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE 2 — split: two side-by-side mini clouds
  //
  // The backdrop sits at Z_BACKDROP; the cloud at Z_CLOUD (one higher) so
  // clicks on the message/gift buttons reach them instead of the backdrop.
  // ═══════════════════════════════════════════════════════════════════
  if (mode === 'split') {
    return (
      <>
        <div
          className="fixed inset-0"
          style={{ zIndex: Z_BACKDROP, background: 'rgba(0,0,0,0.18)' }}
          onClick={() => { playSound('ui_modal_close'); setMode('idle') }}
        />

        <CloudAnchor zIndex={Z_CLOUD}>
          <div
            className="flex items-center gap-3"
            style={{ animation: 'tcSplitIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); playSound('ui_tap'); setMode('message') }}
              className="active:scale-95 transition-transform pointer-events-auto"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              aria-label="Send a message"
            >
              <ThinkBubble width={64} height={56} tint="#A78BFA">
                <span style={{ fontSize: 22 }}>✉</span>
              </ThinkBubble>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); playSound('ui_tap'); setMode('gift') }}
              className="active:scale-95 transition-transform pointer-events-auto"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              aria-label="Send a gift"
            >
              <ThinkBubble width={64} height={56} tint="#F5C842">
                <span style={{ fontSize: 20 }}>🎁</span>
              </ThinkBubble>
            </button>
          </div>
          <TrailingPuffs />
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
        className="fixed inset-0"
        style={{ zIndex: Z_MODAL - 1, background: 'rgba(0,0,0,0.35)' }}
        onClick={() => { playSound('ui_modal_close'); setMode('idle') }}
      />

      <div
        className="fixed left-1/2 flex flex-col items-center gap-2 px-3"
        style={{ top: '20%', transform: 'translateX(-50%)', width: 'min(92vw, 360px)', zIndex: Z_MODAL }}
        onClick={e => e.stopPropagation()}
      >
        <ThinkBubble width={null} height={null} fullWidth tint={tint}>
          {noPartner ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-600">
                Invite your partner first so Eren can deliver this.
              </p>
            </div>
          ) : mode === 'message' ? (
            <div className="px-4 py-3 flex flex-col gap-2 w-full">
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
            <div className="px-3 py-3 flex flex-col gap-2 w-full">
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

// CloudAnchor centers its child horizontally just above Eren. Fixed-position
// so it stays visible above any overlays the parent might add.
function CloudAnchor({ children, zIndex }: { children: React.ReactNode; zIndex: number }) {
  return (
    <div
      className="fixed pointer-events-none"
      style={{
        bottom: CLOUD_BOTTOM,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex,
        animation: 'tcDrift 3.6s ease-in-out infinite',
      }}
    >
      {children}
      <style jsx>{`
        @keyframes tcDrift {
          0%, 100% { transform: translate(-50%, 0); }
          50%      { transform: translate(-50%, -4px); }
        }
      `}</style>
    </div>
  )
}

// Two trailing puffs that lead down toward Eren's head — the visual cue
// that makes the cloud read as "thinking" instead of "speaking".
function TrailingPuffs() {
  return (
    <>
      <div className="absolute" style={{ left: '50%', bottom: -14, transform: 'translateX(-50%)' }}>
        <Puff size={11} />
      </div>
      <div className="absolute" style={{ left: '50%', bottom: -26, transform: 'translateX(-180%)' }}>
        <Puff size={6} />
      </div>
    </>
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

// Scalloped comic-cloud bubble. Eight outer puffs (3 top, 1 each side, 3
// bottom-corners + bottom edge) give the fluffy silhouette. The body is a
// rounded pill that can be sized fixed (idle / split) or fluid (composer).
function ThinkBubble({ width, height, fullWidth, tint = '#D8C8F0', children }: {
  width: number | null
  height: number | null
  fullWidth?: boolean
  tint?: string
  children: React.ReactNode
}) {
  const FILL = '#FFFFFF'
  const stroke = tint
  return (
    <div
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : width ?? 'auto',
        height: height ?? 'auto',
        background: FILL,
        border: `2.5px solid ${stroke}`,
        borderRadius: 28,
        boxShadow: `3px 3px 0 ${stroke}AA, 0 6px 18px rgba(120,90,200,0.18)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: width ? 0 : undefined,
      }}
    >
      {/* TOP — three bumps */}
      <Bump style={{ top: -10, left: '14%', width: 16, height: 16 }} fill={FILL} stroke={stroke} />
      <Bump style={{ top: -14, left: '40%', width: 22, height: 22 }} fill={FILL} stroke={stroke} />
      <Bump style={{ top: -10, right: '14%', width: 16, height: 16 }} fill={FILL} stroke={stroke} />

      {/* SIDES — one bump each */}
      <Bump style={{ left: -8, top: '38%', width: 14, height: 14 }} fill={FILL} stroke={stroke} />
      <Bump style={{ right: -8, top: '38%', width: 14, height: 14 }} fill={FILL} stroke={stroke} />

      {/* BOTTOM — two small bumps so the underside also looks fluffy */}
      <Bump style={{ bottom: -8, left: '22%', width: 13, height: 13 }} fill={FILL} stroke={stroke} />
      <Bump style={{ bottom: -8, right: '22%', width: 13, height: 13 }} fill={FILL} stroke={stroke} />

      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
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

function Bump({ style, fill, stroke }: { style: React.CSSProperties; fill: string; stroke: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        background: fill,
        border: `2.5px solid ${stroke}`,
        borderRadius: '50%',
        zIndex: 0,
        ...style,
      }}
    />
  )
}
