'use client'

// ─── Me ──────────────────────────────────────────────────────────────────────
// The Meadow "Me" tab (board A2). This file is the data half: it reads the
// household, the stats, the time and the month's moods, and hands plain props
// to ProfileView. Every setting that used to live on this page (name, invite
// code, special days, notifications, theme, report/block, leave, delete) moved
// to /settings, behind the gear; the streak repair stays here, next to the
// streak it repairs.

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { useCare } from '@/contexts/CareContext'
import { useTasks } from '@/contexts/TaskContext'
import { usePageReady } from '@/hooks/usePageReady'
import { ACHIEVEMENT_DEFS, canRepairStreak, type AchievementDef } from '@/lib/achievements'
import { xpForNextLevel, totalXpForLevel } from '@/lib/tasks'
import { catIdentityFromStats, coatLabel, SEX_LABELS } from '@/lib/catIdentity'
import { moodDateKey } from '@/lib/moods'
import { playSound } from '@/lib/sounds'
import { M, MeadowPage, PERSON, personColor, type MeadowIconName } from '@/components/meadow'
import type { MoodCalendarDay } from '@/components/MoodCalendar'
import type { AchievementId, UserMood } from '@/types'
import ProfileView, { type AchievementItem, type ProfileViewProps } from './ProfileView'

// The Meadow icon for each achievement. The four on the A2 board are drawn as
// the board drew them (Perfect Day a sun, Week Warrior a week calendar,
// Devoted Caretaker a heart, Player One a green pad); the rest follow their
// old icon, with a sparkle for Clean Sweep and a letter for Love Note so no
// two neighbours on the shelf read the same.
const ACHIEVEMENT_ICON: Record<AchievementId, { icon: MeadowIconName; color?: string }> = {
  first_care: { icon: 'paw' },
  all_care_day: { icon: 'sun' },
  clean_sweep: { icon: 'sparkle' },
  care_100: { icon: 'heart' },
  streak_7: { icon: 'calendarWeek' },
  streak_30: { icon: 'flame' },
  streak_100: { icon: 'flame' },
  first_game: { icon: 'pad', color: M.leaf },
  high_score_50: { icon: 'crown' },
  all_games: { icon: 'trophy' },
  level_10: { icon: 'star' },
  level_25: { icon: 'trophy' },
  level_50: { icon: 'crown' },
  battle_win: { icon: 'trophy' },
  mood_7: { icon: 'moon' },
  first_nudge: { icon: 'loveLetter' },
}

function toItem(def: AchievementDef, unlocked: boolean): AchievementItem {
  const look = ACHIEVEMENT_ICON[def.id] ?? { icon: 'trophy' }
  return {
    id: def.id, title: def.title, description: def.description, rarity: def.rarity,
    coins: def.coins, icon: look.icon, iconColor: look.color, unlocked,
  }
}

type Supabase = ReturnType<typeof createClient>

const PAGE = 1000

/**
 * Lifetime seconds with the cat for one person, or null if a read failed.
 * time_spent keeps one row per app session, so an active player passes
 * PostgREST's 1000-row response cap within a few months; reading it in pages
 * is what keeps the total from quietly freezing at the first thousand.
 */
async function lifetimeSeconds(supabase: Supabase, userId: string): Promise<number | null> {
  let total = 0
  for (let page = 0; page < 100; page++) {
    const from = page * PAGE
    const { data, error } = await withRetry(() => supabase
      .from('time_spent')
      .select('duration_seconds')
      .eq('user_id', userId)
      .order('id')
      .range(from, from + PAGE - 1))
    if (error || !data) return null
    for (const row of data) total += row.duration_seconds ?? 0
    if (data.length < PAGE) break
  }
  return total
}

interface MonthState {
  year: number
  month: number
  today: number
  rows: Array<{ user_id: string; mood: UserMood; date: string }>
  failed: boolean
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const { user, profile, loading } = useAuth()
  const { setHideStats } = useCare()
  const { partner, isSolo, anniversary } = useCouple()
  const { stats } = useErenStats(profile?.household_id)
  const {
    achievements, streak, streakRepairAvailable, streakRepairCost, repairStreak,
    coins, xp, level, loading: tasksLoading,
  } = useTasks()

  // The Meadow pages carry their own header; the old HUD steps aside here.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  const [mySeconds, setMySeconds] = useState<number | null>(null)
  const [partnerSeconds, setPartnerSeconds] = useState<number | null>(null)
  const [firstDay, setFirstDay] = useState<string | null>(null)
  const [month, setMonth] = useState<MonthState | null>(null)
  // Today's date key for the streak-repair window, read after mount (a clock
  // read during render would differ between the server and the client).
  const [todayKey, setTodayKey] = useState<string | null>(null)
  useEffect(() => { setTodayKey(format(new Date(), 'yyyy-MM-dd')) }, [])

  useEffect(() => {
    if (!user?.id) return
    let live = true
    void lifetimeSeconds(supabase, user.id).then(s => { if (live) setMySeconds(s) })
    void withRetry(() => supabase
      .from('time_spent')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle())
      .then(({ data }) => { if (live && data?.date) setFirstDay(data.date as string) })
    return () => { live = false }
  }, [supabase, user?.id])

  useEffect(() => {
    if (!partner?.id) return
    let live = true
    void lifetimeSeconds(supabase, partner.id).then(s => { if (live) setPartnerSeconds(s) })
    return () => { live = false }
  }, [supabase, partner?.id])

