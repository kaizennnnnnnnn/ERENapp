'use client'

import { useEffect } from 'react'
import { format, isToday } from 'date-fns'
import type { JournalMessage } from '@/types'
import { FOOD_META } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { IconGift, IconFridge, IconHeart } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useCat } from '@/hooks/useCat'

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
// ────────────────────────────────────────────────────────────────────────────

/** Past this many, the tray stops listing and points at the board. Two people
 *  will basically never hit it; a long absence should not produce a wall. */
const MAX_LISTED = 6

/** Anything from today is just a time -- printing "SUN 4:03 PM" on a gift sent
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

  useEffect(() => { playSound('gift_open') }, [])

  const listed = gifts.slice(0, MAX_LISTED)
  const hidden = gifts.length - listed.length
  const many   = gifts.length > 1

  const anim = (kf: string, rest: string) => (reduced ? undefined : `${kf} ${rest}`)

  function close() {
    playSound('ui_modal_close')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(5,5,7,0.72)', padding: 20 }}
      onClick={close}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 336,
          maxHeight: '84vh',
          overflowY: 'auto',
          padding: '30px 16px 16px',
          background: 'linear-gradient(180deg, #2E1A52 0%, #1C1035 100%)',
          border: '3px solid #6D28D9',
          boxShadow: '4px 4px 0 #0B0715, 0 0 26px 2px rgba(167,139,250,0.28)',
          animation: anim('giftTrayIn', '0.32s cubic-bezier(0.34,1.56,0.64,1) both'),
        }}
      >
        {/* CRT scanlines. */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.20) 2px 3px)',
        }} />
        {([['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']] as const).map(([v, h]) => (
          <span key={`${v}${h}`} aria-hidden style={{
            position: 'absolute', [v]: 5, [h]: 5, width: 3, height: 3, background: '#F5C542',
          }} />
        ))}

        {/* ── Eren, holding the delivery ── */}
        <div className="relative flex justify-center" style={{ marginBottom: 12 }}>
          <div className="relative" style={{ animation: anim('giftErenIn', '0.5s cubic-bezier(0.34,1.56,0.64,1) both') }}>
            {/* image-rendering stays `auto`: this is a hi-res sprite scaled
                down, and `pixelated` crawls a seam along its edge. */}
            <img
              src="/erenGood.png" alt="" draggable={false}
              style={{ width: 92, height: 92, objectFit: 'contain', imageRendering: 'auto', display: 'block' }}
            />
            <div
              className="absolute flex items-center justify-center"
              style={{
                top: -2, right: -6, width: 30, height: 30,
                background: '#FF6B9D', border: '2px solid #0B0715', borderRadius: '50%',
                animation: anim('giftBadgePulse', '2s ease-in-out infinite'),
              }}
            >
              <IconGift size={15} />
            </div>
          </div>
        </div>

        <p className="font-pixel text-center" style={{ fontSize: 9, lineHeight: 1.7, letterSpacing: 1, color: '#FFD9E8' }}>
          {many ? `${gifts.length} GIFTS FOR YOU` : 'A GIFT FOR YOU'}
        </p>
        <p className="text-center flex items-center justify-center gap-1.5"
          style={{ fontSize: 12, lineHeight: 1.6, color: '#C4B5FD', margin: '8px 0 16px' }}>
          {fromName} left {many ? 'these' : 'this'} with {cat.name}
          <IconHeart size={11} />
        </p>

        {/* ── The tray ── */}
        <div className="flex flex-col" style={{ gap: 8 }}>
          {listed.map((g, i) => {
            const item = g.gift_item
            if (!item) return null
            const meta = FOOD_META[item.key]
            const note = g.message?.trim()
            return (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: 9,
                background: 'rgba(255,255,255,0.045)',
                border: '2px solid rgba(167,139,250,0.30)',
                boxShadow: '2px 2px 0 rgba(11,7,21,0.55)',
                animation: anim('giftCardIn', `0.3s cubic-bezier(0.34,1.56,0.64,1) ${0.16 + i * 0.07}s both`),
              }}>
                <div className="flex-shrink-0 flex items-center justify-center" style={{
                  width: 52, height: 52,
                  background: `${meta.color}1F`,
                  border: `2px dashed ${meta.color}99`,
                }}>
                  <FoodIcon id={item.key} size={42} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-pixel" style={{ fontSize: 8, lineHeight: 1.5, color: '#FFD9E8' }}>
                    {item.qty > 1 ? `${item.qty} x ` : ''}{meta.name.toUpperCase()}
                  </p>
                  {note && (
                    <p style={{
                      fontSize: 11, lineHeight: 1.5, color: '#C4B5FD', marginTop: 4,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      &ldquo;{note}&rdquo;
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: '#8B7BA8', marginTop: 4 }}>
                    {when(g.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {hidden > 0 && (
          <p className="text-center" style={{ fontSize: 11, color: '#8B7BA8', marginTop: 10 }}>
            and {hidden} more, waiting on your note board
          </p>
        )}

        {/* Say where it all went. The qty moved at send time, so the fridge is
            already stocked — this is the only place that tells them. */}
        <p className="font-pixel flex items-center justify-center gap-1.5"
          style={{
            fontSize: 6, letterSpacing: 1, color: '#A78BFA',
            marginTop: 16, paddingTop: 11, borderTop: '1px dashed rgba(167,139,250,0.3)',
          }}>
          <IconFridge size={11} />
          {many ? 'ALL OF IT IS ALREADY IN YOUR FRIDGE' : 'ALREADY IN YOUR FRIDGE'}
        </p>

        <button
          type="button"
          onClick={close}
          style={{
            display: 'block', width: '100%', marginTop: 13, padding: '11px 0',
            fontFamily: '"Press Start 2P", monospace', fontSize: 8, letterSpacing: 1,
            color: '#1C1035', background: '#F5C542',
            border: '2px solid #0B0715', boxShadow: '3px 3px 0 #0B0715', cursor: 'pointer',
          }}
        >
          THANK YOU
        </button>
      </div>
    </div>
  )
}
