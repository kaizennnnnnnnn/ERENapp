'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  type Reminder,
  getReminders, createReminder, updateReminder, deleteReminder,
  scheduleAll, nextFireAt,
} from '@/lib/reminders'
import { playSound } from '@/lib/sounds'

interface Props { onClose: () => void }

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function formatNext(r: Reminder): string {
  const ts = nextFireAt(r)
  if (!ts) return 'expired'
  const d = new Date(ts)
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const isToday    = d.toDateString() === new Date().toDateString()
  const isTomorrow = d.toDateString() === new Date(Date.now() + 86400000).toDateString()
  if (isToday) return `today ${timeStr}`
  if (isTomorrow) return `tomorrow ${timeStr}`
  return `${DAY_LABELS[d.getDay()]} ${timeStr}`
}

export default function ReminderSheet({ onClose }: Props) {
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [reminders, setReminders]   = useState<Reminder[]>([])
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [showForm, setShowForm]     = useState(false)
  const [mounted, setMounted]       = useState(false)

  // Form state
  const [text,      setText]      = useState('')
  const [type,      setType]      = useState<'daily' | 'weekly' | 'once'>('daily')
  const [time,      setTime]      = useState('08:00')
  const [weekDays,  setWeekDays]  = useState<number[]>([1])
  const [date,      setDate]      = useState(() => new Date().toISOString().slice(0, 10))
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    setMounted(true)
    if ('Notification' in window) setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (!profile?.household_id) return
    getReminders(supabase, profile.household_id).then(list => {
      setReminders(list)
      scheduleAll(list)
    })
  }, [profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function requestPermission() {
    const r = await Notification.requestPermission()
    setPermission(r)
  }

  async function handleToggle(id: string) {
    const r = reminders.find(x => x.id === id)
    if (!r) return
    const next = !r.active
    await updateReminder(supabase, id, { active: next })
    const updated = reminders.map(x => x.id === id ? { ...x, active: next } : x)
    setReminders(updated)
    scheduleAll(updated)
  }

  async function handleDelete(id: string) {
    await deleteReminder(supabase, id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  async function handleSave() {
    if (!text.trim() || !user?.id || !profile?.household_id) return
    const created = await createReminder(supabase, {
      household_id: profile.household_id,
      created_by:   user.id,
      text:         text.trim(),
      type,
      time,
      week_days:    type === 'weekly' ? weekDays : [],
      date:         type === 'once'   ? date     : null,
      active:       true,
      is_private:   isPrivate,
    })
    if (!created) return
    const updated = [...reminders, created]
    setReminders(updated)
    scheduleAll(updated)
    setText(''); setType('daily'); setTime('08:00'); setWeekDays([1]); setIsPrivate(false)
    setShowForm(false)
  }

  function toggleDay(d: number) {
    setWeekDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const typeLabel = { daily: 'Every day', weekly: 'Weekly', once: 'One time' }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(20,5,40,0.5)' }} onClick={() => { playSound('ui_modal_close'); onClose() }} />

      <div className="relative max-w-md w-full mx-auto flex flex-col overflow-hidden"
        style={{ background: '#FDFAFF', borderRadius: '20px 20px 0 0', border: '2px solid #D8C8F8', borderBottom: 'none', maxHeight: '88vh', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#D8C8F8' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2px solid #EDE8FF' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>🔔</span>
            <span className="font-pixel text-purple-700" style={{ fontSize: 9 }}>REMINDERS</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { playSound('ui_tap'); setShowForm(f => !f) }}
              className="flex items-center gap-1 px-3 h-8 active:scale-95 transition-transform"
              style={{ background: showForm ? '#EDE8FF' : 'linear-gradient(135deg, #A78BFA, #7C3AED)', borderRadius: 6, border: '2px solid #C8B0F0' }}>
              <span className="font-pixel" style={{ fontSize: 7, color: showForm ? '#6030B0' : 'white' }}>{showForm ? 'CANCEL' : '+ ADD'}</span>
            </button>
            <button onClick={() => { playSound('ui_modal_close'); onClose() }} className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
              style={{ borderRadius: 6, border: '2px solid #E0D0F8', background: 'white' }}>
              <span className="font-pixel text-purple-400" style={{ fontSize: 9 }}>✕</span>
            </button>
          </div>
        </div>

        {/* Notification permission */}
        {permission !== 'granted' && (
          <div className="mx-4 mt-3 px-4 py-3 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, #FFF8D0, #FFF0A0)', borderRadius: 8, border: '2px solid #F5C842' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div className="flex-1">
              <p className="font-pixel text-amber-700" style={{ fontSize: 7 }}>Notifications off</p>
              <p className="text-[9px] text-amber-600 mt-0.5">Enable to receive reminders</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); requestPermission() }}
              className="px-3 h-7 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #F5C842, #E8A020)', borderRadius: 5, border: '2px solid #C8A020' }}>
              <span className="font-pixel text-white" style={{ fontSize: 6 }}>ENABLE</span>
            </button>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="mx-4 mt-3 p-4 flex flex-col gap-3"
            style={{ background: 'white', borderRadius: 12, border: '2px solid #EDE8FF', boxShadow: '3px 3px 0 #EDE8FF' }}>

            <div>
              <p className="font-pixel text-purple-500 mb-1.5" style={{ fontSize: 6 }}>WHAT'S THIS REMINDER?</p>
              <input value={text} onChange={e => setText(e.target.value)}
                placeholder="e.g. Feed Eren, give medicine…"
                className="w-full px-3 py-2.5 text-sm outline-none"
                style={{ borderRadius: 8, border: '2px solid #EDE8FF', background: '#FDFAFF', fontFamily: 'inherit' }} />
            </div>

            <div>
              <p className="font-pixel text-purple-500 mb-1.5" style={{ fontSize: 6 }}>REPEAT</p>
              <div className="flex gap-2">
                {(['daily', 'weekly', 'once'] as const).map(t => (
                  <button key={t} onClick={() => { playSound('ui_tap'); setType(t) }}
                    className="flex-1 py-2 font-pixel active:scale-95 transition-transform"
                    style={{ fontSize: 6, borderRadius: 6, border: `2px solid ${type === t ? '#A78BFA' : '#EDE8FF'}`, background: type === t ? 'linear-gradient(135deg, #F0E8FF, #E0D0FF)' : 'white', color: type === t ? '#6030B0' : '#A0A0C0' }}>
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-pixel text-purple-500 mb-1.5" style={{ fontSize: 6 }}>TIME</p>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="px-3 py-2 text-sm outline-none"
                style={{ borderRadius: 8, border: '2px solid #EDE8FF', background: '#FDFAFF', fontFamily: 'inherit' }} />
            </div>

            {type === 'weekly' && (
              <div>
                <p className="font-pixel text-purple-500 mb-1.5" style={{ fontSize: 6 }}>DAYS</p>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button key={i} onClick={() => { playSound('ui_tap'); toggleDay(i) }}
                      className="flex-1 py-2 font-pixel active:scale-95 transition-transform"
                      style={{ fontSize: 6, borderRadius: 6, border: `2px solid ${weekDays.includes(i) ? '#A78BFA' : '#EDE8FF'}`, background: weekDays.includes(i) ? 'linear-gradient(135deg, #A78BFA, #7C3AED)' : 'white', color: weekDays.includes(i) ? 'white' : '#A0A0C0' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type === 'once' && (
              <div>
                <p className="font-pixel text-purple-500 mb-1.5" style={{ fontSize: 6 }}>DATE</p>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="px-3 py-2 text-sm outline-none"
                  style={{ borderRadius: 8, border: '2px solid #EDE8FF', background: '#FDFAFF', fontFamily: 'inherit' }} />
              </div>
            )}

            {/* Private toggle */}
            <div className="flex items-center gap-3">
              <button onClick={() => { playSound('ui_tap'); setIsPrivate(p => !p) }}
                className="w-10 h-6 relative active:scale-95 transition-transform flex-shrink-0"
                style={{ borderRadius: 12, background: isPrivate ? 'linear-gradient(90deg, #A78BFA, #7C3AED)' : '#E0D8F0', border: '2px solid #C8B0F0' }}>
                <div className="absolute top-0.5 h-4 w-4"
                  style={{ borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', left: isPrivate ? 'calc(100% - 18px)' : 2, transition: 'left 0.2s' }} />
              </button>
              <div>
                <p className="font-pixel text-purple-600" style={{ fontSize: 6 }}>🔒 PRIVATE</p>
                <p className="text-[9px] text-gray-400">{isPrivate ? 'Only you can see this' : 'Visible to both of you'}</p>
              </div>
            </div>

            <button onClick={() => { playSound('ui_tap'); handleSave() }}
              className="w-full py-3 font-pixel active:scale-[0.98] transition-transform"
              style={{ borderRadius: 8, background: text.trim() ? 'linear-gradient(135deg, #A78BFA, #7C3AED)' : '#E0D8F0', color: text.trim() ? 'white' : '#C0B8D8', border: '2px solid #C8B0F0', boxShadow: text.trim() ? '3px 3px 0 #9060D0' : 'none', fontSize: 8 }}>
              SAVE REMINDER
            </button>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 pt-3 pb-4 flex flex-col gap-2.5">
          {reminders.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span style={{ fontSize: 40 }}>🔔</span>
              <p className="font-pixel text-gray-400 text-center" style={{ fontSize: 7 }}>No reminders yet</p>
              <p className="text-[10px] text-gray-300 text-center">Tap + ADD to create one</p>
            </div>
          )}

          {reminders.map(r => {
            const isOwn = r.created_by === user?.id
            return (
              <div key={r.id} className="flex items-center gap-3 px-3 py-3"
                style={{ borderRadius: 10, background: r.active ? 'white' : 'rgba(240,235,255,0.4)', border: `2px solid ${r.active ? '#EDE8FF' : '#E0D8F0'}`, boxShadow: r.active ? '2px 2px 0 #EDE8FF' : 'none', opacity: r.active ? 1 : 0.6 }}>

                {/* Type icon */}
                <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center"
                  style={{ borderRadius: 8, background: r.type === 'daily' ? 'linear-gradient(135deg, #FFF8D0, #FFF0A0)' : r.type === 'weekly' ? 'linear-gradient(135deg, #F0E8FF, #E8D8FF)' : 'linear-gradient(135deg, #D0F0FF, #C0E8FF)', border: '2px solid #EDE8FF' }}>
                  <span style={{ fontSize: 16 }}>{r.type === 'daily' ? '⚡' : r.type === 'weekly' ? '📅' : '🗓️'}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-gray-700 leading-tight truncate">{r.text}</p>
                    {r.is_private && <span className="flex-shrink-0 text-[10px]">🔒</span>}
                    {!isOwn && <span className="flex-shrink-0 font-pixel text-purple-300" style={{ fontSize: 5 }}>SHARED</span>}
                  </div>
                  <p className="font-pixel text-purple-400 mt-0.5" style={{ fontSize: 6 }}>
                    {r.type === 'weekly' && r.week_days?.length
                      ? `${r.week_days.map(d => DAY_LABELS[d]).join(' ')} · ${r.time}`
                      : r.type === 'once' && r.date ? `${r.date} · ${r.time}` : r.time}
                  </p>
                  {r.active && <p className="text-[9px] text-gray-400 mt-0.5">Next: {formatNext(r)}</p>}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle — only own reminders */}
                  {isOwn && (
                    <button onClick={() => { playSound('ui_tap'); handleToggle(r.id) }}
                      className="w-10 h-6 relative active:scale-95 transition-transform"
                      style={{ borderRadius: 12, background: r.active ? 'linear-gradient(90deg, #A78BFA, #7C3AED)' : '#E0D8F0', border: '2px solid #C8B0F0' }}>
                      <div className="absolute top-0.5 h-4 w-4"
                        style={{ borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', left: r.active ? 'calc(100% - 18px)' : 2, transition: 'left 0.2s' }} />
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => { playSound('ui_tap'); handleDelete(r.id) }}
                      className="w-7 h-7 flex items-center justify-center active:scale-90 transition-transform"
                      style={{ borderRadius: 6, border: '2px solid #FFC0C0', background: '#FFF0F0' }}>
                      <span style={{ fontSize: 12 }}>🗑</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <div style={{ height: 12 }} />
        </div>
      </div>
    </div>,
    document.body
  )
}
