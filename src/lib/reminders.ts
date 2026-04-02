export interface Reminder {
  id: string
  text: string
  type: 'daily' | 'weekly' | 'once'
  time: string        // "HH:MM"
  weekDays?: number[] // 0=Sun … 6=Sat  (weekly only)
  date?: string       // "YYYY-MM-DD"   (once only)
  active: boolean
  createdAt: string
}

const KEY = 'pocket_eren_reminders'

export function getReminders(): Reminder[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveReminder(r: Reminder): void {
  const list = getReminders().filter(x => x.id !== r.id)
  localStorage.setItem(KEY, JSON.stringify([...list, r]))
}

export function deleteReminder(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getReminders().filter(r => r.id !== id)))
}

export function toggleReminder(id: string): void {
  const list = getReminders().map(r => r.id === id ? { ...r, active: !r.active } : r)
  localStorage.setItem(KEY, JSON.stringify(list))
}

// ── Scheduling ──────────────────────────────────────────────────────────────

async function getSW(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return reg.active
  } catch { return null }
}

/** Compute next fire timestamp for a reminder from now */
export function nextFireAt(r: Reminder): number | null {
  const now = Date.now()
  const [h, m] = r.time.split(':').map(Number)

  if (r.type === 'daily') {
    const d = new Date()
    d.setSeconds(0, 0)
    d.setHours(h, m)
    if (d.getTime() <= now) d.setDate(d.getDate() + 1)
    return d.getTime()
  }

  if (r.type === 'weekly') {
    const days = r.weekDays ?? []
    if (!days.length) return null
    let best = Infinity
    days.forEach(wd => {
      const d = new Date()
      d.setSeconds(0, 0)
      const diff = (wd - d.getDay() + 7) % 7
      d.setDate(d.getDate() + diff)
      d.setHours(h, m)
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

export async function scheduleAll(): Promise<void> {
  const sw = await getSW()
  if (!sw) return
  const reminders = getReminders()
  reminders.forEach(r => {
    if (!r.active) { sw.postMessage({ type: 'CANCEL', id: r.id }); return }
    const fireAt = nextFireAt(r)
    if (!fireAt) return
    sw.postMessage({ type: 'SCHEDULE', id: r.id, text: r.text, fireAt })
  })
}

export async function cancelOne(id: string): Promise<void> {
  const sw = await getSW()
  sw?.postMessage({ type: 'CANCEL', id })
}

export async function registerSW(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch (e) {
    console.warn('SW registration failed', e)
  }
}
