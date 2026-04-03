import type { SupabaseClient } from '@supabase/supabase-js'

export interface Reminder {
  id: string
  household_id: string
  created_by: string
  text: string
  type: 'daily' | 'weekly' | 'once'
  time: string        // "HH:MM"
  week_days: number[] // 0=Sun … 6=Sat
  date: string | null
  active: boolean
  is_private: boolean
  created_at: string
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getReminders(
  supabase: SupabaseClient,
  householdId: string,
): Promise<Reminder[]> {
  const { data } = await supabase
    .from('household_reminders')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
  return (data ?? []) as Reminder[]
}

export async function createReminder(
  supabase: SupabaseClient,
  reminder: Omit<Reminder, 'id' | 'created_at'>,
): Promise<Reminder | null> {
  const { data, error } = await supabase
    .from('household_reminders')
    .insert(reminder)
    .select()
    .single()
  if (error) return null
  return data as Reminder
}

export async function updateReminder(
  supabase: SupabaseClient,
  id: string,
  changes: Partial<Pick<Reminder, 'active' | 'is_private' | 'text' | 'time' | 'week_days' | 'date'>>,
): Promise<void> {
  await supabase.from('household_reminders').update(changes).eq('id', id)
}

export async function deleteReminder(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('household_reminders').delete().eq('id', id)
}

// ── Scheduling (Service Worker) ───────────────────────────────────────────────

async function getSW(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null
  try { return (await navigator.serviceWorker.ready).active } catch { return null }
}

export function nextFireAt(r: Reminder): number | null {
  const now = Date.now()
  const [h, m] = r.time.split(':').map(Number)

  if (r.type === 'daily') {
    const d = new Date(); d.setSeconds(0, 0); d.setHours(h, m)
    if (d.getTime() <= now) d.setDate(d.getDate() + 1)
    return d.getTime()
  }

  if (r.type === 'weekly') {
    if (!r.week_days?.length) return null
    let best = Infinity
    r.week_days.forEach(wd => {
      const d = new Date(); d.setSeconds(0, 0)
      const diff = (wd - d.getDay() + 7) % 7
      d.setDate(d.getDate() + diff); d.setHours(h, m)
      if (d.getTime() <= now) d.setDate(d.getDate() + 7)
      if (d.getTime() < best) best = d.getTime()
    })
    return best === Infinity ? null : best
  }

  if (r.type === 'once' && r.date) {
    const d = new Date(`${r.date}T${r.time}:00`)
    return d.getTime() > now ? d.getTime() : null
  }
  return null
}

export async function scheduleAll(reminders: Reminder[]): Promise<void> {
  const sw = await getSW()
  if (!sw) return
  reminders.forEach(r => {
    if (!r.active) { sw.postMessage({ type: 'CANCEL', id: r.id }); return }
    const fireAt = nextFireAt(r)
    if (!fireAt) return
    sw.postMessage({ type: 'SCHEDULE', id: r.id, text: r.text, fireAt })
  })
}

export async function registerSW(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try { await navigator.serviceWorker.register('/sw.js') } catch (e) { console.warn('SW:', e) }
}
