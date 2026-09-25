'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useTween } from '@/hooks/useTween'
import { xpForNextLevel, totalXpForLevel, levelForXp } from '@/lib/tasks'
import { MAX_LEVEL } from '@/lib/levelRewards'
import { createClient } from '@/lib/supabase/client'
import { MeadowIcon } from './PixelIcons'
import WaterGauge, { GAUGES } from './WaterGauge'
import { playSound, playCoinTicks } from '@/lib/sounds'
import { M, TYPE } from '@/components/meadow/tokens'

// ─── Top bar ─────────────────────────────────────────────────────────────────
// The Meadow top bar (board A1): three things floating over the room, with no
// bar behind them. The level sits in a white circle whose ring is this level's
// XP (tap: the reward road, badged when rewards wait there); the cat's five
// needs are the water gauges the old HUD had, kept as they were, in a white
// pill; the coins are a white pill. Streak lives on Me, today's wish on home.
//
// Everything that moved still moves: coins fly into the counter on a gain and
// its number pops as they land, "+N XP" rises off the ring when a quest
// completes, and the ring bursts on a level-up.
//
// Screens that show the bar start their content HEADER_CLEARANCE below the
// safe area (meadow/tokens).

// Monotonic id for the floating "+XP" chips.
let floatSeq = 0

// Earned-coin flight: a burst of coins that fly into the counter, then it
// ticks up. COIN_FLY_MS is also how long the count-up is held back so the
// number rises as the coins land.
const COIN_FLY_MS = 720
let coinFlightSeq = 0
interface CoinSprite { i: number; sdx: number; sdy: number; delay: number }
interface CoinFlight { id: number; tx: number; ty: number; sprites: CoinSprite[] }

// A bigger payout showers more coins. Floors at 6 (so small care rewards look
// unchanged) and caps at 24 so even a 250-coin Royal Treasury never floods.
function coinCountFor(amount: number): number {
  return Math.max(6, Math.min(24, Math.round(amount / 3.5)))
}

/**
 * Same grouping as the Meadow CoinChip ("1 234") up to four digits; from
 * 10 000 it reads "12k", so a big balance can't squeeze the needs off the
 * middle of a phone. The exact amount stays in the aria-label and the shops.
 */
function formatCoins(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  return n.toLocaleString('en-US').replace(/,/g, ' ')
}

/** The level circle's diameter, and the coin pill's width at three digits. */
const LEVEL_D = 48
const COIN_PILL_GUESS = 74

/** The level ring's radius and circumference, in the 48px circle's own units. */
const RING_R = 21
const RING_C = 2 * Math.PI * RING_R

