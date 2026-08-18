'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE TILL — what you're worth, and the coins arriving in it.
// ──────────────────────────────────────────────────────────────────────────
// You're working a counter for money, so the money has to be on screen the
// whole time — on every wall, not just the one with the customer at it. And a
// payout you don't SEE arrive is just a number changing behind your back, so
// a paid wrap throws coins up from where your hands were into the pill.
//
// The trick that makes it read: the displayed total is the real total MINUS
// whatever is still in the air. The profile is credited the instant you hand
// the wrap over, but the number doesn't move until the coins land on it.
// ═══════════════════════════════════════════════════════════════════════════

import { useLayoutEffect, useRef, useState } from 'react'
import { IconCoin } from '@/components/PixelIcons'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { Payout } from './useKioskShift'

/** Keep in sync with hudCoinFly's duration in globals.css. */
const FLY_MS = 780
/** Coins in the air. More than this and they stop reading as coins. */
const MAX_SPRITES = 8
const STAGGER = 52

interface Sprite { i: number; sdx: number; sdy: number; delay: number }

export default function KioskCoins({ paid }: { paid: Payout }) {
  const { coins } = useTasks()
  const reduced = useReducedMotion()

  const pillRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState(0)
  const [sprites, setSprites] = useState<Sprite[]>([])
  const [popKey, setPopKey] = useState(0)

  // LAYOUT effect, not a plain one: the profile is credited in the same batch
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
    // They come off the counter in front of you — where the wrap was, and
    // where your hands still are.
    const fromX = window.innerWidth / 2
    const fromY = window.innerHeight - 132

    const n = Math.min(MAX_SPRITES, Math.max(4, paid.amount))
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

  const shown = Math.max(0, coins - pending)

  return (
    <div className="absolute pointer-events-none" style={{
      top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 12, zIndex: 57,
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

        {/* What the wrap was worth, riding under the pill while it's in the
            air. */}
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
    </div>
  )
}
