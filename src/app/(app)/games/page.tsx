'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import {
  IconController, IconMouse, IconYarn, IconPaw, IconFish,
  IconStar, IconCrown, IconHeart, IconMeat, IconCoin,
  IconScroll, IconLightning, IconSwords, IconHouse, IconCatFace,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import type { GameType } from '@/types'

type GameMeta = {
  id: GameType
  href: string
  title: string
  desc: string
  bg: string
  border: string
  shadow: string
  accent: string
  Icon: React.FC<{ size?: number }>
  preview: React.FC<{ size?: number }>[]
}

const GAMES: GameMeta[] = [
  {
    id: 'catch_mouse' as GameType,
    href: '/games/catch-mouse',
    title: 'CATCH THE MOUSE',
    desc: 'Tap the pixel mouse before it escapes!',
    bg: 'linear-gradient(135deg, #FFF5E0, #FFE8C0)',
    border: '#F5C842',
    shadow: '#D4A020',
    accent: '#B07F10',
    Icon: IconMouse,
    preview: [IconMouse, IconStar, IconStar],
  },
  {
    id: 'paw_tap' as GameType,
    href: '/games/paw-tap',
    title: 'PAW TAP!',
    desc: 'Tap the fish before they swim away!',
    bg: 'linear-gradient(135deg, #E8F6FF, #D0EEFF)',
    border: '#6BAED6',
    shadow: '#3A88B8',
    accent: '#3A88B8',
    Icon: IconFish,
    preview: [IconFish, IconPaw, IconStar],
  },
  {
    id: 'memory_match' as GameType,
    href: '/games/memory-match',
    title: 'PURR-FECT MEMORY',
    desc: 'Flip cards, match pairs, chain combos!',
    bg: 'linear-gradient(135deg, #F3E8FF, #E9D5FF)',
    border: '#A78BFA',
    shadow: '#7C3AED',
    accent: '#7C3AED',
    Icon: IconScroll,
    preview: [IconScroll, IconHeart, IconStar],
  },
  {
    id: 'treat_tumble' as GameType,
    href: '/games/treat-tumble',
    title: 'TREAT TUMBLE',
    desc: 'Drag Eren to catch treats, dodge junk!',
    bg: 'linear-gradient(135deg, #FFF8D0, #FFE8A0)',
    border: '#F59E0B',
    shadow: '#B45309',
    accent: '#B45309',
    Icon: IconMeat,
    preview: [IconFish, IconStar, IconMeat],
  },
  {
    id: 'flappy_eren' as GameType,
    href: '/games/flappy-eren',
    title: 'FIZZY EREN',
    desc: 'Tap to fizz! Dodge pipes, ride the can.',
    bg: 'linear-gradient(135deg, #E8FFF0, #C8F4D8)',
    border: '#10B981',
    shadow: '#047857',
    accent: '#047857',
    Icon: IconLightning,
    preview: [IconLightning, IconStar, IconHeart],
  },
  {
    id: 'tic_tac_toe' as GameType,
    href: '/games/tic-tac-toe',
    title: 'X & O VS EREN',
    desc: "Beat Eren — he plans every move.",
    bg: 'linear-gradient(135deg, #FFE0F0, #FFC8E8)',
    border: '#EC4899',
    shadow: '#9D174D',
    accent: '#9D174D',
    Icon: IconSwords,
    preview: [IconSwords, IconCrown, IconHeart],
  },
  {
    id: 'eren_stack' as GameType,
    href: '/games/eren-stack',
    title: 'EREN STACK',
    desc: 'Tap to drop. Stack pixels to the sky.',
    bg: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
    border: '#3B82F6',
    shadow: '#1D4ED8',
    accent: '#1D4ED8',
    Icon: IconHouse,
    preview: [IconHouse, IconCrown, IconStar],
  },
  {
    id: 'yarn_pop' as GameType,
    href: '/games/yarn-pop',
    title: 'YARN POP',
    desc: 'Match three! Cascade combos for big score.',
    bg: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)',
    border: '#EC4899',
    shadow: '#9D174D',
    accent: '#9D174D',
    Icon: IconHeart,
    preview: [IconHeart, IconYarn, IconStar],
  },
  {
    id: 'eren_says' as GameType,
    href: '/games/eren-says',
    title: 'EREN SAYS',
    desc: 'Watch his paws — repeat the song.',
    bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
    border: '#7C3AED',
    shadow: '#4C1D95',
    accent: '#4C1D95',
    Icon: IconCatFace,
    preview: [IconCatFace, IconPaw, IconStar],
  },
  {
    id: 'lane_runner' as GameType,
    href: '/games/lane-runner',
    title: 'LANE RUNNER',
    desc: 'Three lanes. Dodge or perish. Run forever.',
    bg: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)',
    border: '#16A34A',
    shadow: '#166534',
    accent: '#166534',
    Icon: IconCoin,
    preview: [IconCoin, IconStar, IconCoin],
  },
]

