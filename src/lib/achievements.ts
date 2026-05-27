import type { AchievementId, AchievementMap, StreakData, ErenStats, GameType } from '@/types'
import { CARE_TASK_IDS, getDailyKey } from '@/lib/tasks'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Streak logic ─────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [7, 14, 30, 60, 100] as const

export const STREAK_MILESTONE_COINS: Record<number, number> = {
  7: 50, 14: 100, 30: 200, 60: 400, 100: 1000,
}

export function updateStreak(
  current: StreakData | undefined,
  todayStr: string,
): { streak: StreakData; changed: boolean; milestonesHit: number[] } {
  const prev = current ?? { current: 0, best: 0, lastDate: null }

  if (prev.lastDate === todayStr) {
    return { streak: prev, changed: false, milestonesHit: [] }
  }

  const yesterday = new Date(todayStr + 'T12:00:00')
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const newCurrent = prev.lastDate === yesterdayStr ? prev.current + 1 : 1
  const newBest = Math.max(prev.best, newCurrent)

  const streak: StreakData = { current: newCurrent, best: newBest, lastDate: todayStr }

  const milestonesHit = STREAK_MILESTONES.filter(m => newCurrent >= m && prev.current < m)

  return { streak, changed: true, milestonesHit }
}

// ─── Achievement definitions ──────────────────────────────────────────────────

export type AchievementTrigger = 'care' | 'game' | 'level' | 'streak' | 'battle' | 'mood' | 'mount'

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface AchievementDef {
  id: AchievementId
  title: string
  description: string
  icon: 'trophy' | 'fire' | 'star' | 'crown' | 'heart' | 'paw' | 'controller' | 'swords' | 'moon'
  triggers: AchievementTrigger[]
  coins: number
  rarity: AchievementRarity
}

export const RARITY_COLORS: Record<AchievementRarity, { border: string; glow: string; text: string; bg: string }> = {
  common:    { border: 'rgba(160,160,170,0.5)', glow: 'rgba(160,160,170,0.2)', text: '#B0B0BA', bg: 'rgba(160,160,170,0.06)' },
  rare:      { border: 'rgba(96,165,250,0.5)',  glow: 'rgba(96,165,250,0.25)', text: '#93C5FD', bg: 'rgba(96,165,250,0.06)' },
  epic:      { border: 'rgba(192,132,252,0.5)', glow: 'rgba(192,132,252,0.3)', text: '#D8B4FE', bg: 'rgba(192,132,252,0.06)' },
  legendary: { border: 'rgba(251,191,36,0.6)',  glow: 'rgba(251,191,36,0.35)', text: '#FDE68A', bg: 'rgba(251,191,36,0.08)' },
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Care
  { id: 'first_care',    title: 'First Steps',        description: 'Complete your first care action',  icon: 'paw',        triggers: ['care'],           coins: 10,  rarity: 'common'    },
  { id: 'all_care_day',  title: 'Perfect Day',         description: 'Do all 4 care types in one day',   icon: 'star',       triggers: ['care'],           coins: 50,  rarity: 'rare'      },
  { id: 'clean_sweep',   title: 'Clean Sweep',         description: 'Get all stats above 80',           icon: 'heart',      triggers: ['care'],           coins: 75,  rarity: 'rare'      },
  { id: 'care_100',      title: 'Devoted Caretaker',   description: 'Complete 100 care actions',        icon: 'trophy',     triggers: ['care', 'mount'],  coins: 200, rarity: 'epic'      },
  // Streaks
  { id: 'streak_7',      title: 'Week Warrior',        description: '7-day streak',                     icon: 'fire',       triggers: ['streak'],         coins: 50,  rarity: 'rare'      },
  { id: 'streak_30',     title: 'Month Maven',         description: '30-day streak',                    icon: 'fire',       triggers: ['streak'],         coins: 150, rarity: 'epic'      },
  { id: 'streak_100',    title: 'Century Club',         description: '100-day streak',                   icon: 'fire',       triggers: ['streak'],         coins: 500, rarity: 'legendary' },
  // Games
  { id: 'first_game',    title: 'Player One',          description: 'Play your first mini-game',        icon: 'controller', triggers: ['game'],           coins: 10,  rarity: 'common'    },
  { id: 'high_score_50', title: 'Score Master',         description: 'Score 50+ in any game',            icon: 'crown',      triggers: ['game'],           coins: 100, rarity: 'rare'      },
  { id: 'all_games',     title: 'Arcade King',          description: 'Play every game type',             icon: 'trophy',     triggers: ['game', 'mount'],  coins: 200, rarity: 'epic'      },
  // Levels
  { id: 'level_10',      title: 'Rising Star',          description: 'Reach level 10',                   icon: 'star',       triggers: ['level', 'mount'], coins: 50,  rarity: 'rare'      },
  { id: 'level_25',      title: 'Veteran',              description: 'Reach level 25',                   icon: 'trophy',     triggers: ['level', 'mount'], coins: 100, rarity: 'epic'      },
  { id: 'level_50',      title: 'Legend',                description: 'Reach level 50',                   icon: 'crown',      triggers: ['level', 'mount'], coins: 300, rarity: 'legendary' },
  // Social
  { id: 'battle_win',    title: 'Champion',             description: 'Win a daily battle',               icon: 'swords',     triggers: ['battle'],         coins: 75,  rarity: 'rare'      },
  { id: 'mood_7',        title: 'In Touch',             description: 'Log mood 7 days in a row',         icon: 'moon',       triggers: ['mood', 'mount'],  coins: 75,  rarity: 'rare'      },
]

