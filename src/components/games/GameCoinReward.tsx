'use client'

// ─── GameCoinReward ─────────────────────────────────────────────────────────
// Drop-in finish-screen reward badge for every minigame. Reuses the EXACT coin
// animation from the HUD (StatsHeader): a burst of coins fly into a coin
// counter pill (global @keyframes hudCoinFly), then the number pops (hudNumPop)
// and ticks up as they land — so the player always SEES what they earned land
// in their counter. The StatsHeader is hidden during games, so this stands in
// for it on the result screen.
//
// When Eren is too exhausted to award coins (energy < 30), shows a sleepy
// "rest first" card instead.
//
// `coins`/`blocked` come straight from useGameRewards().reportGameResult(...).

import { useEffect, useRef, useState } from 'react'
import { IconCoin } from '@/components/PixelIcons'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'

interface Props {
  coins: number
  blocked?: boolean
}

const COIN_FLY_MS = 720 // matches StatsHeader's flight duration

interface Sprite { i: number; sdx: number; sdy: number; tx: number; ty: number; delay: number }

export default function GameCoinReward({ coins, blocked = false }: Props) {
  const { coins: balance } = useTasks()

  // Snapshot the post-award total once so the pill counts up from
  // (total − earned) → total regardless of when addCoins' state flush lands.
  const targetRef = useRef<number | null>(null)
  if (targetRef.current === null) targetRef.current = balance
  const target = targetRef.current ?? 0
  const startBal = Math.max(0, target - coins)

  const layerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const [sprites, setSprites] = useState<Sprite[]>([])
  const [shownBal, setShownBal] = useState(startBal)
  const [popKey, setPopKey] = useState(0)

  useEffect(() => {
    if (blocked || coins <= 0) { setShownBal(target); return }
    const layer = layerRef.current
    const pill = pillRef.current
    if (!layer || !pill) { setShownBal(target); return }

    const lr = layer.getBoundingClientRect()
    const pr = pill.getBoundingClientRect()
    if (lr.width === 0) { setShownBal(target); return }

    // Counter centre + burst origin in the layer's local space — mirrors
    // StatsHeader.launchCoinFlight so the motion reads identically.
    const tx = pr.left + pr.width / 2 - lr.left
    const ty = pr.top + pr.height / 2 - lr.top
    const ox = lr.width / 2
    const oy = lr.height * 0.78 // burst from low in the card, fly up into the pill
    const sp: Sprite[] = Array.from({ length: 6 }, (_, i) => {
      const ang = (i / 6) * Math.PI * 2 + 0.7
      const rad = 18 + (i % 3) * 12
      return { i, tx, ty, sdx: ox + Math.cos(ang) * rad - tx, sdy: oy + Math.sin(ang) * rad - ty, delay: i * 45 }
    })
    setSprites(sp)
    playSound('coin_pickup')

    let cancelled = false
    let raf = 0
    const land = setTimeout(() => {
      if (cancelled) return
      setPopKey(k => k + 1)
      const t0 = performance.now()
      const DUR = 520
      const tick = (now: number) => {
        if (cancelled) return
        const p = Math.min(1, (now - t0) / DUR)
        const eased = 1 - Math.pow(1 - p, 3)
        setShownBal(Math.round(startBal + (target - startBal) * eased))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, COIN_FLY_MS)
    const clear = setTimeout(() => { if (!cancelled) setSprites([]) }, COIN_FLY_MS + 6 * 45 + 240)

    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(land); clearTimeout(clear) }
  }, [blocked, coins, startBal, target])

  // ── Exhausted: no coins until Eren rests ──────────────────────────────────
  if (blocked) {
    return (
      <div className="gcr-tired" role="status">
        <div className="gcr-zzz">
          <span style={{ animationDelay: '0s' }}>z</span>
          <span style={{ animationDelay: '0.2s' }}>z</span>
          <span style={{ animationDelay: '0.4s' }}>z</span>
        </div>
        <span className="font-pixel gcr-tired-title">EREN&apos;S TOO TIRED</span>
        <span className="font-pixel gcr-tired-sub">REST TO EARN COINS</span>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="gcr-wrap" ref={layerRef}>
      {/* Coin counter pill — the coins fly up into this, then it pops + ticks. */}
      <div key={popKey} ref={pillRef} className="gcr-pill"
        style={{ animation: popKey ? 'hudNumPop 450ms cubic-bezier(0.16,1,0.3,1)' : undefined }}>
        <div className="gcr-coin-face">
          <IconCoin size={15} />
          <span aria-hidden className="gcr-coin-shine" />
        </div>
        <span className="font-pixel gcr-balance">{shownBal.toLocaleString()}</span>
      </div>

      <div className="font-pixel gcr-plus">+{coins} COINS</div>

      {/* Flight layer — coins burst from low and converge into the pill, using
          the same global hudCoinFly keyframe as the HUD. */}
      {sprites.map(s => (
        <div key={s.i} className="gcr-fly-coin"
          style={{
            left: s.tx, top: s.ty,
            ['--sdx' as string]: `${s.sdx}px`,
            ['--sdy' as string]: `${s.sdy}px`,
            animationDelay: `${s.delay}ms`,
          } as React.CSSProperties}>
          <div className="gcr-fly-inner"><IconCoin size={14} /></div>
        </div>
      ))}

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .gcr-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    min-height: 56px;
    padding-bottom: 6px;
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
  .gcr-fly-coin {
    position: absolute;
    opacity: 0;
    will-change: transform, opacity;
    animation: hudCoinFly ${COIN_FLY_MS}ms cubic-bezier(0.45,0,0.75,0.2) forwards;
    pointer-events: none;
  }
  .gcr-fly-inner {
    margin-left: -7px;
    margin-top: -7px;
    filter: drop-shadow(0 0 5px rgba(255,200,60,0.85));
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
`
