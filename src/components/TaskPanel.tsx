'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTasks } from '@/contexts/TaskContext'
import { TASK_DEFS, getDailyKey, getWeeklyKey } from '@/lib/tasks'
import type { TaskId, TaskDef } from '@/types'
import {
  IconScroll, IconLightning, IconClock, IconCoin, IconHeart,
  IconMeat, IconYarn, IconMoonZ, IconBath, IconController,
  IconStar, IconCrown,
} from './PixelIcons'
import { playSound } from '@/lib/sounds'
import { PINK, PINK_HI, PINK_LO, OBSIDIAN_BTN, Rivets, pinkText, accentA, cuteBtn, CuteIcon } from './obsidian'

// Quest pill is a light parchment-tan candy tile — a pale version of the
// scroll icon's own colour. The counters are colour-coded dark numbers
// (amber = daily, violet = weekly) so they read crisply on the pale fill
// without needing separate indicator dots.
const QUEST_RGB = '232,210,160'
const COUNTER_SHADOW = '0 1px 0 rgba(255,255,255,0.45)'  // light emboss
const DAILY_NUM  = '#B45309'   // dark amber  — daily counter
const WEEKLY_NUM = '#6D28D9'   // dark violet — weekly counter

function TaskIcon({ task, size = 22 }: { task: TaskDef; size?: number }) {
  switch (task.id) {
    case 'daily_mood':        return <IconHeart size={size} />
    case 'daily_feed':        return <IconMeat size={size} />
    case 'daily_play':        return <IconYarn size={size} />
    case 'daily_sleep':       return <IconMoonZ size={size} />
    case 'daily_wash':        return <IconBath size={size} />
    case 'daily_game':        return <IconController size={size} />
    case 'weekly_all_care':   return <IconStar size={size} />
    case 'weekly_all_games':  return <IconCrown size={size} />
    case 'weekly_high_score': return <IconCrown size={size} />
    case 'weekly_mood_5':     return <IconClock size={size} />
    case 'weekly_no_sick':    return <IconHeart size={size} />
    default:                  return <IconScroll size={size} />
  }
}

// ── Tier colors used for the daily/weekly counters (semantic tags inside
// the panel — chrome around them is always purple obsidian). ──
const DAILY_DOT  = '#F5C842'   // amber — "today's urgent"
const WEEKLY_DOT = '#A78BFA' // lavender — "longer arc" (kept distinct from the pink chrome)

const DONE_GREEN     = '#86EFAC'
const DONE_GREEN_DEEP= '#22C55E'