// ─── Achievement context (passed to checkers) ─────────────────────────────────

export interface AchievementContext {
  userId: string
  completedIds: Set<string>
  stats: ErenStats | null
  level: number
  streak: StreakData
  achievements: AchievementMap
  latestScore?: number
  latestGameType?: GameType
  dailyBattleWon?: boolean
}

// ─── Condition checkers ───────────────────────────────────────────────────────

type Checker = (ctx: AchievementContext, supabase: SupabaseClient) => Promise<boolean> | boolean

const CARE_IDS = CARE_TASK_IDS as string[]

const checkers: Record<AchievementId, Checker> = {
  first_care(_ctx) {
    return true
  },

  async care_100(ctx, supabase) {
    const cached = typeof window !== 'undefined'
      ? parseInt(localStorage.getItem(`ach_care_count_${ctx.userId}`) ?? '0', 10)
      : 0
    if (cached < 90) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ach_care_count_${ctx.userId}`, String(cached + 1))
      }
      return false
    }
    const { count } = await supabase
      .from('user_task_completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .in('task_id', CARE_IDS)
    const total = count ?? 0
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ach_care_count_${ctx.userId}`, String(total))
    }
    return total >= 100
  },

  all_care_day(ctx) {
    const todayKey = getDailyKey()
    return CARE_IDS.every(id => ctx.completedIds.has(`${id}:${todayKey}`))
  },

  clean_sweep(ctx) {
    const s = ctx.stats
    if (!s) return false
    return s.happiness > 80 && s.hunger > 80 && s.energy > 80
      && s.sleep_quality > 80 && s.cleanliness > 80
  },

  streak_7(ctx)   { return ctx.streak.current >= 7 },
  streak_30(ctx)  { return ctx.streak.current >= 30 },
  streak_100(ctx) { return ctx.streak.current >= 100 },

  first_game() { return true },

  high_score_50(ctx) {
    return (ctx.latestScore ?? 0) >= 50
  },

  async all_games(ctx, supabase) {
    const ALL_GAME_TYPES: GameType[] = [
      'catch_mouse', 'paw_tap', 'memory_match', 'treat_tumble', 'flappy_eren',
      'tic_tac_toe', 'eren_stack', 'yarn_pop', 'eren_says', 'lane_runner', 'paw_doku',
    ]
    const cached = typeof window !== 'undefined'
      ? localStorage.getItem(`ach_game_types_${ctx.userId}`)
      : null
    const known = cached ? new Set<string>(JSON.parse(cached)) : new Set<string>()
    if (ctx.latestGameType) known.add(ctx.latestGameType)
    if (known.size < ALL_GAME_TYPES.length) {
      const { data } = await supabase
        .from('game_scores')
        .select('game_type')
        .eq('user_id', ctx.userId)
      if (data) {
        for (const row of data) known.add(row.game_type)
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ach_game_types_${ctx.userId}`, JSON.stringify(Array.from(known)))
    }
    return known.size >= ALL_GAME_TYPES.length
  },

  level_10(ctx) { return ctx.level >= 10 },
  level_25(ctx) { return ctx.level >= 25 },
  level_50(ctx) { return ctx.level >= 50 },

  battle_win(ctx) { return ctx.dailyBattleWon === true },

  async mood_7(ctx, supabase) {
    const { data } = await supabase
      .from('daily_moods')
      .select('date')
      .eq('user_id', ctx.userId)
      .order('date', { ascending: false })
      .limit(7)
    if (!data || data.length < 7) return false
    const dates = data.map(d => d.date).sort()
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T12:00:00')
      const curr = new Date(dates[i] + 'T12:00:00')
      const diff = (curr.getTime() - prev.getTime()) / 86400000
      if (Math.round(diff) !== 1) return false
    }
    return true
  },
}

// ─── Main check-and-unlock entry point ────────────────────────────────────────

export async function checkAchievements(
  trigger: AchievementTrigger,
  ctx: AchievementContext,
  supabase: SupabaseClient,
): Promise<AchievementDef[]> {
  const unlocked: AchievementDef[] = []

  for (const def of ACHIEVEMENT_DEFS) {
    if (ctx.achievements[def.id]) continue
    if (!def.triggers.includes(trigger)) continue

    const passed = await checkers[def.id](ctx, supabase)
    if (passed) unlocked.push(def)
  }

  return unlocked
}
