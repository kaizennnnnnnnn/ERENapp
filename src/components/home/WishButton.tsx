'use client'

// ─── Wish button (home row) ──────────────────────────────────────────────────
// Today's wish and the week's count, in the home row beside the quests. The
// wish cloud over the cat says what the wish is but leaves two minutes after
// it's granted; this stays: the star twinkles while the wish waits, the badge
// is how many of this week's seven were granted, and a tap folds out the wish
// itself.
//
// It used to be a chip in the top bar, which the Meadow bar dropped; it moved
// here with the rest of the living room's shortcuts, in their button style.
//
// In the Meadow look: a white circle with the gold star, the count as a ringed
// badge (pink while the wish waits, gold once it's granted), and the wish
// itself on a white card that folds out under the whole row, with the week as
// seven dots.
//
// Presentational: the page passes today's wish in.

import { useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { M, MeadowIcon, RoundButton, TYPE } from '@/components/meadow'
import HudBadge, { HUD_BUTTON } from './HudBadge'

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
    // Not relative: the card is placed against home's row (HomeHud), so it
    // spans the row instead of hanging off this one small button.
    <div ref={boxRef} className="flex-shrink-0">
      <RoundButton surface="art" size={HUD_BUTTON} ariaLabel={label} expanded={open}
        onClick={() => { playSound(open ? 'ui_modal_close' : 'ui_tap'); setOpen(o => !o) }}
        className="home-nav-pop" style={{ position: 'relative', animationDelay: '0.18s' }}>
        {/* Twinkles while the wish waits; holds still once it's granted.
            Set a little down and left, out from under the wide badge. */}
        <span style={{ display: 'block', lineHeight: 0, transform: 'translate(-3px, 4px)' }}>
          <span style={{
            display: 'block', lineHeight: 0,
            animation: granted ? undefined : 'hudWishTwinkle 2.4s steps(1, end) infinite',
          }}>
            <MeadowIcon name="star" size={18} />
          </span>
        </span>
        <HudBadge bg={granted ? M.coin : M.love} ink={granted ? M.text : '#FFFFFF'}>{weekCount}/7</HudBadge>
      </RoundButton>

      {open && (
        <div role="dialog" aria-label="Today's wish" className="absolute z-20"
          style={{
            top: 'calc(100% + 10px)', left: 0, right: 0,
            padding: '14px 16px 16px', borderRadius: 20,
            background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
            animation: 'wishButtonFold 0.18s steps(2) both',
          }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <MeadowIcon name="star" size={16} />
            <span style={{ ...TYPE.label, color: granted ? M.leafInk : M.label }}>
              {granted ? 'Wish granted' : cat.t("{name}'s wish today")}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.35, fontWeight: 700, color: granted ? M.text2 : M.text }}>
            {text}
          </p>
          <div className="flex items-center" style={{ marginTop: 12, gap: 10 }}>
            <span aria-hidden className="flex" style={{ gap: 4 }}>
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} style={{ width: 10, height: 10, borderRadius: 999, background: i < weekCount ? M.coin : M.track }} />
              ))}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>
              {weekCount} of 7 this week
            </span>
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
