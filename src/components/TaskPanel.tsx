'use client'

// ─── Quests ──────────────────────────────────────────────────────────────────
// The quests button in home's row, and the Quests sheet it opens.
//
// The sheet is a Meadow sheet, like Me's achievements: a Daily / Weekly switch
// with each list's count, how far along it is and when it resets, then one row
// per quest: its icon on a soft tint, what to do, and what it pays (a leaf
// check once it's done). The ones that count up (2 of 4 care types) carry a
// meter. Done quests sink to the bottom, so what's left is on top.
//
// The button keeps the candy look of its neighbours in the row (cuteBtn): the
// daily count in amber and the weekly in violet.

import { useState } from 'react'
import { addWeeks, startOfISOWeek, startOfTomorrow } from 'date-fns'
import { useTasks } from '@/contexts/TaskContext'
import { useCouple } from '@/hooks/useCouple'
import { useCat } from '@/hooks/useCat'
import { TASK_DEFS, getDailyKey, getWeeklyKey } from '@/lib/tasks'
import type { TaskId, TaskDef } from '@/types'
import { IconScroll } from './PixelIcons'
import { playSound } from '@/lib/sounds'
import { cuteBtn, CuteIcon } from './obsidian'
import {
  CheckDisc, Divider, IconTile, MeadowIcon, Meter, Segmented, Sheet,
  M, TINT, TYPE, type MeadowIconName,
} from '@/components/meadow'

// The button: a light parchment-tan candy tile, a pale version of the scroll
// icon's own colour. Its counters are colour-coded dark numbers (amber daily,
// violet weekly) so they read crisply on the pale fill.
const QUEST_RGB = '232,210,160'
const COUNTER_SHADOW = '0 1px 0 rgba(255,255,255,0.45)'  // light emboss
const DAILY_NUM  = '#B45309'   // dark amber  — daily counter
const WEEKLY_NUM = '#6D28D9'   // dark violet — weekly counter

type Period = 'daily' | 'weekly'

/** Each quest's icon and the tint behind it, from what you do for it. */
const QUEST_LOOK: Partial<Record<TaskId, { icon: MeadowIconName; tint: string }>> = {
  daily_mood:        { icon: 'sun',          tint: TINT.amber },
  daily_feed:        { icon: 'bowl',         tint: TINT.orange },
  daily_play:        { icon: 'paw',          tint: TINT.love },
  daily_sleep:       { icon: 'moon',         tint: TINT.lilac },
  daily_wash:        { icon: 'drop',         tint: TINT.sky },
  daily_game:        { icon: 'pad',          tint: TINT.leaf },
  daily_nudge:       { icon: 'loveLetter',   tint: TINT.love },
  daily_chem_lesson: { icon: 'doc',          tint: TINT.blue },
  daily_chem_streak: { icon: 'flame',        tint: TINT.orange },
  weekly_all_care:   { icon: 'star',         tint: TINT.amber },
  weekly_all_games:  { icon: 'trophy',       tint: TINT.amber },
  weekly_high_score: { icon: 'crown',        tint: TINT.amber },
  weekly_mood_5:     { icon: 'calendarWeek', tint: TINT.sky },
  weekly_no_sick:    { icon: 'heart',        tint: TINT.love },
}
const FALLBACK_LOOK = { icon: 'star' as MeadowIconName, tint: TINT.soft }

/** "Resets in 5h 12m": the daily list turns over at local midnight, the
 *  weekly one on Monday (ISO weeks), matching getDailyKey / getWeeklyKey. */
function resetsIn(period: Period, now: Date): string {
  const next = period === 'daily' ? startOfTomorrow() : startOfISOWeek(addWeeks(now, 1))
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `Resets in ${d}d ${h}h`
  if (h > 0) return `Resets in ${h}h ${m}m`
  return `Resets in ${m}m`
}

function QuestRow({ task, done, progress }: { task: TaskDef; done: boolean; progress: number | null }) {
  const cat = useCat()
  const look = QUEST_LOOK[task.id] ?? FALLBACK_LOOK
  const title = cat.t(task.title)
  // The quests that count up (2 of 4 care types) show how far along they are.
  const meter = !done && progress !== null && task.maxProgress ? { at: progress, of: task.maxProgress } : null
  const label = done
    ? `${title}, done`
    : `${title}. ${cat.t(task.desc)}.${meter ? ` ${meter.at} of ${meter.of}.` : ''} Pays ${task.coins} coins and ${task.xp} XP`

  return (
    <div role="listitem" aria-label={label}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
      <IconTile icon={look.icon} size={44} bg={look.tint} iconSize={26}
        style={{ opacity: done ? 0.55 : 1 }} />

      <span aria-hidden style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: done ? M.text2 : M.text, overflowWrap: 'anywhere' }}>
          {title}
        </span>
        <span style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>
          {cat.t(task.desc)}
        </span>
        {meter && (
          <span style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Meter value={meter.at / meter.of} height={6} style={{ flex: '1 1 auto' }} />
            <span style={{ fontSize: 12, color: M.text2, ...TYPE.number }}>{meter.at}/{meter.of}</span>
          </span>
        )}
      </span>

      {done ? (
        <CheckDisc />
      ) : (
        <span aria-hidden style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: M.text, ...TYPE.number }}>
            <MeadowIcon name="coin" size={16} />+{task.coins}
          </span>
          <span style={{ fontSize: 12, color: M.leafInk, ...TYPE.number }}>+{task.xp} XP</span>
        </span>
      )}
    </div>
  )
}

