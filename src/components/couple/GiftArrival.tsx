'use client'

import { useEffect, useId, useRef } from 'react'
import { format, isToday } from 'date-fns'
import type { JournalMessage } from '@/types'
import { FOOD_META } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useCat } from '@/hooks/useCat'
import { M, MeadowIcon, PrimaryButton, TINT, TYPE } from '@/components/meadow'

// ────────────────────────────────────────────────────────────────────────────
// The welcome-back tray.
//
// A food gift already moves into the recipient's fridge the moment it is sent,
// and it gets pinned to the note board — but the only thing that ANNOUNCED it
// was ErenMessagePopup, which fires off the realtime INSERT and therefore only
// ever reaches someone who is already in the app. Anything sent while they
// were away landed in total silence: they had to go looking at the board to
// find out they had been given something.
//
// So this runs on open instead, and it takes the whole batch at once rather
// than queueing one popup per gift — being handed three things is a nicer
// moment than being interrupted three times.
//
// In the Meadow look, like the daily fortune and the weekly results: a white
// card over a dimmed room, the cat holding the delivery on a pink stage, the
// gifts as soft rows, and the one leaf button.
// ────────────────────────────────────────────────────────────────────────────

/** Past this many, the tray stops listing and points at the board. Two people
 *  will basically never hit it; a long absence should not produce a wall. */
const MAX_LISTED = 6

/** Anything from today is just a time -- printing "Sun 4:03 PM" on a gift sent
 *  this afternoon reads as older than it is. Older than today keeps the day. */
function when(iso: string): string {
  const d = new Date(iso)
  return format(d, isToday(d) ? 'h:mm a' : 'EEE h:mm a')
}

interface Props {
  /** Oldest first — the order they were given. */
  gifts: JournalMessage[]
  /** The partner's display name, already trimmed to a first name by the caller. */
  fromName: string
  onClose: () => void
}

export default function GiftArrival({ gifts, fromName, onClose }: Props) {
  const reduced = useReducedMotion()
  const cat = useCat()
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => { playSound('gift_open') }, [])

  const listed = gifts.slice(0, MAX_LISTED)
  const hidden = gifts.length - listed.length
  const many   = gifts.length > 1

  const anim = (kf: string, rest: string) => (reduced ? undefined : `${kf} ${rest}`)

  function close() {
    playSound('ui_modal_close')
    onClose()
  }

  // Focus the card so a screen reader lands on it; Escape closes like a tap
  // outside does.
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="meadow-root"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 70, padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(47, 43, 40, 0.36)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, maxHeight: '86vh', overflowY: 'auto', boxSizing: 'border-box',
          borderRadius: 28, background: '#FFFFFF', padding: '20px 20px 18px', outline: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: anim('giftCardPop', '0.28s cubic-bezier(0.34, 1.4, 0.64, 1) both'),
        }}
      >
        {/* ── The cat, holding the delivery ── */}
        <div style={{
          position: 'relative', width: '100%', boxSizing: 'border-box', borderRadius: 22,
          background: TINT.love, padding: '14px 0 10px', display: 'flex', justifyContent: 'center',
        }}>
          <div style={{ position: 'relative', animation: anim('giftCatIn', '0.5s cubic-bezier(0.34,1.56,0.64,1) both') }}>
            {/* image-rendering stays `auto`: this is a hi-res sprite scaled
                down, and `pixelated` crawls a seam along its edge. */}
            <img
              src="/erenGood.png" alt="" draggable={false}
              style={{ width: 96, height: 96, objectFit: 'contain', imageRendering: 'auto', display: 'block' }}
            />
            <span aria-hidden style={{
              position: 'absolute', top: -2, right: -10, width: 36, height: 36, borderRadius: 999,
              background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: anim('giftBadgeHop', '1.8s ease-in-out infinite'),
            }}>
              <MeadowIcon name="gift" size={22} />
            </span>
          </div>
        </div>

        <h2 id={titleId} style={{ margin: '16px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em', textAlign: 'center' }}>
          {many ? `${gifts.length} gifts for you` : 'A gift for you'}
        </h2>
        <p className="flex items-center justify-center" style={{
          margin: '6px 0 0', gap: 6, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center',
        }}>
          {fromName} left {many ? 'these' : 'this'} with {cat.name}
          <MeadowIcon name="heart" size={16} />
        </p>

        {/* ── The tray ── */}
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listed.map((g, i) => {
            const item = g.gift_item
            if (!item) return null
            const meta = FOOD_META[item.key]
            const note = g.message?.trim()
            return (
              <li key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, background: M.soft,
                animation: anim('giftRowIn', `0.3s cubic-bezier(0.34,1.56,0.64,1) ${0.16 + i * 0.07}s both`),
              }}>
                <span className="flex-shrink-0 flex items-center justify-center" style={{
                  width: 52, height: 52, borderRadius: 16, background: '#FFFFFF',
                }}>
                  <FoodIcon id={item.key} size={42} />
                </span>
                <span className="min-w-0 flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 800, overflowWrap: 'anywhere' }}>
                    {item.qty > 1 ? `${item.qty} × ` : ''}{meta.name}
                  </span>
                  {note && (
                    <span style={{
                      fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      &ldquo;{note}&rdquo;
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: M.faint }}>{when(g.created_at)}</span>
                </span>
              </li>
            )
          })}
        </ul>

        {hidden > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 600, color: M.text2, textAlign: 'center' }}>
            and {hidden} more, waiting on your note board
          </p>
        )}

        {/* Say where it all went. The qty moved at send time, so the fridge is
            already stocked — this is the only place that tells them. */}
        <p className="flex items-center justify-center" style={{
          margin: '14px 0 0', gap: 6, padding: '6px 12px', borderRadius: 999, background: TINT.leaf,
          ...TYPE.label, fontSize: 11, color: M.leafInk,
        }}>
          <MeadowIcon name="check" size={14} color={M.leaf} />
          {many ? 'All of it is in your fridge' : 'Already in your fridge'}
        </p>

        <PrimaryButton onClick={close} style={{ marginTop: 16 }}
          icon={<MeadowIcon name="heart" size={20} color="#FFFFFF" mono />}>
          Thank you
        </PrimaryButton>
      </div>

      {/* A plain <style>: these names come from inline styles, which only
          reach global keyframes. */}
      <style>{`
        @keyframes giftCardPop {
          0%   { transform: scale(0.94) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes giftCatIn {
          0%   { transform: translateY(14px) scale(0.85); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes giftBadgeHop {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50%      { transform: translateY(-4px) rotate(6deg); }
        }
        @keyframes giftRowIn {
          0%   { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
