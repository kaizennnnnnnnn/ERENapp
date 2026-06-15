'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useTween } from '@/hooks/useTween'
import { xpForNextLevel, totalXpForLevel, levelForXp } from '@/lib/tasks'
import { MAX_LEVEL } from '@/lib/levelRewards'
import { createClient } from '@/lib/supabase/client'
import { IconHeart, IconMeat, IconLightning, IconMoon, IconDrop, IconCoin, IconFire } from './PixelIcons'
import { playSound } from '@/lib/sounds'
import { PINK, PINK_HI, PINK_LO, OBSIDIAN_FACE, Rivets, accentA } from './obsidian'
import { useWish } from '@/contexts/WishContext'
import WishChip from '@/components/wish/WishChip'

// Red triplet for the unclaimed-rewards badge — distinct "claim me" signal
// against the rest of the pink HUD.
const RED_HI = '#FF7B7B'
const RED    = '#E53935'
const RED_LO = '#8E1F1B'
const redA = (a: number) => `rgba(229,57,53,${a})`

// Warm light yellow — shared accent for the level orb ring, the XP fill bar,
// and the XP readout, so the level/XP cluster reads as one warm unit. The
// little dot accents (orb ticks + panel rivets) stay pink for contrast.
const YELLOW_HI = '#FFF6C8'
const YELLOW    = '#FFE173'
const YELLOW_LO = '#E0B84A'
const yellowA = (a: number) => `rgba(255,225,115,${a})`

// Gold triplet for the coins number — matches the gold coin icon beside it.
const GOLD_HI = '#FFD700'
const GOLD    = '#FF8C00'
const GOLD_LO = '#B35900'

// Silver triplet for the level number — neutral, high-contrast white→silver
// so the level reads as a distinct headline value against the pink HUD.
const SILVER_HI = '#FFFFFF'
const SILVER    = '#C8C8D0'
const SILVER_LO = '#7A7A85'

// Monotonic id for the floating "+XP" chips.
let floatSeq = 0

type StatKey = 'happiness' | 'hunger' | 'energy' | 'sleep_quality' | 'cleanliness'

interface GaugeDef {
  key: StatKey
  Icon: React.ComponentType<{ size?: number }>
  hue: [string, string]   // [topFill, bottomFill] for the high tier
}

const GAUGES: GaugeDef[] = [
  { key: 'happiness',     Icon: IconHeart,     hue: ['#F4C2D5', '#C77E96'] },
  { key: 'hunger',        Icon: IconMeat,      hue: ['#F0C97A', '#A87826'] },
  { key: 'energy',        Icon: IconLightning, hue: ['#9FE0B2', '#3F9763'] },
  { key: 'sleep_quality', Icon: IconMoon,      hue: ['#B8C5F0', '#5A6BA8'] },
  { key: 'cleanliness',   Icon: IconDrop,      hue: ['#A8D8F0', '#3D7BA8'] },
]

// Local panel-face helper that lets us tweak the border tint per panel
// (gauge wells use a quieter purple than the headline XP/coins panels).
const obsidianFace = (borderColor: string = PINK + '55'): React.CSSProperties => ({
  ...OBSIDIAN_FACE,
  border: `1px solid ${borderColor}`,
})

