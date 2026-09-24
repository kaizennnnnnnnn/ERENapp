'use client'

// ─── Play tab: the arcade ────────────────────────────────────────────────────
// Data container for the Meadow arcade (components/arcade/ArcadeView renders
// it). Owns: the game catalogue, the player's best scores, this week's games-won
// standings, and today's wish when it is a game. The places (gacha, bakery,
// shawarma, jelly) are the home dock's, not the arcade's.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { useGamesWeekly } from '@/hooks/useGamesWeekly'
import { useCare } from '@/contexts/CareContext'
import { useTasks } from '@/contexts/TaskContext'
import { useWish } from '@/contexts/WishContext'
import type { UseDailyWishResult } from '@/hooks/useDailyWish'
import { PERSON, personColor } from '@/components/meadow'
import ArcadeView, {
  type ArcadeGame, type ArcadeScores, type ArcadeWeek, type ArcadeWish,
} from '@/components/arcade/ArcadeView'
import Leaderboard from '@/components/Leaderboard'
import WeeklyGamesChampionPopup from '@/components/games/WeeklyGamesChampionPopup'
import { catIdentityFromStats } from '@/lib/catIdentity'
import { PLAYABLE_MINIGAME_IDS } from '@/lib/minigames'
import { hashStr } from '@/lib/wishes'
import { SOLO_VARIETY_COINS, SOLO_VARIETY_TARGET } from '@/lib/gameRewards'
import { playSound } from '@/lib/sounds'
import type { GameType } from '@/types'

// The arcade, in the board's order. lib/minigames.ts PLAYABLE_MINIGAME_IDS is
// the id list every "play them all" unlock measures against: keep the two in
// step when a game is added or retired.
const GAMES: readonly ArcadeGame[] = [
  { id: 'memory_match', href: '/games/memory-match', title: 'Purr-fect Memory' },
  { id: 'treat_tumble', href: '/games/treat-tumble', title: 'Treat Tumble' },
  { id: 'flappy_eren', href: '/games/flappy-eren', title: 'Fizzy Eren' },
  { id: 'tic_tac_toe', href: '/games/tic-tac-toe', title: 'X & O vs Eren' },
  { id: 'eren_stack', href: '/games/eren-stack', title: 'Eren Stack' },
  { id: 'yarn_pop', href: '/games/yarn-pop', title: 'Yarn Pop' },
  { id: 'eren_says', href: '/games/eren-says', title: 'Eren Says' },
  { id: 'lane_runner', href: '/games/lane-runner', title: 'Lane Runner' },
  { id: 'paw_doku', href: '/games/paw-doku', title: 'Paw Doku' },
  { id: 'yarn_sort', href: '/games/yarn-sort', title: 'Yarn Sort' },
  { id: 'purr_beat', href: '/games/purr-beat', title: 'Purr Beat' },
]

const PLAYABLE = new Set<GameType>(PLAYABLE_MINIGAME_IDS)

/**
 * The game today's wish asks for, if it asks for one: `play:<game>` names it;
 * "i wanna play some mini games" takes any game, so the card features one
 * picked from the date (both partners see the same pick, and it grants the
 * wish like any other game). Other play:any wishes ("pet me") are about
 * company, not the arcade, and get no card.
 */
function wishedGame(w: UseDailyWishResult | null): GameType | null {
  const wish = w?.wish
  if (!w || !wish || w.status === 'loading') return null
  if (wish.match.startsWith('play:')) {
    const id = wish.match.slice('play:'.length) as GameType
    if (PLAYABLE.has(id)) return id
  }
  if (wish.id === 'act-minigame-any' && w.todayKey) {
    return PLAYABLE_MINIGAME_IDS[hashStr(`${w.todayKey}::arcade`) % PLAYABLE_MINIGAME_IDS.length]
  }
  return null
}

