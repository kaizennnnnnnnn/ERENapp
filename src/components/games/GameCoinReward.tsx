'use client'

// ─── GameCoinReward ─────────────────────────────────────────────────────────
// Drop-in finish-screen reward badge for every minigame. Reuses the HUD coin
// animation language (global @keyframes hudCoinFly / hudNumPop) but cranks it
// up: a stream of coins flies in from the LEFT and RIGHT edges of the screen
// and converges into an on-screen coin counter pill, which then pops and ticks
// the total up as they land — so the player always SEES what they earned land
// in their counter. The StatsHeader is hidden during games, so this stands in
// for it on the result screen.
//
// The flight layer is portaled to <body> so it spans the whole viewport and is
// never clipped by a transformed game overlay. When Eren is too exhausted to
// award coins (energy < 30), shows a sleepy "rest first" card instead.
//
// Meadow look: it sits inside the white result card (GameChrome), so the
// counter is a soft pill with the coin and the balance, "+N coins" an amber
// tag under it, and the tired card a soft row.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCoin } from '@/components/PixelIcons'
import { useTasks } from '@/contexts/TaskContext'
import { useCat } from '@/hooks/useCat'
import { playSound, playCoinTicks } from '@/lib/sounds'

interface Props {
  coins: number
  blocked?: boolean
}

const COIN_FLY_MS = 780 // keep in sync with the hudCoinFly duration in the CSS below
const PER_SIDE = 5       // coins streaming in from each edge
const V_SPREAD = 46      // vertical fan height between coins on a side

interface Sprite { i: number; sdx: number; sdy: number; tx: number; ty: number; delay: number }