// ── Single circular gauge ────────────────────────────────────────────
function ObsidianGauge({ def, value }: { def: GaugeDef; value: number }) {
  const v = Math.round(Math.max(0, Math.min(100, value)))
  const isCrit = v < 15
  const isLow  = v < 30
  const tier: 'low' | 'mid' | 'high' = v >= 60 ? 'high' : v >= 30 ? 'mid' : 'low'

  const fillTop = tier === 'low' ? '#FF6B6B' : tier === 'mid' ? '#F2D77A' : def.hue[0]
  const fillBot = tier === 'low' ? '#8B2020' : tier === 'mid' ? '#A87826' : def.hue[1]
  const ringGlow =
    tier === 'low' ? 'rgba(248,113,113,0.5)' :
    tier === 'mid' ? 'rgba(242,215,122,0.4)' :
    `${accentA(0.4)}`

  return (
    <div style={{
      flex: 1,
      padding: '4px 3px 4px',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      ...obsidianFace(PINK + '33'),
    }}>
      <Rivets inset={2} />

      {/* Outer obsidian ring around the gauge */}
      <div
        className={isCrit ? 'animate-heartbeat' : ''}
        style={{
          width: 36, height: 36, position: 'relative',
          borderRadius: '50%',
          background: '#000',
          boxShadow: [
            `inset 0 0 0 1.5px ${accentA(0.53)}`,
            'inset 0 0 0 3px #000',
            `inset 0 0 0 4px ${accentA(0.2)}`,
            `0 0 8px ${ringGlow}`,
            '0 0 0 2px rgba(0,0,0,0.4)',
          ].join(','),
          overflow: 'hidden',
        }}>
        {/* Inner well */}
        <div style={{
          position: 'absolute', inset: 4,
          borderRadius: '50%',
          background: '#050507',
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
        }}>
          {/* Liquid fill */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: `${v}%`,
            background: `linear-gradient(180deg, ${fillTop} 0%, ${fillBot} 100%)`,
            transition: 'height 700ms ease-out',
            boxShadow: `0 0 8px ${fillTop}66 inset`,
          }}>
            {/* Wave at the surface */}
            <div style={{
              position: 'absolute', top: -2, left: '-50%', width: '200%', height: 4,
              background: `radial-gradient(circle 3px at 3px 2px, ${fillTop} 50%, transparent 51%) repeat-x`,
              backgroundSize: '6px 4px',
              animation: `obsidian-wave ${isLow ? '1.4s' : '2.6s'} linear infinite`,
              opacity: 0.85,
            }} />
            {/* Highlight on the liquid */}
            <div style={{
              position: 'absolute', left: '15%', right: '15%', top: '8%', height: '25%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)',
              borderRadius: '50%',
              filter: 'blur(0.5px)',
            }} />
          </div>

          {/* Centered icon */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 1px 0 rgba(255,255,255,0.15))' }}>
              <def.Icon size={14} />
            </div>
          </div>
        </div>

        {/* Glass top sheen */}
        <div style={{
          position: 'absolute', left: '18%', right: '18%', top: '10%', height: '25%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
      </div>

      {/* 5-dot tier indicator */}
      <div style={{ display: 'flex', gap: 1, alignItems: 'center', height: 3 }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const lit = i < Math.round(v / 20)
          return (
            <div key={i} style={{
              width: 3,
              height: i === 2 ? 3 : 2,
              background: lit ? PINK : '#2a2a2e',
              boxShadow: lit ? `0 0 2px ${PINK}` : 'none',
            }} />
          )
        })}
      </div>

      <span className="font-pixel" style={{
        fontSize: 7, lineHeight: 1,
        color: tier === 'low' ? '#ff8c8c' : PINK_HI,
        textShadow: tier === 'low' ? '0 0 4px rgba(248,113,113,0.6)' : `0 0 3px ${accentA(0.33)}`,
      }}>{v}</span>
    </div>
  )
}