export default function TaskPanel() {
  const { completedIds, taskProgress } = useTasks()
  const [tab, setTab] = useState<Period>('daily')
  const [open, setOpen] = useState(false)
  // When the sheet opened: the "Resets in" line is worked out from it, so the
  // render stays a pure function of state (and nothing clock-derived renders
  // before the first tap).
  const [openedAt, setOpenedAt] = useState<Date | null>(null)
  const { isSolo } = useCouple()

  const dailyKey   = getDailyKey()
  const weeklyKey  = getWeeklyKey()
  // `daily_nudge` is "Send your partner a nudge", and the sheet that
  // sends one is mounted behind `partner &&`. Left in for a household of one it
  // is a row that can never tick and a denominator that can never be reached:
  // the chip, the meter and the tab all read x/10 with 10 permanently out of
  // range. Everything below derives from this array, so dropping it here fixes
  // all of them at once.
  const dailyTasks  = TASK_DEFS.filter(t => t.period === 'daily' && !(isSolo && t.id === 'daily_nudge'))
  const weeklyTasks = TASK_DEFS.filter(t => t.period === 'weekly')
  const dailyDone   = dailyTasks.filter(t => completedIds.has(`${t.id}:${dailyKey}`)).length
  const weeklyDone  = weeklyTasks.filter(t => completedIds.has(`${t.id}:${weeklyKey}`)).length

  const tasks = tab === 'daily' ? dailyTasks : weeklyTasks
  const key   = tab === 'daily' ? dailyKey   : weeklyKey
  const done  = tab === 'daily' ? dailyDone  : weeklyDone
  const isDone = (t: TaskDef) => completedIds.has(`${t.id}:${key}`)
  // What's left first; within each half the catalogue's own order.
  const rows = [...tasks.filter(t => !isDone(t)), ...tasks.filter(isDone)]

  const count = (n: number, of: number) => (
    <span style={{ marginLeft: 6, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>{n}/{of}</span>
  )

  function openSheet() {
    playSound('ui_modal_open')
    setOpenedAt(new Date())
    setOpen(true)
  }

  return (
    <>
      {/* Full height in both lists, so the Daily / Weekly switch stays put
          under the finger instead of riding the sheet's top edge. */}
      <Sheet open={open} onClose={() => { playSound('ui_modal_close'); setOpen(false) }} title="Quests"
        height="calc(100% - 56px)">
        <Segmented<Period>
          ariaLabel="Which quests"
          value={tab}
          onChange={t => { playSound('ui_tap'); setTab(t) }}
          options={[
            { value: 'daily', label: <>Daily{count(dailyDone, dailyTasks.length)}</> },
            { value: 'weekly', label: <>Weekly{count(weeklyDone, weeklyTasks.length)}</> },
          ]}
        />

        <div style={{ margin: '16px 4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>
              {done === tasks.length ? (
                <span style={{ color: M.leafInk, fontWeight: 800 }}>All done</span>
              ) : (
                <><span style={{ fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }}>{done}</span> of {tasks.length} done</>
              )}
            </span>
            {openedAt && (
              <span style={{ fontSize: 13, fontWeight: 700, color: M.label, whiteSpace: 'nowrap' }}>
                {resetsIn(tab, openedAt)}
              </span>
            )}
          </div>
          <Meter value={tasks.length ? done / tasks.length : 0} label={tab === 'daily' ? 'Daily quests done' : 'Weekly quests done'} />

          <div role="list" style={{ marginTop: 6 }}>
            {rows.map((task, i) => {
              const progress = task.maxProgress ? (taskProgress.get(task.id) ?? 0) : null
              return (
                <div key={task.id}>
                  {i > 0 && <Divider inset={58} />}
                  <QuestRow task={task} done={isDone(task)} progress={progress} />
                </div>
              )
            })}
          </div>
        </div>
      </Sheet>

      {/* Quest button */}
      <button
        type="button"
        onClick={openSheet}
        aria-label={`Quests: ${dailyDone} of ${dailyTasks.length} daily, ${weeklyDone} of ${weeklyTasks.length} weekly`}
        className="w-full flex items-center gap-2 px-2.5 h-8 active:scale-[0.97] transition-transform relative overflow-hidden"
        style={cuteBtn(QUEST_RGB)}
      >
        <CuteIcon><IconScroll size={20} /></CuteIcon>

        {/* Colour-coded counters: amber daily · violet weekly. A little
            diamond tags each one, the done count is big and bright, the
            total dims back — so it reads as progress at a glance. */}
        <div className="font-pixel flex items-center min-w-0" style={{ whiteSpace: 'nowrap', textShadow: COUNTER_SHADOW, gap: 7 }}>
          <span className="flex items-center" style={{ gap: 3 }}>
            <span style={{ width: 4, height: 4, background: DAILY_NUM, transform: 'rotate(45deg)', boxShadow: '0 0 0 1px rgba(0,0,0,0.18)' }} />
            <span style={{ fontSize: 8, color: DAILY_NUM }}>{dailyDone}</span>
            <span style={{ fontSize: 6, color: DAILY_NUM, opacity: 0.5 }}>/{dailyTasks.length}</span>
          </span>
          <span className="flex items-center" style={{ gap: 3 }}>
            <span style={{ width: 4, height: 4, background: WEEKLY_NUM, transform: 'rotate(45deg)', boxShadow: '0 0 0 1px rgba(0,0,0,0.18)' }} />
            <span style={{ fontSize: 8, color: WEEKLY_NUM }}>{weeklyDone}</span>
            <span style={{ fontSize: 6, color: WEEKLY_NUM, opacity: 0.5 }}>/{weeklyTasks.length}</span>
          </span>
        </div>
      </button>
    </>
  )
}
