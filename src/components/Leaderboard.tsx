'use client'

// ─── Leaderboard ─────────────────────────────────────────────────────────────
// The household's scoreboard, a Meadow sheet opened from the Arcade's week
// strip and the playroom's Scores button. Two modes:
//   • This week (default) — the competition. Per-game BEST scores for the
//     current ISO week, side by side. The champion is whoever won MORE games
//     (higher score in more individual games), NOT the sum of scores. Shows a
//     countdown to the Monday reset and a claim row for last week's prize.
//   • All time — every game's all-time best, side by side (records that are
//     remembered forever). Same games-won metric for the headline.
// The better score in each game sits on a gold pill; a tie puts both on one.
// Missing scores show a dash.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { useAuth } from '@/hooks/useAuth'
import { useGamesWeekly } from '@/hooks/useGamesWeekly'
import { useCat } from '@/hooks/useCat'
import { countGamesWon, SOLO_VARIETY_TARGET, SOLO_VARIETY_COINS } from '@/lib/gameRewards'
import { playSound } from '@/lib/sounds'
import type { GameType, Profile } from '@/types'
import AnimatedEren from '@/components/AnimatedEren'
import {
  Avatar, IconTile, M, MeadowIcon, Meter, PrimaryButton, RARITY_TAG, SecondaryButton, Segmented,
  Sheet, TINT, TYPE, GAME_ICON, GAME_TINT, PERSON, personColor, useSheetExit,
} from '@/components/meadow'

// Titles that name the cat are lib/catWords templates, filled per household.
// The same names as the Arcade's tiles.
const GAMES: Array<{ id: GameType; title: string }> = [
  { id: 'memory_match', title: 'Purr-fect Memory' },
  { id: 'treat_tumble', title: 'Treat Tumble' },
  { id: 'flappy_eren',  title: 'Fizzy {name}' },
  { id: 'tic_tac_toe',  title: 'X & O vs {name}' },
  { id: 'eren_stack',   title: '{name} Stack' },
  { id: 'yarn_pop',     title: 'Yarn Pop' },
  { id: 'eren_says',    title: '{name} Says' },
  { id: 'lane_runner',  title: 'Lane Runner' },
  { id: 'paw_doku',     title: 'Paw Doku' },
  { id: 'yarn_sort',    title: 'Yarn Sort' },
  { id: 'purr_beat',    title: 'Purr Beat' },
]

/** The winning score's pill: the board's gold, the same as a legendary tag. */
const GOLD = RARITY_TAG.legendary
const SCORE_COL = 64

interface PlayerScores {
  profile: Profile
  best: Partial<Record<GameType, number>>
}

interface Props { onClose: () => void }

type Mode = 'week' | 'alltime'

const MODES = [
  { value: 'week', label: 'This week' },
  { value: 'alltime', label: 'All time' },
] as const

function formatCountdown(resetAt: Date | undefined): string {
  if (!resetAt) return 'This week'
  const ms = resetAt.getTime() - Date.now()
  if (ms <= 0) return 'Resetting now'
  const totalH = Math.floor(ms / 3600000)
  const days = Math.floor(totalH / 24)
  const hours = totalH % 24
  if (days > 0) return `Resets in ${days}d ${hours}h`
  if (hours > 0) return `Resets in ${hours}h`
  const mins = Math.max(1, Math.floor(ms / 60000))
  return `Resets in ${mins}m`
}

