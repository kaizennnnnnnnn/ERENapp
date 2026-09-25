'use client'

// ─── Wish button (home row) ──────────────────────────────────────────────────
// Today's wish and the week's count, in the home row beside the quests. The
// wish cloud over the cat says what the wish is but leaves two minutes after
// it's granted; this stays: the star twinkles while the wish waits and glows
// gold once it's granted, the badge is how many of this week's seven were
// granted, and a tap folds out the wish itself.
//
// It used to be a chip in the top bar, which the Meadow bar dropped; it moved
// here with the rest of the living room's shortcuts, in their button style.
//
// Presentational: the page passes today's wish in.

import { useEffect, useRef, useState } from 'react'
import { IconWish } from '@/components/PixelIcons'
import { OBSIDIAN_FACE, PINK_HI, Rivets, accentA, cuteBtn, CuteIcon } from '@/components/obsidian'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'

export interface WishButtonProps {
  text: string
  granted: boolean
  /** Wishes granted this week, of seven. */
  weekCount: number
}

export default function WishButton({ text, granted, weekCount }: WishButtonProps) {
  const [open, setOpen] = useState(false)
  const cat = useCat()
  const boxRef = useRef<HTMLDivElement>(null)

  // Close on a tap anywhere else. ref.contains, not stopPropagation: React's
  // listeners share `document` here, so a stopped event still reaches this.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        playSound('ui_modal_close')
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const label = `${granted ? "Today's wish granted" : "Today's wish"}, ${weekCount} of 7 this week`

  return (
    <div ref={boxRef} className="relative flex-shrink-0">
      <button type="button" aria-label={label} aria-expanded={open}
        onClick={() => { playSound(open ? 'ui_modal_close' : 'ui_tap'); setOpen(o => !o) }}
        className="home-nav-pop w-8 h-8 relative flex items-center justify-center active:scale-90 transition-transform"
        style={{ ...cuteBtn(granted ? '251,214,120' : '255,198,216'), animationDelay: '0.18s' }}>
        {/* Twinkles while the wish waits; breathes a warm gold once granted. */}
        <span style={{
          display: 'block', lineHeight: 0, transformOrigin: 'center',
          animation: granted ? 'hudWishGranted 2.4s ease-in-out infinite' : 'hudWishTwinkle 1.8s ease-in-out infinite',
        }}>
          <CuteIcon><IconWish size={18} /></CuteIcon>
        </span>
        {/* This week's count, gold once today's is in. */}
        <span className="absolute -top-1 -right-1 flex items-center justify-center font-pixel"
          style={{
            minWidth: 16, height: 16, padding: '0 3px', borderRadius: 6, border: '2px solid #050507',
            background: granted ? '#F5C842' : '#FF6B9D',
            boxShadow: granted ? '0 0 5px rgba(245,200,66,0.65)' : '0 0 4px rgba(255,107,157,0.6)',
            color: granted ? '#3A2400' : '#FFFFFF', fontSize: 5,
          }}>{weekCount}/7</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Today's wish" className="absolute z-20"
          style={{
            top: 'calc(100% + 6px)', right: 0, width: 220,
            ...OBSIDIAN_FACE, padding: 10,
            animation: 'wishButtonFold 0.18s steps(2) both',
          }}>
          <Rivets inset={3} />
          <div className="flex items-center gap-2 mb-2">
            <IconWish size={12} />
            <span className="font-pixel" style={{ fontSize: 6, color: PINK_HI, letterSpacing: 1.5, overflowWrap: 'anywhere' }}>
              {granted ? 'WISH GRANTED' : cat.t("{NAME}'S WISH TODAY")}
            </span>
          </div>
          <p className="font-pixel" style={{
            fontSize: 7, color: '#FDF6FF', lineHeight: 1.6, margin: 0,
            textDecoration: granted ? 'line-through' : 'none', opacity: granted ? 0.6 : 1,
          }}>{text}</p>
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${accentA(0.2)}` }}>
            <span className="font-pixel" style={{ fontSize: 6, color: '#FFD700' }}>{weekCount}/7 this week</span>
          </div>
        </div>
      )}

      {/* Global on purpose: the fold is named from an inline style, and a
          scoped styled-jsx keyframe never resolves there. */}
      <style jsx global>{`
        @keyframes wishButtonFold {
          0%   { opacity: 0; transform: translateY(-4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
