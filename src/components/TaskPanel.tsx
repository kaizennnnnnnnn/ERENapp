'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTasks } from '@/contexts/TaskContext'
import { TASK_DEFS, getDailyKey, getWeeklyKey } from '@/lib/tasks'
import type { TaskId } from '@/types'

export default function TaskPanel() {
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
            <span style={{ fontSize: 20 }}>📋</span>
            <span className="font-pixel text-purple-700" style={{ fontSize: 9 }}>QUESTS</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
            style={{ borderRadius: 6, border: '2px solid #E0D0F8', background: 'white' }}
          >
            <span className="font-pixel text-purple-400" style={{ fontSize: 9 }}>✕</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '2px solid #EDE8FF' }}>
          {(['daily', 'weekly'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3 font-pixel transition-all"
              style={{
                fontSize: 8,
                background: tab === t
                  ? (t === 'daily' ? 'linear-gradient(135deg, #FFF8D0, #FFF0A0)' : 'linear-gradient(135deg, #F0E8FF, #E8D8FF)')
                  : 'white',
                color: tab === t ? (t === 'daily' ? '#B07800' : '#6030B0') : '#A0A0C0',
                borderBottom: tab === t ? `3px solid ${t === 'daily' ? '#F5C842' : '#A78BFA'}` : 'none',
              }}>
              {t === 'daily' ? '⚡ DAILY' : '📅 WEEKLY'}
              <span className="ml-2" style={{ color: tab === t ? 'inherit' : '#C0C0D8' }}>
                {t === 'daily' ? `${dailyDone}/${dailyTasks.length}` : `${weeklyDone}/${weeklyTasks.length}`}
              </span>
            </button>
          ))}
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
                <span style={{ fontSize: 24, opacity: isDone ? 0.45 : 1 }}>{task.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-pixel" style={{
                    fontSize: 7,
                    color: isDone ? '#6EE7A0' : '#4A3870',
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 leading-snug">{task.desc}</p>
                  {/* Progress bar for weekly tasks with maxProgress */}
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
                    <span className="font-pixel text-amber-500" style={{ fontSize: 7 }}>+{task.coins}🪙</span>
                    <span className="font-pixel text-purple-400" style={{ fontSize: 7 }}>+{task.xp}XP</span>
                  </div>
                )}
              </div>
            )
          })}
          {/* bottom padding for safe area */}
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
        <span style={{ fontSize: 16 }}>📋</span>
        <div className="flex-1 text-left">
          <p className="font-pixel text-purple-700" style={{ fontSize: 7 }}>QUESTS</p>
          <p className="text-[9px] text-gray-400 mt-0.5">{dailyDone}/{dailyTasks.length} daily · {weeklyDone}/{weeklyTasks.length} weekly</p>
        </div>
        {/* Progress rings */}
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
    </>
  )
}
