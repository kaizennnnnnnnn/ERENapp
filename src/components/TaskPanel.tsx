'use client'

import { useState, useEffect, useRef } from 'react'
import { useTasks } from '@/contexts/TaskContext'
import { TASK_DEFS, getDailyKey, getWeeklyKey, xpForNextLevel, totalXpForLevel, getLevelTitle } from '@/lib/tasks'

interface XpParticle { id: number; x: number; y: number; vx: number; vy: number; life: number; text: string }

interface Props {
  onTaskDone?: (coins: number, xp: number) => void
}

export default function TaskPanel({ onTaskDone }: Props) {
  const { completedIds, xp, level } = useTasks()
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily')
  const [open, setOpen] = useState(false)
  const [particles, setParticles] = useState<XpParticle[]>([])
  const [prevXp, setPrevXp] = useState(xp)
  const [animXp, setAnimXp] = useState(xp)
  const particleId = useRef(0)
  const barRef = useRef<HTMLDivElement>(null)

  const dailyKey  = getDailyKey()
  const weeklyKey = getWeeklyKey()
  const dailyTasks  = TASK_DEFS.filter(t => t.period === 'daily')
  const weeklyTasks = TASK_DEFS.filter(t => t.period === 'weekly')
  const dailyDone   = dailyTasks.filter(t => completedIds.has(`${t.id}:${dailyKey}`)).length
  const weeklyDone  = weeklyTasks.filter(t => completedIds.has(`${t.id}:${weeklyKey}`)).length

  // XP bar values
  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  const animXpInto  = animXp - totalXpForLevel(level)
  const animPct     = Math.min(100, Math.round((animXpInto / xpNeeded) * 100))

  // Detect XP gain and trigger particles
  useEffect(() => {
    if (xp > prevXp) {
      const gained = xp - prevXp
      // Animate bar fill
      setAnimXp(prevXp)
      setTimeout(() => setAnimXp(xp), 50)

      // Spawn particles from bar
      const rect = barRef.current?.getBoundingClientRect()
      const baseX = rect ? rect.left + rect.width * (animPct / 100) : window.innerWidth / 2
      const baseY = rect ? rect.top : window.innerHeight / 2

      const newParticles: XpParticle[] = Array.from({ length: 12 }, (_, i) => ({
        id: particleId.current++,
        x: baseX + (Math.random() - 0.5) * 60,
        y: baseY,
        vx: (Math.random() - 0.5) * 3,
        vy: -(Math.random() * 3 + 1),
        life: 1,
        text: i < 3 ? `+${gained}XP` : ['✦', '★', '✨', '⭐'][Math.floor(Math.random() * 4)],
      }))
      setParticles(p => [...p, ...newParticles])
      setTimeout(() => setParticles([]), 1200)
      setPrevXp(xp)
      if (onTaskDone) onTaskDone(0, gained)
    }
  }, [xp]) // eslint-disable-line react-hooks/exhaustive-deps

  const tasks = tab === 'daily' ? dailyTasks : weeklyTasks
  const done  = tab === 'daily' ? dailyDone  : weeklyDone
  const total = tasks.length
  const key   = tab === 'daily' ? dailyKey   : weeklyKey

  return (
    <>
      {/* Floating XP particles */}
      {particles.map(p => (
        <div key={p.id} className="fixed pointer-events-none z-50 font-pixel"
          style={{ left: p.x, top: p.y, fontSize: p.text.length > 2 ? 8 : 14, color: '#A78BFA', animation: 'floatUp 1.1s ease-out forwards', whiteSpace: 'nowrap' }}>
          {p.text}
        </div>
      ))}

      {/* Level + XP bar always visible */}
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #F5C842, #E8A020)', fontSize: 7 }}>Lv.{level}</span>
            <span className="font-pixel text-gray-500" style={{ fontSize: 7 }}>{getLevelTitle(level)}</span>
          </div>
          <span className="font-pixel text-gray-400" style={{ fontSize: 6 }}>{xpIntoLevel}/{xpNeeded} XP</span>
        </div>
        <div ref={barRef} className="h-2.5 rounded-full overflow-hidden relative"
          style={{ background: '#EDE8FF', border: '1px solid #D8CEF0' }}>
          {/* Animated fill */}
          <div className="h-full rounded-full"
            style={{ width: `${animPct}%`, background: 'linear-gradient(90deg, #A78BFA, #7C3AED)', transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }} />
          {/* Shine */}
          <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
        </div>
      </div>

      {/* Quest button */}
      <button onClick={() => setOpen(o => !o)} className="w-full mb-4 flex items-center gap-3 px-4 py-3 active:scale-[0.98] transition-transform"
        style={{ background: open ? 'linear-gradient(135deg, #F5F0FF, #EDE8FF)' : 'white', borderRadius: 8, border: '2px solid #D8C8F8', boxShadow: '3px 3px 0 #C8B0F0' }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div className="flex-1 text-left">
          <p className="font-pixel text-purple-700" style={{ fontSize: 8 }}>QUESTS</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{dailyDone}/{dailyTasks.length} daily · {weeklyDone}/{weeklyTasks.length} weekly</p>
        </div>
        {/* Progress rings */}
        <div className="flex items-center gap-1.5">
          <div className="relative w-8 h-8">
            <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
              <circle cx="16" cy="16" r="12" fill="none" stroke="#EDE8FF" strokeWidth="3" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#F5C842" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - dailyDone / dailyTasks.length)}`}
                style={{ transition: 'stroke-dashoffset 0.5s' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-pixel text-amber-600" style={{ fontSize: 7 }}>{dailyDone}</span>
          </div>
          <div className="relative w-8 h-8">
            <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
              <circle cx="16" cy="16" r="12" fill="none" stroke="#EDE8FF" strokeWidth="3" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#A78BFA" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - weeklyDone / weeklyTasks.length)}`}
                style={{ transition: 'stroke-dashoffset 0.5s' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-pixel text-purple-600" style={{ fontSize: 7 }}>{weeklyDone}</span>
          </div>
          <span className="font-pixel text-purple-400" style={{ fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '2px solid #D8C8F8', boxShadow: '3px 3px 0 #C8B0F0' }}>
          {/* Tab row */}
          <div className="flex" style={{ borderBottom: '2px solid #D8C8F8' }}>
            {(['daily', 'weekly'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2.5 font-pixel transition-all"
                style={{
                  fontSize: 7,
                  background: tab === t ? (t === 'daily' ? 'linear-gradient(135deg, #FFF8D0, #FFF0A0)' : 'linear-gradient(135deg, #F0E8FF, #E8D8FF)') : 'white',
                  color: tab === t ? (t === 'daily' ? '#B07800' : '#6030B0') : '#A0A0C0',
                  borderBottom: tab === t ? `3px solid ${t === 'daily' ? '#F5C842' : '#A78BFA'}` : 'none',
                }}>
                {t === 'daily' ? '⚡ DAILY' : '📅 WEEKLY'}
                <span className="ml-1.5" style={{ color: tab === t ? 'inherit' : '#C0C0D8' }}>{t === 'daily' ? `${dailyDone}/${dailyTasks.length}` : `${weeklyDone}/${weeklyTasks.length}`}</span>
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="bg-white p-3 flex flex-col gap-2">
            {tasks.map(task => {
              const isDone = completedIds.has(`${task.id}:${key}`)
              return (
                <div key={task.id}
                  className="flex items-center gap-3 px-3 py-2.5 transition-all"
                  style={{
                    borderRadius: 6,
                    background: isDone ? 'linear-gradient(135deg, rgba(134,239,172,0.12), rgba(74,222,128,0.08))' : 'rgba(248,245,255,0.8)',
                    border: `1.5px solid ${isDone ? '#86EFAC' : '#EDE8FF'}`,
                  }}>
                  <span style={{ fontSize: 20, opacity: isDone ? 0.5 : 1 }}>{task.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel" style={{ fontSize: 7, color: isDone ? '#86EFAC' : '#4A3870', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {task.title}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{task.desc}</p>
                  </div>
                  {isDone ? (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #86EFAC, #4ADE80)', boxShadow: '0 2px 8px rgba(74,222,128,0.4)' }}>
                      <span className="font-pixel text-white" style={{ fontSize: 10 }}>✓</span>
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
