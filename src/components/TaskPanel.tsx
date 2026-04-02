'use client'

import { useState } from 'react'
import { useTasks } from '@/contexts/TaskContext'
import { TASK_DEFS, getDailyKey, getWeeklyKey } from '@/lib/tasks'

export default function TaskPanel() {
  const { completedIds } = useTasks()
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily')
  const [open, setOpen] = useState(false)

  const dailyKey   = getDailyKey()
  const weeklyKey  = getWeeklyKey()
  const dailyTasks  = TASK_DEFS.filter(t => t.period === 'daily')
  const weeklyTasks = TASK_DEFS.filter(t => t.period === 'weekly')
  const dailyDone   = dailyTasks.filter(t => completedIds.has(`${t.id}:${dailyKey}`)).length
  const weeklyDone  = weeklyTasks.filter(t => completedIds.has(`${t.id}:${weeklyKey}`)).length

  const tasks = tab === 'daily' ? dailyTasks : weeklyTasks
  const key   = tab === 'daily' ? dailyKey   : weeklyKey

  return (
    <>
      {/* Quest button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full mb-3 flex items-center gap-2 px-3 py-2 active:scale-[0.98] transition-transform"
        style={{
          background: open ? 'linear-gradient(135deg, #F5F0FF, #EDE8FF)' : 'white',
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
          <span className="font-pixel text-purple-400" style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="mb-3 rounded-xl overflow-hidden" style={{ border: '2px solid #D8C8F8', boxShadow: '3px 3px 0 #C8B0F0' }}>
          {/* Tab row */}
          <div className="flex" style={{ borderBottom: '2px solid #D8C8F8' }}>
            {(['daily', 'weekly'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2 font-pixel transition-all"
                style={{
                  fontSize: 7,
                  background: tab === t
                    ? (t === 'daily' ? 'linear-gradient(135deg, #FFF8D0, #FFF0A0)' : 'linear-gradient(135deg, #F0E8FF, #E8D8FF)')
                    : 'white',
                  color: tab === t ? (t === 'daily' ? '#B07800' : '#6030B0') : '#A0A0C0',
                  borderBottom: tab === t ? `3px solid ${t === 'daily' ? '#F5C842' : '#A78BFA'}` : 'none',
                }}>
                {t === 'daily' ? '⚡ DAILY' : '📅 WEEKLY'}
                <span className="ml-1.5" style={{ color: tab === t ? 'inherit' : '#C0C0D8' }}>
                  {t === 'daily' ? `${dailyDone}/${dailyTasks.length}` : `${weeklyDone}/${weeklyTasks.length}`}
                </span>
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="bg-white p-2.5 flex flex-col gap-2">
            {tasks.map(task => {
              const isDone = completedIds.has(`${task.id}:${key}`)
              return (
                <div key={task.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 transition-all"
                  style={{
                    borderRadius: 6,
                    background: isDone ? 'linear-gradient(135deg, rgba(134,239,172,0.12), rgba(74,222,128,0.08))' : 'rgba(248,245,255,0.8)',
                    border: `1.5px solid ${isDone ? '#86EFAC' : '#EDE8FF'}`,
                  }}>
                  <span style={{ fontSize: 18, opacity: isDone ? 0.5 : 1 }}>{task.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel" style={{ fontSize: 7, color: isDone ? '#86EFAC' : '#4A3870', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {task.title}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{task.desc}</p>
                  </div>
                  {isDone ? (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #86EFAC, #4ADE80)', boxShadow: '0 2px 8px rgba(74,222,128,0.4)' }}>
                      <span className="font-pixel text-white" style={{ fontSize: 9 }}>✓</span>
                    </div>
                  ) : (
                    <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                      <span className="font-pixel text-amber-500" style={{ fontSize: 6 }}>+{task.coins}🪙</span>
                      <span className="font-pixel text-purple-400" style={{ fontSize: 6 }}>+{task.xp}XP</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
