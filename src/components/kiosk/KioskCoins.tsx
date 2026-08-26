'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE TILL — tonight's takings, and the coins arriving in it.
// ──────────────────────────────────────────────────────────────────────────
// This is NOT your wallet. Money earned at the kiosk sits in the till until
// you close up, and only then does it follow you home — which is what makes
// closing a moment instead of a door, and what stops the kiosk quietly
// out-earning every game in the arcade.
//
// A payout you don't SEE arrive is just a number changing behind your back, so
// a paid order throws coins up from where your hands were into the pill.
//
// The trick that makes it read: the displayed total is the real total MINUS
// whatever is still in the air. The till is credited the instant you hand the
// bag over, but the number doesn't move until the coins land on it.
// ═══════════════════════════════════════════════════════════════════════════

import { useLayoutEffect, useRef, useState } from 'react'
import { IconCoin } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { STREAK_CAP, type Takings } from './kioskEconomy'
import type { Payout } from './useKioskShift'

/** Keep in sync with hudCoinFly's duration in globals.css. */
const FLY_MS = 780
/** Coins in the air. More than this and they stop reading as coins. */
const MAX_SPRITES = 8
const STAGGER = 52

interface Sprite { i: number; sdx: number; sdy: number; delay: number }

interface Props {
  paid: Payout
  till: Takings
  streak: number
  /** Nothing banked tonight — the pill says so instead of lying about it. */
  practice: boolean
}

export default function KioskCoins({ paid, till, streak, practice }: Props) {
  const reduced = useReducedMotion()

  const pillRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState(0)
  const [sprites, setSprites] = useState<Sprite[]>([])
  const [popKey, setPopKey] = useState(0)

  // LAYOUT effect, not a plain one: the till is credited in the same batch
  // that sets `paid`, so an effect that runs after paint would show the new
  // total for one frame, snap back to the old one, and count up again. The
  // kiosk interior only ever mounts after a tap, so there's no server render
  // to worry about.
  useLayoutEffect(() => {
    if (!paid) return

    if (reduced) {
      setPopKey(k => k + 1)
      return
    }

    const pill = pillRef.current
    if (!pill) return
    const r = pill.getBoundingClientRect()
    const toX = r.left + r.width / 2
    const toY = r.top + r.height / 2
    // They come off the counter in front of you — where the bag was, and
    // where your hands still are.
    const fromX = window.innerWidth / 2
    const fromY = window.innerHeight - 132

    const n = Math.min(MAX_SPRITES, Math.max(4, Math.round(paid.amount / 3)))
    setPending(paid.amount)
    setSprites(Array.from({ length: n }, (_, i) => ({
      i,
      sdx: fromX - toX + ((i % 3) - 1) * 30,
      sdy: fromY - toY + Math.floor(i / 3) * 16,
      delay: i * STAGGER,
    })))

    const lastDelay = (n - 1) * STAGGER
    // The total turns over when the middle of the stream hits, not when the
    // straggler does — waiting for the last coin reads as lag.
    const land = setTimeout(() => {
      setPending(0)
      setPopKey(k => k + 1)
      playSound('coin_ching2', { volume: 0.5 })
    }, FLY_MS + lastDelay / 2)
    const clear = setTimeout(() => setSprites([]), FLY_MS + lastDelay + 140)

    return () => {
      clearTimeout(land)
      clearTimeout(clear)
      setPending(0)
    }
  }, [paid, reduced])

  const total = till.base + till.tips
  const shown = Math.max(0, total - pending)

  return (
    <div className="absolute pointer-events-none" style={{
      top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 12, zIndex: 57,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5,
    }}>
      {/* Measured for the flight, so the coins know where they're going. */}
      <div ref={pillRef} style={{ position: 'relative' }}>
        <div key={popKey} className="font-pixel" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px 6px',
          background: 'rgba(14,10,8,0.82)',
          border: '2px solid rgba(245,156,69,0.5)',
          borderRadius: 9,
          boxShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 14px rgba(245,156,69,0.16)',
          backdropFilter: 'blur(3px)',
          fontSize: 9, letterSpacing: 0.5, color: '#FFD98A',
          animation: popKey ? 'hudNumPop 460ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
        }}>
          <IconCoin size={13} />
          {shown.toLocaleString()}
        </div>

        {sprites.map(s => (
          <span key={s.i} aria-hidden style={{
            position: 'absolute', left: '50%', top: '50%',
            marginLeft: -9, marginTop: -9,
            ['--sdx' as string]: `${s.sdx}px`,
            ['--sdy' as string]: `${s.sdy}px`,
            filter: 'drop-shadow(0 0 7px rgba(255,200,60,0.9))',
            animation: `hudCoinFly ${FLY_MS}ms cubic-bezier(0.45, 0, 0.75, 0.2) ${s.delay}ms both`,
          }}>
            <IconCoin size={18} />
          </span>
        ))}

        {/* What the last bag was worth, riding under the pill while it's in
            the air. */}
        {pending > 0 && (
          <span key={`p${paid?.id}`} className="font-pixel" style={{
            position: 'absolute', top: '100%', right: 2, marginTop: 5,
            whiteSpace: 'nowrap', fontSize: 8, color: '#FFC773',
            textShadow: '0 1px 0 rgba(0,0,0,0.7)',
            animation: 'kioskEarn 900ms ease-out both',
          }}>
            +{pending}
          </span>
        )}
      </div>

      {/* A run worth protecting. Only from two: one correct order in a row is
          just an order. */}
      {streak >= 2 && (
        <div key={streak} className="font-pixel" style={{
          padding: '4px 7px 3px',
          fontSize: 6, letterSpacing: 1,
          color: '#3A1B08', background: '#F5C049',
          border: '2px solid #7C4A12', borderRadius: 7,
          boxShadow: '0 2px 0 #B8862A',
          animation: 'hudNumPop 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {streak}{streak >= STREAK_CAP ? '+' : ''} IN A ROW
        </div>
      )}

      {practice && (
        <div className="font-pixel" style={{
          padding: '4px 7px 3px',
          fontSize: 5.5, letterSpacing: 1, color: 'rgba(255,231,196,0.7)',
          background: 'rgba(14,10,8,0.7)',
          border: '2px solid rgba(200,190,205,0.28)', borderRadius: 7,
        }}>
          PRACTICE
        </div>
      )}
    </div>
  )
}