// ── One score cell ──────────────────────────────────────────────────────────
function Score({ score, best, label }: { score: number; best: boolean; label: string }) {
  const empty = score === 0
  return (
    <span style={{ width: SCORE_COL, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
      <span className="sr-only">{`${label}: ${empty ? 'no score' : score}${best ? ', the best' : ''}`}</span>
      <span aria-hidden style={{
        minWidth: 40, boxSizing: 'border-box', padding: '3px 9px', borderRadius: 999, textAlign: 'center',
        background: best ? GOLD.bg : 'transparent',
        color: empty ? M.faint : best ? GOLD.ink : M.text2,
        fontSize: 15, ...TYPE.number, fontWeight: best ? 800 : 700,
      }}>
        {empty ? '–' : score}
      </span>
    </span>
  )
}

// ── One side of the headline ────────────────────────────────────────────────
function Side({ name, label, color, wins, leading, right }: {
  name: string | null | undefined
  label: string
  color: string
  wins: number
  leading: boolean
  right?: boolean
}) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: right ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 10,
    }}>
      <span style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar name={name} color={color} size={44} />
        {/* The crown rides on whoever has won more games. */}
        {leading && (
          <MeadowIcon name="crown" size={22} style={{
            position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%) rotate(-8deg)',
          }} />
        )}
      </span>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: right ? 'flex-end' : 'flex-start' }}>
        <span style={{
          maxWidth: '100%', fontSize: 13, lineHeight: 1.2, fontWeight: 700, color: M.text2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</span>
        <span style={{ fontSize: 30, lineHeight: 1.1, ...TYPE.number }}>{wins}</span>
      </span>
    </div>
  )
}

