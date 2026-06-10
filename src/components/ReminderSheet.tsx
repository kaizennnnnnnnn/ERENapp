'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  type Reminder, type ReminderFire,
  getReminders, createReminder, updateReminder, deleteReminder,
  scheduleAll, nextFireAt,
  getRecentFires, dismissFire, pingFireReminders,
} from '@/lib/reminders'
import { playSound } from '@/lib/sounds'
import { IconBell, IconClock, IconStar } from './PixelIcons'
import { PINK, PINK_HI, PINK_LO, OBSIDIAN_FACE, OBSIDIAN_BTN, accentA } from './obsidian'

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

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr}h ago`
  const dys = Math.floor(hr / 24)
  return `${dys}d ago`
}

export default function ReminderSheet({ onClose }: Props) {
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [reminders, setReminders]   = useState<Reminder[]>([])
  const [loading, setLoading]       = useState(true)
  const [fires, setFires]           = useState<ReminderFire[]>([])
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
    // Ping the server scheduler so anything queued in the current minute
    // surfaces immediately when the sheet opens — useful if the phone
    // just came back online.
    pingFireReminders()
  }, [])

  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    getReminders(supabase, profile.household_id).then(list => {
      // null = load failed (Supabase outage). Stay in the loading state —
      // a false "NO REMINDERS YET" invites duplicate re-creation.
      if (!list) return
      setReminders(list)
      scheduleAll(list)
      setLoading(false)
    })
    getRecentFires(supabase, profile.household_id, user.id).then(setFires)
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleDismissFire(fireId: string) {
    if (!user?.id) return
    setFires(prev => prev.filter(f => f.id !== fireId))
    await dismissFire(supabase, fireId, user.id)
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

  const typeLabel = { daily: 'DAILY', weekly: 'WEEKLY', once: 'ONE-TIME' }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={() => { playSound('ui_modal_close'); onClose() }} />

      <div className="relative max-w-md w-full mx-auto flex flex-col overflow-hidden"
        style={{
          ...OBSIDIAN_FACE,
          borderRadius: '6px 6px 0 0',
          borderBottom: 'none',
          maxHeight: '88vh',
          animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 40, height: 3, background: PINK, boxShadow: `0 0 4px ${accentA(0.5)}` }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${accentA(0.25)}` }}>
          <div className="flex items-center gap-2">
            <div style={{ filter: `drop-shadow(0 0 4px ${accentA(0.5)})` }}>
              <IconBell size={16} />
            </div>
            <span className="font-pixel" style={{
              fontSize: 9, color: PINK_HI, letterSpacing: 2,
              textShadow: `0 0 4px ${accentA(0.4)}`,
            }}>REMINDERS</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { playSound('ui_tap'); setShowForm(f => !f) }}
              className="flex items-center gap-1 px-3 h-7 active:translate-y-[1px] transition-transform"
              style={{
                ...OBSIDIAN_BTN,
                background: showForm
                  ? 'linear-gradient(180deg, #1a1a1f 0%, #050507 100%)'
                  : `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK_LO} 100%)`,
                fontFamily: '"Press Start 2P"', fontSize: 7,
                color: showForm ? PINK_HI : '#1a0610',
                textShadow: showForm ? `0 0 3px ${accentA(0.4)}` : 'none',
              }}>
              {showForm ? 'CANCEL' : '+ ADD'}
            </button>
            <button onClick={() => { playSound('ui_modal_close'); onClose() }}
              className="w-7 h-7 flex items-center justify-center active:translate-y-[1px] transition-transform"
              style={{
                ...OBSIDIAN_BTN,
                color: PINK_HI, fontFamily: '"Press Start 2P"', fontSize: 8,
              }}>
              ✕
            </button>
          </div>
        </div>

        {/* Notification permission banner */}
        {permission !== 'granted' && (
          <div className="mx-3 mt-3 px-3 py-2.5 flex items-center gap-3"
            style={{
              background: 'linear-gradient(180deg, #2a1a05 0%, #1a1005 100%)',
              border: '1px solid #F5C842',
              boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
            }}>
            <div style={{ filter: 'drop-shadow(0 0 4px rgba(245,200,66,0.6))' }}>
              <IconBell size={14} />
            </div>
            <div className="flex-1">
              <p className="font-pixel" style={{ fontSize: 7, color: '#F5C842' }}>NOTIFICATIONS OFF</p>
              <p className="text-[9px]" style={{ color: '#C8A050' }}>Enable to receive reminders</p>
            </div>
            <button onClick={() => { playSound('ui_tap'); requestPermission() }}
              className="px-3 h-6 active:translate-y-[1px] transition-transform"
              style={{
                background: 'linear-gradient(180deg, #F5C842 0%, #B88820 100%)',
                border: '1px solid #806010',
                boxShadow: '0 2px 0 #604008',
                fontFamily: '"Press Start 2P"', fontSize: 6, color: '#3a2a08',
              }}>
              ENABLE
            </button>
          </div>
        )}

        {/* Missed-reminders section. Only shows when there are
            undismissed fires logged in the last 48h, so the user can
            catch up after the phone was off. */}
        {fires.length > 0 && (
          <div className="mx-3 mt-3 px-3 py-3"
            style={{
              ...OBSIDIAN_FACE,
              border: `1px solid ${PINK}88`,
              boxShadow: `3px 3px 0 ${accentA(0.4)}, inset 0 0 0 1px rgba(255,255,255,0.04)`,
            }}>
            <div className="flex items-center gap-2 mb-2">
              <IconStar size={12} />
              <p className="font-pixel" style={{
                fontSize: 7, letterSpacing: 1.5, color: PINK_HI,
                textShadow: `0 0 4px ${accentA(0.4)}`,
              }}>MISSED · {fires.length}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {fires.slice(0, 6).map(f => (
                <div key={f.id} className="flex items-center gap-2 px-2 py-1.5"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px]" style={{ color: '#E0DAEF' }}>{f.text}</p>
                    <p className="font-pixel mt-0.5" style={{ fontSize: 5.5, color: PINK_LO }}>
                      {formatAgo(f.fired_at).toUpperCase()}
                    </p>
                  </div>
                  <button onClick={() => { playSound('ui_tap'); handleDismissFire(f.id) }}
                    className="px-2 py-1 active:translate-y-[1px] transition-transform"
                    style={{
                      background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
                      border: `1px solid ${accentA(0.4)}`,
                      fontFamily: '"Press Start 2P"', fontSize: 5.5, color: PINK_HI,
                    }}>
                    SEEN
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="mx-3 mt-3 p-3 flex flex-col gap-3"
            style={{
              ...OBSIDIAN_FACE,
              boxShadow: `3px 3px 0 rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)`,
            }}>

            <div>
              <p className="font-pixel mb-1.5" style={{ fontSize: 6, color: PINK_LO, letterSpacing: 1.5 }}>WHAT?</p>
              <input value={text} onChange={e => setText(e.target.value)}
                placeholder="e.g. Feed Eren, give medicine…"
                className="w-full px-3 py-2 text-sm outline-none"
                style={{
                  background: '#050507',
                  border: `1px solid ${accentA(0.33)}`,
                  color: '#E8DCEF',
                  fontFamily: 'inherit',
                }} />
            </div>

            <div>
              <p className="font-pixel mb-1.5" style={{ fontSize: 6, color: PINK_LO, letterSpacing: 1.5 }}>REPEAT</p>
              <div className="flex gap-2">
                {(['daily', 'weekly', 'once'] as const).map(t => (
                  <button key={t} onClick={() => { playSound('ui_tap'); setType(t) }}
                    className="flex-1 py-2 active:translate-y-[1px] transition-transform"
                    style={{
                      fontFamily: '"Press Start 2P"', fontSize: 6,
                      background: type === t
                        ? `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK_LO} 100%)`
                        : 'linear-gradient(180deg, #131317 0%, #050507 100%)',
                      border: `1px solid ${accentA(type === t ? 0.6 : 0.3)}`,
                      color: type === t ? '#1a0610' : PINK_HI,
                    }}>
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-pixel mb-1.5" style={{ fontSize: 6, color: PINK_LO, letterSpacing: 1.5 }}>TIME</p>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="px-3 py-2 text-sm outline-none"
                style={{
                  background: '#050507',
                  border: `1px solid ${accentA(0.33)}`,
                  color: '#E8DCEF',
                  colorScheme: 'dark',
                  fontFamily: 'inherit',
                }} />
            </div>

            {type === 'weekly' && (
              <div>
                <p className="font-pixel mb-1.5" style={{ fontSize: 6, color: PINK_LO, letterSpacing: 1.5 }}>DAYS</p>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button key={i} onClick={() => { playSound('ui_tap'); toggleDay(i) }}
                      className="flex-1 py-2 active:translate-y-[1px] transition-transform"
                      style={{
                        fontFamily: '"Press Start 2P"', fontSize: 6,
                        background: weekDays.includes(i)
                          ? `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK_LO} 100%)`
                          : 'linear-gradient(180deg, #131317 0%, #050507 100%)',
                        border: `1px solid ${accentA(weekDays.includes(i) ? 0.6 : 0.3)}`,
                        color: weekDays.includes(i) ? '#1a0610' : PINK_HI,
                      }}>
                      {d.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type === 'once' && (
              <div>
                <p className="font-pixel mb-1.5" style={{ fontSize: 6, color: PINK_LO, letterSpacing: 1.5 }}>DATE</p>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="px-3 py-2 text-sm outline-none"
                  style={{
                    background: '#050507',
                    border: `1px solid ${accentA(0.33)}`,
                    color: '#E8DCEF',
                    colorScheme: 'dark',
                    fontFamily: 'inherit',
                  }} />
              </div>
            )}

            {/* Private toggle */}
            <div className="flex items-center gap-3">
              <button onClick={() => { playSound('ui_tap'); setIsPrivate(p => !p) }}
                className="w-10 h-5 relative active:translate-y-[1px] transition-transform flex-shrink-0"
                style={{
                  background: isPrivate
                    ? `linear-gradient(90deg, ${PINK_HI}, ${PINK})`
                    : '#1a1a20',
                  border: `1px solid ${accentA(0.4)}`,
                }}>
                <div className="absolute top-0 h-4 w-4"
                  style={{
                    background: isPrivate ? '#1a0610' : PINK,
                    boxShadow: isPrivate ? 'none' : `0 0 4px ${accentA(0.6)}`,
                    left: isPrivate ? 'calc(100% - 16px)' : 0,
                    transition: 'left 0.18s',
                  }} />
              </button>
              <div>
                <p className="font-pixel" style={{ fontSize: 6, color: PINK_HI, letterSpacing: 1.5 }}>PRIVATE</p>
                <p className="text-[9px]" style={{ color: '#8a7a98' }}>{isPrivate ? 'Only you' : 'Both partners'}</p>
              </div>
            </div>

            <button onClick={() => { playSound('ui_tap'); handleSave() }}
              className="w-full py-2.5 active:translate-y-[1px] transition-transform"
              style={{
                background: text.trim()
                  ? `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK_LO} 100%)`
                  : '#1a1a20',
                border: `1px solid ${accentA(text.trim() ? 0.6 : 0.3)}`,
                boxShadow: text.trim() ? `0 3px 0 ${PINK_LO}, 0 0 8px ${accentA(0.5)}` : 'none',
                fontFamily: '"Press Start 2P"', fontSize: 8,
                color: text.trim() ? '#1a0610' : '#5a4a68',
              }}>
              SAVE REMINDER
            </button>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-3 pt-3 pb-4 flex flex-col gap-2">
          {loading && reminders.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="font-pixel" style={{ fontSize: 7, color: PINK_LO, letterSpacing: 1.5 }}>LOADING</p>
            </div>
          )}

          {!loading && reminders.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div style={{ filter: `drop-shadow(0 0 6px ${accentA(0.35)})`, opacity: 0.4 }}>
                <IconBell size={40} />
              </div>
              <p className="font-pixel" style={{ fontSize: 7, color: PINK_LO, letterSpacing: 1.5 }}>NO REMINDERS YET</p>
              <p className="text-[10px]" style={{ color: '#6a5a78' }}>Tap + ADD to create one</p>
            </div>
          )}

          {reminders.map(r => {
            const isOwn = r.created_by === user?.id
            return (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5"
                style={{
                  ...OBSIDIAN_FACE,
                  opacity: r.active ? 1 : 0.55,
                  boxShadow: r.active
                    ? `2px 2px 0 ${accentA(0.3)}, inset 0 0 0 1px rgba(255,255,255,0.04)`
                    : 'none',
                }}>

                {/* Type pill — pixel clock icon in an accent square */}
                <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center"
                  style={{
                    background: r.type === 'daily'
                      ? `linear-gradient(180deg, ${PINK_HI}33, ${PINK_LO}33)`
                      : r.type === 'weekly'
                        ? 'linear-gradient(180deg, #A78BFA33, #7C3AED33)'
                        : 'linear-gradient(180deg, #6BAED633, #3D7BA833)',
                    border: `1px solid ${accentA(0.4)}`,
                  }}>
                  <IconClock size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] truncate" style={{ color: '#EBE0F4' }}>{r.text}</p>
                    {r.is_private && (
                      <span className="flex-shrink-0 font-pixel" style={{ fontSize: 5, color: PINK_LO }}>PRIV</span>
                    )}
                    {!isOwn && (
                      <span className="flex-shrink-0 font-pixel" style={{ fontSize: 5, color: '#6a5a78' }}>SHARED</span>
                    )}
                  </div>
                  <p className="font-pixel mt-0.5" style={{ fontSize: 6, color: PINK_LO, letterSpacing: 1 }}>
                    {r.type === 'weekly' && r.week_days?.length
                      ? `${r.week_days.map(d => DAY_LABELS[d].toUpperCase()).join(' ')} · ${r.time}`
                      : r.type === 'once' && r.date ? `${r.date} · ${r.time}` : r.time}
                  </p>
                  {r.active && (
                    <p className="text-[9px] mt-0.5" style={{ color: '#7a6a88' }}>
                      Next: {formatNext(r)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isOwn && (
                    <button onClick={() => { playSound('ui_tap'); handleToggle(r.id) }}
                      className="w-9 h-5 relative active:translate-y-[1px] transition-transform"
                      style={{
                        background: r.active
                          ? `linear-gradient(90deg, ${PINK_HI}, ${PINK})`
                          : '#1a1a20',
                        border: `1px solid ${accentA(0.4)}`,
                      }}>
                      <div className="absolute top-0 h-4 w-4"
                        style={{
                          background: r.active ? '#1a0610' : PINK,
                          left: r.active ? 'calc(100% - 16px)' : 0,
                          transition: 'left 0.18s',
                        }} />
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => { playSound('ui_tap'); handleDelete(r.id) }}
                      className="w-7 h-7 flex items-center justify-center active:translate-y-[1px] transition-transform"
                      style={{
                        background: 'linear-gradient(180deg, #2a0a0a 0%, #1a0505 100%)',
                        border: '1px solid #8B2020',
                        fontFamily: '"Press Start 2P"', fontSize: 7, color: '#ff8c8c',
                      }}>
                      ✕
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
