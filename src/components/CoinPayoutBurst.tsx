'use client'

// ─── CoinPayoutBurst ────────────────────────────────────────────────────────
// The payoff moment for a one-shot claim: the weekly Care Battle champion and
// the weekly arcade champion both credit their coins server-side and then hand
// the screen to this. Coins stream in from both edges of the viewport and
// converge on a gold counter that ticks 0 → the credited amount; when the
// count lands it calls onDone() so the host modal can close itself.
//
// Portaled to <body> so it paints ABOVE the z-120 modal and is never clipped
// by that modal's transform. Deliberately reuses the global hudCoinFly /
// hudNumPop keyframes so a claim reads like the arcade's GameCoinReward and
// the StatsHeader coin gains — one coin language across the app.
//
// Tap anywhere to skip: the coins are already banked before this mounts, so
// cutting the animation short can never cost the player anything.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCoin } from '@/components/PixelIcons'
import { playSound, playCoinTicks } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Props {
  /** Coins actually credited. */
  coins: number
  /** Fired once the counter has landed (or immediately, if reduced-motion). */
  onDone: () => void
}

const FLY_MS   = 780  // keep in sync with hudCoinFly's duration in globals.css
const COUNT_MS = 620  // counter tick-up
const HOLD_MS  = 620  // beat to read the total before handing back
const PER_SIDE = 6    // coins streaming in from each edge
const V_SPREAD = 44   // vertical fan height between coins on one side

interface Sprite { i: number; sdx: number; sdy: number; delay: number }

export default function CoinPayoutBurst({ coins, onDone }: Props) {
  const reduced = useReducedMotion()
  const [sprites, setSprites] = useState<Sprite[]>([])
  const [shown, setShown] = useState(0)
  const [popKey, setPopKey] = useState(0)

  // onDone is called from timers — hold it in a ref so a re-created callback
  // in the parent can't restart the whole sequence mid-flight.
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (reduced) {
      setShown(coins)
      const t = setTimeout(() => doneRef.current(), 900)
      return () => clearTimeout(t)
    }

    const vw = window.innerWidth
    const sp: Sprite[] = []
    for (let side = 0; side < 2; side++) {
      const fromLeft = side === 0
      for (let k = 0; k < PER_SIDE; k++) {
        const startX = fromLeft ? vw * 0.04 + (k % 2) * 28 : vw * 0.96 - (k % 2) * 28
        sp.push({
          i: side * PER_SIDE + k,
          sdx: startX - vw / 2,
          sdy: (k - (PER_SIDE - 1) / 2) * V_SPREAD,
          delay: k * 55 + (fromLeft ? 0 : 28),
        })
      }
    }
    setSprites(sp)
    playSound('coin_ching')
    const cancelTicks = playCoinTicks(5, FLY_MS)

    let cancelled = false
    let raf = 0
    const land = setTimeout(() => {
      if (cancelled) return
      setPopKey(k => k + 1)
      const t0 = performance.now()
      const tick = (now: number) => {
        if (cancelled) return
        const p = Math.min(1, (now - t0) / COUNT_MS)
        const eased = 1 - Math.pow(1 - p, 3)
        setShown(Math.round(coins * eased))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, FLY_MS)

    const clearSprites = setTimeout(
      () => { if (!cancelled) setSprites([]) },
      FLY_MS + (PER_SIDE - 1) * 55 + 240,
    )
    const finish = setTimeout(() => { if (!cancelled) doneRef.current() }, FLY_MS + COUNT_MS + HOLD_MS)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(land); clearTimeout(clearSprites); clearTimeout(finish)
      cancelTicks()
    }
  }, [coins, reduced])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="cpb-layer" onClick={() => doneRef.current()} role="status" aria-live="polite">
      <div className="cpb-glow" aria-hidden />

      {sprites.map(s => (
        <div key={s.i} aria-hidden className="cpb-coin"
          style={{
            ['--sdx' as string]: `${s.sdx}px`,
            ['--sdy' as string]: `${s.sdy}px`,
            animationDelay: `${s.delay}ms`,
          } as React.CSSProperties}>
          <div className="cpb-coin-inner"><IconCoin size={20} /></div>
        </div>
      ))}

      <div key={popKey} className="cpb-pill"
        style={{ animation: popKey ? 'hudNumPop 460ms cubic-bezier(0.16,1,0.3,1)' : undefined }}>
        <IconCoin size={20} />
        <span className="font-pixel cpb-amount">+{shown.toLocaleString()}</span>
      </div>
      <p className="font-pixel cpb-label">COINS CLAIMED</p>

      <style jsx>{`
        .cpb-layer {
          position: fixed;
          inset: 0;
          z-index: 140;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(1.5px);
          animation: cpbFade 200ms ease-out;
        }
        .cpb-glow {
          position: absolute;
          left: 50%; top: 50%;
          width: 340px; height: 340px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(251, 191, 36, 0.28) 0%, transparent 68%);
          pointer-events: none;
          animation: cpbGlow 1.6s ease-out forwards;
        }
        .cpb-coin {
          position: absolute;
          left: 50%; top: 50%;
          opacity: 0;
          will-change: transform, opacity;
          animation: hudCoinFly ${FLY_MS}ms cubic-bezier(0.45, 0, 0.75, 0.2) forwards;
          pointer-events: none;
        }
        .cpb-coin-inner {
          margin-left: -10px;
          margin-top: -10px;
          filter: drop-shadow(0 0 7px rgba(255, 200, 60, 0.9));
        }
        .cpb-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 9px 18px;
          background: linear-gradient(180deg, rgba(120, 53, 15, 0.85), rgba(67, 20, 7, 0.95));
          border: 2px solid #fbbf24;
          border-radius: 6px;
          box-shadow: 0 3px 0 #78350f, inset 0 1px 0 rgba(251, 191, 36, 0.4),
                      0 0 26px rgba(251, 191, 36, 0.45);
          transform-origin: center;
        }
        .cpb-amount {
          font-size: 22px;
          line-height: 1;
          color: #fde68a;
          letter-spacing: 1px;
          text-shadow: 0 2px 0 rgba(0, 0, 0, 0.65);
        }
        .cpb-label {
          position: relative;
          font-size: 7px;
          letter-spacing: 2.5px;
          color: #fcd34d;
          text-shadow: 0 0 8px rgba(251, 191, 36, 0.5);
        }
        @keyframes cpbFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cpbGlow {
          0%   { opacity: 0;    transform: translate(-50%, -50%) scale(0.5); }
          55%  { opacity: 0.35; transform: translate(-50%, -50%) scale(1);   }
          100% { opacity: 1;    transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </div>,
    document.body,
  )
}
