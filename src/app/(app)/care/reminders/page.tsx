'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Reminder, ReminderType, RepeatInterval } from '@/types'
import { formatRelativeTime, cn } from '@/lib/utils'
import {
  ChevronLeft, Plus, X, Check, Bell, Trash2,
  Syringe, Scissors, Gamepad2, UtensilsCrossed, Stethoscope
} from 'lucide-react'

const TYPE_CONFIG: Record<ReminderType, { label: string; emoji: string; color: string }> = {
  feed:     { label: 'Feed Eren',      emoji: '🍗', color: 'bg-amber-100 text-amber-700'  },
  litter:   { label: 'Clean Litter',   emoji: '🪣', color: 'bg-sky-100 text-sky-700'      },
  medicine: { label: 'Medicine',       emoji: '💊', color: 'bg-green-100 text-green-700'  },
  vet:      { label: 'Vet Visit',      emoji: '🏥', color: 'bg-red-100 text-red-700'      },
  groom:    { label: 'Grooming',       emoji: '✨', color: 'bg-purple-100 text-purple-700'},
  play:     { label: 'Playtime',       emoji: '🧶', color: 'bg-pink-100 text-pink-700'    },
  custom:   { label: 'Custom',         emoji: '📌', color: 'bg-gray-100 text-gray-700'    },
}

