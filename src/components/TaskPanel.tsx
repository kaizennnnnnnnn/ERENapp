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
// The button is a white pill over the room art like its neighbours in the row:
// the scroll, today's count in ink, then the week's a shade lighter. When the
// row runs short, the week's count steps out of sight.

import { useState, type CSSProperties } from 'react'
import { addWeeks, startOfISOWeek, startOfTomorrow } from 'date-fns'
import { useTasks } from '@/contexts/TaskContext'
import { useCouple } from '@/hooks/useCouple'
import { useCat } from '@/hooks/useCat'
import { TASK_DEFS, getDailyKey, getWeeklyKey } from '@/lib/tasks'
import type { TaskId, TaskDef } from '@/types'
import { playSound } from '@/lib/sounds'
import { HUD_BUTTON } from './home/HudBadge'
import {
  CheckDisc, Divider, IconTile, MeadowIcon, Meter, Segmented, Sheet,
  M, TINT, TYPE, type MeadowIconName,
} from '@/components/meadow'

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

      <QuestsPill dailyDone={dailyDone} dailyTotal={dailyTasks.length}
        weeklyDone={weeklyDone} weeklyTotal={weeklyTasks.length} onOpen={openSheet} />
    </>
  )
}

/** The quests button in home's row, from plain props. */
export function QuestsPill({ dailyDone, dailyTotal, weeklyDone, weeklyTotal, onOpen }: {
  dailyDone: number
  dailyTotal: number
  weeklyDone: number
  weeklyTotal: number
  onOpen: () => void
}) {
  // Each half is a full-height cell and the pill wraps but is one line tall:
  // when the row runs short (a fortune gift waiting on a narrow phone), the
  // week's half wraps onto a second line that is out of sight, instead of
  // clipping or spilling past the pill's edge.
  const cell: CSSProperties = { height: HUD_BUTTON, display: 'flex', alignItems: 'center', gap: 6 }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Quests: ${dailyDone} of ${dailyTotal} daily, ${weeklyDone} of ${weeklyTotal} weekly`}
      className="m-lip m-focus w-full"
      style={{
        '--m-lip': M.overArtLip, '--m-lip-h': '3px',
        height: HUD_BUTTON, boxSizing: 'border-box', padding: '0 12px 0 9px', overflow: 'hidden',
        display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', columnGap: 6,
        borderRadius: 999, background: '#FFFFFF', border: 0, color: M.text, cursor: 'pointer',
        fontSize: 15, whiteSpace: 'nowrap', ...TYPE.number,
      } as CSSProperties}
    >
      <span style={cell}>
        <MeadowIcon name="scroll" size={20} />
        <span>{dailyDone}<span style={{ color: M.faint }}>/{dailyTotal}</span></span>
      </span>
      <span style={{ ...cell, color: M.text2 }}>
        <span aria-hidden style={{ width: 2, height: 16, borderRadius: 1, background: M.hairline }} />
        <span>{weeklyDone}<span style={{ color: M.faint }}>/{weeklyTotal}</span></span>
      </span>
    </button>
  )
}