export default function GamesPage() {
  const { user, profile } = useAuth()
  const { coins } = useTasks()
  const { partner, isSolo } = useCouple()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const wishState = useWish()
  const { weeklyChampion, standings, partnerId, partnerName, claim } = useGamesWeekly()
  const [champDismissed, setChampDismissed] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)

  // The StatsHeader stays off here, as on the other Meadow tabs: the page has
  // its own title row and coin chip.
  const { setHideStats } = useCare()
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // ── My personal bests, one per game ──
  // null until known. A failed read stays null (a dash on every tile), never
  // an empty map, which would claim every game is unplayed.
  const [scores, setScores] = useState<ArcadeScores>(null)
  const [scoresFailed, setScoresFailed] = useState(false)
  const loadScores = useCallback(async (userId: string, cancelled: () => boolean) => {
    const supabase = createClient()
    const { data, error } = await withRetry(() => supabase
      .from('game_best_scores')
      .select('game_type, score')
      .eq('user_id', userId))
    if (cancelled()) return
    if (error) {
      console.error('[arcade] best scores', error.message)
      setScoresFailed(true)
      return
    }
    const best: Partial<Record<GameType, number>> = {}
    for (const row of (data ?? []) as Array<{ game_type: GameType; score: number }>) {
      if (row.score > (best[row.game_type] ?? 0)) best[row.game_type] = row.score
    }
    setScores(best)
    setScoresFailed(false)
  }, [])

  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) return
    let dead = false
    void loadScores(userId, () => dead)
    return () => { dead = true }
  }, [userId, loadScores])

  // A tab page is not remounted when the phone wakes the app, so a read that
  // failed during a Supabase blip retries on return instead of showing dashes
  // until the next visit.
  useEffect(() => {
    if (!userId || !scoresFailed) return
    let dead = false
    const off = onForeground(() => { void loadScores(userId, () => dead) })
    return () => { dead = true; off() }
  }, [userId, scoresFailed, loadScores])

  // ── This week ──
  const week = useMemo<ArcadeWeek>(() => {
    const myColor = personColor(profile?.heart)
    if (isSolo) {
      // Solo, useGamesWeekly counts every game with a score as "won" against
      // the empty seat: that number IS the count of different games played.
      if (!standings) return { kind: 'unknown', myColor }
      return { kind: 'solo', myColor, played: standings.myWins, target: SOLO_VARIETY_TARGET, coins: SOLO_VARIETY_COINS }
    }
    // Paired: only trust standings the hook computed WITH the partner. If its
    // own partner read failed it scored the week solo-style, and those numbers
    // would put a real couple's race at "you 4, them 0".
    if (!partner || !standings || !partnerId) return { kind: 'unknown', myColor }
    const partnerColor = partner.heart
      ? personColor(partner.heart)
      : myColor === PERSON.brown ? PERSON.pink : PERSON.brown
    const first = (partner.name || partnerName || 'Partner').trim().split(/\s+/)[0]
    return {
      kind: 'duo', myColor,
      myWins: standings.myWins,
      partnerName: first, partnerColor,
      partnerWins: standings.partnerWins,
    }
  }, [profile?.heart, isSolo, partner, standings, partnerId, partnerName])

  // ── Today's wish, when it is a game ──
  const cat = catIdentityFromStats(stats)
  const wishId = wishedGame(wishState)
  const wishGame = wishId ? GAMES.find(g => g.id === wishId) ?? null : null
  const wish: ArcadeWish | null = wishGame ? {
    game: wishGame,
    catName: cat.name,
    catLook: cat.look,
    granted: wishState?.status === 'granted',
  } : null

  return (
    <>
      <ArcadeView
        coins={profile ? coins : null}
        week={week}
        wish={wish}
        games={GAMES}
        scores={scores}
        onOpenWeek={() => { playSound('ui_tap'); setBoardOpen(true) }}
        onGameTap={() => playSound('ui_tap')}
      />

      {boardOpen && <Leaderboard onClose={() => setBoardOpen(false)} />}

      {weeklyChampion && !weeklyChampion.acknowledged && !champDismissed && (
        <WeeklyGamesChampionPopup
          row={weeklyChampion}
          partnerFirstName={(partnerName ?? 'Partner').split(' ')[0]}
          solo={!partnerId}
          onClaim={claim}
          onClose={() => setChampDismissed(true)}
        />
      )}
    </>
  )
}
