'use client'

// ─── GameCoinReward ─────────────────────────────────────────────────────────
// Drop-in finish-screen reward badge for every minigame. Shows the coins the
// run earned flying up into a live coin-balance pill (count-up + coin SFX), so
// the player always SEES what they got and where it went. When Eren is too
// exhausted to award coins (energy < 30), shows a sleepy "rest first" card
// instead.
//
// `coins`/`blocked` come straight from useGameRewards().reportGameResult(...).
// The balance pill reads the live wallet (useTasks().coins) — which is the
// only coin counter visible on a game screen, since the StatsHeader is hidden.

import { useEffect, useRef, useState } from 'react'
import { IconCoin } from '@/components/PixelIcons'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'

interface Props {
  coins: number
  blocked?: boolean
}

const COIN_DUR = 850 // count-up + fly duration (ms)

export default function GameCoinReward({ coins, blocked = false }: Props) {
  const { coins: balance } = useTasks()

  // Snapshot the post-award total once so the pill counts up from
  // (total − earned) → total regardless of when the optimistic addCoins
  // state flush lands.
  const targetRef = useRef<number | null>(null)
  if (targetRef.current === null) targetRef.current = balance
  const target = targetRef.current ?? 0
  const startBal = Math.max(0, target - coins)

  const [shownBal, setShownBal] = useState(startBal)
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    if (blocked || coins <= 0) { setShownBal(target); return }
    playSound('coin_pickup')
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / COIN_DUR)
      const eased = 1 - Math.pow(1 - p, 3)
      setShownBal(Math.round(startBal + (target - startBal) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setLanded(true)
    }
    raf = requestAnimationFrame(tick)
    const landTimer = setTimeout(() => setLanded(true), COIN_DUR + 60)
    return () => { cancelAnimationFrame(raf); clearTimeout(landTimer) }
  }, [blocked, coins, startBal, target])

  // ── Exhausted: no coins until Eren rests ──────────────────────────────────
  if (blocked) {
    return (
      <div className="gcr-card gcr-tired" role="status">
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

  // Visual coin count for the burst: a few coins regardless of exact payout.
  const flyCount = Math.max(3, Math.min(7, coins))

  return (
    <div className="gcr-wrap">
      {/* Live balance pill — the coins fly up into this. */}
      <div className={`gcr-pill ${landed ? 'gcr-pill-pop' : ''}`}>
        <IconCoin size={13} />
        <span className="font-pixel gcr-balance">{shownBal.toLocaleString()}</span>
      </div>

      {/* Flying coins burst toward the pill */}
      <div className="gcr-fly">
        {Array.from({ length: flyCount }).map((_, i) => (
          <span
            key={i}
            className="gcr-coin"
            style={{
              left: `${50 + (i - (flyCount - 1) / 2) * 13}%`,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <IconCoin size={12} />
          </span>
        ))}
      </div>

      {/* +N label */}
      <div className="font-pixel gcr-plus">+{coins} COINS</div>

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
    gap: 4px;
    padding-top: 22px; /* room for the flying coins below the pill */
  }
  .gcr-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: linear-gradient(180deg, rgba(120,53,15,0.65), rgba(67,20,7,0.8));
    border: 2px solid #FBBF24;
    border-radius: 5px;
    box-shadow: 0 2px 0 #78350F, inset 0 1px 0 rgba(251,191,36,0.35);
  }
  .gcr-balance {
    font-size: 12px;
    color: #FDE68A;
    letter-spacing: 1px;
    text-shadow: 0 1px 0 rgba(0,0,0,0.5);
  }
  .gcr-pill-pop { animation: gcrPop 0.4s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes gcrPop {
    0% { transform: scale(1); }
    45% { transform: scale(1.16); }
    100% { transform: scale(1); }
  }
  .gcr-fly {
    position: absolute;
    top: 20px; left: 0; right: 0;
    height: 26px;
    pointer-events: none;
  }
  .gcr-coin {
    position: absolute;
    top: 18px;
    transform: translate(-50%, 0);
    opacity: 0;
    animation: gcrFly 0.6s cubic-bezier(0.4,0,0.2,1) forwards;
    filter: drop-shadow(0 1px 1px rgba(120,53,15,0.6));
  }
  @keyframes gcrFly {
    0%   { transform: translate(-50%, 18px) scale(0.6); opacity: 0; }
    25%  { opacity: 1; }
    100% { transform: translate(-50%, -22px) scale(1);  opacity: 0; }
  }
  .gcr-plus {
    font-size: 8px;
    letter-spacing: 1.5px;
    color: #FDE68A;
    text-shadow: 0 1px 0 rgba(0,0,0,0.5), 0 0 8px rgba(251,191,36,0.4);
  }
  /* ── Tired card ── */
  .gcr-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 14px;
    border-radius: 5px;
  }
  .gcr-tired {
    background: linear-gradient(180deg, rgba(30,27,58,0.85), rgba(15,10,30,0.9));
    border: 2px solid #4C5578;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .gcr-zzz {
    display: flex;
    gap: 3px;
    margin-bottom: 1px;
  }
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
  .gcr-tired-title {
    font-size: 8px;
    letter-spacing: 1.5px;
    color: #C7D2FE;
  }
  .gcr-tired-sub {
    font-size: 6px;
    letter-spacing: 1px;
    color: #7E8AB8;
  }
`
