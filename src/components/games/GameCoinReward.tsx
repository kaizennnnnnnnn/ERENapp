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

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCoin } from '@/components/PixelIcons'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'

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
    playSound('coin_pickup')

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

    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(land); clearTimeout(clear) }
  }, [blocked, coins, startBal, target])

  return (
    <>
      {blocked ? (
        <div className="gcr-tired" role="status">
          <div className="gcr-zzz">
            <span style={{ animationDelay: '0s' }}>z</span>
            <span style={{ animationDelay: '0.2s' }}>z</span>
            <span style={{ animationDelay: '0.4s' }}>z</span>
          </div>
          <span className="font-pixel gcr-tired-title">EREN&apos;S TOO TIRED</span>
          <span className="font-pixel gcr-tired-sub">REST TO EARN COINS</span>
        </div>
      ) : (
        <div className="gcr-wrap">
          {/* Coin counter pill — the coins fly in from both sides into this. */}
          <div key={popKey} ref={pillRef} className="gcr-pill"
            style={{ animation: popKey ? 'hudNumPop 450ms cubic-bezier(0.16,1,0.3,1)' : undefined }}>
            <div className="gcr-coin-face">
              <IconCoin size={15} />
              <span aria-hidden className="gcr-coin-shine" />
            </div>
            <span className="font-pixel gcr-balance">{shownBal.toLocaleString()}</span>
          </div>
          <div className="font-pixel gcr-plus">+{coins} COINS</div>
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
          gap: 5px;
          padding-bottom: 2px;
        }
        .gcr-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 11px;
          background: linear-gradient(180deg, rgba(120,53,15,0.65), rgba(67,20,7,0.82));
          border: 2px solid #FBBF24;
          border-radius: 5px;
          box-shadow: 0 2px 0 #78350F, inset 0 1px 0 rgba(251,191,36,0.35);
          transform-origin: center;
        }
        .gcr-coin-face {
          position: relative;
          width: 15px; height: 15px;
          border-radius: 50%;
          overflow: hidden;
          filter: drop-shadow(0 0 3px rgba(251,191,36,0.4));
        }
        .gcr-coin-shine {
          position: absolute;
          top: -4px; bottom: -4px; left: 0; width: 55%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
          animation: hudCoinShine 4.5s ease-in-out infinite;
          pointer-events: none;
        }
        .gcr-balance {
          font-size: 12px;
          color: #FDE68A;
          letter-spacing: 1px;
          text-shadow: 0 1px 0 rgba(0,0,0,0.6);
        }
        .gcr-plus {
          font-size: 8px;
          letter-spacing: 1.5px;
          color: #FDE68A;
          text-shadow: 0 1px 0 rgba(0,0,0,0.5), 0 0 8px rgba(251,191,36,0.4);
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
          padding: 8px 14px;
          border-radius: 5px;
          background: linear-gradient(180deg, rgba(30,27,58,0.85), rgba(15,10,30,0.9));
          border: 2px solid #4C5578;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .gcr-zzz { display: flex; gap: 3px; margin-bottom: 1px; }
        .gcr-zzz span {
          font-family: "Press Start 2P";
          font-size: 9px;
          color: #93A4D4;
          animation: gcrZzz 1.4s ease-in-out infinite;
        }
        @keyframes gcrZzz {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%      { transform: translateY(-3px); opacity: 1; }
        }
        .gcr-tired-title { font-size: 8px; letter-spacing: 1.5px; color: #C7D2FE; }
        .gcr-tired-sub { font-size: 6px; letter-spacing: 1px; color: #7E8AB8; }
      `}</style>
    </>
  )
}
