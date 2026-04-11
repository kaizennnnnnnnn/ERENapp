'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import type { GameType, Profile } from '@/types'

const GAMES = [
  {
    id: 'catch_mouse' as GameType,
    href: '/games/catch-mouse',
    title: 'CATCH THE MOUSE',
    emoji: '🐭',
    desc: 'Tap the pixel mouse before it escapes!',
    bg: 'linear-gradient(135deg, #FFF5E0, #FFE8C0)',
    border: '#F5C842',
    shadow: '#D4A020',
    accent: '#F5C842',
    preview: ['🐭', '🕳️', '✦'],
  },
  {
    id: 'yarn_chase' as GameType,
    href: '/games/yarn-chase',
    title: 'YARN CHASE',
    emoji: '🧶',
    desc: 'Drag the yarn — let Eren chase it!',
    bg: 'linear-gradient(135deg, #FFF0F8, #FFE0F0)',
    border: '#FF6B9D',
    shadow: '#CC3366',
    accent: '#FF6B9D',
    preview: ['🐱', '🧶', '🐾'],
  },
  {
    id: 'paw_tap' as GameType,
    href: '/games/paw-tap',
    title: 'PAW TAP!',
    emoji: '🐾',
    desc: 'Tap the fish before they swim away!',
    bg: 'linear-gradient(135deg, #E8F6FF, #D0EEFF)',
    border: '#6BAED6',
    shadow: '#3A88B8',
    accent: '#6BAED6',
    preview: ['🐟', '🐠', '🦐'],
  },
]

interface PlayerScores {
  profile: Profile
  best: Partial<Record<GameType, number>>
}

