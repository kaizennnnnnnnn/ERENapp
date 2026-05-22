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

// One row of reminder_fires — a logged firing event the user may have
// missed if their phone was off. The client merges these into the
// ReminderSheet so nothing gets silently lost.
export interface ReminderFire {
  id: string
  reminder_id: string
  household_id: string
  user_id: string | null
  text: string
  fired_at: string
  dismissed_by: string[]
}

export async function getRecentFires(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<ReminderFire[]> {
  // Last 48 h is the window we surface as "missed" — anything older
  // is clutter, the user will have already seen it on next login.
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from('reminder_fires')
    .select('*')
    .eq('household_id', householdId)
    .gte('fired_at', cutoff)
    .order('fired_at', { ascending: false })
    .limit(40)
  if (!data) return []
  // Filter out private fires that aren't ours, and anything we've
  // already dismissed.
  return (data as ReminderFire[]).filter(f =>
    (f.user_id === null || f.user_id === userId) &&
    !(f.dismissed_by ?? []).includes(userId)
  )
}

export async function dismissFire(
  supabase: SupabaseClient,
  fireId: string,
  userId: string,
): Promise<void> {
  const { data: cur } = await supabase
    .from('reminder_fires')
    .select('dismissed_by')
    .eq('id', fireId)
    .single()
  if (!cur) return
  const arr = (cur.dismissed_by ?? []) as string[]
  if (arr.includes(userId)) return
  await supabase.from('reminder_fires')
    .update({ dismissed_by: [...arr, userId] })
    .eq('id', fireId)
}

// Client-side safety-net ping. Fire-and-forget. The server cron is the
// primary scheduler, but pinging on tab focus catches any minute the
// cron skipped (or any minute the user opened the app right after).
let _lastFirePing = 0
export function pingFireReminders(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - _lastFirePing < 60 * 1000) return  // at most once a minute
  _lastFirePing = now
  fetch('/api/fire-reminders', { method: 'GET', cache: 'no-store' }).catch(() => {})
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
  try {
    // updateViaCache:'none' forces the browser to skip the HTTP cache when
    // checking /sw.js for updates. Without this, an old SW (with the old
    // notification badge baked in) can stick around for days on a PWA that
    // the user has installed to their home screen.
    const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    // Eagerly poke the browser to re-check the SW on every app open.
    reg.update().catch(() => { /* best-effort */ })
  } catch (e) { console.warn('SW:', e) }
}
