'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { coinsForGame, EXHAUSTED_ENERGY } from '@/lib/gameRewards'
import type { GameType } from '@/types'

export interface ReportGameResultOpts {
  gameType: GameType
  /** Final score for this run. */
  score: number
  /** For win/loss games (tic-tac-toe): did the player win this match? */
  won?: boolean
  /** Force whether the high score is saved. Defaults to score > 0. */
  saveScore?: boolean
}

export interface GameRewardResult {
  /** Coins actually awarded (0 when energy-blocked). */
  coins: number
  /** True when Eren is too exhausted (energy < 30) to award coins. */
  blocked: boolean
  /** Energy reading used for the decision. */
  energy: number
}

/**
 * One call per finished run. Computes the coin payout synchronously (so the
 * finish overlay can render `coins`/`blocked` immediately), then fires the
 * coin credit + high-score save in the background.
 *
 * Coins are gated on Eren's energy — a tired cat can't cheer — but the high
 * score is ALWAYS saved (energy-independent) so records are never lost.
 */
export function useGameRewards() {
  const supabase = createClient()
  const { user } = useAuth()
  const { stats } = useErenStats()
  const { addCoins } = useTasks()

  // Mirror energy into a ref: game-over handlers often fire from a long-lived
  // requestAnimationFrame/timer closure that captured an older render's stats.
  // The ref always holds the latest value. Default 100 so an unloaded stats
  // row never wrongly blocks the reward.
  const energyRef = useRef(100)
  useEffect(() => {
    if (typeof stats?.energy === 'number') energyRef.current = stats.energy
  }, [stats?.energy])

  const reportGameResult = useCallback((opts: ReportGameResultOpts): GameRewardResult => {
    const { gameType, score, won, saveScore } = opts
    const energy = energyRef.current
    const blocked = energy < EXHAUSTED_ENERGY
    const coins = blocked ? 0 : coinsForGame(gameType, score, won)

    // Credit the wallet (per-user profiles.coins via TaskContext).
    if (coins > 0) void addCoins(coins)

    // Persist the high score so the leaderboard remembers it. Never save a
    // 0/junk score; tic-tac-toe passes saveScore=false on a loss/draw.
    const shouldSave = saveScore ?? score > 0
    if (user?.id && shouldSave && score > 0) {
      void supabase
        .from('game_scores')
        .insert({ user_id: user.id, game_type: gameType, score })
        .then(({ error }) => { if (error) console.error('game score save:', error.message) })
    }

    return { coins, blocked, energy }
  }, [user?.id, addCoins, supabase])

  return { reportGameResult }
}
