'use client'

// ─── Leaderboard modal ────────────────────────────────────────────────────
// Self-contained household leaderboard. Pulls every player in the current
// household, joins their best score per game, and renders a head-to-head
// scoreboard with totals and a "winning" call-out. Used as a modal opened
// from the playroom (PlayScene). The styling matches the original
// dark-CRT leaderboard that used to live inline on the /games page.
// ─────────────────────────────────────────────────────────────────────────

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

// Minimal list — id + title + icon are all the leaderboard needs. Kept in
// sync with the GAMES list in the /games page (one source of truth would
// be nicer, but the games page also holds layout-specific colour metadata
// and gravity-defying duplication felt worse than this 11-line stub).
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

export default function Leaderboard({ onClose }: Props) {
  const { user, profile } = useAuth()
  const supabase = createClient()
  const [players, setPlayers] = useState<PlayerScores[]>([])
  const [boardLoading, setBoardLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !profile) return

    async function load() {
      const profilesQuery = profile!.household_id
        ? supabase.from('profiles').select('*').eq('household_id', profile!.household_id)
        : supabase.from('profiles').select('*').eq('id', user!.id)

      const { data: profiles } = await profilesQuery
      const resolvedProfiles: Profile[] = profiles?.length ? profiles : [profile!]

      const userIds = resolvedProfiles.map((p: Profile) => p.id)

      const { data: scores } = await supabase
        .from('game_scores')
        .select('user_id, game_type, score')
        .in('user_id', userIds)

      const bestMap: Record<string, Partial<Record<GameType, number>>> = {}
      scores?.forEach((s: { user_id: string; game_type: GameType; score: number }) => {
        if (!bestMap[s.user_id]) bestMap[s.user_id] = {}
        const current = bestMap[s.user_id][s.game_type] ?? 0
        if (s.score > current) bestMap[s.user_id][s.game_type] = s.score
      })

      setPlayers(resolvedProfiles.map((p: Profile) => ({ profile: p, best: bestMap[p.id] ?? {} })))
      setBoardLoading(false)
    }

    load()
  }, [user?.id, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedPlayers = [...players].sort((a, b) =>
    a.profile.id === user?.id ? -1 : b.profile.id === user?.id ? 1 : 0
  )

  const totals = sortedPlayers.map(p =>
    GAMES.reduce((sum, g) => sum + (p.best[g.id] ?? 0), 0)
  )

  function handleClose() {
    playSound('ui_back')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: 'lbFade 0.2s ease-out forwards' }}>
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={handleClose}
        style={{ background: 'rgba(8,5,18,0.78)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />

      {/* Panel */}
      <div className="relative overflow-hidden flex flex-col"
        style={{
          width: 'min(92vw, 420px)',
          maxHeight: '88vh',
          background: 'linear-gradient(180deg, #0E0E2C 0%, #1A1A3E 100%)',
          borderRadius: 6,
          border: '3px solid #3A2A60',
          boxShadow: '4px 4px 0 #1A0A40, 0 0 32px rgba(167,139,250,0.45)',
          animation: 'lbPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>

        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
          zIndex: 1,
        }} />
        {/* CRT vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)', zIndex: 1 }} />
        {/* Corner pixels */}
        <div style={{ position: 'absolute', top: 4, left: 4, width: 6, height: 6, border: '1px solid #FFD700', opacity: 0.6, zIndex: 2 }} />
        <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, border: '1px solid #FFD700', opacity: 0.6, zIndex: 2 }} />
        <div style={{ position: 'absolute', bottom: 4, left: 4, width: 6, height: 6, border: '1px solid #FFD700', opacity: 0.6, zIndex: 2 }} />
        <div style={{ position: 'absolute', bottom: 4, right: 4, width: 6, height: 6, border: '1px solid #FFD700', opacity: 0.6, zIndex: 2 }} />

        {/* Close button */}
        <button onClick={handleClose}
          className="absolute top-3 right-3 z-20 flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 28, height: 28,
            background: 'rgba(0,0,0,0.5)',
            border: '2px solid rgba(255,215,0,0.55)',
            borderRadius: 5,
            boxShadow: '0 2px 0 rgba(0,0,0,0.4)',
          }}>
          <X size={14} className="text-yellow-300" />
        </button>

        {/* Scrollable content */}
        <div className="relative z-10 p-4 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {/* Title */}
          <div className="flex flex-col items-center mb-4">
            <div className="flex items-center gap-3 mb-1">
              <div style={{ animation: 'twinkle 1.5s ease-in-out infinite' }}>
                <IconStar size={14} />
              </div>
              <span className="font-pixel" style={{ fontSize: 11, color: '#FFD700', letterSpacing: 3, textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>HIGH SCORES</span>
              <div style={{ animation: 'twinkle 1.5s ease-in-out 0.75s infinite' }}>
                <IconStar size={14} />
              </div>
            </div>
            <div className="font-pixel" style={{ fontSize: 6, color: '#A080C0', letterSpacing: 1 }}>HOUSEHOLD LEADERBOARD</div>
            <div className="w-full mt-3" style={{ borderTop: '1px dashed #3A2A60' }} />
          </div>

          {boardLoading ? (
            <p className="font-pixel text-center py-8" style={{ fontSize: 6, color: '#6A50A0', letterSpacing: 2 }}>LOADING...</p>
          ) : sortedPlayers.length < 2 ? (
            <>
              <div className="grid mb-3" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4 }}>
                <div />
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center justify-center font-pixel"
                    style={{ width: 28, height: 28, borderRadius: 3, background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', border: '2px solid #FF4080', boxShadow: '0 2px 0 #991A4A', fontSize: 10, color: 'white' }}>
                    {sortedPlayers[0]?.profile.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#FF9EC8' }}>YOU</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center justify-center"
                    style={{ width: 28, height: 28, borderRadius: 3, background: 'rgba(255,255,255,0.05)', border: '2px dashed #3A2A60', fontSize: 12, color: '#3A2A60' }}>
                    ?
                  </div>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#3A2A60' }}>P2</span>
                </div>
              </div>

              {GAMES.map(game => {
                const myScore = sortedPlayers[0]?.best[game.id] ?? 0
                return (
                  <div key={game.id} className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <game.Icon size={14} />
                      <span className="font-pixel" style={{ fontSize: 6, color: '#8060A8' }}>{game.title}</span>
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4, alignItems: 'center' }}>
                      <div />
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center"
                          style={{ width: 72, height: 28, background: myScore > 0 ? 'linear-gradient(135deg, #3A1A30, #5A1A3A)' : 'rgba(255,255,255,0.04)', borderRadius: 3, border: `1px solid ${myScore > 0 ? '#FF4080' : '#2A1A50'}` }}>
                          <span className="font-pixel" style={{ fontSize: myScore === 0 ? 8 : 11, color: myScore === 0 ? '#3A2A60' : '#FF9EC8' }}>
                            {myScore === 0 ? '—' : myScore}
                          </span>
                        </div>
                        {myScore > 0 && (
                          <div style={{ width: 72, height: 4, background: '#1A1040', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #FF6B9D, #FF4080)', borderRadius: 2 }} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center"
                        style={{ width: 72, height: 28, borderRadius: 3, border: '1px dashed #2A1A50' }}>
                        <span className="font-pixel" style={{ fontSize: 8, color: '#2A1A50' }}>—</span>
                      </div>
                    </div>
                    <div className="mt-2" style={{ borderTop: '1px dashed #2A1A50' }} />
                  </div>
                )
              })}

              <div className="mt-2 py-2 px-3 flex items-center justify-center"
                style={{ background: 'rgba(160,120,255,0.06)', borderRadius: 3, border: '1px dashed #3A2A60' }}>
                <span className="font-pixel" style={{ fontSize: 5, color: '#5A408A', lineHeight: 2, textAlign: 'center' }}>
                  INVITE A PARTNER TO COMPETE!
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="grid mb-3" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4 }}>
                <div />
                {sortedPlayers.map((p, pi) => (
                  <div key={p.profile.id} className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center justify-center font-pixel"
                      style={{ width: 28, height: 28, borderRadius: 3, background: pi === 0 ? 'linear-gradient(135deg, #FF6B9D, #C084FC)' : 'linear-gradient(135deg, #6BAED6, #3A88C8)', border: pi === 0 ? '2px solid #FF4080' : '2px solid #4A90BC', boxShadow: pi === 0 ? '0 2px 0 #991A4A' : '0 2px 0 #205888', fontSize: 10, color: 'white' }}>
                      {p.profile.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="font-pixel text-center" style={{ fontSize: 6, color: pi === 0 ? '#FF9EC8' : '#88C8F0', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.profile.id === user?.id ? 'YOU' : p.profile.name?.split(' ')[0]?.toUpperCase() ?? 'P2'}
                    </span>
                  </div>
                ))}
              </div>

              {GAMES.map(game => {
                const s0 = sortedPlayers[0].best[game.id] ?? 0
                const s1 = sortedPlayers[1].best[game.id] ?? 0
                const p0wins = s0 > s1
                const p1wins = s1 > s0
                const tied   = s0 === s1 && s0 > 0

                return (
                  <div key={game.id} className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <game.Icon size={14} />
                      <span className="font-pixel" style={{ fontSize: 6, color: '#8060A8' }}>{game.title}</span>
                      {tied && <span className="font-pixel" style={{ fontSize: 5, color: '#FFD700' }}>TIE!</span>}
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4, alignItems: 'center' }}>
                      <div />
                      {[
                        { score: s0, wins: p0wins, idx: 0 },
                        { score: s1, wins: p1wins, idx: 1 },
                      ].map(({ score, wins, idx }) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <div className="relative flex items-center justify-center"
                            style={{ width: 72, height: 28, background: wins ? (idx === 0 ? 'linear-gradient(135deg, #3A1A30, #5A1A3A)' : 'linear-gradient(135deg, #1A1A40, #1A305A)') : 'rgba(255,255,255,0.04)', borderRadius: 3, border: `1px solid ${wins ? (idx === 0 ? '#FF4080' : '#4A90BC') : '#2A1A50'}` }}>
                            {wins && (
                              <div style={{ position: 'absolute', top: -10, right: -4, lineHeight: 0 }}>
                                <IconCrown size={14} />
                              </div>
                            )}
                            <span className="font-pixel" style={{ fontSize: score === 0 ? 8 : 11, color: score === 0 ? '#3A2A60' : wins ? (idx === 0 ? '#FF9EC8' : '#88C8F0') : '#7A60A8' }}>
                              {score === 0 ? '—' : score}
                            </span>
                          </div>
                          {(s0 > 0 || s1 > 0) && (
                            <div style={{ width: 72, height: 4, background: '#1A1040', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.max(s0, s1) > 0 ? (score / Math.max(s0, s1)) * 100 : 0}%`,
                                background: wins ? (idx === 0 ? 'linear-gradient(90deg, #FF6B9D, #FF4080)' : 'linear-gradient(90deg, #6BAED6, #4A90BC)') : '#3A2A60',
                                borderRadius: 2,
                                transition: 'width 0.6s ease',
                              }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2" style={{ borderTop: '1px dashed #2A1A50' }} />
                  </div>
                )
              })}

              <div className="mt-1">
                <div className="grid" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4, alignItems: 'center' }}>
                  <div className="flex items-center gap-1">
                    <IconCrown size={12} />
                    <span className="font-pixel" style={{ fontSize: 6, color: '#FFD700' }}>TOTAL</span>
                  </div>
                  {sortedPlayers.map((p, pi) => {
                    const total = totals[pi]
                    const isTopTotal = total > totals[1 - pi]
                    return (
                      <div key={p.profile.id} className="flex flex-col items-center gap-1">
                        <div className="relative flex items-center justify-center"
                          style={{ width: 72, height: 30, background: isTopTotal ? (pi === 0 ? 'linear-gradient(135deg, #3A1A10, #5A2A00)' : 'linear-gradient(135deg, #0A1A30, #0A2840)') : 'rgba(255,255,255,0.04)', borderRadius: 3, border: `2px solid ${isTopTotal ? '#FFD700' : '#2A1A50'}`, boxShadow: isTopTotal ? `0 0 8px ${pi === 0 ? 'rgba(255,180,0,0.4)' : 'rgba(100,180,255,0.3)'}` : 'none' }}>
                          {isTopTotal && (
                            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', lineHeight: 0 }}>
                              <IconCrown size={16} />
                            </div>
                          )}
                          <span className="font-pixel" style={{ fontSize: 12, color: isTopTotal ? '#FFD700' : '#4A3870' }}>
                            {total}
                          </span>
                        </div>
                        <div style={{ width: 72, height: 4, background: '#1A1040', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.max(...totals) > 0 ? (total / Math.max(...totals)) * 100 : 0}%`,
                            background: isTopTotal ? 'linear-gradient(90deg, #FFD700, #FFA020)' : '#3A2A60',
                            borderRadius: 2,
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {totals[0] !== totals[1] && (
                <div className="mt-4 py-2 px-3 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,215,0,0.08)', borderRadius: 3, border: '1px dashed #FFD700' }}>
                  <IconCrown size={16} />
                  <span className="font-pixel" style={{ fontSize: 6, color: '#FFD700', letterSpacing: 1 }}>
                    {(totals[0] > totals[1] ? sortedPlayers[0] : sortedPlayers[1]).profile.id === user?.id
                      ? 'YOU ARE WINNING!'
                      : `${(totals[0] > totals[1] ? sortedPlayers[0] : sortedPlayers[1]).profile.name?.split(' ')[0]?.toUpperCase()} IS WINNING!`
                    }
                  </span>
                  <IconCrown size={16} />
                </div>
              )}
              {totals[0] === totals[1] && totals[0] > 0 && (
                <div className="mt-4 py-2 px-3 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(160,120,255,0.08)', borderRadius: 3, border: '1px dashed #A080C0' }}>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#C0A0F0' }}>IT&apos;S A TIE!</span>
                </div>
              )}
            </>
          )}
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