const REPEAT_OPTIONS: { value: RepeatInterval; label: string }[] = [
  { value: 'once',    label: 'Once' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function RemindersPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [reminders, setReminders]     = useState<Reminder[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)

  // New reminder form state
  const [title, setTitle]           = useState('')
  const [rType, setRType]           = useState<ReminderType>('feed')
  const [repeat, setRepeat]         = useState<RepeatInterval>('daily')
  const [nextDue, setNextDue]       = useState('')
  const [description, setDescription] = useState('')

  async function load() {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('reminders')
      .select(`
        *,
        last_log:reminder_logs(completed_at)
      `)
      .eq('household_id', profile.household_id)
      .eq('is_active', true)
      .order('next_due', { ascending: true, nullsFirst: false })
    if (data) {
      // Attach last_completed
      const enriched = data.map(r => ({
        ...r,
        last_completed: (r.last_log as { completed_at: string }[] | null)?.[0]?.completed_at ?? null,
      }))
      setReminders(enriched)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setTitle('')
    setRType('feed')
    setRepeat('daily')
    setNextDue('')
    setDescription('')
  }

  async function handleSave() {
    if (!profile?.household_id || !user?.id || !title.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('reminders')
      .insert({
        household_id: profile.household_id,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        reminder_type: rType,
        repeat_interval: repeat,
        next_due: nextDue ? new Date(nextDue).toISOString() : null,
        is_active: true,
      })
      .select()
      .single()
    if (data) setReminders(prev => [{ ...data, last_completed: null }, ...prev])
    setSaving(false)
    setShowAdd(false)
    resetForm()
  }

  async function handleComplete(reminder: Reminder) {
    if (!user?.id) return
    setCompletingId(reminder.id)

    // Log completion
    await supabase.from('reminder_logs').insert({
      reminder_id: reminder.id,
      user_id: user.id,
      completed_at: new Date().toISOString(),
    })

    // Advance next_due based on repeat interval
    let newDue: string | null = null
    if (reminder.repeat_interval && reminder.repeat_interval !== 'once' && reminder.next_due) {
      const d = new Date(reminder.next_due)
      if (reminder.repeat_interval === 'daily')   d.setDate(d.getDate() + 1)
      if (reminder.repeat_interval === 'weekly')  d.setDate(d.getDate() + 7)
      if (reminder.repeat_interval === 'monthly') d.setMonth(d.getMonth() + 1)
      newDue = d.toISOString()
    }

    // Deactivate one-time reminders
    if (reminder.repeat_interval === 'once') {
      await supabase.from('reminders').update({ is_active: false }).eq('id', reminder.id)
      setReminders(prev => prev.filter(r => r.id !== reminder.id))
    } else if (newDue) {
      await supabase.from('reminders').update({ next_due: newDue }).eq('id', reminder.id)
      setReminders(prev => prev.map(r =>
        r.id === reminder.id ? { ...r, next_due: newDue, last_completed: new Date().toISOString() } : r
      ))
    }

    setCompletingId(null)
  }

  async function handleDelete(id: string) {
    await supabase.from('reminders').update({ is_active: false }).eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  function isOverdue(r: Reminder) {
    if (!r.next_due) return false
    return new Date(r.next_due) < new Date()
  }

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="btn-ghost p-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-[#1F1F2E]">Reminders</h1>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd(true)}
          className="w-10 h-10 rounded-2xl bg-[#FF6B9D] flex items-center justify-center shadow-pink active:scale-90 transition-all"
        >
          <Plus size={22} className="text-white" />
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5 pl-14">Keep Eren on schedule 📅</p>

      {/* ── Add modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-gray-800">New reminder</h2>
              <button onClick={() => { setShowAdd(false); resetForm() }} className="text-gray-400">
                <X size={22} />
              </button>
            </div>

            {/* Type picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(TYPE_CONFIG) as [ReminderType, typeof TYPE_CONFIG[ReminderType]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRType(key)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                      rType === key ? 'border-[#FF6B9D] bg-pink-50' : 'border-transparent bg-gray-50'
                    )}
                  >
                    <span className="text-xl">{cfg.emoji}</span>
                    <span className="text-[9px] font-medium text-gray-600 text-center leading-tight">
                      {cfg.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                className="input"
                placeholder={`e.g. ${TYPE_CONFIG[rType].label}`}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                className="input"
                placeholder="Any extra details…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Repeat */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Repeat</label>
              <div className="flex gap-2 flex-wrap">
                {REPEAT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRepeat(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all',
                      repeat === opt.value
                        ? 'border-[#FF6B9D] bg-pink-50 text-[#FF6B9D]'
                        : 'border-gray-200 text-gray-500'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Next due */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Next due (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={nextDue}
                onChange={e => setNextDue(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdd(false); resetForm() }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="btn-primary flex-1"
              >
                {saving ? 'Saving…' : 'Add reminder 🔔'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && reminders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Bell size={48} className="text-gray-200" />
          <p className="text-gray-400 font-medium">No reminders yet</p>
          <p className="text-sm text-gray-300 text-center px-8">
            Add reminders for feeding, cleaning the litter box, or vet visits
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-2 px-6">
            Add reminder 🔔
          </button>
        </div>
      )}

      {/* ── Overdue section ── */}
      {reminders.some(isOverdue) && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-red-500 mb-2 flex items-center gap-1">
            🚨 Overdue
          </h2>
          <div className="flex flex-col gap-2">
            {reminders.filter(isOverdue).map(r => (
              <ReminderCard
                key={r.id}
                reminder={r}
                overdue
                completing={completingId === r.id}
                onComplete={() => handleComplete(r)}
                onDelete={() => handleDelete(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming section ── */}
      {reminders.some(r => !isOverdue(r)) && (
        <div>
          <h2 className="text-sm font-bold text-gray-600 mb-2">Upcoming</h2>
          <div className="flex flex-col gap-2">
            {reminders.filter(r => !isOverdue(r)).map(r => (
              <ReminderCard
                key={r.id}
                reminder={r}
                overdue={false}
                completing={completingId === r.id}
                onComplete={() => handleComplete(r)}
                onDelete={() => handleDelete(r.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────
function ReminderCard({
  reminder, overdue, completing, onComplete, onDelete,
}: {
  reminder: Reminder
  overdue: boolean
  completing: boolean
  onComplete: () => void
  onDelete: () => void
}) {
  const cfg = TYPE_CONFIG[reminder.reminder_type]

  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-card p-4 flex items-center gap-3',
      overdue && 'ring-2 ring-red-200',
      completing && 'opacity-60'
    )}>
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0', cfg.color)}>
        {cfg.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm">{reminder.title}</p>
        {reminder.description && (
          <p className="text-xs text-gray-400 truncate">{reminder.description}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {reminder.next_due && (
            <p className={cn(
              'text-xs font-medium',
              overdue ? 'text-red-500' : 'text-gray-400'
            )}>
              {overdue ? '⚠️ ' : ''}{formatRelativeTime(reminder.next_due)}
            </p>
          )}
          {reminder.repeat_interval && reminder.repeat_interval !== 'once' && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full capitalize">
              {reminder.repeat_interval}
            </span>
          )}
        </div>
        {reminder.last_completed && (
          <p className="text-[10px] text-gray-300 mt-0.5">
            Last done {formatRelativeTime(reminder.last_completed)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={onComplete}
          disabled={completing}
          className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center active:scale-90 transition-all"
        >
          <Check size={18} className="text-green-600" />
        </button>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center active:scale-90 transition-all"
        >
          <Trash2 size={15} className="text-red-400" />
        </button>
      </div>
    </div>
  )
}
