'use client'

// ─── Leaderboard modal ─────────────────────────────────────────────────────
// Premium dark/CRT scoreboard for the household. Each game gets one tight
// row: icon · name · score-box · score-box. Winner is highlighted with a
// gold border + subtle crown chip; ties show a yellow chip; missing scores
// show a dash. Sticky header (with X) stays put while the body scrolls,
// and a big CLOSE button at the bottom makes the exit unmissable.

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  IconStar, IconCrown,
  IconMouse, IconFish, IconScroll, IconMeat, IconLightning,
  IconSwords, IconHouse, IconHeart, IconCatFace, IconCoin,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import type { GameType, Profile } from '@/types'

const GAMES: Array<{ id: GameType; title: string; Icon: React.FC<{ size?: number }> }> = [
  { id: 'catch_mouse',  title: 'CATCH THE MOUSE',  Icon: IconMouse },
  { id: 'paw_tap',      title: 'PAW TAP!',         Icon: IconFish },
  { id: 'memory_match', title: 'PURR-FECT MEMORY', Icon: IconScroll },
  { id: 'treat_tumble', title: 'TREAT TUMBLE',     Icon: IconMeat },
  { id: 'flappy_eren',  title: 'FIZZY EREN',       Icon: IconLightning },
  { id: 'tic_tac_toe',  title: 'X & O VS EREN',    Icon: IconSwords },
  { id: 'eren_stack',   title: 'EREN STACK',       Icon: IconHouse },
  { id: 'yarn_pop',     title: 'YARN POP',         Icon: IconHeart },
  { id: 'eren_says',    title: 'EREN SAYS',        Icon: IconCatFace },
  { id: 'lane_runner',  title: 'LANE RUNNER',      Icon: IconCoin },
]

interface PlayerScores {
  profile: Profile
  best: Partial<Record<GameType, number>>
}

interface Props { onClose: () => void }

// ── Score-box atom ─────────────────────────────────────────────────────────
function ScoreBox({ score, winner, side, big }: {
  score: number
  winner: boolean
  side: 'me' | 'them'
  big?: boolean
}) {
  const empty = score === 0
  const meColors = {
    bg:    'linear-gradient(135deg, #3A1A30 0%, #5A1A3A 100%)',
    border:'#FF4080',
    text:  '#FF9EC8',
  }
  const themColors = {
    bg:    'linear-gradient(135deg, #1A1A40 0%, #1A305A 100%)',
    border:'#4A90BC',
    text:  '#88C8F0',
  }
  const c = side === 'me' ? meColors : themColors
  return (
    <div style={{
      width: big ? 64 : 56,
      height: big ? 32 : 28,
      background: empty ? 'rgba(255,255,255,0.04)' : winner ? c.bg : 'rgba(255,255,255,0.04)',
      border: `${winner ? 2 : 1}px solid ${empty ? '#2A1A50' : winner ? '#FFD700' : c.border}`,
      borderRadius: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: winner ? `0 0 8px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)` : 'inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      <span className="font-pixel" style={{
        fontSize: big ? 11 : 10,
        color: empty ? '#3A2A60' : winner ? '#FFD700' : c.text,
        textShadow: winner ? '0 0 4px rgba(255,215,0,0.6)' : 'none',
        letterSpacing: 0.5,
      }}>
        {empty ? '—' : score}
      </span>
    </div>
  )
}