// White floating piece over room art: the lip every Meadow chip over art has.
const OVER_ART = { background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}` } as const

export default function StatsHeader() {
  const { user, profile } = useAuth()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const { xp, level, coins } = useTasks()
  const { hideStats, closeScene } = useCare()

  // Animate the raw XP + coin totals so the bar fills and the numbers roll up
  // smoothly. Everything below is derived per-frame from the single animated XP
  // value, so a gain that crosses a level boundary rolls the bar past 100% and
  // continues into the next level naturally instead of snapping backward.
  // Earned coins fly into the counter before the number ticks up: `landedCoins`
  // lags the real `coins` until the fly-in lands (spends apply immediately).
  const [landedCoins, setLandedCoins] = useState(coins)
  const animXp    = useTween(xp, 850)
  const animCoins = useTween(landedCoins, 650)
  const dispLevel   = levelForXp(animXp)
  const xpIntoLevel = Math.max(0, Math.round(animXp - totalXpForLevel(dispLevel)))
  const xpNeeded    = xpForNextLevel(dispLevel)
  const xpPct       = Math.max(0, Math.min(100, ((animXp - totalXpForLevel(dispLevel)) / xpNeeded) * 100))
  const dispCoins   = Math.round(animCoins)

  // Level-up burst — fires when the *animated* level rolls over, so the flash
  // lands exactly as the bar wraps past 100% (not early, on the raw event).
  const [orbBurst, setOrbBurst] = useState(0)
  const prevDispLevel = useRef(dispLevel)
  useEffect(() => {
    if (dispLevel > prevDispLevel.current) setOrbBurst(k => k + 1)
    prevDispLevel.current = dispLevel
  }, [dispLevel])

  // Coins fly into the counter on every gain, then it pops + ticks up as they
  // land; spends skip the flight and apply at once. The coin chip and a
  // full-frame fly layer are measured so sprites land dead-on at any size.
  const [coinPop, setCoinPop] = useState(0)
  const [coinFlights, setCoinFlights] = useState<CoinFlight[]>([])
  const prevCoins = useRef(coins)
  const coinsRef = useRef(coins)
  coinsRef.current = coins
  const coinChipRef = useRef<HTMLSpanElement>(null)
  const flyLayerRef = useRef<HTMLDivElement>(null)
  const coinTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  // Daily-fortune coin handshake: a coin gift arms `coinClaimRef` before
  // crediting, so the HUD skips its own centre-burst; `awaitingBurstRef` then
  // holds the count-up until the gift fires the shower from the revealed bag.
  const coinClaimRef = useRef(false)
  const awaitingBurstRef = useRef(false)
  // Pending coin-tick cascade (the sound of the counter climbing). Held so a
  // newer gain can supersede it instead of the two overlapping into a clatter.
  const coinTickCancelRef = useRef<(() => void) | null>(null)
  useEffect(() => () => {
    coinTimersRef.current.forEach(clearTimeout)
    coinTickCancelRef.current?.()
  }, [])

  const launchCoinFlight = useCallback((opts?: { origin?: { x: number; y: number }; count?: number }) => {
    const chip = coinChipRef.current
    const layer = flyLayerRef.current
    if (!chip || !layer) return
    const c = chip.getBoundingClientRect()
    const l = layer.getBoundingClientRect()
    if (l.width === 0) return
    // Counter centre + burst origin, both in the fly layer's local space, so
    // the math holds whether the layer is the viewport or the desktop frame.
    const tx = c.left + c.width / 2 - l.left
    const ty = c.top + c.height / 2 - l.top
    // Origin: a custom point (the daily-fortune bag, in viewport coords) or the
    // default upper-centre of the frame for ordinary gains.
    const ox = opts?.origin ? opts.origin.x - l.left : l.width / 2
    const oy = opts?.origin ? opts.origin.y - l.top  : l.height * 0.42
    const n = opts?.count ?? 6
    const id = ++coinFlightSeq
    const sprites: CoinSprite[] = Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * Math.PI * 2 + id * 0.7
      const rad = 14 + (i % 4) * 10
      return { i, sdx: ox + Math.cos(ang) * rad - tx, sdy: oy + Math.sin(ang) * rad - ty, delay: i * 38 }
    })
    setCoinFlights(f => [...f, { id, tx, ty, sprites }])
    // Little coin ticks as the coins land and the counter starts climbing —
    // more ticks for a bigger shower. A newer flight replaces the old cascade.
    coinTickCancelRef.current?.()
    coinTickCancelRef.current = playCoinTicks(Math.max(3, n / 3), COIN_FLY_MS)
    const t = setTimeout(() => {
      setCoinFlights(f => f.filter(x => x.id !== id))
      coinTimersRef.current.delete(t)
    }, COIN_FLY_MS + n * 38 + 140)
    coinTimersRef.current.add(t)
  }, [])

  useEffect(() => {
    const prev = prevCoins.current
    prevCoins.current = coins
    if (coins === prev) return
    if (coins < prev) { setLandedCoins(coins); return }   // a spend — apply now
    if (coinClaimRef.current) {
      // A coin gift claimed this gain — it drives the shower + count-up itself
      // when the gift is dismissed (eren:coin-burst). Hold the counter here.
      coinClaimRef.current = false
      awaitingBurstRef.current = true
      return
    }
    // Earned: fly the coins in (scaled to the gain), then land + pop on arrival.
    launchCoinFlight({ count: coinCountFor(coins - prev) })
    const target = coins
    const t = setTimeout(() => {
      setLandedCoins(l => Math.max(l, target))
      setCoinPop(k => k + 1)
      coinTimersRef.current.delete(t)
    }, COIN_FLY_MS)
    coinTimersRef.current.add(t)
  }, [coins, launchCoinFlight])

  // Coin-gift shower: arm on claim, then fly from the revealed bag into the
  // counter when the gift popup closes. The count scales with the amount, so a
  // 50-coin Heavy Coin Bag rains far more than a 10-coin pouch. If the burst
  // never arrives (popup killed mid-reveal), a fresh mount re-reads the balance
  // from `coins`, so the counter never gets stuck below the real total.
  useEffect(() => {
    const onClaim = () => { coinClaimRef.current = true }
    const onBurst = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number; amount: number }>).detail
      if (!d) return
      launchCoinFlight({ origin: { x: d.x, y: d.y }, count: coinCountFor(d.amount) })
      if (awaitingBurstRef.current) {
        awaitingBurstRef.current = false
        const target = coinsRef.current
        const t = setTimeout(() => {
          setLandedCoins(l => Math.max(l, target))
          setCoinPop(k => k + 1)
          coinTimersRef.current.delete(t)
        }, COIN_FLY_MS)
        coinTimersRef.current.add(t)
      }
    }
    window.addEventListener('eren:coin-claim', onClaim)
    window.addEventListener('eren:coin-burst', onBurst as EventListener)
    return () => {
      window.removeEventListener('eren:coin-claim', onClaim)
      window.removeEventListener('eren:coin-burst', onBurst as EventListener)
    }
  }, [launchCoinFlight])

  // Floating "+N XP" chips on quest completion (any care action that completes
  // its daily quest fires this too). Each rises from the bar and fades. Chips
  // fan sideways (dx) so several gains in the same moment stay legible, and the
  // removal timers are tracked so they're cleared if the header unmounts.
  const [xpFloats, setXpFloats] = useState<{ id: number; xp: number; dx: number }[]>([])
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const onQuest = (e: Event) => {
      const gained = (e as CustomEvent<{ xp?: number }>).detail?.xp ?? 0
      if (gained <= 0) return
      const id = ++floatSeq
      const dx = (id % 3 - 1) * 16
      setXpFloats(f => [...f, { id, xp: gained, dx }])
      const t = setTimeout(() => {
        setXpFloats(f => f.filter(x => x.id !== id))
        timers.delete(t)
      }, 1300)
      timers.add(t)
    }
    window.addEventListener('eren:quest-complete', onQuest)
    return () => {
      window.removeEventListener('eren:quest-complete', onQuest)
      timers.forEach(clearTimeout)
    }
  }, [])

  // ── Unclaimed reward count badge ──
  // Pulled separately from useAuth's profile because the value is mutated on
  // /rewards (claim) and we want it in sync without forcing a profile refetch
  // there. Listens for an `eren:rewards-claimed` window event the rewards
  // page dispatches after a successful claim.
  const [claimedLevel, setClaimedLevel] = useState<number>(0)
  useEffect(() => {
    if (!user?.id) return
    const supabase = createClient()
    let cancelled = false
    const fetchClaimed = () => {
      supabase.from('profiles').select('claimed_level').eq('id', user.id).single()
        .then(({ data }) => {
          if (cancelled) return
          if (data && typeof data.claimed_level === 'number') setClaimedLevel(data.claimed_level)
        })
    }
    fetchClaimed()
    const onClaimed = () => fetchClaimed()
    window.addEventListener('eren:rewards-claimed', onClaimed)
    return () => {
      cancelled = true
      window.removeEventListener('eren:rewards-claimed', onClaimed)
    }
  }, [user?.id])

  const unclaimedRewards = Math.max(0, Math.min(level, MAX_LEVEL) - claimedLevel)

  // The needs sit dead centre on the screen: both side slots take the wider of
  // the level circle and the coin pill, measured, because the coin pill grows
  // with the balance and the circle doesn't. Re-armed when the bar reappears.
  const [sideW, setSideW] = useState(COIN_PILL_GUESS)
  useEffect(() => {
    const el = coinChipRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      setSideW(Math.max(LEVEL_D, Math.ceil(el.getBoundingClientRect().width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [hideStats])

  if (hideStats) return null

  const badge = unclaimedRewards > 99 ? '99+' : String(unclaimedRewards)
  const levelLabel = `Level ${dispLevel}, ${xpIntoLevel} of ${xpNeeded} XP`
    + (unclaimedRewards > 0 ? `, ${unclaimedRewards} ${unclaimedRewards === 1 ? 'reward' : 'rewards'} to claim` : '')
    + '. Open the reward road'

  return (
    // The row itself lets taps through (the layout's wrapper is
    // pointer-events: none); only the three pieces catch them.
    <div className="w-full" style={{
      display: 'grid', gridTemplateColumns: `${sideW}px minmax(0, 1fr) ${sideW}px`,
      alignItems: 'center', columnGap: 8,
      paddingTop: 'calc(var(--safe-top) + 6px)', paddingLeft: 16, paddingRight: 16,
      color: M.text,
    }}>
      {/* ── Level: the ring is this level's XP. Tap: the reward road. Closes
          any care scene first, so its overlay (fixed, z 40) doesn't sit on
          top of the rewards page. Home's XP sparkles fly to this id. ── */}
      <Link
        href="/rewards"
        id="stats-xp-bar"
        aria-label={levelLabel}
        onClick={() => { closeScene(); playSound('ui_tap') }}
        className="m-press m-focus"
        style={{
          ...OVER_ART, pointerEvents: 'auto', position: 'relative', justifySelf: 'start',
          width: LEVEL_D, height: LEVEL_D, borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', color: M.text,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden style={{ position: 'absolute', inset: 0 }}>
          <circle cx="24" cy="24" r={RING_R} fill="none" stroke={M.track} strokeWidth="4" />
          {/* Driven per frame by the XP tween, like the bar it replaces. A
              zero-length round cap would still paint a dot, so none at 0. */}
          {xpPct > 0.5 && (
            <circle cx="24" cy="24" r={RING_R} fill="none" stroke={M.leaf} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(xpPct / 100) * RING_C} ${RING_C}`} transform="rotate(-90 24 24)" />
          )}
        </svg>

        {/* Keyed by orbBurst so it bounces once on each level roll-over. */}
        <span key={orbBurst} style={{
          position: 'relative', fontSize: 17, lineHeight: 1, ...TYPE.number,
          animation: orbBurst ? 'hudOrbPop 600ms cubic-bezier(0.16,1,0.3,1)' : undefined,
        }}>{dispLevel}</span>

        {/* Level-up burst: a leaf ring expands while coin-gold sparks fly
            outward. Remounts on each roll-over to replay. */}
        {orbBurst > 0 && (
          <span key={`burst-${orbBurst}`} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <span style={{
              position: 'absolute', left: '50%', top: '50%', width: 48, height: 48, borderRadius: 999,
              border: `3px solid ${M.leaf}`,
              transform: 'translate(-50%, -50%)',
              animation: 'hudOrbRing 650ms ease-out forwards',
            }} />
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2
              return (
                <span key={i} style={{
                  position: 'absolute', left: '50%', top: '50%',
                  width: 5, height: 5, borderRadius: 999, background: M.coin,
                  ['--sx']: `${Math.cos(a) * 30}px`,
                  ['--sy']: `${Math.sin(a) * 30}px`,
                  animation: `hudOrbSpark 620ms ease-out ${i * 18}ms forwards`,
                } as React.CSSProperties} />
              )
            })}
          </span>
        )}

        {/* Rewards waiting on the road: the count, in the unread-dot pink. */}
        {unclaimedRewards > 0 && (
          <span aria-hidden style={{
            position: 'absolute', top: -4, right: -6,
            minWidth: 20, height: 20, boxSizing: 'border-box', padding: '0 5px',
            borderRadius: 999, background: M.love, border: '2px solid #FFFFFF',
            color: '#FFFFFF', fontSize: 11, lineHeight: '16px', textAlign: 'center', ...TYPE.number,
          }}>{badge}</span>
        )}

        {/* "+N XP" chips rise off the ring on each quest completion, fanned
            sideways (dx) so several at once stay legible. */}
        {xpFloats.map(f => (
          <span key={f.id} aria-hidden style={{
            position: 'absolute', left: `calc(50% + ${f.dx}px)`, top: 50, zIndex: 6,
            padding: '3px 8px', borderRadius: 999, ...OVER_ART,
            color: M.leafInk, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'hudFloatRise 1.3s ease-out forwards',
          }}>+{f.xp} XP</span>
        ))}
      </Link>

      {/* ── The cat's needs: five glasses of water in one pill, centred.
          The glasses shrink (32px down to 24) before the pill outgrows the
          middle column. ── */}
      <div role="group" aria-label="Needs" style={{
        ...OVER_ART, pointerEvents: 'auto', justifySelf: 'center',
        width: 'fit-content', maxWidth: '100%', minWidth: 0,
        height: 48, boxSizing: 'border-box', padding: '0 8px', borderRadius: 999,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {GAUGES.map(def => {
          const raw = stats ? (stats as unknown as Record<string, unknown>)[def.key] : null
          return <WaterGauge key={def.key} def={def} value={typeof raw === 'number' ? raw : null} />
        })}
      </div>

      {/* ── Coins. Measured by the fly layer so the coins land dead-on; the
          number pops as they arrive. ── */}
      <span
        ref={coinChipRef}
        role="img"
        aria-label={`${coins} coins`}
        style={{
          ...OVER_ART, pointerEvents: 'auto', justifySelf: 'end',
          height: 40, boxSizing: 'border-box', padding: '0 12px 0 8px', borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 16, whiteSpace: 'nowrap', ...TYPE.number,
        }}
      >
        <MeadowIcon name="coin" size={20} />
        <span key={coinPop} style={{
          display: 'inline-block',
          animation: coinPop ? 'hudNumPop 450ms cubic-bezier(0.16,1,0.3,1)' : undefined,
        }}>{formatCoins(dispCoins)}</span>
      </span>

      {/* Coin-flight layer: full-frame; coins fly from a burst origin into the
          counter on every gain. Always mounted so its box can be measured on
          demand; pointer-events none so it never blocks the UI. */}
      <div ref={flyLayerRef} aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 80 }}>
        {coinFlights.map(flight =>
          flight.sprites.map(s => (
            <div key={`${flight.id}-${s.i}`} style={{
              position: 'absolute', left: flight.tx, top: flight.ty,
              ['--sdx']: `${s.sdx}px`, ['--sdy']: `${s.sdy}px`,
              animation: `hudCoinFly ${COIN_FLY_MS}ms cubic-bezier(0.45,0,0.75,0.2) ${s.delay}ms forwards`,
              willChange: 'transform, opacity',
            } as React.CSSProperties}>
              <div style={{ marginLeft: -8, marginTop: -8, filter: 'drop-shadow(0 0 5px rgba(255,200,60,0.85))' }}>
                <MeadowIcon name="coin" size={16} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