export default function Leaderboard({ onClose }: Props) {
  const { user, profile } = useAuth()
  const cat = useCat()
  const supabase = createClient()
  const [open, close] = useSheetExit(onClose)
  const [players, setPlayers] = useState<PlayerScores[]>([])
  const [loading, setLoading] = useState(true)
  // A read that failed even after withRetry. The board stays on its loading
  // face with a retry instead of drawing: an empty player list would render
  // as a false solo board.
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [mode, setMode] = useState<Mode>('week')
  const [claimed, setClaimed] = useState(false)
  const [claiming, setClaiming] = useState(false)

  // Weekly competition: this-week per-game bests + games-won + last-week prize.
  const { standings, weeklyChampion, claim, partnerName } = useGamesWeekly()

  useEffect(() => {
    if (!user?.id || !profile) return
    let cancelled = false
    async function load() {
      // Both reads go through withRetry — a transient Supabase 503 resolves
      // as { data: null, error } without throwing, which used to read as
      // "no partner" / "no scores" and render a false solo or tie view.
      const profilesQuery = () => profile!.household_id
        ? supabase.from('profiles').select('*').eq('household_id', profile!.household_id)
        : supabase.from('profiles').select('*').eq('id', user!.id)

      const { data: profiles, error: profilesError } = await withRetry(profilesQuery)
      if (cancelled) return
      if (profilesError) {
        console.error('[leaderboard] profiles', profilesError.message)
        setLoadFailed(true)
        return
      }
      const resolved: Profile[] = profiles?.length ? profiles : [profile!]

      const userIds = resolved.map((p: Profile) => p.id)
      const { data: scores, error: scoresError } = await withRetry(() => supabase
        .from('game_best_scores')
        .select('user_id, game_type, score')
        .in('user_id', userIds))
      if (cancelled) return
      if (scoresError) {
        console.error('[leaderboard] scores', scoresError.message)
        setLoadFailed(true)
        return
      }

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
    return () => { cancelled = true }
  }, [user?.id, profile?.id, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sorted: me first, partner second.
  const sorted = [...players].sort((a, b) =>
    a.profile.id === user?.id ? -1 : b.profile.id === user?.id ? 1 : 0
  )
  const me      = sorted[0]
  const partner = sorted[1]

  // Per-game bests for the active mode.
  const myAll      = me?.best ?? {}
  const partnerAll = partner?.best ?? {}
  const myBest      = mode === 'week' ? (standings?.myBest ?? {}) : myAll
  const partnerBest = mode === 'week' ? (standings?.partnerBest ?? {}) : partnerAll

  // Games-won metric (NOT a sum of scores).
  const wins = mode === 'week'
    ? { my: standings?.myWins ?? 0, their: standings?.partnerWins ?? 0 }
    : (() => { const r = countGamesWon(myAll, partnerAll); return { my: r.myWins, their: r.partnerWins } })()
  const totalDecided = wins.my + wins.their

  const winnerSide: 'me' | 'them' | 'tie' | 'solo' = !partner ? 'solo'
    : wins.my === wins.their ? 'tie'
    : wins.my > wins.their ? 'me' : 'them'

  // Solo, `wins.my` is NOT a win count. countGamesWon compares against an
  // empty partner map, so every game holding a non-zero best already "wins" —
  // the number IS how many different games have been played. gameWeekly says
  // the same thing where it settles the week, and the champion popup labels it
  // the same way; so does the board, which is the one a player opens mid-week.
  const solo = winnerSide === 'solo'
  const varietyDone = solo && mode === 'week' && wins.my >= SOLO_VARIETY_TARGET

  async function handleClaim() {
    if (claiming) return
    playSound('ui_tap')
    setClaiming(true)
    await claim()
    setClaiming(false)
    setClaimed(true)
  }

  const myColor = personColor(me?.profile.heart ?? profile?.heart)
  const partnerColor = partner?.profile.heart
    ? personColor(partner.profile.heart)
    : myColor === PERSON.brown ? PERSON.pink : PERSON.brown
  const partnerFirst = partner?.profile.name?.split(' ')[0]
    ?? partnerName?.split(' ')[0] ?? 'Partner'

  const showClaim = mode === 'week' && !claimed && !!weeklyChampion
    && !weeklyChampion.payout_paid && weeklyChampion.payout_coins > 0

  // One sentence under the two numbers that says where things stand.
  const verdict = solo ? null
    : totalDecided === 0
      ? (mode === 'week' ? 'No games played yet this week' : 'Play a few games to set records')
      : winnerSide === 'tie' ? `All square at ${wins.my} each`
      : winnerSide === 'me' ? `You're ahead, ${wins.my} games to ${wins.their}`
      : `${partnerFirst} is ahead, ${wins.their} games to ${wins.my}`

  return (
    <Sheet open={open} onClose={close} title="Leaderboard" height="calc(100% - 56px)">
      <Segmented
        ariaLabel="Which scores"
        options={MODES}
        value={mode}
        onChange={m => { playSound('ui_tap'); setMode(m) }}
      />
      <p style={{ margin: '10px 4px 0', fontSize: 13, fontWeight: 700, color: M.text2, textAlign: 'center' }}>
        {mode === 'week' ? formatCountdown(standings?.resetAt) : 'The best score each of you has ever set'}
      </p>

      {loading && loadFailed ? (
        <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '40px 0' }}>
          <p style={{ margin: 0, ...TYPE.body, color: M.text }}>Couldn&apos;t load the scores.</p>
          <SecondaryButton onClick={() => { playSound('ui_tap'); setLoadFailed(false); setAttempt(a => a + 1) }}>
            Try again
          </SecondaryButton>
        </div>
      ) : loading ? (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
          <AnimatedEren px={3} glow={false} />
          <span style={{ fontSize: 14, fontWeight: 700, color: M.text2 }}>Loading scores</span>
        </div>
      ) : (
        <>
          {/* Last week's prize, still to collect. */}
          {showClaim && (
            <div style={{
              marginTop: 14, padding: '12px 12px 12px 14px', borderRadius: 20, background: TINT.amber,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <IconTile icon="trophy" size={40} bg="#FFFFFF" />
              <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 800 }}>
                Last week&apos;s prize
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: M.text2 }}>
                  {weeklyChampion!.payout_coins} coins are waiting
                </span>
              </span>
              <PrimaryButton size="sm" busy={claiming} onClick={handleClaim}
                icon={<MeadowIcon name="coin" size={18} />}>
                Claim
              </PrimaryButton>
            </div>
          )}

          {/* The headline: games won (or, alone, different games played). */}
          <div style={{ marginTop: 14, padding: '20px 16px 16px', borderRadius: 22, background: M.soft }}>
            {solo ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={me?.profile.name ?? profile?.name} color={myColor} size={44} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Different games played</span>
                    <span style={{ fontSize: 30, lineHeight: 1.1, ...TYPE.number }}>
                      {wins.my}
                      {mode === 'week' && !varietyDone && <span style={{ fontSize: 17, color: M.text2 }}> of {SOLO_VARIETY_TARGET}</span>}
                    </span>
                  </span>
                </div>
                {mode === 'week' && (
                  <>
                    <Meter value={wins.my / SOLO_VARIETY_TARGET} height={10} style={{ marginTop: 14 }}
                      label={`${wins.my} of ${SOLO_VARIETY_TARGET} different games`} />
                    {/* Alone the weekly prize is a variety goal, not a victory. */}
                    <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 600, color: varietyDone ? M.leafInk : M.text2 }}>
                      {varietyDone
                        ? `All ${SOLO_VARIETY_TARGET} played. ${SOLO_VARIETY_COINS} coins on Monday.`
                        : `Play ${SOLO_VARIETY_TARGET} different games this week for ${SOLO_VARIETY_COINS} coins.`}
                    </p>
                  </>
                )}
                {mode !== 'week' && totalDecided === 0 && (
                  <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 600, color: M.text2 }}>
                    Play a few games to set records.
                  </p>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Side name={me?.profile.name ?? profile?.name} label="You" color={myColor}
                    wins={wins.my} leading={winnerSide === 'me'} />
                  <span aria-hidden style={{ flexShrink: 0, fontSize: 14, fontWeight: 800, color: M.faint }}>vs</span>
                  <Side name={partner?.profile.name} label={partnerFirst} color={partnerColor}
                    wins={wins.their} leading={winnerSide === 'them'} right />
                </div>
                <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 14, fontWeight: 700, color: M.text }}>
                  <span style={{ ...TYPE.label, color: M.label, display: 'block', marginBottom: 2 }}>Games won</span>
                  {verdict}
                </p>
              </>
            )}
          </div>

          {/* Every game: the two bests side by side. */}
          <div style={{ display: 'flex', alignItems: 'flex-end', margin: '20px 4px 8px', gap: 8 }}>
            <span style={{ flex: '1 1 auto', ...TYPE.label, color: M.label }}>Best scores</span>
            <span style={{ width: SCORE_COL, textAlign: 'right', ...TYPE.label, color: M.label }}>You</span>
            {!solo && (
              <span style={{
                width: SCORE_COL, textAlign: 'right', ...TYPE.label, color: M.label,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{partnerFirst}</span>
            )}
          </div>
          <ul style={{
            listStyle: 'none', margin: 0, padding: 0, borderRadius: 22, overflow: 'hidden',
            boxShadow: `inset 0 0 0 2px ${M.hairline}`,
          }}>
            {GAMES.map((game, i) => {
              const s0 = myBest[game.id] ?? 0
              const s1 = partnerBest[game.id] ?? 0
              // Solo there's nobody to beat: no gold pills, just your bests.
              const meTop   = !solo && s0 > 0 && s0 >= s1
              const themTop = !solo && s1 > 0 && s1 >= s0
              const title = cat.t(game.title)
              return (
                <li key={game.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, minHeight: 56, padding: '6px 12px',
                  borderTop: i > 0 ? `1px solid ${M.divider}` : undefined,
                }}>
                  <IconTile icon={GAME_ICON[game.id] ?? 'pad'} bg={GAME_TINT[game.id] ?? TINT.soft} size={36} iconSize={24} />
                  <span style={{
                    flex: '1 1 auto', minWidth: 0, marginLeft: 4, fontSize: 15, lineHeight: 1.25, fontWeight: 700,
                    overflowWrap: 'anywhere',
                  }}>{title}</span>
                  <Score score={s0} best={meTop} label={`${title}, you`} />
                  {/* Solo there is no second column: a 0 against every game,
                      belonging to nobody, reads as losing rather than as an
                      empty seat. */}
                  {!solo && <Score score={s1} best={themTop} label={`${title}, ${partnerFirst}`} />}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Sheet>
  )
}