  // "Today" is a clock read, so it is taken after mount (a server render and
  // the first client render must agree), then the month's moods are fetched.
  useEffect(() => {
    if (!profile?.household_id) return
    const now = new Date()
    const year = now.getFullYear()
    const monthIdx = now.getMonth()
    const start = moodDateKey(new Date(year, monthIdx, 1))
    let live = true
    void withRetry(() => supabase
      .from('daily_moods')
      .select('user_id, mood, date')
      .gte('date', start)
      .lte('date', moodDateKey(new Date(year, monthIdx + 1, 0))))
      .then(({ data, error }) => {
        if (!live) return
        setMonth({
          year, month: monthIdx, today: now.getDate(),
          rows: error || !data ? [] : (data as MonthState['rows']),
          failed: !!error,
        })
      })
    return () => { live = false }
  }, [supabase, profile?.household_id])

  // `first_nudge` needs a partner to nudge. Solo it would be a card that can
  // never turn over, under a total that could never fill, so it drops out
  // unless it was already earned (a household that paired and later unpaired
  // keeps it).
  const defs = useMemo(
    () => (isSolo ? ACHIEVEMENT_DEFS.filter(d => d.id !== 'first_nudge' || !!achievements.first_nudge) : ACHIEVEMENT_DEFS),
    [isSolo, achievements],
  )

  usePageReady(!loading && !!profile)

  // Every hook is above this line: `loading` is true on the first render of
  // every visit, and a hook below an early return crashes the page.
  if (loading || !profile || !user) {
    return <MeadowPage ground="me" title="Me"><span /></MeadowPage>
  }

  // null until the stats row is in: catIdentityFromStats(null) is the
  // default cat, which would read as this household's own.
  const cat = stats ? catIdentityFromStats(stats) : null
  const unlocked = defs.filter(d => !!achievements[d.id])
  // The shelf shows the four most recent unlocks, topped up with the next
  // locked ones for a household that has fewer than four.
  const recent = [...unlocked]
    .sort((a, b) => String(achievements[b.id] ?? '').localeCompare(String(achievements[a.id] ?? '')))
    .slice(0, 4)
    .map(d => toItem(d, true))
  const shelf = recent.length >= 4
    ? recent
    : [...recent, ...defs.filter(d => !achievements[d.id]).slice(0, 4 - recent.length).map(d => toItem(d, false))]

  const xpIn = Math.max(0, xp - totalXpForLevel(level))

  const me = { name: profile.name, color: personColor(profile.heart), seconds: mySeconds }
  const other = partner
    ? { name: partner.name, color: personColor(partner.heart), seconds: partnerSeconds }
    : isSolo && cat
      ? { name: cat.name, color: PERSON.eren, seconds: null }
      : null

  let monthProps: ProfileViewProps['month'] = null
  if (month) {
    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
    const mine: Array<UserMood | null> = Array.from({ length: daysInMonth }, () => null)
    const calendar: Record<number, MoodCalendarDay> = {}
    for (const r of month.rows) {
      const day = Number(r.date.slice(8, 10))
      if (!day || day > daysInMonth) continue
      const entry = calendar[day] ?? (calendar[day] = {})
      if (r.user_id === user.id) { entry.mine = r.mood; mine[day - 1] = r.mood }
      else entry.partner = r.mood
    }
    monthProps = {
      label: format(new Date(month.year, month.month, 1), 'MMMM'),
      year: month.year, month: month.month, daysInMonth, today: month.today,
      mine, calendar, failed: month.failed,
    }
  }

  // streakRepairAvailable also folds in "can afford it", so on its own it
  // can't tell a closed window from a short purse; the window is asked
  // directly and the coins are shown as what is missing.
  const broken = streak.brokenAt && (streak.priorCurrent ?? 0) > 0
  const windowOpen = todayKey ? canRepairStreak(streak, todayKey) : streakRepairAvailable
  const streakBreak: ProfileViewProps['streakBreak'] = broken
    ? {
        prior: streak.priorCurrent ?? 0,
        cost: streakRepairCost,
        available: windowOpen,
        coinsShort: Math.max(0, streakRepairCost - coins),
      }
    : null

  return (
    <ProfileView
      me={me}
      other={other}
      otherIsCat={!partner && isSolo}
      streak={{
        current: tasksLoading ? null : streak.current,
        best: tasksLoading ? null : streak.best,
        freezes: streak.freezeTokens ?? 0,
      }}
      togetherDays={anniversary ? anniversary.days : null}
      level={tasksLoading ? null : { level, xpIn, xpNeeded: xpForNextLevel(level) }}
      timeSince={firstDay ? format(parseISO(firstDay), 'd MMM') : null}
      achievements={{
        unlocked: unlocked.length,
        total: defs.length,
        shelf,
        all: defs.map(d => toItem(d, !!achievements[d.id])),
      }}
      cat={cat && { name: cat.name, sexLabel: SEX_LABELS[cat.sex], coatLabel: coatLabel(cat.look), look: cat.look }}
      month={monthProps}
      streakBreak={streakBreak}
      onRepairStreak={async () => {
        playSound('ui_modal_open')
        const ok = await repairStreak()
        if (ok) playSound('ui_modal_close')
        return ok
      }}
    />
  )
}