export default function TaskPanel({ compact = false }: { compact?: boolean }) {
  const { completedIds, taskProgress } = useTasks()
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily')
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const dailyKey   = getDailyKey()
  const weeklyKey  = getWeeklyKey()
  const dailyTasks  = TASK_DEFS.filter(t => t.period === 'daily')
  const weeklyTasks = TASK_DEFS.filter(t => t.period === 'weekly')
  const dailyDone   = dailyTasks.filter(t => completedIds.has(`${t.id}:${dailyKey}`)).length
  const weeklyDone  = weeklyTasks.filter(t => completedIds.has(`${t.id}:${weeklyKey}`)).length

  const tasks = tab === 'daily' ? dailyTasks : weeklyTasks
  const key   = tab === 'daily' ? dailyKey   : weeklyKey

  const modal = mounted && open && createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(8,4,20,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={() => { playSound('ui_modal_close'); setOpen(false) }}
      />

      {/* Sheet — obsidian panel docked to the bottom */}
      <div
        className="relative max-w-md w-full mx-auto flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
          borderRadius: '14px 14px 0 0',
          border: `1px solid ${accentA(0.4)}`,
          borderBottom: 'none',
          boxShadow: `0 -10px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
          maxHeight: '82vh',
          animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <Rivets inset={6} size={3} />

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{
            width: 44, height: 4, borderRadius: 2,
            background: `linear-gradient(90deg, ${PINK_LO}, ${PINK}, ${PINK_LO})`,
            boxShadow: `0 0 6px ${accentA(0.4)}`,
          }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${accentA(0.2)}` }}>
          <div className="flex items-center gap-2">
            <IconScroll size={20} />
            <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 1.5, ...pinkText }}>QUESTS</span>
          </div>
          <button
            onClick={() => { playSound('ui_modal_close'); setOpen(false) }}
            className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform relative"
            style={OBSIDIAN_BTN}
          >
            <Rivets inset={2} size={2} />
            <span className="font-pixel" style={{ fontSize: 9, color: PINK_HI }}>X</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: `1px solid ${accentA(0.2)}` }}>
          {(['daily', 'weekly'] as const).map(t => {
            const active = tab === t
            const done = t === 'daily' ? dailyDone : weeklyDone
            const total = t === 'daily' ? dailyTasks.length : weeklyTasks.length
            const accent = t === 'daily' ? DAILY_DOT : WEEKLY_DOT
            return (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-3 flex items-center justify-center gap-1.5 font-pixel transition-all relative"
                style={{
                  fontSize: 8, letterSpacing: 1,
                  background: active
                    ? 'linear-gradient(180deg, rgba(167,139,250,0.10), rgba(167,139,250,0))'
                    : 'transparent',
                  color: active ? PINK_HI : '#7A6F8C',
                  borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                  boxShadow: active ? `inset 0 1px 0 rgba(255,255,255,0.06)` : 'none',
                }}>
                {t === 'daily' ? <IconLightning size={14} /> : <IconClock size={14} />}
                <span>{t === 'daily' ? 'DAILY' : 'WEEKLY'}</span>
                <span className="ml-1" style={{
                  fontSize: 7,
                  color: active ? accent : '#5A5267',
                  textShadow: active ? `0 0 3px ${accent}66` : 'none',
                }}>
                  {done}/{total}
                </span>
              </button>
            )
          })}
        </div>

        {/* Task list */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          {tasks.map(task => {
            const isDone    = completedIds.has(`${task.id}:${key}`)
            const progress  = task.maxProgress ? (taskProgress.get(task.id as TaskId) ?? 0) : null
            const pct       = progress !== null && task.maxProgress ? Math.min(1, progress / task.maxProgress) : null

            return (
              <div key={task.id}
                className="flex items-center gap-3 px-3 py-3 transition-all relative"
                style={{
                  borderRadius: 4,
                  background: isDone
                    ? 'linear-gradient(180deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.04) 100%)'
                    : 'linear-gradient(180deg, #131317 0%, #050507 100%)',
                  border: `1px solid ${isDone ? `${DONE_GREEN}55` : `${accentA(0.2)}`}`,
                  boxShadow: isDone
                    ? 'inset 0 1px 0 rgba(255,255,255,0.06)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)',
                }}>
                <div className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 36, height: 36, borderRadius: 4,
                    background: 'linear-gradient(180deg, #1a1a20 0%, #0a0a0c 100%)',
                    border: `1px solid ${isDone ? `${DONE_GREEN}66` : `${accentA(0.33)}`}`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                    opacity: isDone ? 0.55 : 1,
                  }}>
                  <TaskIcon task={task} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-pixel" style={{
                    fontSize: 7, letterSpacing: 0.5,
                    color: isDone ? DONE_GREEN : PINK_HI,
                    textDecoration: isDone ? 'line-through' : 'none',
                    textShadow: isDone ? 'none' : `0 0 3px ${accentA(0.2)}`,
                  }}>
                    {task.title}
                  </p>
                  <p className="text-[10px] mt-1 leading-snug" style={{ color: '#7A6F8C' }}>{task.desc}</p>
                  {pct !== null && !isDone && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex-1 h-1.5 overflow-hidden" style={{
                        background: '#0a0a0c',
                        boxShadow: `inset 0 1px 2px rgba(0,0,0,0.8), inset 0 0 0 1px ${accentA(0.13)}`,
                      }}>
                        <div className="h-full transition-all duration-500"
                          style={{
                            width: `${pct * 100}%`,
                            background: `linear-gradient(90deg, ${PINK_HI}, ${PINK} 60%, ${PINK_LO})`,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                          }} />
                      </div>
                      <span className="font-pixel flex-shrink-0" style={{ fontSize: 6, color: PINK_HI }}>
                        {progress}/{task.maxProgress}
                      </span>
                    </div>
                  )}
                </div>
                {isDone ? (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: `radial-gradient(circle at 35% 28%, ${DONE_GREEN}, ${DONE_GREEN_DEEP})`,
                      boxShadow: `0 0 0 1.5px ${DONE_GREEN_DEEP}, 0 0 0 3px #000, 0 0 8px ${DONE_GREEN}88`,
                    }}>
                    <span className="font-pixel text-white" style={{ fontSize: 11, textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>✓</span>
                  </div>
                ) : (
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 7, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>
                      +{task.coins}
                      <IconCoin size={10} />
                    </span>
                    <span className="font-pixel" style={{ fontSize: 7, color: PINK_HI }}>+{task.xp}XP</span>
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ height: 16 }} />
        </div>
      </div>
    </div>,
    document.body
  )

  return (
    <>
      {modal}

      {/* Quest button */}
      {compact ? (
        <button
          onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
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
      ) : (
        <button
          onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
          className="w-full mb-3 flex items-center gap-2 px-3 py-2 active:scale-[0.98] transition-transform relative"
          style={OBSIDIAN_BTN}
        >
          <Rivets inset={3} size={3} />
          <IconScroll size={20} />
          <div className="flex-1 text-left">
            <p className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, ...pinkText }}>QUESTS</p>
            <p className="text-[9px] mt-0.5" style={{ color: '#7A6F8C' }}>
              {dailyDone}/{dailyTasks.length} daily · {weeklyDone}/{weeklyTasks.length} weekly
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative w-7 h-7">
              <svg width="28" height="28" viewBox="0 0 32 32" className="-rotate-90">
                <circle cx="16" cy="16" r="12" fill="none" stroke="#1a1a20" strokeWidth="3" />
                <circle cx="16" cy="16" r="12" fill="none" stroke={DAILY_DOT} strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - dailyDone / dailyTasks.length)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s', filter: `drop-shadow(0 0 2px ${DAILY_DOT}88)` }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-pixel" style={{ fontSize: 6, color: '#FFD760' }}>{dailyDone}</span>
            </div>
            <div className="relative w-7 h-7">
              <svg width="28" height="28" viewBox="0 0 32 32" className="-rotate-90">
                <circle cx="16" cy="16" r="12" fill="none" stroke="#1a1a20" strokeWidth="3" />
                <circle cx="16" cy="16" r="12" fill="none" stroke={WEEKLY_DOT} strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - weeklyDone / weeklyTasks.length)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s', filter: `drop-shadow(0 0 2px ${WEEKLY_DOT}88)` }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-pixel" style={{ fontSize: 6, color: PINK_HI }}>{weeklyDone}</span>
            </div>
            <span className="font-pixel" style={{ fontSize: 9, color: PINK_HI, opacity: 0.8 }}>▶</span>
          </div>
        </button>
      )}
    </>
  )
}