export default function GamesPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  const supabase = createClient()

  // Per-user best scores (for the game card "BEST" badge — only current user)
  const [myScores, setMyScores] = useState<Partial<Record<GameType, number>>>({})

  // Leaderboard: both players
  const [players, setPlayers] = useState<PlayerScores[]>([])
  const [boardLoading, setBoardLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !profile) return

    async function load() {
      // 1. Get all profiles in this household (or just mine if no household yet)
      const profilesQuery = profile!.household_id
        ? supabase.from('profiles').select('*').eq('household_id', profile!.household_id)
        : supabase.from('profiles').select('*').eq('id', user!.id)

      const { data: profiles } = await profilesQuery
      const resolvedProfiles: Profile[] = profiles?.length ? profiles : [profile!]

      const userIds = resolvedProfiles.map((p: Profile) => p.id)

      // 2. All game scores for those users
      const { data: scores, error: scoresError } = await supabase
        .from('game_scores')
        .select('user_id, game_type, score')
        .in('user_id', userIds)

      console.log('[leaderboard] userIds:', userIds)
      console.log('[leaderboard] scores:', scores, 'error:', scoresError)

      // 3. Compute best per player per game
      const bestMap: Record<string, Partial<Record<GameType, number>>> = {}
      scores?.forEach((s: { user_id: string; game_type: GameType; score: number }) => {
        if (!bestMap[s.user_id]) bestMap[s.user_id] = {}
        const current = bestMap[s.user_id][s.game_type] ?? 0
        if (s.score > current) bestMap[s.user_id][s.game_type] = s.score
      })

      setPlayers(resolvedProfiles.map((p: Profile) => ({ profile: p, best: bestMap[p.id] ?? {} })))
      setMyScores(bestMap[user!.id] ?? {})
      setBoardLoading(false)
    }

    load()
  }, [user?.id, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Me first in leaderboard
  const sortedPlayers = [...players].sort((a, b) =>
    a.profile.id === user?.id ? -1 : b.profile.id === user?.id ? 1 : 0
  )

  // Total score per player (sum of all best scores)
  const totals = sortedPlayers.map(p =>
    GAMES.reduce((sum, g) => sum + (p.best[g.id] ?? 0), 0)
  )

  return (
    <div className="page-scroll">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #F5C842, #E8A020)' }}>🎮 GAMES</span>
      </div>
      <p className="text-sm text-gray-500 mb-5">Play with Eren &amp; earn happiness! ♥</p>

      {/* ── Game cards ── */}
      <div className="flex flex-col gap-4 mb-6">
        {GAMES.map(game => (
          <Link key={game.id} href={game.href}>
            <div
              className="active:translate-y-[2px] transition-all duration-100 cursor-pointer overflow-hidden"
              style={{ background: game.bg, borderRadius: 4, border: `2px solid ${game.border}`, boxShadow: `3px 3px 0 ${game.shadow}` }}>
              <div className="flex items-center gap-4 p-4">
                <div className="flex-shrink-0 flex items-center justify-center"
                  style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.65)', borderRadius: 4, border: `2px solid ${game.border}`, boxShadow: `2px 2px 0 ${game.shadow}` }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{game.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-pixel text-gray-800 mb-1" style={{ fontSize: 8 }}>{game.title}</p>
                  <p className="text-xs text-gray-600 leading-snug mb-2">{game.desc}</p>
                  <div className="flex gap-1">
                    {game.preview.map((em, ei) => (
                      <span key={ei} style={{ fontSize: 12, opacity: 0.7 + ei * 0.1 }}>{em}</span>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  {myScores[game.id] !== undefined && (
                    <div className="flex flex-col items-center px-2 py-1"
                      style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 3, border: `1px solid ${game.border}40`, minWidth: 36 }}>
                      <span className="font-pixel text-gray-500" style={{ fontSize: 5 }}>BEST</span>
                      <span className="font-pixel" style={{ fontSize: 9, color: game.accent }}>{myScores[game.id]}</span>
                    </div>
                  )}
                  <span className="font-pixel text-gray-400" style={{ fontSize: 10 }}>▶</span>
                </div>
              </div>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${game.border}, ${game.shadow})`, opacity: 0.5 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* ══ LEADERBOARD ═══════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0E0E2C 0%, #1A1A3E 100%)', borderRadius: 4, border: '3px solid #3A2A60', boxShadow: '4px 4px 0 #1A0A40' }}>

        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
          zIndex: 1,
        }} />

        {/* CRT glow corners */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)', zIndex: 1 }} />

        <div className="relative z-10 p-4">

          {/* ── Board header ── */}
          <div className="flex flex-col items-center mb-4">
            {/* Blinking star accents */}
            <div className="flex items-center gap-3 mb-1">
              <span className="font-pixel" style={{ fontSize: 10, color: '#FFD700', animation: 'twinkle 1.5s ease-in-out infinite' }}>★</span>
              <span className="font-pixel" style={{ fontSize: 10, color: '#FFD700', letterSpacing: 3 }}>HIGH SCORES</span>
              <span className="font-pixel" style={{ fontSize: 10, color: '#FFD700', animation: 'twinkle 1.5s ease-in-out 0.75s infinite' }}>★</span>
            </div>
            <div className="font-pixel" style={{ fontSize: 6, color: '#A080C0', letterSpacing: 1 }}>HOUSEHOLD LEADERBOARD</div>

            {/* Dashed divider */}
            <div className="w-full mt-3" style={{ borderTop: '1px dashed #3A2A60' }} />
          </div>

          {boardLoading ? (
            <p className="font-pixel text-center" style={{ fontSize: 6, color: '#6A50A0', letterSpacing: 2 }}>LOADING...</p>
          ) : sortedPlayers.length < 2 ? (
            /* ── Solo view: show my scores, empty slot for partner ── */
            <>
              <div className="grid mb-3" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4 }}>
                <div />
                {/* Me */}
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center justify-center font-pixel"
                    style={{ width: 28, height: 28, borderRadius: 3, background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', border: '2px solid #FF4080', boxShadow: '0 2px 0 #991A4A', fontSize: 10, color: 'white' }}>
                    {sortedPlayers[0]?.profile.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#FF9EC8' }}>YOU</span>
                </div>
                {/* Empty partner slot */}
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
                      <span style={{ fontSize: 11 }}>{game.emoji}</span>
                      <span className="font-pixel" style={{ fontSize: 6, color: '#8060A8' }}>{game.title}</span>
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4, alignItems: 'center' }}>
                      <div />
                      {/* My score */}
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
                      {/* Empty P2 */}
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
              {/* ── Player name headers ── */}
              <div className="grid mb-3" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4 }}>
                <div /> {/* game label col */}
                {sortedPlayers.map((p, pi) => (
                  <div key={p.profile.id} className="flex flex-col items-center gap-0.5">
                    {/* Avatar circle */}
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

              {/* ── Per-game rows ── */}
              {GAMES.map(game => {
                const s0 = sortedPlayers[0].best[game.id] ?? 0
                const s1 = sortedPlayers[1].best[game.id] ?? 0
                const p0wins = s0 > s1
                const p1wins = s1 > s0
                const tied   = s0 === s1 && s0 > 0

                return (
                  <div key={game.id} className="mb-3">
                    {/* Game label */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span style={{ fontSize: 11 }}>{game.emoji}</span>
                      <span className="font-pixel" style={{ fontSize: 6, color: '#8060A8' }}>{game.title}</span>
                      {tied && <span className="font-pixel" style={{ fontSize: 5, color: '#FFD700' }}>TIE!</span>}
                    </div>

                    {/* Score bars */}
                    <div className="grid" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4, alignItems: 'center' }}>
                      {/* Spacer */}
                      <div />

                      {/* Player 0 score */}
                      {[
                        { score: s0, wins: p0wins, idx: 0 },
                        { score: s1, wins: p1wins, idx: 1 },
                      ].map(({ score, wins, idx }) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          {/* Score number */}
                          <div className="relative flex items-center justify-center"
                            style={{ width: 72, height: 28, background: wins ? (idx === 0 ? 'linear-gradient(135deg, #3A1A30, #5A1A3A)' : 'linear-gradient(135deg, #1A1A40, #1A305A)') : 'rgba(255,255,255,0.04)', borderRadius: 3, border: `1px solid ${wins ? (idx === 0 ? '#FF4080' : '#4A90BC') : '#2A1A50'}` }}>
                            {wins && (
                              <span className="absolute -top-2 -right-1 font-pixel" style={{ fontSize: 8, lineHeight: 1 }}>👑</span>
                            )}
                            <span className="font-pixel" style={{ fontSize: score === 0 ? 8 : 11, color: score === 0 ? '#3A2A60' : wins ? (idx === 0 ? '#FF9EC8' : '#88C8F0') : '#7A60A8' }}>
                              {score === 0 ? '—' : score}
                            </span>
                          </div>

                          {/* Mini bar */}
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

              {/* ── Total row ── */}
              <div className="mt-1">
                <div className="grid" style={{ gridTemplateColumns: '1fr 80px 80px', gap: 4, alignItems: 'center' }}>
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 10 }}>🏆</span>
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
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 font-pixel" style={{ fontSize: 8 }}>🏆</span>
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

              {/* ── Winner banner ── */}
              {totals[0] !== totals[1] && (
                <div className="mt-4 py-2 px-3 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,215,0,0.08)', borderRadius: 3, border: '1px dashed #FFD700' }}>
                  <span style={{ fontSize: 14 }}>🏆</span>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#FFD700', letterSpacing: 1 }}>
                    {(totals[0] > totals[1] ? sortedPlayers[0] : sortedPlayers[1]).profile.id === user?.id
                      ? 'YOU ARE WINNING!'
                      : `${(totals[0] > totals[1] ? sortedPlayers[0] : sortedPlayers[1]).profile.name?.split(' ')[0]?.toUpperCase()} IS WINNING!`
                    }
                  </span>
                  <span style={{ fontSize: 14 }}>🏆</span>
                </div>
              )}
              {totals[0] === totals[1] && totals[0] > 0 && (
                <div className="mt-4 py-2 px-3 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(160,120,255,0.08)', borderRadius: 3, border: '1px dashed #A080C0' }}>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#C0A0F0' }}>⚡ IT&apos;S A TIE! ⚡</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Happiness banner ── */}
      <div className="mt-4 p-3 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #F0E8FF, #E8D8FF)', borderRadius: 4, border: '2px solid #D8C8F8', boxShadow: '3px 3px 0 #C8B0F0' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #9060D0 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
        <p className="font-pixel text-purple-700 text-center relative z-10" style={{ fontSize: 7, lineHeight: 2 }}>
          ★ PLAYING RAISES EREN&apos;S HAPPINESS ★
        </p>
      </div>
    </div>
  )
}
