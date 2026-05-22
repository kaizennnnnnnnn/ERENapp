/**
 * GET /api/fire-reminders
 *
 * Pinged every minute by Supabase pg_cron (see
 * supabase/migration_reminder_fires.sql). For every active
 * household_reminders row whose scheduled time falls inside the
 * current minute, this:
 *
 *   1. Checks that the same reminder hasn't already fired in the
 *      last 30 minutes (so the cron can run liberally without
 *      double-buzzing).
 *   2. Inserts a reminder_fires log row — that's what powers the
 *      "missed reminders" list the client shows when the phone
 *      comes back online.
 *   3. Sends a web-push to every push_subscription belonging to
 *      the relevant user(s) — the partner sees the reminder too,
 *      unless the reminder is_private.
 *
 * The client safety-net (home page focus → fetch this endpoint)
 * makes it self-healing if the cron is paused or behind.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Fire a reminder if its scheduled minute matches the current minute,
// or up to N minutes ago — so a cron that's a tiny bit late doesn't
// silently skip the slot.
const WINDOW_MS = 2 * 60 * 1000
// Don't double-fire the same reminder within this window even if the
// schedule check repeatedly matches (it will for the full WINDOW_MS).
const DEDUP_MS  = 30 * 60 * 1000

interface Reminder {
  id: string
  household_id: string
  created_by: string
  text: string
  type: 'daily' | 'weekly' | 'once'
  time: string                  // "HH:MM"
  week_days: number[] | null
  date: string | null           // "YYYY-MM-DD" for once
  active: boolean
  is_private: boolean
}

function shouldFire(r: Reminder, now: Date): boolean {
  const parts = r.time?.split(':').map(Number)
  if (!parts || parts.length < 2) return false
  const [h, m] = parts
  if (Number.isNaN(h) || Number.isNaN(m)) return false

  if (r.type === 'once') {
    if (!r.date) return false
    const target = new Date(`${r.date}T${r.time}:00`)
    const delta = now.getTime() - target.getTime()
    return delta >= 0 && delta <= WINDOW_MS
  }

  // Daily / weekly: compute today's instance of HH:MM
  const target = new Date(now)
  target.setHours(h, m, 0, 0)
  const delta = now.getTime() - target.getTime()
  if (delta < 0 || delta > WINDOW_MS) return false

  if (r.type === 'daily') return true
  if (r.type === 'weekly') return r.week_days?.includes(now.getDay()) ?? false
  return false
}

export async function GET() {
  const supabase = createAdminClient()
  const now = new Date()

  const { data: reminders, error: remErr } = await supabase
    .from('household_reminders')
    .select('*')
    .eq('active', true)

  if (remErr) {
    return NextResponse.json({ ok: false, error: remErr.message }, { status: 500 })
  }
  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ ok: true, fired: 0, reason: 'no active reminders' })
  }

  const dueNow = (reminders as Reminder[]).filter(r => shouldFire(r, now))
  if (dueNow.length === 0) {
    return NextResponse.json({ ok: true, fired: 0 })
  }

  const dedupCutoff = new Date(now.getTime() - DEDUP_MS).toISOString()
  let firedCount = 0

  for (const r of dueNow) {
    // Dedup — has this reminder already fired recently?
    const { data: recent } = await supabase
      .from('reminder_fires')
      .select('id')
      .eq('reminder_id', r.id)
      .gte('fired_at', dedupCutoff)
      .limit(1)
    if (recent && recent.length > 0) continue

    // Log the fire so missed-reminders UI can pick it up later.
    const { error: fireErr } = await supabase
      .from('reminder_fires')
      .insert({
        reminder_id:  r.id,
        household_id: r.household_id,
        user_id:      r.is_private ? r.created_by : null,
        text:         r.text,
      })
    if (fireErr) continue

    // Resolve push targets.
    let targetUserIds: string[]
    if (r.is_private) {
      targetUserIds = [r.created_by]
    } else {
      const { data: members } = await supabase
        .from('profiles')
        .select('id')
        .eq('household_id', r.household_id)
      targetUserIds = (members ?? []).map(m => m.id)
    }

    // Push to every subscription owned by each target user. Expired
    // endpoints get cleaned up here too so the table doesn't grow
    // stale.
    const expired: string[] = []
    for (const uid of targetUserIds) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', uid)
      for (const sub of subs ?? []) {
        const ok = await sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          '⏰ Reminder',
          r.text,
          'reminder-' + r.id,
          '/',
        )
        if (!ok) expired.push(sub.id)
      }
    }
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }

    firedCount++
  }

  return NextResponse.json({ ok: true, fired: firedCount })
}