export default function GamesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { setHideStats } = useCare()
  // Hide the persistent StatsHeader on the games page — the page has its
  // own glass header with a back button, and the StatsHeader was covering
  // it in iOS PWA mode. Stats are still visible on /home and /care scenes.
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const supabase = createClient()

  // Just my own personal-bests for the per-card score chip — the full
  // household leaderboard now lives as a modal opened from the playroom.
  const [myScores, setMyScores] = useState<Partial<Record<GameType, number>>>({})

  useEffect(() => {
    if (!user?.id) return
    async function load() {
      const { data: scores } = await supabase
        .from('game_scores')
        .select('game_type, score')
        .eq('user_id', user!.id)

      const best: Partial<Record<GameType, number>> = {}
      scores?.forEach((s: { game_type: GameType; score: number }) => {
        const current = best[s.game_type] ?? 0
        if (s.score > current) best[s.game_type] = s.score
      })
      setMyScores(best)
    }
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-scroll relative" style={{
      background: 'radial-gradient(ellipse at top, #2C1659 0%, #170B33 55%, #08051C 100%)',
      minHeight: '100vh',
      marginLeft: -16, marginRight: -16, marginTop: -16,
      paddingLeft: 16, paddingRight: 16,
      // StatsHeader is hidden on this page; only reserve the iOS PWA
      // safe-area at the top so the back button isn't under the status bar.
      paddingTop: 'calc(var(--safe-top) + 12px)', paddingBottom: 24,
    }}>
      {/* Drifting starfield + scanlines for the academy / arcade vibe */}
      <div className="absolute inset-0 pointer-events-none opacity-50" style={{
        backgroundImage: 'radial-gradient(circle, #FBBF24 1px, transparent 1px), radial-gradient(circle, #A78BFA 1px, transparent 1px)',
        backgroundSize: '38px 38px, 56px 56px',
        backgroundPosition: '0 0, 22px 28px',
        animation: 'gpStarDrift 32s linear infinite',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)',
        zIndex: 1,
      }} />

      {/* ── Glass header ── */}
      <div className="relative z-20 flex items-center gap-2 mb-2 px-2 py-2.5 -mx-2" style={{
        background: 'linear-gradient(180deg, rgba(20,8,40,0.85) 0%, rgba(20,8,40,0.55) 100%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 8,
        border: '1px solid rgba(251,191,36,0.4)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 34, height: 34,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(167,139,250,0.5)',
            borderRadius: 8,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          }}>
          <ChevronLeft size={18} className="text-purple-200" />
        </button>
        <span className="font-pixel inline-flex items-center gap-2 px-3 py-1.5"
          style={{
            background: 'linear-gradient(180deg, rgba(20,8,40,0.7), rgba(0,0,0,0.5))',
            border: '1.5px solid #FBBF24',
            borderRadius: 6,
            fontSize: 10, letterSpacing: 2.5,
            color: '#FDE68A',
            textShadow: '1px 1px 0 rgba(0,0,0,0.6), 0 0 8px rgba(251,191,36,0.4)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(251,191,36,0.25)',
          }}>
          <IconController size={14} />
          ARCADE
        </span>
        <div className="flex-1" />
        <span className="font-pixel inline-flex items-center gap-1.5 px-2 py-1.5"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(244,114,182,0.5)',
            borderRadius: 5,
            fontSize: 6, letterSpacing: 1.4,
            color: '#FBCFE8',
          }}>
          <IconHeart size={11} />
          PLAY EARNS XP
        </span>
      </div>

      {/* ── Premium game cards ── */}
      <div className="relative z-10 flex flex-col gap-3 mb-7 mt-4">
        {GAMES.map(game => {
          const myBest = myScores[game.id]
          return (
            <Link key={game.id} href={game.href} onClick={() => playSound('ui_tap')}>
              <div
                className="relative overflow-hidden active:translate-y-[2px] transition-all"
                style={{
                  background: `linear-gradient(135deg, rgba(20,10,40,0.85) 0%, rgba(8,4,22,0.95) 100%)`,
                  borderRadius: 10,
                  border: `1.5px solid ${game.border}AA`,
                  boxShadow: `
                    0 6px 22px rgba(0,0,0,0.55),
                    inset 0 1px 0 rgba(255,255,255,0.08),
                    inset 0 -1px 0 rgba(0,0,0,0.4),
                    0 0 18px ${game.border}33
                  `,
                }}>
                {/* Theme color glow strip on the left */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, width: 4,
                  background: `linear-gradient(180deg, ${game.border}, ${game.shadow})`,
                  boxShadow: `0 0 12px ${game.border}88`,
                }} />
                {/* Subtle radial color haze in the icon area */}
                <div style={{
                  position: 'absolute', top: 4, left: 14, width: 80, height: 80,
                  background: `radial-gradient(circle, ${game.border}55 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
                {/* Corner gold rivets */}
                <div style={{ position: 'absolute', top: 6, right: 6, width: 4, height: 4, background: '#FBBF24', opacity: 0.85, boxShadow: '0 0 4px rgba(251,191,36,0.6)' }} />
                <div style={{ position: 'absolute', bottom: 6, right: 6, width: 4, height: 4, background: '#FBBF24', opacity: 0.85, boxShadow: '0 0 4px rgba(251,191,36,0.6)' }} />

                <div className="relative flex items-center gap-4 p-4 pl-5">
                  {/* Icon tile — embossed coin look */}
                  <div className="flex-shrink-0 flex items-center justify-center relative"
                    style={{
                      width: 64, height: 64,
                      background: `radial-gradient(circle at 35% 30%, ${game.border}DD 0%, ${game.shadow} 75%)`,
                      borderRadius: 10,
                      border: `1.5px solid #FBBF24`,
                      boxShadow: `
                        inset 0 2px 0 rgba(255,255,255,0.35),
                        inset 0 -2px 0 rgba(0,0,0,0.3),
                        0 4px 12px ${game.border}66,
                        0 0 0 3px rgba(251,191,36,0.15)
                      `,
                    }}>
                    <div className="absolute inset-1.5 rounded-md flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.12)' }}>
                      <game.Icon size={32} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel mb-1.5" style={{
                      fontSize: 9,
                      color: '#FDE68A',
                      letterSpacing: 1.5,
                      textShadow: `0 1px 0 rgba(0,0,0,0.6), 0 0 6px ${game.border}55`,
                    }}>
                      {game.title}
                    </p>
                    <p className="text-xs leading-snug mb-2" style={{ color: '#C4B5FD', letterSpacing: 0.2 }}>
                      {game.desc}
                    </p>
                    <div className="flex gap-1.5 items-center" style={{ opacity: 0.85 }}>
                      {game.preview.map((Preview, i) => (
                        <div key={i} style={{ opacity: 0.7 + i * 0.1 }}>
                          <Preview size={13} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    {myBest !== undefined && (
                      <div className="flex flex-col items-center px-2.5 py-1"
                        style={{
                          background: 'linear-gradient(180deg, rgba(120,53,15,0.55), rgba(67,20,7,0.7))',
                          border: '1px solid #FBBF24',
                          borderRadius: 5,
                          minWidth: 46,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(251,191,36,0.3)',
                        }}>
                        <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1.5, color: 'rgba(253,230,138,0.7)' }}>BEST</span>
                        <span className="font-pixel" style={{ fontSize: 11, color: '#FDE68A', textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}>{myBest}</span>
                      </div>
                    )}
                    <span className="font-pixel" style={{ fontSize: 12, color: game.border, textShadow: `0 0 6px ${game.border}99` }}>▶</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* (Household leaderboard moved — it now lives as a modal in the
          playroom, opened via the LEADERBOARD button in PlayScene.) */}

      {/* ── Happiness banner — premium dark with gold trim ── */}
      <div className="relative z-10 mt-4 p-3 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(76,29,149,0.55) 0%, rgba(46,15,92,0.75) 100%)',
          borderRadius: 6,
          border: '1.5px solid rgba(251,191,36,0.5)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(251,191,36,0.2), 0 0 18px rgba(167,139,250,0.18)',
        }}>
        <div className="absolute inset-0 opacity-25 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }} />
        <div className="flex items-center justify-center gap-2 relative">
          <IconStar size={14} />
          <p className="font-pixel text-center" style={{
            fontSize: 7, lineHeight: 2, letterSpacing: 1.5,
            color: '#FDE68A',
            textShadow: '0 1px 0 rgba(0,0,0,0.5), 0 0 8px rgba(251,191,36,0.4)',
          }}>
            PLAYING RAISES EREN&apos;S HAPPINESS
          </p>
          <IconStar size={14} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes gpStarDrift {
          from { background-position: 0 0, 22px 28px; }
          to   { background-position: 200px 0, 222px 28px; }
        }
      `}</style>
    </div>
  )
}