export default function GameCoinReward({ coins, blocked = false }: Props) {
  const { coins: balance } = useTasks()
  const cat = useCat()

  // Snapshot the post-award total once so the pill counts up from
  // (total − earned) → total regardless of when addCoins' state flush lands.
  const targetRef = useRef<number | null>(null)
  if (targetRef.current === null) targetRef.current = balance
  const target = targetRef.current ?? 0
  const startBal = Math.max(0, target - coins)

  const pillRef = useRef<HTMLDivElement>(null)
  const [sprites, setSprites] = useState<Sprite[]>([])
  const [shownBal, setShownBal] = useState(startBal)
  const [popKey, setPopKey] = useState(0)

  useEffect(() => {
    if (blocked || coins <= 0) { setShownBal(target); return }
    const pill = pillRef.current
    if (!pill || typeof window === 'undefined') { setShownBal(target); return }

    const pr = pill.getBoundingClientRect()
    if (pr.width === 0) { setShownBal(target); return }
    const vw = window.innerWidth
    // Counter centre in viewport coords (the portal layer is fixed at <body>).
    const tx = pr.left + pr.width / 2
    const ty = pr.top + pr.height / 2

    const sp: Sprite[] = []
    for (let side = 0; side < 2; side++) {
      const fromLeft = side === 0
      for (let k = 0; k < PER_SIDE; k++) {
        const startX = fromLeft ? vw * 0.05 + (k % 2) * 26 : vw * 0.95 - (k % 2) * 26
        const startY = ty + (k - (PER_SIDE - 1) / 2) * V_SPREAD
        sp.push({
          i: side * PER_SIDE + k,
          tx, ty,
          sdx: startX - tx,
          sdy: startY - ty,
          delay: k * 60 + (fromLeft ? 0 : 30),
        })
      }
    }
    setSprites(sp)
    playSound('coin_ching')

    // Ticks land with the coins, running under the balance's count-up so the
    // number climbing is audible (the spawn sound above is the launch).
    const cancelTicks = playCoinTicks(4, COIN_FLY_MS)

    let cancelled = false
    let raf = 0
    const land = setTimeout(() => {
      if (cancelled) return
      setPopKey(k => k + 1)
      const t0 = performance.now()
      const DUR = 560
      const tick = (now: number) => {
        if (cancelled) return
        const p = Math.min(1, (now - t0) / DUR)
        const eased = 1 - Math.pow(1 - p, 3)
        setShownBal(Math.round(startBal + (target - startBal) * eased))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, COIN_FLY_MS)
    const maxDelay = (PER_SIDE - 1) * 60 + 30
    const clear = setTimeout(() => { if (!cancelled) setSprites([]) }, COIN_FLY_MS + maxDelay + 200)

    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(land); clearTimeout(clear); cancelTicks() }
  }, [blocked, coins, startBal, target])

  return (
    <>
      {blocked ? (
        <div className="gcr-tired" role="status">
          <div className="gcr-zzz" aria-hidden>
            <span style={{ animationDelay: '0s' }}>z</span>
            <span style={{ animationDelay: '0.2s' }}>z</span>
            <span style={{ animationDelay: '0.4s' }}>z</span>
          </div>
          <span className="gcr-tired-title">{cat.t("{name}'s too tired")}</span>
          <span className="gcr-tired-sub">Let {cat.p.him} rest to earn coins</span>
        </div>
      ) : (
        <div className="gcr-wrap">
          {/* Coin counter pill — the coins fly in from both sides into this. */}
          <div key={popKey} ref={pillRef} className="gcr-pill"
            style={{ animation: popKey ? 'hudNumPop 450ms cubic-bezier(0.16,1,0.3,1)' : undefined }}>
            <div className="gcr-coin-face">
              <IconCoin size={20} />
              <span aria-hidden className="gcr-coin-shine" />
            </div>
            <span className="gcr-balance">{shownBal.toLocaleString()}</span>
          </div>
          <div className="gcr-plus">+{coins} coins</div>
        </div>
      )}

      {/* Flight layer — portaled to <body>; coins stream from both screen edges
          into the pill using the global hudCoinFly keyframe. */}
      {!blocked && sprites.length > 0 && typeof document !== 'undefined' && createPortal(
        <div aria-hidden className="gcr-fly-layer">
          {sprites.map(s => (
            <div key={s.i} className="gcr-fly-coin"
              style={{
                left: s.tx, top: s.ty,
                ['--sdx' as string]: `${s.sdx}px`,
                ['--sdy' as string]: `${s.sdy}px`,
                animationDelay: `${s.delay}ms`,
              } as React.CSSProperties}>
              <div className="gcr-fly-inner"><IconCoin size={18} /></div>
            </div>
          ))}
        </div>,
        document.body,
      )}

      <style jsx>{`
        .gcr-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .gcr-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 40px;
          box-sizing: border-box;
          padding: 0 16px 0 10px;
          background: #F4F2EE;
          border-radius: 999px;
          transform-origin: center;
        }
        .gcr-coin-face {
          position: relative;
          width: 20px; height: 20px;
          border-radius: 50%;
          overflow: hidden;
        }
        .gcr-coin-shine {
          position: absolute;
          top: -4px; bottom: -4px; left: 0; width: 55%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
          animation: hudCoinShine 4.5s ease-in-out infinite;
          pointer-events: none;
        }
        .gcr-balance {
          font-size: 18px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          color: #2F2B28;
        }
        .gcr-plus {
          height: 24px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border-radius: 999px;
          background: #FDF1DC;
          font-size: 13px;
          font-weight: 800;
          color: #8A5A12;
        }
        /* ── Flight layer (portaled to <body>) ── */
        .gcr-fly-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9990;
        }
        .gcr-fly-coin {
          position: absolute;
          opacity: 0;
          will-change: transform, opacity;
          animation: hudCoinFly 780ms cubic-bezier(0.45,0,0.75,0.2) forwards;
          pointer-events: none;
        }
        .gcr-fly-inner {
          margin-left: -9px;
          margin-top: -9px;
          filter: drop-shadow(0 0 6px rgba(255,200,60,0.9));
        }
        /* ── Tired card ── */
        .gcr-tired {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          max-width: 100%;
          box-sizing: border-box;
          padding: 10px 16px 12px;
          border-radius: 18px;
          background: #F4F2EE;
        }
        .gcr-zzz { display: flex; gap: 3px; }
        .gcr-zzz span {
          font-size: 13px;
          font-weight: 800;
          color: #A7A29C;
          animation: gcrZzz 1.4s ease-in-out infinite;
        }
        @keyframes gcrZzz {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%      { transform: translateY(-3px); opacity: 1; }
        }
        .gcr-tired-title { font-size: 15px; font-weight: 800; line-height: 1.3; color: #2F2B28; text-align: center; overflow-wrap: anywhere; }
        .gcr-tired-sub { font-size: 13px; font-weight: 600; color: #6E6A66; }
      `}</style>
    </>
  )
}
