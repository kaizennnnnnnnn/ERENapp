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
        style={{ background: 'rgba(30,10,60,0.45)' }}
        onClick={() => setOpen(false)}
      />

      {/* Sheet */}
      <div
        className="relative max-w-md w-full mx-auto flex flex-col overflow-hidden"
        style={{
          background: '#FDFAFF',
          borderRadius: '20px 20px 0 0',
          border: '2px solid #D8C8F8',
          borderBottom: 'none',
          maxHeight: '82vh',
          animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#D8C8F8' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2px solid #EDE8FF' }}>
          <div className="flex items-center gap-2">
            <IconScroll size={20} />
            <span className="font-pixel text-purple-700" style={{ fontSize: 9 }}>QUESTS</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
            style={{ borderRadius: 6, border: '2px solid #E0D0F8', background: 'white' }}
          >
            <span className="font-pixel text-purple-400" style={{ fontSize: 9 }}>X</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '2px solid #EDE8FF' }}>
          {(['daily', 'weekly'] as const).map(t => {
            const active = tab === t
            const done = t === 'daily' ? dailyDone : weeklyDone
            const total = t === 'daily' ? dailyTasks.length : weeklyTasks.length
            return (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-3 flex items-center justify-center gap-1.5 font-pixel transition-all"
                style={{
                  fontSize: 8,
                  background: active
                    ? (t === 'daily' ? 'linear-gradient(135deg, #FFF8D0, #FFF0A0)' : 'linear-gradient(135deg, #F0E8FF, #E8D8FF)')
                    : 'white',
                  color: active ? (t === 'daily' ? '#B07800' : '#6030B0') : '#A0A0C0',
                  borderBottom: active ? `3px solid ${t === 'daily' ? '#F5C842' : '#A78BFA'}` : 'none',
                }}>
                {t === 'daily' ? <IconLightning size={14} /> : <IconClock size={14} />}
                <span>{t === 'daily' ? 'DAILY' : 'WEEKLY'}</span>
                <span className="ml-1" style={{ color: active ? 'inherit' : '#C0C0D8' }}>
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
                className="flex items-center gap-3 px-3 py-3 transition-all"
                style={{
                  borderRadius: 10,
                  background: isDone
                    ? 'linear-gradient(135deg, rgba(134,239,172,0.12), rgba(74,222,128,0.06))'
                    : 'white',
                  border: `2px solid ${isDone ? '#86EFAC' : '#EDE8FF'}`,
                  boxShadow: isDone ? 'none' : '2px 2px 0 #EDE8FF',
                }}>
                <div className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: isDone ? 'rgba(134,239,172,0.2)' : 'linear-gradient(135deg, #F8F4FF, #EDE8FF)',
                    border: `1px solid ${isDone ? '#86EFAC' : '#E0D0F8'}`,
                    opacity: isDone ? 0.5 : 1,
                  }}>
                  <TaskIcon task={task} size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-pixel" style={{
                    fontSize: 7,
                    color: isDone ? '#6EE7A0' : '#4A3870',
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 leading-snug">{task.desc}</p>
                  {pct !== null && !isDone && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#EDE8FF' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct * 100}%`, background: 'linear-gradient(90deg, #A78BFA, #7C3AED)' }} />
                      </div>
                      <span className="font-pixel text-purple-500 flex-shrink-0" style={{ fontSize: 6 }}>
                        {progress}/{task.maxProgress}
                      </span>
                    </div>
                  )}
                </div>
                {isDone ? (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #86EFAC, #4ADE80)', boxShadow: '0 2px 8px rgba(74,222,128,0.4)' }}>
                    <span className="font-pixel text-white" style={{ fontSize: 11 }}>✓</span>
                  </div>
                ) : (
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="font-pixel text-amber-500 inline-flex items-center gap-1" style={{ fontSize: 7 }}>
                      +{task.coins}
                      <IconCoin size={10} />
                    </span>
                    <span className="font-pixel text-purple-400" style={{ fontSize: 7 }}>+{task.xp}XP</span>
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
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-1 px-1.5 h-10 active:scale-[0.97] transition-transform relative"
          style={{
            background: 'linear-gradient(180deg, rgba(28,18,56,0.92) 0%, rgba(12,6,26,0.95) 100%)',
            backdropFilter: 'blur(12px)',
            borderRadius: 8,
            border: '2px solid rgba(167,139,250,0.45)',
            boxShadow: '0 3px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px rgba(124,58,237,0.12)',
          }}
        >
          <IconScroll size={18} />

          {/* Inline counter — dots + numbers, no pill */}
          <div className="flex items-center gap-0.5 min-w-0">
            <div className="flex-shrink-0" style={{ width: 5, height: 5, borderRadius: '50%', background: '#F5C842', boxShadow: '0 0 4px #F5C842' }} />
            <span className="font-pixel flex-shrink-0" style={{ fontSize: 6, color: '#FFD760', letterSpacing: 0.5 }}>{dailyDone}/{dailyTasks.length}</span>
            <span className="font-pixel flex-shrink-0" style={{ fontSize: 6, color: '#5A408A', margin: '0 1px' }}>·</span>
            <div className="flex-shrink-0" style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', boxShadow: '0 0 4px #A78BFA' }} />
            <span className="font-pixel flex-shrink-0" style={{ fontSize: 6, color: '#D0BFFF', letterSpacing: 0.5 }}>{weeklyDone}/{weeklyTasks.length}</span>
          </div>

          <span className="font-pixel text-purple-300/70 ml-auto flex-shrink-0" style={{ fontSize: 8 }}>▶</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full mb-3 flex items-center gap-2 px-3 py-2 active:scale-[0.98] transition-transform"
          style={{
            background: 'white',
            borderRadius: 8,
            border: '2px solid #D8C8F8',
            boxShadow: '3px 3px 0 #C8B0F0',
          }}
        >
          <IconScroll size={20} />
          <div className="flex-1 text-left">
            <p className="font-pixel text-purple-700" style={{ fontSize: 7 }}>QUESTS</p>
            <p className="text-[9px] text-gray-400 mt-0.5">{dailyDone}/{dailyTasks.length} daily · {weeklyDone}/{weeklyTasks.length} weekly</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative w-7 h-7">
              <svg width="28" height="28" viewBox="0 0 32 32" className="-rotate-90">
                <circle cx="16" cy="16" r="12" fill="none" stroke="#EDE8FF" strokeWidth="3" />
                <circle cx="16" cy="16" r="12" fill="none" stroke="#F5C842" strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - dailyDone / dailyTasks.length)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s' }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-pixel text-amber-600" style={{ fontSize: 6 }}>{dailyDone}</span>
            </div>
            <div className="relative w-7 h-7">
              <svg width="28" height="28" viewBox="0 0 32 32" className="-rotate-90">
                <circle cx="16" cy="16" r="12" fill="none" stroke="#EDE8FF" strokeWidth="3" />
                <circle cx="16" cy="16" r="12" fill="none" stroke="#A78BFA" strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - weeklyDone / weeklyTasks.length)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s' }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-pixel text-purple-600" style={{ fontSize: 6 }}>{weeklyDone}</span>
            </div>
            <span className="font-pixel text-purple-400" style={{ fontSize: 9 }}>▶</span>
          </div>
        </button>
      )}
    </>
  )
}
