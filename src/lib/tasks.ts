import type { TaskDef } from '@/types'
import { getISOWeek, getISOWeekYear, format } from 'date-fns'

export const TASK_DEFS: TaskDef[] = [
  // ── Daily ──────────────────────────────────────────────────────────────────
  { id: 'daily_mood',  period: 'daily', title: 'Log Your Mood',       desc: 'Check in with how you feel today',     icon: '😊', coins: 10, xp: 15 },
  { id: 'daily_feed',  period: 'daily', title: 'Feed Eren',           desc: 'Give Eren something tasty to eat',     icon: '🍗', coins: 15, xp: 20 },
  { id: 'daily_play',  period: 'daily', title: 'Play with Eren',      desc: 'Make Eren happy with some playtime',   icon: '🧶', coins: 15, xp: 20 },
  { id: 'daily_sleep', period: 'daily', title: 'Put Eren to Sleep',   desc: 'Make sure Eren gets enough rest',      icon: '💤', coins: 15, xp: 20 },
  { id: 'daily_wash',  period: 'daily', title: 'Wash Eren',           desc: 'Keep Eren clean and fresh',            icon: '🛁', coins: 15, xp: 20 },
  { id: 'daily_game',  period: 'daily', title: 'Play a Game',         desc: 'Play any mini-game with Eren',         icon: '🎮', coins: 10, xp: 15 },
  // ── Weekly ─────────────────────────────────────────────────────────────────
  { id: 'weekly_all_care',   period: 'weekly', title: 'Full Care Week',      desc: 'Complete all 5 care actions this week', icon: '⭐', coins: 60, xp: 100 },
  { id: 'weekly_all_games',  period: 'weekly', title: 'Game Master',         desc: 'Play all 3 mini-games this week',       icon: '🏆', coins: 50, xp: 80  },
  { id: 'weekly_high_score', period: 'weekly', title: 'High Scorer',         desc: 'Score 10+ in any game this week',       icon: '👑', coins: 40, xp: 60  },
  { id: 'weekly_mood_5',     period: 'weekly', title: 'Mood Tracker',        desc: 'Log your mood 5 days this week',        icon: '📅', coins: 40, xp: 70  },
  { id: 'weekly_no_sick',    period: 'weekly', title: 'Healthy Guardian',    desc: 'Keep Eren from getting sick this week', icon: '💪', coins: 50, xp: 90  },
]

export function getDailyKey(date = new Date()): string {
  return `daily:${format(date, 'yyyy-MM-dd')}`
}

export function getWeeklyKey(date = new Date()): string {
  const week = getISOWeek(date)
  const year = getISOWeekYear(date)
  return `weekly:${year}-W${String(week).padStart(2, '0')}`
}

export function getPeriodKey(period: 'daily' | 'weekly', date = new Date()): string {
  return period === 'daily' ? getDailyKey(date) : getWeeklyKey(date)
}

// XP needed to go from level N to N+1
export function xpForNextLevel(level: number): number {
  return level * 100
}

// Total XP accumulated to reach a given level
export function totalXpForLevel(level: number): number {
  return (level * (level - 1)) / 2 * 100
}

export function getLevelTitle(level: number): string {
  if (level <= 3)  return 'Kitten'
  if (level <= 7)  return 'Cat Parent'
  if (level <= 12) return 'Caretaker'
  if (level <= 18) return 'Cat Whisperer'
  if (level <= 25) return 'Feline Expert'
  return 'Legendary Guardian'
}