// ── Avatar disc ────────────────────────────────────────────────────────────
function AvatarDisc({ letter, side, label, big }: {
  letter: string
  side: 'me' | 'them'
  label: string
  big?: boolean
}) {
  const sizes = big ? { w: 36, h: 36, fs: 14 } : { w: 32, h: 32, fs: 12 }
  const meBg    = 'linear-gradient(135deg, #FF6B9D, #C084FC)'
  const themBg  = 'linear-gradient(135deg, #6BAED6, #3A88C8)'
  const meBorder = '#FF4080'; const meShadow = '0 2px 0 #991A4A'
  const themBorder = '#4A90BC'; const themShadow = '0 2px 0 #205888'
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 64 }}>
      <div className="flex items-center justify-center font-pixel"
        style={{
          width: sizes.w, height: sizes.h, borderRadius: 4,
          background: side === 'me' ? meBg : themBg,
          border: `2px solid ${side === 'me' ? meBorder : themBorder}`,
          boxShadow: side === 'me' ? meShadow : themShadow,
          fontSize: sizes.fs, color: 'white',
          textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        }}>
        {letter}
      </div>
      <span className="font-pixel" style={{
        fontSize: 6,
        color: side === 'me' ? '#FF9EC8' : '#88C8F0',
        letterSpacing: 1,
        maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}

export default function Leaderboard({ onClose }: Props) {
  const { user, profile } = useAuth()
  const supabase = createClient()
  const [players, setPlayers] = useState<PlayerScores[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !profile) return
    async function load() {
      const profilesQuery = profile!.household_id
        ? supabase.from('profiles').select('*').eq('household_id', profile!.household_id)
        : supabase.from('profiles').select('*').eq('id', user!.id)

      const { data: profiles } = await profilesQuery
      const resolved: Profile[] = profiles?.length ? profiles : [profile!]

      const userIds = resolved.map((p: Profile) => p.id)
      const { data: scores } = await supabase
        .from('game_scores')
        .select('user_id, game_type, score')
        .in('user_id', userIds)

      const bestMap: Record<string, Partial<Record<GameType, number>>> = {}
      scores?.forEach((s: { user_id: string; game_type: GameType; score: number }) => {
        if (!bestMap[s.user_id]) bestMap[s.user_id] = {}
        const cur = bestMap[s.user_id][s.game_type] ?? 0
        if (s.score > cur) bestMap[s.user_id][s.game_type] = s.score
      })

      setPlayers(resolved.map((p: Profile) => ({ profile: p, best: bestMap[p.id] ?? {} })))
      setLoading(false)
    }
    load()
  }, [user?.id, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sorted: me first, partner second.
  const sorted = [...players].sort((a, b) =>
    a.profile.id === user?.id ? -1 : b.profile.id === user?.id ? 1 : 0
  )
  const me      = sorted[0]
  const partner = sorted[1]

  const totals = sorted.map(p => GAMES.reduce((s, g) => s + (p.best[g.id] ?? 0), 0))
  const myTotal      = totals[0] ?? 0
  const partnerTotal = totals[1] ?? 0
  const winnerSide: 'me' | 'them' | 'tie' | 'solo' = !partner ? 'solo'
    : myTotal === partnerTotal ? 'tie'
    : myTotal > partnerTotal ? 'me' : 'them'

  function handleClose() {
    playSound('ui_back')
    onClose()
  }

  const meLetter = me?.profile.name?.[0]?.toUpperCase() ?? '?'
  const partnerLetter = partner?.profile.name?.[0]?.toUpperCase() ?? '?'
  const partnerLabel = partner?.profile.name?.split(' ')[0]?.toUpperCase() ?? 'P2'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ animation: 'lbFade 0.2s ease-out forwards' }}>
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={handleClose}
        style={{ background: 'rgba(8,5,18,0.82)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />

      {/* Panel */}
      <div className="relative flex flex-col"
        style={{
          width: 'min(94vw, 440px)',
          maxHeight: 'calc(100vh - 24px - var(--safe-top))',
          background: 'linear-gradient(180deg, #150930 0%, #0B061C 100%)',
          borderRadius: 8,
          border: '3px solid #4C1D95',
          boxShadow: '0 8px 0 #2E0F5C, 0 0 32px rgba(167,139,250,0.55)',
          animation: 'lbPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
          overflow: 'hidden',
        }}>

        {/* CRT scanline overlay (over everything inside panel) */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.10) 3px, rgba(0,0,0,0.10) 4px)',
          zIndex: 30,
        }} />
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 65%, rgba(0,0,0,0.55) 100%)',
          zIndex: 30,
        }} />

        {/* ─── HEADER (sticky top, with close X) ──────────────────────────── */}
        <div className="relative flex items-center px-4 py-3 flex-shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(76,29,149,0.5) 0%, rgba(46,15,92,0.4) 100%)',
            borderBottom: '2px solid rgba(251,191,36,0.55)',
            zIndex: 20,
          }}>
          {/* Corner gold pixels */}
          <div style={{ position: 'absolute', top: 4, left: 4, width: 4, height: 4, background: '#FFD700' }} />
          <div style={{ position: 'absolute', top: 4, right: 4, width: 4, height: 4, background: '#FFD700' }} />

          {/* Spacer for centring */}
          <div style={{ width: 32 }} />

          <div className="flex-1 flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-2">
              <IconStar size={12} />
              <span className="font-pixel" style={{
                fontSize: 11, color: '#FFD700', letterSpacing: 3,
                textShadow: '0 0 8px rgba(255,215,0,0.55)',
              }}>HIGH SCORES</span>
              <IconStar size={12} />
            </div>
            <div className="font-pixel" style={{ fontSize: 5, color: '#A080C0', letterSpacing: 1.5 }}>HOUSEHOLD LEADERBOARD</div>
          </div>

          {/* Close X — large, obvious, gold-ringed */}
          <button onClick={handleClose} aria-label="Close leaderboard"
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{
              width: 32, height: 32,
              background: 'rgba(0,0,0,0.55)',
              border: '2px solid #FBBF24',
              borderRadius: 5,
              boxShadow: '0 2px 0 rgba(0,0,0,0.5), 0 0 8px rgba(251,191,36,0.4)',
              flexShrink: 0,
            }}>
            <X size={16} className="text-yellow-300" strokeWidth={3} />
          </button>
        </div>

        {/* ─── BODY (scrollable) ──────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-y-auto px-4 pt-3 pb-4" style={{ scrollbarWidth: 'thin' }}>
          {loading ? (
            <p className="font-pixel text-center py-10" style={{ fontSize: 7, color: '#6A50A0', letterSpacing: 2 }}>
              LOADING...
            </p>
          ) : (
            <>
              {/* Avatars row */}
              <div className="flex items-center mb-3">
                <div className="flex-1" />
                <AvatarDisc letter={meLetter} side="me" label="YOU" />
                <div style={{ width: 8 }} />
                {partner ? (
                  <AvatarDisc letter={partnerLetter} side="them" label={partnerLabel} />
                ) : (
                  <div className="flex flex-col items-center gap-1" style={{ width: 64 }}>
                    <div className="flex items-center justify-center font-pixel"
                      style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '2px dashed #3A2A60', fontSize: 14, color: '#3A2A60' }}>
                      ?
                    </div>
                    <span className="font-pixel" style={{ fontSize: 6, color: '#3A2A60' }}>P2</span>
                  </div>
                )}
              </div>

              <div className="mb-3" style={{ borderTop: '1px dashed #3A2A60' }} />

              {/* Game rows — single line each: icon + name + score boxes */}
              {GAMES.map(game => {
                const s0 = me?.best[game.id] ?? 0
                const s1 = partner?.best[game.id] ?? 0
                const meWins   = !!partner && s0 > s1 && s0 > 0
                const themWins = !!partner && s1 > s0 && s1 > 0
                const tied     = !!partner && s0 === s1 && s0 > 0
                return (
                  <div key={game.id} className="flex items-center mb-2 py-1.5 px-2"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(167,139,250,0.12)',
                      borderRadius: 4,
                    }}>
                    <div className="flex-shrink-0 mr-2" style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
                      <game.Icon size={14} />
                    </div>
                    <span className="flex-1 font-pixel truncate"
                      style={{ fontSize: 6, color: '#A080C0', letterSpacing: 0.8 }}>
                      {game.title}
                      {tied && (
                        <span className="font-pixel ml-2 px-1 py-0.5"
                          style={{ fontSize: 5, color: '#FFD700', background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.5)', borderRadius: 2, letterSpacing: 1 }}>
                          TIE
                        </span>
                      )}
                    </span>
                    <ScoreBox score={s0} winner={meWins}   side="me" />
                    <div style={{ width: 6 }} />
                    <ScoreBox score={s1} winner={themWins} side="them" />
                  </div>
                )
              })}

              {/* Total row */}
              <div className="flex items-center mt-3 pt-3 px-2"
                style={{ borderTop: '2px solid #FFD700' }}>
                <div className="flex-shrink-0 mr-2" style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
                  <IconCrown size={14} />
                </div>
                <span className="flex-1 font-pixel" style={{ fontSize: 8, color: '#FFD700', letterSpacing: 2 }}>TOTAL</span>
                <ScoreBox score={myTotal}      winner={winnerSide === 'me'}   side="me"   big />
                <div style={{ width: 6 }} />
                <ScoreBox score={partnerTotal} winner={winnerSide === 'them'} side="them" big />
              </div>

              {/* Winner / tie / invite banner */}
              {winnerSide === 'solo' && (
                <div className="mt-4 py-2 px-3 flex items-center justify-center"
                  style={{ background: 'rgba(160,120,255,0.08)', borderRadius: 4, border: '1px dashed #3A2A60' }}>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#5A408A', lineHeight: 1.8, letterSpacing: 1, textAlign: 'center' }}>
                    INVITE A PARTNER TO COMPETE!
                  </span>
                </div>
              )}
              {winnerSide === 'tie' && (
                <div className="mt-4 py-2 px-3 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(160,120,255,0.10)', borderRadius: 4, border: '1px dashed #A080C0' }}>
                  <span className="font-pixel" style={{ fontSize: 7, color: '#C0A0F0', letterSpacing: 2 }}>IT&apos;S A TIE!</span>
                </div>
              )}
              {(winnerSide === 'me' || winnerSide === 'them') && (
                <div className="mt-4 py-2.5 px-3 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,215,0,0.18) 0%, rgba(255,180,0,0.10) 100%)',
                    borderRadius: 4,
                    border: '2px solid #FFD700',
                    boxShadow: '0 0 12px rgba(255,215,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}>
                  <IconCrown size={14} />
                  <span className="font-pixel" style={{ fontSize: 7, color: '#FFD700', letterSpacing: 2, textShadow: '0 0 6px rgba(255,215,0,0.6)' }}>
                    {winnerSide === 'me' ? 'YOU ARE WINNING!' : `${partnerLabel} IS WINNING!`}
                  </span>
                  <IconCrown size={14} />
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── FOOTER (sticky bottom, prominent CLOSE) ────────────────────── */}
        <div className="relative flex-shrink-0 px-4 py-3"
          style={{
            background: 'linear-gradient(0deg, rgba(76,29,149,0.5) 0%, rgba(46,15,92,0.4) 100%)',
            borderTop: '2px solid rgba(167,139,250,0.5)',
            zIndex: 20,
          }}>
          <button onClick={handleClose}
            className="w-full active:translate-y-[2px] transition-transform flex items-center justify-center gap-2 py-2.5"
            style={{
              background: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 60%, #4C1D95 100%)',
              border: '2px solid #4C1D95',
              borderRadius: 4,
              boxShadow: '0 4px 0 #2E0F5C, inset 0 1px 0 rgba(255,255,255,0.35)',
            }}>
            <X size={14} className="text-white" strokeWidth={3} />
            <span className="font-pixel text-white" style={{ fontSize: 9, letterSpacing: 2, textShadow: '1px 1px 0 #2E0F5C' }}>
              CLOSE
            </span>
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes lbFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lbPop {
          0%   { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