export default function StatsHeader() {
  const { user, profile } = useAuth()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const { xp, level, coins, streak } = useTasks()
  const { hideStats, activeScene, closeScene } = useCare()
  const wish = useWish()

  // Animate the raw XP + coin totals so the bar fills and the numbers roll up
  // smoothly. Everything below is derived per-frame from the single animated XP
  // value, so a gain that crosses a level boundary rolls the bar past 100% and
  // continues into the next level naturally instead of snapping backward.
  const animXp    = useTween(xp, 850)
  const animCoins = useTween(coins, 650)
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

  // Coin pop + XP-bar sheen — keyed bumps that replay a one-shot animation each
  // time the real total ticks up (the ref compares against the authoritative
  // value, not the in-flight tween).
  const [coinPop, setCoinPop] = useState(0)
  const prevCoins = useRef(coins)
  useEffect(() => {
    if (coins > prevCoins.current) setCoinPop(k => k + 1)
    prevCoins.current = coins
  }, [coins])

  const [xpTick, setXpTick] = useState(0)
  const prevXp = useRef(xp)
  useEffect(() => {
    if (xp > prevXp.current) setXpTick(k => k + 1)
    prevXp.current = xp
  }, [xp])

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

  if (hideStats || activeScene === 'school') return null

  return (
    <div
      className="w-full flex flex-col"
      style={{
        pointerEvents: 'auto',
        paddingTop: 'calc(var(--safe-top) + 6px)',
        paddingBottom: 8,
        paddingLeft: 10,
        paddingRight: 10,
        gap: 6,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 75%, rgba(0,0,0,0.55) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'relative',
      }}
    >
      {/* Hairline pink accent across the top */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 16, right: 16, top: 'calc(var(--safe-top) + 1px)',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accentA(0.53)}, transparent)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Row 1: Level orb + XP + Coins ── */}
      <div className="flex items-center" style={{ gap: 6 }}>
        {/* Level orb (tap → /rewards). Closes any active care scene first
            so the kitchen/play/etc. overlay (also fixed inset-0 z-40) doesn't
            sit on top of the rewards page. */}
        <Link
          href="/rewards"
          aria-label="Open reward road"
          onClick={() => { closeScene(); playSound('ui_tap') }}
          className="flex-shrink-0 relative block active:translate-y-[1px] transition-transform"
          style={{
            width: 40, height: 40,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #2a2a2e 0%, #0a0a0c 50%, #000 100%)',
            boxShadow: [
              `0 0 0 1.5px ${YELLOW}`,
              '0 0 0 3px #000',
              `0 0 0 4px ${yellowA(0.4)}`,
              '0 4px 14px rgba(0,0,0,0.7)',
              'inset 0 1px 0 rgba(255,255,255,0.15)',
            ].join(','),
          }}
        >
          {/* Twelve-tick perimeter */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30) * Math.PI / 180
            const r = 15
            const x = 20 + r * Math.cos(angle - Math.PI / 2)
            const y = 20 + r * Math.sin(angle - Math.PI / 2)
            const major = i % 3 === 0
            return (
              <div key={i} style={{
                position: 'absolute',
                left: x - 1, top: y - 1, width: 2, height: 2,
                background: PINK,
                opacity: major ? 1 : 0.4,
                boxShadow: major ? `0 0 3px ${PINK}` : 'none',
              }} />
            )
          })}

          {/* Level-up burst ring — remounts on each roll-over (keyed by
              orbBurst) so it replays the expand-and-fade once. */}
          {orbBurst > 0 && (
            <div key={orbBurst} aria-hidden style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 40, height: 40, borderRadius: '50%',
              border: `2px solid ${YELLOW}`,
              boxShadow: `0 0 10px ${yellowA(0.7)}`,
              transform: 'translate(-50%, -50%)',
              animation: 'hudOrbRing 650ms ease-out forwards',
              pointerEvents: 'none',
            }} />
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-pixel" style={{
              fontSize: 4.5, color: YELLOW_HI, letterSpacing: 1.5, lineHeight: 1, marginBottom: 2,
              textShadow: `0 0 3px ${yellowA(0.53)}`,
            }}>LVL</span>
            {/* Wrapper carries the drop-shadow so it can't break the number's
                background-clip:text (Safari quirk → gradient fills the box).
                Keyed by orbBurst so it bounces once on each level roll-over. */}
            <div key={orbBurst} style={{
              filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.35))',
              animation: orbBurst ? 'hudOrbPop 600ms cubic-bezier(0.16,1,0.3,1)' : undefined,
            }}>
              <span
                className="clip-num"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: 13, lineHeight: 1, letterSpacing: -0.5,
                  color: SILVER_HI,
                  '--clip-grad': `linear-gradient(180deg, ${SILVER_HI} 0%, ${SILVER} 50%, ${SILVER_LO} 100%)`,
                } as React.CSSProperties}
              >{dispLevel}</span>
            </div>
          </div>

          {/* Unclaimed reward count badge — same shape as the unread-message
              badge on the home heart button. Sits at the top-right of the orb.
              Painted red instead of the global pink so the "claim me" signal
              stands out against the rest of the pink HUD. */}
          {unclaimedRewards > 0 && (
            <div
              aria-label={`${unclaimedRewards} unclaimed rewards`}
              className="absolute flex items-center justify-center font-pixel"
              style={{
                top: -3, right: -3,
                minWidth: 16, height: 16, padding: '0 3px',
                background: `linear-gradient(180deg, ${RED_HI}, ${RED} 60%, ${RED_LO})`,
                border: '2px solid #050507',
                boxShadow: `0 0 6px ${redA(0.7)}, inset 0 1px 0 rgba(255,255,255,0.3)`,
                fontSize: 6,
                color: '#fff',
                textShadow: '0 1px 0 rgba(0,0,0,0.5)',
                letterSpacing: 0,
                lineHeight: 1,
              }}
            >
              {unclaimedRewards > 99 ? '99+' : unclaimedRewards}
            </div>
          )}
        </Link>

        {/* XP panel — yellow-framed to match the level orb ring, so the
            level + XP form one cohesive cluster (streak/coins stay pink/gold).
            The corner rivets stay pink as little dot accents. */}
        <div
          id="stats-xp-bar"
          className="flex-1 relative flex flex-col justify-center"
          style={{
            height: 40,
            padding: '5px 10px',
            gap: 3,
            ...obsidianFace(YELLOW + '55'),
          }}
        >
          <Rivets inset={3} />
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: 4 }}>
              <div style={{
                width: 5, height: 5, background: YELLOW,
                boxShadow: `0 0 4px ${YELLOW}`,
                transform: 'rotate(45deg)',
              }} />
              <span className="font-pixel" style={{
                fontSize: 7, color: YELLOW_HI, letterSpacing: 2.5,
                textShadow: `0 0 3px ${yellowA(0.4)}`,
              }}>XP</span>
            </div>
            <span className="font-pixel" style={{ fontSize: 7, color: YELLOW_HI }}>
              {xpIntoLevel}<span style={{ color: YELLOW_LO, margin: '0 1px' }}>/</span>{xpNeeded}
            </span>
          </div>

          <div style={{
            height: 8, position: 'relative', overflow: 'hidden',
            background: '#000',
            boxShadow: `inset 0 1px 3px rgba(0,0,0,0.9), inset 0 0 0 1px ${yellowA(0.2)}`,
          }}>
            <div style={{
              width: `${xpPct}%`, height: '100%', position: 'relative',
              // Warm-yellow fill — shares the level ring's hue so the level/XP
              // cluster reads as one unit; still reads as forward progress.
              // The width is driven per-frame by the XP tween, so no CSS
              // transition here (it would lag a second easing on top).
              background: `linear-gradient(180deg, ${YELLOW_HI} 0%, ${YELLOW} 40%, ${YELLOW_LO} 100%)`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.4)',
            }}>
              {xpPct > 2 && xpPct < 100 && (
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 1.5,
                  background: '#fff',
                  boxShadow: `0 0 6px ${YELLOW_HI}, 0 0 10px ${YELLOW}`,
                }} />
              )}
            </div>
            {/* Quarter notches */}
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent 0 calc(25% - 1px), rgba(0,0,0,0.5) calc(25% - 1px) 25%)',
              }}
            />
            {/* Gain sheen — a soft light band sweeps across the filled portion
                each time XP is earned. Clipped to the current fill width so it
                never streaks over the empty track. */}
            {xpTick > 0 && (
              <div key={xpTick} aria-hidden style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, width: `${xpPct}%`,
                overflow: 'hidden', pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, width: '45%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                  animation: 'hudXpSheen 750ms ease-out',
                }} />
              </div>
            )}
          </div>

          {/* Floating "+N XP" chips — rise from the bar and fade on each gain. */}
          {xpFloats.map(f => (
            <div key={f.id} aria-hidden className="font-pixel" style={{
              position: 'absolute', left: `calc(50% + ${f.dx}px)`, top: 2, zIndex: 6,
              color: YELLOW_HI, fontSize: 8, letterSpacing: 1,
              textShadow: `0 0 6px ${yellowA(0.75)}, 0 1px 0 rgba(0,0,0,0.6)`,
              pointerEvents: 'none', whiteSpace: 'nowrap',
              animation: 'hudFloatRise 1.3s ease-out forwards',
            }}>+{f.xp} XP</div>
          ))}
        </div>

        {/* Wish chip — Phase 3. Shows today's wish status + this-week count.
            Lives left of the streak chip so the rivet-rich obsidian face
            visually rhymes with the surrounding chips. */}
        {wish?.wish && wish.status !== 'loading' && (
          <WishChip
            text={wish.text}
            status={wish.status}
            weekGrantedCount={wish.weekGrantedCount}
          />
        )}

        {/* Streak chip — always visible; grayed when inactive. We coerce
            the number defensively because the JSONB column can legitimately
            be missing (new profile) or partial (older row missing fields),
            and previously this rendered as an empty span — looked like
            an unloaded skeleton next to the flame icon. */}
        {(() => {
          const streakNum = Number.isFinite(streak?.current as number) ? (streak.current as number) : 0
          return (
            <div
              className="flex-shrink-0 relative flex items-center"
              style={{
                height: 40,
                padding: '0 8px',
                gap: 4,
                ...obsidianFace(
                  streakNum >= 7 ? 'rgba(255,107,0,0.35)'
                  : streakNum > 0 ? PINK + '55'
                  : 'rgba(255,255,255,0.08)'
                ),
              }}
            >
              <Rivets inset={3} />
              <div style={{
                filter: streakNum >= 7 ? 'drop-shadow(0 0 4px rgba(255,107,0,0.6))'
                  : streakNum > 0 ? `drop-shadow(0 0 3px ${accentA(0.4)})`
                  : 'grayscale(0.8) brightness(0.4)',
              }}>
                <IconFire size={16} />
              </div>
              {/* Wrapper carries the drop-shadow so it can't break the number's
                  background-clip:text (Safari quirk → gradient filled the whole
                  span as a stray "cube"). The solid `color` is the fallback when
                  clipping is unavailable; --clip-grad is the gradient on top. */}
              <div style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.8))' }}>
                <span
                  className="clip-num"
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: 10, lineHeight: 1,
                    color: streakNum >= 7 ? '#FFB000' : streakNum > 0 ? PINK : '#9A92A0',
                    '--clip-grad': streakNum >= 7
                      ? 'linear-gradient(180deg, #FFD700 0%, #FF6B00 60%, #CC3300 100%)'
                      : streakNum > 0
                        ? `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK} 60%, ${PINK_LO} 100%)`
                        : 'linear-gradient(180deg, #B0A8B0 0%, #807880 100%)',
                  } as React.CSSProperties}
                >{streakNum}</span>
              </div>
            </div>
          )
        })()}

        {/* Coins chip */}
        <div
          className="flex-shrink-0 relative flex items-center"
          style={{
            height: 40,
            padding: '0 10px',
            gap: 5,
            ...obsidianFace(PINK + '55'),
          }}
        >
          <Rivets inset={3} />
          <div style={{ filter: `drop-shadow(0 0 3px ${accentA(0.4)})` }}>
            <IconCoin size={16} />
          </div>
          <div key={coinPop} style={{
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.8))',
            animation: coinPop ? 'hudNumPop 450ms cubic-bezier(0.16,1,0.3,1)' : undefined,
            transformOrigin: 'center',
          }}>
            <span
              className="clip-num"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 10, lineHeight: 1,
                color: GOLD_HI,
                '--clip-grad': `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 60%, ${GOLD_LO} 100%)`,
              } as React.CSSProperties}
            >{dispCoins.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Five circular gauges ── */}
      <div className="flex" style={{ gap: 5 }}>
        {GAUGES.map(def => {
          const raw = stats ? (stats as unknown as Record<string, unknown>)[def.key] : 0
          const value = typeof raw === 'number' ? raw : 0
          return <ObsidianGauge key={def.key} def={def} value={value} />
        })}
      </div>
    </div>
  )
}
